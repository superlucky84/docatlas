import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

// Read-only git queries run in the project root. The only file this module changes is info/exclude (see exclude.js).

function runGit(root, args, git) {
  return new Promise(resolve => {
    execFile(git, args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => resolve({ ok: !error, missing: error?.code === 'ENOENT', stdout }));
  });
}

// Escapes gitignore pattern characters in a folder path so the line matches it literally.
function literal(segment) {
  return segment.replace(/[\\*?[\]]/g, '\\$&');
}

export async function inspectGit(root, { git = 'git' } = {}) {
  const top = await runGit(root, ['rev-parse', '--show-toplevel'], git);
  if (!top.ok) {
    return { repo: false, reason: top.missing ? 'git-missing' : 'not-git' };
  }
  const exclude = await runGit(root, ['rev-parse', '--git-path', 'info/exclude'], git);
  if (!exclude.ok) {
    return { repo: false, reason: 'not-git' };
  }
  const topLevel = await fs.realpath(top.stdout.trim());
  const relative = path.relative(topLevel, root).split(path.sep).filter(Boolean).map(literal).join('/');
  return {
    repo: true,
    top: topLevel,
    excludePath: path.resolve(root, exclude.stdout.trim()),
    pattern: '/' + (relative ? relative + '/' : '') + '.docatlas/private/'
  };
}

// True when any git ignore source (info/exclude, .gitignore, global excludes) hides the private folder.
export async function isIgnored(root, { git = 'git' } = {}) {
  return (await runGit(root, ['check-ignore', '-q', '--', '.docatlas/private/'], git)).ok;
}

export async function trackedFiles(root, { git = 'git' } = {}) {
  const result = await runGit(root, ['ls-files', '-z', '--', '.docatlas/private'], git);
  return result.ok ? result.stdout.split('\0').filter(Boolean) : [];
}
