/* motion-pack / type / safezones.js: per-platform UI safe zones and caption boxes. Numbers are px at the reference canvas (1080 x 1920 tall, 1920 x 1080 wide) and scale with the frame.
   HONESTY: the pack research found the platform sources CONFLICT (edit.md: top 14% / bottom 35% / sides 6%;  visual.md: top 220 / bottom 420 / right 120 / left 60) and none could be verified
   against a current official template. `conservative` is the union (max of each side); the per-platform rows are working estimates flagged verify:true. Re-check before a paid campaign. */
export const SAFE = {
  conservative: { ref: 'tall', top: 269, bottom: 672, left: 65, right: 120, verify: true, note: 'union of the two conflicting research sources: safe everywhere' },
  tiktok:  { ref: 'tall', top: 150, bottom: 480, left: 60, right: 140, verify: true },
  reels:   { ref: 'tall', top: 220, bottom: 420, left: 60, right: 120, verify: true },
  shorts:  { ref: 'tall', top: 140, bottom: 380, left: 60, right: 120, verify: true },
  ytAd:    { ref: 'tall', top: 200, bottom: 500, left: 60, right: 120, verify: true },
  metaStory: { ref: 'tall', top: 250, bottom: 340, left: 60, right: 60, verify: true },
  wideTitle: { ref: 'wide', top: 54, bottom: 54, left: 96, right: 96, verify: false, note: '5% title-safe margin (broadcast convention)' },
  wideAction: { ref: 'wide', top: 38, bottom: 38, left: 67, right: 67, verify: false, note: '3.5% action-safe margin' },
};
export const PLATFORMS = Object.keys(SAFE);
/* rect of the safe area in output px: {x0,y0,x1,y1,w,h}. Scales by H/refH. */
export function safeRect(platform, W, H) {
  const z = SAFE[platform]; if (!z) throw new Error('unknown platform ' + platform); const s = H / (z.ref === 'tall' ? 1920 : 1080);
  const x0 = z.left * s, y0 = z.top * s, x1 = W - z.right * s, y1 = H - z.bottom * s; return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, scale: s };
}
/* caption box: width = safe width, bottom edge sits `gap` px above the safe bottom, height = lines * lineHeight * fontPx (fontPx at output scale) */
export function captionBox(platform, W, H, { lines = 2, fontPx, lineHeight = 1.18, gap = 24, anchor = 'bottom' } = {}) {
  fontPx ??= 72 * (H > W ? W / 1080 : H / 1080); const r = safeRect(platform, W, H), h = lines * lineHeight * fontPx; const y1 = anchor === 'bottom' ? r.y1 - gap * r.scale : r.y0 + h + gap * r.scale; return { x0: r.x0, x1: r.x1, y0: y1 - h, y1, w: r.w, h, cx: (r.x0 + r.x1) / 2 };
}
/* does a rect {x0,y0,x1,y1} (output px) sit inside the platform's safe area? returns the list of sides that are violated and by how many px */
export function lintRect(rect, platform, W, H) { const r = safeRect(platform, W, H), out = []; if (rect.x0 < r.x0 - 0.5) out.push({ side: 'left', px: +(r.x0 - rect.x0).toFixed(1) }); if (rect.x1 > r.x1 + 0.5) out.push({ side: 'right', px: +(rect.x1 - r.x1).toFixed(1) }); if (rect.y0 < r.y0 - 0.5) out.push({ side: 'top', px: +(r.y0 - rect.y0).toFixed(1) }); if (rect.y1 > r.y1 + 0.5) out.push({ side: 'bottom', px: +(rect.y1 - r.y1).toFixed(1) }); return out; }
/* caption style lint (numbers from the pack research): 9:16 captions 64..80 px, <= 2 lines, <= 18 chars per line; 16:9 >= 40 px; 2..4 words per chunk (talking head) */
export function lintCaptionStyle({ fontPx, lines = 2, maxCharsPerLine = 18, maxWords = 3 }, W, H) {
  const tall = H > W, f1080 = fontPx * (tall ? 1080 / W : 1080 / H), o = []; if (tall && (f1080 < 64 || f1080 > 80)) o.push(`font ${f1080.toFixed(0)} px @1080 wide outside 64..80`); if (!tall && f1080 < 40) o.push(`font ${f1080.toFixed(0)} px < 40`);
  if (lines > 2) o.push(`${lines} lines > 2`); if (tall && maxCharsPerLine > 18) o.push(`${maxCharsPerLine} chars per line > 18`); if (maxWords > 4 || maxWords < 1) o.push(`${maxWords} words per chunk outside 1..4`); return o;
}
