import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applyRestore, planRestore, runPrivate, writeBackup } from '../src/private/index.js';
import { sha256 } from '../src/private/store.js';

// Boundaries of private documents: concurrent runs, large and binary files, failures, permissions and links.

const TEMP = await fs.realpath(os.tmpdir());
const KEY = 'example.com/team/shop';
const gitHome = await fs.mkdtemp(path.join(TEMP, 'docatlas-hardening-git-'));
await fs.writeFile(path.join(gitHome, 'gitconfig'), '');
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: path.join(gitHome, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1', GIT_CEILING_DIRECTORIES: TEMP
});
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete process.env[name];
after(() => fs.rm(gitHome, { recursive: true, force: true }));

const posixPermissions = process.platform !== 'win32' && process.getuid?.() !== 0;

async function folder(t, prefix = 'docatlas-hardening-') {
  const root = await fs.realpath(await fs.mkdtemp(path.join(TEMP, prefix)));
  t.after(async () => {
    await fs.chmod(root, 0o700).catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=docatlas', '-c', 'user.email=docatlas@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function clone(t) {
  const root = await folder(t, 'docatlas-hardening-clone-');
  git(root, 'init', '-q');
  git(root, 'commit', '-q', '--allow-empty', '-m', 'start');
  git(root, 'remote', 'add', 'origin', 'https://example.com/team/shop.git');
  return root;
}

async function write(root, relative, content) {
  const filename = path.join(root, ...relative.split('/'));
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, content);
  return filename;
}

async function privateCommand(cwd, home, args, options = {}) {
  let stdout = '';
  let stderr = '';
  const code = await runPrivate(args, {
    stdout: { write: chunk => { stdout += chunk; } }, stderr: { write: chunk => { stderr += chunk; } }, cwd, home, ...options
  });
  return { code, stdout, stderr, lines: stdout.trimEnd().split('\n').map(line => line.split('\t')) };
}

const store = home => path.join(home, '.docatlas', 'private-backups', ...KEY.split('/'));
const summary = result => result.lines.find(line => line[0] === 'summary' || line[1] === 'summary');
const leftovers = async directory => (await fs.readdir(directory).catch(() => [])).filter(name => name.startsWith('.partial') || name.includes('.docatlas-'));

// Every file below a folder with its bytes, to compare a restore with the original.
async function files(root, prefix = '') {
  const found = {};
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const filename = path.join(root, entry.name);
    if (entry.isDirectory()) Object.assign(found, await files(filename, prefix + entry.name + '/'));
    else found[prefix + entry.name] = sha256(await fs.readFile(filename));
  }
  return found;
}

function binary(size) {
  const data = Buffer.alloc(size);
  for (let index = 0; index < size; index++) data[index] = (index * 31 + 7) % 256;
  return data;
}

test('binary, CRLF, large, Korean and spaced names come back byte for byte', async t => {
  const home = await folder(t);
  const source = await clone(t);
  await write(source, '.docatlas/private/결제 기능/요구 사항.md', '# 결제\r\n\r\n- 환불\r\n');
  await write(source, '.docatlas/private/결제 기능/diagram.png', binary(6 * 1024 * 1024));
  await write(source, '.docatlas/private/notes/no-newline.md', '# No final newline');
  await write(source, '.docatlas/private/notes/empty.md', '');
  assert.equal((await privateCommand(source, home, ['backup'])).code, 0);
  const target = await clone(t);
  const restored = await privateCommand(target, home, ['restore']);
  assert.equal(restored.code, 0, restored.stderr);
  assert.deepEqual(await files(path.join(target, '.docatlas', 'private')), await files(path.join(source, '.docatlas', 'private')));
});

test('concurrent init, backup and restore never break files or report false conflicts', async t => {
  const home = await folder(t);
  const source = await clone(t);
  await write(source, '.docatlas/private/big/diagram.png', binary(4 * 1024 * 1024));
  for (let index = 0; index < 15; index++) await write(source, '.docatlas/private/notes/' + index + '.md', '# Note ' + index + '\n');

  const inits = await Promise.all(Array.from({ length: 5 }, () => privateCommand(source, home, ['init'])));
  assert.deepEqual(inits.map(result => result.code), [0, 0, 0, 0, 0]);
  const exclude = await fs.readFile(path.join(source, '.git', 'info', 'exclude'), 'utf8');
  assert.equal(exclude.split(/\r?\n/).filter(line => line === '/.docatlas/private/').length, 1);

  const now = new Date('2026-11-01T01:00:00Z');
  const backups = await Promise.all(Array.from({ length: 3 }, () => privateCommand(source, home, ['backup'], { now })));
  assert.deepEqual(backups.map(result => result.code), [0, 0, 0]);
  const list = await privateCommand(source, home, ['list']);
  assert.equal(list.lines.filter(line => line[0] === 'warning').length, 0, 'every backup is whole');
  assert.ok(list.lines.filter(line => line[0] === 'backup').length >= 1);
  assert.deepEqual(await leftovers(store(home)), []);

  const target = await clone(t);
  const restores = await Promise.all([1, 2].map(() => privateCommand(target, home, ['restore'])));
  assert.deepEqual(restores.map(result => result.code), [0, 0], restores.map(result => result.stderr).join('\n'));
  const created = restores.map(result => Number(summary(result)[1].split('=')[1]));
  assert.equal(created[0] + created[1], 16, 'each file is created once and the other run sees it unchanged');
  assert.deepEqual(await files(path.join(target, '.docatlas', 'private')), await files(path.join(source, '.docatlas', 'private')));
  assert.deepEqual(await leftovers(path.join(target, '.docatlas', 'private', 'notes')), []);
});

test('a backup that fails while writing leaves no partial folder and no backup', async t => {
  const home = await folder(t);
  // A file and a folder with the same name cannot both be written, so the second entry fails.
  const entries = [
    { path: 'a', size: 1, sha256: sha256(Buffer.from('a')), data: Buffer.from('a') },
    { path: 'a/b', size: 1, sha256: sha256(Buffer.from('b')), data: Buffer.from('b') }
  ];
  await assert.rejects(writeBackup({ home, key: KEY, entries, reason: 'backup', root: home, commit: null }));
  assert.deepEqual(await fs.readdir(store(home)), []);
});

test('a private folder replaced by a link stops backup, restore and status before they write', async t => {
  const home = await folder(t);
  const outside = await folder(t, 'docatlas-hardening-outside-');
  await write(outside, 'secret.md', '# Not this project\n');
  const root = await clone(t);
  await write(root, '.docatlas/private/a/DESIGN.md', '# A\n');
  assert.equal((await privateCommand(root, home, ['backup'])).code, 0);
  const before = await fs.readdir(store(home));
  await fs.rm(path.join(root, '.docatlas', 'private'), { recursive: true });
  try {
    await fs.symlink(outside, path.join(root, '.docatlas', 'private'), 'dir');
  } catch (error) {
    t.skip('symbolic links are not available: ' + error.code);
    return;
  }
  for (const args of [['backup'], ['restore'], ['restore', '--force'], ['status']]) {
    const result = await privateCommand(root, home, args);
    assert.equal(result.code, 3, args.join(' '));
    assert.ok(result.lines.some(line => line[0] === 'blocked' && line[1] === 'symbolic-link'), args.join(' '));
  }
  assert.deepEqual(await fs.readdir(outside), ['secret.md']);
  assert.deepEqual(await fs.readdir(store(home)), before);
});

test('a folder that becomes a link after planning is never written through', async t => {
  const outside = await folder(t, 'docatlas-hardening-outside-');
  const privateFolder = path.join(await folder(t), 'private');
  await fs.mkdir(path.join(privateFolder, 'payments'), { recursive: true });
  const data = Buffer.from('# Restored\n');
  const plan = await planRestore(privateFolder, [
    { path: 'payments/REQUIREMENTS.md', size: data.length, sha256: sha256(data), data },
    { path: 'notes/A.md', size: data.length, sha256: sha256(data), data }
  ]);
  assert.deepEqual(plan.map(item => item.action), ['create', 'create']);
  await fs.rm(path.join(privateFolder, 'payments'), { recursive: true });
  try {
    await fs.symlink(outside, path.join(privateFolder, 'payments'), 'dir');
  } catch (error) {
    t.skip('symbolic links are not available: ' + error.code);
    return;
  }
  await applyRestore(privateFolder, plan);
  assert.deepEqual(plan.map(item => [item.action, item.reason]), [['blocked', 'symbolic-link'], ['create', undefined]]);
  assert.deepEqual(await fs.readdir(outside), []);
  assert.equal(await fs.readFile(path.join(privateFolder, 'notes', 'A.md'), 'utf8'), '# Restored\n');
});

test('unreadable files and unwritable folders fail without partial backups', { skip: !posixPermissions && 'needs POSIX permissions without root' }, async t => {
  const home = await folder(t);
  const root = await clone(t);
  const secret = await write(root, '.docatlas/private/a/secret.md', '# Secret\n');
  await fs.chmod(secret, 0o000);
  const unreadable = await privateCommand(root, home, ['backup']);
  assert.equal(unreadable.code, 1);
  assert.match(unreadable.stderr, /backup failed/);
  assert.equal(await fs.lstat(path.join(home, '.docatlas')).then(() => true, () => false), false, 'nothing is written');
  await fs.chmod(secret, 0o600);

  assert.equal((await privateCommand(root, home, ['backup'], { now: new Date('2026-11-01T01:00:00Z') })).code, 0);
  await write(root, '.docatlas/private/a/secret.md', '# Changed\n');
  await fs.chmod(store(home), 0o500);
  const unwritable = await privateCommand(root, home, ['backup']);
  await fs.chmod(store(home), 0o700);
  assert.equal(unwritable.code, 1);
  assert.deepEqual(await fs.readdir(store(home)), ['20261101T010000Z']);

  const target = await clone(t);
  await fs.mkdir(path.join(target, '.docatlas', 'private', 'a'), { recursive: true });
  await fs.chmod(path.join(target, '.docatlas', 'private', 'a'), 0o500);
  const restore = await privateCommand(target, home, ['restore']);
  await fs.chmod(path.join(target, '.docatlas', 'private', 'a'), 0o700);
  assert.equal(restore.code, 1);
  assert.match(restore.stderr, /restore failed/);
  assert.deepEqual(await leftovers(path.join(target, '.docatlas', 'private', 'a')), []);
  const again = await privateCommand(target, home, ['restore']);
  assert.equal(again.code, 0, 'running it again after fixing the folder finishes the restore');
});
