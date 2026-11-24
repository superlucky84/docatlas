import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { applyPlan, loadKit, planInstall, runAgents, selectItems } from '../src/agent-kit/index.js';
import { checkAgentKit } from '../scripts/agent-kit.js';
import { SAMPLE_ITEMS, createWorkspace, ruleText, skillText, snapshot, writeKit } from './helpers/agent-kit.js';

const NOW = new Date('2026-10-28T04:05:06.789Z');
const NO_POSIX_PERMISSIONS = process.platform === 'win32' || process.getuid?.() === 0;

async function agents({ home, project, kitDir }, args) {
  let stdout = '';
  let stderr = '';
  const code = await runAgents(args, {
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } },
    home, cwd: project, kitDir, now: NOW
  });
  return { code, stdout, stderr, lines: stdout.trimEnd().split('\n').map(line => line.split('\t')) };
}

async function setup(t, options) {
  const workspace = await createWorkspace(t);
  await writeKit(workspace.kitDir, options);
  return workspace;
}

async function walk(directory) {
  const found = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true, recursive: true })) {
    found.push(path.join(entry.parentPath ?? entry.path, entry.name));
  }
  return found;
}

const read = filename => fs.readFile(filename, 'utf8');
const mode = async filename => (await fs.stat(filename)).mode & 0o777;

test('a failure after a forced replace restores the edited file and keeps its backup', async t => {
  if (NO_POSIX_PERMISSIONS) {
    t.skip('needs POSIX permissions without root');
    return;
  }
  const workspace = await setup(t);
  const edited = ruleText('sample-designer', '# My rule\n\nEdited locally.\n');
  const agent = await workspace.write(workspace.home, '.claude/agents/sample-designer.md', edited);
  await fs.chmod(agent, 0o640);
  const locked = path.join(workspace.home, '.codex', 'agents');
  await fs.mkdir(locked, { recursive: true });
  await fs.chmod(locked, 0o555);
  const before = await snapshot(workspace.home);
  let result;
  try {
    result = await agents(workspace, ['install', '--target', 'all', '--force']);
  } finally {
    await fs.chmod(locked, 0o755);
  }
  assert.equal(result.code, 1);
  const backupRoot = path.join(workspace.home, '.docatlas', 'backups', '2026-10-28T04-05-06-789Z', 'global');
  assert.ok(result.stderr.includes('Files written by this run were restored. Backups are in ' + backupRoot + '.'), result.stderr);
  assert.equal(await read(agent), edited);
  assert.equal(await mode(agent), 0o640);
  assert.equal(await read(path.join(backupRoot, '.claude', 'agents', 'sample-designer.md')), edited);
  const after = (await snapshot(workspace.home)).filter(entry => !entry.startsWith('.docatlas/backups'));
  assert.deepEqual(after, before.filter(entry => !entry.startsWith('.docatlas/')).concat('.docatlas/').sort());
});

test('a forced replace keeps the permission bits of the replaced file', async t => {
  if (NO_POSIX_PERMISSIONS) {
    t.skip('needs POSIX permissions without root');
    return;
  }
  const workspace = await setup(t);
  const agent = await workspace.write(workspace.home, '.claude/agents/sample-designer.md', '# Edited\n');
  await fs.chmod(agent, 0o600);
  const result = await agents(workspace, ['install', '--target', 'claude', '--force']);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await read(agent), ruleText('sample-designer'));
  assert.equal(await mode(agent), 0o600);
});

test('an install lock stops a second install and concurrent runs leave one consistent result', async t => {
  const workspace = await setup(t);
  const lock = await workspace.write(workspace.home, '.docatlas/install.lock', '{"pid":1}\n');
  const before = await snapshot(workspace.home);
  const blocked = await agents(workspace, ['install', '--target', 'all']);
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /Another docatlas agents install is running \(.*install\.lock\)\. Nothing was changed\./);
  assert.deepEqual(await snapshot(workspace.home), before);
  await fs.rm(lock);

  const runs = await Promise.all([1, 2, 3].map(() => agents(workspace, ['install', '--target', 'all'])));
  assert.ok(runs.some(run => run.code === 0), JSON.stringify(runs));
  for (const run of runs.filter(run => run.code !== 0)) {
    assert.equal(run.code, 1);
    assert.match(run.stderr, /Another docatlas agents install is running|changed after planning/);
  }
  const kit = await loadKit(workspace.kitDir);
  const [item] = selectItems(kit);
  assert.equal(await read(path.join(workspace.home, '.codex', 'agents', 'sample-designer.toml')), item.files.codexAgent.text);
  assert.equal(await read(path.join(workspace.home, '.gemini', 'config', 'agents', 'sample-designer.md')), item.files.agent.text);
  const record = JSON.parse(await read(path.join(workspace.home, '.docatlas', 'agents.json')));
  assert.equal(Object.keys(record.files).length, 6);
  const leftovers = (await walk(workspace.home)).filter(filename => /\.docatlas-\d+-|install\.lock$/.test(filename));
  assert.deepEqual(leftovers, []);
});

test('Korean and space paths with CRLF kit sources install LF files and stay unchanged', async t => {
  const workspace = await createWorkspace(t);
  const crlf = SAMPLE_ITEMS.map(item => ({
    ...item,
    skill: skillText(item.name, item.version).replaceAll('\n', '\r\n'),
    agent: ruleText(item.name).replaceAll('\n', '\r\n')
  }));
  await writeKit(workspace.kitDir, { items: crlf });
  assert.deepEqual((await checkAgentKit(workspace.kitDir)).errors, []);
  const home = path.join(workspace.root, '사용자 홈 with spaces');
  const project = path.join(workspace.root, '한글 프로젝트 with spaces');
  await fs.mkdir(home);
  await fs.mkdir(project);
  const context = { home, project, kitDir: workspace.kitDir };

  const first = await agents(context, ['install', '--target', 'all']);
  assert.equal(first.code, 0, first.stderr);
  for (const relative of [
    '.claude/skills/sample-designer/SKILL.md',
    '.codex/agents/sample-designer.toml',
    '.gemini/config/skills/sample-designer/SKILL.md',
    '.gemini/config/agents/sample-designer.md'
  ]) {
    const text = await read(path.join(home, ...relative.split('/')));
    assert.ok(!text.includes('\r'), relative);
  }
  assert.equal(await read(path.join(home, '.claude', 'skills', 'sample-designer', 'SKILL.md')), skillText('sample-designer', '1.1.0'));
  const again = await agents(context, ['install', '--target', 'all']);
  assert.deepEqual(again.lines.slice(0, 6).map(line => line[0]), Array(6).fill('unchanged'));

  const local = await agents(context, ['install', '--project', '--target', 'all']);
  assert.equal(local.code, 0, local.stderr);
  assert.equal(local.lines[0][5], path.join(project, '.claude', 'skills', 'sample-designer', 'SKILL.md'));
  assert.deepEqual(local.lines.filter(line => line[0] === 'warning').map(line => line[1]),
    ['same-name', 'same-name', 'same-name', 'same-name', 'same-name', 'same-name', 'codex-trust']);
  assert.ok(await read(path.join(project, '.docatlas', 'agents.json')));
});

test('a symbolic link that appears after planning stops the install before any write', async t => {
  const workspace = await setup(t);
  const kit = await loadKit(workspace.kitDir);
  const plan = await planInstall({
    kit, items: selectItems(kit), scope: 'global', home: workspace.home, clients: ['claude', 'codex']
  });
  const elsewhere = path.join(workspace.root, 'elsewhere');
  await fs.mkdir(elsewhere);
  await fs.mkdir(path.join(workspace.home, '.agents'));
  try {
    await fs.symlink(elsewhere, path.join(workspace.home, '.agents', 'skills'));
  } catch (error) {
    t.skip('symbolic links are unavailable: ' + error.code);
    return;
  }
  await assert.rejects(applyPlan(plan, { home: workspace.home, now: NOW }), /no longer safe to write \(symlink\)\. Nothing was changed\./);
  assert.deepEqual(await fs.readdir(elsewhere), []);
  assert.deepEqual((await fs.readdir(workspace.home)).sort(), ['.agents']);
});

test('an older docatlas keeps newer installs, and ctxbin copies are never touched', async t => {
  const workspace = await setup(t);
  const newer = await agents(workspace, ['install', '--target', 'claude']);
  assert.equal(newer.code, 0, newer.stderr);
  const skill = path.join(workspace.home, '.claude', 'skills', 'sample-designer', 'SKILL.md');
  const installed = await read(skill);

  const oldKit = path.join(workspace.root, 'old-kit');
  await writeKit(oldKit, {
    kitVersion: '0.9.0',
    items: [{ name: 'sample-designer', version: '1.0.0', default: true, previous: [] }]
  });
  const older = await agents({ ...workspace, kitDir: oldKit }, ['install', '--target', 'claude']);
  assert.equal(older.code, 3);
  assert.deepEqual(older.lines[0].slice(0, 2), ['skip-downgrade', 'downgrade']);
  assert.equal(await read(skill), installed);

  const copy = await workspace.write(workspace.home, '.agents/skills/sample-designer/SKILL.md', '# Managed by ctxbin\n');
  await workspace.write(workspace.home, '.agents/skills/.ctxbin-sync.json', JSON.stringify({ version: 1, items: { 'sample-designer': 'digest' } }));
  const managed = await agents(workspace, ['install', '--target', 'codex']);
  assert.equal(managed.code, 3);
  assert.deepEqual(managed.lines[0].slice(0, 2), ['skip-managed', 'ctxbin']);
  assert.equal(await read(copy), '# Managed by ctxbin\n');
  const record = JSON.parse(await read(path.join(workspace.home, '.docatlas', 'agents.json')));
  assert.equal(record.files['codex/skill/sample-designer'], undefined);
  assert.equal(record.files['claude/skill/sample-designer'].kitVersion, '1.0.0');
});

test('shared project skills between Codex and Antigravity deduplicate writes, backups, rollback and records', async t => {
  const workspace = await setup(t);
  const oldKit = path.join(workspace.root, 'old-kit');
  await writeKit(oldKit, {
    kitVersion: '0.9.0',
    items: [{
      name: 'sample-designer',
      version: '1.0.0',
      default: true,
      skill: skillText('sample-designer', '1.0.0', 'Recorded earlier.\n'),
      agent: ruleText('sample-designer'),
      previous: []
    }]
  });
  // Install project files for Codex alone with an older kit; Antigravity should recognize the recorded shared skill path.
  const codexOld = await agents({ ...workspace, kitDir: oldKit }, ['install', '--project', '--target', 'codex']);
  assert.equal(codexOld.code, 0, codexOld.stderr);
  const antigravityUpdate = await agents(workspace, ['install', '--project', '--target', 'antigravity']);
  assert.equal(antigravityUpdate.code, 0, antigravityUpdate.stderr);
  assert.deepEqual(antigravityUpdate.lines.slice(0, 2).map(line => line.slice(0, 4)), [
    ['replace', 'recorded', 'antigravity', 'skill'],
    ['create', 'new', 'antigravity', 'agent']
  ]);

  // Downgrade protection also works across the shared project skill path.
  const downgrade = await agents({ ...workspace, kitDir: oldKit }, ['install', '--project', '--target', 'codex']);
  assert.equal(downgrade.code, 3);
  assert.deepEqual(downgrade.lines[0].slice(0, 4), ['skip-downgrade', 'downgrade', 'codex', 'skill']);

  // An edited shared skill is skipped for both clients, backed up once under --force, and restored if a later write fails.
  const sharedSkill = path.join(workspace.project, '.agents', 'skills', 'sample-designer', 'SKILL.md');
  const edited = '# Edited shared project skill\n';
  await fs.writeFile(sharedSkill, edited);
  const skipped = await agents(workspace, ['install', '--project', '--target', 'all']);
  assert.equal(skipped.code, 3);
  assert.deepEqual(skipped.lines.filter(line => line[0] === 'skip-modified').map(line => [line[2], line[3]]), [
    ['codex', 'skill'],
    ['antigravity', 'skill']
  ]);
  assert.equal(await read(sharedSkill), edited);

  if (!NO_POSIX_PERMISSIONS) {
    const locked = path.join(workspace.project, '.agents', 'agents');
    await fs.rm(path.join(locked, 'sample-designer.md'));
    await fs.chmod(locked, 0o555);
    try {
      const failed = await agents(workspace, ['install', '--project', '--target', 'all', '--force']);
      assert.equal(failed.code, 1);
      assert.match(failed.stderr, /Files written by this run were restored/);
      assert.equal(await read(sharedSkill), edited);
    } finally {
      await fs.chmod(locked, 0o755);
    }
    await fs.rm(path.join(workspace.home, '.docatlas', 'backups'), { recursive: true, force: true });
  }

  const forced = await agents(workspace, ['install', '--project', '--target', 'all', '--force']);
  assert.equal(forced.code, 0, forced.stderr);
  const backups = forced.lines.filter(line => line[0] === 'backup');
  assert.equal(backups.length, 1, 'shared skill path is backed up once');
  assert.equal(backups[0][1], sharedSkill);
  assert.equal(await read(backups[0][2]), edited);
  assert.equal(await read(sharedSkill), skillText('sample-designer', '1.1.0'));
  const record = JSON.parse(await read(path.join(workspace.project, '.docatlas', 'agents.json')));
  assert.equal(record.files['codex/skill/sample-designer'].path, '.agents/skills/sample-designer/SKILL.md');
  assert.equal(record.files['antigravity/skill/sample-designer'].path, '.agents/skills/sample-designer/SKILL.md');
});

test('Antigravity global installs allow linked ~/.gemini or ~/.gemini/config folders and respect ctxbin', async t => {
  const workspace = await setup(t);
  await workspace.write(workspace.home, '.gemini/config/skills/sample-designer/SKILL.md', '# Managed skill\n');
  await workspace.write(workspace.home, '.gemini/config/skills/.ctxbin-sync.json',
    JSON.stringify({ version: 1, items: { 'sample-designer': 'digest' } }));
  await workspace.write(workspace.home, '.gemini/config/agents/sample-designer.md', '# Managed agent\n');
  await workspace.write(workspace.home, '.gemini/config/agents/.ctxbin-sync.json',
    JSON.stringify({ version: 1, items: { 'sample-designer': 'digest' } }));
  const managed = await agents(workspace, ['install', '--target', 'antigravity']);
  assert.equal(managed.code, 3);
  assert.deepEqual(managed.lines.slice(0, 2).map(line => line.slice(0, 4)), [
    ['skip-managed', 'ctxbin', 'antigravity', 'skill'],
    ['skip-managed', 'ctxbin', 'antigravity', 'agent']
  ]);

  await fs.rm(path.join(workspace.home, '.gemini'), { recursive: true, force: true });
  const dotfiles = path.join(workspace.root, 'dotfiles-gemini-config');
  const elsewhere = path.join(workspace.root, 'elsewhere-skills');
  await fs.mkdir(dotfiles, { recursive: true });
  await fs.mkdir(elsewhere, { recursive: true });
  await fs.mkdir(path.join(workspace.home, '.gemini'), { recursive: true });
  try {
    await fs.symlink(dotfiles, path.join(workspace.home, '.gemini', 'config'));
  } catch (error) {
    t.skip('symbolic links are unavailable: ' + error.code);
    return;
  }
  const linkedConfig = await agents(workspace, ['install', '--target', 'antigravity']);
  assert.equal(linkedConfig.code, 0, linkedConfig.stderr);
  assert.equal(await read(path.join(dotfiles, 'skills', 'sample-designer', 'SKILL.md')), skillText('sample-designer', '1.1.0'));

  await fs.rm(path.join(dotfiles, 'skills'), { recursive: true, force: true });
  await fs.symlink(elsewhere, path.join(dotfiles, 'skills'));
  const blockedSubdir = await agents(workspace, ['install', '--target', 'antigravity']);
  assert.equal(blockedSubdir.code, 3);
  assert.deepEqual(blockedSubdir.lines[0].slice(0, 4), ['blocked', 'symlink', 'antigravity', 'skill']);
});
