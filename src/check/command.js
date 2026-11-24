import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CollectionOptionsError, ConfigurationError, ProjectError } from '../collector/errors.js';
import { extractRecordData } from '../collector/phase-records.js';
import { readRegularFile } from '../collector/read.js';
import { scanProject } from '../collector/scan.js';

export const CHECK_EXIT = { OK: 0, FOUND: 1, USAGE: 2 };

export const CHECK_HELP = [
  'docatlas check — find Refs: and Files: records that docatlas cannot read', '',
  'Usage:',
  '  docatlas check [<file.md> ...] [--root <directory>] [--docs-dir <path>] [--all-md] [--json] [--strict]', '',
  'Without files, checks every document the document map collects (same configuration and options).',
  'With files, checks only those Markdown files; paths are relative to the current directory.',
  'Nothing is written, and no server or browser starts.', '',
  'Options:',
  '  --root <directory>  Project root (default: current directory).',
  '  --docs-dir <path>   Add a docs directory, as for the document map; repeatable.',
  '  --all-md            Include all Markdown, as for the document map.',
  '  --json              Print one JSON object instead of text.',
  '  --strict            Exit 1 for warnings too.',
  '  -h, --help          Show this help.', '',
  'Exit codes: 0 no errors (warnings allowed unless --strict), 1 errors found, 2 invalid arguments or settings.', '',
  'Readable records:',
  '  Refs: RQ-1, DC-2          (or Refs: none)',
  '  Files:                    followed by a list ...',
  '  - `src/a.js` (modified)',
  '  - `src/old.js` -> `src/new.js` (renamed)',
  '  Files:                    ... or by a fenced block, one path per line',
  '  ```text',
  '  src/a.js (modified)',
  '  ```',
  '  Files: none               when a phase changed no files', '',
  'For AI agents: after writing a phase\'s Files: block, run docatlas check <IMPLEMENT.md> (or npx docatlas check)',
  'and fix every error it reports. Warnings mark entries without a change kind or skipped paths.', ''
].join('\n');

const OPTIONS = {
  root: { type: 'string' }, 'docs-dir': { type: 'string', multiple: true }, 'all-md': { type: 'boolean' },
  json: { type: 'boolean' }, strict: { type: 'boolean' }, help: { type: 'boolean', short: 'h' }
};

class UsageError extends Error {}

async function readFiles(root, cwd, files) {
  let realRoot;
  try {
    realRoot = await fs.realpath(root);
  } catch (cause) {
    throw new ProjectError('Cannot open project root: ' + cause.message, { cause });
  }
  const results = [];
  for (const file of files) {
    const filename = path.resolve(cwd, file);
    if (!/\.(md|markdown)$/i.test(filename)) throw new UsageError(file + ': not a Markdown file.');
    let markdown;
    try {
      markdown = await readRegularFile(realRoot, filename);
    } catch (cause) {
      throw new UsageError(file + ': ' + (cause.code === 'ENOENT' ? 'file not found.' : cause.message));
    }
    const relative = path.relative(realRoot, await fs.realpath(filename)).split(path.sep).join('/');
    const { records, issues } = extractRecordData(markdown);
    results.push({ path: relative, records, issues });
  }
  return { root: realRoot, results };
}

async function readCollected(root, collectionOptions) {
  const scan = await scanProject(root, { collectionOptions });
  return {
    root: scan.snapshot.project.rootLabel,
    results: scan.snapshot.documents.map(document => {
      const metadata = scan.metadataCache.get(document.id) || {};
      return { path: document.relativePath, records: metadata.phaseRecords || [], issues: metadata.recordIssues || [] };
    })
  };
}

/** Print one line per issue; many missing kinds in one document collapse into one line. */
function textReport(results) {
  const lines = [];
  for (const result of results) {
    const kinds = result.issues.filter(issue => issue.code === 'files-kind');
    for (const issue of result.issues) {
      if (issue.code === 'files-kind') {
        if (issue !== kinds[0]) continue;
        if (kinds.length > 1) {
          const shown = kinds.slice(0, 8).map(item => item.line).join(', ') + (kinds.length > 8 ? ', …' : '');
          lines.push(`${result.path}:${issue.line}: warning files-kind ${kinds.length} entries have no change kind (lines ${shown}).`);
          continue;
        }
      }
      lines.push(`${result.path}:${issue.line}: ${issue.level} ${issue.code} ${issue.message}`);
    }
  }
  return lines;
}

export async function runCheck(args, { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = {}) {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({ args, options: OPTIONS, allowPositionals: true, strict: true }));
  } catch (error) {
    stderr.write(error.message + '\nRun docatlas check --help for usage.\n');
    return CHECK_EXIT.USAGE;
  }
  if (values.help) {
    stdout.write(CHECK_HELP);
    return CHECK_EXIT.OK;
  }
  const root = path.resolve(cwd, values.root ?? '.');
  let checked;
  try {
    checked = positionals.length
      ? await readFiles(root, cwd, positionals)
      : await readCollected(root, { docsDirs: values['docs-dir'] || [], allMarkdown: values['all-md'] || false });
  } catch (error) {
    stderr.write(error.message + '\n');
    const usage = error instanceof UsageError || error instanceof ConfigurationError ||
      error instanceof ProjectError || error instanceof CollectionOptionsError;
    return usage ? CHECK_EXIT.USAGE : CHECK_EXIT.FOUND;
  }
  const { results } = checked;
  const issues = results.flatMap(result => result.issues.map(issue => ({ path: result.path, ...issue })));
  const summary = {
    documents: results.length,
    recordDocuments: results.filter(result => result.records.length || result.issues.length).length,
    records: results.reduce((sum, result) => sum + result.records.length, 0),
    entries: results.reduce((sum, result) => sum + result.records.reduce((count, record) => count + record.files.length, 0), 0),
    errors: issues.filter(issue => issue.level === 'error').length,
    warnings: issues.filter(issue => issue.level === 'warning').length
  };
  if (values.json) {
    stdout.write(JSON.stringify({ version: 1, root: checked.root, ...summary, issues }, null, 2) + '\n');
  } else {
    const lines = textReport(results);
    if (lines.length) stdout.write(lines.join('\n') + '\n');
    stdout.write(`Checked ${summary.documents} ${summary.documents === 1 ? 'document' : 'documents'}: ` +
      `${summary.records} Files records with ${summary.entries} file entries in ${summary.recordDocuments} of them; ` +
      `${summary.errors} ${summary.errors === 1 ? 'error' : 'errors'}, ${summary.warnings} ${summary.warnings === 1 ? 'warning' : 'warnings'}.\n`);
  }
  return summary.errors || (values.strict && summary.warnings) ? CHECK_EXIT.FOUND : CHECK_EXIT.OK;
}
