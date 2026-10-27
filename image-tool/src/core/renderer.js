import { computeView } from './geometry.js';
import { AppError, ErrorCode } from './errors.js';

export function drawRotatedImage(ctx, bitmap, source, rw, rh, rotation, flipX, flipY) {
  ctx.save();
  ctx.translate(rw / 2, rh / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(bitmap, -source.width / 2, -source.height / 2, source.width, source.height);
  ctx.restore();
}

function paintBackground(ctx, width, height, color) {
  if (!color || color === 'transparent') return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function renderPreview(ctx, state, stageW, stageH, dpr, precomputed) {
  const d = precomputed ?? computeView(state, stageW, stageH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, Math.ceil(stageW * dpr), Math.ceil(stageH * dpr));
  if (!d || !state.source) return d;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.fillStyle =
    state.encode.background === 'transparent' ? 'rgba(255,255,255,0.02)' : state.encode.background;
  ctx.fillRect(d.cropScreen.x, d.cropScreen.y, d.cropScreen.w, d.cropScreen.h);
  ctx.restore();

  ctx.save();
  ctx.translate(d.originX, d.originY);
  ctx.scale(d.scale, d.scale);
  drawRotatedImage(
    ctx,
    state.source.bitmap,
    state.source,
    d.rw,
    d.rh,
    state.view.rotation,
    state.view.flipX,
    state.view.flipY,
  );
  ctx.restore();
  return d;
}

export function renderExport(ctx, state, outW, outH, options = {}) {
  const stage = options.stage ?? state.stage;
  const d = computeView(state, stage.width, stage.height);
  if (!d) throw new AppError(ErrorCode.NO_SOURCE);

  const background =
    options.background ??
    (state.encode.format === 'image/jpeg' && state.encode.background === 'transparent'
      ? '#ffffff'
      : state.encode.background);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, outW, outH);
  paintBackground(ctx, outW, outH, background);

  const kx = outW / d.cropScreen.w;
  const ky = outH / d.cropScreen.h;
  ctx.setTransform(kx, 0, 0, ky, -d.cropScreen.x * kx, -d.cropScreen.y * ky);
  ctx.save();
  ctx.translate(d.originX, d.originY);
  ctx.scale(d.scale, d.scale);
  drawRotatedImage(
    ctx,
    state.source.bitmap,
    state.source,
    d.rw,
    d.rh,
    state.view.rotation,
    state.view.flipX,
    state.view.flipY,
  );
  ctx.restore();
  return d;
}

export function createExportCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new AppError(ErrorCode.EXPORT_FAILED);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}
