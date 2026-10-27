export const MM_PER_INCH = 25.4;

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 0.25;
export const FIT_PADDING = 0.94;

export const MIN_CROP_SIZE = 0.04;
export const MIN_OUTPUT_EDGE = 16;

export const MAX_PREVIEW_EDGE_DESKTOP = 2560;
export const MAX_PREVIEW_EDGE_MOBILE = 2048;

export const MAX_EXPORT_PIXELS_DESKTOP = 64_000_000;
export const MAX_EXPORT_PIXELS_MOBILE = 16_000_000;
export const MAX_EXPORT_EDGE_DESKTOP = 8192;
export const MAX_EXPORT_EDGE_MOBILE = 4096;

export const QUALITY_MIN = 0.3;
export const QUALITY_MAX = 0.92;
export const QUALITY_DEFAULT = 0.88;
export const QUALITY_STEP = 0.05;
export const QUALITY_SEARCH_ROUNDS = 7;
export const MAX_DOWNSCALE_ROUNDS = 3;

export const HISTORY_LIMIT = 30;

export const UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp';
export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const MAX_FILE_BYTES = 40 * 1024 * 1024;

export const BACKGROUND_COLORS = [
  { id: 'white', label: '白底', value: '#ffffff' },
  { id: 'blue', label: '蓝底', value: '#438edb' },
  { id: 'red', label: '红底', value: '#d23a32' },
  { id: 'gray', label: '灰底', value: '#d8d8d8' },
  { id: 'none', label: '透明', value: 'transparent' },
];

export const FORMATS = [
  { id: 'image/jpeg', label: 'JPEG', extension: 'jpg', supportsQuality: true },
  { id: 'image/png', label: 'PNG', extension: 'png', supportsQuality: false },
  { id: 'image/webp', label: 'WebP', extension: 'webp', supportsQuality: true },
];

export const OUTPUT_MODES = [
  { id: 'preset', label: '证件照规格' },
  { id: 'custom', label: '自定义尺寸' },
  { id: 'auto', label: '按裁剪框' },
];

export const LAYOUT_MOBILE_QUERY = '(max-width: 760px)';

export const QUICK_PRESET_IDS = ['one-inch', 'two-inch', 'social-security', 'passport'];

export const PANEL_TABS = [
  { id: 'crop', label: '裁剪', icon: 'crop', title: '裁剪与比例', eyebrow: 'CROP' },
  { id: 'rotate', label: '旋转', icon: 'rotate', title: '旋转与翻转', eyebrow: 'ROTATE' },
  { id: 'preset', label: '规格', icon: 'idCard', title: '证件照规格', eyebrow: 'ID PHOTO' },
  { id: 'export', label: '导出', icon: 'download', title: '尺寸与导出', eyebrow: 'EXPORT' },
];
