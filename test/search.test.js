import test from 'node:test';
import assert from 'node:assert/strict';
import { scanProject } from '../src/collector/scan.js';
import { createSearchIndex, searchDocuments } from '../src/collector/search.js';
import { createProject } from './helpers/projects.js';
import { PHASE_PLAN, PHASE_FILES } from './helpers/phase-records.js';

async function search(t, files) {
  const { root } = await createProject(t, files);
  return createSearchIndex(await scanProject(root));
}

test('search combines fields with AND, prioritizes metadata, and normalizes Korean and case', async t => {
  const index = await search(t, {
    'docs/a/DESIGN.md': '# 결제 — Design\n\nPayment gateway.\n\n~~~js\nconst refundToken = true;\n~~~',
    'docs/b/DESIGN.md': '# Notes\n\nPayment gateway in the body with 결제.',
    'docs/c/DESIGN.md': '# Other\n\nA separate document.'
  });
  assert.deepEqual(searchDocuments(index, 'PAYMENT 결제').results.map(row => row.id), ['docs/a/DESIGN.md', 'docs/b/DESIGN.md']);
  assert.equal(searchDocuments(index, '결제'.normalize('NFD')).total, 2);
  const code = searchDocuments(index, 'refundtoken').results[0];
  assert.equal(code.matchedField, 'body');
  assert.match(code.snippet, /refundToken/);
  assert.equal(searchDocuments(index, 'payment absent').total, 0);
  assert.equal(searchDocuments(index, '   ').total, 0);
  assert.equal(searchDocuments(index, 'docs/c').results[0].title, 'Other');
});

test('search caps result payloads and uses stable path order for equal scores', async t => {
  const files = Object.fromEntries(Array.from({ length: 55 }, (_, index) =>
    ['docs/item-' + String(index).padStart(2, '0') + '.md', '# Shared title\n\n' + 'context '.repeat(80) + 'needle end.']));
  const index = await search(t, files);
  const result = searchDocuments(index, 'needle');
  assert.equal(result.total, 55);
  assert.equal(result.results.length, 50);
  assert.equal(result.results[0].id, 'docs/item-00.md');
  assert.ok(result.results.every(row => row.snippet.length <= 162 && !('markdown' in row)));
});

test('file names find the recorded document first and its feature documents with matching path evidence', async t => {
  const index = await search(t, {
    ...PHASE_FILES,
    'docs/notes/README.md': '# Notes\n\nLegacy references to session.js still work.'
  });
  const result = searchDocuments(index, 'SESSION.JS');
  assert.deepEqual(result.results.map(row => row.id), [
    'docs/checkout/IMPLEMENT.md', 'docs/checkout/DESIGN.md', 'docs/notes/README.md'
  ]);
  assert.equal(result.results[0].fileScope, 'document');
  assert.equal(result.results[1].fileScope, 'feature');
  assert.deepEqual(result.results[1].matchedFiles, ['src/checkout/session.js']);
  assert.equal(result.results[1].matchedField, 'related file');
  assert.equal(result.results[2].matchedField, 'body');
  assert.equal(searchDocuments(index, 'src/checkout session.js').total, 2);
  assert.equal(searchDocuments(index, 'fake.js').results.some(row => row.fileScope === 'feature'), false);
  const previous = searchDocuments(index, 'old.js');
  assert.equal(previous.results.length, 2);
  assert.deepEqual(previous.results[1].matchedFiles, ['src/checkout/old.js']);
});

test('file search refreshes with the scan and does not borrow a parent feature’s records', async t => {
  const project = await createProject(t, {
    ...PHASE_FILES, 'docs/checkout/nested/DESIGN.md': '# Nested — Design\n\nAn independent feature.'
  });
  const previous = await scanProject(project.root);
  assert.equal(searchDocuments(createSearchIndex(previous), 'session.js').total, 2);
  await project.write('docs/checkout/IMPLEMENT.md', PHASE_PLAN.replaceAll('session.js', 'guest-token.js'));
  const scan = await scanProject(project.root, { previous });
  const index = createSearchIndex(scan);
  assert.equal(searchDocuments(index, 'session.js').total, 0);
  assert.equal(searchDocuments(index, 'guest-token.js').total, 2);
});
