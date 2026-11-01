import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// The private folder is <root>/.docatlas/private. Symbolic links are never followed or written through.
export const PRIVATE_PATH = ['.docatlas', 'private'];
export const EXCLUDE_COMMENT = '# docatlas private documents (docatlas private init)';

export async function kind(filename) {
  try {
    const stat = await fs.lstat(filename);
    if (stat.isSymbolicLink()) return 'link';
    return stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other';
  } catch (error) {
    if (error.code === 'ENOENT') return 'missing';
    throw error;
  }
}

export const blockReason = found => (found === 'link' ? 'symbolic-link' : 'wrong-type');

export function privatePath(root) {
  return path.join(root, ...PRIVATE_PATH);
}

// state: present, missing, or blocked (a symbolic link or a non-folder on the way).
export async function inspectFolder(root) {
  let current = root;
  for (const segment of PRIVATE_PATH) {
    current = path.join(current, segment);
    const found = await kind(current);
    if (found === 'missing') {
      return { path: privatePath(root), state: 'missing' };
    }
    if (found !== 'directory') {
      return { path: privatePath(root), state: 'blocked', blocker: current, reason: blockReason(found) };
    }
  }
  return { path: privatePath(root), state: 'present' };
}

// True when root is the home folder or one of its parents. Private documents never live there: the home
// .docatlas holds install records and backups. path.relative compares without case on Windows.
export function isHomeOrAbove(root, home) {
  const relative = path.relative(root, home);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// files counts every entry git could see (files and links); documents counts Markdown files.
export async function countFiles(directory) {
  const count = { files: 0, documents: 0 };
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const inner = await countFiles(path.join(directory, entry.name));
      count.files += inner.files;
      count.documents += inner.documents;
    } else {
      count.files++;
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) count.documents++;
    }
  }
  return count;
}

// Lists the private folder for a backup: regular files to copy, and everything else (links, devices) to skip.
// Paths are relative to the folder, use /, and come in a fixed order.
export async function collectFiles(directory, prefix = '') {
  const found = { files: [], skipped: [] };
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) {
      const inner = await collectFiles(path.join(directory, entry.name), relative + '/');
      found.files.push(...inner.files);
      found.skipped.push(...inner.skipped);
    } else if (entry.isFile()) {
      found.files.push(relative);
    } else {
      found.skipped.push({ path: relative, reason: entry.isSymbolicLink() ? 'symbolic-link' : 'wrong-type' });
    }
  }
  return found;
}

// Reads info/exclude as bytes so text in any encoding survives. present: the pattern is already a line.
export async function readExclude(excludePath, pattern) {
  const parent = await kind(path.dirname(excludePath));
  if (parent !== 'missing' && parent !== 'directory') {
    return { path: excludePath, pattern, blocked: blockReason(parent), blocker: path.dirname(excludePath) };
  }
  const found = await kind(excludePath);
  if (found !== 'missing' && found !== 'file') {
    return { path: excludePath, pattern, blocked: blockReason(found), blocker: excludePath };
  }
  const content = found === 'file' ? await fs.readFile(excludePath) : Buffer.alloc(0);
  // Like git, ignore trailing spaces only; leading spaces belong to the pattern.
  const present = content.toString('latin1').split(/\r?\n/).some(line => line.replace(/ +$/, '') === pattern);
  return { path: excludePath, pattern, content, present, exists: found === 'file' };
}

// Appends a comment and the pattern after the existing bytes, keeping their line endings and the file mode.
export async function addExcludeLine(exclude) {
  const text = exclude.content.toString('latin1');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const separator = text && !text.endsWith('\n') ? eol : '';
  const next = Buffer.concat([exclude.content, Buffer.from(separator + EXCLUDE_COMMENT + eol + exclude.pattern + eol, 'utf8')]);
  const directory = path.dirname(exclude.path);
  await fs.mkdir(directory, { recursive: true });
  const mode = exclude.exists ? (await fs.stat(exclude.path)).mode & 0o7777 : undefined;
  const temporary = path.join(directory,
    '.' + path.basename(exclude.path) + '.docatlas-' + process.pid + '-' + crypto.randomBytes(4).toString('hex'));
  try {
    await fs.writeFile(temporary, next, { flag: 'wx' });
    if (mode !== undefined) await fs.chmod(temporary, mode);
    await fs.rename(temporary, exclude.path);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}
