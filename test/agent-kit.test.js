import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAgentKit } from '../scripts/agent-kit.js';
import { hashText, parseFrontmatter } from '../src/agent-kit/text.js';
import { createProject } from './helpers/projects.js';

const repositoryKit = fileURLToPath(new URL('../agent-kit/', import.meta.url));

const SKILL = '---\nname: sample-skill\ndescription: Use when testing the kit checker.\nmetadata:\n  version: 1.2.0\n---\n\n# Sample skill\n\nBody text.\n';
const AGENT = '---\nname: sample-skill\ndescription: Sample agent rule for tests.\n---\n\n# Sample rule\n\nFollow the sample.\n';

async function createKit(t, { skill = SKILL, agent = AGENT, item = {}, files = {} } = {}) {
  const manifest = {
    schema: 1,
    kitVersion: '1.0.0',
    items: [{
      name: 'sample-skill',
      version: '1.2.0',
      default: true,
      skill: { path: 'skills/sample-skill/SKILL.md', sha256: hashText(skill) },
      agent: { path: 'agents/sample-skill.md', sha256: hashText(agent) },
      previous: [],
      ...item
    }]
  };
  const { root } = await createProject(t, {
    'skills/sample-skill/SKILL.md': skill,
    'agents/sample-skill.md': agent,
    'manifest.json': JSON.stringify(manifest, null, 2),
    ...files
  });
  return root;
}

function hasError(errors, pattern) {
  assert.ok(errors.some(error => pattern.test(error)), 'expected ' + pattern + ' in ' + JSON.stringify(errors));
}

test('the repository kit keeps the default roles and adds optional private and backup pairs', async () => {
  const { errors, manifest } = await checkAgentKit(repositoryKit);
  assert.deepEqual(errors, []);
  assert.deepEqual(manifest.items.map(item => [item.name, item.default, item.requires]), [
    ['doc-driven-designer-v1', true, undefined],
    ['doc-driven-implementer-v1', true, undefined],
    ['doc-driven-reviewer-v1', true, undefined],
    ['doc-driven-private-v1', false, ['doc-driven-designer-v1']],
    ['doc-driven-backup-v1', false, undefined]
  ]);
});

test('requires must name other items in the manifest', async t => {
  for (const [requires, pattern] of [
    [[], /^sample-skill: requires must be a non-empty list of item names$/],
    ['sample-skill', /^sample-skill: requires must be a non-empty list of item names$/],
    [['sample-skill'], /^sample-skill: requires sample-skill, which is not another item in manifest\.json$/],
    [['missing', 'missing'], /^sample-skill: requires lists a name twice$/]
  ]) {
    hasError((await checkAgentKit(await createKit(t, { item: { requires } }))).errors, pattern);
  }
});

test('invocation policies are hashed, restricted to their own skill, and contain a boolean policy', async t => {
  const policy = 'policy:\n  allow_implicit_invocation: false\n';
  const policyPath = 'skills/sample-skill/agents/openai.yaml';
  const root = await createKit(t, {
    item: { invocationPolicy: { path: policyPath, sha256: hashText(policy) } }, files: { [policyPath]: policy }
  });
  assert.deepEqual((await checkAgentKit(root)).errors, []);
  await fs.writeFile(path.join(root, policyPath), 'policy:\n  allow_implicit_invocation: "false"\n');
  const invalid = (await checkAgentKit(root)).errors;
  hasError(invalid, /sha256/);
  hasError(invalid, /expected only policy.allow_implicit_invocation/);
  const escaped = await createKit(t, {
    item: { invocationPolicy: { path: '../outside.yaml', sha256: hashText(policy) } }
  });
  hasError((await checkAgentKit(escaped)).errors, /exact skill agents\/openai.yaml/);
});

test('the original four pairs retain their published versions and source hashes', async () => {
  const { manifest } = await checkAgentKit(repositoryKit);
  assert.deepEqual(manifest.items.slice(0, 4).map(item => [item.name, item.version, item.skill.sha256, item.agent.sha256]), [
    ['doc-driven-designer-v1', '1.3.0', 'c22d7f737ad7c6bc41096048236c01651a1be8b99063312bb885e1961477c9d4', 'da1c557ab7e62affe05753af95ffd36adc1d83d05bcfb7d35f8a7e7e53216378'],
    ['doc-driven-implementer-v1', '1.3.0', '7ed64b2e34812379b5ddb133423c317e9207f54193f5d532457b299927ef15a0', '3b38acafd4d244db808af94e791aae6f6841b32f3bc39798c04de40652b691af'],
    ['doc-driven-reviewer-v1', '1.5.0', 'a14f4d210e42c5d1d8b299feb515208a702cdfc14781cce2ded00cd34b6c6a71', 'fbbd578703a28031636aad66e64c40da0c907c877d9c7d444cafb366f6649ebd'],
    ['doc-driven-private-v1', '1.0.0', '6f6cb31afdc0ffd84aff345d3ec71e642fdb053f7bb0efeffb768a848b590461', '36e549f3ef9991d6c25f5343cbf924f329879f2acf515aa5e0904d03c14559d0']
  ]);
});

test('a valid kit passes and hashes ignore line endings, a BOM and trailing blank lines', async t => {
  const root = await createKit(t);
  assert.deepEqual((await checkAgentKit(root)).errors, []);
  assert.equal(hashText('﻿' + SKILL.replaceAll('\n', '\r\n') + '  \r\n\r\n'), hashText(SKILL));
  assert.notEqual(hashText(SKILL.replace('Body text.', 'Body text!')), hashText(SKILL));
});

test('a rule body hash matches a copy pasted without frontmatter', () => {
  assert.equal(hashText(parseFrontmatter(AGENT).body), hashText('# Sample rule\n\nFollow the sample.\n'));
});

test('agent rules accept only name and description', async t => {
  const agent = AGENT.replace('description:', 'model: fast\ndescription:');
  const { errors } = await checkAgentKit(await createKit(t, { agent }));
  hasError(errors, /^agents\/sample-skill\.md: frontmatter key model is not allowed$/);
});

test('names and versions must match the manifest', async t => {
  const skill = SKILL.replace('name: sample-skill', 'name: other-skill').replace('version: 1.2.0', 'version: 1.1.0');
  const { errors } = await checkAgentKit(await createKit(t, { skill }));
  hasError(errors, /SKILL\.md: frontmatter name must be sample-skill$/);
  hasError(errors, /SKILL\.md: metadata\.version must match manifest version 1\.2\.0$/);
});

test('a stale hash reports the value to record', async t => {
  const stale = '0'.repeat(64);
  const { errors } = await checkAgentKit(await createKit(t, {
    item: { skill: { path: 'skills/sample-skill/SKILL.md', sha256: stale } }
  }));
  assert.ok(errors.includes('skills/sample-skill/SKILL.md: sha256 is ' + hashText(SKILL) + ' but manifest.json lists ' + stale));
});

test('previous entries must be older and differ from the current files', async t => {
  const previous = [
    { version: '1.2.0', kind: 'skill', part: 'file', sha256: 'a'.repeat(64), source: 'test' },
    { version: '1.0.0', kind: 'agent', part: 'body', sha256: hashText(parseFrontmatter(AGENT).body), source: 'test' },
    { version: '1.0.0', kind: 'codex-agent', part: 'body', sha256: 'b'.repeat(64), source: 'test' }
  ];
  const { errors } = await checkAgentKit(await createKit(t, { item: { previous } }));
  hasError(errors, /previous\[0\]\.version must be lower than 1\.2\.0$/);
  hasError(errors, /previous\[1\] matches the current agent body$/);
  hasError(errors, /previous\[2\]\.part must be one of file$/);
});

test('unlisted files, unsafe YAML values and invalid UTF-8 are rejected', async t => {
  const skill = SKILL.replace('Use when testing the kit checker.', 'Use when: testing');
  const agent = Buffer.concat([Buffer.from(AGENT), Buffer.from([0xff])]);
  const { errors } = await checkAgentKit(await createKit(t, { skill, files: { 'notes.md': '# Notes\n' } }));
  hasError(errors, /^notes\.md: file is not listed in manifest\.json$/);
  hasError(errors, /SKILL\.md: frontmatter line 3 needs double quotes to stay valid YAML$/);
  const invalid = await checkAgentKit(await createKit(t, { files: { 'agents/sample-skill.md': agent } }));
  hasError(invalid.errors, /^agents\/sample-skill\.md: .*(encoded|invalid)/i);
});

test('symbolic links inside the kit are rejected', async t => {
  const root = await createKit(t);
  try {
    await fs.symlink(path.join(root, 'skills', 'sample-skill', 'SKILL.md'), path.join(root, 'linked.md'));
  } catch (error) {
    t.skip('symbolic links are unavailable: ' + error.code);
    return;
  }
  hasError((await checkAgentKit(root)).errors, /^linked\.md: only regular files are allowed$/);
});
