import { MM_PER_INCH } from './constants.js';

/**
 * 常用证件照规格。
 *
 * 说明：
 * - 像素值按 mm × dpi / 25.4 四舍五入，允许和官方要求有 ±1px 的差异。
 * - 各省市、各年度考试要求可能变化，界面必须提示“以官方公告为准”。
 * - 不把“公务员/会计/教资”等写死为唯一规格，用户可以在导出面板覆盖。
 */
const COMMON = { group: 'common', groupLabel: '常用' };
const EXAM = { group: 'exam', groupLabel: '考试报名' };
const DOCUMENT = { group: 'document', groupLabel: '证件与签证' };

export const PRESETS = [
  {
    id: 'one-inch',
    name: '一寸',
    ...COMMON,
    width: 295,
    height: 413,
    dpi: 300,
    mmWidth: 25,
    mmHeight: 35,
    background: '#ffffff',
    tag: '最常用',
  },
  {
    id: 'small-one-inch',
    name: '小一寸',
    ...COMMON,
    width: 260,
    height: 378,
    dpi: 300,
    mmWidth: 22,
    mmHeight: 32,
    background: '#ffffff',
  },
  {
    id: 'large-one-inch',
    name: '大一寸',
    ...COMMON,
    width: 390,
    height: 567,
    dpi: 300,
    mmWidth: 33,
    mmHeight: 48,
    background: '#ffffff',
  },
  {
    id: 'two-inch',
    name: '二寸',
    ...COMMON,
    width: 413,
    height: 579,
    dpi: 300,
    mmWidth: 35,
    mmHeight: 49,
    background: '#ffffff',
    tag: '最常用',
  },
  {
    id: 'small-two-inch',
    name: '小二寸',
    ...COMMON,
    width: 413,
    height: 531,
    dpi: 300,
    mmWidth: 35,
    mmHeight: 45,
    background: '#ffffff',
  },
  {
    id: 'large-two-inch',
    name: '大二寸',
    ...COMMON,
    width: 413,
    height: 626,
    dpi: 300,
    mmWidth: 35,
    mmHeight: 53,
    background: '#ffffff',
  },
  {
    id: 'resume',
    name: '简历照',
    ...COMMON,
    width: 295,
    height: 413,
    dpi: 300,
    mmWidth: 25,
    mmHeight: 35,
    background: '#ffffff',
  },
  {
    id: 'civil-servant',
    name: '公务员',
    ...EXAM,
    width: 295,
    height: 413,
    dpi: 300,
    mmWidth: 25,
    mmHeight: 35,
    background: '#ffffff',
    tag: '国考常见',
  },
  {
    id: 'accounting',
    name: '会计',
    ...EXAM,
    width: 295,
    height: 413,
    dpi: 300,
    mmWidth: 25,
    mmHeight: 35,
    background: '#ffffff',
    minKB: 10,
    tag: '常见 ≥10KB',
  },
  {
    id: 'teacher',
    name: '教师资格',
    ...EXAM,
    width: 295,
    height: 413,
    dpi: 300,
    mmWidth: 25,
    mmHeight: 35,
    background: '#ffffff',
  },
  {
    id: 'postgraduate',
    name: '考研确认',
    ...EXAM,
    width: 480,
    height: 640,
    dpi: 300,
    mmWidth: 40.6,
    mmHeight: 54.2,
    background: '#ffffff',
    tag: '480×640',
  },
  {
    id: 'social-security',
    name: '社保',
    ...DOCUMENT,
    width: 358,
    height: 441,
    dpi: 350,
    mmWidth: 26,
    mmHeight: 32,
    background: '#ffffff',
    minKB: 14,
    maxKB: 40,
    tag: '常见 14–40KB',
  },
  {
    id: 'passport',
    name: '护照',
    ...DOCUMENT,
    width: 390,
    height: 567,
    dpi: 300,
    mmWidth: 33,
    mmHeight: 48,
    background: '#ffffff',
  },
  {
    id: 'visa',
    name: '签证',
    ...DOCUMENT,
    width: 413,
    height: 531,
    dpi: 300,
    mmWidth: 35,
    mmHeight: 45,
    background: '#ffffff',
  },
  {
    id: 'driver',
    name: '驾驶证',
    ...DOCUMENT,
    width: 260,
    height: 378,
    dpi: 300,
    mmWidth: 22,
    mmHeight: 32,
    background: '#ffffff',
  },
];

export const PRESET_GROUPS = [
  { id: 'common', label: '常用尺寸' },
  { id: 'exam', label: '考试报名' },
  { id: 'document', label: '证件与签证' },
];

export const PRESET_BY_ID = Object.freeze(
  Object.fromEntries(PRESETS.map((preset) => [preset.id, Object.freeze({ ...preset })])),
);

export function getPreset(id) {
  return PRESET_BY_ID[id] ?? null;
}

export function presetAspect(preset) {
  return preset.width / preset.height;
}

export function presetPixelsFromMm(mmWidth, mmHeight, dpi) {
  return {
    width: Math.max(1, Math.round((mmWidth / MM_PER_INCH) * dpi)),
    height: Math.max(1, Math.round((mmHeight / MM_PER_INCH) * dpi)),
  };
}

export function presetMmFromPixels(width, height, dpi) {
  return {
    mmWidth: Number(((width / dpi) * MM_PER_INCH).toFixed(1)),
    mmHeight: Number(((height / dpi) * MM_PER_INCH).toFixed(1)),
  };
}

export function presetSizeLabel(preset) {
  return `${preset.width} × ${preset.height} px`;
}
