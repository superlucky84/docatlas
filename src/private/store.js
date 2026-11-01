import crypto from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { blockReason, kind } from './folder.js';

// Backups live in <home>/.docatlas/private-backups/<key>/<UTC time>/ with manifest.json and files/.
// A backup is written to a .partial- folder first and renamed when complete, so a folder with a readable
// manifest is always a whole backup. Symbolic links in the store are never followed.

export const STORE_PATH = ['.docatlas', 'private-backups'];
export const MANIFEST = 'manifest.json';
export const FILES = 'files';
const NAME = /^(\d{8}T\d{6}Z)(?:-(\d+))?$/;
const SHA256 = /^[0-9a-f]{64}$/;
// Reads never follow a link at the last step and never wait on a pipe. Windows has neither flag.
const READ_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0);

export const isBackupName = name => NAME.test(name);
export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

export function storeFolder(home, key) {
  return path.join(home, ...STORE_PATH, ...key.split('/'));
}

// Reads a regular file without following a symbolic link.
export async function readRegularFile(filename) {
  const handle = await fs.open(filename, READ_FLAGS);
  try {
    if (!(await handle.stat()).isFile()) {
      throw Object.assign(new Error('Not a regular file: ' + filename), { code: 'EWRONGTYPE' });
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

// state: present, missing, or blocked when a folder on the way is a symbolic link or not a folder.
export async function inspectStore(home, key) {
  const folder = storeFolder(home, key);
  let current = home;
  for (const segment of [...STORE_PATH, ...key.split('/')]) {
    current = path.join(current, segment);
    const found = await kind(current);
    if (found === 'missing') return { path: folder, state: 'missing' };
    if (found !== 'directory') return { path: folder, state: 'blocked', blocker: current, reason: blockReason(found) };
  }
  return { path: folder, state: 'present' };
}

// A safe manifest path: relative, / only, no empty, . or .. parts, no NUL.
export function isSafeRelative(relative) {
  return typeof relative === 'string' && relative !== '' && !relative.includes('\\') && !relative.includes('\0') &&
    !relative.startsWith('/') && relative.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

function parseManifest(data, name) {
  if (!data || data.format !== 1 || typeof data.createdAt !== 'string' || !Array.isArray(data.files)) return null;
  const seen = new Set();
  for (const file of data.files) {
    if (!file || !isSafeRelative(file.path) || seen.has(file.path) || !SHA256.test(file.sha256) ||
      !Number.isSafeInteger(file.size) || file.size < 0) {
      return null;
    }
    seen.add(file.path);
  }
  return {
    name,
    createdAt: data.createdAt,
    reason: data.reason === 'before-restore' ? 'before-restore' : 'backup',
    commit: typeof data.commit === 'string' && data.commit ? data.commit : null,
    files: data.files.map(({ path: relative, size, sha256: hash }) => ({ path: relative, size, sha256: hash }))
  };
}

function compareNames(a, b) {
  const [, timeA, suffixA = '1'] = NAME.exec(a);
  const [, timeB, suffixB = '1'] = NAME.exec(b);
  return timeA === timeB ? Number(suffixA) - Number(suffixB) : timeA < timeB ? -1 : 1;
}

// Backups of one key, newest first. invalid: backup-named folders without a readable manifest.
export async function listBackups(folder) {
  const backups = [];
  const invalid = [];
  let entries;
  try {
    entries = await fs.readdir(folder, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { backups, invalid };
    throw error;
  }
  for (const entry of entries) {
    if (!isBackupName(entry.name)) continue;
    const filename = path.join(folder, entry.name);
    let manifest = null;
    if (entry.isDirectory()) {
      try {
        manifest = parseManifest(JSON.parse((await readRegularFile(path.join(filename, MANIFEST))).toString('utf8')), entry.name);
      } catch {
        manifest = null;
      }
    }
    if (manifest) backups.push({ ...manifest, path: filename });
    else invalid.push(filename);
  }
  backups.sort((a, b) => compareNames(b.name, a.name));
  invalid.sort();
  return { backups, invalid };
}

export const latestRegular = backups => backups.find(backup => backup.reason === 'backup') ?? null;

export function sameFiles(backup, entries) {
  return Boolean(backup) && backup.files.length === entries.length &&
    backup.files.every((file, index) => file.path === entries[index].path && file.sha256 === entries[index].sha256);
}

// Reads the files to back up. entries keep the data so the copy matches the hash.
export async function readEntries(privateFolder, relatives) {
  const entries = [];
  for (const relative of relatives) {
    const data = await readRegularFile(path.join(privateFolder, ...relative.split('/')));
    entries.push({ path: relative, size: data.length, sha256: sha256(data), data });
  }
  return entries;
}

// Reads every file of a backup and checks its size and hash. damaged: the first path that does not match.
export async function readBackup(backup) {
  const files = [];
  for (const file of backup.files) {
    let data;
    try {
      data = await readRegularFile(path.join(backup.path, FILES, ...file.path.split('/')));
    } catch {
      return { damaged: file.path };
    }
    if (data.length !== file.size || sha256(data) !== file.sha256) return { damaged: file.path };
    files.push({ ...file, data });
  }
  return { files };
}

// Creates each missing store folder (0700) without following links. Returns null, or the blocking path.
async function prepareStore(home, key) {
  let current = home;
  for (const segment of [...STORE_PATH, ...key.split('/')]) {
    current = path.join(current, segment);
    await fs.mkdir(current, { mode: 0o700 }).catch(error => {
      if (error.code !== 'EEXIST') throw error;
    });
    const found = await kind(current);
    if (found !== 'directory') return { blocker: current, reason: blockReason(found) };
  }
  return null;
}

function stamp(date) {
  return date.toISOString().replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '');
}

// Writes a new backup and returns { name, path }, or { blocked } when a store folder is a link or a file.
export async function writeBackup({ home, key, entries, reason, root, commit, now = new Date() }) {
  const blocked = await prepareStore(home, key);
  if (blocked) return { blocked };
  const folder = storeFolder(home, key);
  const partial = path.join(folder, '.partial-' + process.pid + '-' + crypto.randomBytes(4).toString('hex'));
  await fs.mkdir(partial, { mode: 0o700 });
  try {
    for (const entry of entries) {
      const target = path.join(partial, FILES, ...entry.path.split('/'));
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await fs.writeFile(target, entry.data, { flag: 'wx', mode: 0o600 });
    }
    const manifest = {
      format: 1, createdAt: now.toISOString(), key, reason, root, commit: commit ?? null,
      files: entries.map(({ path: relative, size, sha256: hash }) => ({ path: relative, size, sha256: hash }))
    };
    await fs.writeFile(path.join(partial, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const base = stamp(now);
    for (let suffix = 1; suffix <= 100; suffix++) {
      const name = suffix === 1 ? base : base + '-' + suffix;
      const target = path.join(folder, name);
      if (await kind(target) !== 'missing') continue;
      try {
        await fs.rename(partial, target);
        return { name, path: target };
      } catch (error) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) throw error;
      }
    }
    throw new Error('Could not name the backup folder: ' + base);
  } catch (error) {
    await fs.rm(partial, { recursive: true, force: true });
    throw error;
  }
}
