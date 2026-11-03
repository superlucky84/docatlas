import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { runPrivate } from '../private/command.js';
import { collectFiles, inspectFolder, isHomeOrAbove, privatePath } from '../private/folder.js';
import { isIgnored, locateRepository, trackedFiles } from '../private/git.js';
import { parseKey, projectKey } from '../private/key.js';
import { planRestore } from '../private/restore.js';
import { inspectStore, listBackups, readBackup, readEntries, writeBackup } from '../private/store.js';
import {
  CloudError, UUID, createArchive, digest, ensure, fileSetDigest, label, normalizeSelection, readBundle, selectedFiles, validateManifest
} from './archive.js';
import {
  connection, connections, directoryChain, lockState, realDirectory, unlock, withLock, writeJSON
} from './state.js';
import { CLOUD_FOLDER, cloudDirectory, discoverProjects, inventory, scanCloud } from './repository.js';

const OPTIONS = {
  root: { type: 'string' }, directory: { type: 'string' }, key: { type: 'string' },
  bundle: { type: 'string' }, apply: { type: 'boolean' }, force: { type: 'boolean' },
  name: { type: 'string' }, tag: { type: 'string' },
  path: { type: 'string', multiple: true },
  'lock-id': { type: 'string' }, help: { type: 'boolean', short: 'h' }
};
const ALLOWED = {
  connect: ['root', 'directory', 'key', 'name'], connections: ['root'], status: ['root', 'name'], projects: ['root', 'directory'],
  list: ['root', 'directory', 'key', 'name', 'tag'], backup: ['root', 'name', 'tag', 'path'],
  restore: ['root', 'directory', 'key', 'bundle', 'apply', 'force', 'name', 'tag', 'path'], unlock: ['root', 'lock-id', 'name']
};

export function cloudHelp() {
  return [
    'docatlas private-cloud — helpers for explicitly requested private cloud backups',
    '',
    'Only run when the user requests cloud backup, restore, connection or inspection.',
    'No network, background process, cloud login, automatic upload confirmation or remote deletion.',
    'The existing private commands, local phase backups and other skills do not call these helpers.',
    '',
    '  connect --directory <existing cloud folder> [--root <project>] [--key <old project key>]',
    '  status [--root <project>]',
    '  connections [--root <project>]  List saved named connections without searching the cloud.',
    '  projects --directory <cloud folder> [--root <project>]',
    '  list [--directory <cloud folder>] [--root <project>] [--key <old project key>]',
    '  backup [--root <project>]',
    '  restore [--directory <cloud folder>] [--root <project>] [--key <old key>] [--bundle <id>]',
    '          [--apply] [--force]',
    '  unlock --lock-id <displayed id> [--root <project>]',
    '  help',
    'All management commands except projects/connections accept --name <backup name> (default: default).',
    'backup accepts --tag <label>; list/restore can select --tag <label>. Names and tags are',
    'independent of Git branches/tags and never check out code. Existing tags are not overwritten.',
    'backup/restore accept repeated --path <path relative to .docatlas/private>. Omit to include',
    'all paths in the source. Only selected files are exported/applied; other local folders are kept.',
    '',
    'restore is a read-only preview until --apply. Show it before applying.',
    'Only add --force after the user asks to overwrite differing files; existing private restore',
    'makes a before-restore backup. Unlisted current files are kept.',
    'A new computer needs the cloud/folder/file-location clue from the user. Read the recovery',
    'lists before downloading documents; never guess the account or scan the entire home.',
    'A connection is local to this work folder. --directory can preview/discover without connecting.',
    'Multiple history heads or incomplete records require a --bundle choice; timestamps do not choose.',
    '',
    'Backups use installed system tar (USTAR), include up to ten local snapshots, store equal content',
    'once, and reconstruct local hard-link sharing on restore. Limit: 64 MiB per plain, unencrypted tar.',
    'Keep encryption keys elsewhere if you separately protect the cloud storage. No keys are requested here.',
    'Cloud folder files mean prepared, not confirmed uploaded. Check the cloud app before switching PCs.',
    '',
    'Output: one JSON object. Exit: 0 complete/unconfigured, 1 operational failure, 2 usage,',
    '3 needs attention (connection, lock, multiple heads, conflict, unsafe path or incomplete backup).',
    ''
  ].join('\n');
}

async function context(values, options) {
  const home = await fs.realpath(options.home);
  const start = await fs.realpath(path.resolve(options.cwd, values.root ?? '.'));
  ensure((await fs.stat(start)).isDirectory(), 'invalid-root', 'Project root must be a directory.');
  const location = await locateRepository(start, { git: options.git });
  ensure(!location.blocked, location.blocked ?? 'git-error', location.message ?? 'Cannot identify this work folder.');
  const root = location.repo ? location.root : start;
  ensure(!isHomeOrAbove(root, home), 'unsafe-root', 'Use a project folder below your home, not the home or its parent.');
  const name = values.name ?? 'default';
  const saved = ['projects', 'connections'].includes(options.command)
    ? { directory: null, config: null, state: {} } : await connection(home, root, name);
  const derived = await projectKey(root, location, { git: options.git });
  const key = values.key ? parseKey(values.key) : saved.config?.projectKey ?? derived.key;
  ensure(key, 'invalid-key', 'Invalid project key.');
  if (!values.key && !['connect', 'connections', 'projects', 'unlock'].includes(options.command) &&
      saved.config?.keySource === 'origin' && saved.config.projectKey !== derived.key) {
    throw new CloudError('project-changed', 'The origin changed; inspect the old key and reconnect explicitly.');
  }
  return { ...options, ...saved, home, root, location, key, name, tag: values.tag, selection: values.path ?? [],
    keySource: values.key ? 'option' : derived.source };
}

async function target(ctx, values) {
  const selected = values.directory ? path.resolve(ctx.cwd, values.directory) : ctx.config?.directory;
  ensure(selected, 'unconfigured', 'Ask the user where the cloud backup is stored, then connect or supply --directory.');
  if (!values.directory) {
    ensure(await fs.lstat(selected).then(stat => stat.isDirectory(), () => false),
      'connection-unavailable', 'The saved cloud folder is unavailable; preserve the connection and check the cloud app.');
    await realDirectory(selected);
  }
  return cloudDirectory(selected, ctx.root);
}

async function localCommand(ctx, args) {
  let stdout = '';
  let stderr = '';
  const code = await runPrivate([...args, '--root', ctx.root], {
    home: ctx.home, cwd: ctx.root, git: ctx.git, now: ctx.now,
    stdout: { write: value => { stdout += value; } }, stderr: { write: value => { stderr += value; } }
  });
  return { code, stdout, stderr };
}

async function currentEntries(ctx) {
  const folder = await inspectFolder(ctx.root);
  ensure(folder.state !== 'blocked', 'unsafe-path', 'The private folder is blocked.');
  if (folder.state === 'missing') return [];
  const found = await collectFiles(folder.path);
  ensure(found.skipped.length === 0, 'unsupported-files', 'Private documents include links or unsupported files.');
  for (const relative of found.files) {
    await directoryChain(folder.path, relative.split('/').slice(0, -1));
  }
  return readEntries(folder.path, found.files);
}

async function safeLocalBackup(ctx) {
  const folder = await inspectFolder(ctx.root);
  ensure(folder.state !== 'blocked', 'unsafe-path', 'The private folder is blocked.');
  if (ctx.location.repo) {
    ensure((await trackedFiles(ctx.root, { git: ctx.git })).length === 0,
      'tracked-private-files', 'Private files are tracked by git; stop before cloud backup.');
    ensure(await isIgnored(ctx.root, { git: ctx.git }), 'private-not-hidden',
      'Run docatlas private init and check its result before cloud backup.');
  }
  const result = await localCommand(ctx, ['backup', '--key', ctx.key]);
  ensure(result.code === 0, 'local-backup-failed', 'The local backup needs attention: ' + result.stdout + result.stderr);
  const line = result.stdout.split('\n').map(item => item.split('\t'))
    .find(parts => ['create', 'unchanged'].includes(parts[0]) && parts[1] === 'backup');
  ensure(line, 'empty', 'No private files were backed up.');
  return path.basename(line[2]);
}

async function localStore(ctx) {
  const store = await inspectStore(ctx.home, ctx.key);
  ensure(store.state !== 'blocked', 'unsafe-path', 'The local backup store is blocked.');
  return store;
}

function requireSelection(files, selection) {
  const missing = selection.filter(prefix => selectedFiles(files, [prefix]).length === 0);
  ensure(missing.length === 0, 'selection-missing', 'Some selected private paths have no files in this snapshot.', { paths: missing });
}

async function exportData(ctx, currentName) {
  const store = await localStore(ctx);
  const { backups } = await listBackups(store.path);
  const current = backups.find(backup => backup.name === currentName);
  ensure(current, 'missing-backup', 'The selected local backup is missing.');
  requireSelection(current.files, ctx.selection);
  const selected = [current, ...backups.filter(backup => backup.name !== currentName)].slice(0, 10);
  const objects = new Map();
  const snapshots = selected.map(backup => ({
    name: backup.name, createdAt: backup.createdAt, reason: backup.reason, commit: backup.commit,
    files: selectedFiles(backup.files, ctx.selection)
  })).filter(snapshot => snapshot.files.length);
  ensure(snapshots.some(snapshot => snapshot.name === currentName), 'selection-missing',
    'The current backup has no files at the selected private paths.');
  const manifest = {
    format: 1, projectKey: ctx.key, name: ctx.name, tags: ctx.tag ? [ctx.tag] : [], selection: ctx.selection,
    deviceId: ctx.config.deviceId, bundleId: crypto.randomUUID(),
    parents: ctx.state.baseId ? [ctx.state.baseId] : [], createdAt: ctx.now.toISOString(),
    currentSnapshot: currentName, snapshots
  };
  validateManifest(manifest);
  let bytes = 0;
  for (const backup of selected) {
    const snapshot = snapshots.find(snapshot => snapshot.name === backup.name);
    if (!snapshot) continue;
    for (const file of snapshot.files) {
      ensure(await directoryChain(store.path, [backup.name, 'files', ...file.path.split('/').slice(0, -1)]),
        'missing-backup', 'A local backup folder disappeared.');
    }
    const files = await readEntries(path.join(backup.path, 'files'), snapshot.files.map(file => file.path));
    ensure(files.every((file, index) => file.sha256 === snapshot.files[index].sha256 &&
      file.size === snapshot.files[index].size), 'damaged-backup', 'A selected local backup file has damaged content.');
    for (const file of files) {
      if (!objects.has(file.sha256)) {
        bytes += file.data.length;
        ensure(bytes <= 64 * 1024 * 1024, 'too-large', 'Unique backup content exceeds 64 MiB.');
        objects.set(file.sha256, file.data);
      }
    }
  }
  return { manifest, objects };
}

async function connected(ctx) {
  ensure(ctx.config, 'unconfigured', 'Ask the user for the cloud location and run connect first.');
  return target(ctx, {});
}

async function prepareBackup(ctx, profile) {
  const directory = await connected(ctx);
  const currentName = await safeLocalBackup(ctx);
  const data = await exportData(ctx, currentName);
  const scanned = await scanCloud(directory, ctx.key, ctx.name);
  if (ctx.tag) {
    const tagged = scanned.bundles.filter(bundle => bundle.tags.includes(ctx.tag));
    ensure(tagged.length <= 1, 'ambiguous-tag', 'This tag has multiple backups; select a bundle ID.');
    if (tagged.length) {
      const previous = tagged[0];
      const current = data.manifest.snapshots.find(snapshot => snapshot.name === currentName);
      const oldCurrent = previous.snapshots.find(snapshot => snapshot.name === previous.currentSnapshot);
      ensure(previous.available && oldCurrent.digest === fileSetDigest(current.files), 'tag-exists',
        'This tag already identifies different content. Choose a new tag; the old backup is kept.');
      await readBundle(previous.archivePath, withoutLocation(previous));
      return { status: 'prepared', action: 'unchanged', name: ctx.name, tag: ctx.tag,
        bundleId: previous.bundleId, remoteStatus: 'unknown' };
    }
  }
  const desiredInventory = inventory({
    name: ctx.name, tags: data.manifest.tags, selection: ctx.selection,
    currentSnapshot: currentName,
    snapshots: data.manifest.snapshots.map(snapshot => ({
      name: snapshot.name, createdAt: snapshot.createdAt, reason: snapshot.reason, commit: snapshot.commit,
      digest: fileSetDigest(snapshot.files), files: snapshot.files.length
    }))
  });
  const previous = scanned.bundles.find(bundle =>
    bundle.deviceId === ctx.config.deviceId && inventory(bundle) === desiredInventory && bundle.available);
  if (previous) {
    await readBundle(previous.archivePath, withoutLocation(previous));
    await writeJSON(profile, 'state.json', { ...ctx.state, baseId: previous.bundleId, lastPrepared: previous.bundleId });
    return { status: 'prepared', action: 'unchanged', bundleId: previous.bundleId, remoteStatus: 'unknown' };
  }
  const temporary = await fs.mkdtemp(path.join(profile, '.work-'));
  try {
    const created = await createArchive(temporary, data.manifest, data.objects, { tar: ctx.tar });
    const destination = await directoryChain(directory, [CLOUD_FOLDER, digest(ctx.key), digest(ctx.name), ctx.config.deviceId], true);
    const name = data.manifest.bundleId;
    const partial = path.join(destination, '.partial-' + name);
    const final = path.join(destination, name + '.tar');
    try {
      await fs.chmod(created.filename, 0o600);
      await fs.copyFile(created.filename, partial, fs.constants.COPYFILE_EXCL);
      ensure(await directoryChain(directory, [CLOUD_FOLDER, digest(ctx.key), digest(ctx.name), ctx.config.deviceId]),
        'unsafe-path', 'Cloud directory changed.');
      await fs.rename(partial, final);
      await writeJSON(destination, name + '.json', created.recovery);
    } finally {
      await fs.rm(partial, { force: true });
    }
    await writeJSON(profile, 'state.json', { ...ctx.state, baseId: name, lastPrepared: name });
    return {
      status: 'prepared', action: 'created', name: ctx.name, tags: data.manifest.tags, selection: ctx.selection,
      bundleId: name, archive: final, bytes: created.bytes.length,
      snapshots: data.manifest.snapshots.length, uniqueFiles: data.objects.size, remoteStatus: 'unknown',
      divergent: scanned.heads.some(id => !data.manifest.parents.includes(id))
    };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

function withoutLocation(bundle) {
  const { archivePath, available, ...recovery } = bundle;
  return recovery;
}

async function selectBundle(ctx, values) {
  const directory = await target(ctx, values);
  const scanned = await scanCloud(directory, ctx.key, ctx.name);
  let selected = values.bundle;
  if (values.tag) {
    const candidates = scanned.bundles.filter(bundle => bundle.tags.includes(values.tag));
    ensure(candidates.length === 1, candidates.length ? 'ambiguous-tag' : 'missing-tag',
      'Select one bundle ID for this tag.', { candidates: candidates.map(bundle => bundle.bundleId) });
    selected = candidates[0].bundleId;
  }
  if (!selected) {
    ensure(scanned.invalid.length === 0 && scanned.pending.length === 0, 'incomplete-backups',
      'Some recovery lists or archives are incomplete; inspect list or select a verified bundle explicitly.');
    ensure(scanned.heads.length === 1, scanned.heads.length ? 'multiple-heads' : 'missing-backup',
      'Select a backup bundle from list; timestamps alone cannot choose.', { heads: scanned.heads });
  }
  const id = selected ?? scanned.heads[0];
  const chosen = scanned.bundles.find(bundle => bundle.bundleId === id);
  ensure(chosen?.available, 'incomplete-backup', 'The selected archive has not fully arrived.');
  ensure(await directoryChain(directory, [CLOUD_FOLDER, digest(ctx.key), digest(ctx.name), chosen.deviceId]),
    'unsafe-path', 'Cloud backup directory disappeared.');
  return { chosen, bundle: await readBundle(chosen.archivePath, withoutLocation(chosen)) };
}

async function restore(ctx, values, profile) {
  const { chosen, bundle } = await selectBundle(ctx, values);
  const folder = await inspectFolder(ctx.root);
  ensure(folder.state !== 'blocked', 'unsafe-path', 'The private folder is blocked.');
  const current = bundle.manifest.snapshots.find(snapshot => snapshot.name === bundle.manifest.currentSnapshot);
  requireSelection(current.files, ctx.selection);
  const files = selectedFiles(current.files, ctx.selection).map(file => ({ ...file, data: bundle.entries.get('objects/' + file.sha256) }));
  ensure(files.length, 'selection-missing', 'The selected backup has no files at the requested private paths.');
  const plan = await planRestore(privatePath(ctx.root), files);
  const counts = {};
  for (const item of plan) counts[item.action] = (counts[item.action] ?? 0) + 1;
  if (!values.apply) return {
    status: 'preview', bundleId: chosen.bundleId, projectKey: ctx.key,
    files: plan.map(({ path: relative, action, reason }) => ({ path: relative, action, ...(reason ? { reason } : {}) })),
    counts, selection: ctx.selection, writes: false
  };
  const store = await localStore(ctx);
  let backups = (await listBackups(store.path)).backups;
  const imported = new Map();
  for (const original of bundle.manifest.snapshots) {
    const snapshot = { ...original, files: selectedFiles(original.files, ctx.selection) };
    if (!snapshot.files.length) continue;
    let existing = backups.find(backup => backup.createdAt === snapshot.createdAt && backup.reason === snapshot.reason &&
      backup.commit === snapshot.commit && fileSetDigest(backup.files) === fileSetDigest(snapshot.files));
    if (existing) {
      for (const file of existing.files) {
        ensure(await directoryChain(store.path, [existing.name, 'files', ...file.path.split('/').slice(0, -1)]),
          'missing-backup', 'An existing backup disappeared.');
      }
      ensure(!(await readBackup(existing)).damaged, 'damaged-backup', 'A matching local backup is damaged.');
    } else {
      const entries = snapshot.files.map(file => ({ ...file, data: bundle.entries.get('objects/' + file.sha256) }));
      const written = await writeBackup({
        home: ctx.home, key: ctx.key, entries, reason: snapshot.reason, root: ctx.root, commit: snapshot.commit,
        now: new Date(snapshot.createdAt)
      });
      ensure(!written.blocked, 'unsafe-path', 'Cannot import into the local backup store.');
      existing = (await listBackups(store.path)).backups.find(backup => backup.name === written.name);
      backups.push(existing);
    }
    imported.set(snapshot.name, existing.name);
  }
  const result = await localCommand(ctx, ['restore', '--key', ctx.key, '--from', imported.get(current.name),
    ...(values.force ? ['--force'] : [])]);
  if (result.code === 0) {
    const directory = await target(ctx, values);
    if (!ctx.config || ctx.config.directory !== directory || ctx.config.projectKey !== ctx.key) {
      await writeJSON(profile, 'connection.json', {
        format: 1, root: ctx.root, projectKey: ctx.key, name: ctx.name, keySource: ctx.keySource, directory,
        deviceId: ctx.config?.deviceId ?? crypto.randomUUID()
      });
    }
    await writeJSON(profile, 'state.json', { ...ctx.state, baseId: chosen.bundleId, lastRestored: chosen.bundleId });
  }
  return {
    status: result.code === 0 ? 'restored' : 'needs-attention', bundleId: chosen.bundleId,
    exitCode: result.code, localResult: result.stdout, message: result.stderr
  };
}

export async function runCloud(args, {
  stdout = process.stdout, stderr = process.stderr, cwd = process.cwd(), home = os.homedir(),
  git = 'git', tar = 'tar', now = new Date()
} = {}) {
  const output = value => stdout.write(JSON.stringify(value, null, 2) + '\n');
  const [command, ...rest] = args;
  if (['help', '--help', '-h'].includes(command)) {
    stdout.write(cloudHelp());
    return 0;
  }
  let values;
  try {
    ensure(ALLOWED[command], 'usage', 'Unknown or missing private-cloud command.');
    ({ values } = parseArgs({ args: rest, options: OPTIONS, allowPositionals: false, strict: true }));
    if (values.help) { stdout.write(cloudHelp()); return 0; }
    for (const option of Object.keys(values)) ensure(ALLOWED[command].includes(option), 'usage', 'Option --' + option + ' does not apply to ' + command + '.');
    ensure(values.key === undefined || parseKey(values.key), 'usage', 'Invalid --key.');
    ensure(values.bundle === undefined || UUID.test(values.bundle), 'usage', 'Invalid --bundle.');
    ensure(values.name === undefined || label(values.name), 'usage', 'Invalid --name (use 1-80 characters without controls).');
    ensure(values.tag === undefined || label(values.tag), 'usage', 'Invalid --tag (use 1-80 characters without controls).');
    ensure(!(values.tag && values.bundle), 'usage', 'Choose --tag or --bundle, not both.');
    if (values.name) values.name = label(values.name);
    if (values.tag) values.tag = label(values.tag);
    if (values.path) values.path = normalizeSelection(values.path);
    ensure(!values.force || values.apply, 'usage', '--force requires --apply and an explicit overwrite request.');
    ensure(command !== 'connect' && command !== 'projects' || values.directory, 'usage', '--directory is required.');
    ensure(command !== 'unlock' || UUID.test(values['lock-id']), 'usage', '--lock-id is required.');
  } catch (error) {
    output({ status: 'error', reason: 'usage', message: error.message });
    return 2;
  }
  try {
    const ctx = await context(values, { cwd, home, git, tar, now, command });
    if (command === 'connect' && !values.key) {
      const derived = await projectKey(ctx.root, ctx.location, { git });
      ctx.key = derived.key;
      ctx.keySource = derived.source;
    }
    const busy = await lockState(ctx.directory);
    if (command !== 'status' && command !== 'unlock' && busy) {
      throw new CloudError('locked', 'Another operation owns this profile.', { lock: busy });
    }
    let result;
    if (command === 'connections') {
      result = { status: 'listed', connections: await connections(ctx.home, ctx.root) };
    } else if (command === 'unlock') {
      result = await unlock(ctx.home, ctx.root, values['lock-id'], ctx.name);
    } else if (command === 'connect') {
      const directory = await target(ctx, values);
      result = await withLock(ctx.home, ctx.root, async profile => {
        const config = {
          format: 1, root: ctx.root, projectKey: ctx.key, name: ctx.name, keySource: ctx.keySource, directory,
          deviceId: ctx.config?.deviceId ?? crypto.randomUUID()
        };
        await writeJSON(profile, 'connection.json', config);
        if (!ctx.config || ctx.config.projectKey !== ctx.key || ctx.config.directory !== directory) {
          await writeJSON(profile, 'state.json', {});
        }
        return { status: 'connected', projectKey: ctx.key, name: ctx.name, directory, remoteStatus: 'unknown' };
      }, ctx.name);
    } else if (command === 'projects') {
      result = { status: 'listed', projects: await discoverProjects(await target(ctx, values)) };
    } else if (command === 'list') {
      const scanned = await scanCloud(await target(ctx, values), ctx.key, ctx.name);
      result = { status: 'listed', projectKey: ctx.key, name: ctx.name, ...scanned,
        ...(values.tag ? { bundles: scanned.bundles.filter(bundle => bundle.tags.includes(values.tag)) } : {}) };
    } else if (command === 'status') {
      if (busy) result = { status: 'locked', lock: busy };
      else if (!ctx.config) result = { status: 'unconfigured', projectKey: ctx.key, name: ctx.name };
      else {
        const scanned = await scanCloud(await connected(ctx), ctx.key, ctx.name);
        const previous = scanned.bundles.find(bundle => bundle.bundleId === ctx.state.baseId);
        let local = 'unprepared';
        if (previous?.available) {
          await readBundle(previous.archivePath, withoutLocation(previous));
          const current = previous.snapshots.find(snapshot => snapshot.name === previous.currentSnapshot);
          local = fileSetDigest(selectedFiles(await currentEntries(ctx), previous.selection)) === current.digest ? 'same' : 'changed';
        }
        result = {
          status: scanned.invalid.length || scanned.pending.length || (ctx.state.baseId && !previous) ? 'needs-attention' : 'connected',
          exitCode: scanned.invalid.length || scanned.pending.length || (ctx.state.baseId && !previous) ? 3 : 0,
          projectKey: ctx.key, name: ctx.name, directory: ctx.config.directory, local,
          baseId: ctx.state.baseId ?? null, ...scanned
        };
      }
    } else if (command === 'backup') {
      await connected(ctx);
      result = await withLock(ctx.home, ctx.root, async profile => {
        const fresh = await connection(ctx.home, ctx.root, ctx.name);
        return prepareBackup({ ...ctx, ...fresh, key: fresh.config?.projectKey ?? ctx.key }, profile);
      }, ctx.name);
    } else if (command === 'restore') {
      result = values.apply
        ? await withLock(ctx.home, ctx.root, async profile => {
          const fresh = await connection(ctx.home, ctx.root, ctx.name);
          return restore({ ...ctx, ...fresh, key: values.key ? ctx.key : fresh.config?.projectKey ?? ctx.key }, values, profile);
        }, ctx.name)
        : await restore(ctx, values);
    }
    output(result);
    return result.exitCode ?? (result.status === 'locked' ? 3 : 0);
  } catch (error) {
    const controlled = error instanceof CloudError;
    output({ status: 'needs-attention', reason: error.reason ?? error.code ?? 'failure', message: error.message, ...error.details });
    if (!controlled) stderr.write('docatlas private-cloud ' + command + ' failed: ' + error.message + '\n');
    return controlled ? 3 : 1;
  }
}
