import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// The private folder is <root>/.docatlas/private. Symbolic links are never followed or written through.
export const PRIVATE_PATH = ['.docatlas', 'private'];
export const EXCLUDE_COMMENT = '# docatlas private documents (docatlas private init)';

async function kind(filename) {
  try {
    const stat = await fs.lstat(filename);
    if (stat.isSymbolicLink()) return 'link';
    return stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other';
  } catch (error) {
    if (error.code === 'ENOENT') return 'missing';
    throw error;
  }
}

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
      return { path: privatePath(root), state: 'blocked', blocker: current, reason: found === 'link' ? 'symbolic-link' : 'not-a-folder' };
    }
  }
  return { path: privatePath(root), state: 'present' };
}

export async function countDocuments(directory) {
  let count = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += await countDocuments(path.join(directory, entry.name));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      count++;
    }
  }
  return count;
}

// Reads info/exclude without changing it. present is true when the private pattern is already a line.
export async function readExclude(excludePath, pattern) {
  const found = await kind(excludePath);
  if (found !== 'missing' && found !== 'file') {
    return { path: excludePath, pattern, blocked: found === 'link' ? 'symbolic-link' : 'not-a-file' };
  }
  const content = found === 'file' ? await fs.readFile(excludePath, 'utf8') : '';
  const present = content.split(/\r?\n/).some(line => line.trim() === pattern);
  return { path: excludePath, pattern, content, present, exists: found === 'file' };
}

// Appends the pattern with a comment, keeping the existing text, line endings and file mode.
export async function addExcludeLine(exclude) {
  const eol = exclude.content.includes('\r\n') ? '\r\n' : '\n';
  const separator = exclude.content && !exclude.content.endsWith('\n') ? eol : '';
  const next = exclude.content + separator + EXCLUDE_COMMENT + eol + exclude.pattern + eol;
  await fs.mkdir(path.dirname(exclude.path), { recursive: true });
  const mode = exclude.exists ? (await fs.stat(exclude.path)).mode & 0o7777 : undefined;
  const temporary = path.join(path.dirname(exclude.path),
    '.' + path.basename(exclude.path) + '.docatlas-' + process.pid + '-' + crypto.randomBytes(4).toString('hex'));
  try {
    await fs.writeFile(temporary, next, { flag: 'wx', ...(mode === undefined ? {} : { mode }) });
    await fs.rename(temporary, exclude.path);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}
