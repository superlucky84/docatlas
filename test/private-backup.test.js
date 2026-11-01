import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { localKey, normalizeRemote, parseKey, privateBackupNotice, privateHelp, runPrivate } from '../src/private/index.js';
import { quotePath } from '../src/private/notice.js';
import { startCli } from './helpers/cli.js';

const PATTERN = '/.docatlas/private/';
const TEMP = await fs.realpath(os.tmpdir());
const KEY = 'example.com/team/shop';

// Same isolation as test/private.test.js: an empty git config and a ceiling at the temp folder.
const gitHome = await fs.mkdtemp(path.join(TEMP, 'docatlas-backup-git-'));
await fs.writeFile(path.join(gitHome, 'gitconfig'), '');
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: path.join(gitHome, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1', GIT_CEILING_DIRECTORIES: TEMP
});
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete process.env[name];
after(() => fs.rm(gitHome, { recursive: true, force: true }));

const posix = process.platform !== 'win32';

async function folder(t, prefix = 'docatlas-backup-') {
  const root = await fs.realpath(await fs.mkdtemp(path.join(TEMP, prefix)));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

function git(cwd, ...args) {
  return execFileSync('git', [
    '-c', 'user.name=docatlas', '-c', 'user.email=docatlas@example.com', '-c', 'commit.gpgsign=false', ...args
  ], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// A repository with one commit whose origin is the given address. Nothing is pushed or fetched.
async function clone(t, origin = 'https://example.com/team/shop.git') {
  const root = await folder(t, 'docatlas-clone-');
  git(root, 'init', '-q');
  git(root, 'commit', '-q', '--allow-empty', '-m', 'start');
  if (origin) git(root, 'remote', 'add', 'origin', origin);
  return root;
}

async function write(root, relative, content = '# Document\n') {
  const filename = path.join(root, ...relative.split('/'));
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, content);
  return filename;
}

const read = (root, relative) => fs.readFile(path.join(root, ...relative.split('/')), 'utf8');
const exists = filename => fs.lstat(filename).then(() => true, () => false);
const store = (home, key = KEY) => path.join(home, '.docatlas', 'private-backups', ...key.split('/'));
const untracked = root => git(root, 'status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean);
const field = (lines, name) => lines.find(line => line[0] === name);
const fileLines = lines => lines.filter(line => line[1] === 'file' || line[2] === 'file').map(line => line.join(' '));

async function privateCommand(cwd, home, args, options = {}) {
  let stdout = '';
  let stderr = '';
  const code = await runPrivate(args, {
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } },
    cwd, home, ...options
  });
  return { code, stdout, stderr, lines: stdout.trimEnd().split('\n').map(line => line.split('\t')) };
}

// Every path under a folder with its type and content, to prove that a command wrote nothing.
async function snapshot(root) {
  const result = {};
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const filename = path.join(directory, entry.name);
      const relative = path.relative(root, filename);
      if (entry.isDirectory()) {
        result[relative] = 'dir';
        await walk(filename);
      } else {
        result[relative] = entry.isSymbolicLink() ? 'link' : await fs.readFile(filename, 'utf8');
      }
    }
  }
  await walk(root);
  return result;
}

const DOCUMENTS = {
  '.docatlas/private/payments/REQUIREMENTS.md': '# Payments — Requirements\n\nRefund plan.\n',
  '.docatlas/private/payments/flow.png': 'image bytes',
  '.docatlas/private/한글 기능/DESIGN.md': '# 설계\n'
};

async function withDocuments(t, origin) {
  const root = await clone(t, origin);
  for (const [relative, content] of Object.entries(DOCUMENTS)) await write(root, relative, content);
  return root;
}

test('origin addresses for the same repository give the same key, and keys stay inside the store', () => {
  for (const address of [
    'https://example.com/team/shop.git', 'https://user:token@Example.COM:8443/Team/Shop.git/', 'ssh://git@example.com:22/team/shop',
    'git@example.com:team/shop.git', 'git://example.com/team/shop'
  ]) {
    assert.equal(normalizeRemote(address), KEY, address);
  }
  assert.equal(normalizeRemote('/srv/repos/shop.git'), 'file/srv/repos/shop');
  assert.equal(normalizeRemote('C:\\repos\\shop.git'), 'file/c/repos/shop');
  assert.equal(normalizeRemote('https://example.com/%2e%2e%2F%2e%2e/a%5Cb'), 'example.com/a/b');
  assert.equal(normalizeRemote('git@host:con/a?b'), 'host/_con/a-b');
  assert.equal(normalizeRemote(''), '');
  assert.equal(parseKey('Example.com/Team/Shop'), KEY);
  assert.equal(parseKey('local/내 프로젝트'), null);
  assert.equal(parseKey('local/내-프로젝트'), 'local/내-프로젝트');
  for (const invalid of ['', '/a', 'a//b', '../a', 'a/./b', 'a b', 'a/b.', 'con', 'a\\b', 'a:b']) {
    assert.equal(parseKey(invalid), null, invalid);
  }
});

test('a backup survives the work folder, and a new clone restores the documents and the hiding rule', async t => {
  const home = await folder(t);
  const first = await withDocuments(t, 'https://example.com/team/shop.git');
  assert.equal((await privateCommand(first, home, ['init'])).code, 0);
  const backup = await privateCommand(path.join(first, '.docatlas'), home, ['backup']);
  assert.equal(backup.code, 0, backup.stderr);
  assert.deepEqual(backup.lines.slice(0, 3), [['root', first], ['key', KEY, 'origin'], ['store', store(home)]]);
  const [, , created] = field(backup.lines, 'create');
  assert.equal(path.dirname(created), store(home));
  assert.match(path.basename(created), /^\d{8}T\d{6}Z$/);
  assert.deepEqual(field(backup.lines, 'summary'), ['summary', 'backup=create', 'files=3', 'removed=0']);
  const manifest = JSON.parse(await fs.readFile(path.join(created, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.files.map(file => file.path), ['payments/REQUIREMENTS.md', 'payments/flow.png', '한글 기능/DESIGN.md']);
  assert.equal(manifest.key, KEY);
  assert.equal(manifest.reason, 'backup');
  assert.equal(manifest.commit, git(first, 'rev-parse', 'HEAD').trim());
  assert.ok(!JSON.stringify(manifest).includes('https://'), 'the raw origin address is not stored');
  await fs.rm(first, { recursive: true, force: true });

  const second = await clone(t, 'git@example.com:team/shop.git');
  const list = await privateCommand(second, home, ['list']);
  assert.equal(list.code, 0);
  assert.deepEqual(field(list.lines, 'backup').slice(0, 5), ['backup', path.basename(created), manifest.createdAt, '3', 'backup']);
  assert.deepEqual(field(list.lines, 'summary'), ['summary', 'backups=1']);

  const before = await snapshot(second);
  const preview = await privateCommand(second, home, ['restore', '--dry-run']);
  assert.equal(preview.code, 0, preview.stderr);
  assert.deepEqual(await snapshot(second), before, 'a preview writes nothing');
  assert.deepEqual(preview.lines.slice(3), [
    ['from', path.basename(created), manifest.createdAt, '3', 'backup'],
    ['dry-run', 'create', 'folder', path.join(second, '.docatlas', 'private')],
    ['dry-run', 'add', 'exclude', path.join(second, '.git', 'info', 'exclude'), PATTERN],
    ['dry-run', 'create', 'file', '.docatlas/private/payments/REQUIREMENTS.md'],
    ['dry-run', 'create', 'file', '.docatlas/private/payments/flow.png'],
    ['dry-run', 'create', 'file', '.docatlas/private/한글 기능/DESIGN.md'],
    ['dry-run', 'summary', 'create=3', 'unchanged=0', 'conflict=0', 'overwrite=0', 'blocked=0']
  ]);

  const restored = await privateCommand(second, home, ['restore']);
  assert.equal(restored.code, 0, restored.stderr);
  assert.deepEqual(field(restored.lines, 'summary'), ['summary', 'create=3', 'unchanged=0', 'conflict=0', 'overwrite=0', 'blocked=0']);
  for (const [relative, content] of Object.entries(DOCUMENTS)) assert.equal(await read(second, relative), content, relative);
  assert.match(await read(second, '.git/info/exclude'), /^\/\.docatlas\/private\/$/m);
  assert.deepEqual(untracked(second), [], 'restored documents are hidden from git');
  const again = await privateCommand(second, home, ['restore']);
  assert.deepEqual(field(again.lines, 'summary'), ['summary', 'create=0', 'unchanged=3', 'conflict=0', 'overwrite=0', 'blocked=0']);
  assert.deepEqual(field(again.lines, 'unchanged'), ['unchanged', 'folder', path.join(second, '.docatlas', 'private')]);
});

test('a backup is made only when the files changed, and never for an empty folder', async t => {
  const home = await folder(t);
  const root = await clone(t);
  const empty = await privateCommand(root, home, ['backup']);
  assert.equal(empty.code, 0);
  assert.deepEqual(empty.lines.slice(-2), [['skip', 'backup', '-'], ['summary', 'backup=skip', 'files=0', 'removed=0']]);
  assert.equal(await exists(path.join(home, '.docatlas')), false, 'an empty backup creates no folder');

  await write(root, '.docatlas/private/notes/DESIGN.md', 'one\n');
  const now = new Date('2026-11-01T05:30:12.000Z');
  const first = await privateCommand(root, home, ['backup'], { now });
  assert.deepEqual(field(first.lines, 'create'), ['create', 'backup', path.join(store(home), '20261101T053012Z')]);
  const same = await privateCommand(root, home, ['backup'], { now });
  assert.deepEqual(field(same.lines, 'unchanged'), ['unchanged', 'backup', path.join(store(home), '20261101T053012Z')]);
  await write(root, '.docatlas/private/notes/DESIGN.md', 'two\n');
  const changed = await privateCommand(root, home, ['backup'], { now });
  assert.deepEqual(field(changed.lines, 'create'), ['create', 'backup', path.join(store(home), '20261101T053012Z-2')],
    'a backup in the same second gets the next name');
  const list = await privateCommand(root, home, ['list']);
  assert.deepEqual(list.lines.filter(line => line[0] === 'backup').map(line => line[1]), ['20261101T053012Z-2', '20261101T053012Z']);
  assert.deepEqual((await fs.readdir(store(home))).filter(name => name.startsWith('.partial')), []);
  if (posix) {
    const backupFolder = path.join(store(home), '20261101T053012Z');
    assert.equal((await fs.stat(backupFolder)).mode & 0o777, 0o700);
    assert.equal((await fs.stat(path.join(backupFolder, 'files', 'notes', 'DESIGN.md'))).mode & 0o777, 0o600);
    assert.equal((await fs.stat(path.join(home, '.docatlas', 'private-backups'))).mode & 0o777, 0o700);
  }
});

test('each backup run keeps the newest ten backups, or --keep of them, and never prunes on its own', async t => {
  const home = await folder(t);
  const root = await clone(t);
  const at = minute => ({ now: new Date(Date.UTC(2026, 10, 1, 1, minute)) });
  const stamp = minute => '20261101T01' + String(minute).padStart(2, '0') + '00Z';
  const names = async () => (await fs.readdir(store(home))).filter(name => /^\d/.test(name)).sort();
  for (let minute = 0; minute < 10; minute++) {
    await write(root, '.docatlas/private/notes/DESIGN.md', 'version ' + minute + '\n');
    const result = await privateCommand(root, home, ['backup'], at(minute));
    assert.deepEqual(field(result.lines, 'summary').at(-1), 'removed=0');
  }
  await write(root, '.docatlas/private/notes/DESIGN.md', 'version 10\n');
  const eleventh = await privateCommand(root, home, ['backup'], at(10));
  assert.equal(eleventh.code, 0);
  assert.deepEqual(eleventh.lines.filter(line => line[0] === 'remove'), [['remove', 'backup', path.join(store(home), stamp(0))]]);
  assert.deepEqual(field(eleventh.lines, 'summary'), ['summary', 'backup=create', 'files=1', 'removed=1']);
  assert.deepEqual(await names(), Array.from({ length: 10 }, (_, index) => stamp(index + 1)));

  // Folders that are not whole backups are never removed.
  await fs.mkdir(path.join(store(home), '20200101T000000Z'));
  await fs.mkdir(path.join(store(home), '.partial-1-abcd'));
  const three = await privateCommand(root, home, ['backup', '--keep', '3'], at(11));
  assert.deepEqual(field(three.lines, 'summary'), ['summary', 'backup=unchanged', 'files=1', 'removed=7']);
  const one = await privateCommand(root, home, ['backup', '--keep', '1'], at(12));
  assert.deepEqual(field(one.lines, 'summary'), ['summary', 'backup=unchanged', 'files=1', 'removed=2']);
  assert.deepEqual(await names(), ['20200101T000000Z', stamp(10)]);
  assert.ok(await exists(path.join(store(home), '.partial-1-abcd')));

  // A clock set back still keeps the backup it just wrote, even when its name looks oldest.
  await write(root, '.docatlas/private/notes/DESIGN.md', 'version 6\n');
  const early = await privateCommand(root, home, ['backup', '--keep', '1'], { now: new Date('2026-01-01T00:00:00Z') });
  assert.equal(early.code, 0);
  assert.ok(await exists(path.join(store(home), '20260101T000000Z')));

  // An empty folder makes no backup and removes nothing, so the old backups can still be restored.
  await fs.rm(path.join(root, '.docatlas', 'private', 'notes'), { recursive: true });
  const before = await names();
  const empty = await privateCommand(root, home, ['backup', '--keep', '1']);
  assert.deepEqual(field(empty.lines, 'summary'), ['summary', 'backup=skip', 'files=0', 'removed=0']);
  assert.deepEqual(await names(), before);
  // restore, list and status never remove backups.
  for (const args of [['restore', '--dry-run'], ['list'], ['status']]) await privateCommand(root, home, args);
  assert.deepEqual(await names(), before);
});

test('restore keeps files that differ, and --force backs them up before overwriting', async t => {
  const home = await folder(t);
  const root = await withDocuments(t);
  await privateCommand(root, home, ['backup'], { now: new Date('2026-11-01T01:00:00Z') });
  await write(root, '.docatlas/private/payments/REQUIREMENTS.md', '# Edited locally\n');
  await write(root, '.docatlas/private/payments/EXTRA.md', '# Only here\n');
  await fs.rm(path.join(root, '.docatlas', 'private', 'payments', 'flow.png'));

  const kept = await privateCommand(root, home, ['restore']);
  assert.equal(kept.code, 3);
  assert.match(kept.stderr, /--force/);
  assert.deepEqual(fileLines(kept.lines), [
    'conflict file .docatlas/private/payments/REQUIREMENTS.md',
    'create file .docatlas/private/payments/flow.png',
    'unchanged file .docatlas/private/한글 기능/DESIGN.md'
  ]);
  assert.equal(await read(root, '.docatlas/private/payments/REQUIREMENTS.md'), '# Edited locally\n');
  assert.equal(await read(root, '.docatlas/private/payments/flow.png'), 'image bytes');

  const preview = await privateCommand(root, home, ['restore', '--force', '--dry-run']);
  assert.equal(preview.code, 0);
  assert.ok(preview.lines.some(line => line.join(' ') === 'dry-run create backup -'));
  assert.equal(await read(root, '.docatlas/private/payments/REQUIREMENTS.md'), '# Edited locally\n');

  const forced = await privateCommand(root, home, ['restore', '--force'], { now: new Date('2026-11-01T02:00:00Z') });
  assert.equal(forced.code, 0, forced.stderr);
  const saved = path.join(store(home), '20261101T020000Z');
  assert.deepEqual(field(forced.lines, 'create'), ['create', 'backup', saved]);
  assert.deepEqual(fileLines(forced.lines), [
    'overwrite file .docatlas/private/payments/REQUIREMENTS.md',
    'unchanged file .docatlas/private/payments/flow.png',
    'unchanged file .docatlas/private/한글 기능/DESIGN.md'
  ]);
  assert.equal(await read(root, '.docatlas/private/payments/REQUIREMENTS.md'), DOCUMENTS['.docatlas/private/payments/REQUIREMENTS.md']);
  assert.equal(await read(root, '.docatlas/private/payments/EXTRA.md'), '# Only here\n', 'restore never deletes files');
  const savedManifest = JSON.parse(await fs.readFile(path.join(saved, 'manifest.json'), 'utf8'));
  assert.equal(savedManifest.reason, 'before-restore');
  assert.equal(await fs.readFile(path.join(saved, 'files', 'payments', 'REQUIREMENTS.md'), 'utf8'), '# Edited locally\n');

  const list = await privateCommand(root, home, ['list']);
  assert.deepEqual(list.lines.filter(line => line[0] === 'backup').map(line => [line[1], line[4]]),
    [['20261101T020000Z', 'before-restore'], ['20261101T010000Z', 'backup']]);
  const latest = await privateCommand(root, home, ['restore', '--dry-run']);
  assert.deepEqual(field(latest.lines, 'from').slice(0, 2), ['from', '20261101T010000Z'], 'the newest regular backup is the default');
  const undo = await privateCommand(root, home, ['restore', '--from', '20261101T020000Z', '--force']);
  assert.equal(undo.code, 0);
  assert.equal(await read(root, '.docatlas/private/payments/REQUIREMENTS.md'), '# Edited locally\n');
});

test('a damaged or unreadable backup writes nothing', async t => {
  const home = await folder(t);
  const source = await withDocuments(t);
  await privateCommand(source, home, ['backup'], { now: new Date('2026-11-01T01:00:00Z') });
  const target = await clone(t);
  const backupFile = path.join(store(home), '20261101T010000Z', 'files', 'payments', 'flow.png');
  await fs.writeFile(backupFile, 'changed');
  const before = await snapshot(target);
  const damaged = await privateCommand(target, home, ['restore']);
  assert.equal(damaged.code, 3);
  assert.deepEqual(damaged.lines.at(-1), ['blocked', 'damaged', backupFile]);
  assert.deepEqual(await snapshot(target), before);

  await fs.mkdir(path.join(store(home), '20261101T020000Z'));
  await fs.writeFile(path.join(store(home), '20261101T020000Z', 'manifest.json'), '{"format":1,"createdAt":"x","files":[{"path":"../x"}]}');
  const list = await privateCommand(target, home, ['list']);
  assert.deepEqual(field(list.lines, 'warning'), ['warning', 'invalid-backup', path.join(store(home), '20261101T020000Z')]);
  assert.deepEqual(field(list.lines, 'summary'), ['summary', 'backups=1']);
  const invalid = await privateCommand(target, home, ['restore', '--from', '20261101T020000Z']);
  assert.equal(invalid.code, 3);
  assert.deepEqual(invalid.lines.at(-1), ['blocked', 'invalid-backup', path.join(store(home), '20261101T020000Z')]);
  const missing = await privateCommand(target, home, ['restore', '--from', '20261101T030000Z']);
  assert.equal(missing.code, 3);
  assert.deepEqual(missing.lines.at(-1), ['missing', 'backup', path.join(store(home), '20261101T030000Z')]);
  const otherKey = await privateCommand(target, home, ['restore', '--key', 'example.com/other']);
  assert.equal(otherKey.code, 3);
  assert.deepEqual(otherKey.lines.at(-1), ['missing', 'backup', store(home, 'example.com/other')]);
  assert.match(otherKey.stderr, /docatlas private list/);
  assert.deepEqual(await snapshot(target), before);
});

test('symbolic links are never copied, followed or written through', async t => {
  const home = await folder(t);
  const outside = await folder(t, 'docatlas-outside-');
  const root = await withDocuments(t);
  try {
    await fs.symlink(path.join(outside), path.join(root, '.docatlas', 'private', 'linked'), 'dir');
    await fs.symlink(path.join(root, 'README.md'), path.join(root, '.docatlas', 'private', 'link.md'));
  } catch (error) {
    t.skip('symbolic links are not available: ' + error.code);
    return;
  }
  const backup = await privateCommand(root, home, ['backup'], { now: new Date('2026-11-01T01:00:00Z') });
  assert.equal(backup.code, 0);
  assert.deepEqual(backup.lines.filter(line => line[0] === 'warning'), [
    ['warning', 'symbolic-link', '.docatlas/private/link.md'], ['warning', 'symbolic-link', '.docatlas/private/linked']
  ]);
  assert.deepEqual(field(backup.lines, 'summary'), ['summary', 'backup=create', 'files=3', 'removed=0']);

  // A folder of the restore path that became a link elsewhere is reported, and the other files are restored.
  const target = await clone(t);
  await fs.mkdir(path.join(target, '.docatlas', 'private'), { recursive: true });
  await fs.symlink(outside, path.join(target, '.docatlas', 'private', 'payments'), 'dir');
  const restored = await privateCommand(target, home, ['restore']);
  assert.equal(restored.code, 3);
  assert.deepEqual(fileLines(restored.lines).concat(restored.lines.filter(line => line[0] === 'blocked').map(line => line.join(' '))), [
    'create file .docatlas/private/한글 기능/DESIGN.md',
    'blocked symbolic-link .docatlas/private/payments/REQUIREMENTS.md',
    'blocked symbolic-link .docatlas/private/payments/flow.png'
  ]);
  assert.deepEqual(await fs.readdir(outside), []);

  // A linked store stops backup and restore before they write.
  const linkedHome = await folder(t);
  await fs.mkdir(path.join(linkedHome, '.docatlas'));
  await fs.symlink(outside, path.join(linkedHome, '.docatlas', 'private-backups'), 'dir');
  for (const args of [['backup'], ['restore'], ['list']]) {
    const result = await privateCommand(root, linkedHome, args);
    assert.equal(result.code, 3, args.join(' '));
    assert.deepEqual(result.lines.at(-1), ['blocked', 'symbolic-link', path.join(linkedHome, '.docatlas', 'private-backups')]);
  }
  assert.deepEqual(await fs.readdir(outside), []);
});

test('restore stops before writing files when git would still see the folder or tracks private files', async t => {
  const home = await folder(t);
  const source = await withDocuments(t);
  await privateCommand(source, home, ['backup']);

  const visible = await clone(t);
  await write(visible, '.gitignore', '!/.docatlas/private/\n');
  await write(visible, '.git/info/exclude', PATTERN + '\n');
  const preview = await privateCommand(visible, home, ['restore', '--dry-run']);
  assert.equal(preview.code, 3);
  assert.ok(preview.lines.some(line => line[0] === 'blocked' && line[1] === 'not-ignored'));
  const result = await privateCommand(visible, home, ['restore']);
  assert.equal(result.code, 3);
  assert.deepEqual(result.lines.slice(-2), [
    ['blocked', 'not-ignored', path.join(visible, '.docatlas', 'private')],
    ['summary', 'create=0', 'unchanged=0', 'conflict=0', 'overwrite=0', 'blocked=0']
  ]);
  assert.deepEqual(await fs.readdir(path.join(visible, '.docatlas', 'private')), []);

  const tracked = await clone(t);
  await write(tracked, '.docatlas/private/notes/DESIGN.md');
  git(tracked, 'add', '.docatlas/private/notes/DESIGN.md');
  git(tracked, 'commit', '-q', '-m', 'oops');
  const before = await snapshot(tracked);
  const stopped = await privateCommand(tracked, home, ['restore']);
  assert.equal(stopped.code, 3);
  assert.deepEqual(stopped.lines.at(-1), ['blocked', 'tracked', '.docatlas/private/notes/DESIGN.md']);
  assert.deepEqual(await snapshot(tracked), before);
});

test('without an origin the key is the folder name and a path code, and --key moves backups between folders', async t => {
  const home = await folder(t);
  const outsideGit = await folder(t, 'docatlas-My Notes-');
  await write(outsideGit, '.docatlas/private/a/DESIGN.md', '# A\n');
  const local = await privateCommand(outsideGit, home, ['backup']);
  assert.equal(local.code, 0);
  const key = field(local.lines, 'key')[1];
  assert.equal(key, localKey(outsideGit));
  assert.match(key, new RegExp('^local/' + path.basename(outsideGit).toLowerCase().replace(/\s+/g, '-') + '-[0-9a-f]{8}$'));
  assert.deepEqual(field(local.lines, 'key'), ['key', key, 'local']);
  assert.equal(field(local.lines, 'warning')[1], 'no-origin');
  assert.equal(parseKey(key), key, 'the printed key can be passed to --key');
  const noOrigin = await clone(t, null);
  assert.equal(field((await privateCommand(noOrigin, home, ['list'])).lines, 'key')[1], localKey(noOrigin));

  // Folders with the same name in different places keep separate backups.
  const parents = [await folder(t), await folder(t)];
  const twins = [];
  for (const [index, parent] of parents.entries()) {
    const twin = path.join(parent, 'app');
    await write(twin, '.docatlas/private/a/DESIGN.md', '# Twin ' + index + '\n');
    twins.push(field((await privateCommand(twin, home, ['backup'])).lines, 'key')[1]);
  }
  assert.notEqual(twins[0], twins[1]);
  assert.ok(twins.every(twin => twin.startsWith('local/app-')));
  assert.equal(localKey('C:\\Work\\App', 'win32'), localKey('c:\\work\\app', 'win32'), 'Windows paths ignore case');
  assert.notEqual(localKey('/work/App', 'linux'), localKey('/work/app', 'linux'));

  const target = await clone(t);
  const restored = await privateCommand(target, home, ['restore', '--key', key.toUpperCase()]);
  assert.equal(restored.code, 0, restored.stderr);
  assert.deepEqual(field(restored.lines, 'key'), ['key', key, 'option']);
  assert.equal(await read(target, '.docatlas/private/a/DESIGN.md'), '# A\n');
});

test('status compares the folder with the newest backup', async t => {
  const home = await folder(t);
  const root = await withDocuments(t);
  await privateCommand(root, home, ['init']);
  assert.deepEqual(field((await privateCommand(root, home, ['status'])).lines, 'backup'), ['backup', 'none', '-']);
  await privateCommand(root, home, ['backup'], { now: new Date('2026-11-01T01:00:00Z') });
  const same = await privateCommand(root, home, ['status']);
  assert.equal(same.code, 0);
  assert.deepEqual(field(same.lines, 'backup'), ['backup', 'same', '20261101T010000Z']);
  assert.deepEqual(field(same.lines, 'summary'), ['summary', 'ok']);
  await write(root, '.docatlas/private/payments/DESIGN.md', '# New\n');
  assert.deepEqual(field((await privateCommand(root, home, ['status'])).lines, 'backup'), ['backup', 'changed', '20261101T010000Z']);
});

test('options belong to their commands, and invalid keys or backup names exit 2 without writing', async t => {
  const home = await folder(t);
  const root = await clone(t);
  for (const args of [
    ['backup', '--dry-run'], ['backup', '--force'], ['list', '--from', '20261101T010000Z'], ['init', '--key', 'a/b'],
    ['status', '--key', 'a/b'], ['backup', '--key', '../x'], ['restore', '--key', 'a//b'], ['restore', '--from', '../x'],
    ['restore', '--from', 'latest'], ['restore', 'extra'], ['restore', '--keep', '3'], ['list', '--keep', '3'],
    ['backup', '--keep', '0'], ['backup', '--keep', '1001'], ['backup', '--keep', 'all'], ['backup', '--keep', '2.5']
  ]) {
    const result = await privateCommand(root, home, args);
    assert.equal(result.code, 2, args.join(' '));
    assert.equal(result.stdout, '', args.join(' '));
  }
  assert.equal(await exists(path.join(home, '.docatlas')), false);
  assert.equal(await exists(path.join(root, '.docatlas')), false);
  const help = privateHelp();
  for (const word of ['backup', 'list', 'restore', '--force', '--from', '--key', '--keep', 'newest 10', 'remove backup', 'removed=',
    'private-backups', 'conflict', 'before-restore',
    'missing backup', 'blocked damaged', 'same|changed|none|unknown']) {
    assert.ok(help.includes(word), word);
  }
});

test('the document map hint appears only for an empty private folder with a backup, and writes nothing', async t => {
  const home = await folder(t);
  const source = await withDocuments(t);
  const target = await clone(t);
  const notice = (root = target, cwd = target) => privateBackupNotice({ home, root, cwd });
  assert.equal(await notice(), null, 'no backup');
  await privateCommand(source, home, ['backup'], { now: new Date('2026-11-01T05:30:12Z') });
  await fs.mkdir(path.join(target, 'app'));
  const before = { home: await snapshot(home), target: await snapshot(target) };
  assert.equal(await notice(),
    'Private documents: a backup from 2026-11-01 05:30 UTC is available. Restore with: docatlas private restore --dry-run');
  const elsewhere = await folder(t);
  assert.equal(await notice(target, elsewhere), 'Private documents: a backup from 2026-11-01 05:30 UTC is available. ' +
    'Restore with: docatlas private restore --root ' + quotePath(target) + ' --dry-run');
  assert.equal(quotePath('C:\\Users\\me\\shop', 'win32'), 'C:\\Users\\me\\shop', 'backslashes are separators, not escapes');
  assert.equal(quotePath('C:\\My Projects\\shop', 'win32'), '"C:\\My Projects\\shop"');
  assert.equal(quotePath('/home/me/shop', 'linux'), '/home/me/shop');
  assert.equal(quotePath("/home/me/it's shop", 'darwin'), "'/home/me/it'\\''s shop'");
  assert.equal(await notice(path.join(target, 'app')), null, 'a map below the top folder has no private group');
  assert.deepEqual({ home: await snapshot(home), target: await snapshot(target) }, before);
  assert.equal(await notice(source), null, 'a folder with private files');
  assert.equal(await privateBackupNotice({ home: path.join(home, 'missing'), root: target }), null);
  await privateCommand(target, home, ['restore']);
  assert.equal(await notice(), null, 'after restore');
});

test('the document map prints the restore hint after it starts', async t => {
  const home = await folder(t);
  const source = await withDocuments(t);
  await privateCommand(source, home, ['backup']);
  const target = await clone(t);
  await write(target, 'docs/DESIGN.md', '# Design\n');
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const cli = await startCli(t, { cwd: target, args: ['--no-open'], env });
  const deadline = Date.now() + 5000;
  while (!cli.output().stdout.includes('Private documents:') && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.match(cli.output().stdout, /\nPrivate documents: a backup from .+ UTC is available\. Restore with: docatlas private restore --dry-run\n/);
  // Stop the map before cleanup: Windows cannot delete a folder that a running process uses.
  cli.child.kill('SIGINT');
  const exit = await cli.exited;
  // Windows ends a child process without running its SIGINT handler; elsewhere the map stops cleanly.
  if (process.platform !== 'win32') assert.deepEqual(exit, { code: 0, signal: null });
});
