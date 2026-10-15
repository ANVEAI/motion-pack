/* motion-pack / type / gfx / safe.js: parameter safety for every part that loops over a numeric parameter (2026-10-15). Pure, no state, no DOM.
   A part is a pure function of t, but a pure function can still run for ever or build gigabytes of markup from one nonsense number: radius 0 (rows = H / 0 = Infinity), a step of 0 (x += 0), a count of 1e9, NaN.
     saneParams(p, d, lim)  (1) a NaN or +-Infinity number anywhere in p (numbers, arrays, plain objects; depth <= 4, first 64 entries each) becomes the default at the same path (0 when there is none; a NaN in a text param such as `source` gets the default text, not the number 0, which would print as the "source" 0);
                            (2) every path in `lim` ({ count: [0, 80], 'tiles.*': [1, 24], 'rect.3': [0, 1] }) is clamped into [lo, hi]: a count above its maximum draws the maximum, a step below its
                                minimum uses the minimum, and neither loops. '*' matches every element of an array. A numeric string is read as a number.
   Returns p itself (same object) when nothing needed changing, so the common frame allocates nothing. The limits live in type/gfx/limits.js (gfx ids) and layers/limits.js (Canvas2D kinds and
   backgrounds); tools/tests/fuzz-params.test.mjs renders every registered part with 0, -1, NaN, Infinity, 1e9 and 1e-6 on every numeric default and fails on a hang, an out-of-memory or a runaway string. */
const isObj = (v) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const num = (v) => typeof v === 'number';
function fix(v, dv, depth) {
  if (num(v)) return Number.isFinite(v) ? v : (dv === undefined || (num(dv) && !Number.isFinite(dv)) ? 0 : dv);   // the default of ANY type (a text param's default is a string, never the number 0 printed as "0")
  if (depth <= 0) return v;
  if (Array.isArray(v)) { let out = null; const n = Math.min(v.length, 64); for (let i = 0; i < n; i++) { const x = fix(v[i], Array.isArray(dv) ? dv[i] : undefined, depth - 1); if (x !== v[i]) { out ||= v.slice(); out[i] = x; } } return out || v; }
  if (isObj(v)) { let out = null, c = 0; for (const k of Object.keys(v)) { if (++c > 64) break; const x = fix(v[k], isObj(dv) ? dv[k] : undefined, depth - 1); if (x !== v[k]) { out ||= { ...v }; out[k] = x; } } return out || v; }
  return v;
}
function clampAt(v, parts, lo, hi, dv) {
  if (!parts.length) {
    const n = num(v) ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : null; if (n === null) return v;
    const f = Number.isFinite(n) ? n : (num(dv) && Number.isFinite(dv) ? dv : lo); return Math.min(hi, Math.max(lo, f));
  }
  const [k, ...rest] = parts;
  if (Array.isArray(v)) { let out = null; for (let i = 0; i < Math.min(v.length, 64); i++) { if (k !== '*' && String(i) !== k) continue; const x = clampAt(v[i], rest, lo, hi, Array.isArray(dv) ? dv[i] : undefined); if (x !== v[i]) { out ||= v.slice(); out[i] = x; } } return out || v; }
  if (isObj(v) && k in v) { const x = clampAt(v[k], rest, lo, hi, isObj(dv) ? dv[k] : undefined); return x === v[k] ? v : { ...v, [k]: x }; }
  return v;
}
export function saneParams(p, d = {}, lim = null) {
  let out = fix(p, d, 4);
  if (lim) for (const key of Object.keys(lim)) out = clampAt(out, key.split('.'), lim[key][0], lim[key][1], d);
  return out;
}
/* an index into a list of n: wrapIndex wraps (-1 is the last, n is the first), clampIndex sticks to the ends; a NaN / non-number reads as 0; an empty list gives 0 */
export const wrapIndex = (i, n) => (n > 0 ? ((Math.trunc(Number.isFinite(i) ? i : 0) % n) + n) % n : 0);
export const clampIndex = (i, n) => Math.min(Math.max(0, n - 1), Math.max(0, Math.trunc(Number.isFinite(i) ? i : 0)));
