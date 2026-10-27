import { QUALITY_SEARCH_ROUNDS } from './constants.js';
import { AppError, ErrorCode } from './errors.js';

let webpSupport;

export function supportsWebP() {
  if (typeof webpSupport === 'boolean') return webpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

export function canvasToBlob(canvas, type, quality = 0.92) {
  return new Promise((resolve, reject) => {
    try {
      const q = type === 'image/png' ? undefined : quality;
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new AppError(ErrorCode.EXPORT_FAILED));
        },
        type,
        q,
      );
    } catch (error) {
      reject(error instanceof AppError ? error : new AppError(ErrorCode.EXPORT_FAILED));
    }
  });
}

/**
 * 实际编码 + 二分搜索，不靠像素公式估算体积。
 * 返回当前能达标的最大质量；完全不达标时返回 null。
 */
export async function searchQuality({
  encode,
  targetBytes,
  minQuality = 0.3,
  maxQuality = 0.92,
  rounds = QUALITY_SEARCH_ROUNDS,
}) {
  let low = minQuality;
  let high = maxQuality;
  let best = null;

  for (let i = 0; i < rounds; i += 1) {
    const quality = Number(((low + high) / 2).toFixed(3));
    const blob = await encode(quality);
    if (blob.size <= targetBytes) {
      best = { blob, quality };
      low = quality;
    } else {
      high = quality;
    }
  }

  if (!best) {
    const blob = await encode(minQuality);
    if (blob.size <= targetBytes) best = { blob, quality: minQuality };
  }
  return best;
}

export async function compressCanvasToTarget(canvas, type, quality, targetBytes) {
  if (!targetBytes) {
    const blob = await canvasToBlob(canvas, type, quality);
    return { blob, quality };
  }

  const top = await canvasToBlob(canvas, type, quality);
  if (top.size <= targetBytes) return { blob: top, quality };

  if (type === 'image/png') {
    throw new AppError(ErrorCode.TARGET_UNREACHABLE, {
      minSize: top.size,
      reason: 'png',
    });
  }

  const found = await searchQuality({
    encode: (q) => canvasToBlob(canvas, type, q),
    targetBytes,
    minQuality: 0.3,
    maxQuality: quality,
  });
  if (found) return found;

  const smallest = await canvasToBlob(canvas, type, 0.3);
  throw new AppError(ErrorCode.TARGET_UNREACHABLE, {
    minSize: smallest.size,
    reason: 'quality',
  });
}
