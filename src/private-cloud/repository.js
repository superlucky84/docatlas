import fs from 'node:fs/promises';
import path from 'node:path';
import { kind } from '../private/folder.js';
import { UUID, CloudError, digest, ensure, validateDescriptor } from './archive.js';
import { directoryChain, readJSON } from './state.js';

export const CLOUD_FOLDER = 'docatlas-backups';

export async function cloudDirectory(directory, root) {
  const resolved = await fs.realpath(directory).catch(() => null);
  ensure(resolved && await kind(resolved) === 'directory', 'connection-unavailable',
    'The selected cloud folder is unavailable. Keep the existing connection and check the cloud app.');
  const relative = path.relative(root, resolved);
  ensure(relative.startsWith('..') || path.isAbsolute(relative), 'unsafe-path',
    'Choose a cloud folder outside the project.');
  return resolved;
}

export function inventory(recovery) {
  return digest(JSON.stringify([recovery.name, recovery.tags, recovery.selection, recovery.currentSnapshot, recovery.snapshots]));
}

export function heads(bundles) {
  const parents = new Set(bundles.flatMap(bundle => bundle.parents));
  return bundles.filter(bundle => !parents.has(bundle.bundleId)).map(bundle => bundle.bundleId);
}

export async function scanCloud(directory, key, name = 'default') {
  const project = await directoryChain(directory, [CLOUD_FOLDER, digest(key), digest(name)]);
  const result = { bundles: [], invalid: [], pending: [], heads: [], remoteStatus: 'unknown' };
  if (!project) return result;
  const devices = await fs.readdir(project, { withFileTypes: true });
  ensure(devices.length <= 256, 'too-many-backups', 'Too many device folders.');
  for (const device of devices) {
    if (!UUID.test(device.name)) continue;
    const devicePath = path.join(project, device.name);
    ensure(device.isDirectory(), 'unsafe-path', 'A device path is a link or not a directory.');
    const files = await fs.readdir(devicePath, { withFileTypes: true });
    ensure(files.length <= 4096, 'too-many-backups', 'Too many backups in a device folder.');
    const known = new Set(files.filter(file => file.name.endsWith('.json')).map(file => file.name.slice(0, -5)));
    for (const file of files) {
      const id = file.name.slice(0, -5);
      if (file.name.endsWith('.tar') && UUID.test(file.name.slice(0, -4)) && !known.has(file.name.slice(0, -4))) {
        result.pending.push(file.name.slice(0, -4));
      }
      if (!file.name.endsWith('.json') || !UUID.test(id)) continue;
      try {
        ensure(file.isFile(), 'unsafe-path', 'Recovery list is not a regular file.');
        const recovery = validateDescriptor(await readJSON(path.join(devicePath, file.name)));
        ensure(recovery.projectKey === key && recovery.name === name && recovery.deviceId === device.name && recovery.bundleId === id,
          'invalid-manifest', 'Recovery identity differs from its directory.');
        const archivePath = path.join(devicePath, id + '.tar');
        const archiveKind = await kind(archivePath);
        ensure(archiveKind === 'missing' || archiveKind === 'file', 'unsafe-path', 'Archive is not a regular file.');
        const available = archiveKind === 'file' && (await fs.lstat(archivePath)).size === recovery.archive.size;
        result.bundles.push({ ...recovery, archivePath, available });
        if (!available) result.pending.push(id);
      } catch (error) {
        result.invalid.push({ id, reason: error.reason ?? 'unreadable', message: error.message });
      }
    }
  }
  ensure(result.bundles.length <= 4096, 'too-many-backups', 'Too many backup records.');
  result.bundles.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.bundleId.localeCompare(b.bundleId));
  result.heads = heads(result.bundles);
  return result;
}

export async function discoverProjects(directory) {
  const base = await directoryChain(directory, [CLOUD_FOLDER]);
  if (!base) return [];
  const folders = await fs.readdir(base, { withFileTypes: true });
  ensure(folders.length <= 256, 'too-many-backups', 'Too many project folders.');
  const projects = new Map();
  for (const folder of folders) {
    if (!/^[0-9a-f]{64}$/.test(folder.name)) continue;
    ensure(folder.isDirectory(), 'unsafe-path', 'Project path is not a real directory.');
    const names = await fs.readdir(path.join(base, folder.name), { withFileTypes: true });
    ensure(names.length <= 256, 'too-many-backups', 'Too many named backups.');
    for (const named of names) {
      if (!/^[0-9a-f]{64}$/.test(named.name)) continue;
      ensure(named.isDirectory(), 'unsafe-path', 'Named backup path is not a real directory.');
      const devices = await fs.readdir(path.join(base, folder.name, named.name), { withFileTypes: true });
      ensure(devices.length <= 256, 'too-many-backups', 'Too many device folders.');
      for (const device of devices) {
        if (!UUID.test(device.name)) continue;
        ensure(device.isDirectory(), 'unsafe-path', 'Device path is not a real directory.');
        const devicePath = path.join(base, folder.name, named.name, device.name);
        const files = await fs.readdir(devicePath, { withFileTypes: true });
        ensure(files.length <= 4096, 'too-many-backups', 'Too many recovery lists.');
        for (const file of files) {
          if (!file.isFile() || !UUID.test(file.name.slice(0, -5)) || !file.name.endsWith('.json')) continue;
          try {
            const recovery = validateDescriptor(await readJSON(path.join(devicePath, file.name)));
            if (digest(recovery.projectKey) === folder.name && digest(recovery.name) === named.name && recovery.deviceId === device.name) {
              const key = JSON.stringify([recovery.projectKey, recovery.name]);
              projects.set(key, (projects.get(key) ?? 0) + 1);
            }
          } catch (error) {
            if (!(error instanceof CloudError)) throw error;
          }
        }
      }
    }
  }
  return [...projects].map(([key, bundles]) => {
    const [projectKey, name] = JSON.parse(key);
    return { projectKey, name, bundles };
  }).sort((a, b) => a.projectKey.localeCompare(b.projectKey) || a.name.localeCompare(b.name));
}
