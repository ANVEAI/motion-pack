/* motion-pack/templates/_shared/relayout.mjs: the GENERIC re-layout for text / card templates that were designed at 16:9 (pure, node + browser).
   It is a re-layout, never a crop: every text block is re-fitted into the target aspect's SAFE rect (type/safezones.js: 'conservative' for 9:16, 'wideTitle' for 16:9;
   1:1 and 4:5 from the platform preset's safe fractions in plan.mjs), with the font size chosen so the line wraps into at most N lines at a size the frame-design floors allow
   (read line >= 48 px at 16:9, >= 56 px at 9:16, measured at the 1080 reference). Footage plates are re-framed with object-position (the picture keeps its subject), not scaled.
   What it does NOT do: move a subject inside footage, re-compose a 3D camera, or re-flow a chart. Templates that need those mark the aspect `manual` in their ASPECTS export.
     layoutFor(aspect, safeFrac?) -> { aspect, W, H, tall, u, S: {x0, y0, x1, y1, w, h} }
     fitPx(text, { w, maxPx, minPx, lines }) -> px           (deterministic width model of Manrope ExtraBold; conservative: real text is a little narrower)
     wrapLines(text, px, w) -> ['line', ...]                   (the same greedy wrap the browser does for one inline run, used to size the box for eyes)
     cardCss(L, brand) -> CSS for the card classes of templates/ad (card, over, proof, end, reveal) at aspect L. */
import { safeRect } from '../../type/safezones.js';

export const ASPECT_SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
export const READ_FLOOR = { '16:9': 48, '9:16': 56, '1:1': 52, '4:5': 54 };   // frame-design: one read line at least 48 px (16:9) / 56 px (9:16) at the 1080 reference
const ZONE = { '16:9': 'wideTitle', '9:16': 'conservative' };

export function layoutFor(aspect, safeFrac = { top: 0.06, bottom: 0.1, side: 0.06 }) {
  const sz = ASPECT_SIZES[aspect]; if (!sz) throw new Error(`relayout: unknown aspect ${aspect} (one of ${Object.keys(ASPECT_SIZES).join(', ')})`);
  const [W, H] = sz, u = Math.min(W, H) / 1080;
  let S; if (ZONE[aspect]) { const r = safeRect(ZONE[aspect], W, H); S = { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }; }
  else S = { x0: W * safeFrac.side, y0: H * safeFrac.top, x1: W * (1 - safeFrac.side), y1: H * (1 - safeFrac.bottom) };
  for (const k of Object.keys(S)) S[k] = Math.round(S[k]); S.w = S.x1 - S.x0; S.h = S.y1 - S.y0;
  return { aspect, W, H, tall: H > W, u, S };
}

/* advance widths in em for Manrope 800 with -0.035em tracking (measured by eye against the shipped font; rounded UP so a fitted line never overflows) */
const em = (c) => (/[A-Z]/.test(c) ? (/[MW]/.test(c) ? 0.92 : /[IJ]/.test(c) ? 0.34 : 0.7) : /[a-z]/.test(c) ? (/[mw]/.test(c) ? 0.86 : /[ijlft]/.test(c) ? 0.33 : 0.58) : /[0-9]/.test(c) ? 0.62 : c === ' ' ? 0.26 : 0.34);
export const textEm = (s) => [...String(s).replace(/\*/g, '')].reduce((a, c) => a + em(c), 0);
export function wrapLines(text, px, w) {
  const words = String(text).replace(/\*/g, '').split(/\s+/).filter(Boolean), out = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (!cur || textEm(t) * px <= w) cur = t; else { out.push(cur); cur = wd; } }
  if (cur) out.push(cur); return out;
}
export function fitPx(text, { w, maxPx, minPx = 40, lines = 2 }) {
  const longest = Math.max(0, ...String(text).replace(/\*/g, '').split(/\s+/).map(textEm));
  for (let px = Math.round(maxPx); px > minPx; px -= 2) if (longest * px <= w && wrapLines(text, px, w).length <= lines) return px;
  return Math.round(minPx);
}

/* the ad template's card classes at any aspect. 16:9 keeps its own hand-set CSS in make.mjs (byte for byte); this is the fallback for the others. */
export function cardCss(L, B) {
  const { W, H, S, u, tall } = L, R = (x) => Math.round(x), pad = `${S.y0}px ${W - S.x1}px ${H - S.y1}px ${S.x0}px`;
  return `
.card { background: ${B.paper}; display: flex; align-items: center; padding: ${pad}; }
.hl { font-weight: 800; line-height: 1.04; letter-spacing: -0.035em; max-width: ${S.w}px; }
.hl em { font-style: normal; color: ${B.accent}; }
.over { display: flex; align-items: flex-start; padding: ${R(S.y0 + 24 * u)}px ${W - S.x1}px 0 ${S.x0}px; }   /* plates keep their subject low: type sits in the clear top band of the safe rect */
.over .hl { color: #111; text-shadow: 0 2px 24px rgba(245,242,234,0.85); }
.proof { background: ${B.paper}; display: flex; ${tall ? 'flex-direction: column; align-items: flex-start; justify-content: center;' : 'align-items: center;'} gap: ${R(40 * u)}px; padding: ${pad}; }
.proof .tick { width: ${R(112 * u)}px; height: ${R(112 * u)}px; border-radius: ${R(56 * u)}px; background: ${B.accent}; flex: none; display: grid; place-items: center; }
.proof .tick svg { width: ${R(60 * u)}px; height: ${R(60 * u)}px; }
.end { background: ${B.paper}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${R(28 * u)}px; padding: ${pad}; text-align: center; }
.end .logo { max-width: ${R(S.w * 0.5)}px; max-height: ${R(160 * u)}px; }
.end .name { font-weight: 800; letter-spacing: -0.05em; color: ${B.ink}; line-height: 1; }
.end .name i { font-style: normal; color: ${B.accent}; }
.end .cta { font-weight: 700; background: ${B.accent}; color: #fff; padding: ${R(22 * u)}px ${R(48 * u)}px; border-radius: ${R(60 * u)}px; max-width: ${S.w}px; }
.end .url { font-family: "IBM Plex Mono"; font-weight: 600; font-size: ${R(Math.max(32, 34 * u))}px; color: #5d5850; letter-spacing: 0.04em; }
.reveal .hl { letter-spacing: -0.05em; }
.ph { background: repeating-linear-gradient(135deg, #e6e2d8 0 22px, #ddd8cc 22px 44px); display: flex; align-items: flex-end; padding: ${pad}; }
.ph .tag { font-family: "IBM Plex Mono"; font-weight: 600; font-size: ${R(Math.max(30, 32 * u))}px; color: #3d3a34; background: rgba(245,242,234,.92); padding: ${R(12 * u)}px ${R(20 * u)}px; border-radius: 8px; margin-bottom: ${R(24 * u)}px; }
video.clip { object-position: 50% 50%; }`;
}
/* the size of each role at aspect L (px), fitted to the safe width: the caller passes the line */
export function roleSize(L, role, text) {
  const { S, aspect, tall } = L, floor = READ_FLOOR[aspect] * L.u * (tall ? 1 : 1);
  const R = { card: { maxPx: tall ? 140 : 118 * (S.w / 1000), lines: 3 }, over: { maxPx: tall ? 116 : 100 * (S.w / 1000), lines: 3 }, proof: { maxPx: tall ? 100 : 88 * (S.w / 1000), lines: 3 },
    reveal: { maxPx: tall ? 200 : 180, lines: 1 }, name: { maxPx: tall ? 180 : 170, lines: 1 }, cta: { maxPx: tall ? 60 : 56, lines: 1, inner: 0.82 } }[role];
  return fitPx(text, { w: S.w * (R.inner || 1), maxPx: Math.max(R.maxPx, floor), minPx: floor, lines: R.lines });
}
