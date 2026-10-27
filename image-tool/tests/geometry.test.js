import { describe, expect, it } from 'vitest';
import {
  clampOutputSize,
  computeView,
  coverZoomForCrop,
  cropRectForAspect,
  ensureCropAspect,
  panForZoomAnchor,
  rotatedBounds,
  screenCropToImage,
} from '../src/core/geometry.js';

describe('旋转包围盒', () => {
  it('90° 交换宽高', () => {
    expect(rotatedBounds(1200, 1600, 90)).toEqual({ rw: 1600, rh: 1200 });
  });

  it('45° 使用绝对三角函数', () => {
    const result = rotatedBounds(100, 100, 45);
    expect(result.rw).toBeCloseTo(141.4213562373095, 8);
    expect(result.rh).toBeCloseTo(141.4213562373095, 8);
  });
});

describe('屏幕裁剪框反算', () => {
  it('与 translate/scale 对应', () => {
    const cropImage = screenCropToImage({
      crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
      stageW: 1000,
      stageH: 800,
      originX: 100,
      originY: 80,
      scale: 0.8,
    });
    expect(cropImage).toEqual({ x: 187.5, y: 150, w: 625, h: 500 });
  });
});

describe('比例与适配', () => {
  it('按屏幕比例生成裁剪框', () => {
    const crop = cropRectForAspect(3 / 4, 1000, 800, 0.8);
    expect((crop.w * 1000) / (crop.h * 800)).toBeCloseTo(3 / 4, 6);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
  });

  it('保持中心调整比例并夹在画布内', () => {
    const crop = ensureCropAspect({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, 1, 1000, 800);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect((crop.w * 1000) / (crop.h * 800)).toBeCloseTo(1, 6);
  });

  it('证件照覆盖缩放让裁剪框被照片铺满', () => {
    const crop = cropRectForAspect(295 / 413, 1000, 800, 0.78);
    const zoom = coverZoomForCrop(crop, 900, 1200, 1000, 800);
    expect(zoom).toBeGreaterThan(0);
    expect(zoom).toBeLessThan(4);
  });
});

describe('缩放锚点', () => {
  it('放大后锚点下的图像坐标不变', () => {
    const input = {
      anchorX: 700,
      anchorY: 500,
      stageW: 1000,
      stageH: 800,
      oldScale: 0.94,
      newScale: 1.88,
      panX: 0,
      panY: 0,
    };
    const pan = panForZoomAnchor(input);
    const before = (700 - (500 - 940 * 0.5)) / 0.94;
    const after = (700 - (500 + pan.panX * 1000 - 1880 * 0.5)) / 1.88;
    expect(after).toBeCloseTo(before, 8);
  });
});

describe('输出尺寸夹取', () => {
  it('超过边长时保持比例缩小', () => {
    const result = clampOutputSize(9000, 3000, { maxEdge: 8192 });
    expect(result.clamped).toBe(true);
    expect(result.width).toBe(8192);
    expect(result.height).toBe(2731);
  });

  it('超过总像素时按面积缩小', () => {
    const result = clampOutputSize(8000, 8000, { maxEdge: 10000, maxPixels: 16_000_000 });
    expect(result.clamped).toBe(true);
    expect(result.width * result.height).toBeLessThanOrEqual(16_000_000);
  });
});

describe('computeView', () => {
  it('自动输出跟随裁剪框', () => {
    const state = {
      source: { width: 1000, height: 800, bitmap: {} },
      view: { zoom: 1, panX: 0, panY: 0, rotation: 0, flipX: false, flipY: false },
      crop: { x: 0.03, y: 0.03, w: 0.94, h: 0.94 },
      output: { mode: 'auto', width: 0, height: 0, dpi: 300 },
    };
    const view = computeView(state, 1000, 800);
    expect(view.cropImage.w).toBeCloseTo(1000, 6);
    expect(view.cropImage.h).toBeCloseTo(800, 6);
    expect(view.outputWidth).toBe(1000);
    expect(view.outputHeight).toBe(800);
    expect(view.coverage).toBe(1);
  });
});
