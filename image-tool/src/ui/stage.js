import { computeView } from '../core/geometry.js';
import { renderPreview } from '../core/renderer.js';
import { el } from '../utils/dom.js';

export function createStage(container, { onResize } = {}) {
  const canvas = el('canvas', { class: 'stage-canvas', 'aria-label': '图片预览画布' });
  container.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  const size = { width: 0, height: 0, dpr: 1 };
  let lastState = null;
  let lastDerived = null;

  const measure = () => {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const changed =
      width !== size.width || height !== size.height || dpr !== size.dpr;
    size.width = width;
    size.height = height;
    size.dpr = dpr;
    if (changed) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    return changed;
  };

  const render = (state, precomputed) => {
    lastState = state;
    if (!ctx) return null;
    const d = precomputed ?? computeView(state, size.width, size.height);
    lastDerived = renderPreview(ctx, state, size.width, size.height, size.dpr, d);
    return lastDerived;
  };

  const observer = new ResizeObserver(() => {
    const changed = measure();
    if (changed) {
      render(lastState ?? {}, null);
      onResize?.({ ...size });
    }
  });
  observer.observe(container);
  measure();
  if (size.width > 0 && size.height > 0) {
    onResize?.({ ...size });
  }

  return {
    canvas,
    ctx,
    getSize: () => ({ ...size }),
    measure: () => {
      measure();
      return { ...size };
    },
    render,
    rerender: () => render(lastState ?? {}, null),
    getDerived: () => lastDerived,
    destroy() {
      observer.disconnect();
      canvas.remove();
    },
  };
}
