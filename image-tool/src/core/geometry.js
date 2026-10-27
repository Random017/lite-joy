import {
  FIT_PADDING,
  MAX_EXPORT_EDGE_DESKTOP,
  MAX_EXPORT_EDGE_MOBILE,
  MAX_EXPORT_PIXELS_DESKTOP,
  MAX_EXPORT_PIXELS_MOBILE,
  MIN_CROP_SIZE,
  MIN_OUTPUT_EDGE,
} from './constants.js';

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

export function rotatedBounds(width, height, rotationDeg) {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    rw: width * cos + height * sin,
    rh: width * sin + height * cos,
  };
}

export function computeFitScale(stageW, stageH, rw, rh, padding = FIT_PADDING) {
  if (!stageW || !stageH || !rw || !rh) return 1;
  return Math.min(stageW / rw, stageH / rh) * padding;
}

/**
 * 屏幕裁剪框 -> 旋转包围盒坐标。
 * 反变换和 renderer 的 translate/scale 顺序严格对应。
 */
export function screenCropToImage({ crop, stageW, stageH, originX, originY, scale }) {
  return {
    x: (crop.x * stageW - originX) / scale,
    y: (crop.y * stageH - originY) / scale,
    w: (crop.w * stageW) / scale,
    h: (crop.h * stageH) / scale,
  };
}

export function imageToScreen({ x, y, originX, originY, scale }) {
  return {
    x: x * scale + originX,
    y: y * scale + originY,
  };
}

export function computeView(state, stageW, stageH) {
  const { source, view, crop, output } = state;
  if (!source || !stageW || !stageH) return null;

  const { rw, rh } = rotatedBounds(source.width, source.height, view.rotation);
  const fitScale = computeFitScale(stageW, stageH, rw, rh);
  const scale = fitScale * view.zoom;
  const originX = stageW / 2 + view.panX * stageW - (rw * scale) / 2;
  const originY = stageH / 2 + view.panY * stageH - (rh * scale) / 2;

  const cropScreen = {
    x: crop.x * stageW,
    y: crop.y * stageH,
    w: crop.w * stageW,
    h: crop.h * stageH,
  };
  const cropImage = screenCropToImage({
    crop,
    stageW,
    stageH,
    originX,
    originY,
    scale,
  });
  const imageRect = {
    x: originX,
    y: originY,
    w: rw * scale,
    h: rh * scale,
  };

  const outputSize =
    output.mode === 'auto'
      ? {
          width: Math.round(cropImage.w),
          height: Math.round(cropImage.h),
          clamped: false,
        }
      : {
          width: output.width,
          height: output.height,
          clamped: false,
        };

  const { width, height, clamped } = clampOutputSize(outputSize.width, outputSize.height);
  outputSize.width = width;
  outputSize.height = height;
  outputSize.clamped = clamped;

  return {
    rw,
    rh,
    fitScale,
    scale,
    originX,
    originY,
    cropScreen,
    cropImage,
    imageRect,
    coverage: computeCoverage(cropScreen, imageRect),
    outputWidth: width,
    outputHeight: height,
    outputClamped: clamped,
    outputMm: {
      width: Number(((width / output.dpi) * 25.4).toFixed(1)),
      height: Number(((height / output.dpi) * 25.4).toFixed(1)),
    },
  };
}

export function computeCoverage(cropRect, imageRect) {
  const area = Math.max(0, cropRect.w) * Math.max(0, cropRect.h);
  if (!area) return 0;
  const left = Math.max(cropRect.x, imageRect.x);
  const top = Math.max(cropRect.y, imageRect.y);
  const right = Math.min(cropRect.x + cropRect.w, imageRect.x + imageRect.w);
  const bottom = Math.min(cropRect.y + cropRect.h, imageRect.y + imageRect.h);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  return clamp(intersection / area, 0, 1);
}

/**
 * 以画布中心生成指定屏幕比例的裁剪框。
 * aspect 是“屏幕像素”的宽高比，不是归一化坐标的比例。
 */
export function cropRectForAspect(aspect, stageW, stageH, fill = 0.8) {
  if (!aspect || !stageW || !stageH) {
    return { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  }
  let h = fill;
  let w = (aspect * h * stageH) / stageW;
  if (w > 0.88) {
    w = 0.88;
    h = (w * stageW) / (aspect * stageH);
  }
  return {
    x: (1 - w) / 2,
    y: (1 - h) / 2,
    w,
    h,
  };
}

/**
 * 保持中心，把裁剪框调整为指定屏幕比例，并夹在画布内。
 */
export function ensureCropAspect(crop, aspect, stageW, stageH) {
  if (!aspect || !stageW || !stageH) return { ...crop };
  const centerX = crop.x + crop.w / 2;
  const centerY = crop.y + crop.h / 2;
  const targetAspect = aspect;

  let w = crop.w;
  let h = (w * stageW) / (targetAspect * stageH);
  if (h > 0.96) {
    h = 0.96;
    w = (targetAspect * h * stageH) / stageW;
  }
  if (w > 0.96) {
    w = 0.96;
    h = (w * stageW) / (targetAspect * stageH);
  }

  return {
    x: clamp(centerX - w / 2, 0, 1 - w),
    y: clamp(centerY - h / 2, 0, 1 - h),
    w,
    h,
  };
}

export function computeInitialCrop(source, stageW, stageH) {
  const { rw, rh } = rotatedBounds(source.width, source.height, 0);
  const fitScale = computeFitScale(stageW, stageH, rw, rh);
  const width = (rw * fitScale) / stageW;
  const height = (rh * fitScale) / stageH;
  return {
    x: (1 - width) / 2,
    y: (1 - height) / 2,
    w: width,
    h: height,
  };
}

/**
 * 证件照选好后自动放大到“铺满裁剪框”所需的最小 zoom。
 */
export function coverZoomForCrop(crop, rw, rh, stageW, stageH) {
  const cropW = crop.w * stageW;
  const cropH = crop.h * stageH;
  const fitScale = computeFitScale(stageW, stageH, rw, rh);
  if (!fitScale) return 1;
  return Math.max(cropW / rw, cropH / rh) / fitScale;
}

export function panForZoomAnchor({
  anchorX,
  anchorY,
  stageW,
  stageH,
  oldScale,
  newScale,
  panX,
  panY,
}) {
  if (!oldScale || !newScale) return { panX, panY };
  const ratio = newScale / oldScale;
  const centerX = stageW / 2 + panX * stageW;
  const centerY = stageH / 2 + panY * stageH;
  const nextCenterX = anchorX - (anchorX - centerX) * ratio;
  const nextCenterY = anchorY - (anchorY - centerY) * ratio;
  return {
    panX: (nextCenterX - stageW / 2) / stageW,
    panY: (nextCenterY - stageH / 2) / stageH,
  };
}

export function clampOutputSize(width, height, options = {}) {
  const maxEdge =
    options.maxEdge ??
    (options.mobile ? MAX_EXPORT_EDGE_MOBILE : MAX_EXPORT_EDGE_DESKTOP);
  const maxPixels =
    options.maxPixels ??
    (options.mobile ? MAX_EXPORT_PIXELS_MOBILE : MAX_EXPORT_PIXELS_DESKTOP);

  let w = Math.max(MIN_OUTPUT_EDGE, Math.round(Number(width) || 0));
  let h = Math.max(MIN_OUTPUT_EDGE, Math.round(Number(height) || 0));
  let clamped = false;

  if (w > maxEdge || h > maxEdge) {
    const factor = Math.min(maxEdge / w, maxEdge / h);
    w = Math.max(MIN_OUTPUT_EDGE, Math.round(w * factor));
    h = Math.max(MIN_OUTPUT_EDGE, Math.round(h * factor));
    clamped = true;
  }
  if (w * h > maxPixels) {
    const factor = Math.sqrt(maxPixels / (w * h));
    w = Math.max(MIN_OUTPUT_EDGE, Math.round(w * factor));
    h = Math.max(MIN_OUTPUT_EDGE, Math.round(h * factor));
    clamped = true;
  }

  return { width: w, height: h, clamped };
}

export function cropToPixels(crop, stageW, stageH) {
  return {
    x: Math.round(crop.x * stageW),
    y: Math.round(crop.y * stageH),
    w: Math.round(crop.w * stageW),
    h: Math.round(crop.h * stageH),
  };
}

export function moveCrop(crop, dx, dy) {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, 1 - crop.w),
    y: clamp(crop.y + dy, 0, 1 - crop.h),
  };
}

export function resizeCropFree(crop, handle, dx, dy, minW = MIN_CROP_SIZE, minH = MIN_CROP_SIZE) {
  let { x, y, w, h } = crop;
  const right = x + w;
  const bottom = y + h;

  if (handle.includes('w')) {
    x = clamp(x + dx, 0, right - minW);
    w = right - x;
  }
  if (handle.includes('e')) {
    w = clamp(w + dx, minW, 1 - x);
  }
  if (handle.includes('n')) {
    y = clamp(y + dy, 0, bottom - minH);
    h = bottom - y;
  }
  if (handle.includes('s')) {
    h = clamp(h + dy, minH, 1 - y);
  }
  return { x, y, w, h };
}
