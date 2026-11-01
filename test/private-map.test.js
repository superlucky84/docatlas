import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scanProject } from '../src/collector/scan.js';
import { createSearchIndex, searchDocuments } from '../src/collector/search.js';
import { createProjectStore } from '../src/server/project-store.js';
import { startServer } from '../src/server/index.js';
import { createProject } from './helpers/projects.js';

const PRIVATE = '.docatlas/private';
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

const FILES = {
  'docs/README.md': '# Shop\n\nPublic overview.\n',
  '.docatlas/private/payments/REQUIREMENTS.md': '# Payments — Requirements\n\nSecret refund plan.\n\n![flow](flow.png)\n\n[Design](../../../docs/README.md)\n',
  '.docatlas/private/payments/DESIGN.md': '# Payments — Design\n\nLedger notes.\n',
  '.docatlas/private/payments/flow.png': PNG,
  '.docatlas/private/README.md': '# My notes\n\nOverview of private work.\n',
  '.docatlas/agents.json': '{}\n',
  '.docatlas/notes.md': '# Not private\n',
  'packages/app/.docatlas/private/x/A.md': '# Nested\n'
};

async function project(t, extra = {}) {
  return createProject(t, { ...FILES, ...extra });
}

const ids = snapshot => snapshot.documents.map(document => document.id);
const group = (snapshot, id) => snapshot.groups.find(entry => entry.id === id);

test('private documents at the root form one Private group, last under the project', async t => {
  const { root } = await project(t);
  const { snapshot } = await scanProject(root);
  assert.deepEqual(ids(snapshot).filter(id => id.startsWith('.docatlas')), [
    PRIVATE + '/README.md', PRIVATE + '/payments/DESIGN.md', PRIVATE + '/payments/REQUIREMENTS.md'
  ]);
  for (const document of snapshot.documents) {
    assert.equal(document.isPrivate, document.id.startsWith(PRIVATE + '/') ? true : undefined, document.id);
  }
  assert.ok(!ids(snapshot).some(id => id.startsWith('packages/')), 'a .docatlas below the root is not a private source');
  const top = group(snapshot, '.');
  assert.deepEqual(top.childIds, ['docs', PRIVATE]);
  const privateGroup = group(snapshot, PRIVATE);
  assert.equal(privateGroup.parentId, '.');
  assert.equal(privateGroup.title, 'Private', 'the README heading does not rename the Private group');
  assert.equal(privateGroup.summary, 'Overview of private work.');
  assert.equal(privateGroup.isPrivate, true);
  assert.equal(group(snapshot, '.docatlas'), undefined);
  const payments = group(snapshot, PRIVATE + '/payments');
  assert.deepEqual([payments.parentId, payments.title, payments.isPrivate], [PRIVATE, 'Payments', true]);
  assert.equal(group(snapshot, 'docs').isPrivate, undefined);
});

test('include, exclude, --all-md, .gitignore and group settings never change the private source', async t => {
  const { root } = await project(t, {
    '.gitignore': '.docatlas/\n*.md\n!docs/README.md\n',
    'docatlas.config.json': JSON.stringify({
      version: 1, include: ['**/*.md'], exclude: ['**/payments/**'],
      groups: { [PRIVATE]: { title: 'Renamed' }, [PRIVATE + '/payments']: { title: 'Renamed too' } }
    })
  });
  for (const collectionOptions of [{}, { allMarkdown: true }, { docsDirs: ['.docatlas'] }]) {
    const { snapshot, acceptsPath } = await scanProject(root, { collectionOptions });
    const privateIds = ids(snapshot).filter(id => id.startsWith(PRIVATE));
    assert.deepEqual(privateIds, [PRIVATE + '/README.md', PRIVATE + '/payments/DESIGN.md', PRIVATE + '/payments/REQUIREMENTS.md'],
      JSON.stringify(collectionOptions));
    assert.equal(new Set(ids(snapshot)).size, snapshot.documents.length, 'no document is collected twice');
    assert.equal(group(snapshot, PRIVATE).title, 'Private');
    assert.equal(group(snapshot, PRIVATE + '/payments').title, 'Payments');
    assert.equal(acceptsPath(PRIVATE + '/payments/flow.png'), true);
    assert.equal(acceptsPath('.docatlas/agents.json'), false);
  }
});

test('symbolic links to or inside the private folder are skipped with a notice', async t => {
  const outside = await createProject(t, { 'secret/A.md': '# Outside\n' });
  const linkedFolder = await createProject(t, { 'docs/README.md': '# Shop\n', '.docatlas/agents.json': '{}\n' });
  const linkedInside = await project(t);
  try {
    await fs.symlink(path.join(outside.root, 'secret'), path.join(linkedFolder.root, PRIVATE), 'dir');
    await fs.symlink(path.join(outside.root, 'secret', 'A.md'), path.join(linkedInside.root, PRIVATE, 'payments', 'LINK.md'));
  } catch (error) {
    t.skip('symbolic links are not available: ' + error.code);
    return;
  }
  const folder = (await scanProject(linkedFolder.root)).snapshot;
  assert.ok(!ids(folder).some(id => id.startsWith(PRIVATE)));
  assert.ok(folder.warnings.some(warning => warning.code === 'SYMLINK_SKIPPED' && warning.path === PRIVATE));
  const inside = (await scanProject(linkedInside.root)).snapshot;
  assert.ok(!ids(inside).includes(PRIVATE + '/payments/LINK.md'));
  assert.ok(inside.warnings.some(warning => warning.code === 'SYMLINK_SKIPPED' && warning.path === PRIVATE + '/payments/LINK.md'));
});

test('search marks private results', async t => {
  const { root } = await project(t);
  const scan = await scanProject(root);
  const { results } = searchDocuments(createSearchIndex(scan), 'refund');
  assert.deepEqual(results.map(result => [result.id, result.isPrivate]), [[PRIVATE + '/payments/REQUIREMENTS.md', true]]);
  const [publicResult] = searchDocuments(createSearchIndex(scan), 'overview public').results;
  assert.equal(publicResult.isPrivate, undefined);
});

test('the server reads private documents and their images, but not other .docatlas files', async t => {
  const { root } = await project(t, { '.gitignore': '.docatlas/\n' });
  const app = await startServer({ root });
  t.after(() => app.close());
  const map = await (await fetch(new URL('api/map', app.url))).json();
  assert.ok(map.documents.some(document => document.id === PRIVATE + '/payments/REQUIREMENTS.md' && document.isPrivate));
  const response = await fetch(new URL('api/document?id=' + encodeURIComponent(PRIVATE + '/payments/REQUIREMENTS.md'), app.url));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.match(document.html, /Secret refund plan/);
  const image = document.html.match(/src="([^"]*api\/asset\?id=[^"]+)"/);
  assert.ok(image, document.html);
  const asset = await fetch(new URL(image[1].replaceAll('&amp;', '&'), app.url));
  assert.equal(asset.status, 200);
  assert.deepEqual(Buffer.from(await asset.arrayBuffer()), PNG);
  assert.match(document.html, /href="\/\?doc=docs%2FREADME\.md"/, 'a link from a private document to a public one resolves');
  for (const id of ['.docatlas/notes.md', '.docatlas/agents.json']) {
    assert.equal((await fetch(new URL('api/document?id=' + encodeURIComponent(id), app.url))).status, 404, id);
  }
});

test('a private document saved while the map runs appears without a restart', async t => {
  const { root, write } = await project(t);
  const store = await createProjectStore(root);
  t.after(() => store.close());
  const id = PRIVATE + '/search/IMPLEMENT.md';
  const updated = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('No update: ' + JSON.stringify(store.status()))); }, 8000);
    const unsubscribe = store.subscribe(() => {
      if (!store.current.documents.has(id)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(store.current);
    });
    write(id, '# Search — Implementation\n\nFresh private plan.\n').catch(reject);
  });
  assert.equal(updated.documents.get(id).isPrivate, true);
  assert.ok(updated.snapshot.groups.some(entry => entry.id === PRIVATE + '/search' && entry.isPrivate));
});
