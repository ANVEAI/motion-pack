/* motion-pack / layers / backgrounds-r6.js: round-6 background (2026-10-15). Owned code, no assets. Merged into BG (backgrounds.js), so it mounts through
   overlay.js mountStack like every other background:  mountStack(el, [{ kind: 'auroraRibbon', params: { riseAt: 10.8 } }], { width, height, fps })
     auroraRibbon  a bottom-anchored glowing ribbon in brand colours on black. It is OFF-FRAME (the field is the plain background) until `riseAt`, rises over
                   `rise` s on E.hero, then drifts slowly. The "solution" ground after a black problem section, not a soft mesh: a thin bright core with wide
                   glow, so it reads as a light, not a blob field (background.meshGradient is the soft one).
                   Maths (all closed form, no history): strand i has a centre line y_i(x, t) = H - k(t) * height * H - crest * H * sum_j a_j sin(2 pi (f_j x/W + phi_ij + s_j t))
                   (k = the eased rise 0..1); every column of the frame is one vertical gradient whose stops are a sum of two gaussians (the wide glow, sigma = spread * H,
                   and a core 0.28 times as wide that tends to white), centred on y_i, added on the 'lighter' blend; a per-column weight w_i(x, t) moves the colour mix
                   along the ribbon, so violet, blue and pink trade places as it drifts. Seeded grain = hashed specks (no tile, no canvas needed: the same calls in
                   node and in Chrome), re-seeded grainFps times a second.
                   loop L: every drift frequency is a whole number of cycles per L seconds and the grain index counts frames modulo L * fps, so frame t and t + L are the
                   same bits (exact seam). A looping ribbon is the steady, already-risen version (a loop has no rise: a one-shot rise cannot also repeat).
                   lead: the pivot sound (cuesR6) is placed `lead` s BEFORE riseAt, so the sound leads the picture by a few frames, as a hit does.
   Guards (the pack-wide policy, see layers/limits.js): a bad NUMBER is sanitised, never thrown: NaN, +-Infinity, a non-numeric string, null, undefined or an object becomes the default and out-of-range numbers
   are clamped (res <= 1024 columns, grain <= 12000 specks, at most 5 strands), so no parameter can hang the draw or allocate without bound. A bad COLOUR (not #RGB / #RRGGBB, fewer than 2 colours) and a
   bad t or frame size are not numbers to sanitise: they throw a clear error that names auroraRibbon.
   Pure functions of t (no clock, no Math.random, no module-level cache): the same t draws the same calls in any seek order and in any process. */
import { E, clamp, lerp, seg } from './ease.js';

const TAU = Math.PI * 2;
function hashf(...k) { let h = 2166136261 >>> 0; for (const v of k) { h ^= (v * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
const hexRGB = (h, what) => { const s = typeof h === 'string' ? h.trim().replace(/^#/, '') : ''; const f = s.length === 3 ? s.replace(/./g, (c) => c + c) : s;
  if (!/^[0-9a-fA-F]{6}$/.test(f)) throw new Error(`auroraRibbon: ${what} must be a #RGB or #RRGGBB colour, got ${JSON.stringify(h)}`); const n = parseInt(f, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(4)})`;
const mix = (a, b, k) => a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))));

/* the defaults. Colours are placeholders (violet, blue, pink), not any brand's: pass your own. Sizes are fractions of H, so 16:9, 9:16 and 1:1 share numbers. */
export const AURORA_DEFAULTS = { colors: ['#7A3CFF', '#2F6BFF', '#FF4FA8'], bg: '#030206', riseAt: 0.4, rise: 1.4, lead: 0.1, height: 0.24, crest: 0.1, waves: 3, spread: 0.1, core: 0.7, halo: 0.45,
  speed: 0.035, kick: 0.3, kickDur: 0.35, loop: 0, fps: 30, grain: 0.4, grainFps: 24, res: 96, intensity: 1, seed: 6 };
/* [lo, hi] per numeric parameter: the pack-wide policy for bad numbers (type/gfx/safe.js, layers/limits.js): a value outside it is clamped, and NaN, +-Infinity, a non-numeric string, null, undefined or an object
   becomes the DEFAULT (a numeric string such as '5' is read as 5). Nothing throws and nothing hangs. layers/limits.js lists this table as BG_LIM.auroraRibbon, so guardKinds applies it to every draw too. */
export const AURORA_RANGE = { riseAt: [0, 1e6], rise: [0.05, 600], lead: [0, 5], height: [0.02, 0.9], crest: [0, 0.5], waves: [1, 5], spread: [0.01, 0.5], core: [0, 2], halo: [0, 1], speed: [0, 2], kick: [0, 1.5], kickDur: [0.05, 5],
  loop: [0, 3600], fps: [1, 240], grain: [0, 1], grainFps: [1, 60], res: [8, 1024], intensity: [0, 2], seed: [0, 4294967295] };
const INT = new Set(['waves', 'res', 'seed']);
const asNum = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
export function auroraParams(pIn = {}) {
  const p = { ...AURORA_DEFAULTS, ...pIn };
  for (const [k, [lo, hi]] of Object.entries(AURORA_RANGE)) { const n = asNum(p[k]), v = Number.isFinite(n) ? n : AURORA_DEFAULTS[k];
    p[k] = INT.has(k) ? Math.round(clamp(v, lo, hi)) : clamp(v, lo, hi); }
  if (!Array.isArray(p.colors) || p.colors.length < 2) throw new Error('auroraRibbon: colors must be an array of 2 to 5 hex colours');
  p.colors = p.colors.slice(0, 5); p.rgb = p.colors.map((c, i) => hexRGB(c, `colors[${i}]`)); p.bgRGB = p.bg == null ? null : hexRGB(p.bg, 'bg');
  return p;
}
const dims = (W, H) => { if (!(W > 0 && H > 0 && Number.isFinite(W) && Number.isFinite(H))) throw new Error(`auroraRibbon: the frame must have a finite positive size, got ${W} x ${H}`); };

/* gradient stops: offsets in units of the wide sigma, mirrored. Dense near 0 so the narrow core is sampled; reaching ZMAX sigma. */
const ZS = [0, 0.1, 0.2, 0.32, 0.48, 0.7, 1, 1.4, 1.9, 2.5, 3.2], ZMAX = 3.2, CORE = 0.24;
/* ---------------- the closed-form state ---------------- */
/* the eased rise 0..1 (a loop is always up) */
export function auroraRise(t, pIn) { const p = auroraParams(pIn); return p.loop > 0 ? 1 : E.hero(seg(t, p.riseAt, p.riseAt + p.rise)); }
/* the pivot flash, 1 at riseAt decaying to 0 over kickDur (0 in a loop) */
export function auroraKick(t, pIn) { const p = auroraParams(pIn); if (p.loop > 0 || t < p.riseAt) return 0; return p.kick * Math.exp(-4 * (t - p.riseAt) / p.kickDur) * (1 - seg(t, p.riseAt, p.riseAt + p.kickDur)); }
/* drift frequency (cycles per s) of wave j: free = speed * (1 + 0.45 j) * (0.8 + 0.4 hash); loop = the nearest whole number of cycles per loop, at least 1 */
const waveFreq = (p, j) => { const f = p.speed * (1 + 0.45 * j) * (0.8 + 0.4 * hashf(p.seed, j, 91)); return p.loop > 0 ? Math.max(1, Math.round(f * p.loop)) / p.loop : f; };
/* the centre line of strand i at x (fraction of W): y in px. k = the rise (default: the eased rise at t). Off-frame at k = 0. */
export function auroraCentre(t, pIn, i, xf, { H = 1080, k = null } = {}) {
  const p = auroraParams(pIn), kk = k == null ? auroraRise(t, p) : k, n = p.waves; let c = 0, norm = 0;
  for (let j = 0; j < n; j++) { const a = 1 / (1 + 0.7 * j), fx = 0.55 + 0.6 * j + 0.15 * hashf(p.seed, i, j, 5), ph = hashf(p.seed, i, j, 6) + 0.07 * i;
    c += a * Math.sin(TAU * (fx * xf + ph + waveFreq(p, j) * t)); norm += a; }                        /* c / norm is in [-1, 1]: the crest never exceeds crest * H */
  const off = H * (p.spread * ZMAX + p.crest + 0.04);                                               /* at k = 0 the line sits `off` below the frame bottom: its whole glow (ZMAX sigma) is off-frame, strand offsets included */
  return H - kk * p.height * H - (p.crest * H * c) / norm + (1 - kk) * off;
}
/* colour weight of strand i at x: where along the ribbon each colour is strongest, moving with t. 0.22..1 */
export function auroraWeight(t, pIn, i, xf) { const p = auroraParams(pIn), f = p.loop > 0 ? Math.max(1, Math.round(p.speed * 0.7 * p.loop)) / p.loop : p.speed * 0.7, n = p.colors.length;
  const c = 0.5 + 0.42 * Math.sin(TAU * (i / n + 0.2 * hashf(p.seed, i, 8) + f * t)); return 0.22 + 0.78 * Math.exp(-0.5 * ((xf - c) / 0.3) ** 2); }
/* the grain frame index: counts frames of fps, modulo the loop in a loop (so t and t + L share their specks) */
export function auroraGrainIndex(t, pIn) { const p = auroraParams(pIn), f = Math.round(t * p.fps);
  if (p.loop > 0) { const F = Math.max(1, Math.round(p.loop * p.fps)), m = ((f % F) + F) % F; return Math.floor((m * p.grainFps) / p.fps + 1e-9); } return Math.floor((f * p.grainFps) / p.fps + 1e-9); }

const WHITE = [255, 255, 255];

export const BG_R6 = {
  auroraRibbon: { blend: 'normal', order: 1, tags: ['aurora', 'ribbon', 'glow', 'gradient', 'background', 'solution', 'pivot', 'launch', 'dark', 'rise'],
    d: AURORA_DEFAULTS,
    doc: 'colors = 2-5 hex (default violet, blue, pink: placeholders), bg = the black field (null = transparent); riseAt / rise = when the ribbon starts to rise from below the frame and how long (s), lead = how long before riseAt the pivot sound lands (cuesR6); height = rest height of the centre line (fraction of H), crest / waves = the drift amplitude (fraction of H) and its number of sine terms; spread = sigma of the wide glow (fraction of H), core = strength of the bright core, halo = the glow along the bottom edge; speed = Hz of the slowest drift; kick / kickDur = the brightness flash at riseAt; loop = seconds for an exact repeat (0 = free; a loop is already risen); grain / grainFps = seeded specks (0 = off) re-seeded grainFps times a second; res = columns of the frame (8-1024); intensity; seed',
    draw(g, W, H, t, pIn) {
      dims(W, H); if (!Number.isFinite(t)) throw new Error('auroraRibbon: t must be a finite number');
      const p = auroraParams(pIn), S = H / 1080, n = p.rgb.length, k = auroraRise(t, p), kick = auroraKick(t, p), I = p.intensity * (1 + kick);
      if (p.bgRGB) { g.fillStyle = rgba(p.bgRGB, 1); g.fillRect(0, 0, W, H); }
      if (k > 0) {
        const sig = p.spread * H, cols = p.res, amp = (1.25 * I) / Math.sqrt(n);
        g.globalCompositeOperation = 'lighter';
        if (p.halo > 0) { const hh = (p.height + p.spread * 1.6) * H * 1.5, lg = g.createLinearGradient(0, H, 0, H - hh), mixc = p.rgb.reduce((a, c) => a.map((v, q) => v + c[q] / n), [0, 0, 0]).map(Math.round);
          for (let s = 0; s <= 6; s++) { const u = s / 6; lg.addColorStop(u, rgba(mixc, 0.34 * p.halo * I * k * (1 - u) ** 2.2)); }
          g.fillStyle = lg; g.fillRect(0, H - hh, W, hh); }
        const R = ZMAX * sig, stops = Array.from({ length: 2 * ZS.length - 1 }, (_, s) => { const z = s < ZS.length ? -ZS[ZS.length - 1 - s] : ZS[s - ZS.length + 1], gb = Math.exp(-0.5 * z * z), gc = p.core * Math.exp(-0.5 * (z / CORE) ** 2);
          return { o: (z + ZMAX) / (2 * ZMAX), a: 0.62 * (gb * 0.55 + gc), hot: gc / (gb + gc + 1e-9) }; });
        for (let i = 0; i < n; i++) { const C = p.rgb[i], hot = mix(C, WHITE, 0.6), yOff = (i - (n - 1) / 2) * 0.014 * H;
          /* one parallelogram per column: its vertical gradient is sheared so the bright line follows the centre line (linear between the column edges), which keeps a coarse column count smooth */
          let xa = 0, ya = auroraCentre(t, p, i, 0, { H, k }) + yOff;
          for (let c = 1; c <= cols; c++) { const xb = Math.floor((c * W) / cols), xfb = xb / W, yb = auroraCentre(t, p, i, xfb, { H, k }) + yOff;
            if (xb > xa) { const xf = (xa + xb) / 2 / W, w = auroraWeight(t, p, i, xf) * amp * Math.min(1, k * 1.6), slope = (yb - ya) / (xb - xa);
              if (Math.min(ya, yb) - R < H && Math.max(ya, yb) + R > 0) {
                g.save(); g.transform(1, slope, 0, 1, 0, ya - slope * xa);
                const gr = g.createLinearGradient(0, -R, 0, R);
                for (const q of stops) gr.addColorStop(q.o, rgba(mix(C, hot, q.hot), w * q.a));
                g.fillStyle = gr; g.fillRect(xa, -R, xb - xa, 2 * R); g.restore(); } }
            xa = xb; ya = yb; } }
        g.globalCompositeOperation = 'source-over';
      }
      /* seeded grain: hashed specks, lighter and darker, re-seeded per grain frame; a bit denser over the ribbon than over the black */
      if (p.grain > 0) { const gi = auroraGrainIndex(t, p), cnt = Math.min(12000, Math.round((p.grain * W * H) / 1400)), sz = Math.max(1, Math.round(1.4 * S));
        g.fillStyle = rgba([255, 255, 255], 0.07 + 0.05 * p.grain); g.beginPath();
        for (let q = 0; q < cnt; q += 2) g.rect(Math.floor(hashf(p.seed, gi, q, 1) * W), Math.floor(hashf(p.seed, gi, q, 2) * H), sz, sz);
        g.fill(); g.fillStyle = rgba([0, 0, 0], 0.1 + 0.05 * p.grain); g.beginPath();
        for (let q = 1; q < cnt; q += 2) g.rect(Math.floor(hashf(p.seed, gi, q, 3) * W), Math.floor(hashf(p.seed, gi, q, 4) * H), sz, sz);
        g.fill(); }
    } },
};

/* the pivot sound: bass hit `lead` s before the ribbon starts to rise (the mixer anchors the sample one frame after t, gotchas.md). A loop has no rise, so no cue. */
export const CUES_R6 = {
  auroraRibbon: (p) => (p.loop > 0 ? [] : [{ t: +Math.max(0, p.riseAt - p.lead).toFixed(4), id: 'sfx/hit/sub_drop', why: 'the pivot: bass lands ' + (p.lead * 1000).toFixed(0) + ' ms before the ribbon rises' }]),
};
export const cuesR6 = (kind, params = {}) => { const f = CUES_R6[kind]; if (!f) throw new Error('no round-6 cues for ' + kind); return f(auroraParams(params)); };
