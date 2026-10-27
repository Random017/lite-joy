const PATHS = {
  aperture: `
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 3 8.2 9h7.6L12 3Z"/>
    <path d="m19.8 7.5-7.6.1 3.8 6.4 3.8-6.5Z"/>
    <path d="m19.8 16.5-3.8-6.5-3.8 6.5h7.6Z"/>
    <path d="m12 21 3.8-6h-7.6L12 21Z"/>
    <path d="m4.2 16.5 7.6-.1-3.8-6.4-3.8 6.5Z"/>
    <path d="m4.2 7.5 3.8 6.5 3.8-6.5H4.2Z"/>
  `,
  crop: `
    <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
    <path d="M2 6h14a2 2 0 0 1 2 2v14"/>
  `,
  rotate: `
    <path d="M20 11a8 8 0 1 0-2.4 7.4"/>
    <path d="M20 4v7h-7"/>
  `,
  rotateLeft: `
    <path d="M4 11a8 8 0 1 1 2.4 7.4"/>
    <path d="M4 4v7h7"/>
  `,
  idCard: `
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/>
    <circle cx="8" cy="10.2" r="2.1"/>
    <path d="M5.2 16c.4-1.7 1.5-2.6 2.8-2.6s2.4.9 2.8 2.6"/>
    <path d="M14 9h4.5M14 12h4.5M14 15h3"/>
  `,
  download: `
    <path d="M12 3v11"/>
    <path d="m7.5 10 4.5 4.5 4.5-4.5"/>
    <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/>
  `,
  image: `
    <rect x="3" y="4" width="18" height="16" rx="2.5"/>
    <circle cx="8.4" cy="9.3" r="1.5"/>
    <path d="m3.8 17.5 5.2-5 4.1 3.7 2.8-2.6 4.3 3.9"/>
  `,
  upload: `
    <path d="M12 16V4"/>
    <path d="m7.5 8.5 4.5-4.5 4.5 4.5"/>
    <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/>
  `,
  camera: `
    <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3A1.5 1.5 0 0 1 21.5 9v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z"/>
    <circle cx="12" cy="13.2" r="3.7"/>
  `,
  flipH: `
    <path d="M12 3v18" stroke-dasharray="2 3"/>
    <path d="M8 7 4 12l4 5V7Z"/>
    <path d="m16 7 4 5-4 5V7Z"/>
  `,
  flipV: `
    <path d="M3 12h18" stroke-dasharray="2 3"/>
    <path d="M7 8 12 4l5 4H7Z"/>
    <path d="m7 16 5 4 5-4H7Z"/>
  `,
  grid: `
    <rect x="3.5" y="3.5" width="17" height="17" rx="2"/>
    <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>
  `,
  reset: `
    <path d="M4 10a8 8 0 1 1 2 7"/>
    <path d="M4 4v6h6"/>
  `,
  fit: `
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9"/>
    <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9"/>
    <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15"/>
    <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>
  `,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  minus: `<path d="M5 12h14"/>`,
  check: `<path d="m5 12 4.5 4.5L19 6.5"/>`,
  close: `<path d="m6 6 12 12M18 6 6 18"/>`,
  lock: `
    <rect x="5" y="10" width="14" height="11" rx="2"/>
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>
  `,
  unlock: `
    <rect x="5" y="10" width="14" height="11" rx="2"/>
    <path d="M8 10V7.5a4 4 0 0 1 7.4-2.1"/>
  `,
  info: `
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 11v5M12 8h.01"/>
  `,
  chevron: `<path d="m8 10 4 4 4-4"/>`,
  ruler: `
    <path d="m4.5 15.5 11-11a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8l-11 11a2 2 0 0 1-2.8 0l-1.2-1.2a2 2 0 0 1 0-2.8Z"/>
    <path d="m9 11 2 2M12 8l2 2M15 5l2 2"/>
  `,
  shield: `
    <path d="M12 3 5 6v5.5c0 4.2 2.8 7.6 7 9.5 4.2-1.9 7-5.3 7-9.5V6l-7-3Z"/>
    <path d="m9 12 2 2 4-4"/>
  `,
  sparkle: `
    <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5L5 10.6 10.4 9 12 3.5Z"/>
    <path d="M19 16.5v4M17 18.5h4" stroke-width="1.4"/>
  `,
};

export function icon(name, size = 20) {
  const body = PATHS[name] ?? PATHS.image;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);
