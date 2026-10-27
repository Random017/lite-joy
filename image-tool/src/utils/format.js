export function formatBytes(bytes, digits = 1) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : digits)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function formatPx(value) {
  return `${Math.max(0, Math.round(value)).toLocaleString('zh-CN')} px`;
}

export function formatMm(mm) {
  return `${Number(mm).toFixed(1)} mm`;
}

export function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

export function formatDimensions(width, height) {
  return `${Math.round(width)} × ${Math.round(height)} px`;
}
