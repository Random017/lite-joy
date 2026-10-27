import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173/lite-joy/image-tool/';
const artifactDir = path.resolve('test-artifacts');
await fs.mkdir(artifactDir, { recursive: true });
const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/portrait.png');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
});
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack ?? error.message}`));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__LITE_PHOTO__));

const empty = await page.evaluate(() => {
  const quick = [...document.querySelectorAll('[data-empty-preset]')];
  const button = document.querySelector('.empty-actions .button');
  return {
    quickCount: quick.length,
    minQuickHeight: Math.min(...quick.map((item) => item.getBoundingClientRect().height)),
    buttonHeight: button.getBoundingClientRect().height,
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
});
console.log('mobile empty', empty);
if (empty.quickCount !== 4) errors.push(`expected 4 quick presets, got ${empty.quickCount}`);
if (empty.minQuickHeight < 44) errors.push(`quick preset too small: ${empty.minQuickHeight}`);
if (empty.buttonHeight < 44) errors.push(`empty action too small: ${empty.buttonHeight}`);
if (empty.overflow > 0) errors.push(`mobile empty overflows by ${empty.overflow}`);

const chooserPromise = page.waitForEvent('filechooser');
await page.click('[data-empty-preset="one-inch"]');
const chooser = await chooserPromise;
await chooser.setFiles(fixture);
await page.waitForFunction(
  () => window.__LITE_PHOTO__?.store.getState().output.presetId === 'one-inch',
);
await page.waitForTimeout(500);

const afterQuick = await page.evaluate(() => {
  const state = window.__LITE_PHOTO__.store.getState();
  const bar = document.querySelector('#panel-quick');
  const button = document.querySelector('#quick-export');
  return {
    preset: state.output.presetId,
    quickVisible: !bar.hidden && getComputedStyle(bar).display !== 'none',
    dims: document.querySelector('#quick-dims').textContent,
    sub: document.querySelector('#quick-sub').textContent,
    buttonHeight: button.getBoundingClientRect().height,
    tabFont: getComputedStyle(document.querySelector('.mobile-tab')).fontSize,
    inputFont: getComputedStyle(document.querySelector('#output-width')).fontSize,
  };
});
console.log('quick apply', afterQuick);
if (afterQuick.preset !== 'one-inch') errors.push('quick preset was not applied');
if (!afterQuick.quickVisible) errors.push('quick export bar is not visible');
if (!afterQuick.dims.includes('295')) errors.push(`quick dims unexpected: ${afterQuick.dims}`);
if (afterQuick.buttonHeight < 44) errors.push(`quick export too small: ${afterQuick.buttonHeight}`);
if (parseFloat(afterQuick.tabFont) < 12) errors.push(`mobile tab font too small: ${afterQuick.tabFont}`);
if (parseFloat(afterQuick.inputFont) < 16) errors.push(`input font too small: ${afterQuick.inputFont}`);

const sheetBefore = await page.$eval('.panel', (el) => el.getBoundingClientRect().height);
await page.click('#sheet-handle');
await page.waitForTimeout(300);
const sheetAfter = await page.evaluate(() => ({
  height: document.querySelector('.panel').getBoundingClientRect().height,
  expanded: document.querySelector('#sheet-handle').getAttribute('aria-expanded'),
  stage: document.querySelector('#stage').getBoundingClientRect().height,
}));
console.log('sheet', { sheetBefore, ...sheetAfter });
if (sheetAfter.height <= sheetBefore + 30) errors.push('sheet did not expand');
if (sheetAfter.expanded !== 'true') errors.push('sheet aria-expanded not updated');
if (sheetAfter.stage < 120) errors.push(`stage too small after expanding sheet: ${sheetAfter.stage}`);
await page.click('#sheet-handle');
await page.waitForTimeout(250);

const dragBefore = await page.$eval('.panel', (el) => el.getBoundingClientRect().height);
const handleBox = await page.locator('#sheet-handle').boundingBox();
await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
await page.mouse.down();
await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y - 90, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(300);
const dragAfter = await page.evaluate(() => ({
  height: document.querySelector('.panel').getBoundingClientRect().height,
  expanded: document.querySelector('#sheet-handle').getAttribute('aria-expanded'),
}));
console.log('sheet drag', { dragBefore, ...dragAfter });
if (dragAfter.height <= dragBefore + 30) errors.push('sheet did not expand when dragged up');
if (dragAfter.expanded !== 'true') errors.push('dragged sheet aria-expanded not updated');
await page.click('#sheet-handle');
await page.waitForTimeout(250);

await page.click('.mobile-tab[data-tool="preset"]');
await page.waitForTimeout(200);
const preset = await page.evaluate(() => {
  const grid = document.querySelector('#preset-groups .preset-grid');
  const quick = document.querySelector('#preset-quick');
  const card = quick.querySelector('.preset-card');
  return {
    columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    quickCount: quick.children.length,
    quickNameFont: getComputedStyle(card.querySelector('.preset-name')).fontSize,
    noticeAfterPresets: Boolean(
      document.querySelector('[data-panel="preset"] .preset-groups')?.compareDocumentPosition(
        document.querySelector('[data-panel="preset"] .notice'),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  };
});
console.log('preset layout', preset);
if (preset.columns !== 2) errors.push(`expected 2 preset columns, got ${preset.columns}`);
if (preset.quickCount !== 4) errors.push(`expected 4 quick cards, got ${preset.quickCount}`);
if (parseFloat(preset.quickNameFont) < 14) errors.push(`quick preset font too small: ${preset.quickNameFont}`);
if (!preset.noticeAfterPresets) errors.push('preset disclaimer is not after the preset lists');

await page.click('.mobile-tab[data-tool="export"]');
await page.waitForTimeout(150);
const exportTab = await page.evaluate(() => ({
  quickHidden: document.querySelector('#panel-quick').hidden,
  ctaHeight: document.querySelector('#export-button').getBoundingClientRect().height,
}));
console.log('export tab', exportTab);
if (!exportTab.quickHidden) errors.push('quick bar should hide on the export tab');
if (exportTab.ctaHeight < 44) errors.push(`export button too small: ${exportTab.ctaHeight}`);

await page.click('.mobile-tab[data-tool="crop"]');
await page.waitForTimeout(150);
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 60000 }),
  page.click('#quick-export'),
]);
const file = path.join(artifactDir, `mobile-ux-${download.suggestedFilename()}`);
await download.saveAs(file);
await page.waitForFunction(() => !window.__LITE_PHOTO__.store.getState().ui.busy);
const bytes = (await fs.stat(file)).size;
console.log('quick export', download.suggestedFilename(), bytes);
if (!download.suggestedFilename().includes('one-inch')) {
  errors.push(`quick export filename mismatch: ${download.suggestedFilename()}`);
}
if (bytes < 1000) errors.push(`quick export too small: ${bytes}`);

await page.screenshot({ path: path.join(artifactDir, 'mobile-ux.png'), fullPage: true });
console.log('errors', JSON.stringify(errors, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
