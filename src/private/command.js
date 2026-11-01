import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { addExcludeLine, collectFiles, countFiles, inspectFolder, isHomeOrAbove, readExclude } from './folder.js';
import { headCommit, isIgnored, locateRepository, trackedFiles } from './git.js';
import { parseKey, projectKey } from './key.js';
import { applyRestore, planRestore } from './restore.js';
import {
  inspectStore, isBackupName, latestRegular, listBackups, readBackup, readEntries, sameFiles, writeBackup
} from './store.js';

export const PRIVATE_OPTIONS = {
  root: { type: 'string' },
  key: { type: 'string' },
  from: { type: 'string' },
  force: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' }
};
export const PRIVATE_COMMANDS = ['init', 'status', 'backup', 'list', 'restore'];
// Options that only some commands take. --root and --help work everywhere.
const OPTION_COMMANDS = { 'dry-run': ['init', 'restore'], key: ['backup', 'list', 'restore'], from: ['restore'], force: ['restore'] };

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
  exposed: 'Private files are not hidden from git. Run docatlas private init.\n',
  'no-origin': 'This project has no origin remote, so its backups use a local key. A new clone will need --key.',
  'no-files': 'There are no private files to back up.\n',
  missing: 'No backup was found. Run docatlas private list, or ask the user for --key or --from.\n',
  damaged: 'The backup is damaged or incomplete, so nothing was written. Show this to the user;\n' +
    'an older backup can be chosen with --from.\n',
  conflict: 'Files that differ from the backup were kept (conflict lines). Show them to the user. Only if the user\n' +
    'agrees, run the same command with --force; it backs up the current files first.\n',
  'file-blocked': 'Some backup files were not restored because a path is a symbolic link or not a folder\n' +
    '(blocked lines). Show these lines to the user.\n'
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
    'Backups are copies outside the project, in ~/.docatlas/private-backups/<key>/<UTC time>/. The key comes',
    'from the origin remote (for example github.com/owner/repo), so a new clone of the same repository finds',
    'them. Without an origin the key is local/<folder name>; use --key to choose one. Backups are never deleted.', '',
    'For AI agents running this for a user:',
    '  1. Before writing private documents, run: docatlas private init',
    '     It creates the folder, adds it to .git/info/exclude when that line is missing, and checks',
    '     that git no longer sees the folder.',
    '  2. After changing private documents, or when the user asks for a backup, run: docatlas private backup',
    '  3. To restore, for example in a new clone: run docatlas private restore --dry-run, show the lines to',
    '     the user, and run docatlas private restore after they agree. Restore never overwrites a file that',
    '     differs (conflict). Use --force only when the user asks for it; it backs up the current files first.',
    '  4. If a command exits with 3, show its lines to the user and stop. Do not stage, commit,',
    '     move or delete files, or change ignore files, to fix it yourself.',
    '  5. Never stage or commit files under .docatlas/private/, and never link to them from tracked files.',
    '  The command never asks questions. Read its output lines and exit code.', '',
    'Usage:',
    '  docatlas private init [--root <dir>] [--dry-run]',
    '  docatlas private status [--root <dir>]',
    '  docatlas private backup [--root <dir>] [--key <key>]',
    '  docatlas private list [--root <dir>] [--key <key>]',
    '  docatlas private restore [--root <dir>] [--key <key>] [--from <backup>] [--dry-run] [--force]',
    '  docatlas private help', '',
    'Options:',
    '  --root <dir>      Folder to start from (default: current folder). Inside git, its repository top folder is used.',
    '  --key <key>       backup, list, restore: backup key instead of the one from origin, such as github.com/owner/repo.',
    '                    Parts joined by /, without spaces or characters that Windows does not allow in folder names.',
    '  --from <backup>   restore: backup name from list (default: the newest backup made by the backup command).',
    '  --force           restore: back up the current files, then overwrite files that differ.',
    '  --dry-run         init, restore: print what would happen without writing.',
    '  -h, --help        Show this help.', '',
    'Output lines (tab-separated):',
    '  all      root <root, or the start folder when git could not be read>',
    '           blocked <reason> <path> [message]   reasons for all: home, not-work-tree, git-missing, git-error,',
    '                                               symbolic-link, wrong-type',
    '  init     blocked tracked <file>               git tracks this private file; nothing was written',
    '           blocked not-ignored <folder>         another ignore rule keeps the folder visible',
    '           <action> folder <path>',
    '           <action> exclude <exclude file> <pattern>',
    '           warning not-git - <message>',
    '           summary folder=<action> exclude=<action>',
    '           Actions: create, add, unchanged, skip. With --dry-run, action and summary lines start with dry-run.',
    '  status   folder <present|missing|blocked> <path>',
    '           documents <Markdown files>',
    '           files <all files>',
    '           git <repo|not-git> <top folder or ->',
    '           exclude <present|missing|blocked|skip> <exclude file or -> <pattern or ->',
    '           ignored <yes|no|->',
    '           tracked <count|->',
    '           backup <same|changed|none|unknown> <newest backup or ->',
    '           summary <' + STATUS_SUMMARIES.join('|') + '>',
    '  backup, list, restore',
    '           key <key> <origin|local|option>',
    '           store <backup folder for the key>',
    '           warning no-origin - <message>',
    '  backup   warning <symbolic-link|wrong-type> <path>   not copied',
    '           <create|unchanged|skip> backup <backup folder or ->   unchanged: the newest backup has the same files',
    '           summary backup=<action> files=<count>',
    '  list     backup <name> <created> <files> <backup|before-restore> <commit or ->   newest first',
    '           warning invalid-backup <folder>',
    '           summary backups=<count>',
    '  restore  missing backup <folder>                no backup to restore; nothing was written',
    '           blocked damaged <path>                 a backup file is missing or changed; nothing was written',
    '           blocked invalid-backup <folder>        the backup has no readable manifest; nothing was written',
    '           from <name> <created> <files> <backup|before-restore>',
    '           init lines for the folder and the exclude file, then:',
    '           create backup <folder>                 --force: the current files, saved before overwriting',
    '           <create|unchanged|conflict|overwrite> file <path>',
    '           blocked <symbolic-link|wrong-type> <path>',
    '           summary create=<n> unchanged=<n> conflict=<n> overwrite=<n> blocked=<n>',
    '           conflict: the file differs and was kept. With --dry-run, action and summary lines start with dry-run.', '',
    'Exit codes:',
    '  0  Done, or nothing to do.',
    '  3  Needs the user. init, backup or restore stopped before writing (the home folder, tracked files, a',
    '     symbolic link or wrong type, git could not be read, or no usable backup), or git still sees the',
    '     folder after the exclude line. restore also exits 3 after restoring the other files when conflict',
    '     or blocked files remain. With --dry-run, 3 means that the real run would exit 3. status found',
    '     private files that git can see or tracks, or a blocked path.',
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
const rootRelative = relative => '.docatlas/private/' + relative;

// The checks init and restore make before writing. Returns { folder, exclude }, or null after printing why it stopped.
async function checkBeforeWriting(root, location, { stdout, stderr, git }) {
  const folder = await inspectFolder(root);
  if (folder.state === 'blocked') {
    writeBlocked(stdout, folder.reason, folder.blocker);
    stderr.write(MESSAGES.blocked);
    return null;
  }
  let exclude = null;
  if (location.repo) {
    const tracked = await trackedFiles(root, { git });
    if (tracked.length) {
      for (const file of tracked) writeBlocked(stdout, 'tracked', file);
      stderr.write(MESSAGES.tracked);
      return null;
    }
    exclude = await readExclude(location.excludePath, location.pattern);
    if (exclude.blocked) {
      writeBlocked(stdout, exclude.blocked, exclude.blocker);
      stderr.write(MESSAGES.blocked);
      return null;
    }
  }
  return {
    folder, exclude,
    folderAction: folder.state === 'missing' ? 'create' : 'unchanged',
    excludeAction: !location.repo ? 'skip' : exclude.present ? 'unchanged' : 'add'
  };
}

// Creates the folder and adds the exclude line, then asks git whether the folder is hidden.
// Returns { visible }, or { blocked } when the path changed into a link since the check.
async function hide(root, location, { folder, exclude, folderAction, excludeAction }, { git }) {
  if (folderAction === 'create') {
    const again = await inspectFolder(root);
    if (again.state === 'blocked') return { blocked: again };
    // Only this user can read new private documents on a shared computer.
    await fs.mkdir(path.dirname(folder.path), { recursive: true });
    await fs.mkdir(folder.path, { mode: 0o700 }).catch(error => {
      if (error.code !== 'EEXIST') throw error;
    });
  }
  if (excludeAction === 'add') await addExcludeLine(exclude);
  return { visible: location.repo && !(await isIgnored(root, { git })) };
}

// The pattern line is already there, so a dry run can tell whether git would still see the folder.
const predictVisible = async (root, { excludeAction }, { git }) =>
  excludeAction === 'unchanged' && !(await isIgnored(root, { git }));

function writeHiding(stdout, prefix, location, { folder, exclude, folderAction, excludeAction }) {
  stdout.write(prefix + folderAction + '\tfolder\t' + folder.path + '\n');
  stdout.write(prefix + excludeAction + '\texclude\t' + (exclude?.path ?? '-') + '\t' + (location.pattern ?? '-') + '\n');
  if (!location.repo) {
    stdout.write('warning\tnot-git\t-\t' + NOT_GIT + '\n');
  }
}

async function init(start, { stdout, stderr, git, home, dryRun }) {
  const { location, root, blocked } = await locate(start, { stdout, git, home });
  if (blocked) {
    stderr.write(blockedMessage(blocked));
    return EXIT.NEEDS_DECISION;
  }
  const checked = await checkBeforeWriting(root, location, { stdout, stderr, git });
  if (!checked) return EXIT.NEEDS_DECISION;
  let visible = false;
  if (!dryRun) {
    const hidden = await hide(root, location, checked, { git });
    if (hidden.blocked) {
      writeBlocked(stdout, hidden.blocked.reason, hidden.blocked.blocker);
      stderr.write(MESSAGES.blocked);
      return EXIT.NEEDS_DECISION;
    }
    visible = hidden.visible;
  } else {
    visible = await predictVisible(root, checked, { git });
  }
  const prefix = dryRun ? 'dry-run\t' : '';
  writeHiding(stdout, prefix, location, checked);
  if (visible) {
    writeBlocked(stdout, 'not-ignored', checked.folder.path);
  }
  stdout.write(prefix + 'summary\tfolder=' + checked.folderAction + '\texclude=' + checked.excludeAction + '\n');
  if (visible) {
    stderr.write(MESSAGES['not-ignored']);
    return EXIT.NEEDS_DECISION;
  }
  return EXIT.OK;
}

// Prints the key and store lines. Returns the store, or null after printing a blocked store path.
async function openStore(root, location, { stdout, stderr, git, home, key }) {
  const chosen = await projectKey(root, location, { git, key });
  stdout.write('key\t' + chosen.key + '\t' + chosen.source + '\n');
  const store = await inspectStore(home, chosen.key);
  stdout.write('store\t' + store.path + '\n');
  if (chosen.source === 'local') {
    stdout.write('warning\tno-origin\t-\t' + MESSAGES['no-origin'] + '\n');
  }
  if (store.state === 'blocked') {
    writeBlocked(stdout, store.reason, store.blocker);
    stderr.write(MESSAGES.blocked);
    return null;
  }
  return { ...store, key: chosen.key };
}

// Compares the private folder with the newest regular backup: same, changed, none, or unknown.
async function backupState(root, location, folder, { git, home }) {
  try {
    const { key } = await projectKey(root, location, { git });
    const store = await inspectStore(home, key);
    if (store.state === 'blocked' || folder.state === 'blocked') return { state: 'unknown', name: null };
    const latest = latestRegular((await listBackups(store.path)).backups);
    if (!latest) return { state: 'none', name: null };
    const files = folder.state === 'present' ? (await collectFiles(folder.path)).files : [];
    const entries = await readEntries(folder.path, files);
    return { state: sameFiles(latest, entries) ? 'same' : 'changed', name: latest.name };
  } catch {
    return { state: 'unknown', name: null };
  }
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
  const backup = await backupState(root, location, folder, { git, home });
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
  stdout.write('backup\t' + backup.state + '\t' + (backup.name ?? '-') + '\n');
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

// Reads every regular file in the private folder. Links and other types are reported and left out.
async function readPrivateFiles(folder, stdout) {
  if (folder.state !== 'present') return [];
  const { files, skipped } = await collectFiles(folder.path);
  for (const entry of skipped) {
    stdout.write('warning\t' + entry.reason + '\t' + rootRelative(entry.path) + '\n');
  }
  return readEntries(folder.path, files);
}

async function backup(start, { stdout, stderr, git, home, key, now }) {
  const { location, root, blocked } = await locate(start, { stdout, git, home });
  if (blocked) {
    stderr.write(blockedMessage(blocked));
    return EXIT.NEEDS_DECISION;
  }
  const store = await openStore(root, location, { stdout, stderr, git, home, key });
  if (!store) return EXIT.NEEDS_DECISION;
  const folder = await inspectFolder(root);
  if (folder.state === 'blocked') {
    writeBlocked(stdout, folder.reason, folder.blocker);
    stderr.write(MESSAGES.blocked);
    return EXIT.NEEDS_DECISION;
  }
  const entries = await readPrivateFiles(folder, stdout);
  // Files read through a folder that became a link while reading are not this project's files.
  const again = await inspectFolder(root);
  if (again.state === 'blocked') {
    writeBlocked(stdout, again.reason, again.blocker);
    stderr.write(MESSAGES.blocked);
    return EXIT.NEEDS_DECISION;
  }
  if (!entries.length) {
    stdout.write('skip\tbackup\t-\n');
    stdout.write('summary\tbackup=skip\tfiles=0\n');
    stderr.write(MESSAGES['no-files']);
    return EXIT.OK;
  }
  const latest = latestRegular((await listBackups(store.path)).backups);
  if (sameFiles(latest, entries)) {
    stdout.write('unchanged\tbackup\t' + latest.path + '\n');
    stdout.write('summary\tbackup=unchanged\tfiles=' + entries.length + '\n');
    return EXIT.OK;
  }
  const commit = location.repo ? await headCommit(root, { git }) : null;
  const written = await writeBackup({ home, key: store.key, entries, reason: 'backup', root, commit, now });
  if (written.blocked) {
    writeBlocked(stdout, written.blocked.reason, written.blocked.blocker);
    stderr.write(MESSAGES.blocked);
    return EXIT.NEEDS_DECISION;
  }
  stdout.write('create\tbackup\t' + written.path + '\n');
  stdout.write('summary\tbackup=create\tfiles=' + entries.length + '\n');
  return EXIT.OK;
}

async function list(start, { stdout, stderr, git, home, key }) {
  const { location, root, blocked } = await locate(start, { stdout, git, home });
  if (blocked) {
    stderr.write(blockedMessage(blocked));
    return EXIT.NEEDS_DECISION;
  }
  const store = await openStore(root, location, { stdout, stderr, git, home, key });
  if (!store) return EXIT.NEEDS_DECISION;
  const { backups, invalid } = await listBackups(store.path);
  for (const entry of backups) {
    stdout.write(['backup', entry.name, entry.createdAt, entry.files.length, entry.reason, entry.commit ?? '-'].join('\t') + '\n');
  }
  for (const folder of invalid) {
    stdout.write('warning\tinvalid-backup\t' + folder + '\n');
  }
  stdout.write('summary\tbackups=' + backups.length + '\n');
  return EXIT.OK;
}

async function restore(start, { stdout, stderr, git, home, key, from, force, dryRun, now }) {
  const { location, root, blocked } = await locate(start, { stdout, git, home });
  if (blocked) {
    stderr.write(blockedMessage(blocked));
    return EXIT.NEEDS_DECISION;
  }
  const store = await openStore(root, location, { stdout, stderr, git, home, key });
  if (!store) return EXIT.NEEDS_DECISION;
  const checked = await checkBeforeWriting(root, location, { stdout, stderr, git });
  if (!checked) return EXIT.NEEDS_DECISION;
  const { backups, invalid } = await listBackups(store.path);
  const chosen = from ? backups.find(entry => entry.name === from) : latestRegular(backups);
  if (!chosen) {
    const wanted = from ? path.join(store.path, from) : store.path;
    if (from && invalid.includes(wanted)) {
      writeBlocked(stdout, 'invalid-backup', wanted);
      stderr.write(MESSAGES.damaged);
    } else {
      stdout.write('missing\tbackup\t' + wanted + '\n');
      stderr.write(MESSAGES.missing);
    }
    return EXIT.NEEDS_DECISION;
  }
  stdout.write(['from', chosen.name, chosen.createdAt, chosen.files.length, chosen.reason].join('\t') + '\n');
  const read = await readBackup(chosen);
  if (read.damaged) {
    writeBlocked(stdout, 'damaged', path.join(chosen.path, 'files', ...read.damaged.split('/')));
    stderr.write(MESSAGES.damaged);
    return EXIT.NEEDS_DECISION;
  }
  const plan = await planRestore(checked.folder.path, read.files);
  const conflicts = plan.some(item => item.action === 'conflict');
  if (force) {
    for (const item of plan) if (item.action === 'conflict') item.action = 'overwrite';
  }
  const prefix = dryRun ? 'dry-run\t' : '';
  let visible;
  if (dryRun) {
    visible = await predictVisible(root, checked, { git });
  } else {
    const hidden = await hide(root, location, checked, { git });
    if (hidden.blocked) {
      writeBlocked(stdout, hidden.blocked.reason, hidden.blocked.blocker);
      stderr.write(MESSAGES.blocked);
      return EXIT.NEEDS_DECISION;
    }
    visible = hidden.visible;
  }
  writeHiding(stdout, prefix, location, checked);
  if (visible) {
    writeBlocked(stdout, 'not-ignored', checked.folder.path);
    if (!dryRun) {
      // Files are written only into a folder git cannot see.
      stdout.write('summary\tcreate=0\tunchanged=0\tconflict=0\toverwrite=0\tblocked=0\n');
      stderr.write(MESSAGES['not-ignored']);
      return EXIT.NEEDS_DECISION;
    }
  }
  if (!dryRun) {
    // The folder may have changed since the check; never write through a link.
    const again = await inspectFolder(root);
    if (again.state === 'blocked') {
      writeBlocked(stdout, again.reason, again.blocker);
      stderr.write(MESSAGES.blocked);
      return EXIT.NEEDS_DECISION;
    }
  }
  if (force && conflicts) {
    if (dryRun) {
      stdout.write('dry-run\tcreate\tbackup\t-\n');
    } else {
      const entries = await readPrivateFiles(await inspectFolder(root), stdout);
      const commit = location.repo ? await headCommit(root, { git }) : null;
      const saved = await writeBackup({ home, key: store.key, entries, reason: 'before-restore', root, commit, now });
      if (saved.blocked) {
        writeBlocked(stdout, saved.blocked.reason, saved.blocked.blocker);
        stderr.write(MESSAGES.blocked);
        return EXIT.NEEDS_DECISION;
      }
      stdout.write('create\tbackup\t' + saved.path + '\n');
    }
  }
  if (!dryRun) await applyRestore(checked.folder.path, plan);
  const counts = { create: 0, unchanged: 0, conflict: 0, overwrite: 0, blocked: 0 };
  for (const item of plan) {
    counts[item.action]++;
    stdout.write(item.action === 'blocked'
      ? 'blocked\t' + item.reason + '\t' + rootRelative(item.path) + '\n'
      : prefix + item.action + '\tfile\t' + rootRelative(item.path) + '\n');
  }
  stdout.write(prefix + 'summary\t' + Object.entries(counts).map(([name, count]) => name + '=' + count).join('\t') + '\n');
  if (visible) stderr.write(MESSAGES['not-ignored']);
  if (counts.conflict) stderr.write(MESSAGES.conflict);
  if (counts.blocked) stderr.write(MESSAGES['file-blocked']);
  return visible || counts.conflict || counts.blocked ? EXIT.NEEDS_DECISION : EXIT.OK;
}

const COMMANDS = { init, status, backup, list, restore };

export async function runPrivate(args, {
  stdout = process.stdout, stderr = process.stderr, cwd = process.cwd(), git = 'git', home = os.homedir(), now
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
  if (!PRIVATE_COMMANDS.includes(command)) {
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
  for (const [option, commands] of Object.entries(OPTION_COMMANDS)) {
    if (values[option] !== undefined && !commands.includes(command)) {
      return usage('--' + option + ' applies only to ' + commands.join(', ') + '.');
    }
  }
  const key = values.key === undefined ? undefined : parseKey(values.key);
  if (key === null) {
    return usage('Invalid --key: ' + values.key);
  }
  if (values.from !== undefined && !isBackupName(values.from)) {
    return usage('Invalid --from: ' + values.from + ' (use a backup name from docatlas private list).');
  }
  let start;
  try {
    start = await directory(path.resolve(cwd, values.root ?? '.'));
  } catch {
    return usage('Folder not found: ' + path.resolve(cwd, values.root ?? '.'));
  }
  const homeFolder = await fs.realpath(home).catch(() => path.resolve(home));
  try {
    return await COMMANDS[command](start, {
      stdout, stderr, git, home: homeFolder, key, from: values.from, force: values.force === true,
      dryRun: values['dry-run'] === true, now: now ?? new Date()
    });
  } catch (error) {
    stderr.write('docatlas private ' + command + ' failed: ' + error.message + '\n');
    return EXIT.FAILED;
  }
}
