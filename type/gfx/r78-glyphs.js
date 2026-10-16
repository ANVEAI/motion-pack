/* motion-pack / type / gfx / r78-glyphs.js (xp-r78, 2026-10-16): which characters the bundled UI font (Manrope, OFL, templates/_shared/fonts/Manrope-Variable.ttf) can draw, as code-point ranges,
   so layout.pillWall can say BEFORE a render which labels would fall back to a system font (a wall of pills "in many scripts" is only honest where the pack's own font has the glyphs: Latin,
   Latin extended, Vietnamese, Greek and Cyrillic; not Devanagari, Arabic, Hebrew, Thai or CJK).
   The table is generated from the font's own cmap and checked against it: tools/tests/test_pill_glyphs.py reads this file and the font and fails when they differ (regenerate with
   python3 tools/tests/test_pill_glyphs.py --print). Pure data + a pure function. */
export const MANROPE_RANGES = [[13, 13], [32, 126], [160, 275], [278, 299], [302, 305], [308, 311], [313, 318], [321, 328], [330, 333], [336, 382], [402, 402], [416, 417], [431, 432], [536, 539], [601, 601], [710, 711], [728, 733], [884, 885], [894, 894], [900, 906], [908, 908], [910, 929], [931, 974], [1024, 1119], [1168, 1169], [1198, 1199], [1210, 1211], [1256, 1257], [7808, 7813], [7838, 7838], [7840, 7929], [8209, 8209], [8211, 8212], [8216, 8218], [8220, 8226], [8230, 8230], [8240, 8240], [8249, 8250], [8260, 8260], [8288, 8288], [8304, 8304], [8308, 8313], [8320, 8329], [8355, 8355], [8361, 8364], [8366, 8366], [8369, 8369], [8372, 8372], [8377, 8378], [8381, 8381], [8383, 8383], [8470, 8470], [8482, 8482], [8592, 8595], [8629, 8629], [8706, 8706], [8709, 8709], [8719, 8719], [8721, 8722], [8725, 8725], [8730, 8730], [8734, 8734], [8747, 8747], [8776, 8776], [8800, 8800], [8804, 8805], [9674, 9674], [57345, 57347], [57351, 57353], [64257, 64258]];
const HAS = (cp) => { let lo = 0, hi = MANROPE_RANGES.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1, [a, b] = MANROPE_RANGES[m]; if (cp < a) hi = m - 1; else if (cp > b) lo = m + 1; else return true; } return false; };
/* the code points of `str` the bundled font has no glyph for (control characters other than tab / newline / carriage return count as missing) */
export function missingGlyphs(str) {
  const out = []; for (const ch of String(str ?? '')) { const cp = ch.codePointAt(0); if (cp === 9 || cp === 10) continue; if (!HAS(cp) && !out.includes(cp)) out.push(cp); } return out;
}
export const hasGlyphs = (str) => missingGlyphs(str).length === 0;
