import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from '../src/cli.js';
import { createProject } from './helpers/projects.js';

const GOOD = '# Checkout — Implementation\n\n## Work\n\nRefs: RQ-1\n\nFiles:\n\n- `src/a.js` (added)\n\n' +
  '## Next\n\nFiles:\n\n```text\nsrc/b.js (modified)\n```\n';
const KIND_ONLY = '# Search — Implementation\n\n## Work\n\nFiles:\n```text\nsrc/c.js\nsrc/d.js\n```\n';
const BROKEN = '# Home — Implementation\n\n## Work\n\nRefs: RQ-01·03\n\nFiles (in progress):\n- `src/e.js` (added)\n';

async function check(args, cwd) {
  let out = '';
  let err = '';
  const code = await run(['check', ...args], {
    cwd, stdout: { write(text) { out += text; } }, stderr: { write(text) { err += text; } }
  });
  return { code, out, err };
}

async function digest(root) {
  const hash = createHash('sha256');
  for (const entry of (await fs.readdir(root, { recursive: true, withFileTypes: true })).sort((a, b) =>
    path.join(a.parentPath, a.name).localeCompare(path.join(b.parentPath, b.name)))) {
    const filename = path.join(entry.parentPath, entry.name);
    hash.update(filename);
    if (entry.isFile()) hash.update(await fs.readFile(filename));
  }
  return hash.digest('hex');
}

test('check reports collected records, separates errors from warnings, and writes nothing', async t => {
  const project = await createProject(t, {
    'docs/checkout/IMPLEMENT.md': GOOD, 'docs/search/IMPLEMENT.md': KIND_ONLY, 'docs/home/IMPLEMENT.md': BROKEN,
    'docs/home/DESIGN.md': '# Home — Design\n\nNo records.\n'
  });
  const before = await digest(project.root);
  const text = await check(['--root', project.root], project.root);
  assert.equal(text.code, 1);
  assert.match(text.out, /^docs\/home\/IMPLEMENT\.md:5: error refs-format /m);
  assert.match(text.out, /^docs\/home\/IMPLEMENT\.md:7: error files-label /m);
  assert.match(text.out, /^docs\/search\/IMPLEMENT\.md:7: warning files-kind 2 entries have no change kind \(lines 7, 8\)\.$/m);
  assert.match(text.out, /Checked 4 documents: 3 Files records with 4 file entries in 3 of them; 2 errors, 2 warnings\.\n$/);
  const json = await check(['--json'], project.root);
  const report = JSON.parse(json.out);
  assert.equal(json.code, 1);
  assert.equal(report.root, project.root);
  assert.deepEqual([report.documents, report.records, report.entries, report.errors, report.warnings], [4, 3, 4, 2, 2]);
  assert.deepEqual(report.issues.map(issue => [issue.path, issue.line, issue.code]), [
    ['docs/home/IMPLEMENT.md', 5, 'refs-format'], ['docs/home/IMPLEMENT.md', 7, 'files-label'],
    ['docs/search/IMPLEMENT.md', 7, 'files-kind'], ['docs/search/IMPLEMENT.md', 8, 'files-kind']
  ]);
  assert.equal(await digest(project.root), before);
});

test('check takes explicit Markdown files and applies --strict to warnings', async t => {
  const project = await createProject(t, { 'docs/a/IMPLEMENT.md': GOOD, 'docs/b/IMPLEMENT.md': KIND_ONLY, 'notes.txt': 'x' });
  const docs = path.join(project.root, 'docs');
  const good = await check(['a/IMPLEMENT.md'], docs);
  assert.equal(good.code, 0);
  assert.equal(good.out, 'Checked 1 document: 2 Files records with 2 file entries in 1 of them; 0 errors, 0 warnings.\n');
  assert.equal((await check(['b/IMPLEMENT.md', '--root', project.root], docs)).code, 0);
  assert.equal((await check(['b/IMPLEMENT.md', '--root', project.root, '--strict'], docs)).code, 1);
  assert.equal(JSON.parse((await check([path.join(docs, 'b/IMPLEMENT.md'), '--json'], project.root)).out).issues[0].path,
    'docs/b/IMPLEMENT.md');
});

test('check rejects unknown options, missing files, other file types, files outside the root, and bad roots', async t => {
  const project = await createProject(t, { 'docs/IMPLEMENT.md': GOOD, 'notes.txt': 'x' });
  const outside = await createProject(t, { 'IMPLEMENT.md': GOOD });
  const cases = [
    [['--wrong'], /--help/], [['docs/missing.md'], /file not found/], [['notes.txt'], /not a Markdown file/],
    [[path.join(outside.root, 'IMPLEMENT.md')], /outside the project/], [['--root', path.join(project.root, 'nope')], /Cannot open/]
  ];
  for (const [args, message] of cases) {
    const result = await check(args, project.root);
    assert.equal(result.code, 2, args.join(' '));
    assert.match(result.err, message);
  }
  const help = await check(['--help'], project.root);
  assert.equal(help.code, 0);
  assert.match(help.out, /Exit codes: 0 no errors/);
  assert.match(help.out, /For AI agents/);
});
