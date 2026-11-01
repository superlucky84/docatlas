import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { blockReason, kind } from './folder.js';
import { readRegularFile, sha256 } from './store.js';

// Restores backup files into the private folder. Existing files that differ are kept unless the caller turned
// them into overwrites, files missing from the backup are never deleted, and symbolic links are never followed.

async function planFile(privateFolder, file) {
  const parts = file.path.split('/');
  let current = privateFolder;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    const found = await kind(current);
    if (found === 'missing') return { action: 'create' };
    if (found !== 'directory') return { action: 'blocked', reason: blockReason(found) };
  }
  const found = await kind(path.join(current, parts.at(-1)));
  if (found === 'missing') return { action: 'create' };
  if (found !== 'file') return { action: 'blocked', reason: blockReason(found) };
  const data = await readRegularFile(path.join(current, parts.at(-1)));
  return { action: sha256(data) === file.sha256 ? 'unchanged' : 'conflict' };
}

// action for each backup file: create, unchanged, conflict, or blocked with a reason.
export async function planRestore(privateFolder, files) {
  const plan = [];
  for (const file of files) {
    plan.push({ ...file, ...(await planFile(privateFolder, file)) });
  }
  return plan;
}

// Creates missing folders one at a time and checks each is a real folder. Returns a block reason or null.
async function makeParents(privateFolder, relative) {
  let current = privateFolder;
  for (const part of relative.split('/').slice(0, -1)) {
    current = path.join(current, part);
    await fs.mkdir(current).catch(error => {
      if (error.code !== 'EEXIST') throw error;
    });
    const found = await kind(current);
    if (found !== 'directory') return blockReason(found);
  }
  return null;
}

// Writes create and overwrite items and updates their action when the folder changed since planning.
export async function applyRestore(privateFolder, plan) {
  for (const item of plan) {
    if (item.action !== 'create' && item.action !== 'overwrite') continue;
    const reason = await makeParents(privateFolder, item.path);
    if (reason) {
      Object.assign(item, { action: 'blocked', reason });
      continue;
    }
    const target = path.join(privateFolder, ...item.path.split('/'));
    if (item.action === 'create') {
      try {
        await fs.writeFile(target, item.data, { flag: 'wx' });
      } catch (error) {
        // Another file took the name, for example a name that differs only in case on macOS or Windows.
        if (error.code !== 'EEXIST') throw error;
        item.action = 'conflict';
      }
      continue;
    }
    const found = await kind(target);
    if (found !== 'file' && found !== 'missing') {
      Object.assign(item, { action: 'blocked', reason: blockReason(found) });
      continue;
    }
    // A rename replaces the name itself, so a link put there after planning is replaced, not followed.
    const temporary = path.join(path.dirname(target),
      '.' + path.basename(target) + '.docatlas-' + process.pid + '-' + crypto.randomBytes(4).toString('hex'));
    try {
      await fs.writeFile(temporary, item.data, { flag: 'wx' });
      await fs.rename(temporary, target);
    } catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
  }
  return plan;
}
