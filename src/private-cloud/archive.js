import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseKey } from '../private/key.js';
import { isBackupName, isSafeRelative, readRegularFile } from '../private/store.js';

export const MAX_ARCHIVE = 64 * 1024 * 1024;
export const MAX_MANIFEST = 2 * 1024 * 1024;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
export const digest = data => crypto.createHash('sha256').update(data).digest('hex');
export const fileSetDigest = files => digest(JSON.stringify(files.map(file => [file.path, file.size, file.sha256])));
export const label = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 80 &&
  !/[\u0000-\u001f\u007f]|\p{Surrogate}/u.test(value) ? value.trim().normalize('NFC') : null;

export class CloudError extends Error {
  constructor(reason, message, details = {}) {
    super(message);
    this.reason = reason;
    this.details = details;
  }
}

export function ensure(condition, reason, message, details = {}) {
  if (!condition) throw new CloudError(reason, message, details);
}

function portable(relative) {
  return isSafeRelative(relative) && relative.length <= 1024 && relative.split('/').every(part =>
    !/[<>:"|?*\u0000-\u001f]/.test(part) && !/[. ]$/.test(part) && !RESERVED.test(part));
}

export function normalizeSelection(paths = []) {
  ensure(Array.isArray(paths) && paths.length <= 32, 'invalid-selection', 'Select at most 32 private paths.');
  const selected = [...new Set(paths.map(value => {
    const relative = typeof value === 'string' ? value.replace(/\/+$/, '').normalize('NFC') : '';
    ensure(portable(relative), 'invalid-selection', 'Use a portable path relative to .docatlas/private, without .. or backslashes.');
    return relative;
  }))].sort();
  return selected.filter(relative => !selected.some(parent => parent !== relative && relative.startsWith(parent + '/')));
}

export function selectedFiles(files, selection = []) {
  return selection.length ? files.filter(file =>
    selection.some(prefix => file.path === prefix || file.path.startsWith(prefix + '/'))) : files;
}

export function validateIdentity(value) {
  ensure(value && value.format === 1 && parseKey(value.projectKey) === value.projectKey &&
    label(value.name) === value.name && Array.isArray(value.tags) && value.tags.length <= 8 &&
    value.tags.every(tag => label(tag) === tag) && new Set(value.tags).size === value.tags.length &&
    Array.isArray(value.selection) && JSON.stringify(normalizeSelection(value.selection)) === JSON.stringify(value.selection) &&
    UUID.test(value.deviceId) && UUID.test(value.bundleId) && Array.isArray(value.parents) &&
    value.parents.length <= 8 && value.parents.every(id => UUID.test(id) && id !== value.bundleId) &&
    new Set(value.parents).size === value.parents.length &&
    typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt)),
  'invalid-manifest', 'Invalid backup identity or format.');
}

export function validateManifest(value) {
  validateIdentity(value);
  ensure(Array.isArray(value.snapshots) && value.snapshots.length > 0 && value.snapshots.length <= 10,
    'invalid-manifest', 'Expected one to ten snapshots.');
  const snapshots = new Set();
  let count = 0;
  for (const snapshot of value.snapshots) {
    ensure(snapshot && isBackupName(snapshot.name) && !snapshots.has(snapshot.name) &&
      typeof snapshot.createdAt === 'string' && Number.isFinite(Date.parse(snapshot.createdAt)) &&
      ['backup', 'before-restore'].includes(snapshot.reason) &&
      (snapshot.commit === null || /^[0-9a-f]{7,64}$/.test(snapshot.commit)) && Array.isArray(snapshot.files),
    'invalid-manifest', 'Invalid snapshot.');
    snapshots.add(snapshot.name);
    const paths = new Set();
    for (const file of snapshot.files) {
      ensure(file && typeof file.path === 'string' && portable(file.path) &&
        !paths.has(file.path.normalize('NFC').toLowerCase()) && HASH.test(file.sha256) &&
        Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= MAX_ARCHIVE,
      'invalid-manifest', 'Invalid or non-portable file path, size or hash.');
      paths.add(file.path.normalize('NFC').toLowerCase());
      count++;
    }
  }
  ensure(count <= 10000 && snapshots.has(value.currentSnapshot) &&
    value.snapshots.find(snapshot => snapshot.name === value.currentSnapshot).reason === 'backup',
  'invalid-manifest', 'Invalid current snapshot or too many files.');
  return value;
}

export function descriptor(manifest, bytes) {
  return {
    format: 1, projectKey: manifest.projectKey, name: manifest.name, tags: manifest.tags, selection: manifest.selection,
    deviceId: manifest.deviceId, bundleId: manifest.bundleId,
    parents: manifest.parents, createdAt: manifest.createdAt, currentSnapshot: manifest.currentSnapshot,
    snapshots: manifest.snapshots.map(snapshot => ({
      name: snapshot.name, createdAt: snapshot.createdAt, reason: snapshot.reason, commit: snapshot.commit,
      digest: fileSetDigest(snapshot.files), files: snapshot.files.length
    })),
    archive: { size: bytes.length, sha256: digest(bytes) }
  };
}

export function validateDescriptor(value) {
  validateIdentity(value);
  ensure(value.archive && Number.isSafeInteger(value.archive.size) && value.archive.size >= 1024 &&
    value.archive.size <= MAX_ARCHIVE && HASH.test(value.archive.sha256) &&
    Array.isArray(value.snapshots) && value.snapshots.length > 0 && value.snapshots.length <= 10,
  'invalid-manifest', 'Invalid recovery list.');
  const names = new Set();
  for (const snapshot of value.snapshots) {
    ensure(snapshot && isBackupName(snapshot.name) && !names.has(snapshot.name) &&
      typeof snapshot.createdAt === 'string' && Number.isFinite(Date.parse(snapshot.createdAt)) &&
      ['backup', 'before-restore'].includes(snapshot.reason) && HASH.test(snapshot.digest) &&
      Number.isSafeInteger(snapshot.files) && snapshot.files >= 0 && snapshot.files <= 10000,
    'invalid-manifest', 'Invalid recovery snapshot.');
    names.add(snapshot.name);
  }
  ensure(names.has(value.currentSnapshot), 'invalid-manifest', 'Missing current snapshot.');
  return value;
}

// Only our bounded USTAR format is accepted. No operating-system extraction runs on downloaded data.
export function readArchive(bytes) {
  ensure(bytes.length <= MAX_ARCHIVE && bytes.length >= 1024, 'invalid-archive', 'Archive size is outside the limit.');
  const entries = new Map();
  let offset = 0;
  let ended = false;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      ensure(offset + 1024 <= bytes.length && bytes.subarray(offset).every(byte => byte === 0),
        'invalid-archive', 'Invalid archive ending.');
      ended = true;
      break;
    }
    const field = (start, length) => header.subarray(start, start + length).toString('ascii').replace(/\0.*$/s, '');
    const number = (start, length) => {
      const text = field(start, length).trim();
      ensure(/^[0-7]+$/.test(text), 'invalid-archive', 'Invalid numeric archive field.');
      const value = Number.parseInt(text, 8);
      ensure(Number.isSafeInteger(value), 'invalid-archive', 'Archive field overflow.');
      return value;
    };
    const checksum = number(148, 8);
    const calculated = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    ensure(checksum === calculated && field(257, 6) === 'ustar' && field(345, 155) === '',
      'invalid-archive', 'Invalid or unsupported archive header.');
    const name = field(0, 100);
    const type = field(156, 1);
    const size = number(124, 12);
    const directory = type === '5' && (name === 'objects/' || name === 'objects') && size === 0;
    ensure(directory || ((type === '' || type === '0') &&
      (name === 'manifest.json' || /^objects\/[0-9a-f]{64}$/.test(name))),
    'invalid-archive', 'Unexpected path, link, or archive extension.');
    ensure(!entries.has(name) && entries.size < 10002 && size <= MAX_ARCHIVE &&
      offset + 512 + Math.ceil(size / 512) * 512 <= bytes.length,
    'invalid-archive', 'Duplicate, oversized or truncated archive entry.');
    entries.set(name, bytes.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  ensure(ended && entries.has('manifest.json') && entries.get('manifest.json').length <= MAX_MANIFEST,
    'invalid-archive', 'Archive has no complete manifest.');
  let manifest;
  try {
    manifest = validateManifest(JSON.parse(entries.get('manifest.json').toString('utf8')));
  } catch (error) {
    throw error instanceof CloudError ? error : new CloudError('invalid-manifest', 'Unreadable archive manifest.');
  }
  const used = new Set(['manifest.json', 'objects', 'objects/']);
  for (const snapshot of manifest.snapshots) {
    for (const file of snapshot.files) {
      const name = 'objects/' + file.sha256;
      const data = entries.get(name);
      ensure(data && data.length === file.size && digest(data) === file.sha256,
        'damaged-archive', 'Missing or damaged file content.');
      used.add(name);
    }
  }
  ensure([...entries.keys()].every(name => used.has(name)), 'invalid-archive', 'Unreferenced archive content.');
  return { manifest, entries };
}

export async function readBundle(filename, recovery) {
  ensure(path.relative(await fs.realpath(path.dirname(filename)), path.dirname(filename)) === '',
    'unsafe-path', 'Archive parent path changed into a link.');
  const stat = await fs.lstat(filename);
  ensure(stat.isFile() && stat.size <= MAX_ARCHIVE, 'invalid-archive', 'Expected a bounded regular archive file.');
  const bytes = await readRegularFile(filename);
  ensure(bytes.length === recovery.archive.size && digest(bytes) === recovery.archive.sha256,
    'damaged-archive', 'The archive is incomplete or its checksum differs from the recovery list.');
  const bundle = readArchive(bytes);
  ensure(JSON.stringify(descriptor(bundle.manifest, bytes)) === JSON.stringify(recovery),
    'damaged-archive', 'The recovery list does not describe this archive.');
  return bundle;
}

function tarCreate(executable, cwd, filename) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['--format=ustar', '-cf', filename, '--', 'manifest.json', 'objects'],
      { cwd, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const interrupted = signal => {
      child.kill(signal);
      reject(new CloudError('interrupted', 'Archive creation interrupted.'));
    };
    const onInt = () => interrupted('SIGINT');
    const onTerm = () => interrupted('SIGTERM');
    process.once('SIGINT', onInt);
    process.once('SIGTERM', onTerm);
    const clean = () => {
      process.off('SIGINT', onInt);
      process.off('SIGTERM', onTerm);
    };
    child.stderr.on('data', chunk => { if (stderr.length < 4096) stderr += chunk.toString(); });
    child.once('error', error => {
      clean();
      reject(new CloudError('tar-unavailable', 'A working system tar is required: ' + error.message));
    });
    child.once('close', code => {
      clean();
      if (code === 0) resolve();
      else reject(new CloudError('tar-failed', 'System tar failed: ' + stderr.trim()));
    });
  });
}

export async function createArchive(directory, manifest, objects, { tar = 'tar' } = {}) {
  validateManifest(manifest);
  const text = JSON.stringify(manifest);
  ensure(Buffer.byteLength(text) <= MAX_MANIFEST, 'too-large', 'Manifest exceeds 2 MiB.');
  const payloadSize = [...objects.values()].reduce((sum, data) => sum + Math.ceil(data.length / 512) * 512 + 512, 0);
  ensure(payloadSize + Buffer.byteLength(text) + 32768 <= MAX_ARCHIVE, 'too-large', 'Bundle exceeds 64 MiB.');
  const staging = path.join(directory, 'staging');
  await fs.mkdir(staging, { mode: 0o700 });
  await fs.mkdir(path.join(staging, 'objects'), { mode: 0o700 });
  await fs.writeFile(path.join(staging, 'manifest.json'), text, { mode: 0o600, flag: 'wx' });
  for (const [hash, data] of objects) {
    await fs.writeFile(path.join(staging, 'objects', hash), data, { mode: 0o600, flag: 'wx' });
  }
  const filename = path.join(directory, 'bundle.tar');
  await tarCreate(tar, staging, filename);
  const stat = await fs.stat(filename);
  ensure(stat.size <= MAX_ARCHIVE, 'too-large', 'Bundle exceeds 64 MiB.');
  const bytes = await readRegularFile(filename);
  readArchive(bytes);
  return { filename, bytes, recovery: descriptor(manifest, bytes) };
}
