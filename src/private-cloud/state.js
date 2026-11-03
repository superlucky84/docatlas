import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { kind } from '../private/folder.js';
import { parseKey } from '../private/key.js';
import { readRegularFile } from '../private/store.js';
import { CloudError, UUID, digest, ensure, label } from './archive.js';

export async function realDirectory(directory) {
  ensure(await kind(directory) === 'directory' &&
    path.relative(await fs.realpath(directory), path.resolve(directory)) === '',
  'unsafe-path', 'A directory or its parent is a symbolic link: ' + directory);
}

export async function directoryChain(base, parts, create = false) {
  let current = base;
  await realDirectory(base);
  for (const part of parts) {
    ensure(part && part !== '.' && part !== '..' && !/[\/\\]/.test(part), 'unsafe-path', 'Invalid directory component.');
    current = path.join(current, part);
    if (create) await fs.mkdir(current, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const found = await kind(current);
    if (found === 'missing') return null;
    ensure(found === 'directory', 'unsafe-path', 'A path is a link or not a directory: ' + current);
  }
  return current;
}

export function profileParts(root, name = 'default') {
  const normalized = process.platform === 'win32' || process.platform === 'darwin' ? root.toLowerCase() : root;
  return ['.docatlas', 'private-cloud', digest(normalized), digest(name)];
}

export async function profileDirectory(home, root, create = false, name = 'default') {
  return directoryChain(home, profileParts(root, name), create);
}

export async function readJSON(filename, limit = 2 * 1024 * 1024) {
  const found = await kind(filename);
  if (found === 'missing') return null;
  await realDirectory(path.dirname(filename));
  ensure(found === 'file', 'unsafe-path', 'Expected a regular JSON file: ' + filename);
  ensure((await fs.lstat(filename)).size <= limit, 'invalid-state', 'JSON file exceeds the limit.');
  try {
    const bytes = await readRegularFile(filename);
    ensure(bytes.length <= limit, 'invalid-state', 'JSON file exceeds the limit.');
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw error instanceof CloudError ? error : new CloudError('invalid-state', 'Unreadable JSON: ' + filename);
  }
}

export async function writeJSON(directory, name, value) {
  await realDirectory(directory);
  const filename = path.join(directory, name);
  const found = await kind(filename);
  ensure(found === 'missing' || found === 'file', 'unsafe-path', 'State target is not a regular file.');
  const temporary = path.join(directory, '.partial-' + crypto.randomUUID());
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await realDirectory(directory);
    ensure(['missing', 'file'].includes(await kind(filename)),
      'unsafe-path', 'State path changed.');
    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

export async function connection(home, root, name = 'default') {
  const directory = await profileDirectory(home, root, false, name);
  if (!directory) return { directory: null, config: null, state: {} };
  const config = await readJSON(path.join(directory, 'connection.json'));
  const state = await readJSON(path.join(directory, 'state.json')) ?? {};
  if (config) validateConnection(config, root, name);
  ensure(state && typeof state === 'object' && !Array.isArray(state) &&
    (!state.baseId || UUID.test(state.baseId)), 'invalid-state', 'Invalid operation state.');
  return { directory, config, state };
}

function validateConnection(config, root, name) {
  ensure(config.format === 1 && config.root === root && config.name === name && label(config.name) === config.name &&
    parseKey(config.projectKey) === config.projectKey &&
    typeof config.directory === 'string' && path.isAbsolute(config.directory) && UUID.test(config.deviceId),
  'invalid-state', 'Invalid saved connection.');
}

export async function connections(home, root) {
  const directory = await directoryChain(home, profileParts(root).slice(0, -1));
  if (!directory) return [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  ensure(entries.length <= 256, 'invalid-state', 'Too many named connections.');
  const found = [];
  for (const entry of entries) {
    if (!/^[0-9a-f]{64}$/.test(entry.name)) continue;
    ensure(entry.isDirectory(), 'unsafe-path', 'A named connection path is not a real directory.');
    const config = await readJSON(path.join(directory, entry.name, 'connection.json'));
    if (!config) continue;
    ensure(label(config.name) === config.name && digest(config.name) === entry.name,
      'invalid-state', 'Invalid named connection.');
    validateConnection(config, root, config.name);
    found.push({ name: config.name, projectKey: config.projectKey, directory: config.directory });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

export function processState(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return 'unknown';
  try {
    process.kill(pid, 0);
    return 'running';
  } catch (error) {
    return error.code === 'ESRCH' ? 'stopped' : 'unknown';
  }
}

export async function lockState(directory) {
  if (!directory) return null;
  const lock = path.join(directory, 'operation.lock');
  const found = await kind(lock);
  if (found === 'missing') return null;
  ensure(found === 'directory', 'unsafe-path', 'Operation lock is not a real directory.');
  const owner = await readJSON(path.join(lock, 'owner.json'), 4096);
  ensure(owner && UUID.test(owner.id) && Number.isSafeInteger(owner.pid),
    'locked', 'An operation lock has no readable owner.');
  return { ...owner, process: processState(owner.pid) };
}

export async function withLock(home, root, operation, name = 'default') {
  const directory = await profileDirectory(home, root, true, name);
  const lock = path.join(directory, 'operation.lock');
  const owner = { id: crypto.randomUUID(), pid: process.pid, startedAt: new Date().toISOString() };
  try {
    await fs.mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if (error.code === 'EEXIST') throw new CloudError('locked', 'Another operation owns this profile.', { lock: await lockState(directory) });
    throw error;
  }
  let ownerWritten = false;
  try {
    await fs.writeFile(path.join(lock, 'owner.json'), JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
    ownerWritten = true;
    return await operation(directory);
  } finally {
    await profileDirectory(home, root, false, name);
    await realDirectory(lock);
    const current = await readJSON(path.join(lock, 'owner.json'), 4096).catch(() => null);
    if (current?.id === owner.id) {
      await fs.unlink(path.join(lock, 'owner.json'));
      await fs.rmdir(lock);
    } else if (!ownerWritten && current === null) {
      await fs.rmdir(lock).catch(() => {});
    }
  }
}

export async function unlock(home, root, id, name = 'default') {
  const directory = await profileDirectory(home, root, false, name);
  const owner = await lockState(directory);
  ensure(owner && owner.id === id && owner.process === 'stopped', 'locked',
    'Unlock requires the displayed lock ID and a confirmed stopped owner.');
  const lock = path.join(directory, 'operation.lock');
  await fs.unlink(path.join(lock, 'owner.json'));
  await fs.rmdir(lock);
  return { status: 'unlocked', lockId: id };
}
