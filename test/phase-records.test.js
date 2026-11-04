import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPhaseRecords } from '../src/collector/phase-records.js';
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
