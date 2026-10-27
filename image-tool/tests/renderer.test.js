import { describe, expect, it } from 'vitest';
import { renderExport } from '../src/core/renderer.js';

function recorder() {
  const calls = [];
  const ctx = {
    fillStyle: '',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: '',
    setTransform: (...args) => calls.push(['setTransform', ...args]),
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    translate: (...args) => calls.push(['translate', ...args]),
    rotate: (...args) => calls.push(['rotate', ...args]),
    scale: (...args) => calls.push(['scale', ...args]),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    drawImage: (...args) => calls.push(['drawImage', ...args]),
  };
  return { ctx, calls };
}

describe('导出渲染', () => {
  it('把屏幕裁剪框映射到输出像素，而不是图片坐标', () => {
    const { ctx, calls } = recorder();
    const state = {
      source: { width: 1000, height: 800, bitmap: {} },
      stage: { width: 1000, height: 800 },
      view: { zoom: 1, panX: 0, panY: 0, rotation: 0, flipX: false, flipY: false },
      crop: { x: 0.2, y: 0.2, w: 0.6, h: 0.6, aspect: 1.25, presetId: null },
      output: { mode: 'preset', width: 300, height: 240, dpi: 300, presetId: null },
      encode: { format: 'image/jpeg', background: '#ffffff' },
    };

    const d = renderExport(ctx, state, 300, 240);
    const transforms = calls.filter(([name]) => name === 'setTransform');
    expect(transforms[0]).toEqual(['setTransform', 1, 0, 0, 1, 0, 0]);
    expect(transforms[1][1]).toBeCloseTo(0.5, 8);
    expect(transforms[1][2]).toBe(0);
    expect(transforms[1][3]).toBe(0);
    expect(transforms[1][4]).toBeCloseTo(0.5, 8);
    expect(transforms[1][5]).toBeCloseTo(-100, 8);
    expect(transforms[1][6]).toBeCloseTo(-80, 8);
    expect(d.cropScreen).toEqual({ x: 200, y: 160, w: 600, h: 480 });
    expect(d.cropImage.w).toBeCloseTo(638.297872, 6);
  });
});
