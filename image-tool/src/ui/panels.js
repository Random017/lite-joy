import { BACKGROUND_COLORS, FORMATS, QUICK_PRESET_IDS } from '../core/constants.js';
import { getPreset, PRESET_GROUPS, PRESETS } from '../core/presets.js';
import { formatDimensions } from '../utils/format.js';
import { el } from '../utils/dom.js';
import { icon } from './icons.js';

const RATIOS = [
  { id: 'free', label: '自由' },
  { id: 'original', label: '原图' },
  { id: '1:1', label: '1:1' },
  { id: '3:4', label: '3:4' },
  { id: '4:3', label: '4:3' },
  { id: '16:9', label: '16:9' },
];

function swatches(items, { selected, onSelect }) {
  const wrap = el('div', { class: 'swatches' });
  for (const item of items) {
    const button = el('button', {
      type: 'button',
      class: `swatch${item.value === 'transparent' ? ' swatch--none' : ''}`,
      title: item.label,
      ariaLabel: item.label,
      ariaPressed: selected === item.value,
      dataset: { color: item.value },
    });
    if (item.value !== 'transparent') {
      button.style.setProperty('--swatch', item.value);
    }
    button.addEventListener('click', () => onSelect(item.value));
    wrap.append(button);
  }
  return wrap;
}

export function createPanels(container, { store, actions }) {
  container.innerHTML = `
    <section class="panel-section" data-panel="crop">
      <div>
        <h3 class="section-heading">裁剪方式 <small id="crop-mode-label">自由裁剪</small></h3>
        <div class="segmented" role="group" aria-label="裁剪方式">
          <button class="segment" type="button" data-crop-mode="photo" aria-pressed="true">移动照片</button>
          <button class="segment" type="button" data-crop-mode="frame" aria-pressed="false">调整选框</button>
        </div>
      </div>
      <div>
        <h3 class="section-heading">画幅比例</h3>
        <div class="chip-row" id="ratio-row"></div>
      </div>
      <div class="button-grid">
        <button class="button button--small" type="button" data-action="fit">${icon('fit', 15)} 适应画布</button>
        <button class="button button--small" type="button" data-action="reset-crop">${icon('reset', 15)} 重置裁剪</button>
      </div>
      <label class="toggle-row">
        <span>显示三分网格</span>
        <input type="checkbox" id="grid-toggle" />
      </label>
      <p class="hint">拖动照片改变位置；滚轮或双指缩放。需要精确调整时切换到“调整选框”。</p>
      <div class="notice">
        ${icon('info', 15)}
        <span id="crop-pixel-info">导入照片后显示裁剪区域像素。</span>
      </div>
    </section>

    <section class="panel-section" data-panel="rotate" hidden>
      <div>
        <h3 class="section-heading">快速旋转</h3>
        <div class="button-grid">
          <button class="button" type="button" data-rotate="-90">${icon('rotateLeft', 16)} 左转 90°</button>
          <button class="button" type="button" data-rotate="90">${icon('rotate', 16)} 右转 90°</button>
          <button class="button" type="button" data-flip="x">${icon('flipH', 16)} 水平翻转</button>
          <button class="button" type="button" data-flip="y">${icon('flipV', 16)} 垂直翻转</button>
        </div>
      </div>
      <div class="field">
        <label class="field-label" for="angle-range">微调角度 <span id="angle-readout">0.0°</span></label>
        <div class="angle-row">
          <input type="range" id="angle-range" min="-180" max="180" step="0.1" value="0" />
          <input class="angle-value" type="number" id="angle-number" min="-180" max="180" step="0.1" value="0" aria-label="旋转角度" />
        </div>
      </div>
      <div class="button-grid">
        <button class="button button--small" type="button" data-action="fit">${icon('fit', 15)} 适应画布</button>
        <button class="button button--small" type="button" data-action="reset-transform">${icon('reset', 15)} 重置变换</button>
      </div>
      <p class="hint">旋转以照片中心为轴；裁剪框保持不动。微调角度适合校正轻微倾斜的扫描件。</p>
    </section>

    <section class="panel-section" data-panel="preset" hidden>
      <div class="preset-quick">
        <h3 class="section-heading">最常用 <small>点选即套用</small></h3>
        <div class="preset-grid preset-grid--quick" id="preset-quick"></div>
      </div>
      <div class="preset-groups" id="preset-groups"></div>
      <div>
        <h3 class="section-heading">自定义毫米尺寸</h3>
        <div class="input-row">
          <div class="field">
            <label class="field-label" for="custom-mm-width">宽</label>
            <div class="input-with-unit">
              <input class="input" id="custom-mm-width" type="number" min="1" max="500" step="0.1" value="25" />
              <span class="input-unit">mm</span>
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="custom-mm-height">高</label>
            <div class="input-with-unit">
              <input class="input" id="custom-mm-height" type="number" min="1" max="500" step="0.1" value="35" />
              <span class="input-unit">mm</span>
            </div>
          </div>
        </div>
        <div class="field" style="margin-top: 9px">
          <label class="field-label" for="custom-dpi">分辨率</label>
          <select class="select" id="custom-dpi">
            <option value="300">300 dpi（常见）</option>
            <option value="350">350 dpi</option>
            <option value="600">600 dpi（高精度）</option>
          </select>
        </div>
        <button class="button button--block button--primary" type="button" id="apply-custom" style="margin-top: 10px">
          ${icon('ruler', 16)} 应用自定义规格
        </button>
      </div>
      <div>
        <h3 class="section-heading">背景色</h3>
        <div id="preset-backgrounds"></div>
        <p class="hint" style="margin-top: 7px">只填充裁剪框内的留白，不会替换原照片背景。</p>
      </div>
      <label class="toggle-row">
        <span>显示人像构图参考线</span>
        <input type="checkbox" id="guides-toggle" />
      </label>
      <div class="notice notice--warn">
        ${icon('info', 15)}
        <span>规格为常见参考值。各考试、各省市要求可能不同，提交前请以官方公告为准。</span>
      </div>
    </section>

    <section class="panel-section" data-panel="export" hidden>
      <div class="summary-card">
        <div class="summary-main">
          <span class="summary-title">输出尺寸</span>
          <span class="summary-value" id="summary-dims">—</span>
        </div>
        <div class="summary-grid">
          <span>物理尺寸 <strong id="summary-mm">—</strong></span>
          <span>分辨率 <strong id="summary-dpi">—</strong></span>
          <span>格式 <strong id="summary-format">—</strong></span>
          <span>覆盖率 <strong id="summary-coverage">—</strong></span>
        </div>
        <div class="estimate-line">
          <span id="estimate-label">预计文件</span>
          <span class="estimate-value" id="estimate-value">计算中…</span>
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <span>像素尺寸</span>
          <span id="output-mode-label">按裁剪框</span>
        </div>
        <div class="input-row">
          <div class="input-with-unit">
            <input class="input" id="output-width" type="number" min="16" max="8192" step="1" inputmode="numeric" aria-label="输出宽度" />
            <span class="input-unit">px</span>
          </div>
          <div class="input-with-unit">
            <input class="input" id="output-height" type="number" min="16" max="8192" step="1" inputmode="numeric" aria-label="输出高度" />
            <span class="input-unit">px</span>
          </div>
        </div>
        <div class="toggle-row">
          <span class="hint">修改尺寸会同步调整裁剪框比例</span>
          <label class="check">
            <input type="checkbox" id="lock-aspect" />
            锁定
          </label>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="output-dpi">打印分辨率 <span>影响 mm 尺寸与文件元数据</span></label>
        <select class="select" id="output-dpi">
          <option value="300">300 dpi</option>
          <option value="350">350 dpi</option>
          <option value="600">600 dpi</option>
        </select>
      </div>

      <div class="field">
        <label class="field-label" for="format-select">文件格式</label>
        <select class="select" id="format-select"></select>
      </div>

      <div class="field" id="quality-field">
        <label class="field-label" for="quality-range">画质 <span id="quality-readout">88%</span></label>
        <input type="range" id="quality-range" min="30" max="92" step="1" value="88" />
        <p class="hint" id="quality-hint">JPEG/WebP 可用；压缩到目标体积时会在 30–92% 之间自动搜索。</p>
      </div>

      <div class="field">
        <label class="field-label" for="target-kb">目标体积 <span>留空表示不限制</span></label>
        <div class="input-with-unit">
          <input class="input" id="target-kb" type="number" min="1" max="20480" step="1" inputmode="numeric" placeholder="例如 40" />
          <span class="input-unit">KB</span>
        </div>
        <p class="hint" id="target-hint">填写后先压缩画质；仍超标且不是证件照时，会自动降低输出尺寸。</p>
      </div>

      <div>
        <h3 class="section-heading">背景色</h3>
        <div id="export-backgrounds"></div>
      </div>

      <div class="notice notice--warn" id="export-warning" hidden>
        ${icon('info', 15)}
        <span id="export-warning-text"></span>
      </div>

      <div class="export-cta">
        <button class="button button--primary button--block" type="button" id="export-button">
          ${icon('download', 17)} 导出图片
        </button>
      </div>
    </section>
  `;

  const refs = {
    cropModeLabel: container.querySelector('#crop-mode-label'),
    ratioRow: container.querySelector('#ratio-row'),
    gridToggle: container.querySelector('#grid-toggle'),
    cropPixelInfo: container.querySelector('#crop-pixel-info'),
    angleRange: container.querySelector('#angle-range'),
    angleNumber: container.querySelector('#angle-number'),
    angleReadout: container.querySelector('#angle-readout'),
    presetGroups: container.querySelector('#preset-groups'),
    presetQuick: container.querySelector('#preset-quick'),
    customWidth: container.querySelector('#custom-mm-width'),
    customHeight: container.querySelector('#custom-mm-height'),
    customDpi: container.querySelector('#custom-dpi'),
    applyCustom: container.querySelector('#apply-custom'),
    presetBackgrounds: container.querySelector('#preset-backgrounds'),
    guidesToggle: container.querySelector('#guides-toggle'),
    summaryDims: container.querySelector('#summary-dims'),
    summaryMm: container.querySelector('#summary-mm'),
    summaryDpi: container.querySelector('#summary-dpi'),
    summaryFormat: container.querySelector('#summary-format'),
    summaryCoverage: container.querySelector('#summary-coverage'),
    estimateLabel: container.querySelector('#estimate-label'),
    estimateValue: container.querySelector('#estimate-value'),
    outputWidth: container.querySelector('#output-width'),
    outputHeight: container.querySelector('#output-height'),
    lockAspect: container.querySelector('#lock-aspect'),
    outputDpi: container.querySelector('#output-dpi'),
    formatSelect: container.querySelector('#format-select'),
    qualityField: container.querySelector('#quality-field'),
    qualityRange: container.querySelector('#quality-range'),
    qualityReadout: container.querySelector('#quality-readout'),
    qualityHint: container.querySelector('#quality-hint'),
    targetKb: container.querySelector('#target-kb'),
    targetHint: container.querySelector('#target-hint'),
    exportBackgrounds: container.querySelector('#export-backgrounds'),
    exportWarning: container.querySelector('#export-warning'),
    exportWarningText: container.querySelector('#export-warning-text'),
    exportButton: container.querySelector('#export-button'),
    outputModeLabel: container.querySelector('#output-mode-label'),
  };

  for (const ratio of RATIOS) {
    const button = el('button', {
      type: 'button',
      class: 'chip',
      text: ratio.label,
      dataset: { ratio: ratio.id },
      ariaPressed: ratio.id === 'free',
    });
    button.addEventListener('click', () => actions.setAspect(ratio.id));
    refs.ratioRow.append(button);
  }

  const createPresetCard = (preset, extraClass = '') => {
    const card = el('button', {
      type: 'button',
      class: `preset-card${extraClass ? ` ${extraClass}` : ''}`,
      dataset: { preset: preset.id },
      ariaPressed: false,
    });
    card.append(
      el('span', { class: 'preset-name', text: preset.name }),
      el('span', { class: 'preset-size', text: `${preset.width}×${preset.height} px` }),
      el('span', {
        class: 'preset-mm',
        text: `${preset.mmWidth}×${preset.mmHeight} mm · ${preset.dpi} dpi`,
      }),
    );
    if (preset.tag) card.append(el('span', { class: 'preset-tag', text: preset.tag }));
    card.addEventListener('click', () => actions.applyPreset(preset.id));
    return card;
  };

  for (const id of QUICK_PRESET_IDS) {
    const preset = getPreset(id);
    if (preset) refs.presetQuick.append(createPresetCard(preset, 'preset-card--quick'));
  }

  for (const group of PRESET_GROUPS) {
    const groupNode = el('div', { class: 'preset-group' });
    groupNode.append(el('h3', { class: 'preset-group-title', text: group.label }));
    const grid = el('div', { class: 'preset-grid' });
    for (const preset of PRESETS.filter((item) => item.group === group.id)) {
      grid.append(createPresetCard(preset));
    }
    groupNode.append(grid);
    refs.presetGroups.append(groupNode);
  }

  const buildSwatches = (target, onSelect) => {
    target.append(
      swatches(BACKGROUND_COLORS, {
        selected: store.getState().encode.background,
        onSelect,
      }),
    );
  };
  buildSwatches(refs.presetBackgrounds, actions.setBackground);
  buildSwatches(refs.exportBackgrounds, actions.setBackground);

  for (const format of FORMATS) {
    refs.formatSelect.append(
      el('option', { value: format.id, text: `${format.label}（.${format.extension}）` }),
    );
  }

  container.querySelectorAll('[data-crop-mode]').forEach((button) => {
    button.addEventListener('click', () => actions.setCropMode(button.dataset.cropMode));
  });
  container.querySelectorAll('[data-action="fit"]').forEach((button) => {
    button.addEventListener('click', actions.fitView);
  });
  container.querySelectorAll('[data-action="reset-crop"]').forEach((button) => {
    button.addEventListener('click', actions.resetCrop);
  });
  container.querySelectorAll('[data-action="reset-transform"]').forEach((button) => {
    button.addEventListener('click', actions.resetTransform);
  });
  container.querySelectorAll('[data-rotate]').forEach((button) => {
    button.addEventListener('click', () => actions.rotateBy(Number(button.dataset.rotate)));
  });
  container.querySelectorAll('[data-flip]').forEach((button) => {
    button.addEventListener('click', () => actions.flip(button.dataset.flip));
  });

  refs.gridToggle.addEventListener('change', () => actions.toggleGrid(refs.gridToggle.checked));
  refs.guidesToggle.addEventListener('change', () =>
    actions.toggleGuides(refs.guidesToggle.checked),
  );
  refs.angleRange.addEventListener('input', () =>
    actions.setRotation(Number(refs.angleRange.value)),
  );
  refs.angleNumber.addEventListener('change', () =>
    actions.setRotation(Number(refs.angleNumber.value)),
  );
  refs.applyCustom.addEventListener('click', () =>
    actions.applyCustom(
      Number(refs.customWidth.value),
      Number(refs.customHeight.value),
      Number(refs.customDpi.value),
    ),
  );
  refs.outputWidth.addEventListener('change', () =>
    actions.setOutputWidth(Number(refs.outputWidth.value)),
  );
  refs.outputHeight.addEventListener('change', () =>
    actions.setOutputHeight(Number(refs.outputHeight.value)),
  );
  refs.lockAspect.addEventListener('change', () =>
    actions.setOutputLock(refs.lockAspect.checked),
  );
  refs.outputDpi.addEventListener('change', () =>
    actions.setDpi(Number(refs.outputDpi.value)),
  );
  refs.formatSelect.addEventListener('change', () =>
    actions.setFormat(refs.formatSelect.value),
  );
  refs.qualityRange.addEventListener('input', () =>
    actions.setQuality(Number(refs.qualityRange.value) / 100),
  );
  refs.targetKb.addEventListener('change', () => {
    const value = refs.targetKb.value.trim();
    actions.setTargetKB(value ? Number(value) : null);
  });
  refs.exportButton.addEventListener('click', actions.exportImage);

  function setTool(tool) {
    for (const panel of container.querySelectorAll('[data-panel]')) {
      panel.hidden = panel.dataset.panel !== tool;
    }
    container.scrollTop = 0;
  }

  function setCustomSize(mmWidth, mmHeight, dpi) {
    if (document.activeElement !== refs.customWidth) {
      refs.customWidth.value = String(mmWidth);
    }
    if (document.activeElement !== refs.customHeight) {
      refs.customHeight.value = String(mmHeight);
    }
    if (document.activeElement !== refs.customDpi) {
      refs.customDpi.value = String(dpi);
    }
  }

  function setRatioState(state) {
    const crop = state.crop;
    const sourceAspect = state.source ? state.source.width / state.source.height : null;
    const near = (a, b) => Math.abs(a - b) < 0.002;
    let active = 'free';
    if (crop.aspect) {
      if (sourceAspect && near(crop.aspect, sourceAspect)) active = 'original';
      else if (near(crop.aspect, 1)) active = '1:1';
      else if (near(crop.aspect, 3 / 4)) active = '3:4';
      else if (near(crop.aspect, 4 / 3)) active = '4:3';
      else if (near(crop.aspect, 16 / 9)) active = '16:9';
      else active = '';
    }
    for (const button of refs.ratioRow.querySelectorAll('[data-ratio]')) {
      button.setAttribute('aria-pressed', String(button.dataset.ratio === active));
    }
  }

  function update(state, derived, estimate) {
    const hasSource = Boolean(state.source);
    const crop = state.crop;
    const preset = state.output.presetId ? getPreset(state.output.presetId) : null;

    setRatioState(state);
    refs.cropModeLabel.textContent = preset
      ? `${preset.name} · 固定比例`
      : crop.aspect
        ? '固定比例'
        : '自由裁剪';
    for (const button of container.querySelectorAll('[data-crop-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.cropMode === state.ui.cropMode));
      button.disabled = button.dataset.cropMode === 'frame' && Boolean(crop.aspect);
    }
    refs.gridToggle.checked = state.ui.showGrid;
    refs.guidesToggle.checked = state.ui.showGuides;
    refs.guidesToggle.disabled = !crop.aspect;
    refs.cropPixelInfo.textContent = derived
      ? `裁剪区域约 ${formatDimensions(derived.cropImage.w, derived.cropImage.h)}，输出 ${formatDimensions(
          derived.outputWidth,
          derived.outputHeight,
        )}。`
      : '导入照片后显示裁剪区域像素。';

    const angle = ((((state.view.rotation + 180) % 360) + 360) % 360) - 180;
    if (document.activeElement !== refs.angleRange) refs.angleRange.value = String(angle);
    if (document.activeElement !== refs.angleNumber) {
      refs.angleNumber.value = String(Number(angle.toFixed(1)));
    }
    refs.angleReadout.textContent = `${angle.toFixed(1)}°`;

    for (const button of container.querySelectorAll('[data-preset]')) {
      button.setAttribute('aria-pressed', String(button.dataset.preset === state.output.presetId));
    }
    for (const button of refs.presetBackgrounds.querySelectorAll('[data-color]')) {
      button.setAttribute('aria-pressed', String(button.dataset.color === state.encode.background));
    }
    for (const button of refs.exportBackgrounds.querySelectorAll('[data-color]')) {
      button.setAttribute('aria-pressed', String(button.dataset.color === state.encode.background));
    }

    if (state.output.mode === 'preset' && preset) {
      setCustomSize(preset.mmWidth, preset.mmHeight, preset.dpi);
    }

    if (derived) {
      refs.summaryDims.textContent = `${derived.outputWidth} × ${derived.outputHeight}`;
      refs.summaryMm.textContent = `${derived.outputMm.width} × ${derived.outputMm.height} mm`;
      refs.summaryDpi.textContent = `${state.output.dpi} dpi`;
      refs.summaryFormat.textContent =
        FORMATS.find((item) => item.id === state.encode.format)?.label ?? 'JPEG';
      refs.summaryCoverage.textContent = `${Math.round(derived.coverage * 100)}%`;
    } else {
      refs.summaryDims.textContent = '—';
      refs.summaryMm.textContent = '—';
      refs.summaryDpi.textContent = '—';
      refs.summaryFormat.textContent = '—';
      refs.summaryCoverage.textContent = '—';
    }

    if (document.activeElement !== refs.outputWidth) {
      refs.outputWidth.value = derived ? String(derived.outputWidth) : '';
    }
    if (document.activeElement !== refs.outputHeight) {
      refs.outputHeight.value = derived ? String(derived.outputHeight) : '';
    }
    refs.outputWidth.max = String(state.ui.maxEdge ?? 8192);
    refs.outputHeight.max = String(state.ui.maxEdge ?? 8192);
    refs.lockAspect.checked = state.output.lockAspect;
    refs.outputDpi.value = String(state.output.dpi);
    refs.formatSelect.value = state.encode.format;
    refs.qualityRange.value = String(Math.round(state.encode.quality * 100));
    refs.qualityReadout.textContent = `${Math.round(state.encode.quality * 100)}%`;
    refs.qualityField.hidden = state.encode.format === 'image/png';
    if (document.activeElement !== refs.targetKb) {
      refs.targetKb.value = state.encode.targetKB ? String(state.encode.targetKB) : '';
    }
    refs.targetHint.textContent = state.encode.minKB
      ? `该规格常见要求 ≥ ${state.encode.minKB}KB${
          state.encode.targetKB ? `、≤ ${state.encode.targetKB}KB` : ''
        }；以官方公告为准。`
      : '填写后先压缩画质；仍超标且不是证件照时，会自动降低输出尺寸。';

    const modeLabel =
      state.output.mode === 'preset'
        ? '证件照规格'
        : state.output.mode === 'auto'
          ? '按裁剪框'
          : '自定义尺寸';
    refs.outputModeLabel.textContent = modeLabel;
    refs.exportButton.disabled = !hasSource || state.ui.busy;
    refs.exportButton.innerHTML = `${icon(
      state.ui.busy ? 'reset' : 'download',
      17,
    )} ${state.ui.busy ? '正在导出…' : '导出图片'}`;

    if (estimate) {
      refs.estimateLabel.textContent = estimate.target
        ? `目标 ≤ ${estimate.target}KB`
        : '预计文件';
      refs.estimateValue.textContent = estimate.label;
      refs.estimateValue.classList.toggle('is-warn', Boolean(estimate.error));
    } else {
      refs.estimateLabel.textContent = '预计文件';
      refs.estimateValue.textContent = hasSource ? '计算中…' : '—';
      refs.estimateValue.classList.remove('is-warn');
    }

    const warnings = [];
    if (!hasSource) warnings.push('先导入一张照片。');
    if (derived?.outputClamped) warnings.push('输出尺寸超出浏览器上限，已自动缩小。');
    if (derived && derived.coverage < 0.999) warnings.push('照片未铺满裁剪框，留白会使用所选背景色。');
    if (state.source?.downsampled) {
      warnings.push('原图较大，已降采样以保证编辑流畅；证件照输出通常不受影响。');
    }
    refs.exportWarning.hidden = warnings.length === 0;
    refs.exportWarningText.textContent = warnings.join(' ');
  }

  return { setTool, update, setCustomSize };
}
