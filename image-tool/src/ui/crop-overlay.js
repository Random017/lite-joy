import { MIN_CROP_SIZE } from '../core/constants.js';
import { clamp, moveCrop, resizeCropFree } from '../core/geometry.js';
import { el } from '../utils/dom.js';

const CORNERS = ['nw', 'ne', 'sw', 'se'];
const EDGES = ['n', 'e', 's', 'w'];
const HANDLES = [...CORNERS, ...EDGES];

const GUIDE_SVG = `
  <svg class="crop-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <ellipse cx="50" cy="39" rx="21" ry="25"/>
    <line class="guide-dash" x1="50" y1="7" x2="50" y2="93"/>
    <line class="guide-dash" x1="8" y1="62" x2="92" y2="62"/>
    <path d="M18 96c4-14 16-21 32-21s28 7 32 21"/>
  </svg>
`;

function cornerResize({ crop, handle, dx, dy, stageW, stageH, aspect }) {
  const anchor = {
    x: (crop.x + (handle.includes('w') ? crop.w : 0)) * stageW,
    y: (crop.y + (handle.includes('n') ? crop.h : 0)) * stageH,
  };
  const pointer = {
    x: (crop.x + (handle.includes('w') ? 0 : crop.w)) * stageW + dx * stageW,
    y: (crop.y + (handle.includes('n') ? 0 : crop.h)) * stageH + dy * stageH,
  };

  const maxW = handle.includes('w') ? anchor.x : stageW - anchor.x;
  const maxH = handle.includes('n') ? anchor.y : stageH - anchor.y;
  const minW = Math.min(Math.max(48, MIN_CROP_SIZE * stageW), maxW);

  let width = Math.abs(pointer.x - anchor.x);
  let height = width / aspect;
  if (Math.abs(pointer.y - anchor.y) > height) {
    height = Math.abs(pointer.y - anchor.y);
    width = height * aspect;
  }

  width = clamp(width, Math.min(minW, maxW), Math.max(minW, maxW));
  width = Math.min(width, maxW, maxH * aspect);
  height = width / aspect;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return crop;
  }

  const x = handle.includes('w') ? anchor.x - width : anchor.x;
  const y = handle.includes('n') ? anchor.y - height : anchor.y;
  return {
    ...crop,
    x: clamp(x / stageW, 0, 1 - width / stageW),
    y: clamp(y / stageH, 0, 1 - height / stageH),
    w: width / stageW,
    h: height / stageH,
  };
}

export function createCropOverlay(container, { store, stage, onCommit }) {
  const root = el('div', { class: 'crop-overlay', hidden: true });
  const box = el('div', { class: 'crop-box' });
  const grid = el('div', { class: 'crop-grid' });
  const body = el('div', { class: 'crop-body' });
  const label = el('div', { class: 'crop-size-label' });

  box.innerHTML = GUIDE_SVG;
  const guides = box.querySelector('.crop-guides');
  box.prepend(grid);
  box.append(body, label);

  for (const handle of HANDLES) {
    const button = el('button', {
      class: 'crop-handle',
      type: 'button',
      dataset: { handle },
      ariaLabel: `调整裁剪框 ${handle}`,
      tabindex: '-1',
    });
    button.addEventListener('pointerdown', (event) => startResize(event, handle));
    box.append(button);
  }

  root.append(box);
  container.append(root);

  let drag = null;

  function startResize(event, handle) {
    const state = store.getState();
    if (!state.source) return;
    if (state.crop.aspect && EDGES.includes(handle)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag = {
      mode: 'resize',
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: { ...state.crop },
      stage: stage.getSize(),
      aspect: state.crop.aspect,
    };
    event.currentTarget.addEventListener('pointermove', onDrag);
    event.currentTarget.addEventListener('pointerup', endDrag);
    event.currentTarget.addEventListener('pointercancel', endDrag);
  }

  function startMove(event) {
    const state = store.getState();
    if (!state.source || state.ui.cropMode !== 'frame' || state.crop.aspect) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag = {
      mode: 'move',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: { ...state.crop },
      stage: stage.getSize(),
    };
    event.currentTarget.addEventListener('pointermove', onDrag);
    event.currentTarget.addEventListener('pointerup', endDrag);
    event.currentTarget.addEventListener('pointercancel', endDrag);
  }

  function onDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = (event.clientX - drag.startX) / Math.max(1, drag.stage.width);
    const dy = (event.clientY - drag.startY) / Math.max(1, drag.stage.height);
    const state = store.getState();

    if (drag.mode === 'move') {
      store.setIn('crop', moveCrop(drag.startCrop, dx, dy));
      return;
    }

    const next =
      drag.aspect && drag.handle.length === 2
        ? cornerResize({
            crop: drag.startCrop,
            handle: drag.handle,
            dx,
            dy,
            stageW: drag.stage.width,
            stageH: drag.stage.height,
            aspect: drag.aspect,
          })
        : resizeCropFree(drag.startCrop, drag.handle, dx, dy, MIN_CROP_SIZE, MIN_CROP_SIZE);
    if (
      state.crop.x !== next.x ||
      state.crop.y !== next.y ||
      state.crop.w !== next.w ||
      state.crop.h !== next.h
    ) {
      store.setIn('crop', next);
    }
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const target = event.currentTarget;
    target.releasePointerCapture?.(event.pointerId);
    target.removeEventListener('pointermove', onDrag);
    target.removeEventListener('pointerup', endDrag);
    target.removeEventListener('pointercancel', endDrag);
    drag = null;
    onCommit?.();
  }

  body.addEventListener('pointerdown', startMove);

  function update(state, derived) {
    if (!state.source || !derived) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const crop = state.crop;
    box.style.left = `${crop.x * 100}%`;
    box.style.top = `${crop.y * 100}%`;
    box.style.width = `${crop.w * 100}%`;
    box.style.height = `${crop.h * 100}%`;
    box.classList.toggle('is-frame-mode', state.ui.cropMode === 'frame');

    const locked = Boolean(crop.aspect);
    for (const button of box.querySelectorAll('.crop-handle')) {
      const edge = EDGES.includes(button.dataset.handle);
      button.hidden = locked && edge;
    }

    grid.hidden = !state.ui.showGrid;
    guides.hidden = !state.ui.showGuides || !crop.aspect;
    label.textContent = `${derived.outputWidth} × ${derived.outputHeight} px`;
  }

  return { element: root, update };
}
