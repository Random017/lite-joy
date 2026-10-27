const KEY = 'lite-photo-prefs-v1';

const DEFAULTS = {
  presetId: null,
  showGrid: true,
  showGuides: true,
  format: 'image/jpeg',
  background: '#ffffff',
};

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(patch) {
  try {
    const current = loadPreferences();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // 隐私模式或存储禁用时静默失败，不影响主流程。
  }
}
