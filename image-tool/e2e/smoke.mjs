import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173/lite-joy/image-tool/';
const artifactDir = path.resolve('test-artifacts');
await fs.mkdir(artifactDir, { recursive: true });
const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/portrait.png');

function jpegInfo(bytes) {
  let offset = 2;
  let width = 0;
  let height = 0;
  let dpi = 0;
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
    if (marker === 0xe0 && String.fromCharCode(...bytes.slice(offset + 4, offset + 9)) === 'JFIF\0') {
      const units = bytes[offset + 11];
      if (units === 1) dpi = (bytes[offset + 12] << 8) | bytes[offset + 13];
    }
    offset += 2 + length;
  }
  return { width, height, dpi };
}

function pngInfo(bytes) {
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const index = bytes.indexOf(Buffer.from('pHYs'));
  const dpi = index >= 0 ? Math.round(bytes.readUInt32BE(index + 4) * 0.0254) : 0;
  return { width, height, dpi };
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const baseOrigin = new URL(base).origin;
const page = await browser.newPage({ viewport: { width: 1440, height: 920 }, acceptDownloads: true });
page.on('request', (request) => {
  const url = new URL(request.url());
  if (url.origin !== baseOrigin) errors.push(`external request: ${request.url()}`);
  if (request.method() !== 'GET') errors.push(`non-GET request: ${request.method()} ${request.url()}`);
});
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack ?? error.message}`));

async function downloadFrom(label) {
  await page.click('.tool-rail [data-tool="export"]');
  await page.waitForTimeout(150);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('#export-button'),
  ]);
  const filename = path.join(artifactDir, `${label}-${download.suggestedFilename()}`);
  await download.saveAs(filename);
  const bytes = await fs.readFile(filename);
  await page.waitForFunction(() => !window.__LITE_PHOTO__.store.getState().ui.busy, null, {
    timeout: 60000,
  });
  return { bytes, filename: download.suggestedFilename() };
}

await page.goto(base, { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(artifactDir, 'desktop-empty.png'), fullPage: true });
const emptyLayout = await page.evaluate(() => ({
  emptyVisible: !document.querySelector('#empty-state').hidden,
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  canvas: document.querySelector('canvas')?.getBoundingClientRect().toJSON(),
}));
console.log('empty layout', emptyLayout);

await page.setInputFiles('#file-input', {
  name: 'not-an-image.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('not an image'),
});
await page.waitForTimeout(300);
const rejected = await page.evaluate(() => ({
  source: Boolean(window.__LITE_PHOTO__.store.getState().source),
  toast: document.querySelector('.toast')?.textContent ?? '',
}));
console.log('invalid file', rejected);
if (rejected.source) errors.push('invalid file was accepted');
if (!rejected.toast.includes('仅支持')) errors.push(`invalid file toast: ${rejected.toast}`);

await page.setInputFiles('#file-input', fixture);
await page.waitForFunction(() => window.__LITE_PHOTO__?.store.getState().source);
await page.waitForTimeout(800);
const imported = await page.evaluate(() => {
  const state = window.__LITE_PHOTO__.store.getState();
  const derived = window.__LITE_PHOTO__.getDerived();
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const pixel = ctx.getImageData(Math.round(canvas.width / 2), Math.round(canvas.height / 2), 1, 1).data;
  return {
    source: [state.source.width, state.source.height],
    output: [derived.outputWidth, derived.outputHeight],
    coverage: derived.coverage,
    stage: state.stage,
    pixel: [...pixel],
    emptyHidden: document.querySelector('#empty-state').hidden,
  };
});
console.log('imported', imported);
await page.screenshot({ path: path.join(artifactDir, 'desktop-editor.png'), fullPage: true });

await page.click('.tool-rail [data-tool="preset"]');
await page.click('[data-preset="one-inch"]');
await page.waitForTimeout(600);
const presetState = await page.evaluate(() => {
  const state = window.__LITE_PHOTO__.store.getState();
  const derived = window.__LITE_PHOTO__.getDerived();
  return {
    preset: state.output.presetId,
    output: [derived.outputWidth, derived.outputHeight],
    coverage: derived.coverage,
    target: state.encode.targetKB,
  };
});
console.log('one-inch', presetState);
await page.screenshot({ path: path.join(artifactDir, 'desktop-preset.png'), fullPage: true });

await page.click('.tool-rail [data-tool="export"]');
await page.waitForTimeout(300);
const jpeg = await downloadFrom('one-inch');
const jpegParsed = jpegInfo(jpeg.bytes);
console.log('jpeg', jpeg.filename, jpeg.bytes.length, jpegParsed);
if (jpegParsed.width !== 295 || jpegParsed.height !== 413 || jpegParsed.dpi !== 300) {
  errors.push(`JPEG metadata mismatch: ${JSON.stringify(jpegParsed)}`);
}

await page.selectOption('#format-select', 'image/png');
await page.waitForTimeout(200);
const png = await downloadFrom('one-inch-png');
const pngParsed = pngInfo(png.bytes);
console.log('png', png.filename, png.bytes.length, pngParsed);
if (pngParsed.width !== 295 || pngParsed.height !== 413 || pngParsed.dpi !== 300) {
  errors.push(`PNG metadata mismatch: ${JSON.stringify(pngParsed)}`);
}

await page.selectOption('#format-select', 'image/jpeg');
await page.click('.tool-rail [data-tool="preset"]');
await page.waitForTimeout(200);
await page.click('[data-preset="social-security"]');
await page.waitForTimeout(500);
const socialState = await page.evaluate(() => {
  const state = window.__LITE_PHOTO__.store.getState();
  return {
    preset: state.output.presetId,
    target: state.encode.targetKB,
    min: state.encode.minKB,
    dpi: state.output.dpi,
    format: state.encode.format,
  };
});
console.log('social', socialState);
const social = await downloadFrom('social');
const socialParsed = jpegInfo(social.bytes);
console.log('social file', social.filename, social.bytes.length, socialParsed);
if (social.bytes.length > 40 * 1024) errors.push('social export exceeds 40KB');
if (socialParsed.width !== 358 || socialParsed.height !== 441 || socialParsed.dpi !== 350) {
  errors.push(`social metadata mismatch: ${JSON.stringify(socialParsed)}`);
}

await page.click('.tool-rail [data-tool="crop"]');
await page.click('[data-ratio="free"]');
await page.waitForTimeout(300);
const beforeCrop = await page.evaluate(() => window.__LITE_PHOTO__.getDerived().outputWidth);
const handle = await page.locator('[data-handle="se"]').boundingBox();
console.log('crop handle', handle, await page.evaluate(() => {
  const h = document.querySelector('[data-handle="se"]').getBoundingClientRect();
  const hit = document.elementFromPoint(h.x + h.width / 2, h.y + h.height / 2);
  return { hit: hit?.className, toast: document.querySelector('.toast-stack').getBoundingClientRect().toJSON() };
}));
if (!handle) errors.push('SE crop handle not visible');
else {
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x - 70, handle.y - 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}
const afterCrop = await page.evaluate(() => {
  const state = window.__LITE_PHOTO__.store.getState();
  return {
    width: window.__LITE_PHOTO__.getDerived().outputWidth,
    crop: state.crop,
  };
});
console.log('free crop', beforeCrop, afterCrop);
if (!(afterCrop.width < beforeCrop)) errors.push('free crop did not shrink output');

await page.click('.tool-rail [data-tool="rotate"]');
await page.click('[data-rotate="90"]');
await page.waitForTimeout(300);
const rotated = await page.evaluate(() => window.__LITE_PHOTO__.store.getState().view.rotation);
console.log('rotation', rotated);
if (rotated !== 90) errors.push(`rotation expected 90, got ${rotated}`);
await page.screenshot({ path: path.join(artifactDir, 'desktop-rotated.png'), fullPage: true });

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
});
mobile.on('request', (request) => {
  const url = new URL(request.url());
  if (url.origin !== baseOrigin) errors.push(`mobile external request: ${request.url()}`);
  if (request.method() !== 'GET') errors.push(`mobile non-GET request: ${request.method()} ${request.url()}`);
});
mobile.on('console', (message) => {
  if (message.type() === 'error') errors.push(`mobile console: ${message.text()}`);
});
mobile.on('pageerror', (error) => errors.push(`mobile pageerror: ${error.stack ?? error.message}`));
await mobile.goto(base, { waitUntil: 'networkidle' });
await mobile.screenshot({ path: path.join(artifactDir, 'mobile-empty.png'), fullPage: true });
const mobileEmpty = await mobile.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  panelDisplay: getComputedStyle(document.querySelector('.panel')).display,
  stage: document.querySelector('#stage').getBoundingClientRect().toJSON(),
  tabs: getComputedStyle(document.querySelector('.mobile-tabs')).display,
}));
console.log('mobile empty', mobileEmpty);
if (mobileEmpty.overflow > 0) errors.push(`mobile empty overflows by ${mobileEmpty.overflow}`);

await mobile.setInputFiles('#file-input', fixture);
await mobile.waitForFunction(() => window.__LITE_PHOTO__?.store.getState().source);
await mobile.waitForTimeout(700);
await mobile.screenshot({ path: path.join(artifactDir, 'mobile-editor.png'), fullPage: true });
const mobileLoaded = await mobile.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  panelDisplay: getComputedStyle(document.querySelector('.panel')).display,
  stage: document.querySelector('#stage').getBoundingClientRect().toJSON(),
  panel: document.querySelector('.panel').getBoundingClientRect().toJSON(),
}));
console.log('mobile loaded', mobileLoaded);
if (mobileLoaded.overflow > 0) errors.push(`mobile editor overflows by ${mobileLoaded.overflow}`);

const mobileInitial = await mobile.evaluate(() => {
  const state = window.__LITE_PHOTO__.store.getState();
  const derived = window.__LITE_PHOTO__.getDerived();
  return {
    crop: state.crop,
    output: [derived.outputWidth, derived.outputHeight],
    coverage: derived.coverage,
    tabs: getComputedStyle(document.querySelector('.mobile-tabs')).display,
  };
});
console.log('mobile initial', mobileInitial);
if (Math.abs(mobileInitial.output[0] / mobileInitial.output[1] - 0.75) > 0.02) {
  errors.push(`mobile initial crop lost portrait ratio: ${JSON.stringify(mobileInitial.output)}`);
}
if (mobileInitial.coverage < 0.99) {
  errors.push(`mobile initial crop coverage ${mobileInitial.coverage}`);
}
if (mobileInitial.tabs === 'none') errors.push('mobile tabs not shown after import');

await mobile.click('.mobile-tab[data-tool="preset"]');
await mobile.click('[data-preset="two-inch"]');
await mobile.waitForTimeout(600);
const mobilePreset = await mobile.evaluate(() => {
  const state = window.__LITE_PHOTO__.store.getState();
  const derived = window.__LITE_PHOTO__.getDerived();
  return {
    preset: state.output.presetId,
    output: [derived.outputWidth, derived.outputHeight],
    panel: document.querySelector('.panel').getBoundingClientRect().toJSON(),
    stage: document.querySelector('#stage').getBoundingClientRect().toJSON(),
  };
});
console.log('mobile preset', mobilePreset);
if (mobilePreset.output[0] !== 413 || mobilePreset.output[1] !== 579) {
  errors.push(`mobile two-inch mismatch: ${JSON.stringify(mobilePreset.output)}`);
}
await mobile.screenshot({ path: path.join(artifactDir, 'mobile-preset.png'), fullPage: true });

await mobile.click('.mobile-tab[data-tool="export"]');
await mobile.waitForTimeout(200);
const [mobileDownload] = await Promise.all([
  mobile.waitForEvent('download', { timeout: 60000 }),
  mobile.click('#export-button'),
]);
const mobileFile = path.join(artifactDir, `mobile-${mobileDownload.suggestedFilename()}`);
await mobileDownload.saveAs(mobileFile);
const mobileBytes = await fs.readFile(mobileFile);
const mobileParsed = jpegInfo(mobileBytes);
console.log('mobile export', mobileParsed, mobileBytes.length);
if (mobileParsed.width !== 413 || mobileParsed.height !== 579) {
  errors.push(`mobile export metadata mismatch: ${JSON.stringify(mobileParsed)}`);
}
await mobile.waitForFunction(() => !window.__LITE_PHOTO__.store.getState().ui.busy);

console.log('errors', JSON.stringify(errors, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
