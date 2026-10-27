import { FORMATS } from './constants.js';

function pad(value) {
  return String(value).padStart(2, '0');
}

export function timestampForFilename(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}`;
}

function extensionFor(format) {
  return FORMATS.find((item) => item.id === format)?.extension ?? 'jpg';
}

function sanitize(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function buildFilename({
  mode = 'custom',
  presetId = null,
  width = 0,
  height = 0,
  format = 'image/jpeg',
  now = new Date(),
} = {}) {
  const parts = ['lite-photo'];
  if (mode === 'preset' && presetId) {
    const clean = sanitize(presetId);
    if (clean) parts.push(clean);
  }
  if (width && height) parts.push(`${Math.round(width)}x${Math.round(height)}`);
  parts.push(timestampForFilename(now));
  return `${parts.join('_')}.${extensionFor(format)}`;
}
