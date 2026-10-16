/* motion-pack / templates / _shared / film / plates.js: procedural PLACEHOLDER footage for the film templates (2026-10-16, film lane). Owned code, no assets.
   Every plate is a pure function of (W, H, t, params): Canvas2D shapes and gradients from seeded hashes, no clock, no Math.random, no history, so any frame renders the
   same in any seek order. They are stand-ins for YOUR footage (CONFIG.media.<slot>.src): the host page labels every one "placeholder" in frame.
   They are moody on purpose (dark, a practical light, motion inside the shot) so the genre grade, halation, grain and weave have something to act on.
     coast     night sea, a relay mast on a cliff with a blinking light and a turning beacon, fog on the horizon, moon glints
     radio     a receiver panel close-up: an amber dial with a drifting needle, a green scope whose trace turns from noise into a pulse (`signal` 0..1)
     corridor  a one-point corridor with receding fluorescent panels (one flickers) and a cold doorway glow, a slow dolly in
     window    rain on a window at night, city bokeh outside, a back-lit head-and-shoulders silhouette (no face)
     storm     slow dark clouds, rain, a lightning flicker (soft, under the flash limit) and a bolt on seeded beats
     ship      fog banks, a ghost-ship silhouette drifting out of them, a searchlight sweep
     sky       a starfield turning about a pole, aurora curtains, a dish antenna silhouette with a blinking light
     lamp      a swinging bare bulb over a table, its light pool and the shadow moving with it, dust motes
     road      a night road in perspective: lane dashes rushing, roadside trees, headlights approaching
     signal    a black field with a glowing oscilloscope line carrying a repeating pulse, interference bursts
     smoke     slow smoke wisps on black (a title-card texture), embers optional
     ink       ink blooms spreading on dark paper (a title-sequence texture)
     beams     god rays through dust from a high window (a title-sequence texture)
   drawPlate(g, kind, W, H, t, params) -> draws the full frame (opaque). PLATE_KINDS lists them; PLATE_LABELS gives the default slot label. */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
function hash(...k) { let h = 2166136261 >>> 0; for (const v of k) { h ^= (Math.round(v * 977) * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
const vn = (x, s) => { const i = Math.floor(x), f = x - i, k = (1 - Math.cos(f * Math.PI)) / 2; return lerp(hash(i, s), hash(i + 1, s), k); };
const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${clamp(a).toFixed(4)})`;
function blob(g, x, y, r, col, a) { if (r <= 0 || a <= 0) return; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(...col, a)); gr.addColorStop(1, rgba(...col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function vgrad(g, W, H, stops, y0 = 0, y1 = H) { const lg = g.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) lg.addColorStop(o, c); g.fillStyle = lg; g.fillRect(0, 0, W, H); }
function push(g, W, H, k, cx = 0.5, cy = 0.5) { g.translate(W * cx, H * cy); g.scale(k, k); g.translate(-W * cx, -H * cy); }

/* ------------------------------------------------------------------------------------------------------------------------------- the plates */
function coast(g, W, H, t, p) {
  const m = Math.min(W, H), tall = H > W, hz = H * (tall ? 0.6 : 0.6); push(g, W, H, 1 + 0.012 * t, 0.62, 0.55);
  vgrad(g, W, H, [[0, '#03060d'], [0.55, '#0b1724'], [1, '#1f3142']], 0, hz);
  for (let i = 0; i < 170; i++) { const x = hash(i, 1) * W, y = hash(i, 2) * hz * 0.85, a = (0.25 + 0.6 * hash(i, 3)) * (0.6 + 0.4 * hash(i, Math.floor(t * 6))); g.fillStyle = rgba(220, 230, 255, a * 0.7); g.fillRect(x, y, 1.6 * m / 1080, 1.6 * m / 1080); }
  const mx = W * (tall ? 0.3 : 0.24), my = H * 0.2; blob(g, mx, my, m * 0.42, [120, 150, 190], 0.2); blob(g, mx, my, m * 0.09, [200, 215, 235], 0.5); g.fillStyle = '#e8edf5'; g.beginPath(); g.arc(mx, my, m * 0.028, 0, TAU); g.fill();
  vgrad(g, W, H, [[0, '#0d1a26'], [1, '#020407']], hz, H); g.fillStyle = 'rgba(0,0,0,0)';
  g.fillStyle = '#0a1520'; g.fillRect(0, hz, W, H - hz);
  const sea = g.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, '#13222f'); sea.addColorStop(1, '#020305'); g.fillStyle = sea; g.fillRect(0, hz, W, H - hz);
  for (let k = 0; k < 46; k++) { const d = (k + 1) / 46, y = hz + (H - hz) * d ** 1.7, a = 0.08 + 0.18 * (1 - d); g.strokeStyle = rgba(150, 180, 210, a); g.lineWidth = Math.max(1, 2.2 * d * m / 1080); g.beginPath();
    for (let x = 0; x <= W; x += W / 24) { const yy = y + Math.sin(x / W * 9 + t * (0.6 + d) + k) * 3 * d * m / 1080; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke();
    const gx = mx + (vn(k * 3.1 + t * 0.8, 9) - 0.5) * m * 0.12, gw = m * 0.04 * (1 - d * 0.5); g.fillStyle = rgba(230, 236, 245, (0.25 + 0.4 * hash(k, Math.floor(t * 10))) * (1 - d) ); g.fillRect(gx - gw / 2, y - 1, gw, Math.max(1, 2 * m / 1080)); }
  for (let i = 0; i < 7; i++) { const x = ((hash(i, 7) + t * 0.008 * (1 + i % 3)) % 1.2 - 0.1) * W; blob(g, x, hz - m * 0.01, m * (0.25 + 0.15 * hash(i, 8)), [120, 140, 160], 0.11); }
  const cx = W * (tall ? 0.72 : 0.8), cl = hz - m * 0.02; g.fillStyle = '#020304'; g.beginPath(); g.moveTo(cx - m * 0.42, H); g.lineTo(cx - m * 0.3, cl + m * 0.05); g.lineTo(cx - m * 0.1, cl - m * 0.02); g.lineTo(cx + m * 0.2, cl - m * 0.04); g.lineTo(W + 10, cl); g.lineTo(W + 10, H); g.fill();
  const tb = cl - m * 0.03, tt = tb - m * 0.36, tw = m * 0.05; g.strokeStyle = '#05070a'; g.lineWidth = Math.max(1.5, 3 * m / 1080); g.beginPath(); g.moveTo(cx - tw, tb); g.lineTo(cx, tt); g.lineTo(cx + tw, tb);
  for (let k = 1; k < 9; k++) { const y = lerp(tb, tt, k / 9), w = tw * (1 - k / 9); g.moveTo(cx - w, y); g.lineTo(cx + w * 0.9, lerp(tb, tt, (k + 1) / 9)); g.moveTo(cx + w, y); g.lineTo(cx - w * 0.9, lerp(tb, tt, (k + 1) / 9)); } g.stroke();
  const a = t * 0.55 + (p.beam ?? 0); g.save(); g.globalCompositeOperation = 'lighter'; const bl = m * 1.6, sp = 0.07;
  for (const s of [1, -1]) { const ang = a + (s < 0 ? Math.PI : 0), x2 = cx + Math.cos(ang) * bl, y2 = tt + Math.sin(ang) * bl * 0.25; const lg = g.createLinearGradient(cx, tt, x2, y2); lg.addColorStop(0, 'rgba(255,240,200,0.32)'); lg.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = lg;
    g.beginPath(); g.moveTo(cx, tt); g.lineTo(cx + Math.cos(ang - sp) * bl, tt + Math.sin(ang - sp) * bl * 0.25); g.lineTo(cx + Math.cos(ang + sp) * bl, tt + Math.sin(ang + sp) * bl * 0.25); g.fill(); }
  g.restore(); blob(g, cx, tt, m * 0.04, [255, 240, 210], 0.9);
  if ((t % 2) < 0.22) { blob(g, cx, tt - m * 0.012, m * 0.05, [255, 40, 30], 0.95); blob(g, cx, tt - m * 0.012, m * 0.006, [255, 200, 190], 1); }
}
function radio(g, W, H, t, p) {
  const m = Math.min(W, H), sig = clamp(p.signal ?? clamp((t - 1.5) / 3)); push(g, W, H, 1 + 0.015 * t, 0.5, 0.52);
  vgrad(g, W, H, [[0, '#0b0806'], [1, '#1a120c']]); blob(g, W * 0.12, H * 0.3, m * 0.3, [255, 150, 60], 0.12); blob(g, W * 0.9, H * 0.8, m * 0.25, [255, 120, 40], 0.08);
  const pw = Math.min(W * 0.86, m * 1.5), ph = m * 0.62, px = (W - pw) / 2, py = H * 0.5 - ph / 2; g.fillStyle = '#17120e'; g.fillRect(px, py, pw, ph);
  g.strokeStyle = 'rgba(255,220,180,0.05)'; g.lineWidth = 1; for (let i = 0; i < 60; i++) { const y = py + (i / 60) * ph; g.beginPath(); g.moveTo(px, y); g.lineTo(px + pw, y + 2); g.stroke(); }
  const dw = pw * 0.52, dh = ph * 0.32, dx = px + pw * 0.06, dy = py + ph * 0.14; const dg = g.createLinearGradient(0, dy, 0, dy + dh); dg.addColorStop(0, '#ffb44a'); dg.addColorStop(1, '#a8501a'); g.fillStyle = dg; g.fillRect(dx, dy, dw, dh);
  g.fillStyle = 'rgba(40,18,6,0.85)'; for (let i = 0; i <= 40; i++) { const x = dx + dw * 0.05 + (dw * 0.9) * i / 40, l = i % 5 ? dh * 0.18 : dh * 0.36; g.fillRect(x, dy + dh - l - dh * 0.1, Math.max(1, 2 * m / 1080), l); }
  const nx = dx + dw * (0.5 + 0.38 * Math.sin(t * 0.35) + 0.02 * Math.sin(t * 7.3) * (1 - sig)); g.fillStyle = '#ff2a1a'; g.fillRect(nx, dy + dh * 0.06, Math.max(2, 4 * m / 1080), dh * 0.88); blob(g, dx + dw / 2, dy + dh / 2, dw * 0.6, [255, 170, 80], 0.25);
  const sr = ph * 0.3, sx = px + pw * 0.8, sy = py + ph * 0.36; g.fillStyle = '#031208'; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill(); blob(g, sx, sy, sr * 1.15, [60, 255, 140], 0.12);
  g.save(); g.beginPath(); g.arc(sx, sy, sr * 0.94, 0, TAU); g.clip(); g.strokeStyle = 'rgba(60,255,150,0.18)'; g.lineWidth = 1; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(sx - sr, sy + i * sr / 3.5); g.lineTo(sx + sr, sy + i * sr / 3.5); g.stroke(); g.beginPath(); g.moveTo(sx + i * sr / 3.5, sy - sr); g.lineTo(sx + i * sr / 3.5, sy + sr); g.stroke(); }
  g.strokeStyle = 'rgba(120,255,170,0.95)'; g.lineWidth = Math.max(1.5, 3 * m / 1080); g.shadowColor = 'rgba(80,255,150,0.9)'; g.shadowBlur = 12 * m / 1080; g.beginPath();
  for (let i = 0; i <= 120; i++) { const u = i / 120, x = sx - sr + u * 2 * sr, ph2 = (u * 3 - t * 0.9) % 1, pulse = Math.exp(-(((ph2 + 1) % 1 - 0.5) ** 2) / 0.004) * Math.sin(u * 90 - t * 20), nz = (hash(i, Math.floor(t * 15)) - 0.5) * 2;
    const y = sy - sr * 0.55 * (sig * pulse + (1 - sig) * nz * 0.6 + 0.05 * Math.sin(u * 40 + t * 5)); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.restore();
  for (let k = 0; k < 4; k++) { const kx = px + pw * (0.12 + 0.13 * k), ky = py + ph * 0.75, kr = ph * 0.075; const kg = g.createRadialGradient(kx - kr * 0.3, ky - kr * 0.3, kr * 0.1, kx, ky, kr); kg.addColorStop(0, '#5a4a3c'); kg.addColorStop(1, '#0c0907'); g.fillStyle = kg; g.beginPath(); g.arc(kx, ky, kr, 0, TAU); g.fill(); }
  const lp = 0.5 + 0.5 * Math.sin(t * 3.2); blob(g, px + pw * 0.66, py + ph * 0.78, ph * 0.06, [255, 60, 30], 0.5 + 0.4 * lp * sig);
}
function corridor(g, W, H, t, p) {
  const m = Math.min(W, H), vx = W / 2 + Math.sin(t * 0.2) * m * 0.01, vy = H * 0.48, sp = p.speed ?? 0.35; g.fillStyle = '#050807'; g.fillRect(0, 0, W, H);
  const proj = (x, y, z) => [vx + (x - 0.5) * W * 1.25 / z, vy + (y - 0.5) * H * 1.25 / z * (W > H ? 1 : 0.7)];
  const quad = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  const z0 = 0.9, z1 = 14; const fl = g.createLinearGradient(0, H, 0, vy); fl.addColorStop(0, '#16201c'); fl.addColorStop(1, '#030504'); quad([proj(0, 1, z0), proj(1, 1, z0), proj(1, 1, z1), proj(0, 1, z1)], fl);
  const ce = g.createLinearGradient(0, 0, 0, vy); ce.addColorStop(0, '#0f1714'); ce.addColorStop(1, '#030504'); quad([proj(0, 0, z0), proj(1, 0, z0), proj(1, 0, z1), proj(0, 0, z1)], ce);
  quad([proj(0, 0, z0), proj(0, 1, z0), proj(0, 1, z1), proj(0, 0, z1)], '#0a110e'); quad([proj(1, 0, z0), proj(1, 1, z0), proj(1, 1, z1), proj(1, 0, z1)], '#0b120f');
  const ph = (t * sp) % 1; for (let i = 14; i >= 0; i--) { const z = 1 + i - ph; if (z < z0) continue; const fog = clamp(1 - z / 12);
    g.strokeStyle = rgba(120, 160, 140, 0.18 * fog); g.lineWidth = Math.max(1, 3 / z); const a = proj(0, 0, z), b = proj(1, 0, z), c = proj(1, 1, z), d = proj(0, 1, z); g.beginPath(); g.moveTo(...a); g.lineTo(...d); g.moveTo(...b); g.lineTo(...c); g.stroke();
    const flick = (i + Math.floor(t * sp)) % 5 === 3 ? (hash(Math.floor(t * 14), i) > 0.35 ? 1 : 0.15) : 1, l0 = proj(0.38, 0.0, z), l1 = proj(0.62, 0.0, z + 0.35);
    g.fillStyle = rgba(200, 255, 225, 0.85 * fog * flick); g.fillRect(l0[0], l0[1], l1[0] - l0[0], Math.max(2, (l1[1] - l0[1]) * 0.6 + 6 / z)); blob(g, (l0[0] + l1[0]) / 2, l0[1] + 10 / z, m * 0.3 / z, [150, 255, 200], 0.18 * fog * flick); }
  const d0 = proj(0.42, 0.25, z1 - 0.5), d1 = proj(0.58, 1, z1 - 0.5); g.fillStyle = '#bfe8ff'; g.fillRect(d0[0], d0[1], d1[0] - d0[0], d1[1] - d0[1]); blob(g, vx, vy + m * 0.03, m * 0.22, [170, 220, 255], 0.35);
}
function windowP(g, W, H, t, p) {
  const m = Math.min(W, H), tall = H > W; g.fillStyle = '#04060a'; g.fillRect(0, 0, W, H);
  const wx = W * (tall ? 0.08 : 0.3), wy = H * 0.1, ww = W * (tall ? 0.84 : 0.62), wh = H * 0.8; g.fillStyle = '#0a1018'; g.fillRect(wx, wy, ww, wh);
  g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
  for (let i = 0; i < 46; i++) { const x = wx + ((hash(i, 1) + t * 0.004 * (hash(i, 5) - 0.5)) % 1) * ww, y = wy + hash(i, 2) * wh * 0.9, r = m * (0.02 + 0.06 * hash(i, 3)), warm = hash(i, 4) > 0.45; blob(g, x, y, r, warm ? [255, 170, 80] : [80, 200, 220], 0.25 + 0.3 * hash(i, 6)); }
  for (let i = 0; i < 140; i++) { const x = wx + hash(i, 11) * ww, v = (0.15 + 0.4 * hash(i, 12)) * wh, y = wy + ((hash(i, 13) * wh + t * v) % wh), l = m * (0.01 + 0.03 * hash(i, 14)); g.strokeStyle = rgba(200, 220, 240, 0.18 + 0.2 * hash(i, 15)); g.lineWidth = Math.max(1, 1.6 * m / 1080); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * 0.08, y + l); g.stroke(); }
  for (let i = 0; i < 90; i++) { const x = wx + hash(i, 21) * ww, y = wy + hash(i, 22) * wh, r = m * 0.004 * (1 + 2 * hash(i, 23)); g.fillStyle = rgba(220, 235, 255, 0.25); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  g.restore(); g.strokeStyle = '#020305'; g.lineWidth = m * 0.02; g.strokeRect(wx, wy, ww, wh); g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh * 0.45); g.lineTo(wx + ww, wy + wh * 0.45); g.stroke();
  const bx = W * (tall ? 0.3 : 0.2) + Math.sin(t * 0.5) * m * 0.004, by = H * (tall ? 0.72 : 0.62), hr = m * 0.12; g.fillStyle = '#010102'; g.beginPath(); g.ellipse(bx, by - hr * 0.2, hr * 0.78, hr, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(bx - hr * 2.4, H); g.quadraticCurveTo(bx - hr * 2.2, by + hr * 1.2, bx - hr * 0.5, by + hr * 0.75); g.lineTo(bx + hr * 0.5, by + hr * 0.75); g.quadraticCurveTo(bx + hr * 2.2, by + hr * 1.2, bx + hr * 2.4, H); g.fill();
  g.strokeStyle = 'rgba(255,170,90,0.45)'; g.lineWidth = Math.max(1.5, 2.5 * m / 1080); g.beginPath(); g.ellipse(bx, by - hr * 0.2, hr * 0.78, hr, 0, -1.2, 0.5); g.stroke();
}
function storm(g, W, H, t, p) {
  const m = Math.min(W, H), beat = p.every ?? 2.7, n = Math.floor(t / beat), u = t - n * beat, strike = hash(n, 3) > 0.25 && u < 0.2, fl = strike ? (u < 0.07 ? 0.22 : u < 0.13 ? 0.08 : 0.16) : 0;
  vgrad(g, W, H, [[0, '#030405'], [0.7, '#0d1117'], [1, '#141a21']]);
  for (let i = 0; i < 46; i++) { const x = ((hash(i, 1) + t * 0.012 * (0.5 + hash(i, 2))) % 1.3 - 0.15) * W, y = hash(i, 3) * H * 0.7, r = m * (0.18 + 0.28 * hash(i, 4)), sh = 14 + 34 * hash(i, 5) ** 2;
    blob(g, x, y, r, [sh, sh + 3, sh + 8], 0.55); blob(g, x - r * 0.2, y + r * 0.35, r * 0.6, [60 + fl * 700, 70 + fl * 700, 85 + fl * 720], 0.12 + fl * 1.2); }
  if (strike && u < 0.13) { let x = W * (0.3 + 0.4 * hash(n, 9)), y = 0; g.strokeStyle = 'rgba(235,240,255,0.9)'; g.lineWidth = Math.max(1.5, 3 * m / 1080); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 14; k++) { x += (hash(n, k, 4) - 0.5) * m * 0.08; y += H * 0.05; g.lineTo(x, y); } g.stroke(); }
  g.strokeStyle = 'rgba(170,190,210,0.18)'; g.lineWidth = Math.max(1, 1.4 * m / 1080); g.beginPath(); for (let i = 0; i < 220; i++) { const x = hash(i, 31) * W * 1.2, y = ((hash(i, 32) * H + t * H * 1.4) % H); g.moveTo(x, y); g.lineTo(x - m * 0.012, y + m * 0.04); } g.stroke();
  g.fillStyle = '#030406'; g.fillRect(0, H * 0.86, W, H * 0.14);
}
function ship(g, W, H, t, p) {
  const m = Math.min(W, H), tall = H > W; vgrad(g, W, H, [[0, '#0d1216'], [0.6, '#1c252b'], [1, '#090c0e']]);
  const k = clamp((t + (p.emerge ?? 0)) / 6), sx = W * (tall ? 0.55 : 0.5) + t * m * 0.01, sy = H * 0.62, L = m * (tall ? 0.8 : 0.9);
  g.fillStyle = rgba(4, 6, 8, 0.35 + 0.55 * k); g.beginPath(); g.moveTo(sx - L / 2, sy); g.quadraticCurveTo(sx, sy + L * 0.12, sx + L / 2, sy - L * 0.03); g.lineTo(sx + L * 0.42, sy - L * 0.08); g.lineTo(sx - L * 0.45, sy - L * 0.06); g.fill();
  g.strokeStyle = rgba(4, 6, 8, 0.3 + 0.5 * k); g.lineWidth = Math.max(1.5, 3 * m / 1080); g.beginPath(); for (const f of [-0.25, 0.02, 0.26]) { const mx = sx + f * L; g.moveTo(mx, sy - L * 0.06); g.lineTo(mx, sy - L * 0.55); g.moveTo(mx - L * 0.1, sy - L * 0.42); g.lineTo(mx + L * 0.1, sy - L * 0.42); g.moveTo(mx, sy - L * 0.55); g.lineTo(mx + L * 0.2, sy - L * 0.07); } g.stroke();
  for (let i = 0; i < 16; i++) { const x = ((hash(i, 1) + t * 0.012 * (0.5 + hash(i, 2))) % 1.4 - 0.2) * W, y = H * (0.4 + 0.4 * hash(i, 3)), r = m * (0.3 + 0.3 * hash(i, 4)); blob(g, x, y, r, [150, 165, 175], 0.13 * (1 - 0.5 * k)); }
  const a = -0.25 + Math.sin(t * 0.4) * 0.35; g.save(); g.globalCompositeOperation = 'lighter'; const ox = -m * 0.05, oy = H * 0.5, bl = W * 1.4, lg = g.createLinearGradient(ox, oy, ox + Math.cos(a) * bl, oy + Math.sin(a) * bl); lg.addColorStop(0, 'rgba(230,240,255,0.12)'); lg.addColorStop(0.7, 'rgba(230,240,255,0.02)'); lg.addColorStop(1, 'rgba(230,240,255,0)'); g.fillStyle = lg;
  g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a - 0.025) * bl, oy + Math.sin(a - 0.025) * bl); g.lineTo(ox + Math.cos(a + 0.025) * bl, oy + Math.sin(a + 0.025) * bl); g.fill(); g.restore();
  vgrad(g, W, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(10,14,18,0.8)']], H * 0.66, H);
}
function sky(g, W, H, t, p) {
  const m = Math.min(W, H); vgrad(g, W, H, [[0, '#010208'], [0.7, '#050c1c'], [1, '#0b1a2a']]); const px = W * 0.5, py = -H * 0.15, rot = t * 0.02;
  for (let i = 0; i < 420; i++) { const r = Math.hypot(W, H) * (0.1 + 1.0 * hash(i, 1)), a = hash(i, 2) * TAU + rot, x = px + Math.cos(a) * r, y = py + Math.sin(a) * r * 0.9; if (x < 0 || x > W || y < 0 || y > H * 0.85) continue; const s = (0.8 + 1.8 * hash(i, 3) ** 3) * m / 1080; g.fillStyle = rgba(210, 225, 255, 0.35 + 0.6 * hash(i, 4)); g.fillRect(x, y, s, s); }
  g.save(); g.globalCompositeOperation = 'lighter'; for (let s = 0; s < 3; s++) for (let i = 0; i < 64; i++) { const u = i / 63, x = W * (-0.1 + 1.2 * u), y = H * (0.18 + 0.12 * s) + Math.sin(u * 5 + t * 0.25 + s * 2) * H * 0.06, hgt = H * (0.25 + 0.1 * Math.sin(u * 9 + t * 0.4 + s));
    const lg = g.createLinearGradient(0, y, 0, y + hgt), c = s === 1 ? [140, 80, 255] : [60, 255, 180]; lg.addColorStop(0, rgba(...c, 0)); lg.addColorStop(0.7, rgba(...c, 0.022 + 0.014 * Math.sin(u * 13 + t))); lg.addColorStop(1, rgba(...c, 0)); g.fillStyle = lg; g.fillRect(x - W / 24, y, W / 12, hgt); } g.restore();
  const dx = W * 0.72, dy = H * 0.86, dr = m * 0.16; g.fillStyle = '#010103'; g.fillRect(0, H * 0.88, W, H * 0.12); g.beginPath(); g.ellipse(dx, dy - dr * 0.6, dr, dr * 0.45, -0.5, 0, Math.PI); g.fill(); g.fillRect(dx - dr * 0.06, dy - dr * 0.6, dr * 0.12, dr * 0.9);
  if ((t % 1.6) < 0.2) blob(g, dx + dr * 0.55, dy - dr * 1.0, m * 0.02, [255, 60, 50], 0.9);
}
function lamp(g, W, H, t, p) {
  const m = Math.min(W, H), a = 0.32 * Math.sin(t * 1.4) * Math.exp(-t * 0.02), ax = W / 2, ay = -m * 0.05, len = H * 0.42, bx = ax + Math.sin(a) * len, by = ay + Math.cos(a) * len; g.fillStyle = '#050403'; g.fillRect(0, 0, W, H);
  const ty = H * 0.78, lx = bx + (bx - ax) * 0.6; const pool = g.createRadialGradient(lx, ty, 0, lx, ty, m * 0.5); pool.addColorStop(0, 'rgba(255,190,120,0.55)'); pool.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = pool; g.beginPath(); g.ellipse(lx, ty, m * 0.62, m * 0.16, 0, 0, TAU); g.fill();
  g.fillStyle = '#1b130c'; g.fillRect(W * 0.18, ty, W * 0.64, m * 0.02); g.fillStyle = 'rgba(0,0,0,0.75)'; const ox = W / 2 + (W / 2 - bx) * 0.9; g.beginPath(); g.ellipse(ox, ty + m * 0.004, m * 0.12, m * 0.02, 0, 0, TAU); g.fill();
  g.fillStyle = '#2a1d12'; g.fillRect(W / 2 - m * 0.05, ty - m * 0.16, m * 0.1, m * 0.16); g.strokeStyle = '#151009'; g.lineWidth = Math.max(1, 2 * m / 1080); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  blob(g, bx, by, m * 0.7, [255, 170, 90], 0.22); blob(g, bx, by, m * 0.12, [255, 220, 170], 0.7); blob(g, bx, by + m * 0.01, m * 0.025, [255, 250, 235], 1);
  for (let i = 0; i < 60; i++) { const x = (hash(i, 1) * W + Math.sin(t * 0.3 + i) * m * 0.02), y = ((hash(i, 2) * H - t * m * 0.01 * (0.3 + hash(i, 3))) % H + H) % H, d = Math.hypot(x - bx, y - by) / m; g.fillStyle = rgba(255, 220, 180, clamp(0.5 - d) * 0.8); g.fillRect(x, y, 2 * m / 1080, 2 * m / 1080); }
}
function road(g, W, H, t, p) {
  const m = Math.min(W, H), vx = W / 2, vy = H * 0.46, sp = p.speed ?? 1.2; vgrad(g, W, H, [[0, '#04060c'], [1, '#0d1420']], 0, vy); g.fillStyle = '#05070a'; g.fillRect(0, vy, W, H - vy);
  g.fillStyle = '#0c0e12'; g.beginPath(); g.moveTo(vx - m * 0.01, vy); g.lineTo(vx + m * 0.01, vy); g.lineTo(vx + W * 0.7, H); g.lineTo(vx - W * 0.7, H); g.fill();
  for (let i = 0; i < 18; i++) { const z = ((i - t * sp) % 18 + 18) % 18 + 0.6, y0 = vy + (H - vy) * (0.6 / z), y1 = vy + (H - vy) * (0.6 / (z + 0.45)), w0 = m * 0.012 / z * 6; g.fillStyle = rgba(230, 220, 180, clamp(1.2 - z / 14) * 0.85); g.beginPath(); g.moveTo(vx - w0, y0); g.lineTo(vx + w0, y0); g.lineTo(vx + w0 * 0.8, y1); g.lineTo(vx - w0 * 0.8, y1); g.fill(); }
  for (let i = 0; i < 24; i++) { const side = i % 2 ? 1 : -1, z = ((i * 0.75 - t * sp) % 18 + 18) % 18 + 0.5, x = vx + side * (W * 0.42) / z * 1.4, y = vy + (H - vy) * (0.6 / z), h = m * 0.9 / z; g.fillStyle = '#010203'; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * 0.25, y); g.lineTo(x - h * 0.25, y); g.fill(); }
  const hk = clamp(((t * 0.18) % 1)), hx = vx + m * 0.03 * (1 + hk), hy = vy + (H - vy) * 0.04 * (1 + hk * 4), hr = m * (0.006 + 0.03 * hk ** 2); for (const s of [-1, 1]) { blob(g, hx + s * hr * 2.2, hy, hr * 6, [255, 240, 210], 0.3); blob(g, hx + s * hr * 2.2, hy, hr, [255, 252, 240], 0.95); }
}
function signal(g, W, H, t, p) {
  const m = Math.min(W, H), y0 = H * 0.5, burst = hash(Math.floor(t * 3), 5) > 0.75; g.fillStyle = '#010305'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(80,200,255,0.07)'; g.lineWidth = 1; for (let i = 0; i < 24; i++) { g.beginPath(); g.moveTo(0, H * i / 24); g.lineTo(W, H * i / 24); g.stroke(); } for (let i = 0; i < 40; i++) { g.beginPath(); g.moveTo(W * i / 40, 0); g.lineTo(W * i / 40, H); g.stroke(); }
  g.save(); g.strokeStyle = 'rgba(140,230,255,0.95)'; g.lineWidth = Math.max(2, 3 * m / 1080); g.shadowColor = 'rgba(80,200,255,1)'; g.shadowBlur = 18 * m / 1080; g.beginPath();
  for (let i = 0; i <= 240; i++) { const u = i / 240, x = u * W, ph = ((u * 2 - t * 0.6) % 1 + 1) % 1, env = Math.exp(-((ph - 0.5) ** 2) / 0.006), y = y0 - m * 0.18 * env * Math.sin(u * 140 - t * 30) - (burst ? (hash(i, Math.floor(t * 30)) - 0.5) * m * 0.05 : 0) + Math.sin(u * 20 + t) * m * 0.004; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.restore(); blob(g, W / 2, y0, m * 0.5, [40, 140, 255], 0.08);
}
function smoke(g, W, H, t, p) {
  const m = Math.min(W, H); g.fillStyle = '#020203'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { const x = (hash(i, 1) + Math.sin(t * 0.08 + i) * 0.04) * W, y = ((hash(i, 2) - t * 0.012 * (0.5 + hash(i, 3))) % 1.3 + 1.3) % 1.3 * H - H * 0.1, r = m * (0.18 + 0.25 * hash(i, 4)); blob(g, x, y, r, [110, 115, 125], 0.05 + 0.06 * hash(i, 5)); }
  if (p.embers) for (let i = 0; i < 50; i++) { const x = (hash(i, 11) * W + Math.sin(t + i) * m * 0.02), y = ((hash(i, 12) * H - t * m * 0.05 * (0.4 + hash(i, 13))) % H + H) % H; blob(g, x, y, m * 0.006, [255, 140, 60], 0.6 * hash(i, Math.floor(t * 8))); }
}
function ink(g, W, H, t, p) {
  const m = Math.min(W, H); vgrad(g, W, H, [[0, '#3a342b'], [1, '#221e18']]);
  for (let i = 0; i < 9; i++) { const t0 = hash(i, 1) * 6, u = clamp((t - t0) / 5); if (u <= 0) continue; const cx = W * (0.15 + 0.7 * hash(i, 2)), cy = H * (0.15 + 0.7 * hash(i, 3)), R = m * (0.12 + 0.2 * hash(i, 4)) * (1 - (1 - u) ** 3);
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + hash(i, k) * 0.5, rr = R * (0.55 + 0.45 * hash(i, k, 7)); blob(g, cx + Math.cos(a) * rr * 0.5, cy + Math.sin(a) * rr * 0.5, rr * 0.7, [2, 2, 4], 0.22); } blob(g, cx, cy, R * 0.6, [0, 0, 0], 0.55); }
}
function beams(g, W, H, t, p) {
  const m = Math.min(W, H); vgrad(g, W, H, [[0, '#0b0907'], [1, '#030202']]); g.save(); g.globalCompositeOperation = 'lighter'; const ox = W * 0.8, oy = -H * 0.1;
  for (let i = 0; i < 6; i++) { const a = Math.PI * (0.62 + 0.06 * i) + Math.sin(t * 0.15 + i) * 0.01, bl = Math.hypot(W, H) * 1.2, lg = g.createLinearGradient(ox, oy, ox + Math.cos(a) * bl, oy + Math.sin(a) * bl); lg.addColorStop(0, 'rgba(255,215,160,0.16)'); lg.addColorStop(1, 'rgba(255,215,160,0)'); g.fillStyle = lg;
    g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a - 0.02) * bl, oy + Math.sin(a - 0.02) * bl); g.lineTo(ox + Math.cos(a + 0.02) * bl, oy + Math.sin(a + 0.02) * bl); g.fill(); } g.restore();
  for (let i = 0; i < 120; i++) { const x = (hash(i, 1) * W + Math.sin(t * 0.2 + i) * m * 0.03), y = ((hash(i, 2) * H + t * m * 0.006 * (hash(i, 3) - 0.3)) % H + H) % H; g.fillStyle = rgba(255, 230, 190, 0.25 + 0.4 * hash(i, Math.floor(t * 4))); g.fillRect(x, y, 2 * m / 1080, 2 * m / 1080); }
}

export const PLATES = { coast, radio, corridor, window: windowP, storm, ship, sky, lamp, road, signal, smoke, ink, beams };
export const PLATE_KINDS = Object.keys(PLATES);
export const PLATE_LABELS = { coast: 'coast at night', radio: 'radio close-up', corridor: 'corridor', window: 'rain window', storm: 'storm', ship: 'ship in fog', sky: 'night sky', lamp: 'swinging lamp',
  road: 'night road', signal: 'the signal', smoke: 'smoke texture', ink: 'ink texture', beams: 'light beams' };
export function drawPlate(g, kind, W, H, t, params = {}) {
  const f = PLATES[kind]; if (!f) throw new Error('unknown plate ' + kind + ' (templates/_shared/film/plates.js PLATE_KINDS)');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0; f(g, W, H, Math.max(0, t), params || {}); g.restore();
}
