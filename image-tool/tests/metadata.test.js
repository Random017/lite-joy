import { describe, expect, it } from 'vitest';
import { patchJpegDpi, patchPngDpi, writeDpi } from '../src/core/metadata.js';

function jpegWithJfif(dpi = 72) {
  const hi = (dpi >> 8) & 0xff;
  const lo = dpi & 0xff;
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x01,
    0x00,
    hi,
    lo,
    hi,
    lo,
    0x00,
    0x00,
    0xff,
    0xd9,
  ]);
}

function minimalPng() {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(25);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, 13);
  ihdr.set([0x49, 0x48, 0x44, 0x52], 4);
  view.setUint32(8, 1);
  view.setUint32(12, 1);
  ihdr[16] = 8;
  ihdr[17] = 2;
  const iend = new Uint8Array([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return new Uint8Array([...signature, ...ihdr, ...iend]);
}

describe('DPI 元数据', () => {
  it('改写已有 JFIF APP0', async () => {
    const input = new Blob([jpegWithJfif(72)], { type: 'image/jpeg' });
    const output = await patchJpegDpi(input, 300);
    const bytes = new Uint8Array(await output.arrayBuffer());
    expect(bytes[13]).toBe(1);
    expect((bytes[14] << 8) | bytes[15]).toBe(300);
    expect((bytes[16] << 8) | bytes[17]).toBe(300);
  });

  it('没有 APP0 时插入标准 JFIF 段', async () => {
    const input = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
      type: 'image/jpeg',
    });
    const output = await patchJpegDpi(input, 300);
    const bytes = new Uint8Array(await output.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    expect(bytes[13]).toBe(1);
    expect((bytes[14] << 8) | bytes[15]).toBe(300);
  });

  it('为 PNG 在 IHDR 后插入 pHYs', async () => {
    const png = new Blob([minimalPng()], { type: 'image/png' });
    const output = await patchPngDpi(png, 300);
    const bytes = new Uint8Array(await output.arrayBuffer());
    const type = String.fromCharCode(...bytes.slice(37, 41));
    expect(type).toBe('pHYs');
    const ppu = new DataView(bytes.buffer, bytes.byteOffset).getUint32(41);
    expect(ppu).toBe(Math.round(300 / 0.0254));
    expect(bytes[49]).toBe(1);
  });

  it('WebP 不写 DPI，直接返回原 Blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
    expect(await writeDpi(blob, 'image/webp', 300)).toBe(blob);
  });
});
