import { test, expect } from '@playwright/test';
import { startServer } from '../../src/server/index.js';
import { createProject } from '../helpers/projects.js';

let app;
const cleanups = [];

test.beforeAll(async () => {
  const project = await createProject({ after: fn => cleanups.push(fn) }, {
    'docs/catalog/REQUIREMENTS.md': '# Catalog — Requirements\n\nPublic catalog plan.\n',
    '.docatlas/private/payments/REQUIREMENTS.md': '# Payments — Requirements\n\nSecret refund plan.\n',
    '.docatlas/private/payments/DESIGN.md': '# Payments — Design\n\nLedger notes.\n',
    '.docatlas/agents.json': '{}\n'
  });
  app = await startServer({ root: project.root });
});

test.afterAll(async () => {
  if (app) await app.close();
  for (const cleanup of cleanups) await cleanup();
});

test.beforeEach(async ({ page }) => { await page.goto(app.url); });

test('private documents appear in a marked Private group and the reader marks them', async ({ page }) => {
  const privateItem = page.locator('.tree-item').filter({ has: page.locator('.structure-title', { hasText: /^Private$/ }) });
  await expect(privateItem.locator('> .tree-row .private-badge')).toHaveText('Only on this computer');
  await expect(privateItem.locator('> .tree-row')).toHaveClass(/is-private/);
  await page.getByRole('button', { name: 'Show documents for Payments', exact: true }).click();
  const documents = page.getByRole('group', { name: 'Documents for Payments', exact: true });
  await expect(documents.getByRole('button')).toHaveCount(2);
  await documents.getByRole('button', { name: 'Requirements', exact: true }).click();
  await expect(page.locator('#document-title')).toHaveText('Payments — Requirements');
  await expect(page.locator('#document-private')).toBeVisible();
  await expect(page.locator('#document-private')).toHaveText('Private');

  await page.getByRole('button', { name: 'Show documents for Catalog', exact: true }).click();
  await page.getByRole('group', { name: 'Documents for Catalog', exact: true })
    .getByRole('button', { name: 'Requirements', exact: true }).click();
  await expect(page.locator('#document-title')).toHaveText('Catalog — Requirements');
  await expect(page.locator('#document-private')).toBeHidden();
});

test('search results mark private documents only', async ({ page }) => {
  await page.locator('#doc-search').fill('plan');
  const results = page.locator('.search-result');
  await expect(results).toHaveCount(2);
  await expect(results.filter({ hasText: 'Payments — Requirements' }).locator('.private-badge')).toHaveText('Private');
  await expect(results.filter({ hasText: 'Catalog — Requirements' }).locator('.private-badge')).toHaveCount(0);
});
