import crypto from 'node:crypto';
import path from 'node:path';
import { originUrl } from './git.js';

// A project key names a project's backup folder: the origin address without credentials, port, scheme or .git,
// so every clone of the same repository finds the same backups. Keys are lower case because Windows and macOS
// folders ignore case.

const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/;

// Makes one folder name that is valid on Windows, macOS and Linux and has no spaces, or '' when nothing is left.
function folderName(segment) {
  let name = segment.toLowerCase().replace(/[<>:"\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, '-').replace(/\.+$/, '');
  if (name === '.' || name === '..') return '';
  if (RESERVED.test(name)) name = '_' + name;
  return name;
}

function decode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// Decodes before splitting, so an encoded / or .. can never add or leave a folder.
function joinKey(parts) {
  const names = parts.map(decode).flatMap(part => part.split(/[\\/]+/)).map(folderName).filter(Boolean);
  if (names.length) names[names.length - 1] = folderName(names[names.length - 1].replace(/\.git$/, ''));
  return names.filter(Boolean).join('/');
}

// Returns the key for an origin address, or '' when the address has no usable part.
export function normalizeRemote(url) {
  const text = String(url ?? '').trim();
  const scheme = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(text);
  if (scheme) {
    const rest = scheme[2];
    if (scheme[1].toLowerCase() === 'file') {
      return joinKey(['file', rest.replace(/^\/([a-z]):/i, '$1')]);
    }
    const slash = rest.indexOf('/');
    let authority = slash === -1 ? rest : rest.slice(0, slash);
    const location = slash === -1 ? '' : rest.slice(slash + 1);
    authority = authority.slice(authority.lastIndexOf('@') + 1);
    const host = authority.startsWith('[') ? authority.slice(1, authority.indexOf(']')) : authority.replace(/:\d*$/, '');
    return host ? joinKey([host, location]) : '';
  }
  // scp-like address: [user@]host:path. A single letter before the colon is a Windows drive, not a host.
  const scp = /^(?:[^@/\\]+@)?([^:/\\]+):(.*)$/.exec(text);
  if (scp && !/^[a-z]$/i.test(scp[1])) {
    return joinKey([scp[1], scp[2]]);
  }
  return text ? joinKey(['file', text.replace(/^([a-z]):/i, '$1')]) : '';
}

// Checks a --key value: parts joined by / that are already valid folder names. Returns the lower-case key, or null.
export function parseKey(value) {
  const key = String(value ?? '').toLowerCase();
  if (!key || key.length > 200) return null;
  return key.split('/').every(segment => segment !== '' && folderName(segment) === segment) ? key : null;
}

// local/<folder name>-<8 hex digits of the folder's full path>, so same-named folders in different places keep
// separate backups. Windows and macOS ignore case in paths, so the path is compared in lower case there.
export function localKey(root, platform = process.platform) {
  const full = platform === 'win32' || platform === 'darwin' ? root.toLowerCase() : root;
  const code = crypto.createHash('sha256').update(full).digest('hex').slice(0, 8);
  return 'local/' + (folderName(path.basename(root)) || 'project') + '-' + code;
}

// source: option (--key), origin, or local (no origin, or outside git).
export async function projectKey(root, location, { git = 'git', key } = {}) {
  if (key) return { key, source: 'option' };
  const url = location.repo ? await originUrl(root, { git }) : null;
  const normalized = url ? normalizeRemote(url) : '';
  if (normalized) return { key: normalized, source: 'origin' };
  return { key: localKey(root), source: 'local' };
}
