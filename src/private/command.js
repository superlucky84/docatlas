import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { addExcludeLine, countDocuments, inspectFolder, readExclude } from './folder.js';
import { inspectGit, isIgnored, trackedFiles } from './git.js';

export const PRIVATE_OPTIONS = {
  root: { type: 'string' },
  'dry-run': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' }
};

// Same exit codes as docatlas agents. NEEDS_DECISION means something the user must look at.
export const EXIT = { OK: 0, FAILED: 1, USAGE: 2, NEEDS_DECISION: 3 };

const GIT_WARNINGS = {
  'not-git': 'This folder is not in a git repository, so there is nothing to hide the documents from.',
  'git-missing': 'git was not found, so the documents could not be hidden. Install git and run init again.'
};

export function privateHelp() {
  return [
    'docatlas private — documents only you see, in .docatlas/private/ at the project root', '',
    'Private documents live in <root>/.docatlas/private/<feature>/. They are hidden from git with',
    '.git/info/exclude, which applies only to this clone and is never committed, so others see no trace.',
    '<root>/.docatlas/agents.json, the project install record, stays visible and can be committed.', '',
    'For AI agents running this for a user:',
    '  1. Before writing private documents, run: docatlas private init',
    '     It creates the folder and adds the folder to .git/info/exclude when it is missing there.',
    '  2. If a command exits with 3, show its lines to the user and stop. Do not stage, commit,',
    '     move or delete files to fix it yourself.',
    '  3. Never stage or commit files under .docatlas/private/, and never link to them from tracked files.',
    '  The command never asks questions. Read its output lines and exit code.', '',
    'Usage:',
    '  docatlas private init [--root <dir>] [--dry-run]',
    '  docatlas private status [--root <dir>]',
    '  docatlas private help', '',
    'Options:',
    '  --root <dir>   Project root (default: current folder).',
    '  --dry-run      init only: print what would happen without writing.',
    '  -h, --help     Show this help.', '',
    'Output lines (tab-separated):',
    '  init    <action> folder <path>',
    '          <action> exclude <exclude file> <pattern>',
    '          blocked <reason> <path>',
    '          warning <code> - <message>',
    '          summary folder=<action> exclude=<action>',
    '          Actions: create, add, unchanged, skip. With --dry-run, action and summary lines start with dry-run.',
    '  status  folder <present|missing|blocked> <path>',
    '          documents <count>',
    '          git <repo|not-git|git-missing> <top folder or ->',
    '          exclude <present|missing|skip> <exclude file or -> <pattern or ->',
    '          ignored <yes|no|->',
    '          tracked <count>',
    '          summary <ok|empty|exposed|tracked|blocked|not-git>', '',
    'Exit codes:',
    '  0  Done, or nothing to do.',
    '  3  Needs the user: private files are tracked by git, documents are not hidden, or a path is a',
    '     symbolic link or not a folder.',
    '  1  Failed.',
    '  2  Invalid arguments.', ''
  ].join('\n');
}

async function directory(filename) {
  const resolved = await fs.realpath(filename);
  if (!(await fs.stat(resolved)).isDirectory()) {
    throw new Error('not a directory');
  }
  return resolved;
}

function blocked(stdout, reason, filename) {
  stdout.write('blocked\t' + reason + '\t' + filename + '\n');
}

async function init(root, { stdout, stderr, git, dryRun }) {
  const folder = await inspectFolder(root);
  if (folder.state === 'blocked') {
    blocked(stdout, folder.reason, folder.blocker);
    stderr.write('The private folder path is a symbolic link or not a folder. Show this to the user; nothing was written.\n');
    return EXIT.NEEDS_DECISION;
  }
  const repo = await inspectGit(root, { git });
  let exclude = null;
  if (repo.repo) {
    const tracked = await trackedFiles(root, { git });
    if (tracked.length) {
      for (const file of tracked) blocked(stdout, 'tracked', file);
      stderr.write('git already tracks files in .docatlas/private/. Show these to the user; nothing was written.\n');
      return EXIT.NEEDS_DECISION;
    }
    exclude = await readExclude(repo.excludePath, repo.pattern);
    if (exclude.blocked) {
      blocked(stdout, exclude.blocked, exclude.path);
      stderr.write('The git exclude file is a symbolic link or not a file. Show this to the user; nothing was written.\n');
      return EXIT.NEEDS_DECISION;
    }
  }
  const folderAction = folder.state === 'missing' ? 'create' : 'unchanged';
  const excludeAction = !repo.repo ? 'skip' : exclude.present ? 'unchanged' : 'add';
  if (!dryRun) {
    if (folderAction === 'create') await fs.mkdir(folder.path, { recursive: true });
    if (excludeAction === 'add') await addExcludeLine(exclude);
  }
  const prefix = dryRun ? 'dry-run\t' : '';
  stdout.write(prefix + folderAction + '\tfolder\t' + folder.path + '\n');
  stdout.write(prefix + excludeAction + '\texclude\t' + (exclude?.path ?? '-') + '\t' + (repo.pattern ?? '-') + '\n');
  if (!repo.repo) {
    stdout.write('warning\t' + repo.reason + '\t-\t' + GIT_WARNINGS[repo.reason] + '\n');
  }
  stdout.write(prefix + 'summary\tfolder=' + folderAction + '\texclude=' + excludeAction + '\n');
  return EXIT.OK;
}

async function status(root, { stdout, stderr, git }) {
  const folder = await inspectFolder(root);
  const documents = folder.state === 'present' ? await countDocuments(folder.path) : 0;
  const repo = await inspectGit(root, { git });
  const exclude = repo.repo ? await readExclude(repo.excludePath, repo.pattern) : null;
  const ignored = repo.repo ? await isIgnored(root, { git }) : null;
  const tracked = repo.repo ? await trackedFiles(root, { git }) : [];
  const state = folder.state === 'blocked' || exclude?.blocked ? 'blocked'
    : tracked.length ? 'tracked'
      : !repo.repo ? 'not-git'
        : !ignored && documents ? 'exposed'
          : documents ? 'ok' : 'empty';
  stdout.write('folder\t' + folder.state + '\t' + folder.path + '\n');
  stdout.write('documents\t' + documents + '\n');
  stdout.write('git\t' + (repo.repo ? 'repo' : repo.reason) + '\t' + (repo.top ?? '-') + '\n');
  stdout.write('exclude\t' + (!repo.repo ? 'skip' : exclude.blocked ? 'blocked' : exclude.present ? 'present' : 'missing') + '\t' +
    (exclude?.path ?? '-') + '\t' + (repo.pattern ?? '-') + '\n');
  stdout.write('ignored\t' + (ignored === null ? '-' : ignored ? 'yes' : 'no') + '\n');
  stdout.write('tracked\t' + tracked.length + '\n');
  stdout.write('summary\t' + state + '\n');
  if (['blocked', 'tracked', 'exposed'].includes(state)) {
    stderr.write({
      blocked: 'A private path is a symbolic link or has the wrong type. Show this to the user.\n',
      tracked: 'git tracks files in .docatlas/private/. Show this to the user before anything else.\n',
      exposed: 'Private documents are not hidden from git. Run docatlas private init.\n'
    }[state]);
    return EXIT.NEEDS_DECISION;
  }
  return EXIT.OK;
}

export async function runPrivate(args, { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd(), git = 'git' } = {}) {
  const usage = message => {
    stderr.write(message + '\nRun docatlas private help for usage.\n');
    return EXIT.USAGE;
  };
  const [command, ...rest] = args;
  if (command === 'help' || command === '--help' || command === '-h') {
    stdout.write(privateHelp());
    return EXIT.OK;
  }
  if (command !== 'init' && command !== 'status') {
    return usage(command ? 'Unknown private command: ' + command : 'Missing private command.');
  }
  let values;
  try {
    ({ values } = parseArgs({ args: rest, allowPositionals: false, strict: true, options: PRIVATE_OPTIONS }));
  } catch (error) {
    return usage(error.message);
  }
  if (values.help) {
    stdout.write(privateHelp());
    return EXIT.OK;
  }
  if (command === 'status' && values['dry-run']) {
    return usage('--dry-run applies only to init.');
  }
  let root;
  try {
    root = await directory(path.resolve(cwd, values.root ?? '.'));
  } catch {
    return usage('Project root not found: ' + path.resolve(cwd, values.root ?? '.'));
  }
  try {
    return command === 'init'
      ? await init(root, { stdout, stderr, git, dryRun: values['dry-run'] === true })
      : await status(root, { stdout, stderr, git });
  } catch (error) {
    stderr.write('docatlas private ' + command + ' failed: ' + error.message + '\n');
    return EXIT.FAILED;
  }
}
