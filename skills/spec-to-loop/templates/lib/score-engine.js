/* spec-to-loop score engine (classic script, defines window.ScoreEngine). No samples, no downloads.
 *
 * CONTRACT
 *  - Every event names a VISUAL frame F. Its designated peak sample (the voice's `anchor`) lands on
 *    target(F) = (F + 1) * SR / fps, i.e. sample (F + 1) x 800 at 48 kHz / 60 fps: one frame after the picture.
 *  - Tonal voices are JS buffers whose phase is integrated outward from theta = 0 at the anchor and every partial
 *    is cos(r * theta), with a sin^2 attack that ENDS on that crest. So the absolute peak is the anchor sample.
 *    No waveshaper anywhere (a 4x-oversampled WaveShaper adds latency and moves peaks 8-11 ms late).
 *  - Noise/creak/swish voices set their anchor to their own loudest sample, so they also land sample-exact.
 *  - Events that share (bus, frame) are summed into ONE group with their anchors aligned; tonal groups are
 *    re-anchored on the tonal crest and peak-guarded (later content above 0.76 x crest within 60 ms is pulled
 *    down by a smooth gain, never clipped).
 *  - The loop is scheduled three times in an OfflineAudioContext (48 kHz stereo) and the middle loop is kept:
 *    tails AND pre-rolls wrap across the seam, so the master is seamless by construction.
 *  - Stems are linear (ConvolverNode.normalize = false, energy-normalised seeded IR): bed + hits = mix exactly.
 *
 * API
 *  ScoreEngine.render(score, trimsDb) -> Promise<{ bed, hits, iso, own, meta }>
 *    score  = { fps, loopFrames, sr, events:[...], reverb?, master?, levelTargets? }
 *    trimsDb = { "<frame>": dB }   per hit-group trims written by measure_audio.py --tune
 *    bed/hits: Float32Array interleaved stereo, loop length; iso: ISO_LEN-sample mono windows per timed part (tonal / noise / texture);
 *    own: ISO_LEN-sample stereo windows of each hit group's whole composite (the level metric).
 *  Event: { id, bus:'bed'|'hits', frame, voice:'tone'|'noise'|'texture'|'click'|'creak'|'swish'|'boing'|
 *           'sparkle'|'whoosh'|'pad'|'bass'|'shaker' | function(kit, ev) -> {L,R,anchor,kind}, gain (dB), pan, ...voice params }
 */
(function () {
  'use strict';
  const TWO_PI = 2 * Math.PI;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const db = x => Math.pow(10, x / 20);
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function springU(t, zeta, hz) { if (t <= 0) return 1; const w = TWO_PI * hz, wd = w * Math.sqrt(1 - zeta * zeta); return Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t)); }
  const ISO_LEN = 19200, ISO_PRE = 4800, OWN_PRE = 4800, OWN_LEN = 4800 + 48000;   // timing windows 400 ms; level-model windows 1.1 s

  function makeKit(SR) {
    const K = { SR, TWO_PI, clamp, lerp, db, rng: mulberry32, springU };
    /* pitch spec -> f(tau) in Hz, tau = seconds from the crest (negative before it) */
    K.pitch = p => {
      if (typeof p === 'function') return p;
      if (typeof p === 'number') return () => p;
      if (p.drop || p.approach) { const [a, b, tau] = p.drop || p.approach; return t => b + (a - b) * Math.exp(-Math.max(0, t) / tau); }
      if (p.glide) { const [a, b, dur] = p.glide; return t => a * Math.pow(b / a, clamp(t / dur, 0, 1)); }          // starts at the crest
      if (p.glideIn) { const [a, b, dur] = p.glideIn; return t => a * Math.pow(b / a, clamp(1 + t / dur, 0, 1)); }  // ends at the crest
      if (p.spring) { const [base, s0, zeta, hz] = p.spring; return t => base * (1 + (s0 - 1) * springU(t, zeta, hz)); }
      if (p.wobble) { const [base, depth, hz, damp] = p.wobble; return t => { t = Math.max(0, t); return base * (1 - depth * Math.sin(TWO_PI * hz * t) * Math.pow(damp, 2 * hz * t)); }; }
      throw new Error('bad pitch spec ' + JSON.stringify(p));
    };
    /* amplitude modulators / envelopes after the crest: must be 1 at t = 0 and <= 1 after, or the crest stops being the peak */
    K.amFn = a => typeof a === 'function' ? a : a.wobble ? (([d, hz, damp]) => t => 1 - d * (1 - Math.cos(TWO_PI * hz * t)) / 2 * Math.pow(damp, 2 * hz * t))(a.wobble) : null;
    K.envFn = e => typeof e === 'function' ? e : e.cut ? (([tau, s, end]) => t => Math.exp(-t / tau) * (t <= s ? 1 : t >= end ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (t - s) / (end - s))))(e.cut) : null;
    /* the cosine-crest tonal buffer */
    K.tone = ({ pitch = 440, partials = [[1, 1]], attack = 0.002, decay = 0.1, len = 0.5, am = null, env = null, tail = 0.15 }) => {
      const f = K.pitch(pitch), nA = Math.max(1, Math.round(attack * SR)), nL = Math.max(2, Math.round(len * SR)), n = nA + nL;
      const th = new Float64Array(n), x = new Float32Array(n);
      for (let i = nA; i < n - 1; i++) th[i + 1] = th[i] + TWO_PI * f((i - nA) / SR) / SR;
      for (let i = nA; i > 0; i--) th[i - 1] = th[i] - TWO_PI * f((i - 1 - nA) / SR) / SR;
      const asum = partials.reduce((s, p) => s + Math.abs(p[1]), 0) || 1, amf = am ? K.amFn(am) : null, envf = env ? K.envFn(env) : null;
      for (let i = 0; i < n; i++) {
        const t = (i - nA) / SR; let v = 0;
        if (i < nA) { const a = Math.pow(Math.sin(Math.PI / 2 * i / nA), 2); for (const p of partials) v += p[1] * a * Math.cos(p[0] * th[i]); }
        else for (const p of partials) v += p[1] * (envf ? envf(t) : Math.exp(-t / (p[2] || decay))) * Math.cos(p[0] * th[i]);
        v /= asum; if (amf && i >= nA) v *= amf(t);
        const k = i - nA, k0 = nL * (1 - tail); if (k > k0) v *= 0.5 + 0.5 * Math.cos(Math.PI * (k - k0) / (nL * tail));
        x[i] = v;
      }
      return { mono: x, anchor: nA };
    };
    K.noiseArr = (n, seed) => { const r = mulberry32(seed), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = r() * 2 - 1; return a; };
    /* TPT state-variable filter with a time-varying cutoff (Hz as a function of sample index) */
    K.svf = (x, fcOf, Q, type) => {
      const y = new Float32Array(x.length), k = 1 / Q; let ic1 = 0, ic2 = 0;
      const fc = typeof fcOf === 'function' ? fcOf : () => fcOf;
      for (let i = 0; i < x.length; i++) {
        const g = Math.tan(Math.PI * clamp(fc(i), 20, SR * 0.45) / SR), a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
        const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3; ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
        y[i] = type === 'bp' ? v1 * k : type === 'lp' ? v2 : x[i] - k * v1 - v2;
      }
      return y;
    };
    K.envAD = (t, A, tau) => t < 0 ? 0 : (t < A ? 0.5 - 0.5 * Math.cos(Math.PI * t / A) : Math.exp(-(t - A) / tau));
    K.argmaxAbs = (a, s = 0, e = a.length) => { let m = -1, im = s; for (let i = Math.max(0, s); i < Math.min(e, a.length); i++) { const v = Math.abs(a[i]); if (v > m) { m = v; im = i; } } return im; };
    /* equal-power pan; pan may be a number or a function of the sample index */
    K.pan = (mono, pan = 0) => {
      const L = new Float32Array(mono.length), R = new Float32Array(mono.length), pf = typeof pan === 'function' ? pan : null;
      let gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
      for (let i = 0; i < mono.length; i++) { if (pf) { const a = (clamp(pf(i), -1, 1) + 1) * Math.PI / 4; gl = Math.cos(a); gr = Math.sin(a); } L[i] = mono[i] * gl; R[i] = mono[i] * gr; }
      return { L, R };
    };
    K.filterGlide = (f, n) => Array.isArray(f) ? (i => f[0] * Math.pow(f[1] / f[0], clamp(i / Math.max(1, n), 0, 1))) : (() => f);
    return K;
  }

  /* ------------------------------------------------------------------ voices ------------------------------------------------------------------ */
  const V = {};
  V.tone = (K, e) => { const t = K.tone(e); return Object.assign(K.pan(t.mono, e.pan || 0), { anchor: t.anchor, kind: 'tonal' }); };
  /* filtered noise; riser (pre > 0: rises over `pre` s to the target) or burst. Filter BEFORE the envelope so the envelope peak stays put;
     the anchor is the loudest sample, so even noise lands sample-exact. */
  V.noise = (K, e) => {
    const SR = K.SR, pre = e.pre || 0, att = e.attack || 0.002, rel = e.release || e.decay || 0.012, pow = e.pow || 2;
    const nPk = Math.round((pre > 0 ? pre : att) * SR), n = nPk + Math.round((e.len || rel * 8) * SR);
    let x = K.noiseArr(n, e.seed || 1);
    if (e.filter) { const fl = e.filter; x = K.svf(x, K.filterGlide(fl.f, nPk), fl.q || 1, fl.type || 'bp'); }
    for (let i = 0; i < n; i++) { const t = i / SR, tp = nPk / SR; x[i] *= t <= tp ? (pre > 0 ? Math.pow(t / tp, pow) : Math.pow(Math.sin(Math.PI / 2 * t / tp), 2)) : Math.exp(-(t - tp) / rel); }
    const anchor = K.argmaxAbs(x);                                       // the loudest sample IS the hit: it lands on the target exactly
    return Object.assign(K.pan(x, e.pan || 0), { anchor, kind: 'noise' });
  };
  /* sustained texture (shimmer): seeded-phase sines, onset on the target, pan can sweep */
  V.texture = (K, e) => {
    const SR = K.SR, n = Math.round(e.dur * SR), r = K.rng(e.seed || 7), ph = e.partials.map(() => r() * TWO_PI), x = new Float32Array(n);
    const fi = e.fadeIn || 0.08, fo = e.fadeOut || 0.07, tr = e.trem || [9, 0.25];
    for (let i = 0; i < n; i++) {
      const t = i / SR; let v = 0; e.partials.forEach(([hz, a], k) => { v += a * Math.sin(TWO_PI * hz * t + ph[k]); });
      const env = (t < fi ? Math.pow(Math.sin(Math.PI / 2 * t / fi), 2) : 1) * (t > e.dur - fo ? 0.5 + 0.5 * Math.cos(Math.PI * (t - (e.dur - fo)) / fo) : 1);
      x[i] = v * env * (1 - tr[1] + tr[1] * Math.cos(TWO_PI * tr[0] * t));
    }
    const pan = e.panTo !== undefined ? (i => lerp(e.pan || 0, e.panTo, i / n)) : (e.pan || 0);
    return Object.assign(K.pan(x, pan), { anchor: 0, kind: 'texture' });
  };
  /* light click: band-passed noise burst + a short cosine-crest thunk */
  V.click = (K, e) => {
    const SR = K.SR, n = Math.round(0.16 * SR), pre = 24, bp = e.bp || 3200, th = e.thunk || 190, dec = e.decay || 0.0026;
    const nz = K.noiseArr(n, e.seed || 9100 + bp), burst = K.svf(nz.map((v, i) => v * K.envAD((i - pre) / SR, 0.00025, dec)), bp, 1.4, 'bp');
    const thunk = K.tone({ pitch: th, partials: [[1, 1], [2, 0.25]], attack: 0.0012, decay: e.thunkDecay || 0.02, len: 0.15 }).mono, m = new Float32Array(n);
    const bu = e.burst ?? 2.4, bo = e.body ?? 0.55; for (let i = 0; i < n; i++) { const j = i - pre + 46; m[i] = burst[i] * bu + (j >= 0 && j < thunk.length ? thunk[j] * bo : 0); }
    if (e.echo !== false) { const k2 = 7 * 48 + pre; for (let i = 0; i < 400 && k2 + i < n; i++) m[k2 + i] += burst[Math.min(n - 1, pre + i)] * 0.30 * Math.exp(-i / 90); }
    return Object.assign(K.pan(m, e.pan || 0), { anchor: K.argmaxAbs(m, pre, pre + 40), kind: 'noise' });
  };
  /* crouch: a creak (saw through two formants) + an inhale riser that swells to `riserTo` seconds later (the takeoff) */
  V.creak = (K, e) => {
    const SR = K.SR, dur = e.riserTo || 0.18, deep = !!e.deep, n = Math.round((dur + 0.42) * SR), m = new Float32Array(n), crLen = 0.19 + (deep ? 0.12 : 0);
    let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, f = (e.f || (deep ? 410 : 560)) * (1 + 0.42 * Math.min(t / crLen, 1)) * (1 + 0.05 * Math.sin(TWO_PI * 38 * t)); ph += f / SR; m[i] = (2 * (ph - Math.floor(ph)) - 1) * (0.75 + 0.25 * Math.sin(TWO_PI * 47 * t + 0.6)) * K.envAD(t, 0.0035, deep ? 0.10 : 0.06); }
    const f1 = K.svf(m, i => 880 + 380 * Math.min(i / SR / crLen, 1), 7, 'bp'), f2 = K.svf(m, i => 2100 + 500 * Math.min(i / SR / crLen, 1), 9, 'bp');
    const rise = K.svf(K.noiseArr(n, e.seed || 4400), i => 380 * Math.pow(2800 / 380, clamp(i / SR / dur, 0, 1.15)), 1.6, 'bp'), x = new Float32Array(n), cr = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR, u = t / dur; cr[i] = (f1[i] + f2[i] * 0.55) * 1.2; x[i] = cr[i] + rise[i] * (u < 1 ? 0.06 + 0.94 * Math.pow(Math.sin(u * Math.PI / 2), 2.2) : Math.exp(-(t - dur) / 0.006)) * (e.riser ?? 0.26); }
    return Object.assign(K.pan(x, e.pan || 0), { anchor: K.argmaxAbs(cr, 0, Math.round(0.06 * SR)), kind: 'noise' });
  };
  /* takeoff swish: band-passed noise sweeping up + a faint rising tone */
  V.swish = (K, e) => {
    const SR = K.SR, big = !!e.big, dur = big ? 0.42 : 0.24, n = Math.round((dur + 0.15) * SR), f0 = big ? 420 : 520, f1 = big ? 7200 : 5200;
    const sw = K.svf(K.noiseArr(n, e.seed || 7700), i => f0 * Math.pow(f1 / f0, clamp(i / SR / (dur * 0.8), 0, 1)), big ? 1.4 : 1.7, 'bp'), m = new Float32Array(n);
    const wh = K.tone({ pitch: t => (big ? 240 : 300) * Math.pow(3.1, clamp(t / (dur * 0.9), 0, 1)), attack: 0.006, decay: big ? 0.14 : 0.08, len: dur + 0.15 - 0.006 }).mono;
    for (let i = 0; i < n; i++) m[i] = sw[i] * K.envAD(i / SR, 0.006, big ? 0.13 : 0.07) * 1.6 + (wh[i] || 0) * 0.18;
    return Object.assign(K.pan(m, e.pan || 0), { anchor: K.argmaxAbs(m, 0, Math.round(0.05 * SR)), kind: 'noise' });
  };
  /* landing: rubber squash whose pitch follows the squash spring, a sub thump, a noise slap (add a `bloom` event for a big one) */
  V.boing = (K, e) => {
    const SR = K.SR, big = !!e.big, dur = big ? 1.5 : 1.0, n = Math.round(dur * SR), A = 0.004, [s0, zeta, hz] = e.spring || [0.70, 0.55, 3.0];
    const rub = K.tone({ pitch: { spring: [e.f, s0, zeta, hz] }, partials: [[1, 1], [2, 0.55], [3, 0.28]], attack: A, decay: big ? 0.20 : 0.13, len: dur - A });
    const sub = K.tone({ pitch: { drop: [(big ? 40 : 52) + (big ? 60 : 48), big ? 40 : 52, 0.03] }, attack: A, decay: big ? 0.28 : 0.10, len: dur - A });
    const sq = K.svf(K.noiseArr(n, e.seed || 1300), 700, 0.8, 'lp'), m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = (rub.mono[i] || 0) * (big ? 0.6 : 0.85) + (sub.mono[i] || 0) * (e.sub ?? (big ? 0.45 : 0.3)) + sq[i] * K.envAD(i / SR, A, 0.022) * (e.slap ?? (big ? 0.2 : 0.35));
    return Object.assign(K.pan(m, e.pan || 0), { anchor: rub.anchor, kind: 'tonal' });
  };
  /* spark tings: `count` seeded cosine-crest tings scattered after the anchor (they never share its sample) */
  V.sparkle = (K, e) => {
    const SR = K.SR, n = Math.round((e.len || 1.0) * SR), L = new Float32Array(n), R = new Float32Array(n), rng = K.rng(e.seed || 5200), set = e.notes || [1396.91, 1760, 2093, 2349.3, 2793.8, 3520];
    const lead = Math.round(0.004 * SR), spread = e.spread || 0.3;
    for (let k = 0; k < (e.count || 12); k++) {
      const t0 = 0.012 + rng() * spread, f = set[Math.floor(rng() * set.length)], amp = (0.20 + 0.25 * rng()) * Math.pow(0.93, k), tau = (e.tau || 0.07) * (0.7 + 0.6 * rng());
      const tg = K.tone({ pitch: f, partials: [[1, 1], [2.76, 0.28], [5.4, 0.1]], attack: 0.0004, decay: tau, len: 0.6 }), p = clamp((e.pan || 0) + (rng() - 0.5), -0.95, 0.95), st = K.pan(tg.mono, p);
      const o = lead + Math.round(t0 * SR) - tg.anchor; for (let i = 0; i < tg.mono.length; i++) { const j = i + o; if (j >= 0 && j < n) { L[j] += st.L[i] * amp; R[j] += st.R[i] * amp; } }
    }
    return { L, R, anchor: lead, kind: 'scatter' };          // scatter follows the crest: counted in level, never timed
  };
  /* low-crest chord bloom: random phases, so it adds K-weighted energy without stacking another crest on the anchor sample */
  V.bloom = (K, e) => {
    const SR = K.SR, n = Math.round((e.len || 1.5) * SR), m = new Float32Array(n), rg = K.rng(e.seed || 4242), a0 = Math.round(0.002 * SR);
    e.notes.forEach((hz, j) => { const ph = rg() * TWO_PI, w = TWO_PI * hz / SR, a = 0.55 / (1 + 0.25 * j); for (let i = a0; i < n; i++) { const t = (i - a0) / SR; m[i] += a * (t < 0.014 ? 0.5 - 0.5 * Math.cos(Math.PI * t / 0.014) : Math.exp(-(t - 0.014) / (e.decay || 0.42))) * Math.cos(w * i + ph); } });
    return Object.assign(K.pan(m, e.pan || 0), { anchor: 0, kind: 'scatter' });
  };
  /* flip whoosh: noise band whose centre follows an arc (4 s (1 - s)) and pans from panFrom to panTo over `dur` seconds */
  V.whoosh = (K, e) => {
    const SR = K.SR, dur = e.dur, n = Math.round((dur + 0.35) * SR), lo = e.lo || 300, hi = e.hi || 3600;
    const hOf = t => { const s = clamp(t / dur, 0, 1); return 4 * s * (1 - s); }, bp = K.svf(K.noiseArr(n, e.seed || 8810), i => lo * Math.pow(hi / lo, hOf(i / SR)) + 120, 1.3, 'bp'), m = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR, s = clamp(t / dur, 0, 1); m[i] = bp[i] * (t < dur ? Math.pow(Math.sin(Math.PI * s), 1.6) : Math.exp(-(t - dur) / 0.08)) * (t < 0.012 ? t / 0.012 : 1) * 1.15; }
    return Object.assign(K.pan(m, i => lerp(e.panFrom ?? 0.85, e.panTo ?? -0.85, clamp(i / SR / dur, 0, 1))), { anchor: 0, kind: 'texture' });
  };
  /* ---------------- bed voices ---------------- */
  /* pad: chord tones (two detuned copies each + 2nd/3rd partials), seeded phases, attack/release in seconds,
     optional per-frame level steps [[frame, level], ...] (follow a light's flicker) and a lowpass */
  V.pad = (K, e) => {
    const SR = K.SR, fps = e.fps, spf = SR / fps, n = Math.round(e.dur * SR), r = K.rng(e.seed || 100), x = new Float32Array(n);
    const voices = []; for (const hz of e.notes) for (const c of (e.detune ?? [-4, 4])) voices.push([hz * Math.pow(2, c / 1200), r() * TWO_PI]);
    const parts = e.partials || [[1, 1], [2, 0.3], [3, 0.1]], att = e.attack ?? 0.35, rel = e.release ?? 0.6;
    let lvl = null;
    if (e.steps) { lvl = new Float32Array(n); const st = e.steps, F0 = e.frame + 1; for (let i = 0; i < n; i++) { const f = F0 + i / spf; let v = 0; for (const [sf, sv] of st) if (f >= sf + 1) v = sv; lvl[i] = v; }
      const w = Math.round(0.0015 * SR), sm = new Float32Array(n); let s = 0; for (let i = 0; i < n; i++) { s += lvl[i] - (i - w >= 0 ? lvl[i - w] : 0); sm[i] = s / Math.min(i + 1, w); } lvl = sm; }
    for (let i = 0; i < n; i++) {
      const t = i / SR; let v = 0; for (const [hz, ph] of voices) for (const [m, a] of parts) v += a * Math.sin(TWO_PI * hz * m * t + ph * m);
      const env = (t < att ? Math.pow(Math.sin(Math.PI / 2 * t / att), 2) : 1) * (t > e.dur - rel ? 0.5 + 0.5 * Math.cos(Math.PI * (t - (e.dur - rel)) / rel) : 1);
      x[i] = v / voices.length * env * (lvl ? lvl[i] : 1);
    }
    const y = e.lp ? K.svf(x, e.lp, 0.6, 'lp') : x;
    return Object.assign(K.pan(y, e.pan || 0), { anchor: 0, kind: 'bed' });
  };
  /* bass: notes [[frameFrom, frameTo, hz, amp]], sine + soft saw through a lowpass; starts on target(frameFrom) */
  V.bass = (K, e) => {
    const SR = K.SR, spf = SR / e.fps, F0 = e.notes[0][0], last = e.notes[e.notes.length - 1], n = Math.round((last[1] - F0) * spf + 0.05 * SR), x = new Float32Array(n);
    for (const [a, b, hz, amp] of e.notes) {
      const s = Math.round((a - F0) * spf), len = Math.round((b - a) * spf); let ph = 0;
      for (let i = 0; i < len; i++) { const t = i / SR; ph += hz / SR; const saw = 2 * (ph - Math.floor(ph)) - 1;
        const env = (t < 0.006 ? t / 0.006 : 0.55 + 0.45 * Math.exp(-(t - 0.006) / 0.09)) * (i > len - 0.02 * SR ? (len - i) / (0.02 * SR) : 1);
        x[s + i] += (0.9 * Math.sin(TWO_PI * hz * t) + 0.22 * saw) * amp * env; }
    }
    return Object.assign(K.pan(K.svf(x, e.lp || 260, 0.9, 'lp'), 0), { anchor: 0, kind: 'bed' });
  };
  /* shaker: one hp+bp noise tick; `accent` scales it */
  V.shaker = (K, e) => {
    const SR = K.SR, n = Math.round(0.07 * SR), bp = K.svf(K.svf(K.noiseArr(n, e.seed || 777), 7200, 1.0, 'hp'), e.bp || 9500, 0.8, 'bp'), m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = bp[i] * K.envAD(i / SR, 0.002, 0.016) * (e.accent ?? 1);
    return Object.assign(K.pan(m, e.pan || 0), { anchor: K.argmaxAbs(m, 0, Math.round(0.01 * SR)), kind: 'noise' });
  };

  function makeIR(K, rv) {
    const SR = K.SR, n = Math.round((rv.seconds || 1.7) * SR), pre = Math.round((rv.predelay ?? 0.011) * SR), L = new Float32Array(n), R = new Float32Array(n);
    [[L, 1], [R, 2]].forEach(([a, sd]) => { const r = mulberry32((rv.seed || 31337) * sd); let lp = 0;
      for (let i = pre; i < n; i++) { const t = (i - pre) / SR, c = 0.9 - 0.82 * Math.min(t / 1.2, 1); lp += (r() * 2 - 1 - lp) * c; a[i] = lp * Math.exp(-t / (rv.decay || 0.27)) * (1 - Math.exp(-t / 0.006)); } });
    let en = 0; for (let i = 0; i < n; i++) en += L[i] * L[i] + R[i] * R[i]; const sc = 1 / Math.sqrt(en / 2); for (let i = 0; i < n; i++) { L[i] *= sc; R[i] *= sc; }
    return [L, R];
  }

  /* peak guard: after the crest, pull content louder than ratio x crest down with a smooth gain (min filter +-1 ms, moving average 2 ms) */
  function peakGuard(g, SR, win = 0.060, ratio = 0.76) {
    const { L, R } = g, a = g.anchor, n = L.length, end = Math.min(n, a + Math.round(win * SR)), Pa = Math.max(Math.abs(L[a]), Math.abs(R[a])) || 1e-9;
    const r = new Float32Array(n).fill(1); let need = false;
    for (let i = a + 20; i < end; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (v > ratio * Pa) { r[i] = ratio * Pa / v; need = true; } }
    if (!need) return 0;
    const m = new Float32Array(n).fill(1), gg = new Float32Array(n).fill(1), H = 48;
    for (let i = a; i < Math.min(n, end + 2 * H); i++) { let mn = 1; for (let j = -H; j <= H; j++) { const q = i + j; if (q >= 0 && q < n) mn = Math.min(mn, r[q]); } m[i] = mn; }
    for (let i = a + 17; i < Math.min(n, end + 2 * H); i++) { let s = 0; for (let j = -H; j <= H; j++) s += m[clamp(i + j, 0, n - 1)]; gg[i] = s / (2 * H + 1); }
    let mn = 1; for (let i = 0; i < n; i++) { L[i] *= gg[i]; R[i] *= gg[i]; mn = Math.min(mn, gg[i]); }
    return -20 * Math.log10(mn);
  }

  async function render(score, trims = {}) {
    const SR = score.sr || 48000, fps = score.fps, N = Math.round(score.loopFrames * SR / fps), spf = SR / fps, K = makeKit(SR);
    if (Math.abs(spf - Math.round(spf)) > 1e-9) throw new Error('SR / fps must be an integer number of samples per frame');
    const target = F => Math.round((F + 1) * spf);
    const built = [];
    for (const ev of score.events) {
      const fn = typeof ev.voice === 'function' ? ev.voice : V[ev.voice];
      if (!fn) throw new Error('unknown voice ' + ev.voice + ' in ' + ev.id);
      const b = fn(K, Object.assign({ fps }, ev));
      const g = db(ev.gain || 0); if (g !== 1) for (let i = 0; i < b.L.length; i++) { b.L[i] *= g; b.R[i] *= g; }
      built.push(Object.assign(b, { id: ev.id, bus: ev.bus || 'hits', frame: ev.frame }));
    }
    // group by (bus, frame); align anchors; tonal groups re-anchor on the tonal crest and get the peak guard
    const groups = new Map();
    for (const b of built) { const k = b.bus + ':' + b.frame; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(b); }
    const G = [];
    for (const [k, items] of groups) {
      const bus = items[0].bus, frame = items[0].frame, kinds = [...new Set(items.map(b => b.kind))], hasTonal = kinds.includes('tonal');
      // the tonal crest owns the target sample; in a mixed group a noise peak lands `noiseLead` earlier so two peaks never stack on one sample
      const lead = hasTonal ? Math.round((score.noiseLeadMs ?? 2) * SR / 1000) : 0, Amax = Math.max(...items.map(b => b.anchor));
      let offs = items.map(b => Amax - b.anchor - (b.kind === 'noise' ? lead : 0)); const sh = Math.max(0, -Math.min(...offs)); offs = offs.map(o => o + sh);
      const A = Amax + sh, n = Math.max(...items.map((b, k) => b.L.length + offs[k]));
      const L = new Float32Array(n), R = new Float32Array(n), tL = new Float32Array(n), tR = new Float32Array(n), oL = new Float32Array(n), oR = new Float32Array(n), sL = new Float32Array(n), sR = new Float32Array(n);
      items.forEach((b, k) => { const o = offs[k], [xL, xR] = b.kind === 'tonal' ? [tL, tR] : b.kind === 'scatter' ? [sL, sR] : [oL, oR]; for (let i = 0; i < b.L.length; i++) { xL[i + o] += b.L[i]; xR[i + o] += b.R[i]; } });
      const grp = { key: k, bus, frame, L, R, anchor: A, ids: items.map(b => b.id), kinds, guardDb: 0, tL, tR, oL, oR };
      // peak guard on the tonal + scatter parts only (sparks or a bloom must not out-peak the crest); noise/texture are never squashed
      const gL = new Float32Array(n), gR = new Float32Array(n); for (let i = 0; i < n; i++) { gL[i] = tL[i] + sL[i]; gR[i] = tR[i] + sR[i]; }
      if (bus === 'hits' && hasTonal) {
        let m = -1, im = A; for (let i = Math.max(0, A - 96); i < Math.min(n, A + 192); i++) { const v = Math.max(Math.abs(tL[i]), Math.abs(tR[i])); if (v > m) { m = v; im = i; } }
        grp.anchor = im; if (score.guard !== false) grp.guardDb = peakGuard({ L: gL, R: gR, anchor: im }, SR);
      }
      for (let i = 0; i < n; i++) { L[i] = gL[i] + oL[i]; R[i] = gR[i] + oR[i]; }
      G.push(grp);
    }
    const rv = score.reverb || {}, sends = rv.sends || {};
    async function renderBus(bus) {
      const ctx = new OfflineAudioContext(2, 3 * N, SR), dry = ctx.createGain(); dry.connect(ctx.destination);
      if ((sends[bus] || 0) > 0) {
        const conv = ctx.createConvolver(), ir = makeIR(K, rv), ab = ctx.createBuffer(2, ir[0].length, SR); ab.copyToChannel(ir[0], 0); ab.copyToChannel(ir[1], 1);
        conv.normalize = false; conv.buffer = ab; const send = ctx.createGain(); send.gain.value = sends[bus]; dry.connect(send); send.connect(conv); conv.connect(ctx.destination);
      }
      for (const g of G) {
        if (g.bus !== bus) continue;
        const ab = ctx.createBuffer(2, g.L.length, SR); ab.copyToChannel(g.L, 0); ab.copyToChannel(g.R, 1);
        const gain = ctx.createGain(); gain.gain.value = db(bus === 'hits' ? (trims[String(g.frame)] || 0) : 0); gain.connect(dry);
        for (let c = 0; c < 3; c++) {                                                   // three loops: keep the middle one
          const start = c * N + target(g.frame) - g.anchor, s = ctx.createBufferSource(); s.buffer = ab; s.connect(gain);
          if (start >= 0) s.start(start / SR); else s.start(0, -start / SR);
        }
      }
      const out = await ctx.startRendering(), a = out.getChannelData(0), b = out.getChannelData(1), y = new Float32Array(2 * N);
      for (let i = 0; i < N; i++) { y[2 * i] = a[N + i]; y[2 * i + 1] = b[N + i]; }
      return y;
    }
    const bed = await renderBus('bed'), hits = await renderBus('hits');
    // isolated windows per hit group and part (tonal / other), dry, unit trim: the timing metric
    const isoParts = [];
    for (const g of G) {
      if (g.bus !== 'hits') continue;
      for (const [part, pL, pR] of [['tonal', g.tL, g.tR], ['other', g.oL, g.oR]]) {
        let any = false; for (let i = 0; i < pL.length; i++) if (pL[i] !== 0 || pR[i] !== 0) { any = true; break; }
        if (!any) continue;
        // parts are pre-guard: the guard never touches samples before anchor + 17, so the crest timing is unaffected
        const w = new Float32Array(ISO_LEN);
        for (let i = 0; i < ISO_LEN; i++) { const j = g.anchor - ISO_PRE + i; if (j >= 0 && j < pL.length) w[i] = Math.abs(pL[j]) > Math.abs(pR[j]) ? pL[j] : pR[j]; }
        const kind = part === 'tonal' ? 'tonal' : (g.kinds.includes('noise') ? 'noise' : 'texture');   // scatter (sparks, blooms) is never timed
        isoParts.push({ frame: g.frame, part, kind, ids: g.ids, w });
      }
    }
    const iso = new Float32Array(isoParts.length * ISO_LEN); isoParts.forEach((p, k) => iso.set(p.w, k * ISO_LEN));
    // each hit group's own full stereo composite (dry, unit trim) around its anchor: the level metric ("this hit over the bed")
    const HG = G.filter(g => g.bus === 'hits'), own = new Float32Array(HG.length * OWN_LEN * 2);
    HG.forEach((g, k) => { for (let i = 0; i < OWN_LEN; i++) { const j = g.anchor - OWN_PRE + i; if (j >= 0 && j < g.L.length) { own[(k * OWN_LEN + i) * 2] = g.L[j]; own[(k * OWN_LEN + i) * 2 + 1] = g.R[j]; } } });
    const meta = {
      SR, fps, N, spf, loopFrames: score.loopFrames, isoLen: ISO_LEN, isoPre: ISO_PRE,
      noiseLeadMs: score.noiseLeadMs ?? 2,
      groups: G.map(g => ({ bus: g.bus, frame: g.frame, target: target(g.frame), ids: g.ids, kinds: g.kinds, guardDb: +g.guardDb.toFixed(3), trimDb: g.bus === 'hits' ? (trims[String(g.frame)] || 0) : 0 })),
      iso: isoParts.map((p, k) => ({ frame: p.frame, part: p.part, kind: p.kind, ids: p.ids, offset: k * ISO_LEN, target: target(p.frame) })),
      master: score.master || {}, levelTargets: score.levelTargets || {}, reverb: rv,
    };
    meta.own = HG.map((g, k) => ({ frame: g.frame, offset: k * OWN_LEN })); meta.ownLen = OWN_LEN; meta.ownPre = OWN_PRE;
    return { bed, hits, iso, own, meta };
  }
  window.ScoreEngine = { render, makeKit, voices: V, version: '1.0.0' };
})();
