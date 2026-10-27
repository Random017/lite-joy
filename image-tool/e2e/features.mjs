import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173/lite-joy/image-tool/';
const outDir = path.resolve('test-artifacts');
const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/portrait.png');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 920 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

function jpegInfo(bytes) {
  let offset = 2;
  let width = 0;
  let height = 0;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      width = (bytes[offset + 7] << 8) | bytes[offset + 8];
    }
    offset += 2 + length;
  }
  return { width, height };
}

async function download(label) {
  await page.click('.tool-rail [data-tool="export"]');
  await page.waitForTimeout(150);
  const [item] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('#export-button'),
  ]);
  const file = path.join(outDir, `${label}-${item.suggestedFilename()}`);
  await item.saveAs(file);
  const bytes = await fs.readFile(file);
  await page.waitForFunction(() => !window.__LITE_PHOTO__.store.getState().ui.busy);
  return { bytes, file };
}

await page.goto(base, { waitUntil: 'networkidle' });
await page.setInputFiles('#file-input', fixture);
await page.waitForFunction(() => window.__LITE_PHOTO__?.store.getState().source);

await page.click('.tool-rail [data-tool="preset"]');
await page.fill('#custom-mm-width', '35');
await page.fill('#custom-mm-height', '45');
await page.selectOption('#custom-dpi', '300');
await page.click('#apply-custom');
await page.waitForTimeout(300);
const custom = await page.evaluate(() => {
  const s = window.__LITE_PHOTO__.store.getState();
  const d = window.__LITE_PHOTO__.getDerived();
  return {
    mode: s.output.mode,
    output: [d.outputWidth, d.outputHeight],
    cropAspect: s.crop.aspect,
    dpi: s.output.dpi,
  };
});
console.log('custom', custom);
if (custom.mode !== 'custom' || custom.output[0] !== 413 || custom.output[1] !== 531) {
  errors.push(`custom size mismatch: ${JSON.stringify(custom)}`);
}

await page.click('.tool-rail [data-tool="export"]');
await page.fill('#output-width', '600');
await page.locator('#output-width').press('Tab');
await page.waitForTimeout(300);
const resized = await page.evaluate(() => {
  const s = window.__LITE_PHOTO__.store.getState();
  const d = window.__LITE_PHOTO__.getDerived();
  return { mode: s.output.mode, output: [d.outputWidth, d.outputHeight], cropAspect: s.crop.aspect };
});
console.log('resized', resized);
if (resized.output[0] !== 600 || resized.output[1] !== 771) {
  errors.push(`output width ratio mismatch: ${JSON.stringify(resized)}`);
}

await page.click('.tool-rail [data-tool="crop"]');
await page.click('[data-action="reset-crop"]');
await page.click('.tool-rail [data-tool="rotate"]');
await page.click('[data-rotate="90"]');
await page.click('.tool-rail [data-tool="crop"]');
await page.click('[data-action="reset-crop"]');
await page.waitForTimeout(300);
const rotated = await page.evaluate(() => {
  const s = window.__LITE_PHOTO__.store.getState();
  const d = window.__LITE_PHOTO__.getDerived();
  return {
    rotation: s.view.rotation,
    output: [d.outputWidth, d.outputHeight],
    crop: s.crop,
    coverage: d.coverage,
  };
});
console.log('rotated', rotated);
if (rotated.rotation !== 90) errors.push('rotation is not 90');
if (rotated.output[0] !== 1200 || rotated.output[1] !== 900) {
  errors.push(`rotated output mismatch: ${JSON.stringify(rotated.output)}`);
}
const rotatedFile = await download('rotated');
const rotatedInfo = jpegInfo(rotatedFile.bytes);
console.log('rotated jpeg', rotatedInfo, rotatedFile.bytes.length);
if (rotatedInfo.width !== 1200 || rotatedInfo.height !== 900) {
  errors.push(`rotated jpeg mismatch: ${JSON.stringify(rotatedInfo)}`);
}

console.log('errors', JSON.stringify(errors, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
