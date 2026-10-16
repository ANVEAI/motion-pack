/* motion-pack / type / gfx / numfmt.js: number formatting by locale for data stories (lane explainer, 2026-10-16). Pure, no Intl, no DOM.
   Intl.NumberFormat output depends on the ICU build of the runtime (Node, Chrome and Safari disagree on spaces and compact forms), so a render could change with the
   browser. These rules are written out instead, so the same number prints the same characters everywhere.

     fmtNumber(v, { locale, dec, compact, prefix, suffix, unit, sign, minus })
       locale   'intl' (1,234,567 · K M B T)  'in' (Indian grouping 12,34,567 · thousand, lakh, crore, lakh crore)  'eu' (1.234.567,8)  'si' (1 234 567 with thin spaces)
       dec      decimals (0..8, clamped);  compact false | 'short' (2.5M, 1.5 L, 3.2 Cr) | 'long' (2.5 million, 1.5 lakh, 3.2 crore)
       unit     appended after a thin space unless it is '%' (no space);  prefix / suffix glued on as given (a currency sign, '+')
       sign     true: '+' on positive numbers (a change);  minus: the minus glyph (default U+2212, the typographic minus)
     groupDigits('1234567', 'in') -> '12,34,567'   (the integer part only)
     compactParts(v, locale, mode) -> { value, word } the scaled value and the word / letter for it
     fmtAxis(v, opts) the tick label: the same rules, compact 'short' by default for 4+ digit numbers
   Indian system: lakh = 1,00,000 (1e5), crore = 1,00,00,000 (1e7), lakh crore = 1e12; the grouping is the last three digits, then pairs. Non-finite input prints an en dash. */
export const MINUS = '−', THIN = ' ';
export const LOCALES = {
  intl: { group: ',', decimal: '.', grouping: 'intl', short: [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']], long: [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] },
  in: { group: ',', decimal: '.', grouping: 'in', short: [[1e12, 'L Cr'], [1e7, 'Cr'], [1e5, 'L'], [1e3, 'K']], long: [[1e12, 'lakh crore'], [1e7, 'crore'], [1e5, 'lakh'], [1e3, 'thousand']] },
  eu: { group: '.', decimal: ',', grouping: 'intl', short: [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']], long: [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] },
  si: { group: THIN, decimal: '.', grouping: 'intl', short: [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k']], long: [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] },
};
const loc = (l) => LOCALES[l] || LOCALES[String(l || '').toLowerCase().replace(/^en-/, '')] || (/in$/i.test(String(l)) ? LOCALES.in : LOCALES.intl);
const decOf = (d) => Math.max(0, Math.min(8, Math.trunc(Number.isFinite(+d) ? +d : 0)));

export function groupDigits(int, grouping = 'intl', sep = ',') {
  const s = String(int).replace(/^0+(?=\d)/, '');
  if (s.length <= 3) return s;
  if (grouping !== 'in') return s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const head = s.slice(0, -3), tail = s.slice(-3);
  return head.replace(/\B(?=(\d{2})+(?!\d))/g, sep) + sep + tail;
}
/* the compact scale for |v|: the largest step it reaches; a value that rounds up to the next step moves to it (999,950 at 1 decimal -> 1.0M, not 1,000.0K) */
export function compactParts(v, locale = 'intl', mode = 'short', dec = 1) {
  const L = loc(locale), steps = mode === 'long' ? L.long : L.short, a = Math.abs(v), d = decOf(dec);
  for (const [k, word] of steps) if (+(a / k).toFixed(d) >= 1) return { value: v / k, word, k };
  return { value: v, word: '', k: 1 };
}
export function fmtNumber(v, { locale = 'intl', dec = 0, compact = false, prefix = '', suffix = '', unit = '', sign = false, minus = MINUS } = {}) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return '–';
  const L = loc(locale), d = decOf(dec);
  let val = n, word = '';
  if (compact === 'short' || compact === 'long' || compact === true) { const c = compactParts(n, locale, compact === 'long' ? 'long' : 'short', d); val = c.value; word = c.word; }
  const fixed = Math.abs(val).toFixed(d), neg = val < 0 && +fixed !== 0, [ip, fp] = fixed.split('.');
  let body = groupDigits(ip, L.grouping, L.group) + (fp ? L.decimal + fp : '');
  if (word) body += (compact === 'long' || word.length > 2 || word.includes(' ') || L.grouping === 'in' ? ' ' : '') + word;
  const u = unit ? (unit === '%' || unit === '‰' ? unit : THIN + unit) : '';
  return (neg ? minus : sign && n > 0 ? '+' : '') + prefix + body + u + suffix;
}
/* an axis tick: compact short once the number has 4+ integer digits, otherwise plain at the given decimals */
export function fmtAxis(v, { locale = 'intl', dec = 0, unit = '', prefix = '', compact = 'auto' } = {}) {
  const c = compact === 'auto' ? (Math.abs(v) >= 1e4 ? 'short' : false) : compact;
  if (!c) return fmtNumber(v, { locale, dec, unit, prefix });
  const pv = compactParts(v, locale, c === 'long' ? 'long' : 'short', 1).value, d = Number.isInteger(+pv.toFixed(1)) ? 0 : 1;   // 25K, 12.5K: never 25.0K, never 13K for 12,500
  return fmtNumber(v, { locale, dec: d, compact: c, unit, prefix });
}
/* decimals that show a value without noise: 0 for big numbers, up to 2 for small ones */
export const autoDec = (v) => { const a = Math.abs(v); return a >= 100 || Number.isInteger(v) ? 0 : a >= 10 ? 1 : 2; };
