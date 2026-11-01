import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startCli } from '../helpers/cli.js';

// F-10: private documents from a production tarball, from init to a restore in a new clone, with the document map.

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../../', import.meta.url));
const KEY = 'gitlab.com/team/web/shop';

async function npm(args, cwd) {
  const cli = process.env.npm_execpath;
  const env = { ...process.env };
  if (env.DOCMAP_NPM_CACHE) env.npm_config_cache = env.DOCMAP_NPM_CACHE;
  return execute(cli ? process.execPath : 'npm', cli ? [cli, ...args] : args, { cwd, env, timeout: 60000, maxBuffer: 2 ** 20 });
}

const lines = output => output.trimEnd().split('\n').map(line => line.split('\t'));
const field = (output, name) => lines(output).find(line => line[0] === name);

async function filesIn(root, directory = root, result = {}) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    const relative = path.relative(root, filename).split(path.sep).join('/');
    if (entry.isDirectory()) await filesIn(root, filename, result);
    else if (entry.isFile()) result[relative] = createHash('sha256').update(await fs.readFile(filename)).digest('hex');
  }
  return result;
}

async function waitFor(check, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (check()) return true;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return check();
}

async function write(root, relative, content) {
  const filename = path.join(root, ...relative.split('/'));
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, content);
}

test('F-10: private documents survive a deleted clone through a packaged backup and restore', { timeout: 180000 }, async t => {
  const cleanups = [];
  const scope = { after: fn => cleanups.push(fn) };
  t.after(async () => { for (const cleanup of cleanups.reverse()) await cleanup(); });
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'docatlas-private-f10-')));
  cleanups.push(() => fs.rm(temporary, { recursive: true, force: true }));

  // Production install in its own folder, outside the repositories it works on.
  const installRoot = path.join(temporary, 'tools');
  await fs.mkdir(installRoot);
  const { stdout: packed } = await npm(['pack', '--json', '--pack-destination', installRoot], repository);
  const [pack] = JSON.parse(packed);
  const files = new Set(pack.files.map(file => file.path));
  for (const filename of ['src/private/command.js', 'src/private/store.js', 'src/private/restore.js', 'src/private/key.js',
    'src/private/notice.js', 'agent-kit/skills/doc-driven-private-v1/SKILL.md', 'agent-kit/agents/doc-driven-private-v1.md']) {
    assert.ok(files.has(filename), 'Missing packaged file: ' + filename);
  }
  await fs.writeFile(path.join(installRoot, 'package.json'), '{"private":true}\n');
  await npm(['install', '--offline', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund',
    path.join(installRoot, pack.filename)], installRoot);
  const executable = path.join(installRoot, 'node_modules', 'docatlas', 'bin', 'docatlas.js');

  // A home folder and git settings that belong to this test only.
  const home = path.join(temporary, '사용자 홈');
  await fs.mkdir(home);
  const gitConfig = path.join(temporary, 'gitconfig');
  await fs.writeFile(gitConfig, '[user]\n\tname = docatlas\n\temail = docatlas@example.com\n[commit]\n\tgpgsign = false\n');
  const env = {
    ...process.env, HOME: home, USERPROFILE: home, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: '1',
    GIT_CEILING_DIRECTORIES: temporary
  };
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[name];
  const git = (cwd, ...args) => execute('git', args, { cwd, env }).then(result => result.stdout);
  const docatlas = (cwd, ...args) => execute(process.execPath, [executable, 'private', ...args], { cwd, env })
    .then(result => ({ code: 0, ...result }), error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));

  // F-10: an origin with public docs, a committed install record and a .docatlas below the root.
  const origin = path.join(temporary, 'origin.git');
  await git(temporary, 'init', '-q', '--bare', origin);
  const seed = path.join(temporary, 'seed');
  await git(temporary, 'clone', '-q', origin, seed);
  await write(seed, 'docs/catalog/REQUIREMENTS.md', '# Catalog — Requirements\n\nPublic catalog plan.\n');
  await write(seed, '.docatlas/agents.json', '{"schema":1,"files":{}}\n');
  await write(seed, 'packages/app/.docatlas/private/x/A.md', '# Not the private folder\n');
  await git(seed, 'add', '-A');
  await git(seed, 'commit', '-q', '-m', 'Public documents');
  await git(seed, 'push', '-q', 'origin', 'HEAD');

  // The first clone writes private documents for two features.
  const first = path.join(temporary, 'work', 'shop');
  await fs.mkdir(path.dirname(first));
  await git(temporary, 'clone', '-q', origin, first);
  await git(first, 'remote', 'set-url', 'origin', 'https://gitlab.com/team/web/shop.git');
  const init = await docatlas(path.join(first, 'docs'), 'init');
  assert.equal(init.code, 0, init.stderr);
  assert.deepEqual(field(init.stdout, 'summary'), ['summary', 'folder=create', 'exclude=add']);
  const privateFiles = {
    'payments/REQUIREMENTS.md': '# Payments — Requirements\n\nRefundToken plan.\r\n',
    'payments/DESIGN.md': '# Payments — Design\n\n[Catalog](../../../docs/catalog/REQUIREMENTS.md)\n',
    'payments/flow.png': Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex'),
    '검색 기능/IMPLEMENT.md': '# 검색 — 구현\n\nRefs: RQ-1\n'
  };
  for (const [relative, content] of Object.entries(privateFiles)) await write(first, '.docatlas/private/' + relative, content);
  let linked = true;
  try {
    await fs.symlink(path.join(first, 'docs', 'catalog', 'REQUIREMENTS.md'), path.join(first, '.docatlas', 'private', 'link.md'));
  } catch {
    linked = false;
  }
  assert.equal(await git(first, 'status', '--porcelain', '--untracked-files=all'), '', 'git sees no private file');
  assert.equal(field((await docatlas(first, 'status')).stdout, 'summary')[1], 'ok');

  const backup = await docatlas(first, 'backup');
  assert.equal(backup.code, 0, backup.stderr);
  assert.deepEqual(field(backup.stdout, 'key'), ['key', KEY, 'origin']);
  assert.deepEqual(field(backup.stdout, 'summary'), ['summary', 'backup=create', 'files=4', 'removed=0']);
  if (linked) assert.deepEqual(field(backup.stdout, 'warning'), ['warning', 'symbolic-link', '.docatlas/private/link.md']);
  assert.equal((await docatlas(first, 'backup')).stdout.includes('unchanged\tbackup'), true, 'an unchanged folder is not copied again');

  // The map of the first clone shows the Private group and no restore hint.
  const firstMap = await startCli(scope, { cwd: first, args: ['--no-open'], env, executable });
  const firstSnapshot = await (await fetch(firstMap.url + 'api/map')).json();
  const privateIds = firstSnapshot.documents.filter(document => document.isPrivate).map(document => document.id).sort();
  assert.deepEqual(privateIds, ['.docatlas/private/payments/DESIGN.md', '.docatlas/private/payments/REQUIREMENTS.md',
    '.docatlas/private/검색 기능/IMPLEMENT.md']);
  assert.ok(!firstSnapshot.documents.some(document => document.id.startsWith('packages/')), 'a .docatlas below the root is not collected');
  assert.ok(firstSnapshot.groups.some(group => group.id === '.docatlas/private' && group.title === 'Private'));
  firstMap.child.kill(process.platform === 'win32' ? undefined : 'SIGINT');
  await firstMap.exited;
  assert.ok(!firstMap.output().stdout.includes('Private documents:'), firstMap.output().stdout);

  // The work folder is deleted; the backup lives in the home folder.
  await fs.rm(first, { recursive: true, force: true });
  const store = path.join(home, '.docatlas', 'private-backups', ...KEY.split('/'));
  assert.equal((await fs.readdir(store)).filter(name => /^\d{8}T\d{6}Z/.test(name)).length, 1);

  // A new clone over SSH finds the same backup. The map reminds, the preview writes nothing, and the restore brings it all back.
  const second = path.join(temporary, 'again', 'shop');
  await fs.mkdir(path.dirname(second));
  await git(temporary, 'clone', '-q', origin, second);
  await git(second, 'remote', 'set-url', 'origin', 'git@gitlab.com:team/web/shop.git');
  const reminder = await startCli(scope, { cwd: second, args: ['--no-open'], env, executable });
  assert.ok(await waitFor(() => reminder.output().stdout.includes('Private documents:')), reminder.output().stdout);
  assert.match(reminder.output().stdout, /Private documents: a backup from .+ UTC is available\. Restore with: docatlas private restore --dry-run\n/);
  reminder.child.kill(process.platform === 'win32' ? undefined : 'SIGINT');
  await reminder.exited;

  const cloneBefore = await filesIn(second);
  const preview = await docatlas(second, 'restore', '--dry-run');
  assert.equal(preview.code, 0, preview.stderr);
  assert.deepEqual(field(preview.stdout, 'dry-run').slice(0, 3), ['dry-run', 'create', 'folder']);
  assert.deepEqual(await filesIn(second), cloneBefore, 'the preview writes nothing');
  const restored = await docatlas(second, 'restore');
  assert.equal(restored.code, 0, restored.stderr);
  assert.deepEqual(field(restored.stdout, 'summary'), ['summary', 'create=4', 'unchanged=0', 'conflict=0', 'overwrite=0', 'blocked=0']);
  for (const [relative, content] of Object.entries(privateFiles)) {
    assert.deepEqual(await fs.readFile(path.join(second, '.docatlas', 'private', ...relative.split('/'))), Buffer.from(content), relative);
  }
  assert.match(await fs.readFile(path.join(second, '.git', 'info', 'exclude'), 'utf8'), /^\/\.docatlas\/private\/$/m);
  assert.equal(await git(second, 'status', '--porcelain', '--untracked-files=all'), '', 'restored documents stay hidden');
  assert.equal(field((await docatlas(second, 'status')).stdout, 'backup')[1], 'same');

  // The restored map shows the Private group again, with no hint.
  const secondMap = await startCli(scope, { cwd: second, args: ['--no-open'], env, executable });
  const secondSnapshot = await (await fetch(secondMap.url + 'api/map')).json();
  assert.deepEqual(secondSnapshot.documents.filter(document => document.isPrivate).map(document => document.id).sort(), privateIds);
  const reader = await (await fetch(secondMap.url + 'api/document?id=' + encodeURIComponent('.docatlas/private/payments/DESIGN.md'))).json();
  assert.match(reader.html, /href="\/\?doc=docs%2Fcatalog%2FREQUIREMENTS\.md"/, 'a private link to a public document still resolves');
  await new Promise(resolve => setTimeout(resolve, 300));
  secondMap.child.kill(process.platform === 'win32' ? undefined : 'SIGINT');
  await secondMap.exited;
  assert.ok(!secondMap.output().stdout.includes('Private documents:'), secondMap.output().stdout);
});
