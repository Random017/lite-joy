import { AppError, ErrorCode } from './errors.js';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readU32(bytes, offset) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function writeU32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function isJfifApp0(bytes, markerIndex) {
  return (
    markerIndex + 14 < bytes.length &&
    bytes[markerIndex + 3] === 0x4a &&
    bytes[markerIndex + 4] === 0x46 &&
    bytes[markerIndex + 5] === 0x49 &&
    bytes[markerIndex + 6] === 0x46 &&
    bytes[markerIndex + 7] === 0x00
  );
}

export async function patchJpegDpi(blob, dpi) {
  const input = new Uint8Array(await blob.arrayBuffer());
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    throw new AppError(ErrorCode.EXPORT_FAILED);
  }

  const density = Math.max(1, Math.min(65535, Math.round(dpi)));
  const mutable = input.slice();
  let offset = 2;

  while (offset + 4 <= mutable.length) {
    if (mutable[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let markerIndex = offset;
    while (markerIndex < mutable.length && mutable[markerIndex] === 0xff) {
      markerIndex += 1;
    }
    if (markerIndex + 1 >= mutable.length) break;

    const marker = mutable[markerIndex];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = markerIndex + 1;
      continue;
    }
    if (marker === 0xda) break;

    const length = (mutable[markerIndex + 1] << 8) | mutable[markerIndex + 2];
    if (length < 2) break;

    if (marker === 0xe0 && isJfifApp0(mutable, markerIndex)) {
      const units = markerIndex + 10;
      mutable[units] = 1;
      mutable[units + 1] = (density >> 8) & 0xff;
      mutable[units + 2] = density & 0xff;
      mutable[units + 3] = (density >> 8) & 0xff;
      mutable[units + 4] = density & 0xff;
      return new Blob([mutable], { type: 'image/jpeg' });
    }

    offset = markerIndex + 1 + length;
  }

  const jfif = new Uint8Array([
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
    (density >> 8) & 0xff,
    density & 0xff,
    (density >> 8) & 0xff,
    density & 0xff,
    0x00,
    0x00,
  ]);
  const output = concatBytes([mutable.slice(0, 2), jfif, mutable.slice(2)]);
  return new Blob([output], { type: 'image/jpeg' });
}

export async function patchPngDpi(blob, dpi) {
  const input = new Uint8Array(await blob.arrayBuffer());
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (input.length < 33 || !signature.every((value, index) => input[index] === value)) {
    throw new AppError(ErrorCode.EXPORT_FAILED);
  }

  const ppu = Math.max(1, Math.min(0xffffffff, Math.round(dpi / 0.0254)));
  const phys = new Uint8Array(21);
  writeU32(phys, 0, 9);
  phys.set([0x70, 0x48, 0x59, 0x73], 4);
  writeU32(phys, 8, ppu);
  writeU32(phys, 12, ppu);
  phys[16] = 1;
  writeU32(phys, 17, crc32(phys.slice(4, 17)));

  const parts = [input.slice(0, 8)];
  let offset = 8;
  let inserted = false;
  let sawIhdr = false;

  while (offset + 12 <= input.length) {
    const length = readU32(input, offset);
    const end = offset + 12 + length;
    if (end > input.length) throw new AppError(ErrorCode.EXPORT_FAILED);
    const type = String.fromCharCode(
      input[offset + 4],
      input[offset + 5],
      input[offset + 6],
      input[offset + 7],
    );

    if (type === 'IHDR') {
      sawIhdr = true;
      parts.push(input.slice(offset, end));
      parts.push(phys);
      inserted = true;
    } else if (type !== 'pHYs') {
      parts.push(input.slice(offset, end));
    }

    offset = end;
    if (type === 'IEND') break;
  }

  if (!sawIhdr || !inserted) throw new AppError(ErrorCode.EXPORT_FAILED);
  return new Blob(parts, { type: 'image/png' });
}

export async function writeDpi(blob, type, dpi) {
  if (!blob) throw new AppError(ErrorCode.EXPORT_FAILED);
  if (type !== 'image/jpeg' && type !== 'image/png') return blob;
  if (!dpi || dpi <= 0) return blob;
  try {
    return type === 'image/jpeg'
      ? await patchJpegDpi(blob, dpi)
      : await patchPngDpi(blob, dpi);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.EXPORT_FAILED);
  }
}
