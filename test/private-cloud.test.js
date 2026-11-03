import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runCloud } from '../src/private-cloud/command.js';
import { digest, readArchive, readBundle } from '../src/private-cloud/archive.js';
import { profileDirectory, withLock } from '../src/private-cloud/state.js';
import { runPrivate } from '../src/private/command.js';
import { inspectStore, listBackups } from '../src/private/store.js';
import { snapshot } from './helpers/agent-kit.js';

const KEY = 'example.com/team/shop';
const quiet = { write() {} };

async function fixture(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'docatlas-cloud-'));
  const base = await fs.realpath(temporary);
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const homes = [path.join(base, '집 홈'), path.join(base, '회사 홈')];
  const roots = [path.join(base, '집', 'shop'), path.join(base, '회사', 'shop')];
  const cloud = path.join(base, 'shared cloud');
  for (const directory of [...homes, ...roots, cloud]) await fs.mkdir(directory, { recursive: true });
  for (const root of roots) {
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
    assert.equal(spawnSync('git', ['-C', root, 'remote', 'add', 'origin', 'https://example.com/team/shop.git']).status, 0);
  }
  let tick = 0;
  const call = async (machine, args, options = {}) => {
    let output = '';
    let error = '';
    const code = await runCloud(args, {
      home: homes[machine], cwd: roots[machine], now: new Date(Date.UTC(2026, 10, 3, 0, 0, tick++)),
      stdout: { write: value => { output += value; } }, stderr: { write: value => { error += value; } },
      ...options
    });
    return { code, value: JSON.parse(output), error };
  };
  const init = async machine => {
    const code = await runPrivate(['init'], { home: homes[machine], cwd: roots[machine], stdout: quiet, stderr: quiet });
    assert.equal(code, 0);
  };
  const write = async (machine, relative, data) => {
    const filename = path.join(roots[machine], '.docatlas', 'private', ...relative.split('/'));
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, data);
  };
  const read = (machine, relative) => fs.readFile(path.join(roots[machine], '.docatlas', 'private', ...relative.split('/')), 'utf8');
  const connect = (machine, name = 'default') => call(machine, ['connect', '--directory', cloud, '--name', name]);
  const listed = async (machine = 0, name = 'default') => (await call(machine,
    ['list', '--directory', cloud, '--name', name])).value;
  return { base, homes, roots, cloud, call, init, write, read, connect, listed };
}

test('cloud inspection, previews and invalid arguments do not configure or back up implicitly', async t => {
  const f = await fixture(t);
  const before = await snapshot(f.base);
  assert.equal((await f.call(0, ['status'])).value.status, 'unconfigured');
  assert.deepEqual((await f.call(0, ['connections'])).value.connections, []);
  assert.equal((await f.call(0, ['restore', '--directory', f.cloud])).value.reason, 'missing-backup');
  for (const args of [
    ['backup', '--force'], ['connect'], ['restore', '--force'], ['backup', '--name', ''],
    ['backup', '--path', '../other'], ['backup', '--path', '/absolute'], ['list', '--tag', 'bad\nlabel']
  ]) assert.equal((await f.call(0, args)).code, 2, args.join(' '));
  assert.deepEqual(await snapshot(f.base), before);
});

test('named backups and immutable tags isolate histories and discover them on a new computer', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.write(0, 'a/설계.md', '# v1\n');
  assert.equal((await f.connect(0, '개인설계')).code, 0);
  const first = await f.call(0, ['backup', '--name', '개인설계', '--tag', 'v1']);
  assert.equal(first.code, 0, first.error + JSON.stringify(first.value));
  assert.equal(first.value.remoteStatus, 'unknown');
  assert.equal((await f.call(0, ['backup', '--name', '개인설계', '--tag', 'v1'])).value.action, 'unchanged');
  await f.write(0, 'a/설계.md', '# v2\n');
  const reused = await f.call(0, ['backup', '--name', '개인설계', '--tag', 'v1']);
  assert.equal(reused.code, 3);
  assert.equal(reused.value.reason, 'tag-exists');
  assert.equal((await f.call(0, ['backup', '--name', '개인설계', '--tag', 'v2'])).code, 0);
  assert.equal((await f.connect(0, '회사작업')).code, 0);
  assert.equal((await f.call(0, ['backup', '--name', '회사작업', '--tag', 'v1'])).code, 0);
  const connections = (await f.call(0, ['connections'])).value.connections;
  assert.deepEqual(connections.map(item => item.name).sort(), ['개인설계', '회사작업']);
  const projects = (await f.call(1, ['projects', '--directory', f.cloud])).value.projects;
  assert.deepEqual(projects.map(project => project.name).sort(), ['개인설계', '회사작업']);
  const before = await snapshot(f.homes[1]);
  const preview = await f.call(1, ['restore', '--directory', f.cloud, '--name', '개인설계', '--tag', 'v1']);
  assert.equal(preview.code, 0);
  assert.equal(preview.value.counts.create, 1);
  assert.deepEqual(await snapshot(f.homes[1]), before);
  const restored = await f.call(1, ['restore', '--directory', f.cloud, '--name', '개인설계', '--tag', 'v1', '--apply']);
  assert.equal(restored.code, 0, JSON.stringify(restored.value));
  assert.equal(await f.read(1, 'a/설계.md'), '# v1\n');
  assert.equal((await f.call(1, ['status', '--name', '개인설계'])).value.local, 'same');
  assert.equal(spawnSync('git', ['-C', f.roots[1], 'status', '--porcelain']).stdout.toString(), '');
});

test('bundle content is stored once and imports reconstruct hard-link sharing across snapshots', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.connect(0);
  const shared = crypto.randomBytes(128 * 1024);
  await f.write(0, 'asset.bin', shared);
  for (let revision = 0; revision < 3; revision++) {
    await f.write(0, 'notes.md', '# Revision ' + revision);
    const prepared = await f.call(0, ['backup']);
    assert.equal(prepared.code, 0, JSON.stringify(prepared.value));
  }
  const list = await f.listed();
  assert.equal(list.heads.length, 1);
  const latest = list.bundles.find(bundle => bundle.bundleId === list.heads[0]);
  const { archivePath, available, ...recovery } = latest;
  const bundle = await readBundle(archivePath, recovery);
  assert.equal([...bundle.entries.keys()].filter(name => /^objects\/[0-9a-f]{64}$/.test(name)).length, 4);
  assert.ok(latest.archive.size < shared.length * 2, 'three snapshots share the large file once');
  const applied = await f.call(1, ['restore', '--directory', f.cloud, '--apply']);
  assert.equal(applied.code, 0, JSON.stringify(applied.value));
  const store = await inspectStore(f.homes[1], KEY);
  const backups = (await listBackups(store.path)).backups;
  assert.equal(backups.length, 3);
  const stats = await Promise.all(backups.map(backup => fs.stat(path.join(backup.path, 'files', 'asset.bin'))));
  assert.ok(stats.every(stat => stat.ino === stats[0].ino && stat.nlink >= 3));
  assert.equal(await f.read(1, 'notes.md'), '# Revision 2');
  assert.equal((await f.call(0, ['backup'])).value.action, 'unchanged');
});

test('selective export and additive restore keep unrelated private folders', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.connect(0, 'folders');
  await f.write(0, 'a/A.md', '# A\n');
  await f.write(0, 'b/B.md', '# B\n');
  const exported = await f.call(0, ['backup', '--name', 'folders', '--path', 'a', '--tag', 'only-a']);
  assert.equal(exported.code, 0, JSON.stringify(exported.value));
  assert.deepEqual(exported.value.selection, ['a']);
  await f.init(1);
  await f.write(1, 'c/C.md', '# C stays\n');
  const restored = await f.call(1, ['restore', '--directory', f.cloud, '--name', 'folders', '--tag', 'only-a', '--apply']);
  assert.equal(restored.code, 0, JSON.stringify(restored.value));
  assert.equal(await f.read(1, 'a/A.md'), '# A\n');
  assert.equal(await f.read(1, 'c/C.md'), '# C stays\n');
  await assert.rejects(f.read(1, 'b/B.md'), { code: 'ENOENT' });
  assert.equal((await f.call(0, ['backup', '--name', 'folders', '--tag', 'both'])).code, 0);
  await f.write(1, 'a/A.md', '# local change\n');
  const conflict = await f.call(1, ['restore', '--directory', f.cloud, '--name', 'folders', '--tag', 'both', '--path', 'a', '--apply']);
  assert.equal(conflict.code, 3);
  assert.equal(await f.read(1, 'a/A.md'), '# local change\n');
  const forced = await f.call(1, ['restore', '--directory', f.cloud, '--name', 'folders', '--tag', 'both',
    '--path', 'a', '--apply', '--force']);
  assert.equal(forced.code, 0, JSON.stringify(forced.value));
  assert.equal(await f.read(1, 'c/C.md'), '# C stays\n');
  await assert.rejects(f.read(1, 'b/B.md'), { code: 'ENOENT' });
  const store = await inspectStore(f.homes[1], KEY);
  assert.ok((await listBackups(store.path)).backups.some(backup => backup.reason === 'before-restore'));
  const missing = await f.call(1, ['restore', '--directory', f.cloud, '--name', 'folders', '--tag', 'both', '--path', 'missing']);
  assert.equal(missing.value.reason, 'selection-missing');
  await f.write(1, 'b/B.md', '# local B stays\n');
  assert.equal((await f.call(1, ['restore', '--name', 'folders', '--tag', 'both', '--path', 'a', '--apply'])).code, 0);
  assert.equal(await f.read(1, 'b/B.md'), '# local B stays\n');
});

test('selecting multiple paths and omitting selection cover partial and whole private exports', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.connect(0);
  for (const name of ['a', 'b', 'c']) await f.write(0, name + '/NOTE.md', '# ' + name);
  await f.call(0, ['backup', '--path', 'a', '--path', 'b', '--path', 'a/child', '--tag', 'partial']);
  const partial = (await f.listed()).bundles[0];
  const { archivePath, available, ...recovery } = partial;
  const bundle = await readBundle(archivePath, recovery);
  assert.deepEqual(bundle.manifest.selection, ['a', 'b']);
  assert.deepEqual(bundle.manifest.snapshots[0].files.map(file => file.path), ['a/NOTE.md', 'b/NOTE.md']);
  const missingBackup = await f.call(0, ['backup', '--path', 'a', '--path', 'missing']);
  assert.equal(missingBackup.code, 3);
  assert.deepEqual(missingBackup.value.paths, ['missing']);
  assert.equal((await f.listed()).bundles.length, 1, 'a missing requested path must not produce a partial success');
  const missingRestore = await f.call(1, ['restore', '--directory', f.cloud, '--tag', 'partial',
    '--path', 'a', '--path', 'missing', '--apply']);
  assert.equal(missingRestore.code, 3);
  assert.deepEqual(missingRestore.value.paths, ['missing']);
  await assert.rejects(f.read(1, 'a/NOTE.md'), { code: 'ENOENT' });
  await f.call(0, ['backup', '--tag', 'whole']);
  const whole = (await f.listed()).bundles.find(item => item.tags.includes('whole'));
  assert.deepEqual(whole.selection, []);
  assert.equal(whole.snapshots.find(item => item.name === whole.currentSnapshot).files, 3);
});

test('the same tag created while another device was offline requires an explicit version choice', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.connect(0);
  await f.write(0, 'NOTE.md', '# home');
  await f.call(0, ['backup', '--tag', 'v1']);
  const offline = f.cloud + '-offline';
  await fs.rename(f.cloud, offline);
  await fs.mkdir(f.cloud);
  await f.init(1);
  await f.connect(1);
  await f.write(1, 'NOTE.md', '# work');
  await f.call(1, ['backup', '--tag', 'v1']);
  await fs.cp(path.join(offline, 'docatlas-backups'), path.join(f.cloud, 'docatlas-backups'), { recursive: true });
  const ambiguous = await f.call(0, ['restore', '--tag', 'v1']);
  assert.equal(ambiguous.value.reason, 'ambiguous-tag');
  assert.equal(ambiguous.value.candidates.length, 2);
});

test('same folder and backup names in different repositories stay separate, and an old key can be selected', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.connect(0, 'personal');
  await f.write(0, 'NOTE.md', '# first repository');
  await f.call(0, ['backup', '--name', 'personal', '--tag', 'v1']);
  assert.equal(spawnSync('git', ['-C', f.roots[1], 'remote', 'set-url', 'origin', 'https://example.com/other/shop.git']).status, 0);
  await f.init(1);
  await f.connect(1, 'personal');
  await f.write(1, 'NOTE.md', '# second repository');
  await f.call(1, ['backup', '--name', 'personal', '--tag', 'v1']);
  assert.equal((await f.call(1, ['projects', '--directory', f.cloud])).value.projects.length, 2);
  assert.equal((await f.call(1, ['list', '--name', 'personal'])).value.bundles.length, 1);
  const old = await f.call(1, ['restore', '--name', 'personal', '--key', KEY, '--tag', 'v1']);
  assert.equal(old.value.projectKey, KEY);
  assert.equal(old.value.counts.conflict, 1);
});

test('alternating computers use ancestry, preserve conflicts and do not choose divergent histories by clock', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.connect(0);
  await f.write(0, 'notes.md', '# home');
  const home = await f.call(0, ['backup']);
  assert.equal((await f.call(1, ['restore', '--directory', f.cloud, '--apply'])).code, 0);
  await f.write(1, 'notes.md', '# work');
  const work = await f.call(1, ['backup'], { now: new Date('2025-01-01T00:00:00Z') });
  assert.equal(work.code, 0);
  let list = await f.listed();
  assert.deepEqual(list.heads, [work.value.bundleId], 'a clock behind the first machine still follows its imported parent');
  const preview = await f.call(0, ['restore']);
  assert.equal(preview.value.bundleId, work.value.bundleId);
  assert.equal(preview.value.counts.conflict, 1);
  assert.equal((await f.call(0, ['restore', '--apply', '--force'])).code, 0);
  assert.equal(await f.read(0, 'notes.md'), '# work');
  await f.write(0, 'notes.md', '# next home');
  const next = await f.call(0, ['backup']);
  await f.write(1, 'notes.md', '# independent work');
  const branch = await f.call(1, ['backup']);
  list = await f.listed();
  assert.equal(list.heads.length, 2);
  assert.ok(list.heads.includes(next.value.bundleId) && list.heads.includes(branch.value.bundleId));
  const choose = await f.call(0, ['restore']);
  assert.equal(choose.value.reason, 'multiple-heads');
  assert.equal(await f.read(0, 'notes.md'), '# next home');
  assert.ok(home.value.bundleId);
});

test('incomplete transfers and tampered payloads never change the destination documents', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.connect(0);
  await f.write(0, 'notes.md', '# source');
  await f.call(0, ['backup']);
  const [saved] = (await f.listed()).bundles;
  const original = await fs.readFile(saved.archivePath);
  await fs.writeFile(saved.archivePath, original.subarray(0, 512));
  const before = await snapshot(f.homes[1]);
  assert.equal((await f.call(1, ['restore', '--directory', f.cloud])).value.reason, 'incomplete-backups');
  assert.deepEqual(await snapshot(f.homes[1]), before);
  const bytes = Buffer.from(original);
  const parsed = readArchive(bytes);
  const object = [...parsed.entries].find(([name]) => /^objects\/[0-9a-f]{64}$/.test(name))[1];
  object[0] ^= 1;
  await fs.writeFile(saved.archivePath, bytes);
  const recoveryPath = saved.archivePath.replace(/\.tar$/, '.json');
  const recovery = JSON.parse(await fs.readFile(recoveryPath, 'utf8'));
  recovery.archive.sha256 = digest(bytes);
  await fs.writeFile(recoveryPath, JSON.stringify(recovery));
  const damaged = await f.call(1, ['restore', '--directory', f.cloud, '--apply']);
  assert.equal(damaged.code, 3);
  assert.equal(damaged.value.reason, 'damaged-archive');
  await assert.rejects(f.read(1, 'notes.md'), { code: 'ENOENT' });
});

test('the bounded archive reader rejects traversal, links, unsupported formats and bad checksums', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.connect(0);
  await f.write(0, 'notes.md', '# source');
  await f.call(0, ['backup']);
  const [saved] = (await f.listed()).bundles;
  const original = await fs.readFile(saved.archivePath);
  function modified(change) {
    const bytes = Buffer.from(original);
    change(bytes);
    bytes.fill(32, 148, 156);
    const checksum = bytes.subarray(0, 512).reduce((sum, byte) => sum + byte, 0);
    bytes.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
    return bytes;
  }
  for (const mutate of [
    bytes => { bytes.fill(0, 0, 100); bytes.write('../escape', 0, 'ascii'); },
    bytes => { bytes[156] = '2'.charCodeAt(0); },
    bytes => { bytes[156] = '1'.charCodeAt(0); },
    bytes => { bytes[156] = 'x'.charCodeAt(0); }
  ]) assert.throws(() => readArchive(modified(mutate)), /Unexpected path, link, or archive extension/);
  const badChecksum = Buffer.from(original);
  badChecksum[10] ^= 1;
  assert.throws(() => readArchive(badChecksum), /header/);
  assert.throws(() => readArchive(original.subarray(0, 1024)), /truncated|manifest|ending/);
});

test('missing tar keeps the local backup and releases temporary work and the operation lock', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.connect(0);
  await f.write(0, 'notes.md', '# local survives');
  const result = await f.call(0, ['backup'], { tar: path.join(f.base, 'missing-tar') });
  assert.equal(result.value.reason, 'tar-unavailable');
  assert.equal((await f.listed()).bundles.length, 0);
  const store = await inspectStore(f.homes[0], KEY);
  assert.equal((await listBackups(store.path)).backups.length, 1);
  const profile = await profileDirectory(f.homes[0], f.roots[0]);
  assert.ok(!(await fs.readdir(profile)).some(name => name === 'operation.lock' || name.startsWith('.work-')));
});

test('local locks block concurrent operations and require a stopped owner and exact ID for recovery', async t => {
  const f = await fixture(t);
  await f.connect(0);
  let release;
  let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const held = withLock(f.homes[0], f.roots[0], async () => {
    entered();
    await new Promise(resolve => { release = resolve; });
  });
  await ready;
  try {
    const status = await f.call(0, ['status']);
    assert.equal(status.code, 3);
    assert.equal(status.value.lock.process, 'running');
    assert.equal((await f.call(0, ['backup'])).value.reason, 'locked');
    assert.equal((await f.call(0, ['unlock', '--lock-id', status.value.lock.id])).code, 3);
  } finally {
    release();
    await held;
  }
  const profile = await profileDirectory(f.homes[0], f.roots[0]);
  const lock = path.join(profile, 'operation.lock');
  await fs.mkdir(lock);
  const id = crypto.randomUUID();
  const stopped = spawnSync(process.execPath, ['-e', 'process.exit(0)']).pid;
  await fs.writeFile(path.join(lock, 'owner.json'), JSON.stringify({ id, pid: stopped, startedAt: 'old' }));
  assert.equal((await f.call(0, ['unlock', '--lock-id', crypto.randomUUID()])).code, 3);
  assert.equal((await f.call(0, ['unlock', '--lock-id', id])).code, 0);
});

test('cloud links are refused and a disconnected target never erases the saved connection', async t => {
  const f = await fixture(t);
  await f.connect(0);
  const profile = await profileDirectory(f.homes[0], f.roots[0]);
  const original = await fs.readFile(path.join(profile, 'connection.json'));
  const moved = f.cloud + '-offline';
  await fs.rename(f.cloud, moved);
  const unavailable = await f.call(0, ['status']);
  assert.equal(unavailable.value.reason, 'connection-unavailable');
  assert.deepEqual(await fs.readFile(path.join(profile, 'connection.json')), original);
  await fs.rename(moved, f.cloud);
  const outside = path.join(f.base, 'outside');
  await fs.mkdir(outside);
  try { await fs.symlink(outside, path.join(f.cloud, 'docatlas-backups'), 'dir'); }
  catch (error) { t.skip('symbolic links unavailable: ' + error.code); return; }
  assert.equal((await f.call(0, ['list'])).value.reason, 'unsafe-path');
  assert.deepEqual(await fs.readdir(outside), []);
});

test('corrupt operation state blocks mutation but does not prevent explicit cloud discovery or erase configuration', async t => {
  const f = await fixture(t);
  await f.init(0);
  await f.connect(0);
  await f.write(0, 'NOTE.md', '# source');
  await f.call(0, ['backup']);
  const profile = await profileDirectory(f.homes[0], f.roots[0]);
  const original = await fs.readFile(path.join(profile, 'connection.json'));
  await fs.writeFile(path.join(profile, 'state.json'), '{unfinished');
  assert.equal((await f.call(0, ['status'])).value.reason, 'invalid-state');
  assert.equal((await f.call(0, ['backup'])).value.reason, 'invalid-state');
  assert.equal((await f.call(0, ['connections'])).value.connections.length, 1);
  assert.equal((await f.call(0, ['projects', '--directory', f.cloud])).value.projects.length, 1);
  assert.deepEqual(await fs.readFile(path.join(profile, 'connection.json')), original);
});

test('replacing an owned lock directory with a link never deletes files through that link', async t => {
  const f = await fixture(t);
  await f.connect(0);
  const outside = path.join(f.base, 'outside-lock');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'owner.json'), 'keep');
  let supported = true;
  await assert.rejects(withLock(f.homes[0], f.roots[0], async profile => {
    const lock = path.join(profile, 'operation.lock');
    await fs.rename(lock, lock + '-moved');
    try { await fs.symlink(outside, lock, 'dir'); }
    catch {
      supported = false;
      await fs.rename(lock + '-moved', lock);
      throw new Error('no symlink');
    }
  }), /symbolic link|no symlink/);
  if (!supported) t.skip('symbolic links unavailable');
  assert.equal(await fs.readFile(path.join(outside, 'owner.json'), 'utf8'), 'keep');
});
