import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../src/cli.js';
import { EXCLUDE_COMMENT, PRIVATE_OPTIONS, privateHelp, runPrivate } from '../src/private/index.js';

const PATTERN = '/.docatlas/private/';

async function workspace(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'docatlas-private-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=docatlas', '-c', 'user.email=docatlas@example.com', ...args], { cwd, encoding: 'utf8' });
}

async function repository(t) {
  const root = await workspace(t);
  git(root, 'init', '-q');
  git(root, 'commit', '-q', '--allow-empty', '-m', 'start');
  return root;
}

async function write(root, relative, text = '# Document\n') {
  const filename = path.join(root, ...relative.split('/'));
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, text);
  return filename;
}

async function privateCommand(cwd, args, options = {}) {
  let stdout = '';
  let stderr = '';
  const code = await runPrivate(args, {
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } },
    cwd, ...options
  });
  return { code, stdout, stderr, lines: stdout.trimEnd().split('\n').map(line => line.split('\t')) };
}

const exists = filename => fs.access(filename).then(() => true, () => false);
const excludeFile = root => path.join(root, '.git', 'info', 'exclude');
const untracked = root => git(root, 'status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean);
const field = (lines, name) => lines.find(line => line[0] === name);

test('init creates the folder and hides it once, while agents.json stays visible to git', async t => {
  const root = await repository(t);
  const before = await fs.readFile(excludeFile(root), 'utf8');
  const first = await privateCommand(root, ['init']);
  assert.equal(first.code, 0, first.stderr);
  assert.deepEqual(first.lines, [
    ['create', 'folder', path.join(root, '.docatlas', 'private')],
    ['add', 'exclude', excludeFile(root), PATTERN],
    ['summary', 'folder=create', 'exclude=add']
  ]);
  assert.equal(await fs.readFile(excludeFile(root), 'utf8'), before + EXCLUDE_COMMENT + '\n' + PATTERN + '\n');

  await write(root, '.docatlas/private/payments/REQUIREMENTS.md');
  await write(root, '.docatlas/agents.json', '{}\n');
  assert.deepEqual(untracked(root), ['?? .docatlas/agents.json']);
  assert.equal(await exists(path.join(root, '.gitignore')), false);

  const second = await privateCommand(root, ['init']);
  assert.equal(second.code, 0);
  assert.deepEqual(second.lines.at(-1), ['summary', 'folder=unchanged', 'exclude=unchanged']);
  const text = await fs.readFile(excludeFile(root), 'utf8');
  assert.equal(text.split('\n').filter(line => line === PATTERN).length, 1);

  const status = await privateCommand(root, ['status']);
  assert.equal(status.code, 0, status.stderr);
  assert.deepEqual(field(status.lines, 'documents'), ['documents', '1']);
  assert.deepEqual(field(status.lines, 'ignored'), ['ignored', 'yes']);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'ok']);
});

test('a dry run plans the same actions and writes nothing', async t => {
  const root = await repository(t);
  const before = await fs.readFile(excludeFile(root), 'utf8');
  const result = await privateCommand(root, ['init', '--dry-run']);
  assert.equal(result.code, 0);
  assert.deepEqual(result.lines.map(line => line.slice(0, 3)), [
    ['dry-run', 'create', 'folder'], ['dry-run', 'add', 'exclude'], ['dry-run', 'summary', 'folder=create']
  ]);
  assert.equal(await exists(path.join(root, '.docatlas')), false);
  assert.equal(await fs.readFile(excludeFile(root), 'utf8'), before);
});

test('private files already tracked by git stop init and status without writing', async t => {
  const root = await repository(t);
  await write(root, '.docatlas/private/notes/DESIGN.md');
  git(root, 'add', '.docatlas/private/notes/DESIGN.md');
  git(root, 'commit', '-q', '-m', 'oops');
  const before = await fs.readFile(excludeFile(root), 'utf8');
  const result = await privateCommand(root, ['init']);
  assert.equal(result.code, 3);
  assert.deepEqual(result.lines, [['blocked', 'tracked', '.docatlas/private/notes/DESIGN.md']]);
  assert.match(result.stderr, /already tracks/);
  assert.equal(await fs.readFile(excludeFile(root), 'utf8'), before);
  const status = await privateCommand(root, ['status']);
  assert.equal(status.code, 3);
  assert.deepEqual(field(status.lines, 'tracked'), ['tracked', '1']);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'tracked']);
});

test('documents that are not hidden are reported as exposed until init runs', async t => {
  const root = await repository(t);
  await write(root, '.docatlas/private/search/IMPLEMENT.md');
  const status = await privateCommand(root, ['status']);
  assert.equal(status.code, 3);
  assert.deepEqual(field(status.lines, 'exclude').slice(0, 2), ['exclude', 'missing']);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'exposed']);
  assert.match(status.stderr, /docatlas private init/);
  assert.equal((await privateCommand(root, ['init'])).code, 0);
  assert.equal((await privateCommand(root, ['status'])).code, 0);
});

test('outside git the folder is still created and the run warns that nothing is hidden', async t => {
  const root = await workspace(t);
  const result = await privateCommand(root, ['init']);
  assert.equal(result.code, 0);
  assert.deepEqual(result.lines[1], ['skip', 'exclude', '-', '-']);
  assert.equal(result.lines[2][0], 'warning');
  assert.equal(result.lines[2][1], 'not-git');
  assert.equal(await exists(path.join(root, '.docatlas', 'private')), true);
  const status = await privateCommand(root, ['status']);
  assert.equal(status.code, 0);
  assert.deepEqual(field(status.lines, 'git'), ['git', 'not-git', '-']);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'not-git']);

  const missing = await privateCommand(root, ['init'], { git: 'docatlas-git-that-does-not-exist' });
  assert.equal(missing.code, 0);
  assert.equal(field(missing.lines, 'warning')[1], 'git-missing');
});

test('a root below the top folder, with Korean, spaces and brackets, gets a literal pattern', async t => {
  const repo = await repository(t);
  const root = path.join(repo, '한글 폴더', 'app[1]');
  await fs.mkdir(root, { recursive: true });
  const result = await privateCommand(root, ['init']);
  assert.equal(result.code, 0, result.stderr);
  const pattern = '/한글 폴더/app\\[1\\]/.docatlas/private/';
  assert.deepEqual(result.lines[1], ['add', 'exclude', excludeFile(repo), pattern]);
  await write(root, '.docatlas/private/a/REQUIREMENTS.md');
  await write(repo, '.docatlas/private/top/REQUIREMENTS.md');
  assert.deepEqual(untracked(repo), ['?? .docatlas/private/top/REQUIREMENTS.md']);
  assert.deepEqual(field((await privateCommand(root, ['status'])).lines, 'ignored'), ['ignored', 'yes']);
});

test('a linked worktree hides the folder through the shared exclude file', async t => {
  const repo = await repository(t);
  const worktree = path.join(path.dirname(repo), path.basename(repo) + '-worktree');
  t.after(() => fs.rm(worktree, { recursive: true, force: true }));
  git(repo, 'worktree', 'add', '-q', '--detach', worktree);
  const root = await fs.realpath(worktree);
  const result = await privateCommand(root, ['init']);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.lines[1][2], excludeFile(repo));
  await write(root, '.docatlas/private/a/DESIGN.md');
  assert.deepEqual(untracked(root), []);
});

test('existing exclude text, CRLF line endings and the file mode are kept', async t => {
  const root = await repository(t);
  await fs.writeFile(excludeFile(root), 'build/\r\n*.log');
  if (process.platform !== 'win32') await fs.chmod(excludeFile(root), 0o600);
  assert.equal((await privateCommand(root, ['init'])).code, 0);
  assert.equal(await fs.readFile(excludeFile(root), 'utf8'), 'build/\r\n*.log\r\n' + EXCLUDE_COMMENT + '\r\n' + PATTERN + '\r\n');
  if (process.platform !== 'win32') assert.equal((await fs.stat(excludeFile(root))).mode & 0o777, 0o600);
  const leftovers = (await fs.readdir(path.dirname(excludeFile(root)))).filter(name => name.includes('.docatlas-'));
  assert.deepEqual(leftovers, []);
});

test('a symbolic link on the private path blocks init before any write', async t => {
  const root = await repository(t);
  const outside = await workspace(t);
  try {
    await fs.symlink(outside, path.join(root, '.docatlas'), 'dir');
  } catch (error) {
    t.skip('symbolic links are not available: ' + error.code);
    return;
  }
  const before = await fs.readFile(excludeFile(root), 'utf8');
  const result = await privateCommand(root, ['init']);
  assert.equal(result.code, 3);
  assert.deepEqual(result.lines, [['blocked', 'symbolic-link', path.join(root, '.docatlas')]]);
  assert.deepEqual(await fs.readdir(outside), []);
  assert.equal(await fs.readFile(excludeFile(root), 'utf8'), before);
  assert.deepEqual(field((await privateCommand(root, ['status'])).lines, 'summary'), ['summary', 'blocked']);
});

test('help covers every option, and invalid use exits 2 without writing', async t => {
  const help = privateHelp();
  for (const option of Object.keys(PRIVATE_OPTIONS)) {
    assert.ok(help.includes('--' + option), option);
  }
  for (const word of ['init', 'status', '.git/info/exclude', 'agents.json', 'Exit codes']) {
    assert.ok(help.includes(word), word);
  }
  const root = await workspace(t);
  assert.equal((await privateCommand(root, [])).code, 2);
  assert.equal((await privateCommand(root, ['backup-all'])).code, 2);
  assert.equal((await privateCommand(root, ['status', '--dry-run'])).code, 2);
  assert.equal((await privateCommand(root, ['init', '--root', path.join(root, 'missing')])).code, 2);
  assert.equal((await privateCommand(root, ['init', 'extra'])).code, 2);
  assert.equal(await exists(path.join(root, '.docatlas')), false);
});

test('the docatlas command runs private commands and lists them in its help', async t => {
  const root = await repository(t);
  let stdout = '';
  const code = await run(['private', 'init', '--root', root], {
    stdout: { write: chunk => { stdout += chunk; } }, stderr: { write: () => {} }, cwd: os.tmpdir()
  });
  assert.equal(code, 0);
  assert.match(stdout, /^summary\tfolder=create\texclude=add$/m);
  let help = '';
  await run(['--help'], { stdout: { write: chunk => { help += chunk; } }, stderr: { write: () => {} } });
  assert.match(help, /docatlas private init\|status/);
});
