// Private documents in <root>/.docatlas/private/. Independent of the collector, server, browser UI and agent kit.
export { EXIT, PRIVATE_COMMANDS, PRIVATE_OPTIONS, STATUS_SUMMARIES, privateHelp, runPrivate } from './command.js';
export {
  EXCLUDE_COMMENT, PRIVATE_PATH, addExcludeLine, collectFiles, countFiles, inspectFolder, isHomeOrAbove, privatePath,
  readExclude
} from './folder.js';
export { PATTERN, headCommit, isIgnored, locateRepository, originUrl, trackedFiles } from './git.js';
export { localKey, normalizeRemote, parseKey, projectKey } from './key.js';
export { privateBackupNotice } from './notice.js';
export { applyRestore, planRestore } from './restore.js';
export {
  DEFAULT_KEEP, MANIFEST, STORE_PATH, inspectStore, latestRegular, listBackups, pruneBackups, readBackup, storeFolder, writeBackup
} from './store.js';
