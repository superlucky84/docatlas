// Private documents in <root>/.docatlas/private/. Independent of the collector, server, browser UI and agent kit.
export { EXIT, PRIVATE_OPTIONS, STATUS_SUMMARIES, privateHelp, runPrivate } from './command.js';
export { EXCLUDE_COMMENT, PRIVATE_PATH, addExcludeLine, countFiles, inspectFolder, privatePath, readExclude } from './folder.js';
export { PATTERN, isIgnored, locateRepository, trackedFiles } from './git.js';
