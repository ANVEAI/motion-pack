/* motion-pack / layers / canvas2d.js: expansion overlay layers drawn with Canvas2D (2026-10-13). Owned code, no assets.
   Particles (closed form, seek-safe): sparks, embers, smoke, confetti, snow, motes.
     Every particle i lives in cycles of length L_i; cycle c = floor((t + phase_i) / L_i) re-seeds its spawn point with hash(seed, i, c),
     so the state at t needs no history. burstAt: a one-shot burst instead of a continuous emitter (sparks, confetti).
   Film artefact / HUD frames: recHUD, timecode (vhs | crt | film), sprocket, gateEdge, polaroid, instax, impactFrame.
   Audio-reactive: arBars, arRing, arWave, arSpectrum, driven by an envelope (values per frame, e.g. from sfx/music measurement)
     or by beat times (attack/decay pulse per beat), see envAt().
   Edit punctuation + end card (2026-10-14): invertFlash (1-3 frame negative via difference blend, flash budget <= 3/s enforced by safeFlashes),
     brandField (full-bleed brand colour, logo slot or owned placeholder mark + name, one line, soft scale settle).
   Same layer contract as overlay.js (canvas + mix-blend-mode, render(t, {frame})). Mounted through overlay.js mountStack. */
import { K2D_R3 } from './canvas2d-r3.js';   // round 3 (2026-10-14): dotCondense, hologramBeam
import { K2D_R45, preloadImages, imgOf } from './canvas2d-r45.js'; import { K2D_LIM, guardKinds } from './limits.js';   // round 4/5 (2026-10-14): embeddingCloud, epicycleDraw, hexMosaic, convergeToDot
const TAU = Math.PI * 2;
export function hashf(...k) { let h = 2166136261 >>> 0; for (const v of k) { h ^= (v * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace", SANS = "Manrope, 'Helvetica Neue', Arial, sans-serif";
const tc = (t, fps = 30, start = 0) => { const f = Math.max(0, Math.floor((t + start) * fps + 1e-6)), s = Math.floor(f / fps); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60, f % fps].map((v) => String(v).padStart(2, '0')).join(':'); };
/* envelope 0..1 at t: p.env = [values per frame] (p.envFps, default 30) or p.beats = [seconds] (attack 1 f, exponential decay) */
export function envAt(p, t, band = 0) {
  if (p.env && p.env.length) { const v = p.env[Math.min(p.env.length - 1, Math.max(0, Math.floor(t * (p.envFps || 30))))]; return Array.isArray(v) ? v[band % v.length] : v; }
  let e = 0; const dec = p.decay ?? 0.25; for (const b of p.beats || []) { const d = t - b; if (d >= -1 / 30 && d < dec * 4) e = Math.max(e, d < 0 ? 1 + d * 30 : Math.exp(-d / dec)); }
  return Math.min(1, e * (0.55 + 0.45 * hashf(band, 77, Math.floor(t * 8))) + 0.06 * hashf(band, Math.floor(t * 15)));
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(4)})`; };
function cyc(t, i, seed, life, jitter = 0.5) { const L = life * (1 - jitter / 2 + jitter * hashf(seed, i, 1)), ph = hashf(seed, i, 2) * L, c = Math.floor((t + ph) / L); return { age: ((t + ph) - c * L) / L, c, L }; }

/* instant-photo card: surround colour, a tilted paper card, a transparent photo window (evenodd), handwritten caption */
function photoCard(g, W, H, p, aspect, font) {
  const S = Math.min(W, H) * p.scale, sd = p.side * S, bt = p.bottom * S, wh = S - 2 * sd - bt, ww = wh * aspect, cw = ww + 2 * sd, ch = wh + sd + bt, r = 6 * H / 1080;
  g.globalAlpha = p.intensity; g.save(); g.translate(W / 2, H / 2); g.rotate(p.tilt * Math.PI / 180);
  const cx = -cw / 2, cy = -ch / 2; g.setTransform(g.getTransform());
  g.fillStyle = p.surround; g.beginPath(); g.rect(-W, -H, 2 * W, 2 * H); g.roundRect(cx + cw, cy, -cw, ch, r); g.fill('evenodd');
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 30 * H / 1080; g.shadowOffsetY = 10 * H / 1080;
  g.fillStyle = p.paper; g.beginPath(); g.roundRect(cx, cy, cw, ch, r); g.roundRect(cx + sd + ww, cy + sd, -ww, wh, r * 0.5); g.fill('evenodd'); g.shadowColor = 'transparent';
  if (p.caption) { g.fillStyle = p.ink; g.font = `500 ${(bt * 0.3).toFixed(1)}px ${font}`; g.textAlign = 'center'; g.fillText(p.caption, 0, cy + sd + wh + bt * 0.58); }
  g.restore(); g.globalAlpha = 1;
}

export const K2D = {
  sparks: { blend: 'screen', order: 20, tags: ['sparks', 'particles', 'fire', 'grinder', 'impact'], d: { x: 0.5, y: 0.75, count: 90, spread: 0.6, speed: 1.1, gravity: 1.4, life: 0.9, color: '#FFB347', burstAt: null, intensity: 1 },
    draw(g, W, H, t, p, s) { g.lineCap = 'round';
      for (let i = 0; i < p.count; i++) { let age, T, c = 0;
        if (p.burstAt != null) { T = t - p.burstAt; if (T < 0) return; age = T / (p.life * (0.5 + hashf(s, i, 3))); if (age >= 1) continue; } else { const q = cyc(t, i, s, p.life); age = q.age; c = q.c; T = age * q.L; }
        const a = -Math.PI / 2 + (hashf(s, i, c, 4) - 0.5) * p.spread * Math.PI, v = p.speed * (0.4 + 0.8 * hashf(s, i, c, 5)) * H;
        const vx = Math.cos(a) * v, vy = Math.sin(a) * v + p.gravity * H * T, x = p.x * W + Math.cos(a) * v * T, y = p.y * H + Math.sin(a) * v * T + 0.5 * p.gravity * H * T * T;
        const sp = Math.hypot(vx, vy), len = Math.min(70, sp * 0.03) * H / 1080, k = (1 - age) ** 1.5 * p.intensity;
        g.strokeStyle = rgba(age < 0.2 ? '#FFF6D8' : p.color, k); g.lineWidth = 3.4 * H / 1080 * (1 - age * 0.6);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - vx / sp * len, y - vy / sp * len); g.stroke(); } } },
  embers: { blend: 'screen', order: 21, tags: ['embers', 'particles', 'fire', 'warm', 'cinematic'], d: { count: 60, rise: 0.12, sway: 0.03, life: 6, size: 3, color: '#FF7A2A', intensity: 0.9 },
    draw(g, W, H, t, p, s) { for (let i = 0; i < p.count; i++) { const { age, c } = cyc(t, i, s, p.life);
      const x0 = hashf(s, i, c, 3) * W, y = H * (1.05 - age * p.rise * p.life * (0.6 + 0.8 * hashf(s, i, c, 4))), x = x0 + Math.sin(t * 1.3 + i) * p.sway * H;
      const fl = 0.6 + 0.4 * hashf(s, i, Math.floor(t * 12)), r = p.size * (0.6 + hashf(s, i, 5)) * H / 1080, k = Math.sin(Math.PI * age) * fl * p.intensity;
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 4); gr.addColorStop(0, rgba('#FFE2A0', k)); gr.addColorStop(0.25, rgba(p.color, k * 0.8)); gr.addColorStop(1, rgba(p.color, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 4, 0, TAU); g.fill(); } } },
  smoke: { blend: 'normal', order: 22, tags: ['smoke', 'puff', 'particles', 'atmosphere', 'cartoon'], d: { x: 0.5, y: 0.85, count: 26, rise: 0.35, spread: 0.12, life: 4, size: 0.12, color: '#B9B9C2', intensity: 0.5 },
    draw(g, W, H, t, p, s) { for (let i = 0; i < p.count; i++) { const { age, c } = cyc(t, i, s, p.life, 0.3);
      const x = (p.x + (hashf(s, i, c, 3) - 0.5) * p.spread * (1 + 2 * age)) * W + Math.sin(age * 4 + i) * 0.02 * H, y = (p.y - age * p.rise) * H, r = p.size * H * (0.4 + 1.4 * age);
      const k = Math.sin(Math.PI * Math.min(1, age * 1.4)) * (1 - age) * p.intensity, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(p.color, k * 0.55)); gr.addColorStop(0.6, rgba(p.color, k * 0.25)); gr.addColorStop(1, rgba(p.color, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } } },
  confetti: { blend: 'normal', order: 85, tags: ['confetti', 'celebrate', 'win', 'party', 'particles'], d: { count: 140, fall: 0.22, life: 5, size: 14, colors: ['#4A18ED', '#FFC83D', '#FF4F7B', '#2BD9A0', '#5AB0FF'], burstAt: null, x: 0.5, y: 0.6, intensity: 1 },
    draw(g, W, H, t, p, s) { const sc = H / 1080;
      for (let i = 0; i < p.count; i++) { let x, y, age, c = 0;
        if (p.burstAt != null) { const T = t - p.burstAt; if (T < 0) return; age = T / p.life; if (age >= 1) continue; const a = -Math.PI / 2 + (hashf(s, i, 4) - 0.5) * 1.6, v = (0.8 + 1.2 * hashf(s, i, 5)) * H, drag = 2.2;
          const k = (1 - Math.exp(-drag * T)) / drag; x = p.x * W + Math.cos(a) * v * k; y = p.y * H + Math.sin(a) * v * k + 0.18 * H * T * T * 0.5 + p.fall * H * T * 0.4; }
        else { const q = cyc(t, i, s, p.life, 0.4); age = q.age; c = q.c; x = hashf(s, i, c, 3) * W + Math.sin(t * 2 + i) * 18 * sc; y = (-0.05 + age * p.fall * p.life) * H; }
        const sp = t * (3 + 5 * hashf(s, i, 6)) + i, w = p.size * sc * (0.6 + 0.6 * hashf(s, i, 7)), h = w * 0.55;
        g.save(); g.translate(x, y); g.rotate(sp * 0.7); g.scale(1, Math.cos(sp)); g.fillStyle = rgba(p.colors[i % p.colors.length], p.intensity * (p.burstAt != null ? Math.min(1, (1 - age) * 4) : 1));
        g.fillRect(-w / 2, -h / 2, w, h); g.restore(); } } },
  snow: { blend: 'screen', order: 23, tags: ['snow', 'winter', 'particles', 'festive', 'calm'], d: { count: 220, fall: 0.12, life: 9, size: 2.6, sway: 0.02, intensity: 0.9 },
    draw(g, W, H, t, p, s) { g.fillStyle = '#FFFFFF'; for (let i = 0; i < p.count; i++) { const { age, c } = cyc(t, i, s, p.life, 0.3), z = 0.4 + 0.6 * hashf(s, i, 9);
      const x = hashf(s, i, c, 3) * W + Math.sin(t * (0.6 + z) + i * 1.7) * p.sway * H, y = (-0.03 + age * 1.06) * H, r = p.size * z * H / 1080;
      g.globalAlpha = p.intensity * (0.35 + 0.65 * z); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } g.globalAlpha = 1; } },
  motes: { blend: 'screen', order: 24, tags: ['dust', 'motes', 'light', 'beam', 'calm'], d: { count: 70, size: 2.2, drift: 0.01, intensity: 0.7, beam: [0.3, 0.0, 0.7, 1.0] },
    draw(g, W, H, t, p, s) { const [bx0, by0, bx1, by1] = p.beam; for (let i = 0; i < p.count; i++) { const u = hashf(s, i, 1), v = hashf(s, i, 2);
      const x = (bx0 + (bx1 - bx0) * u) * W + Math.sin(t * 0.4 + i) * p.drift * H * 3, y = (by0 + (by1 - by0) * v) * H + Math.cos(t * 0.3 + i * 2.1) * p.drift * H * 2;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + hashf(s, i, 3)) + i)), r = p.size * (0.5 + hashf(s, i, 4)) * H / 1080, gr = g.createRadialGradient(x, y, 0, x, y, r * 3);
      gr.addColorStop(0, rgba('#FFF4DC', p.intensity * tw)); gr.addColorStop(1, rgba('#FFF4DC', 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3, 0, TAU); g.fill(); } } },
  recHUD: { blend: 'normal', order: 92, tags: ['rec', 'hud', 'camcorder', 'vlog', 'found-footage'], d: { label: 'REC', start: 0, fps: 30, battery: 0.7, color: '#FFFFFF', intensity: 1 },
    draw(g, W, H, t, p) { const sc = H / 1080, m = 60 * sc, L = 70 * sc; g.globalAlpha = p.intensity; g.strokeStyle = p.color; g.lineWidth = 4 * sc;
      for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { g.beginPath(); g.moveTo(x, y + dy * L); g.lineTo(x, y); g.lineTo(x + dx * L, y); g.stroke(); }
      if (Math.floor(t * 2) % 2 === 0) { g.fillStyle = '#FF2A2A'; g.beginPath(); g.arc(m + 40 * sc, m + 52 * sc, 13 * sc, 0, TAU); g.fill(); }
      g.fillStyle = p.color; g.font = `600 ${38 * sc}px ${MONO}`; g.textBaseline = 'middle'; g.fillText(p.label, m + 66 * sc, m + 53 * sc);
      g.textAlign = 'right'; g.fillText(tc(t, p.fps, p.start), W - m - 20 * sc, H - m - 40 * sc); g.textAlign = 'left';
      const bx = W - m - 120 * sc, by = m + 36 * sc; g.strokeRect(bx, by, 90 * sc, 34 * sc); g.fillRect(bx + 90 * sc, by + 10 * sc, 8 * sc, 14 * sc); g.fillRect(bx + 5 * sc, by + 5 * sc, 80 * sc * p.battery, 24 * sc); g.globalAlpha = 1; } },
  timecode: { blend: 'normal', order: 93, tags: ['timecode', 'vhs', 'crt', 'hud', 'retro'], d: { style: 'vhs', date: 'OCT 13 2026', start: 0, fps: 30, intensity: 1 },
    draw(g, W, H, t, p) { const sc = H / 1080, st = p.style; g.globalAlpha = p.intensity; g.textBaseline = 'alphabetic';
      if (st === 'film') { const s = tc(t, p.fps, p.start); g.font = `500 ${40 * sc}px ${MONO}`; const w = g.measureText(s).width; g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(W / 2 - w / 2 - 16 * sc, H - 110 * sc, w + 32 * sc, 56 * sc); g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.fillText(s, W / 2, H - 68 * sc); g.textAlign = 'left'; g.globalAlpha = 1; return; }
      const col = st === 'crt' ? '#7CFF8A' : '#F4F4F4', f = `${st === 'crt' ? 500 : 700} ${46 * sc}px ${MONO}`, sh = (txt, x, y) => { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(txt, x + 4 * sc, y + 4 * sc); g.fillStyle = col; g.fillText(txt, x, y); };
      g.font = f; sh(st === 'crt' ? 'CH 03' : 'PLAY ▶', 80 * sc, 120 * sc); if (st === 'vhs') sh('SP', W - 180 * sc, 120 * sc);
      sh(tc(t, p.fps, p.start).slice(0, 8), 80 * sc, H - 150 * sc); sh(p.date, 80 * sc, H - 90 * sc); g.globalAlpha = 1; } },
  sprocket: { blend: 'normal', order: 94, tags: ['film', 'sprocket', 'strip', 'analog', 'frame'], d: { width: 0.07, holes: 7, speed: 0, weave: 1.5, color: '#0B0B0B', intensity: 1 },
    draw(g, W, H, t, p, s) { const bw = p.width * W, ph = H / p.holes, off = ((t * p.speed * H) % ph + ph) % ph, wv = (hashf(s, Math.floor(t * 24)) - 0.5) * p.weave * H / 1080;
      g.globalAlpha = p.intensity; for (const x0 of [0, W - bw]) { g.fillStyle = p.color; g.fillRect(x0, 0, bw, H); g.globalCompositeOperation = 'destination-out';
        for (let i = -1; i <= p.holes; i++) { const y = i * ph + off + ph * 0.25 + wv; g.beginPath(); g.roundRect(x0 + bw * 0.28, y, bw * 0.44, ph * 0.5, 6 * H / 1080); g.fill(); } g.globalCompositeOperation = 'source-over'; } g.globalAlpha = 1; } },
  gateEdge: { blend: 'normal', order: 95, tags: ['film', 'gate', 'frame', 'analog', 'vintage'], d: { radius: 0.06, soft: 0.012, weave: 2, color: '#050505', intensity: 1 },
    draw(g, W, H, t, p, s) { const wv = [(hashf(s, Math.floor(t * 24), 1) - 0.5) * p.weave * H / 1080, (hashf(s, Math.floor(t * 24), 2) - 0.5) * p.weave * H / 1080], r = p.radius * H, b = 14 * H / 1080;
      g.globalAlpha = p.intensity; g.fillStyle = p.color; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'destination-out'; g.filter = `blur(${(p.soft * H).toFixed(1)}px)`;
      g.beginPath(); g.roundRect(b + wv[0], b + wv[1], W - 2 * b, H - 2 * b, r); g.fill(); g.filter = 'none'; g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; } },
  polaroid: { blend: 'normal', order: 96, tags: ['polaroid', 'photo', 'frame', 'memory', 'scrapbook'], d: { caption: '', paper: '#F7F5EE', ink: '#2A2A3A', surround: '#16161B', side: 0.06, bottom: 0.2, scale: 0.86, tilt: -2, intensity: 1 },
    draw(g, W, H, t, p) { photoCard(g, W, H, p, 1, "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive"); } },
  instax: { blend: 'normal', order: 96, tags: ['instax', 'photo', 'frame', 'memory', 'social'], d: { caption: '', paper: '#FBFBF8', ink: '#2A2A3A', surround: '#F0D9E4', side: 0.045, bottom: 0.15, aspect: 0.74, scale: 0.9, tilt: 2, intensity: 1 },
    draw(g, W, H, t, p) { photoCard(g, W, H, p, p.aspect, "'Bradley Hand', 'Comic Sans MS', cursive"); } },
  impactFrame: { blend: 'normal', order: 91, tags: ['impact', 'manga', 'anime', 'flash', 'comic'], d: { x: 0.5, y: 0.5, spikes: 64, invert: false, at: 0, frames: 3, intensity: 1 },
    draw(g, W, H, t, p, s) { const f = Math.floor((t - p.at) * 30 + 1e-6); if (f < 0 || f >= p.frames) return; const cx = p.x * W, cy = p.y * H, R = Math.hypot(W, H);
      g.globalAlpha = p.intensity; g.fillStyle = p.invert ? '#000' : '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = p.invert ? '#fff' : '#000'; g.beginPath();
      for (let i = 0; i < p.spikes; i++) { const a = (i + hashf(s, i, f) * 0.6) / p.spikes * TAU, w = (0.2 + 0.6 * hashf(s, i, f, 2)) / p.spikes * TAU * 0.5, r0 = (0.18 + 0.2 * hashf(s, i, f, 3)) * Math.min(W, H);
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a - w) * R, cy + Math.sin(a - w) * R); g.lineTo(cx + Math.cos(a + w) * R, cy + Math.sin(a + w) * R); g.closePath(); }
      g.fill(); g.globalAlpha = 1; } },
  arBars: { blend: 'normal', order: 80, tags: ['audio-reactive', 'bars', 'equalizer', 'music', 'podcast'], d: { bars: 32, x: 0.5, y: 0.82, width: 0.6, height: 0.16, color: '#FFFFFF', beats: [], env: null, decay: 0.25, intensity: 1 },
    draw(g, W, H, t, p) { const n = p.bars, bw = p.width * W / n, x0 = (p.x - p.width / 2) * W, base = p.y * H; g.fillStyle = rgba(p.color, p.intensity);
      for (let i = 0; i < n; i++) { const e = envAt(p, t, i), h = Math.max(4 * H / 1080, e * p.height * H * (0.5 + 0.5 * Math.sin(Math.PI * (i + 0.5) / n))); g.beginPath(); g.roundRect(x0 + i * bw + bw * 0.15, base - h, bw * 0.7, h, bw * 0.35); g.fill(); } } },
  arRing: { blend: 'screen', order: 80, tags: ['audio-reactive', 'ring', 'pulse', 'voice', 'ai'], d: { x: 0.5, y: 0.5, radius: 0.14, gain: 0.35, rings: 3, color: '#8E6BFF', beats: [], env: null, decay: 0.3, intensity: 1 },
    draw(g, W, H, t, p) { const e = envAt(p, t), cx = p.x * W, cy = p.y * H; g.lineWidth = 5 * H / 1080;
      for (let k = 0; k < p.rings; k++) { const r = p.radius * H * (1 + p.gain * e * (1 + k * 0.6)), a = p.intensity * (1 - k / p.rings) * (0.4 + 0.6 * e); g.strokeStyle = rgba(p.color, a); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); } } },
  arWave: { blend: 'normal', order: 80, tags: ['audio-reactive', 'waveform', 'voice', 'podcast', 'ai'], d: { y: 0.5, height: 0.12, cycles: 3, color: '#FFFFFF', beats: [], env: null, decay: 0.25, intensity: 1 },
    draw(g, W, H, t, p) { const e = envAt(p, t); g.strokeStyle = rgba(p.color, p.intensity); g.lineWidth = 4 * H / 1080; g.beginPath();
      for (let x = 0; x <= W; x += 4) { const u = x / W, w = Math.sin(Math.PI * u), y = p.y * H + Math.sin(u * TAU * p.cycles + t * 6) * Math.sin(u * TAU * p.cycles * 2.3 - t * 4) * p.height * H * (0.15 + 0.85 * e) * w; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } },
  arSpectrum: { blend: 'screen', order: 80, tags: ['audio-reactive', 'spectrum', 'radial', 'music', 'visualizer'], d: { x: 0.5, y: 0.5, radius: 0.18, bands: 64, height: 0.12, color: '#5AB0FF', color2: '#FF4F7B', beats: [], env: null, decay: 0.25, intensity: 1 },
    draw(g, W, H, t, p) { const cx = p.x * W, cy = p.y * H, r0 = p.radius * H; g.lineWidth = Math.max(2, TAU * r0 / p.bands * 0.5); g.lineCap = 'round';
      for (let i = 0; i < p.bands; i++) { const e = envAt(p, t, i), a = i / p.bands * TAU - Math.PI / 2, l = (0.08 + e) * p.height * H; g.strokeStyle = rgba(i % 2 ? p.color : p.color2, p.intensity);
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l)); g.stroke(); } } },
};

/* ---- invertFlash + brandField (2026-10-14) ---- */
/* flash safety: keep flashes in time order and drop any that would put more than maxPerSec flash onsets inside one second (WCAG 2.3.1 style budget) */
export function safeFlashes(times = [], maxPerSec = 3) { const kept = []; for (const a of [...times].sort((x, y) => x - y)) { if (kept.filter((b) => a - b < 1 - 1e-9).length < maxPerSec) kept.push(a); } return kept; }
export function lintFlashes(times = [], { maxPerSec = 3, frames = 2 } = {}) { const w = [], k = safeFlashes(times, maxPerSec); if (k.length < times.length) w.push(`invertFlash: ${times.length - k.length} flash(es) dropped: more than ${maxPerSec} in one second`); if (frames > 3) w.push('invertFlash: a negative flash longer than 3 frames reads as a look, not a flash'); return w; }
/* logo images share canvas2d-r45.js's ONE loader (loadImg / imgOf / preloadImages): a string `logo` is listed in assets(), so mountStack(...).ready() resolves after it is decoded and the first frame already
   draws it. (A second, private loader here used to start the load inside draw(), so frame 0 showed the placeholder mark and later frames the logo.) */
/* the generic placeholder mark: a ring with one orbiting dot (owned; swap in a real logo with p.logo) */
function orbitMark(g, cx, cy, r, ink) { g.strokeStyle = ink; g.lineWidth = r * 0.16; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); g.fillStyle = ink; g.beginPath(); g.arc(cx + r * 0.95, cy - r * 0.32, r * 0.24, 0, TAU); g.fill(); }
Object.assign(K2D, {
  invertFlash: { blend: 'difference', order: 89, tags: ['flash', 'invert', 'negative', 'comedy', 'impact', 'doc-parody', 'cut'], d: { at: [], frames: 2, fps: 30, color: '#FFFFFF', intensity: 1, maxPerSec: 3 },
    draw(g, W, H, t, p) { for (const a of safeFlashes(p.at, p.maxPerSec)) { const f = Math.floor((t - a) * p.fps + 1e-6); if (f >= 0 && f < Math.min(3, p.frames)) { g.globalAlpha = p.intensity; g.fillStyle = p.color; g.fillRect(0, 0, W, H); g.globalAlpha = 1; return; } } } },
  brandField: { blend: 'normal', order: 97, tags: ['end-card', 'brand', 'logo', 'cta', 'full-bleed', 'outro'], d: { at: 0, color: '#4A18ED', ink: '#FFFFFF', name: 'Orbit', line: 'Every idea, in one place.', logo: null, mark: 'orbit',
    reveal: 'cut', revealDur: 0.35, settle: 0.9, scaleFrom: 1.08, lineDelay: 0.18, y: 0.46, size: 0.11, intensity: 1 },
    assets: (p) => (typeof p.logo === 'string' ? [p.logo] : []),   // a URL logo is preloaded: await stack.ready() before the first frame
    draw(g, W, H, t, p) { const u = t - p.at; if (u < 0) return; const sc = H / 1080, rk = p.reveal === 'cut' ? 1 : E2(Math.min(1, u / p.revealDur));
      g.save(); g.globalAlpha = p.intensity; g.beginPath();
      if (p.reveal === 'iris') g.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * rk + 1, 0, TAU); else if (p.reveal === 'wipe') g.rect(0, H * (1 - rk), W, H * rk + 1); else g.rect(0, 0, W, H);
      g.fillStyle = p.color; g.fill(); g.clip();
      const k = 1 - E2(Math.min(1, u / p.settle)), s = 1 + (p.scaleFrom - 1) * k, a1 = Math.min(1, u / 0.25), a2 = Math.min(1, Math.max(0, u - p.lineDelay) / 0.3);
      g.translate(W / 2, H * p.y); g.scale(s, s); const L = p.size * H, logo = imgOf(p.logo);
      g.globalAlpha = p.intensity * a1;
      if (logo) { const iw = logo.naturalWidth || logo.width, ih = logo.naturalHeight || logo.height, k2 = Math.min(L * 3.2 / iw, L / ih); g.drawImage(logo, -iw * k2 / 2, -ih * k2 / 2, iw * k2, ih * k2); }
      else { g.font = `800 ${(L * 0.82).toFixed(1)}px ${SANS}`; g.textBaseline = 'middle'; const tw = p.name ? g.measureText(p.name).width : 0, mw = p.mark === 'orbit' ? L * 0.9 : 0, gap = mw && tw ? L * 0.28 : 0, x0 = -(mw + gap + tw) / 2;
        if (mw) orbitMark(g, x0 + mw / 2, 0, L * 0.36, p.ink); if (tw) { g.fillStyle = p.ink; g.textAlign = 'left'; g.fillText(p.name, x0 + mw + gap, L * 0.04); } }
      if (p.line) { g.globalAlpha = p.intensity * a2; g.fillStyle = p.ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = `600 ${(L * 0.36).toFixed(1)}px ${SANS}`; g.fillText(p.line, 0, L * 1.15 + (1 - a2) * 10 * sc); }
      g.restore(); } },
});
Object.assign(K2D, K2D_R3, K2D_R45); guardKinds(K2D, K2D_LIM);   // every kind's draw sanitises p first (NaN / Infinity -> default; counts and steps clamped: layers/limits.js)
const E2 = (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * Math.max(0, x)));   // expo-out: the soft settle

export class Canvas2DLayer {
  constructor(canvas, kind, params = {}, { width = 1920, height = 1080, fps = 30, seed = 1 } = {}) {
    if (!K2D[kind]) throw new Error('unknown canvas2d kind ' + kind);
    this.kind = kind; this.canvas = canvas; this.W = canvas.width = width; this.H = canvas.height = height; this.fps = fps; this.seed = seed; this.g = canvas.getContext('2d');
    this.setParams(params); canvas.style.mixBlendMode = K2D[kind].blend; canvas.dataset.mpKind = kind;
  }
  setParams(p) { this.p = { ...K2D[this.kind].d, ...p }; this._ready = preloadImages(K2D[this.kind].assets ? K2D[this.kind].assets(this.p) : []); return this; }
  ready() { return this._ready; }   /* resolves when this layer's images (embeddingCloud / hexMosaic `images`) are decoded: await before the first frame */
  render(t, { frame } = {}) { const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.W, this.H); K2D[this.kind].draw(g, this.W, this.H, frame != null ? frame / this.fps : t, this.p, (this.p.seed ?? this.seed) >>> 0); return this; }
}
