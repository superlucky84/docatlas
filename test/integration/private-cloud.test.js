import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../../', import.meta.url));

async function npm(args, cwd) {
  const cli = process.env.npm_execpath;
  const env = { ...process.env };
  if (env.DOCMAP_NPM_CACHE) env.npm_config_cache = env.DOCMAP_NPM_CACHE;
  return execute(cli ? process.execPath : 'npm', cli ? [cli, ...args] : args,
    { cwd, env, timeout: 60000, maxBuffer: 2 ** 20 });
}

test('F-11: production tarball installs the optional pair and round-trips named, tagged, selected private backups', { timeout: 120000 }, async t => {
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'docatlas-cloud-package-')));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const [pack] = JSON.parse((await npm(['pack', '--json', '--pack-destination', temporary], repository)).stdout);
  for (const name of [
    'src/private-cloud/command.js', 'src/private-cloud/archive.js',
    'agent-kit/skills/doc-driven-backup-v1/SKILL.md',
    'agent-kit/skills/doc-driven-backup-v1/agents/openai.yaml', 'agent-kit/agents/doc-driven-backup-v1.md'
  ]) assert.ok(pack.files.some(file => file.path === name), name);
  const install = path.join(temporary, 'installed');
  await fs.mkdir(install);
  await fs.writeFile(path.join(install, 'package.json'), '{"private":true}\n');
  await npm(['install', '--offline', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund',
    path.join(temporary, pack.filename)], install);
  const executable = path.join(install, 'node_modules', 'docatlas', 'bin', 'docatlas.js');
  const homes = [path.join(temporary, '집 홈'), path.join(temporary, '회사 홈')];
  const roots = [path.join(temporary, '집 작업'), path.join(temporary, '회사 작업')];
  const cloud = path.join(temporary, 'cloud folder');
  for (const directory of [...homes, ...roots, cloud]) await fs.mkdir(directory);
  const gitConfig = path.join(temporary, 'gitconfig');
  await fs.writeFile(gitConfig, '');
  const env = machine => ({
    ...process.env, HOME: homes[machine], USERPROFILE: homes[machine],
    GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: '1', GIT_CEILING_DIRECTORIES: temporary
  });
  for (let index = 0; index < roots.length; index++) {
    await execute('git', ['init', '-q', roots[index]], { env: env(index) });
    await execute('git', ['-C', roots[index], 'remote', 'add', 'origin',
      index ? 'git@example.com:team/shop.git' : 'https://example.com/team/shop.git'], { env: env(index) });
  }
  const cli = async (machine, args) => {
    try {
      const result = await execute(process.execPath, [executable, ...args],
        { cwd: roots[machine], env: env(machine), timeout: 30000 });
      return { code: 0, ...result };
    } catch (error) {
      return { code: error.code, stdout: error.stdout, stderr: error.stderr };
    }
  };
  const call = async (machine, args) => {
    const result = await cli(machine, ['private-cloud', ...args]);
    return { ...result, value: JSON.parse(result.stdout) };
  };
  await fs.mkdir(path.join(homes[0], '.agents'));
  const installedPair = await cli(0, ['agents', 'install', '--only', 'doc-driven-backup-v1', '--target', 'codex']);
  assert.equal(installedPair.code, 0, installedPair.stderr);
  assert.match(installedPair.stdout, /summary\tcreate=3/);
  assert.equal(await fs.readFile(path.join(homes[0], '.agents/skills/doc-driven-backup-v1/agents/openai.yaml'), 'utf8'),
    'policy:\n  allow_implicit_invocation: false\n');
  assert.equal((await cli(0, ['private', 'init'])).code, 0);
  await fs.mkdir(path.join(roots[0], '.docatlas/private/a'));
  await fs.mkdir(path.join(roots[0], '.docatlas/private/b'));
  await fs.writeFile(path.join(roots[0], '.docatlas/private/a/REQUIREMENTS.md'), '# A\n');
  await fs.writeFile(path.join(roots[0], '.docatlas/private/b/DESIGN.md'), '# B\n');
  assert.equal((await call(0, ['connect', '--directory', cloud, '--name', 'personal'])).code, 0);
  const prepared = await call(0, ['backup', '--name', 'personal', '--tag', 'v1', '--path', 'a']);
  assert.equal(prepared.code, 0, prepared.stdout);
  assert.equal(prepared.value.remoteStatus, 'unknown');
  assert.deepEqual(prepared.value.selection, ['a']);
  const discovered = await call(1, ['projects', '--directory', cloud]);
  assert.deepEqual(discovered.value.projects, [{ projectKey: 'example.com/team/shop', name: 'personal', bundles: 1 }]);
  assert.equal((await cli(1, ['private', 'init'])).code, 0);
  await fs.mkdir(path.join(roots[1], '.docatlas/private/c'));
  await fs.writeFile(path.join(roots[1], '.docatlas/private/c/IMPLEMENT.md'), '# C stays\n');
  const preview = await call(1, ['restore', '--directory', cloud, '--name', 'personal', '--tag', 'v1']);
  assert.equal(preview.value.status, 'preview');
  await assert.rejects(fs.access(path.join(roots[1], '.docatlas/private/a')), { code: 'ENOENT' });
  const applied = await call(1, ['restore', '--directory', cloud, '--name', 'personal', '--tag', 'v1', '--apply']);
  assert.equal(applied.code, 0, applied.stdout);
  assert.equal(await fs.readFile(path.join(roots[1], '.docatlas/private/a/REQUIREMENTS.md'), 'utf8'), '# A\n');
  assert.equal(await fs.readFile(path.join(roots[1], '.docatlas/private/c/IMPLEMENT.md'), 'utf8'), '# C stays\n');
  await assert.rejects(fs.access(path.join(roots[1], '.docatlas/private/b')), { code: 'ENOENT' });
  assert.equal((await execute('git', ['-C', roots[1], 'status', '--porcelain'], { env: env(1) })).stdout, '');
  assert.equal((await call(1, ['status', '--name', 'personal'])).value.local, 'same');
});
