import { ALLOWED_MIME, MAX_FILE_BYTES } from './constants.js';
import { AppError, ErrorCode } from './errors.js';

const MAX_PIXELS = window.matchMedia('(max-width: 760px)').matches
  ? 16_000_000
  : 32_000_000;
const MAX_EDGE = window.matchMedia('(max-width: 760px)').matches ? 4096 : 8192;

function readMagic(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

async function decodeViaImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function downscaleBitmap(bitmap, factor) {
  const width = Math.max(1, Math.round(bitmap.width * factor));
  const height = Math.max(1, Math.round(bitmap.height * factor));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new AppError(ErrorCode.DECODE_FAILED);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const next = await createImageBitmap(canvas);
  bitmap.close?.();
  return next;
}

export async function decodeImageFile(file) {
  if (!file) throw new AppError(ErrorCode.NO_SOURCE);
  if (file.size > MAX_FILE_BYTES) throw new AppError(ErrorCode.FILE_SIZE);

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = readMagic(header);
  if (!mime || !ALLOWED_MIME.has(mime)) throw new AppError(ErrorCode.FILE_TYPE);

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      bitmap = await decodeViaImage(file);
    } catch {
      throw new AppError(ErrorCode.DECODE_FAILED);
    }
  }

  if (!bitmap || !bitmap.width || !bitmap.height) {
    bitmap?.close?.();
    throw new AppError(ErrorCode.DECODE_FAILED);
  }

  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const area = originalWidth * originalHeight;
  const edge = Math.max(originalWidth, originalHeight);
  const factor = Math.min(1, Math.sqrt(MAX_PIXELS / area), MAX_EDGE / edge);
  if (factor < 0.999) {
    bitmap = await downscaleBitmap(bitmap, factor);
  }

  return {
    file,
    name: file.name || 'photo',
    mime,
    size: file.size,
    width: bitmap.width,
    height: bitmap.height,
    originalWidth,
    originalHeight,
    bitmap,
    downsampled: factor < 0.999,
  };
}

export function releaseSource(source) {
  source?.bitmap?.close?.();
}
