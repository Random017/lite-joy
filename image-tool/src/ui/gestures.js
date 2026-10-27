import { MAX_ZOOM, MIN_ZOOM } from '../core/constants.js';
import {
  clamp,
  computeFitScale,
  computeView,
  panForZoomAnchor,
  rotatedBounds,
} from '../core/geometry.js';

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function attachGestures(element, options) {
  const { store, stage, onGestureEnd } = options;
  const pointers = new Map();
  let gesture = null;

  const localPoint = (event) => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const fitScale = () => {
    const state = store.getState();
    if (!state.source) return 1;
    const size = stage.getSize();
    const bounds = rotatedBounds(
      state.source.width,
      state.source.height,
      state.view.rotation,
    );
    return computeFitScale(size.width, size.height, bounds.rw, bounds.rh);
  };

  const setZoomAt = (anchor, nextZoom, baseZoom, basePan) => {
    const state = store.getState();
    const size = stage.getSize();
    const fit = fitScale();
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const next = panForZoomAnchor({
      anchorX: anchor.x,
      anchorY: anchor.y,
      stageW: size.width,
      stageH: size.height,
      oldScale: fit * baseZoom,
      newScale: fit * zoom,
      panX: basePan.panX,
      panY: basePan.panY,
    });
    store.setIn('view', { zoom, panX: next.panX, panY: next.panY });
  };

  const startPinch = () => {
    if (pointers.size < 2) return;
    const points = [...pointers.values()];
    const state = store.getState();
    gesture = {
      mode: 'pinch',
      startDistance: Math.max(1, distance(points[0], points[1])),
      startMid: midpoint(points[0], points[1]),
      startZoom: state.view.zoom,
      startPan: { panX: state.view.panX, panY: state.view.panY },
    };
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('.crop-handle, .crop-box.is-frame-mode .crop-body, button, input, select, label')) {
      return;
    }
    if (!store.getState().source) return;

    element.setPointerCapture?.(event.pointerId);
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    element.classList.add('is-grabbing');

    if (pointers.size === 1) {
      const state = store.getState();
      gesture = {
        mode: 'pan',
        startX: point.x,
        startY: point.y,
        startPan: { panX: state.view.panX, panY: state.view.panY },
      };
    } else if (pointers.size === 2) {
      startPinch();
    }
    event.preventDefault();
  };

  const onPointerMove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    if (!gesture) return;

    if (gesture.mode === 'pan' && pointers.size === 1) {
      const size = stage.getSize();
      const dx = (point.x - gesture.startX) / Math.max(1, size.width);
      const dy = (point.y - gesture.startY) / Math.max(1, size.height);
      store.setIn('view', {
        panX: gesture.startPan.panX + dx,
        panY: gesture.startPan.panY + dy,
      });
      return;
    }

    if (gesture.mode === 'pinch' && pointers.size >= 2) {
      const points = [...pointers.values()];
      const currentMid = midpoint(points[0], points[1]);
      const ratio = distance(points[0], points[1]) / gesture.startDistance;
      const nextZoom = clamp(gesture.startZoom * ratio, MIN_ZOOM, MAX_ZOOM);
      const fit = fitScale();
      const state = store.getState();
      const next = panForZoomAnchor({
        anchorX: gesture.startMid.x,
        anchorY: gesture.startMid.y,
        stageW: stage.getSize().width,
        stageH: stage.getSize().height,
        oldScale: fit * gesture.startZoom,
        newScale: fit * nextZoom,
        panX: gesture.startPan.panX,
        panY: gesture.startPan.panY,
      });
      store.setIn('view', {
        zoom: nextZoom,
        panX:
          next.panX +
          (currentMid.x - gesture.startMid.x) / Math.max(1, stage.getSize().width),
        panY:
          next.panY +
          (currentMid.y - gesture.startMid.y) / Math.max(1, stage.getSize().height),
      });
    }
  };

  const finishPointer = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    element.releasePointerCapture?.(event.pointerId);
    if (pointers.size === 0) {
      element.classList.remove('is-grabbing');
      if (gesture) onGestureEnd?.();
      gesture = null;
    } else if (pointers.size === 1) {
      const state = store.getState();
      const point = [...pointers.values()][0];
      gesture = {
        mode: 'pan',
        startX: point.x,
        startY: point.y,
        startPan: { panX: state.view.panX, panY: state.view.panY },
      };
    }
  };

  const onWheel = (event) => {
    if (!store.getState().source) return;
    event.preventDefault();
    const anchor = localPoint(event);
    const state = store.getState();
    const factor = Math.exp(-event.deltaY * 0.0015);
    const nextZoom = clamp(state.view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    setZoomAt(anchor, nextZoom, state.view.zoom, {
      panX: state.view.panX,
      panY: state.view.panY,
    });
  };

  const onDoubleClick = (event) => {
    if (!store.getState().source) return;
    if (event.target.closest('button, .crop-handle, .crop-body')) return;
    const state = store.getState();
    const size = stage.getSize();
    if (state.view.zoom > 1.05) {
      store.setIn('view', { zoom: 1, panX: 0, panY: 0 });
      return;
    }
    const anchor = localPoint(event);
    setZoomAt(anchor, 2, state.view.zoom, {
      panX: state.view.panX,
      panY: state.view.panY,
    });
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', finishPointer);
  element.addEventListener('pointercancel', finishPointer);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('dblclick', onDoubleClick);

  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', finishPointer);
    element.removeEventListener('pointercancel', finishPointer);
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('dblclick', onDoubleClick);
  };
}

export function getFitForState(state, size) {
  if (!state.source) return 1;
  const bounds = rotatedBounds(
    state.source.width,
    state.source.height,
    state.view.rotation,
  );
  return computeFitScale(size.width, size.height, bounds.rw, bounds.rh);
}

export function getViewForState(state, stageSize) {
  return computeView(state, stageSize.width, stageSize.height);
}
