import { describe, expect, it } from 'vitest';
import {
  getPreset,
  PRESETS,
  presetAspect,
  presetMmFromPixels,
  presetPixelsFromMm,
} from '../src/core/presets.js';

describe('证件照规格', () => {
  it('包含常见规格且像素与毫米一致', () => {
    const ids = PRESETS.map((preset) => preset.id);
    expect(ids).toContain('one-inch');
    expect(ids).toContain('two-inch');
    expect(ids).toContain('civil-servant');
    expect(ids).toContain('accounting');
    expect(ids).toContain('social-security');
    expect(ids).toHaveLength(15);
  });

  it.each([
    ['one-inch', 295, 413, 300],
    ['small-one-inch', 260, 378, 300],
    ['large-one-inch', 390, 567, 300],
    ['two-inch', 413, 579, 300],
    ['small-two-inch', 413, 531, 300],
    ['large-two-inch', 413, 626, 300],
    ['civil-servant', 295, 413, 300],
    ['accounting', 295, 413, 300],
    ['social-security', 358, 441, 350],
    ['postgraduate', 480, 640, 300],
  ])('%s 的像素值正确', (id, width, height, dpi) => {
    const preset = getPreset(id);
    expect(preset.width).toBe(width);
    expect(preset.height).toBe(height);
    expect(preset.dpi).toBe(dpi);
    expect(presetPixelsFromMm(preset.mmWidth, preset.mmHeight, preset.dpi)).toEqual({
      width,
      height,
    });
  });

  it('像素转毫米保留一位小数', () => {
    expect(presetMmFromPixels(295, 413, 300)).toEqual({ mmWidth: 25, mmHeight: 35 });
  });

  it('宽高比由像素计算', () => {
    expect(presetAspect(getPreset('one-inch'))).toBeCloseTo(295 / 413, 8);
  });

  it('社保规格带常见体积范围', () => {
    const preset = getPreset('social-security');
    expect(preset.minKB).toBe(14);
    expect(preset.maxKB).toBe(40);
  });
});
