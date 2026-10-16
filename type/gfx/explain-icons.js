/* motion-pack / type / gfx / explain-icons.js: 16 owned line icons for process steps and diagram nodes (lane explainer, 2026-10-16). MIT, drawn for the pack: no icon set is vendored.
   Each icon is SVG path data on a 24 x 24 grid, stroked (round caps, 2 px at 24). iconSVG(name, x, y, size, color, k) draws it centred on (x, y); k (0..1) draws the strokes on.
   An unknown name draws the `dot` icon, never an error. For a full icon library, fetch Lucide (ISC) or Phosphor (MIT) with scripts/fetch-external.sh. */
export const ICONS = {
  gear: 'M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7 M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1',
  drop: 'M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11z',
  timer: 'M12 7.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13 M12 14v-3.5 M9.5 3h5 M12 3v4.5',
  cup: 'M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 10h1.5a2.5 2.5 0 0 1 0 5H16 M8 3.5v2 M11 3.5v2',
  check: 'M4.5 12.5l5 5l10-11',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13 M15.3 15.3L20.5 20.5',
  upload: 'M12 15V4 M7.5 8.5L12 4l4.5 4.5 M4.5 15v4.5h15V15',
  download: 'M12 4v11 M7.5 10.5L12 15l4.5-4.5 M4.5 15v4.5h15V15',
  edit: 'M4.5 19.5l1-4l10-10l3 3l-10 10z M13.5 7.5l3 3',
  lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  chart: 'M4 20h16 M7 20v-6 M12 20V8 M17 20v-9',
  leaf: 'M5 19c0-8 5-13 14-14c-1 9-6 14-14 14z M5 19l7-7',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4',
  plug: 'M9 3v5 M15 3v5 M6.5 8h11v3a5.5 5.5 0 0 1-11 0z M12 16.5V21',
  doc: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
  person: 'M12 4a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7 M5 20c.8-4 3.5-6 7-6s6.2 2 7 6',
  dot: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
};
export const ICON_NAMES = Object.keys(ICONS);
const f2 = (v) => (Math.round(v * 100) / 100).toString();
export function iconSVG(name, x, y, size, color, k = 1, width = 2) {
  const d = ICONS[name] || ICONS.dot, sc = size / 24, kk = Math.max(0, Math.min(1, Number.isFinite(k) ? k : 1));
  return `<g transform="translate(${f2(x - size / 2)} ${f2(y - size / 2)}) scale(${sc.toFixed(4)})"><path d="${d}" fill="none" stroke="${color}" stroke-width="${f2(width)}" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - kk))}"/></g>`;
}
