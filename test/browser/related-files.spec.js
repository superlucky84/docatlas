import { test, expect } from '@playwright/test';
import { startServer } from '../../src/server/index.js';
import { createProject } from '../helpers/projects.js';
import { PHASE_PLAN, PHASE_FILES } from '../helpers/phase-records.js';

let app;
let project;
let cleanups = [];
test.beforeEach(async ({ page }) => {
  cleanups = [];
  project = await createProject({ after: fn => cleanups.push(fn) }, PHASE_FILES);
  app = await startServer({ root: project.root });
  await page.goto(app.url + '?doc=docs%2Fcheckout%2FDESIGN.md');
  await expect(page.locator('#document-title')).toHaveText('Checkout — Design');
  // Initial position and focus are applied on the frame after the content is rendered.
  await expect(page.locator('#document-content h1')).toBeFocused();
});
test.afterEach(async () => {
  await app?.close();
  for (const cleanup of cleanups) await cleanup();
});

test('related files filter and copy real records and navigate to the exact duplicate phase heading', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await expect(page.locator('#related-files-count')).toHaveText('5');
  await page.locator('#reader-scroll').evaluate(element => { element.scrollTop = 300; });
  await page.locator('#related-files-toggle').click();
  await expect(page.getByRole('dialog', { name: 'Related files 5', exact: true })).toBeVisible();
  await expect(page.locator('#files-scope')).toHaveText('From this feature’s implementation plan');
  await page.locator('#files-search').fill('session.js DC-1');
  await expect(page.locator('.file-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Copy path: src/checkout/session.js', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('src/checkout/session.js');
  await page.locator('.file-summary').click();
  await expect(page.locator('.file-phase-link')).toHaveCount(2);
  await page.locator('.file-phase-link').nth(1).click();
  await expect(page.locator('#related-files-dialog')).not.toBeVisible();
  await expect(page.locator('#document-title')).toHaveText('Checkout — Implementation');
  expect(decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe('work-1');
  await expect(page.locator('#heading-work-1')).toBeInViewport();
  await page.goBack();
  await expect(page.locator('#document-title')).toHaveText('Checkout — Design');
  await expect.poll(() => page.locator('#reader-scroll').evaluate(element => element.scrollTop)).toBe(300);
});

test('closing preserves source mode and scroll; an empty group is explained', async ({ page }) => {
  await page.getByRole('button', { name: 'View source', exact: true }).click();
  await page.locator('#reader-scroll').evaluate(element => { element.scrollTop = 230; });
  const before = page.url();
  await page.locator('#related-files-toggle').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#related-files-toggle')).toBeFocused();
  await expect(page.locator('#document-source')).toBeVisible();
  expect(page.url()).toBe(before);
  expect(await page.locator('#reader-scroll').evaluate(element => element.scrollTop)).toBe(230);
  await page.goto(app.url + '?doc=docs%2Funrelated%2FDESIGN.md');
  await page.locator('#related-files-toggle').click();
  await expect(page.locator('.files-empty')).toContainText('No file records yet');
});

test('a narrow screen has a usable full-width panel without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#related-files-toggle').click();
  await expect(page.locator('#files-search')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('#related-files-dialog').evaluate(element => element.getBoundingClientRect().width)).toBe(390);
  await page.locator('#files-search').fill('old.js');
  await expect(page.locator('.file-name')).toHaveText('cart.js');
  await page.locator('.file-summary').click();
  await expect(page.locator('.file-old-path')).toContainText('old.js → src/checkout/cart.js');
  await page.getByRole('button', { name: 'Close related files', exact: true }).click();
  await expect(page.locator('#document-content')).toBeVisible();
});

test('live updates keep the panel, filter, expanded evidence, and reader position', async ({ page }) => {
  await expect(page.locator('#live-status')).toHaveText('Live updates');
  await page.locator('#reader-scroll').evaluate(element => { element.scrollTop = 300; });
  await page.locator('#related-files-toggle').click();
  await page.locator('#files-search').fill('session.js');
  await page.locator('.file-summary').click();
  await project.write('docs/checkout/IMPLEMENT.md', PHASE_PLAN.replace('Files:', 'Files:\n- `src/checkout/guest-session.js` (added)'));
  await expect(page.locator('#related-files-count')).toHaveText('6');
  await expect(page.locator('#related-files-dialog')).toBeVisible();
  await expect(page.locator('#files-search')).toHaveValue('session.js');
  await expect(page.locator('.file-card')).toHaveCount(2);
  await expect(page.locator('details[data-path="src/checkout/session.js"]')).toHaveAttribute('open');
  await page.keyboard.press('Escape');
  expect(await page.locator('#reader-scroll').evaluate(element => element.scrollTop)).toBe(300);
});

test('the map search finds file records, explains the match, and keeps searching after opening a document', async ({ page }) => {
  const input = page.getByRole('searchbox', { name: 'Search documentation' });
  await input.fill('session.js');
  await expect(page.locator('#search-status')).toHaveText('2 documents');
  await expect(page.locator('.result-title')).toHaveText(['Checkout — Implementation', 'Checkout — Design']);
  await expect(page.locator('.result-file-path')).toHaveText(['src/checkout/session.js', 'src/checkout/session.js']);
  await expect(page.locator('.result-file-path mark')).toHaveText(['session.js', 'session.js']);
  await expect(page.locator('.result-file-label')).toHaveText(['File recorded here', 'File recorded for this feature']);
  await page.locator('.search-result').nth(1).click();
  await expect(page.locator('#document-title')).toHaveText('Checkout — Design');
  await expect(input).toHaveValue('session.js');
  await page.locator('#related-files-toggle').click();
  await expect(page.locator('details[data-path="src/checkout/session.js"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await input.fill('old.js');
  await expect(page.locator('.result-file-path')).toHaveText(['src/checkout/old.js', 'src/checkout/old.js']);
});

test('file search results follow saved phase records without losing the query or focus', async ({ page }) => {
  await expect(page.locator('#live-status')).toHaveText('Live updates');
  const input = page.getByRole('searchbox', { name: 'Search documentation' });
  await input.fill('session.js');
  await expect(page.locator('#search-status')).toHaveText('2 documents');
  await project.write('docs/checkout/IMPLEMENT.md', PHASE_PLAN.replaceAll('session.js', 'guest-token.js'));
  await expect(page.locator('#search-status')).toHaveText('No matching documents.');
  await expect(input).toHaveValue('session.js');
  await expect(input).toBeFocused();
  await input.fill('guest-token.js');
  await expect(page.locator('#search-status')).toHaveText('2 documents');
});

for (const control of ['phase link', 'document link', 'documentation group', 'copy fallback']) {
  test('live updates restore focus on the ' + control, async ({ page }) => {
    await expect(page.locator('#live-status')).toHaveText('Live updates');
    await page.locator('#related-files-toggle').click();
    let target;
    if (control === 'documentation group') {
      target = page.locator('.files-group > summary');
    } else if (control === 'document link') {
      await page.locator('#files-search').fill('IMPLEMENT.md');
      target = page.getByRole('link', { name: 'Open document ↗', exact: true });
    } else {
      await page.locator('#files-search').fill('session.js');
      if (control === 'phase link') {
        await page.locator('.file-summary').click();
        target = page.locator('.file-phase-link').nth(1);
      } else {
        await page.evaluate(() => {
          navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied for this test'); };
        });
        await page.getByRole('button', { name: 'Copy path: src/checkout/session.js', exact: true }).click();
        target = page.getByRole('textbox', { name: 'File path', exact: true });
      }
    }
    await target.focus();
    await expect(target).toBeFocused();
    await project.write('docs/checkout/IMPLEMENT.md', PHASE_PLAN.replace('Files:',
      'Files:\n- `src/checkout/focus-check.js` (added)'));
    await expect(page.locator('#related-files-count')).toHaveText('6');
    await expect(target).toBeFocused();
    expect(await page.evaluate(() => document.getElementById('related-files-dialog').contains(document.activeElement))).toBe(true);
    if (control === 'copy fallback') {
      expect(await target.evaluate(element => element.value.slice(element.selectionStart, element.selectionEnd)))
        .toBe('src/checkout/session.js');
    }
  });
}

test('a removed focused record returns focus to the panel filter', async ({ page }) => {
  await expect(page.locator('#live-status')).toHaveText('Live updates');
  await page.locator('#related-files-toggle').click();
  await page.locator('#files-search').fill('session.js');
  await page.locator('.file-summary').click();
  await page.locator('.file-phase-link').first().focus();
  await project.write('docs/checkout/IMPLEMENT.md', PHASE_PLAN.replace(/^- `src\/checkout\/session\.js`[^\n]*\n/gm, ''));
  await expect(page.locator('#related-files-count')).toHaveText('4');
  await expect(page.locator('#related-files-dialog')).toBeVisible();
  await expect(page.locator('#files-search')).toBeFocused();
  await expect(page.locator('.files-empty')).toContainText('No matching files');
});

test('closed panels defer their lists and reuse unchanged content when reopened', async ({ page }) => {
  await expect(page.locator('#live-status')).toHaveText('Live updates');
  await expect(page.locator('#files-list')).toBeEmpty();
  const changed = PHASE_PLAN.replace('Files:', 'Files:\n- `src/checkout/deferred.js` (added)');
  await project.write('docs/checkout/IMPLEMENT.md', changed);
  await expect(page.locator('#related-files-count')).toHaveText('6');
  await expect(page.locator('#files-list')).toBeEmpty();
  await page.locator('#related-files-toggle').click();
  await expect(page.locator('.file-card')).toHaveCount(6);
  await page.evaluate(() => { window.savedFileSummary = document.querySelector('.file-summary'); });
  await page.keyboard.press('Escape');
  await page.locator('#related-files-toggle').click();
  expect(await page.evaluate(() => window.savedFileSummary === document.querySelector('.file-summary'))).toBe(true);
  await page.keyboard.press('Escape');
  await project.write('docs/checkout/IMPLEMENT.md', changed.replace('Files:',
    'Files:\n- `src/checkout/latest.js` (added)'));
  await expect(page.locator('#related-files-count')).toHaveText('7');
  await expect(page.locator('#files-list')).toBeEmpty();
  await page.locator('#related-files-toggle').click();
  await expect(page.locator('.file-card')).toHaveCount(7);
});
