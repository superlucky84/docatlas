import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { addExcludeLine, countFiles, inspectFolder, isHomeOrAbove, readExclude } from './folder.js';
import { isIgnored, locateRepository, trackedFiles } from './git.js';

export const PRIVATE_OPTIONS = {
  root: { type: 'string' },
  'dry-run': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' }
};

// Same numbers as docatlas agents. For private commands, NEEDS_DECISION means the user must look: init stopped
// before writing, or it wrote the exclude line but the folder is still visible to git.
export const EXIT = { OK: 0, FAILED: 1, USAGE: 2, NEEDS_DECISION: 3 };
export const STATUS_SUMMARIES = ['ok', 'empty', 'exposed', 'tracked', 'blocked', 'not-git'];

const NOT_GIT = 'This folder is not in a git repository, so there is nothing to hide the documents from.';
const HOME = 'This is the home folder or a folder above it. Run the command in a project folder.';
const MESSAGES = {
  blocked: 'A private path is a symbolic link or has the wrong type, or git could not read the repository\n' +
    '(run git status in that folder to see why). Show these lines to the user; nothing was written.\n',
  home: 'Private documents never go in the home folder or above it. Ask the user which project folder to use.\n',
  tracked: 'git already tracks files in .docatlas/private/. Show these lines to the user; nothing was written.\n',
  'not-ignored': 'Another ignore rule, such as a ! line in .gitignore, still shows the folder to git. Show this to the user.\n',
  exposed: 'Private files are not hidden from git. Run docatlas private init.\n'
};

export function privateHelp() {
  return [
    'docatlas private — documents only you see, in .docatlas/private/ at the project root', '',
    'Private documents live in <root>/.docatlas/private/<feature>/. Inside a git repository <root> is always',
    'the top folder of the repository, wherever you run the command. Outside git, <root> is the current',
    'folder (or --root), so run it from the project folder. <root> is never the home folder or above it.',
    'The private folder is hidden from git with .git/info/exclude, which applies only to this clone and',
    'is never committed, so others see no trace.',
    '<root>/.docatlas/agents.json, the project install record, stays visible and can be committed.', '',
    'For AI agents running this for a user:',
    '  1. Before writing private documents, run: docatlas private init',
    '     It creates the folder, adds it to .git/info/exclude when that line is missing, and checks',
    '     that git no longer sees the folder.',
    '  2. If a command exits with 3, show its lines to the user and stop. Do not stage, commit,',
    '     move or delete files, or change ignore files, to fix it yourself.',
    '  3. Never stage or commit files under .docatlas/private/, and never link to them from tracked files.',
    '  The command never asks questions. Read its output lines and exit code.', '',
    'Usage:',
    '  docatlas private init [--root <dir>] [--dry-run]',
    '  docatlas private status [--root <dir>]',
    '  docatlas private help', '',
    'Options:',
    '  --root <dir>   Folder to start from (default: current folder). Inside git, its repository top folder is used.',
    '  --dry-run      init only: print what would happen without writing.',
    '  -h, --help     Show this help.', '',
    'Output lines (tab-separated):',
    '  both    root <root, or the start folder when git could not be read>',
    '          blocked <reason> <path> [message]   reasons for both: home, not-work-tree, git-missing, git-error,',
    '                                              symbolic-link, wrong-type',
    '  init    blocked tracked <file>               git tracks this private file; nothing was written',
    '          blocked not-ignored <folder>         another ignore rule keeps the folder visible',
    '          <action> folder <path>',
    '          <action> exclude <exclude file> <pattern>',
    '          warning not-git - <message>',
    '          summary folder=<action> exclude=<action>',
    '          Actions: create, add, unchanged, skip. With --dry-run, action and summary lines start with dry-run.',
    '  status  folder <present|missing|blocked> <path>',
    '          documents <Markdown files>',
    '          files <all files>',
    '          git <repo|not-git> <top folder or ->',
    '          exclude <present|missing|blocked|skip> <exclude file or -> <pattern or ->',
    '          ignored <yes|no|->',
    '          tracked <count|->',
    '          summary <' + STATUS_SUMMARIES.join('|') + '>', '',
    'Exit codes:',
    '  0  Done, or nothing to do.',
    '  3  Needs the user. init stopped before writing (the home folder, tracked files, a symbolic link or',
    '     wrong type, or git could not be read), or git still sees the folder after the exclude line.',
    '     With --dry-run, 3 also means that git would still see the folder. status found private files',
    '     that git can see or tracks, or a blocked path.',
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

function writeBlocked(stdout, reason, filename, message) {
  stdout.write('blocked\t' + reason + '\t' + filename + (message ? '\t' + message : '') + '\n');
}

async function locate(start, { stdout, git, home }) {
  const location = await locateRepository(start, { git });
  const root = location.repo ? location.root : start;
  stdout.write('root\t' + root + '\n');
  if (location.blocked) {
    writeBlocked(stdout, location.blocked, start, location.message);
    return { location, root, blocked: location.blocked };
  }
  if (isHomeOrAbove(root, home)) {
    writeBlocked(stdout, 'home', root, HOME);
    return { location, root, blocked: 'home' };
  }
  return { location, root, blocked: null };
}

const blockedMessage = reason => (reason === 'home' ? MESSAGES.home : MESSAGES.blocked);

async function init(start, { stdout, stderr, git, home, dryRun }) {
  const { location, root, blocked } = await locate(start, { stdout, git, home });
  if (blocked) {
    stderr.write(blockedMessage(blocked));
    return EXIT.NEEDS_DECISION;
  }
  const folder = await inspectFolder(root);
  if (folder.state === 'blocked') {
    writeBlocked(stdout, folder.reason, folder.blocker);
    stderr.write(MESSAGES.blocked);
    return EXIT.NEEDS_DECISION;
  }
  let exclude = null;
  if (location.repo) {
    const tracked = await trackedFiles(root, { git });
    if (tracked.length) {
      for (const file of tracked) writeBlocked(stdout, 'tracked', file);
      stderr.write(MESSAGES.tracked);
      return EXIT.NEEDS_DECISION;
    }
    exclude = await readExclude(location.excludePath, location.pattern);
    if (exclude.blocked) {
      writeBlocked(stdout, exclude.blocked, exclude.blocker);
      stderr.write(MESSAGES.blocked);
      return EXIT.NEEDS_DECISION;
    }
  }
  const folderAction = folder.state === 'missing' ? 'create' : 'unchanged';
  const excludeAction = !location.repo ? 'skip' : exclude.present ? 'unchanged' : 'add';
  let visible = false;
  if (!dryRun) {
    if (folderAction === 'create') {
      const again = await inspectFolder(root);
      if (again.state === 'blocked') {
        writeBlocked(stdout, again.reason, again.blocker);
        stderr.write(MESSAGES.blocked);
        return EXIT.NEEDS_DECISION;
      }
      // Only this user can read new private documents on a shared computer.
      await fs.mkdir(path.dirname(folder.path), { recursive: true });
      await fs.mkdir(folder.path, { mode: 0o700 }).catch(error => {
        if (error.code !== 'EEXIST') throw error;
      });
    }
    if (excludeAction === 'add') await addExcludeLine(exclude);
    visible = location.repo && !(await isIgnored(root, { git }));
  } else if (excludeAction === 'unchanged') {
    // The pattern line is already there, so a dry run can tell whether git would still see the folder.
    visible = !(await isIgnored(root, { git }));
  }
  const prefix = dryRun ? 'dry-run\t' : '';
  stdout.write(prefix + folderAction + '\tfolder\t' + folder.path + '\n');
  stdout.write(prefix + excludeAction + '\texclude\t' + (exclude?.path ?? '-') + '\t' + (location.pattern ?? '-') + '\n');
  if (!location.repo) {
    stdout.write('warning\tnot-git\t-\t' + NOT_GIT + '\n');
  }
  if (visible) {
    writeBlocked(stdout, 'not-ignored', folder.path);
  }
  stdout.write(prefix + 'summary\tfolder=' + folderAction + '\texclude=' + excludeAction + '\n');
  if (visible) {
    stderr.write(MESSAGES['not-ignored']);
    return EXIT.NEEDS_DECISION;
  }
  return EXIT.OK;
}

async function status(start, { stdout, stderr, git, home }) {
  const { location, root, blocked } = await locate(start, { stdout, git, home });
  if (blocked) {
    stdout.write('summary\tblocked\n');
    stderr.write(blockedMessage(blocked));
    return EXIT.NEEDS_DECISION;
  }
  const folder = await inspectFolder(root);
  const count = folder.state === 'present' ? await countFiles(folder.path) : { files: 0, documents: 0 };
  const exclude = location.repo ? await readExclude(location.excludePath, location.pattern) : null;
  // git refuses paths beyond a symbolic link, so a blocked folder skips the git checks.
  const askGit = location.repo && folder.state !== 'blocked';
  const ignored = askGit ? await isIgnored(root, { git }) : null;
  const tracked = askGit ? await trackedFiles(root, { git }) : null;
  const state = folder.state === 'blocked' || exclude?.blocked ? 'blocked'
    : tracked?.length ? 'tracked'
      : !location.repo ? 'not-git'
        : !ignored && count.files ? 'exposed'
          : count.files ? 'ok' : 'empty';
  stdout.write('folder\t' + folder.state + '\t' + folder.path + '\n');
  stdout.write('documents\t' + count.documents + '\n');
  stdout.write('files\t' + count.files + '\n');
  stdout.write('git\t' + (location.repo ? 'repo' : 'not-git') + '\t' + (location.root ?? '-') + '\n');
  stdout.write('exclude\t' + (!location.repo ? 'skip' : exclude.blocked ? 'blocked' : exclude.present ? 'present' : 'missing') + '\t' +
    (exclude?.path ?? '-') + '\t' + (location.pattern ?? '-') + '\n');
  stdout.write('ignored\t' + (ignored === null ? '-' : ignored ? 'yes' : 'no') + '\n');
  stdout.write('tracked\t' + (tracked ? tracked.length : '-') + '\n');
  if (folder.state === 'blocked') writeBlocked(stdout, folder.reason, folder.blocker);
  if (exclude?.blocked) writeBlocked(stdout, exclude.blocked, exclude.blocker);
  stdout.write('summary\t' + state + '\n');
  if (state === 'exposed' && exclude.present) {
    stderr.write(MESSAGES['not-ignored']);
    return EXIT.NEEDS_DECISION;
  }
  if (['blocked', 'tracked', 'exposed'].includes(state)) {
    stderr.write(MESSAGES[state]);
    return EXIT.NEEDS_DECISION;
  }
  return EXIT.OK;
}

export async function runPrivate(args, {
  stdout = process.stdout, stderr = process.stderr, cwd = process.cwd(), git = 'git', home = os.homedir()
} = {}) {
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
  let start;
  try {
    start = await directory(path.resolve(cwd, values.root ?? '.'));
  } catch {
    return usage('Folder not found: ' + path.resolve(cwd, values.root ?? '.'));
  }
  const homeFolder = await fs.realpath(home).catch(() => path.resolve(home));
  try {
    return command === 'init'
      ? await init(start, { stdout, stderr, git, home: homeFolder, dryRun: values['dry-run'] === true })
      : await status(start, { stdout, stderr, git, home: homeFolder });
  } catch (error) {
    stderr.write('docatlas private ' + command + ' failed: ' + error.message + '\n');
    return EXIT.FAILED;
  }
}
