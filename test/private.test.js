import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../src/cli.js';
import { EXCLUDE_COMMENT, PRIVATE_OPTIONS, STATUS_SUMMARIES, privateHelp, runPrivate } from '../src/private/index.js';

const PATTERN = '/.docatlas/private/';
const TEMP = await fs.realpath(os.tmpdir());

// Git runs with an empty global config, no system config, and a ceiling at the temp folder, so a developer's git
// settings or a temp folder inside another repository cannot change results or touch other repositories.
const gitHome = await fs.mkdtemp(path.join(TEMP, 'docatlas-private-git-'));
await fs.writeFile(path.join(gitHome, 'gitconfig'), '');
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: path.join(gitHome, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1', GIT_CEILING_DIRECTORIES: TEMP
});
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete process.env[name];
after(() => fs.rm(gitHome, { recursive: true, force: true }));

const posixPermissions = process.platform !== 'win32' && process.getuid?.() !== 0;

async function workspace(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(TEMP, 'docatlas-private-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

function git(cwd, ...args) {
  return execFileSync('git', [
    '-c', 'user.name=docatlas', '-c', 'user.email=docatlas@example.com', '-c', 'commit.gpgsign=false',
    '-c', 'protocol.file.allow=always', ...args
  ], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function repository(t) {
  const root = await workspace(t);
  git(root, 'init', '-q');
  git(root, 'commit', '-q', '--allow-empty', '-m', 'start');
  return root;
}

async function write(root, relative, content = '# Document\n') {
  const filename = path.join(root, ...relative.split('/'));
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, content);
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

const exists = filename => fs.lstat(filename).then(() => true, () => false);
const excludeFile = root => path.join(root, '.git', 'info', 'exclude');
const untracked = root => git(root, 'status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean);
const field = (lines, name) => lines.find(line => line[0] === name);
const privateFolder = root => path.join(root, '.docatlas', 'private');

test('init creates the folder and hides it once, while agents.json stays visible to git', async t => {
  const root = await repository(t);
  const before = await fs.readFile(excludeFile(root), 'utf8');
  const first = await privateCommand(root, ['init']);
  assert.equal(first.code, 0, first.stderr);
  assert.deepEqual(first.lines, [
    ['root', root],
    ['create', 'folder', privateFolder(root)],
    ['add', 'exclude', excludeFile(root), PATTERN],
    ['summary', 'folder=create', 'exclude=add']
  ]);
  assert.equal(await fs.readFile(excludeFile(root), 'utf8'), before + EXCLUDE_COMMENT + '\n' + PATTERN + '\n');

  await write(root, '.docatlas/private/payments/REQUIREMENTS.md');
  await write(root, '.docatlas/private/payments/flow.png', 'image');
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
  assert.deepEqual(field(status.lines, 'files'), ['files', '2']);
  assert.deepEqual(field(status.lines, 'ignored'), ['ignored', 'yes']);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'ok']);
});

test('a dry run plans the same actions and writes nothing', async t => {
  const root = await repository(t);
  const before = await fs.readFile(excludeFile(root), 'utf8');
  const result = await privateCommand(root, ['init', '--dry-run']);
  assert.equal(result.code, 0);
  assert.deepEqual(result.lines.slice(1).map(line => line.slice(0, 3)), [
    ['dry-run', 'create', 'folder'], ['dry-run', 'add', 'exclude'], ['dry-run', 'summary', 'folder=create']
  ]);
  assert.equal(await exists(path.join(root, '.docatlas')), false);
  assert.equal(await fs.readFile(excludeFile(root), 'utf8'), before);
});

test('a start folder below the top folder still uses the repository top folder', async t => {
  const repo = await repository(t);
  const start = path.join(repo, '한글 폴더', 'app[1]');
  await fs.mkdir(start, { recursive: true });
  const result = await privateCommand(start, ['init']);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.lines.slice(0, 3), [
    ['root', repo], ['create', 'folder', privateFolder(repo)], ['add', 'exclude', excludeFile(repo), PATTERN]
  ]);
  assert.equal(await exists(path.join(start, '.docatlas')), false);
  const status = await privateCommand(repo, ['status', '--root', start]);
  assert.deepEqual(field(status.lines, 'root'), ['root', repo]);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'empty']);
});

test('private files already tracked by git stop init and status without writing', async t => {
  const root = await repository(t);
  await write(root, '.docatlas/private/notes/DESIGN.md');
  git(root, 'add', '.docatlas/private/notes/DESIGN.md');
  git(root, 'commit', '-q', '-m', 'oops');
  const before = await fs.readFile(excludeFile(root), 'utf8');
  const result = await privateCommand(root, ['init']);
  assert.equal(result.code, 3);
  assert.deepEqual(result.lines.slice(1), [['blocked', 'tracked', '.docatlas/private/notes/DESIGN.md']]);
  assert.match(result.stderr, /already tracks/);
  assert.equal(await fs.readFile(excludeFile(root), 'utf8'), before);
  const status = await privateCommand(root, ['status']);
  assert.equal(status.code, 3);
  assert.deepEqual(field(status.lines, 'tracked'), ['tracked', '1']);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'tracked']);
});

test('any visible private file, not only Markdown, is exposed until init runs', async t => {
  const root = await repository(t);
  await write(root, '.docatlas/private/search/diagram.png', 'image');
  await write(root, '.docatlas/private/search/notes.txt', 'notes');
  const status = await privateCommand(root, ['status']);
  assert.equal(status.code, 3);
  assert.deepEqual(field(status.lines, 'documents'), ['documents', '0']);
  assert.deepEqual(field(status.lines, 'files'), ['files', '2']);
  assert.deepEqual(field(status.lines, 'exclude').slice(0, 2), ['exclude', 'missing']);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'exposed']);
  assert.match(status.stderr, /docatlas private init/);
  assert.equal((await privateCommand(root, ['init'])).code, 0);
  assert.equal((await privateCommand(root, ['status'])).code, 0);
  assert.deepEqual(untracked(root), []);
});

test('a ! rule in .gitignore that keeps the folder visible makes init and status ask the user', async t => {
  const root = await repository(t);
  await write(root, '.gitignore', '!/.docatlas/private/\n');
  await write(root, '.docatlas/private/a/REQUIREMENTS.md');
  const result = await privateCommand(root, ['init']);
  assert.equal(result.code, 3);
  assert.deepEqual(field(result.lines, 'blocked'), ['blocked', 'not-ignored', privateFolder(root)]);
  assert.match(result.stderr, /\.gitignore/);
  const status = await privateCommand(root, ['status']);
  assert.equal(status.code, 3);
  assert.deepEqual(field(status.lines, 'exclude').slice(0, 2), ['exclude', 'present']);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'exposed']);
  assert.match(status.stderr, /Show this to the user/);
  assert.doesNotMatch(status.stderr, /Run docatlas private init/);
});

test('outside git the folder is created with a warning; missing git outside git is the same', async t => {
  const root = await workspace(t);
  const result = await privateCommand(root, ['init']);
  assert.equal(result.code, 0);
  assert.deepEqual(result.lines[2], ['skip', 'exclude', '-', '-']);
  assert.deepEqual(field(result.lines, 'warning').slice(0, 2), ['warning', 'not-git']);
  assert.equal(await exists(privateFolder(root)), true);
  const status = await privateCommand(root, ['status']);
  assert.equal(status.code, 0);
  assert.deepEqual(field(status.lines, 'git'), ['git', 'not-git', '-']);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'not-git']);
  const missing = await privateCommand(root, ['init'], { git: 'docatlas-git-that-does-not-exist' });
  assert.equal(missing.code, 0);
  assert.deepEqual(field(missing.lines, 'warning').slice(0, 2), ['warning', 'not-git']);
});

test('in a repository, missing git or a git error stops before any write', async t => {
  const root = await repository(t);
  const before = await fs.readFile(excludeFile(root), 'utf8');
  const missing = await privateCommand(root, ['init'], { git: 'docatlas-git-that-does-not-exist' });
  assert.equal(missing.code, 3);
  assert.deepEqual(field(missing.lines, 'blocked').slice(0, 3), ['blocked', 'git-missing', root]);
  const status = await privateCommand(root, ['status'], { git: 'docatlas-git-that-does-not-exist' });
  assert.equal(status.code, 3);
  assert.deepEqual(field(status.lines, 'summary'), ['summary', 'blocked']);
  if (process.platform !== 'win32') {
    const fake = await write(await workspace(t), 'fake-git', '#!/bin/sh\necho "fatal: detected dubious ownership in repository" >&2\nexit 128\n');
    await fs.chmod(fake, 0o755);
    const error = await privateCommand(root, ['init'], { git: fake });
    assert.equal(error.code, 3);
    assert.deepEqual(field(error.lines, 'blocked'), ['blocked', 'git-error', root, 'fatal: detected dubious ownership in repository']);
  }
  assert.equal(await exists(path.join(root, '.docatlas')), false);
  assert.equal(await fs.readFile(excludeFile(root), 'utf8'), before);
});

test('GIT_DIR and GIT_WORK_TREE from a git hook cannot point init at another repository', async t => {
  const root = await repository(t);
  const other = await repository(t);
  const otherBefore = await fs.readFile(excludeFile(other), 'utf8');
  process.env.GIT_DIR = path.join(other, '.git');
  process.env.GIT_WORK_TREE = other;
  try {
    const result = await privateCommand(root, ['init']);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.lines[0], ['root', root]);
  } finally {
    delete process.env.GIT_DIR;
    delete process.env.GIT_WORK_TREE;
  }
  assert.equal(await fs.readFile(excludeFile(other), 'utf8'), otherBefore);
  await write(root, '.docatlas/private/a/REQUIREMENTS.md');
  assert.deepEqual(untracked(root), []);
});

test('a linked worktree and a submodule hide the folder through their own exclude files', async t => {
  const repo = await repository(t);
  const worktree = path.join(path.dirname(repo), path.basename(repo) + '-worktree');
  t.after(() => fs.rm(worktree, { recursive: true, force: true }));
  git(repo, 'worktree', 'add', '-q', '--detach', worktree);
  const tree = await fs.realpath(worktree);
  const fromTree = await privateCommand(tree, ['init']);
  assert.equal(fromTree.code, 0, fromTree.stderr);
  assert.equal(fromTree.lines[2][2], excludeFile(repo));
  await write(tree, '.docatlas/private/a/DESIGN.md');
  assert.deepEqual(untracked(tree), []);

  const library = await repository(t);
  git(repo, 'submodule', 'add', '-q', library, 'lib');
  const submodule = path.join(repo, 'lib');
  const fromSubmodule = await privateCommand(submodule, ['init']);
  assert.equal(fromSubmodule.code, 0, fromSubmodule.stderr);
  assert.deepEqual(fromSubmodule.lines[0], ['root', submodule]);
  assert.equal(fromSubmodule.lines[2][2], path.join(repo, '.git', 'modules', 'lib', 'info', 'exclude'));
  await write(submodule, '.docatlas/private/b/DESIGN.md');
  assert.deepEqual(untracked(submodule), []);
});

test('existing exclude bytes, CRLF, a missing final newline and the file mode are kept', async t => {
  const root = await repository(t);
  const original = Buffer.from([0x62, 0x75, 0x69, 0x6c, 0x64, 0x2f, 0x0d, 0x0a, 0x63, 0x61, 0x66, 0xe9, 0x2f]);
  await fs.writeFile(excludeFile(root), original);
  if (process.platform !== 'win32') await fs.chmod(excludeFile(root), 0o664);
  assert.equal((await privateCommand(root, ['init'])).code, 0);
  const after = await fs.readFile(excludeFile(root));
  assert.deepEqual(after, Buffer.concat([original, Buffer.from('\r\n' + EXCLUDE_COMMENT + '\r\n' + PATTERN + '\r\n')]));
  if (process.platform !== 'win32') assert.equal((await fs.stat(excludeFile(root))).mode & 0o777, 0o664);
  assert.deepEqual((await fs.readdir(path.dirname(excludeFile(root)))).filter(name => name.includes('.docatlas-')), []);

  const fresh = await repository(t);
  await fs.rm(excludeFile(fresh));
  assert.equal((await privateCommand(fresh, ['init'])).code, 0);
  assert.equal(await fs.readFile(excludeFile(fresh), 'utf8'), EXCLUDE_COMMENT + '\n' + PATTERN + '\n');
});

test('symbolic links and wrong types on the private path or the exclude file block init', async t => {
  const outside = await workspace(t);
  const link = async (target, filename) => {
    try {
      await fs.symlink(target, filename, 'dir');
      return true;
    } catch (error) {
      t.diagnostic('symbolic links are not available: ' + error.code);
      return false;
    }
  };
  const folderLink = await repository(t);
  if (await link(outside, path.join(folderLink, '.docatlas'))) {
    const result = await privateCommand(folderLink, ['init']);
    assert.equal(result.code, 3);
    assert.deepEqual(field(result.lines, 'blocked'), ['blocked', 'symbolic-link', path.join(folderLink, '.docatlas')]);
    assert.deepEqual(await fs.readdir(outside), []);
    assert.deepEqual(field((await privateCommand(folderLink, ['status'])).lines, 'summary'), ['summary', 'blocked']);
  }
  const fileInstead = await repository(t);
  await write(fileInstead, '.docatlas/private', 'not a folder');
  const wrongType = await privateCommand(fileInstead, ['init']);
  assert.equal(wrongType.code, 3);
  assert.deepEqual(field(wrongType.lines, 'blocked'), ['blocked', 'wrong-type', privateFolder(fileInstead)]);

  const infoLink = await repository(t);
  const info = path.join(infoLink, '.git', 'info');
  await fs.rename(info, path.join(outside, 'info'));
  if (await link(path.join(outside, 'info'), info)) {
    const result = await privateCommand(infoLink, ['init']);
    assert.equal(result.code, 3);
    assert.deepEqual(field(result.lines, 'blocked'), ['blocked', 'symbolic-link', info]);
    assert.equal(await exists(privateFolder(infoLink)), false);
  }
});

test('a failed exclude write leaves no temporary file and keeps the old content', { skip: !posixPermissions && 'needs POSIX permissions without root' }, async t => {
  const root = await repository(t);
  const before = await fs.readFile(excludeFile(root), 'utf8');
  const info = path.dirname(excludeFile(root));
  await fs.chmod(info, 0o555);
  let result;
  try {
    result = await privateCommand(root, ['init']);
  } finally {
    await fs.chmod(info, 0o755);
  }
  assert.equal(result.code, 1);
  assert.match(result.stderr, /init failed/);
  assert.equal(await fs.readFile(excludeFile(root), 'utf8'), before);
  assert.deepEqual((await fs.readdir(info)).filter(name => name.includes('.docatlas-')), []);
});

test('help documents exactly the options and status summaries, and invalid use exits 2 without writing', async t => {
  const help = privateHelp();
  const documented = new Set([...help.split('Options:')[1].split('Output lines')[0].matchAll(/--([a-z-]+)/g)].map(match => match[1]));
  assert.deepEqual([...documented].sort(), Object.keys(PRIVATE_OPTIONS).sort());
  for (const summary of STATUS_SUMMARIES) assert.ok(help.includes(summary), summary);
  for (const word of ['init', 'status', '.git/info/exclude', 'agents.json', 'top folder', 'Exit codes', 'not-ignored', 'git-error']) {
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
    stdout: { write: chunk => { stdout += chunk; } }, stderr: { write: () => {} }, cwd: TEMP
  });
  assert.equal(code, 0);
  assert.match(stdout, /^summary\tfolder=create\texclude=add$/m);
  let help = '';
  await run(['--help'], { stdout: { write: chunk => { help += chunk; } }, stderr: { write: () => {} } });
  assert.match(help, /docatlas private init\|status/);
});
