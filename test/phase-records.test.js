import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPhaseRecords, extractRecordData } from '../src/collector/phase-records.js';
import { scanProject } from '../src/collector/scan.js';
import { relatedFilesFor } from '../src/collector/related-files.js';
import { renderMarkdown } from '../src/server/render.js';
import { createProject } from './helpers/projects.js';
import { PHASE_PLAN, PHASE_FILES } from './helpers/phase-records.js';

test('phase records inherit refs, keep empty records, and use the renderer’s duplicate heading anchors', async () => {
  const records = extractPhaseRecords(PHASE_PLAN);
  assert.equal(records.length, 3);
  assert.deepEqual(records[0].refs, ['RQ-1', 'DC-1', 'M-1']);
  assert.deepEqual(records[1].refs, records[0].refs);
  assert.deepEqual(records[2].refs, []);
  assert.deepEqual(records[2].files, []);
  assert.equal(records[1].files[1].oldPath, 'src/checkout/old.js');
  assert.equal(records[1].files.at(-1).path, 'generated/assets/');
  const rendered = await renderMarkdown(PHASE_PLAN, async () => ({ type: 'blocked' }));
  assert.deepEqual(records.slice(0, 2).map(record => record.anchor),
    rendered.headings.filter(heading => heading.text === 'Work').map(heading => heading.id));
  assert.equal(records[1].anchor, 'work-1');
});

test('unsafe and malformed file records cannot become file targets', () => {
  const records = extractPhaseRecords('# Plan\r\n\r\n## Work\r\nFiles:\r\n' + [
    '- `../outside.js` (added)', '- `/absolute.js` (added)', '- `C:/drive.js` (added)',
    '- `folder\\file.js` (added)', '- `one.js` -> `two.js` (modified)', '- `missing-old.js` (renamed)',
    '- `src/사용 방법.js` (added)', '- `docs/IMPLEMENT.md` (modified)'
  ].join('\r\n'));
  assert.deepEqual(records[0].files.map(file => file.path), ['src/사용 방법.js', 'docs/IMPLEMENT.md']);
});

const simplify = records => records.map(({ title, refs, files }) => ({ title, refs, files }));

test('a Prettier-formatted plan yields the same records as the tight original', () => {
  const tight = '# Plan\n\n## Work\nRefs: RQ-1, DC-2\n\n* [x] Done.\n\nFiles:\n* `src/a.js` (added)\n' +
    '* `src/old.js` -> `src/new.js` (renamed)\n\nFiles: none\n';
  // Output of Prettier 3.6.2 (`prettier --no-config`) for the text above, kept as a fixture.
  const formatted = '# Plan\n\n## Work\n\nRefs: RQ-1, DC-2\n\n- [x] Done.\n\nFiles:\n\n- `src/a.js` (added)\n' +
    '- `src/old.js` -> `src/new.js` (renamed)\n\nFiles: none\n';
  const records = simplify(extractPhaseRecords(tight));
  assert.deepEqual(simplify(extractPhaseRecords(formatted)), records);
  assert.deepEqual(records[0].files, [
    { path: 'src/a.js', kind: 'added' }, { path: 'src/new.js', kind: 'renamed', oldPath: 'src/old.js' }
  ]);
  assert.deepEqual(records[1].files, []);
  assert.deepEqual(extractPhaseRecords('# Plan\n\n## Work\n\nFiles:\n\n\n\n- `src/a.js` (added)\n')[0].files.length, 1);
});

test('a fenced path list after Files: is a record and a missing kind reads as unknown', () => {
  const plan = [
    '# Plan', '', '## Text fence', '', 'Files:', '', '```text', 'src/a.js (modified)', '',
    'src/b.js', '`src/c.js` (added)', 'src/old.js -> src/new.js', '```', '',
    '## Bare fence', '', 'Files:', '~~~', 'src/사용 방법.js', '~~~', '',
    '## Bare list', '', 'Files:', '- `src/d.js`', '+ `src/e.js` (deleted)', ''
  ].join('\n');
  const records = extractPhaseRecords(plan);
  assert.deepEqual(records.map(record => record.files), [
    [{ path: 'src/a.js', kind: 'modified' }, { path: 'src/b.js', kind: 'unknown' }, { path: 'src/c.js', kind: 'added' },
      { path: 'src/new.js', kind: 'renamed', oldPath: 'src/old.js' }],
    [{ path: 'src/사용 방법.js', kind: 'unknown' }],
    [{ path: 'src/d.js', kind: 'unknown' }]
  ]);
});

test('examples and labels that are not a top-level Files: paragraph stay out of the records', () => {
  const plan = [
    '# Plan', '', '## Work', '',
    '~~~~markdown', 'Files:', '', '```text', 'fake/fenced.js', '```', '~~~~', '',
    '> Files:', '> - `fake/quoted.js` (added)', '',
    '- Files:', '  - `fake/nested.js` (added)', '',
    'Files: `fake/inline.js`', '',
    'Files (in progress):', '- `fake/annotated.js` (added)', '',
    'Files:', 'Paragraph instead of a list.', ''
  ].join('\n');
  const records = extractPhaseRecords(plan);
  assert.equal(records.length, 0);
});

test('one malformed entry is skipped without ending its block', () => {
  const records = extractPhaseRecords('# Plan\n\n## Work\n\nFiles:\n- `src/a.js` (added)\n' +
    '- `src/b.js` (added) — added the session\n- `src/c.js` (modified)\n');
  assert.deepEqual(records[0].files.map(file => file.path), ['src/a.js', 'src/c.js']);
});

test('Refs accept multi-part prefixes, letter suffixes, and loose comma spacing but not abbreviated IDs', () => {
  const plan = [
    '# Plan', '', '## Feature', '', 'Refs: FH-RQ-02, FH-DC-10, DC-3a,RQ-25b', '',
    '### Work', '', 'Files: none', '',
    '## Abbreviated', '', 'Refs: RQ-01·03', '', 'Files: none', ''
  ].join('\n');
  const records = extractPhaseRecords(plan);
  assert.deepEqual(records[0].refs, ['FH-RQ-02', 'FH-DC-10', 'DC-3a', 'RQ-25b']);
  assert.deepEqual(records[1].refs, []);
});

test('the scanner supplies deduplicated file evidence within its document group and refreshes it by content hash', async t => {
  const project = await createProject(t, PHASE_FILES);
  const scan = await scanProject(project.root);
  const generation = { ...scan, documents: new Map(scan.snapshot.documents.map(document => [document.id, document])) };
  const design = relatedFilesFor(generation.documents.get('docs/checkout/DESIGN.md'), generation);
  const implementation = relatedFilesFor(generation.documents.get('docs/checkout/IMPLEMENT.md'), generation);
  assert.equal(design.scope, 'feature');
  assert.equal(implementation.scope, 'document');
  assert.equal(design.files.length, 5);
  assert.equal(design.files.find(file => file.path.endsWith('session.js')).records.length, 2);
  assert.equal(design.files.find(file => file.path.endsWith('IMPLEMENT.md')).targetId, 'docs/checkout/IMPLEMENT.md');
  assert.equal(design.files.find(file => file.path.endsWith('assets/')).isDirectory, true);
  assert.equal(relatedFilesFor(generation.documents.get('docs/unrelated/DESIGN.md'), generation).files.length, 0);
  await project.write('docs/checkout/IMPLEMENT.md', PHASE_PLAN.replace('session.js', 'new-session.js'));
  const refreshed = await scanProject(project.root, { previous: scan });
  assert.notEqual(refreshed.metadataCache.get('docs/checkout/IMPLEMENT.md'), scan.metadataCache.get('docs/checkout/IMPLEMENT.md'));
  assert.equal(refreshed.metadataCache.get('docs/checkout/DESIGN.md'), scan.metadataCache.get('docs/checkout/DESIGN.md'));
});

test('format issues name the original line, level, and phase but skip examples in code', () => {
  const lines = [
    '---', 'title: Plan', '---',
    '# Plan', '', '## Work', '',
    'Refs: RQ-01·03', '',
    'Files (in progress):', '- `fake/annotated.js` (added)', '',
    'Files: `b.js`, `c.js`', '',
    'Files:', 'Paragraph text under the label.', '',
    '## Next', '',
    'Files:', '- `ok.js` (added)', '- `bad.js` (added) — with a note', '- `../outside.js` (added)', '- `no-kind.js`', '',
    'Files:', '', 'Just text.', '',
    '~~~', 'Files (example):', 'Refs: not an id', '~~~', ''
  ];
  const at = text => lines.indexOf(text) + 1;
  const { records, issues } = extractRecordData(lines.join('\n'));
  assert.deepEqual(issues.map(issue => [issue.line, issue.code, issue.level, issue.anchor]), [
    [at('Refs: RQ-01·03'), 'refs-format', 'error', 'work'],
    [at('Files (in progress):'), 'files-label', 'error', 'work'],
    [at('Files: `b.js`, `c.js`'), 'files-inline', 'error', 'work'],
    [at('Paragraph text under the label.') - 1, 'files-empty', 'error', 'work'],
    [lines.lastIndexOf('Files:') + 1, 'files-empty', 'error', 'next'],
    [at('- `bad.js` (added) — with a note'), 'files-entry', 'error', 'next'],
    [at('- `../outside.js` (added)'), 'files-path', 'warning', 'next'],
    [at('- `no-kind.js`'), 'files-kind', 'warning', 'next']
  ].sort((a, b) => a[0] - b[0]));
  assert.ok(issues.every(issue => issue.message));
  assert.deepEqual(records.map(record => record.files.map(file => file.path)), [['ok.js', 'no-kind.js'], []]);
  assert.deepEqual(extractRecordData(PHASE_PLAN).issues, []);
});

test('related files carry the document’s own issues and the error counts of borrowed plans', async t => {
  const project = await createProject(t, {
    'docs/checkout/DESIGN.md': '# Checkout — Design\n\nGuest checkout.\n',
    'docs/checkout/IMPLEMENT.md': '# Checkout — Implementation\n\n## Work\n\nFiles:\n- `src/a.js` (added)\n\n' +
      '## Next\n\nFiles (in progress):\n- `src/b.js` (added)\n\nFiles: `c.js`\n'
  });
  const scan = await scanProject(project.root);
  const generation = { ...scan, documents: new Map(scan.snapshot.documents.map(document => [document.id, document])) };
  const plan = relatedFilesFor(generation.documents.get('docs/checkout/IMPLEMENT.md'), generation);
  assert.deepEqual(plan.issues.map(issue => issue.code), ['files-label', 'files-inline']);
  assert.deepEqual(plan.sourceIssues, []);
  const design = relatedFilesFor(generation.documents.get('docs/checkout/DESIGN.md'), generation);
  assert.deepEqual(design.issues, []);
  assert.deepEqual(design.sourceIssues, [
    { documentId: 'docs/checkout/IMPLEMENT.md', sourcePath: 'docs/checkout/IMPLEMENT.md', errors: 2 }
  ]);
  await project.write('docs/checkout/IMPLEMENT.md', '# Checkout — Implementation\n\n## Work\n\nFiles: `c.js`\n');
  const rescan = await scanProject(project.root, { previous: scan });
  const next = { ...rescan, documents: new Map(rescan.snapshot.documents.map(document => [document.id, document])) };
  const unreadable = relatedFilesFor(next.documents.get('docs/checkout/IMPLEMENT.md'), next);
  assert.equal(unreadable.scope, 'feature');
  assert.deepEqual([unreadable.issues.length, unreadable.sourceIssues], [1, []]);
});

test('bare fences, CRLF line endings, and indented labels follow the same block rules', () => {
  const plan = ['# Plan', '', '## Work', '', 'Files:', '', '', '```', 'src/a.js (added)', '', 'src/b.js', '```', '',
    '## Indented', '', '   Files:', '   - `src/c.js` (deleted)', ''].join('\r\n');
  const { records, issues } = extractRecordData(plan);
  assert.deepEqual(records.map(record => record.files), [
    [{ path: 'src/a.js', kind: 'added' }, { path: 'src/b.js', kind: 'unknown' }], [{ path: 'src/c.js', kind: 'deleted' }]
  ]);
  assert.deepEqual(issues.map(issue => [issue.line, issue.code]), [[11, 'files-kind']]);
});

test('an empty Files: block keeps the document scope and reports why it has no files', async t => {
  const project = await createProject(t, {
    'docs/checkout/IMPLEMENT.md': '# Checkout — Implementation\n\n## Work\n\nFiles:\n\nSee the pull request.\n\n## Old\n\nFiles:\n- `src/a.js` (added)\n',
    'docs/checkout/NOTES.md': '# Notes\n\n## Work\n\nFiles:\n\nTBD\n'
  });
  const scan = await scanProject(project.root);
  const generation = { ...scan, documents: new Map(scan.snapshot.documents.map(document => [document.id, document])) };
  const notes = relatedFilesFor(generation.documents.get('docs/checkout/NOTES.md'), generation);
  assert.equal(notes.scope, 'document');
  assert.deepEqual([notes.files, notes.recordCount, notes.issues.map(issue => issue.code)], [[], 1, ['files-empty']]);
});
