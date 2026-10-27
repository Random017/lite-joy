import { describe, expect, it } from 'vitest';
import { buildFilename, timestampForFilename } from '../src/core/filename.js';

describe('导出文件名', () => {
  const now = new Date(2026, 9, 27, 15, 30);

  it('证件照使用 ASCII 规格与时间戳', () => {
    expect(
      buildFilename({
        mode: 'preset',
        presetId: 'one-inch',
        width: 295,
        height: 413,
        format: 'image/jpeg',
        now,
      }),
    ).toBe('lite-photo_one-inch_295x413_20261027-1530.jpg');
  });

  it('自定义尺寸不包含规格 id', () => {
    expect(
      buildFilename({
        mode: 'custom',
        width: 800,
        height: 600,
        format: 'image/png',
        now,
      }),
    ).toBe('lite-photo_800x600_20261027-1530.png');
  });

  it('WebP 扩展名正确', () => {
    expect(
      buildFilename({ mode: 'auto', width: 100, height: 100, format: 'image/webp', now }),
    ).toContain('.webp');
  });

  it('时间戳补零', () => {
    expect(timestampForFilename(new Date(2026, 0, 2, 3, 4))).toBe('20260102-0304');
  });
});
