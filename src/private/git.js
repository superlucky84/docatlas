import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

// Read-only git queries. Inside a git work tree the private folder always belongs to the repository top folder.
// Queries run without repository variables such as GIT_DIR, which a git hook exports, so they cannot reach another
// repository. The only file this feature changes in .git is info/exclude, written by folder.js.

export const PATTERN = '/.docatlas/private/';
const REPOSITORY_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_NAMESPACE', 'GIT_PREFIX'];
// Errors that mean git could not be started at all, for example not on PATH or a PATH folder that cannot be read.
const NOT_STARTED = ['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR'];

function gitEnvironment() {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (REPOSITORY_VARIABLES.includes(name.toUpperCase())) delete env[name];
  }
  return env;
}

function runGit(cwd, args, git) {
  return new Promise(resolve => {
    execFile(git, args, { cwd, env: gitEnvironment(), encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => resolve({
        ok: !error,
        status: error ? (typeof error.code === 'number' ? error.code : null) : 0,
        missing: NOT_STARTED.includes(error?.code),
        stdout,
        message: String(stderr ?? '').split(/\r?\n/).find(Boolean) ?? ''
      }));
  });
}

async function exists(filename) {
  return fs.lstat(filename).then(() => true, () => false);
}

// The nearest folder at or above start that holds .git, stopping at GIT_CEILING_DIRECTORIES like git does.
async function gitMarker(start) {
  const ceilings = (process.env.GIT_CEILING_DIRECTORIES ?? '').split(path.delimiter).filter(Boolean).map(entry => path.resolve(entry));
  let current = start;
  for (;;) {
    if (await exists(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current || ceilings.includes(parent)) return null;
    current = parent;
  }
}

// repo: the work tree's top folder and its info/exclude file.
// Not a repository: { repo: false, reason: 'not-git' }. Cannot tell: { repo: false, blocked, message }.
export async function locateRepository(start, { git = 'git' } = {}) {
  const result = await runGit(start, ['rev-parse', '--is-inside-work-tree', '--show-toplevel', '--git-path', 'info/exclude'], git);
  if (result.ok) {
    const [inside, top, exclude] = result.stdout.split(/\r?\n/);
    if (inside !== 'true' || !top || !exclude) {
      return { repo: false, blocked: 'not-work-tree', message: 'This folder is inside .git or a bare repository, not a work tree.' };
    }
    return { repo: true, root: await fs.realpath(top), excludePath: path.resolve(start, exclude), pattern: PATTERN };
  }
  if (!(await gitMarker(start))) {
    return { repo: false, reason: 'not-git' };
  }
  return result.missing
    ? { repo: false, blocked: 'git-missing', message: 'git could not be started, but this folder is in a git repository.' }
    : { repo: false, blocked: 'git-error', message: result.message || 'git could not read this repository.' };
}

// True when any git ignore source (.gitignore, info/exclude, global excludes) hides the private folder.
export async function isIgnored(root, { git = 'git' } = {}) {
  const result = await runGit(root, ['check-ignore', '-q', '--', '.docatlas/private/'], git);
  if (result.status === 0 || result.status === 1) return result.status === 0;
  throw new Error('git check-ignore failed: ' + (result.message || 'unknown error'));
}

export async function trackedFiles(root, { git = 'git' } = {}) {
  const result = await runGit(root, ['ls-files', '-z', '--', '.docatlas/private'], git);
  if (!result.ok) throw new Error('git ls-files failed: ' + (result.message || 'unknown error'));
  return result.stdout.split('\0').filter(Boolean);
}
