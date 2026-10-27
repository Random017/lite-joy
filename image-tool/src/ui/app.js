import {
  LAYOUT_MOBILE_QUERY,
  MAX_EXPORT_EDGE_DESKTOP,
  MAX_EXPORT_EDGE_MOBILE,
  MAX_ZOOM,
  MIN_ZOOM,
  PANEL_TABS,
  QUALITY_DEFAULT,
  QUICK_PRESET_IDS,
  ZOOM_STEP,
} from '../core/constants.js';
import { AppError, ErrorCode, messageOf } from '../core/errors.js';
import {
  clamp,
  computeFitScale,
  computeView,
  ensureCropAspect,
  coverZoomForCrop,
  cropRectForAspect,
  normalizeAngle,
  panForZoomAnchor,
  rotatedBounds,
} from '../core/geometry.js';
import { decodeImageFile, releaseSource } from '../core/decode.js';
import { getPreset, presetPixelsFromMm } from '../core/presets.js';
import { createExportCanvas, renderExport } from '../core/renderer.js';
import { compressCanvasToTarget, supportsWebP } from '../core/encode.js';
import { writeDpi } from '../core/metadata.js';
import { buildFilename } from '../core/filename.js';
import { createStore } from '../core/store.js';
import { createStage } from './stage.js';
import { attachGestures } from './gestures.js';
import { createCropOverlay } from './crop-overlay.js';
import { createPanels } from './panels.js';
import { createToast } from './toast.js';
import { icon } from './icons.js';
import { debounce } from '../utils/debounce.js';
import { downloadBlob, isTypingTarget } from '../utils/dom.js';
import { formatBytes, formatMm } from '../utils/format.js';
import { loadPreferences, savePreferences } from '../utils/storage.js';

const prefs = loadPreferences();
const isMobile = window.matchMedia(LAYOUT_MOBILE_QUERY).matches;
const maxEdge = isMobile ? MAX_EXPORT_EDGE_MOBILE : MAX_EXPORT_EDGE_DESKTOP;
const FORMAT_IDS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BACKGROUND_VALUES = new Set(['#ffffff', '#438edb', '#d23a32', '#d8d8d8', 'transparent']);
const storedFormat = FORMAT_IDS.has(prefs.format) ? prefs.format : 'image/jpeg';
const storedBackground = BACKGROUND_VALUES.has(prefs.background)
  ? prefs.background
  : '#ffffff';
const preferredFormat =
  storedFormat === 'image/webp' && !supportsWebP() ? 'image/jpeg' : storedFormat;
const preferredBackground =
  preferredFormat === 'image/jpeg' && storedBackground === 'transparent'
    ? '#ffffff'
    : storedBackground;

const store = createStore({
  phase: 'empty',
  source: null,
  view: { zoom: 1, panX: 0, panY: 0, rotation: 0, flipX: false, flipY: false },
  crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8, aspect: null, presetId: null },
  output: {
    mode: 'auto',
    width: 0,
    height: 0,
    dpi: 300,
    unit: 'px',
    presetId: null,
    lockAspect: true,
  },
  encode: {
    format: preferredFormat,
    quality: QUALITY_DEFAULT,
    targetKB: null,
    minKB: null,
    background: preferredBackground,
  },
  ui: {
    tool: 'crop',
    cropMode: 'photo',
    showGrid: prefs.showGrid !== false,
    showGuides: prefs.showGuides !== false,
    busy: false,
    maxEdge,
  },
  stage: { width: 0, height: 0, dpr: 1 },
});

export function mountApp(root) {
  const emptyQuickButtons = QUICK_PRESET_IDS.map((id) => {
    const preset = getPreset(id);
    if (!preset) return '';
    return `
      <button class="quick-preset" type="button" data-empty-preset="${preset.id}" aria-label="选择${preset.name}规格并挑照片">
        <strong>${preset.name}</strong>
        <small>${preset.width}×${preset.height} px</small>
      </button>`;
  }).join('');

  const toolButtons = PANEL_TABS.map(
    (tab) => `
      <button class="tool-button" type="button" data-tool="${tab.id}" aria-pressed="${
        tab.id === 'crop' ? 'true' : 'false'
      }">
        ${icon(tab.icon, 21)}
        <span>${tab.label}</span>
      </button>`,
  ).join('');

  const mobileTabs = PANEL_TABS.map(
    (tab) => `
      <button class="mobile-tab" type="button" data-tool="${tab.id}" aria-pressed="${
        tab.id === 'crop' ? 'true' : 'false'
      }">
        ${icon(tab.icon, 20)}
        <span>${tab.label}</span>
      </button>`,
  ).join('');

  root.innerHTML = `
    <div class="app">
      <header class="app-header">
        <a class="brand" href="../" title="返回 lite-joy 首页" aria-label="返回 lite-joy 首页">
          <div class="brand-mark">${icon('aperture', 21)}</div>
          <div class="brand-copy">
            <h1 class="brand-name">轻照 <small>LITE PHOTO</small></h1>
            <span class="brand-tag">本地证件照与图片处理</span>
          </div>
        </a>
        <div class="header-spacer"></div>
        <div class="privacy-pill">图片不离开本机</div>
        <div class="header-actions">
          <button class="button" type="button" data-action="open" title="打开图片（Ctrl/Cmd + O）">
            ${icon('upload', 17)}<span class="button-label">打开图片</span>
          </button>
          <button class="button button--primary" type="button" data-action="export" disabled>
            ${icon('download', 17)}<span class="button-label">导出</span>
          </button>
        </div>
      </header>

      <main class="app-main">
        <nav class="tool-rail" aria-label="编辑工具">${toolButtons}</nav>

        <section class="stage" id="stage" aria-label="图片编辑区">
          <div class="stage-empty" id="empty-state">
            <div class="empty-card">
              <div class="empty-icon">${icon('image', 30)}</div>
              <h2>选择一张照片</h2>
              <p>从相册选择或拍照。支持 JPG、PNG、WebP，最大 40 MB。</p>
              <div class="empty-actions">
                <button class="button button--primary" type="button" data-action="open">
                  ${icon('upload', 16)} 选择照片
                </button>
                <button class="button" type="button" data-action="camera">
                  ${icon('camera', 16)} 拍照
                </button>
              </div>
              <div class="empty-quick">
                <p class="empty-quick-title">常用规格 · 选完再挑照片，导入即套用</p>
                <div class="empty-quick-grid">${emptyQuickButtons}</div>
              </div>
              <div class="empty-note">${icon('shield', 14)} 图片只在浏览器内处理，不会上传</div>
              <div class="empty-note empty-note--desktop">${icon('info', 14)} 电脑上也可拖入，或按 Ctrl/Cmd + V 粘贴</div>
            </div>
          </div>

          <div class="stage-hud" id="stage-hud" hidden>
            <div class="stage-meta">
              <span class="badge badge--dark" id="file-badge">—</span>
              <span class="badge badge--dark" id="source-badge">—</span>
            </div>
            <span class="badge badge--dark" id="mode-badge">自由裁剪</span>
          </div>

          <div class="coverage-warning" id="coverage-warning" hidden>
            ${icon('info', 14)}<span>照片未铺满裁剪框，留白会使用背景色</span>
          </div>

          <div class="stage-controls" aria-label="缩放控制">
            <button class="icon-button" type="button" data-zoom="out" aria-label="缩小">${icon('minus', 16)}</button>
            <span class="zoom-readout" id="zoom-readout">100%</span>
            <button class="icon-button" type="button" data-zoom="in" aria-label="放大">${icon('plus', 16)}</button>
            <span class="divider"></span>
            <button class="icon-button" type="button" data-zoom="fit" aria-label="适应画布">${icon('fit', 16)}</button>
          </div>

          <div class="loading-overlay" id="loading-overlay" hidden>
            <div class="loading-card">
              <span class="spinner"></span>
              <span id="loading-text">正在读取照片…</span>
            </div>
          </div>
        </section>

        <aside class="panel" aria-label="工具面板">
          <div
            class="sheet-handle"
            id="sheet-handle"
            role="button"
            tabindex="0"
            aria-label="拖动或点击调整面板高度"
            aria-controls="panel-body"
            aria-expanded="false"
          >
            <span></span>
          </div>
          <div class="panel-head">
            <div>
              <div class="panel-eyebrow" id="panel-eyebrow">CROP</div>
              <h2 class="panel-title" id="panel-title">裁剪与比例</h2>
            </div>
            <span class="badge" id="panel-badge">本地</span>
          </div>
          <div class="panel-body" id="panel-body"></div>
          <div class="panel-quick" id="panel-quick" hidden>
            <button class="quick-meta" type="button" id="quick-meta" title="打开导出设置" aria-label="打开导出设置">
              <strong id="quick-dims">—</strong>
              <span id="quick-sub">—</span>
            </button>
            <button class="button button--primary" type="button" id="quick-export">
              ${icon('download', 17)} 导出
            </button>
          </div>
          <div class="statusbar" aria-live="polite">
            <span id="status-size">未导入</span>
            <span class="status-sep"></span>
            <span id="status-mm">—</span>
            <span class="status-sep"></span>
            <span id="status-zoom">缩放 100%</span>
            <span class="status-sep"></span>
            <span class="status-warn" id="status-warn"></span>
          </div>
        </aside>
      </main>

      <nav class="mobile-tabs" aria-label="移动端工具">${mobileTabs}</nav>
    </div>
    <div class="toast-stack" id="toast-stack" aria-live="polite"></div>
    <input type="file" id="file-input" accept="image/jpeg,image/png,image/webp" hidden />
    <input type="file" id="camera-input" accept="image/jpeg,image/png,image/webp" capture="environment" hidden />
  `;

  const refs = {
    app: root.querySelector('.app'),
    panel: root.querySelector('.panel'),
    sheetHandle: root.querySelector('#sheet-handle'),
    panelQuick: root.querySelector('#panel-quick'),
    quickDims: root.querySelector('#quick-dims'),
    quickSub: root.querySelector('#quick-sub'),
    quickMeta: root.querySelector('#quick-meta'),
    quickExport: root.querySelector('#quick-export'),
    stage: root.querySelector('#stage'),
    empty: root.querySelector('#empty-state'),
    stageHud: root.querySelector('#stage-hud'),
    fileBadge: root.querySelector('#file-badge'),
    sourceBadge: root.querySelector('#source-badge'),
    modeBadge: root.querySelector('#mode-badge'),
    coverageWarning: root.querySelector('#coverage-warning'),
    zoomReadout: root.querySelector('#zoom-readout'),
    loading: root.querySelector('#loading-overlay'),
    loadingText: root.querySelector('#loading-text'),
    panelEyebrow: root.querySelector('#panel-eyebrow'),
    panelTitle: root.querySelector('#panel-title'),
    panelBadge: root.querySelector('#panel-badge'),
    panelBody: root.querySelector('#panel-body'),
    statusSize: root.querySelector('#status-size'),
    statusMm: root.querySelector('#status-mm'),
    statusZoom: root.querySelector('#status-zoom'),
    statusWarn: root.querySelector('#status-warn'),
    fileInput: root.querySelector('#file-input'),
    cameraInput: root.querySelector('#camera-input'),
    toastStack: root.querySelector('#toast-stack'),
    exportButton: root.querySelector('[data-action="export"]'),
  };

  const toast = createToast(refs.toastStack);
  const stage = createStage(refs.stage, { onResize: handleStageResize });
  let panels = null;
  let lastEstimate = null;
  let lastEstimateSignature = '';
  let renderQueued = false;
  let pendingPreset = null;

  setupSheet();

  const cropOverlay = createCropOverlay(refs.stage, {
    store,
    stage,
    onCommit: () => {},
  });

  attachGestures(refs.stage, {
    store,
    stage,
    onGestureEnd: () => {},
  });

  const estimateDebounced = debounce(runEstimate, 520);

  const actions = {
    openFile,
    exportImage,
    setTool,
    setAspect,
    setCropMode,
    resetCrop,
    fitView,
    rotateBy,
    setRotation,
    flip,
    resetTransform,
    applyPreset,
    applyCustom,
    setOutputWidth,
    setOutputHeight,
    setOutputLock,
    setDpi,
    setFormat,
    setQuality,
    setTargetKB,
    setBackground,
    toggleGrid,
    toggleGuides,
    zoomBy,
  };

  panels = createPanels(refs.panelBody, { store, actions });
  panels.setTool('crop');

  function setupSheet() {
    const panel = refs.panel;
    const handle = refs.sheetHandle;
    if (!panel || !handle) return;
    const mobileQuery = window.matchMedia(LAYOUT_MOBILE_QUERY);

    let ratio = 0.54;
    let dragging = false;
    let moved = false;
    let startY = 0;
    let startHeight = 0;

    const mainHeight = () =>
      root.querySelector('.app-main')?.clientHeight || window.innerHeight;
    const bounds = () => {
      const available = mainHeight();
      const min = Math.min(280, available * 0.38);
      const max = Math.max(min + 80, available - 132);
      return { min, max, available };
    };
    const heightFor = (value) => {
      const { min, max, available } = bounds();
      return Math.round(clamp(value * available, min, max));
    };
    const compactRatio = () => {
      const available = mainHeight();
      if (available < 500) return 0.68;
      if (available < 600) return 0.62;
      return 0.54;
    };
    const applyRatio = (value) => {
      ratio = value;
      panel.style.height = `${heightFor(value)}px`;
      panel.classList.toggle('is-tall', value > 0.64);
      handle.setAttribute('aria-expanded', String(value > 0.64));
    };

    ratio = compactRatio();
    if (mobileQuery.matches) applyRatio(ratio);

    handle.addEventListener('pointerdown', (event) => {
      if (!mobileQuery.matches) return;
      if (event.button !== undefined && event.button !== 0) return;
      dragging = true;
      moved = false;
      startY = event.clientY;
      startHeight = panel.getBoundingClientRect().height;
      refs.app.classList.add('is-sheet-dragging');
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const delta = startY - event.clientY;
      if (Math.abs(delta) > 4) moved = true;
      const { min, max } = bounds();
      panel.style.height = `${Math.round(clamp(startHeight + delta, min, max))}px`;
    });

    const settle = () => {
      const expanded = panel.getBoundingClientRect().height > mainHeight() * 0.64;
      dragging = false;
      refs.app.classList.remove('is-sheet-dragging');
      applyRatio(expanded ? 0.72 : compactRatio());
    };

    handle.addEventListener('pointerup', () => {
      if (!dragging) return;
      const current = panel.getBoundingClientRect().height;
      if (!moved && Math.abs(current - startHeight) < 8) {
        const expanded = current > mainHeight() * 0.64;
        dragging = false;
        refs.app.classList.remove('is-sheet-dragging');
        applyRatio(expanded ? compactRatio() : 0.72);
        return;
      }
      settle();
    });
    handle.addEventListener('pointercancel', settle);

    handle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const expanded = panel.getBoundingClientRect().height > mainHeight() * 0.64;
        applyRatio(expanded ? compactRatio() : 0.72);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        applyRatio(0.72);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        applyRatio(compactRatio());
      }
    });

    window.addEventListener('resize', () => {
      if (mobileQuery.matches) {
        applyRatio(ratio);
        return;
      }
      panel.style.height = '';
      panel.classList.remove('is-tall');
      handle.setAttribute('aria-expanded', 'false');
    });
  }

  // ---------- 基础 UI ----------

  function setTool(tool) {
    const tab = PANEL_TABS.find((item) => item.id === tool);
    if (!tab) return;
    store.setIn('ui', { tool });
    panels.setTool(tool);
    refs.panelEyebrow.textContent = tab.eyebrow;
    refs.panelTitle.textContent = tab.title;
    for (const button of root.querySelectorAll('[data-tool]')) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    }
  }

  let loadToken = 0;

  function showLoading(text) {
    refs.loadingText.textContent = text;
    refs.loading.hidden = false;
  }

  function hideLoading() {
    refs.loading.hidden = true;
  }

  function updatePrefs(patch) {
    savePreferences(patch);
  }

  // ---------- 文件 ----------

  function openFile() {
    pendingPreset = null;
    refs.fileInput.value = '';
    refs.fileInput.click();
  }

  function openWithPreset(id) {
    if (!getPreset(id)) return;
    pendingPreset = id;
    refs.fileInput.value = '';
    refs.fileInput.click();
  }

  function openCamera() {
    pendingPreset = null;
    refs.cameraInput.value = '';
    refs.cameraInput.click();
  }

  async function loadFile(file, requestedPreset = null) {
    if (!file) return;
    if (store.getState().ui.busy) {
      toast('正在导出，请稍候再更换图片', 'info');
      return;
    }
    const token = ++loadToken;
    showLoading('正在读取照片…');
    try {
      const source = await decodeImageFile(file);
      if (token !== loadToken) {
        releaseSource(source);
        return;
      }
      // 空状态在手机上会隐藏面板和底部标签；先切到编辑布局，再按最终画布尺寸计算初始裁剪，
      // 否则首张照片会沿用空状态的高画布比例。
      root.querySelector('.app')?.classList.remove('is-empty');
      refs.empty.hidden = true;
      refs.stageHud.hidden = false;
      const size = stage.measure();
      const crop = initialCropFor(source, 0, size);
      releaseSource(store.getState().source);
      store.set({
        phase: 'ready',
        source,
        stage: { ...size },
        view: { zoom: 1, panX: 0, panY: 0, rotation: 0, flipX: false, flipY: false },
        crop: { ...crop, aspect: null, presetId: null },
        output: {
          ...store.getState().output,
          mode: 'auto',
          width: source.width,
          height: source.height,
          presetId: null,
          lockAspect: true,
        },
        encode: { ...store.getState().encode, targetKB: null, minKB: null },
        ui: { ...store.getState().ui, tool: 'crop', cropMode: 'photo', busy: false },
      });
      setTool('crop');
      if (requestedPreset) {
        applyPreset(requestedPreset);
        const applied = getPreset(requestedPreset);
        if (applied) {
          toast(`已套用${applied.name}，底部可直接导出`, 'success', 2800);
        }
      }
      if (source.downsampled) {
        toast(
          `原图较大，已优化到 ${source.width}×${source.height} 以便流畅编辑`,
          'warn',
          4200,
        );
      }
    } catch (error) {
      if (token === loadToken) toast(messageOf(error), 'error', 4800);
    } finally {
      if (token === loadToken) {
        hideLoading();
        refs.fileInput.value = '';
        refs.cameraInput.value = '';
      }
    }
  }

  // ---------- 裁剪 / 变换 ----------

  function initialCropFor(source, rotation, size) {
    const bounds = rotatedBounds(source.width, source.height, rotation);
    const fit = computeFitScale(size.width, size.height, bounds.rw, bounds.rh);
    const width = (bounds.rw * fit) / Math.max(1, size.width);
    const height = (bounds.rh * fit) / Math.max(1, size.height);
    return {
      x: (1 - width) / 2,
      y: (1 - height) / 2,
      w: width,
      h: height,
    };
  }

  function setAspect(id) {
    const state = store.getState();
    if (!state.source) return;
    const size = stage.getSize();
    let aspect = null;
    if (id === 'original') {
      const bounds = rotatedBounds(state.source.width, state.source.height, state.view.rotation);
      aspect = bounds.rw / bounds.rh;
    } else if (id !== 'free') {
      const [a, b] = id.split(':').map(Number);
      aspect = a / b;
    }

    let crop;
    if (id === 'original') {
      crop = {
        ...initialCropFor(state.source, state.view.rotation, size),
        aspect,
        presetId: null,
      };
    } else if (aspect) {
      crop = {
        ...ensureCropAspect(state.crop, aspect, size.width, size.height),
        aspect,
        presetId: null,
      };
    } else {
      crop = { ...state.crop, aspect: null, presetId: null };
    }

    let view = { ...state.view, panX: 0, panY: 0 };
    if (aspect) {
      const bounds = rotatedBounds(state.source.width, state.source.height, state.view.rotation);
      view.zoom = clamp(coverZoomForCrop(crop, bounds.rw, bounds.rh, size.width, size.height), MIN_ZOOM, MAX_ZOOM);
    }

    store.set({
      crop,
      view,
      output: {
        ...state.output,
        mode: 'auto',
        presetId: null,
        lockAspect: aspect ? true : state.output.lockAspect,
      },
      encode: { ...state.encode, targetKB: null, minKB: null },
      ui: { ...state.ui, cropMode: aspect ? 'photo' : state.ui.cropMode, showGuides: false },
    });
  }

  function applyPreset(id) {
    const state = store.getState();
    const preset = getPreset(id);
    if (!preset) return;
    if (!state.source) {
      toast('请先导入一张照片', 'info');
      openFile();
      return;
    }
    const size = stage.getSize();
    const aspect = preset.width / preset.height;
    const crop = {
      ...cropRectForAspect(aspect, size.width, size.height, 0.78),
      aspect,
      presetId: preset.id,
    };
    const bounds = rotatedBounds(state.source.width, state.source.height, state.view.rotation);
    const zoom = clamp(
      coverZoomForCrop(crop, bounds.rw, bounds.rh, size.width, size.height),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    store.set({
      crop,
      view: { ...state.view, zoom, panX: 0, panY: 0 },
      output: {
        ...state.output,
        mode: 'preset',
        width: preset.width,
        height: preset.height,
        dpi: preset.dpi,
        presetId: preset.id,
        lockAspect: true,
      },
      encode: {
        ...state.encode,
        background: preset.background,
        targetKB: preset.maxKB ?? null,
        minKB: preset.minKB ?? null,
      },
      ui: { ...state.ui, cropMode: 'photo', showGuides: true },
    });
    updatePrefs({ presetId: preset.id, background: preset.background });
    panels.setCustomSize(preset.mmWidth, preset.mmHeight, preset.dpi);
  }

  function applyCustom(mmWidth, mmHeight, dpi) {
    const state = store.getState();
    if (!state.source) {
      toast('请先导入一张照片', 'info');
      return;
    }
    if (!Number.isFinite(mmWidth) || !Number.isFinite(mmHeight) || mmWidth <= 0 || mmHeight <= 0) {
      toast('请输入有效的毫米尺寸', 'error');
      return;
    }
    const safeW = clamp(mmWidth, 1, 500);
    const safeH = clamp(mmHeight, 1, 500);
    const safeDpi = clamp(Number(dpi) || 300, 72, 1200);
    const requested = presetPixelsFromMm(safeW, safeH, safeDpi);
    const pixels = clampOutputRequest(requested.width, requested.height);
    const size = stage.getSize();
    const aspect = pixels.width / pixels.height;
    const crop = {
      ...cropRectForAspect(aspect, size.width, size.height, 0.78),
      aspect,
      presetId: null,
    };
    const bounds = rotatedBounds(state.source.width, state.source.height, state.view.rotation);
    const zoom = clamp(
      coverZoomForCrop(crop, bounds.rw, bounds.rh, size.width, size.height),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    store.set({
      crop,
      view: { ...state.view, zoom, panX: 0, panY: 0 },
      output: {
        ...state.output,
        mode: 'custom',
        width: pixels.width,
        height: pixels.height,
        dpi: safeDpi,
        presetId: null,
        lockAspect: true,
      },
      encode: { ...state.encode, targetKB: null, minKB: null },
      ui: { ...state.ui, cropMode: 'photo', showGuides: true },
    });
    panels.setCustomSize(safeW, safeH, safeDpi);
    toast(`已应用 ${safeW}×${safeH} mm · ${pixels.width}×${pixels.height} px`, 'success');
  }

  function setCropMode(mode) {
    const state = store.getState();
    if (mode === 'frame' && state.crop.aspect) {
      toast('固定比例下请移动照片来调整构图', 'info');
      return;
    }
    store.setIn('ui', { cropMode: mode });
  }

  function resetCrop() {
    const state = store.getState();
    if (!state.source) return;
    const size = stage.getSize();
    const crop = initialCropFor(state.source, state.view.rotation, size);
    store.set({
      crop: { ...crop, aspect: null, presetId: null },
      view: { ...state.view, zoom: 1, panX: 0, panY: 0 },
      output: { ...state.output, mode: 'auto', presetId: null },
      encode: { ...state.encode, targetKB: null, minKB: null },
      ui: { ...state.ui, showGuides: false },
    });
  }

  function fitView() {
    const state = store.getState();
    if (!state.source) return;
    store.setIn('view', { zoom: 1, panX: 0, panY: 0 });
  }

  function zoomBy(factor) {
    const state = store.getState();
    if (!state.source) return;
    const size = stage.getSize();
    const fit = fitScaleFor(state, size);
    const zoom = clamp(state.view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const next = panForZoomAnchor({
      anchorX: size.width / 2,
      anchorY: size.height / 2,
      stageW: size.width,
      stageH: size.height,
      oldScale: fit * state.view.zoom,
      newScale: fit * zoom,
      panX: state.view.panX,
      panY: state.view.panY,
    });
    store.setIn('view', { zoom, ...next });
  }

  function fitScaleFor(state, size) {
    const bounds = rotatedBounds(
      state.source.width,
      state.source.height,
      state.view.rotation,
    );
    return computeFitScale(size.width, size.height, bounds.rw, bounds.rh);
  }

  function rotationZoom(nextRotation) {
    const state = store.getState();
    const size = stage.getSize();
    const oldBounds = rotatedBounds(
      state.source.width,
      state.source.height,
      state.view.rotation,
    );
    const nextBounds = rotatedBounds(state.source.width, state.source.height, nextRotation);
    const oldFit = computeFitScale(size.width, size.height, oldBounds.rw, oldBounds.rh);
    const nextFit = computeFitScale(size.width, size.height, nextBounds.rw, nextBounds.rh);
    return clamp((state.view.zoom * oldFit) / nextFit, MIN_ZOOM, MAX_ZOOM);
  }

  function rotateBy(delta) {
    const state = store.getState();
    if (!state.source) return;
    const raw = normalizeAngle(state.view.rotation + delta);
    const next = raw > 180 ? raw - 360 : raw;
    store.setIn('view', { rotation: next, zoom: rotationZoom(next) });
  }

  function setRotation(value) {
    const state = store.getState();
    if (!state.source || !Number.isFinite(value)) return;
    const next = clamp(value, -180, 180);
    store.setIn('view', { rotation: next, zoom: rotationZoom(next) });
  }

  function flip(axis) {
    const state = store.getState();
    if (!state.source) return;
    store.setIn('view', axis === 'x' ? { flipX: !state.view.flipX } : { flipY: !state.view.flipY });
  }

  function resetTransform() {
    const state = store.getState();
    if (!state.source) return;
    store.setIn('view', { rotation: 0, flipX: false, flipY: false, zoom: 1, panX: 0, panY: 0 });
  }

  // ---------- 输出 ----------

  function setOutputWidth(value) {
    const state = store.getState();
    if (!state.source || !Number.isFinite(value)) return;
    const d = computeView(state, stage.getSize().width, stage.getSize().height);
    if (!d) return;
    const width = clamp(Math.round(value), 16, maxEdge);
    const height = state.output.lockAspect
      ? Math.max(16, Math.round(width / (d.outputWidth / d.outputHeight)))
      : d.outputHeight;
    setOutputSize(width, height);
  }

  function setOutputHeight(value) {
    const state = store.getState();
    if (!state.source || !Number.isFinite(value)) return;
    const d = computeView(state, stage.getSize().width, stage.getSize().height);
    if (!d) return;
    const height = clamp(Math.round(value), 16, maxEdge);
    const width = state.output.lockAspect
      ? Math.max(16, Math.round(height * (d.outputWidth / d.outputHeight)))
      : d.outputWidth;
    setOutputSize(width, height);
  }

  function setOutputSize(width, height) {
    const state = store.getState();
    const size = stage.getSize();
    const safe = clampOutputRequest(width, height);
    const aspect = safe.width / safe.height;
    const crop = ensureCropAspect(state.crop, aspect, size.width, size.height);
    store.set({
      crop: { ...crop, aspect, presetId: null },
      output: {
        ...state.output,
        mode: 'custom',
        width: safe.width,
        height: safe.height,
        presetId: null,
      },
      ui: { ...state.ui, showGuides: false },
    });
  }

  function clampOutputRequest(width, height) {
    let w = clamp(Math.round(Number(width) || 16), 16, maxEdge);
    let h = clamp(Math.round(Number(height) || 16), 16, maxEdge);
    const maxPixels = isMobile ? 16_000_000 : 64_000_000;
    const factor = Math.min(
      1,
      maxEdge / w,
      maxEdge / h,
      Math.sqrt(maxPixels / (w * h)),
    );
    if (factor < 1) {
      w = Math.max(16, Math.round(w * factor));
      h = Math.max(16, Math.round(h * factor));
    }
    return { width: w, height: h };
  }

  function setOutputLock(value) {
    const state = store.getState();
    const size = stage.getSize();
    const d = computeView(state, size.width, size.height);
    if (!d) return;
    if (!value) {
      store.setIn('output', { lockAspect: false });
      return;
    }
    const aspect = state.crop.aspect ?? d.outputWidth / d.outputHeight;
    const crop = ensureCropAspect(state.crop, aspect, size.width, size.height);
    store.set({
      output: {
        ...state.output,
        lockAspect: true,
        ...(state.output.mode === 'custom'
          ? { width: d.outputWidth, height: d.outputHeight }
          : {}),
      },
      crop: { ...crop, aspect, presetId: state.output.presetId },
    });
  }

  function setDpi(value) {
    const state = store.getState();
    if (!state.source || !Number.isFinite(value)) return;
    store.setIn('output', { dpi: clamp(Math.round(value), 72, 1200) });
  }

  function setFormat(format) {
    const state = store.getState();
    if (format === 'image/webp' && !supportsWebP()) {
      toast('当前浏览器不支持 WebP 导出，请选择 JPEG 或 PNG', 'error');
      return;
    }
    let background = state.encode.background;
    if (format === 'image/jpeg' && background === 'transparent') {
      background = '#ffffff';
      toast('JPEG 不支持透明背景，已改为白色', 'info');
    }
    store.setIn('encode', { format, background });
    updatePrefs({ format, background });
  }

  function setQuality(value) {
    if (!Number.isFinite(value)) return;
    store.setIn('encode', { quality: clamp(value, 0.3, 0.92) });
  }

  function setTargetKB(value) {
    if (value === null || value === undefined || value === '') {
      store.setIn('encode', { targetKB: null });
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast('请输入有效的目标体积', 'error');
      return;
    }
    store.setIn('encode', { targetKB: clamp(Math.round(value), 1, 20480) });
  }

  function setBackground(value) {
    const state = store.getState();
    let format = state.encode.format;
    if (value === 'transparent' && format === 'image/jpeg') {
      format = 'image/png';
      toast('透明背景需要 PNG，已自动切换格式', 'info');
    }
    store.setIn('encode', { background: value, format });
    updatePrefs({ background: value, format });
  }

  function toggleGrid(value) {
    store.setIn('ui', { showGrid: Boolean(value) });
    updatePrefs({ showGrid: Boolean(value) });
  }

  function toggleGuides(value) {
    store.setIn('ui', { showGuides: Boolean(value) });
    updatePrefs({ showGuides: Boolean(value) });
  }

  // ---------- 尺寸变化 ----------

  function handleStageResize(size) {
    const state = store.getState();
    store.set({ stage: { ...size } });
    if (!state.source || !state.crop.aspect) return;
    const crop = ensureCropAspect(state.crop, state.crop.aspect, size.width, size.height);
    store.setIn('crop', crop);
  }

  // ---------- 估算 ----------

  async function runEstimate() {
    const state = store.getState();
    if (!state.source || state.ui.busy) return;
    const size = stage.getSize();
    const d = computeView(state, size.width, size.height);
    if (!d) return;
    if (d.outputWidth * d.outputHeight > 16_000_000) {
      lastEstimate = { label: '导出时计算', target: state.encode.targetKB, error: false };
      refreshEstimateUI();
      return;
    }

    const token = (runEstimate.token = (runEstimate.token || 0) + 1);
    try {
      const { canvas, ctx } = createExportCanvas(d.outputWidth, d.outputHeight);
      renderExport(ctx, state, d.outputWidth, d.outputHeight, { stage: size });
      const target = state.encode.targetKB;
      const targetBytes = target ? target * 1024 : null;
      const headroom = targetBytes ? Math.max(1, targetBytes - 128) : null;
      const { blob } = await compressCanvasToTarget(
        canvas,
        state.encode.format,
        state.encode.quality,
        headroom,
      );
      let finalBlob = blob;
      if (state.output.dpi && state.encode.format !== 'image/webp') {
        finalBlob = await writeDpi(blob, state.encode.format, state.output.dpi);
      }
      if (token !== runEstimate.token) return;
      lastEstimate = {
        bytes: finalBlob.size,
        label: target
          ? finalBlob.size <= targetBytes
            ? `${formatBytes(finalBlob.size)} · 达标`
            : `${formatBytes(finalBlob.size)} · 超标`
          : formatBytes(finalBlob.size),
        target,
        error: Boolean(target && finalBlob.size > targetBytes),
      };
    } catch (error) {
      if (token !== runEstimate.token) return;
      const minSize = error?.detail?.minSize;
      if (minSize && state.output.mode !== 'preset') {
        lastEstimate = {
          target: state.encode.targetKB,
          label: '导出时会自动缩小',
          error: false,
        };
      } else {
        lastEstimate = {
          target: state.encode.targetKB,
          label: minSize ? `最小约 ${formatBytes(minSize)}` : messageOf(error),
          error: true,
        };
      }
    }
    refreshEstimateUI();
  }

  function refreshEstimateUI() {
    const state = store.getState();
    const size = stage.getSize();
    const d = computeView(state, size.width, size.height);
    panels.update(state, d, lastEstimate);
  }

  // ---------- 导出 ----------

  async function exportImage() {
    const state = store.getState();
    if (!state.source) {
      toast('请先导入一张照片', 'info');
      openFile();
      return;
    }
    if (state.ui.busy) return;

    store.setIn('ui', { busy: true });
    showLoading('正在导出…');
    let outW = 0;
    let outH = 0;
    try {
      const size = stage.getSize();
      const d = computeView(state, size.width, size.height);
      if (!d) throw new AppError(ErrorCode.NO_SOURCE);
      outW = d.outputWidth;
      outH = d.outputHeight;
      if (d.outputClamped) {
        toast('输出尺寸超出浏览器上限，已自动缩小', 'warn');
      }

      const target = state.encode.targetKB;
      const targetBytes = target ? target * 1024 : null;
      const headroom = targetBytes ? Math.max(1, targetBytes - 128) : null;
      let blob = null;

      for (let attempt = 0; attempt <= 3; attempt += 1) {
        const { canvas, ctx } = createExportCanvas(outW, outH);
        renderExport(ctx, state, outW, outH, { stage: size });
        try {
          const result = await compressCanvasToTarget(
            canvas,
            state.encode.format,
            state.encode.quality,
            headroom,
          );
          blob = result.blob;
        } catch (error) {
          const minSize = error?.detail?.minSize;
          if (
            error instanceof AppError &&
            error.code === ErrorCode.TARGET_UNREACHABLE &&
            state.output.mode !== 'preset' &&
            attempt < 3 &&
            minSize
          ) {
            const factor = clamp(Math.sqrt(headroom / minSize) * 0.92, 0.5, 0.92);
            outW = Math.max(16, Math.round(outW * factor));
            outH = Math.max(16, Math.round(outH * factor));
            continue;
          }
          throw error;
        }

        if (targetBytes) {
          blob = await writeDpi(blob, state.encode.format, state.output.dpi);
          if (blob.size > targetBytes) {
            if (state.output.mode !== 'preset' && attempt < 3) {
              const factor = clamp(Math.sqrt(targetBytes / blob.size) * 0.92, 0.5, 0.92);
              outW = Math.max(16, Math.round(outW * factor));
              outH = Math.max(16, Math.round(outH * factor));
              continue;
            }
            throw new AppError(ErrorCode.TARGET_UNREACHABLE, { minSize: blob.size });
          }
        } else {
          blob = await writeDpi(blob, state.encode.format, state.output.dpi);
        }
        break;
      }

      if (!blob) throw new AppError(ErrorCode.EXPORT_FAILED);
      const filename = buildFilename({
        mode: state.output.mode,
        presetId: state.output.presetId,
        width: outW,
        height: outH,
        format: state.encode.format,
      });
      downloadBlob(blob, filename);
      const minKB = state.encode.minKB;
      if (minKB && blob.size < minKB * 1024) {
        toast(
          `已导出 ${outW}×${outH} · ${formatBytes(blob.size)}，低于常见下限 ${minKB}KB，请核对官方要求`,
          'warn',
          5200,
        );
      } else {
        toast(`已导出 ${outW}×${outH} · ${formatBytes(blob.size)}`, 'success');
      }
      lastEstimate = {
        bytes: blob.size,
        label: formatBytes(blob.size),
        target: state.encode.targetKB,
        error: false,
      };
    } catch (error) {
      const minSize = error?.detail?.minSize;
      toast(
        minSize
          ? `${messageOf(error)}；当前最小约 ${formatBytes(minSize)}`
          : messageOf(error),
        'error',
        5200,
      );
    } finally {
      store.setIn('ui', { busy: false });
      hideLoading();
    }
  }

  // ---------- 渲染 ----------

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function render() {
    const state = store.getState();
    const signature = [
      state.source?.name,
      state.source?.size,
      state.source?.file?.lastModified,
      state.source?.width,
      state.source?.height,
      state.view.rotation,
      state.view.flipX,
      state.view.flipY,
      state.view.zoom,
      state.view.panX,
      state.view.panY,
      state.crop.x,
      state.crop.y,
      state.crop.w,
      state.crop.h,
      state.output.mode,
      state.output.width,
      state.output.height,
      state.output.dpi,
      state.encode.format,
      state.encode.quality,
      state.encode.targetKB,
      state.encode.background,
      state.stage.width,
      state.stage.height,
    ].join('|');
    if (signature !== lastEstimateSignature) {
      lastEstimateSignature = signature;
      lastEstimate = null;
      runEstimate.token = (runEstimate.token || 0) + 1;
    }

    const d = stage.render(state);
    cropOverlay.update(state, d);

    const hasSource = Boolean(state.source);
    root.querySelector('.app')?.classList.toggle('is-empty', !hasSource);
    refs.empty.hidden = hasSource;
    refs.stageHud.hidden = !hasSource;
    refs.exportButton.disabled = !hasSource || state.ui.busy;

    const quickFormat =
      state.encode.format === 'image/png'
        ? 'PNG'
        : state.encode.format === 'image/webp'
          ? 'WebP'
          : 'JPEG';
    refs.panelQuick.hidden = !hasSource || state.ui.tool === 'export';
    if (hasSource) {
      const quickPreset = getPreset(state.output.presetId);
      refs.quickDims.textContent = d ? `${d.outputWidth} × ${d.outputHeight}` : '—';
      refs.quickSub.textContent = `${
        quickPreset?.name ?? (state.output.mode === 'auto' ? '按裁剪框' : '自定义尺寸')
      } · ${quickFormat}`;
      refs.quickMeta.setAttribute('aria-label', `导出设置：${refs.quickSub.textContent}`);
      refs.quickExport.disabled = state.ui.busy;
      refs.quickExport.innerHTML = `${icon('download', 17)} ${
        state.ui.busy ? '导出中…' : '导出'
      }`;
    }

    if (hasSource) {
      refs.fileBadge.textContent = state.source.name;
      refs.fileBadge.title = state.source.name;
      refs.sourceBadge.textContent = state.source.downsampled
        ? `${state.source.width}×${state.source.height} · 已优化`
        : `${state.source.width}×${state.source.height}`;
      const preset = getPreset(state.output.presetId);
      refs.modeBadge.textContent = preset?.name ?? (state.crop.aspect ? '固定比例' : '自由裁剪');
      refs.statusSize.textContent = d
        ? `${d.outputWidth} × ${d.outputHeight} px`
        : '—';
      refs.statusMm.textContent = d
        ? `${formatMm(d.outputMm.width)} × ${formatMm(d.outputMm.height)} · ${state.output.dpi} dpi`
        : '—';
      refs.statusZoom.textContent = `缩放 ${Math.round(state.view.zoom * 100)}%`;
      refs.statusWarn.textContent =
        d && d.coverage < 0.999 ? '有留白' : '';
      refs.zoomReadout.textContent = `${Math.round(state.view.zoom * 100)}%`;
      refs.coverageWarning.hidden = !d || d.coverage >= 0.999;
    } else {
      refs.fileBadge.textContent = '—';
      refs.sourceBadge.textContent = '—';
      refs.modeBadge.textContent = '自由裁剪';
      refs.statusSize.textContent = '未导入';
      refs.statusMm.textContent = '—';
      refs.statusZoom.textContent = '缩放 100%';
      refs.statusWarn.textContent = '';
      refs.zoomReadout.textContent = '100%';
      refs.coverageWarning.hidden = true;
    }

    const tab = PANEL_TABS.find((item) => item.id === state.ui.tool) ?? PANEL_TABS[0];
    refs.panelEyebrow.textContent = tab.eyebrow;
    refs.panelTitle.textContent = tab.title;
    for (const button of root.querySelectorAll('[data-tool]')) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === state.ui.tool));
    }

    panels.update(state, d, lastEstimate);
    if (hasSource && state.ui.tool === 'export') estimateDebounced();
  }

  // ---------- 事件 ----------

  for (const button of root.querySelectorAll('[data-tool]')) {
    button.addEventListener('click', () => setTool(button.dataset.tool));
  }
  for (const button of root.querySelectorAll('[data-action="open"]')) {
    button.addEventListener('click', openFile);
  }
  for (const button of root.querySelectorAll('[data-action="camera"]')) {
    button.addEventListener('click', openCamera);
  }
  for (const button of root.querySelectorAll('[data-empty-preset]')) {
    button.addEventListener('click', () => openWithPreset(button.dataset.emptyPreset));
  }
  refs.quickExport.addEventListener('click', () => exportImage());
  refs.quickMeta.addEventListener('click', () => setTool('export'));
  refs.panelBody.addEventListener('focusin', (event) => {
    if (!isMobile) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches('input, select, textarea')) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 260);
  });
  refs.exportButton.addEventListener('click', () => {
    if (!store.getState().source) {
      openFile();
      return;
    }
    setTool('export');
  });
  for (const button of root.querySelectorAll('[data-zoom]')) {
    button.addEventListener('click', () => {
      const mode = button.dataset.zoom;
      if (mode === 'fit') fitView();
      else zoomBy(mode === 'in' ? 1 + ZOOM_STEP : 1 / (1 + ZOOM_STEP));
    });
  }

  refs.fileInput.addEventListener('change', () => {
    const preset = pendingPreset;
    pendingPreset = null;
    loadFile(refs.fileInput.files?.[0], preset);
  });
  refs.cameraInput.addEventListener('change', () => loadFile(refs.cameraInput.files?.[0]));

  document.addEventListener('paste', (event) => {
    const files = [...(event.clipboardData?.files ?? [])];
    const file = files.find((item) => !item.type || item.type.startsWith('image/')) ?? files[0];
    if (file) {
      event.preventDefault();
      loadFile(file);
    }
  });

  let dragDepth = 0;
  document.addEventListener('dragenter', (event) => {
    if (![...(event.dataTransfer?.types ?? [])].includes('Files')) return;
    event.preventDefault();
    dragDepth += 1;
    refs.stage.classList.add('is-dragover');
  });
  document.addEventListener('dragover', (event) => {
    if (![...(event.dataTransfer?.types ?? [])].includes('Files')) return;
    event.preventDefault();
  });
  document.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) refs.stage.classList.remove('is-dragover');
  });
  document.addEventListener('drop', (event) => {
    if (![...(event.dataTransfer?.types ?? [])].includes('Files')) return;
    event.preventDefault();
    dragDepth = 0;
    refs.stage.classList.remove('is-dragover');
    const files = [...(event.dataTransfer?.files ?? [])];
    const file = files.find((item) => !item.type || item.type.startsWith('image/')) ?? files[0];
    if (file) loadFile(file);
  });

  document.addEventListener('keydown', (event) => {
    if (isTypingTarget(event.target)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      openFile();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1.1);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomBy(1 / 1.1);
    } else if (event.key === '0') {
      event.preventDefault();
      fitView();
    }
  });

  store.subscribe(scheduleRender);
  render();
  setTool('crop');

  // 让首屏可以把示例提示替换成实际状态。
  window.__LITE_PHOTO__ = {
    store,
    stage,
    getDerived: () => computeView(store.getState(), stage.getSize().width, stage.getSize().height),
  };
}


