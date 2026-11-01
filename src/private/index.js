// Private documents in <root>/.docatlas/private/. Independent of the collector, server, browser UI and agent kit.
export { EXIT, PRIVATE_OPTIONS, privateHelp, runPrivate } from './command.js';
export { EXCLUDE_COMMENT, PRIVATE_PATH, addExcludeLine, countDocuments, inspectFolder, privatePath, readExclude } from './folder.js';
export { inspectGit, isIgnored, trackedFiles } from './git.js';
