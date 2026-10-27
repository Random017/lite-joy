import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173/lite-joy/image-tool/';
const artifactDir = path.resolve('test-artifacts');
await fs.mkdir(artifactDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(input) {
  let crc = 0xffffffff;
  for (const byte of input) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function makeNoisePng(width, height) {
  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);
  let seed = 0x5eed1234;
  for (let row = 0; row < height; row += 1) {
    raw[row * rowSize] = 0;
    for (let column = 1; column < rowSize; column += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      raw[row * rowSize + column] = seed >>> 24;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

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
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (marker === 0xe0 && bytes.toString('ascii', offset + 4, offset + 8) === 'JFIF') {
      dpi = bytes.readUInt16BE(offset + 12);
    }
    if (marker >= 0xc0 && marker <= 0xc3) {
      height = bytes.readUInt16BE(offset + 5);
      width = bytes.readUInt16BE(offset + 7);
    }
    offset += 2 + length;
  }
  return { width, height, dpi };
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack ?? error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.goto(base, { waitUntil: 'networkidle' });
await page.setInputFiles('#file-input', {
  name: 'noise-600x800.png',
  mimeType: 'image/png',
  buffer: makeNoisePng(600, 800),
});
await page.waitForFunction(() => window.__LITE_PHOTO__?.store.getState().source);
const source = await page.evaluate(() => {
  const state = window.__LITE_PHOTO__.store.getState();
  return { source: [state.source.width, state.source.height] };
});
console.log('compression source', source);
if (source.source[0] !== 600 || source.source[1] !== 800) {
  errors.push(`noise source mismatch: ${JSON.stringify(source.source)}`);
}

await page.click('.tool-rail [data-tool="export"]');
await page.selectOption('#format-select', 'image/jpeg');
await page.fill('#target-kb', '30');
await page.waitForTimeout(350);
const estimate = await page.evaluate(() => document.querySelector('#estimate-value')?.textContent);
console.log('estimate', estimate);

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 120000 }),
  page.click('#export-button'),
]);
const file = path.join(artifactDir, `compressed-${download.suggestedFilename()}`);
await download.saveAs(file);
await page.waitForFunction(() => !window.__LITE_PHOTO__.store.getState().ui.busy);
const bytes = await fs.readFile(file);
const info = jpegInfo(bytes);
console.log('compressed', info, bytes.length);
await page.screenshot({ path: path.join(artifactDir, 'compression-result.png'), fullPage: true });

if (bytes.length > 30 * 1024) errors.push(`compressed size ${bytes.length} > 30 KB`);
if (info.dpi !== 300) errors.push(`compressed dpi ${info.dpi}`);
if (info.width > 600 || info.height > 800) errors.push(`compressed dimensions grew: ${info.width}x${info.height}`);
const ratio = info.width / info.height;
if (Math.abs(ratio - 0.75) > 0.01) errors.push(`compressed ratio ${ratio}`);

await page.fill('#target-kb', '');
await page.selectOption('#format-select', 'image/webp');
await page.waitForTimeout(250);
const [webpDownload] = await Promise.all([
  page.waitForEvent('download', { timeout: 120000 }),
  page.click('#export-button'),
]);
const webpFile = path.join(artifactDir, `webp-${webpDownload.suggestedFilename()}`);
await webpDownload.saveAs(webpFile);
await page.waitForFunction(() => !window.__LITE_PHOTO__.store.getState().ui.busy);
const webpBytes = await fs.readFile(webpFile);
console.log('webp export', webpDownload.suggestedFilename(), webpBytes.length);
if (webpBytes.toString('ascii', 0, 4) !== 'RIFF' || webpBytes.toString('ascii', 8, 12) !== 'WEBP') {
  errors.push('webp export has no RIFF/WEBP header');
}

console.log('errors', JSON.stringify(errors, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
