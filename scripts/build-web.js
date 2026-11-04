import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));

export async function buildWeb({ check = false } = {}) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: { app: 'src/web/app.js', styles: 'src/web/styles.css' },
    outdir: 'src/web/dist',
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    sourcemap: false,
    legalComments: 'none',
    write: false,
    logLevel: 'silent'
  });
  for (const file of result.outputFiles) {
    const existing = await fs.readFile(file.path).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
    if (existing?.equals(file.contents)) continue;
    if (check) throw new Error('Web assets are missing or outdated. Run npm run build:web.');
    await fs.mkdir(path.dirname(file.path), { recursive: true });
    const temporary = file.path + '.' + randomUUID() + '.tmp';
    try {
      await fs.writeFile(temporary, file.contents);
      await fs.rename(temporary, file.path);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  return result.outputFiles.map(file => ({ name: path.basename(file.path), bytes: file.contents.length }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/build-web.js [--check]');
  try {
    const files = await buildWeb({ check: args.includes('--check') });
    console.error((args.includes('--check') ? 'Checked' : 'Built') + ' web assets: ' +
      files.map(file => file.name + ' (' + file.bytes + ' bytes)').join(', '));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
