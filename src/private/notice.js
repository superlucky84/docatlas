import fs from 'node:fs/promises';
import { countFiles, inspectFolder, isHomeOrAbove } from './folder.js';
import { locateRepository } from './git.js';
import { projectKey } from './key.js';
import { inspectStore, latestRegular, listBackups } from './store.js';

// Quotes a path for the user's shell only when needed: single quotes on macOS and Linux, double quotes on Windows,
// where a path cannot contain a double quote and backslashes are separators.
export function quotePath(text, platform = process.platform) {
  if (platform === 'win32') return /[\s&|<>^%()]/.test(text) ? '"' + text + '"' : text;
  return /[\s"'$`\\!&|;<>()*?[\]{}#~]/.test(text) ? "'" + text.replace(/'/g, "'\\''") + "'" : text;
}
const formatTime = iso => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
};

// The root that docatlas private would use from this folder.
async function privateRoot(start, git) {
  const location = await locateRepository(start, { git });
  return location.repo ? location.root : start;
}

// Returns a one-line restore hint when the map root has no private files but a backup exists for its key, or null.
// Reads only; any problem means no hint, so the document map never depends on it.
export async function privateBackupNotice({ home, root, cwd = process.cwd(), git = 'git' } = {}) {
  try {
    const mapRoot = await fs.realpath(root);
    const homeFolder = await fs.realpath(home);
    const location = await locateRepository(mapRoot, { git });
    // A map opened below the repository top folder shows no private documents, so it gives no hint either.
    if (location.blocked || (location.repo && location.root !== mapRoot) || isHomeOrAbove(mapRoot, homeFolder)) return null;
    const folder = await inspectFolder(mapRoot);
    if (folder.state === 'blocked' || (folder.state === 'present' && (await countFiles(folder.path)).files)) return null;
    const { key } = await projectKey(mapRoot, location, { git });
    const store = await inspectStore(homeFolder, key);
    if (store.state !== 'present') return null;
    const latest = latestRegular((await listBackups(store.path)).backups);
    if (!latest) return null;
    const here = await privateRoot(await fs.realpath(cwd), git).catch(() => null);
    const command = 'docatlas private restore' + (here === mapRoot ? '' : ' --root ' + quotePath(mapRoot)) + ' --dry-run';
    return 'Private documents: a backup from ' + formatTime(latest.createdAt) + ' is available. Restore with: ' + command;
  } catch {
    return null;
  }
}
