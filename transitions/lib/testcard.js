/* motion-pack / transitions / lib / testcard.js
   Two deterministic procedural "shots" for demos and tests (owned, no media). paint(ctx, t, W, H) is a pure function
   of t with period 2 s, so demo loops are seamless. Shot A = violet studio with a disc (match anchor 0.36,0.55,
   size 0.32); shot B = warm set with a clock ring (anchor 0.64,0.45, size 0.40). Both carry fine detail (grid,
   stripes, text) so blur, displacement and sorting are visible. */
const TAU = Math.PI * 2;
const FONT = '800 {s}px Helvetica Neue, Helvetica, Arial, sans-serif';

export function paintA(g, t, W, H) {
  const u = (t % 2) / 2, ph = TAU * u, m = Math.min(W, H);
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#12062f'); bg.addColorStop(0.6, '#2a0f8a'); bg.addColorStop(1, '#4A18ED');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.16)';                                         // dot grid drifting right, period 2 s
  const step = m / 14, off = u * step;
  for (let y = step / 2; y < H; y += step) for (let x = -step + off; x < W + step; x += step) { g.beginPath(); g.arc(x, y, m * 0.004, 0, TAU); g.fill(); }
  const cx = 0.36 * W + Math.sin(ph) * 0.015 * W, cy = 0.55 * H, r = 0.16 * H * (1 + 0.03 * Math.sin(2 * ph));
  const disc = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  disc.addColorStop(0, '#fff6d8'); disc.addColorStop(0.45, '#ffb15a'); disc.addColorStop(1, '#ff3d7f');
  g.fillStyle = disc; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; const bx = ((u * 1.0) % 1) * W; g.fillRect(bx - m * 0.05, H * 0.86, m * 0.1, m * 0.012);   // sweeping bar (speed reference)
  g.fillStyle = '#ffffff'; g.font = FONT.replace('{s}', Math.round(m * 0.075)); g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillText('SHOT A', W * 0.06, H * 0.07);
  g.font = FONT.replace('{s}', Math.round(m * 0.032)).replace('800', '500'); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText('motion-pack test card', W * 0.06, H * 0.07 + m * 0.09);
}

export function paintB(g, t, W, H) {
  const u = (t % 2) / 2, ph = TAU * u, m = Math.min(W, H);
  const bg = g.createLinearGradient(W, 0, 0, H); bg.addColorStop(0, '#ffd27a'); bg.addColorStop(0.5, '#ff7a1a'); bg.addColorStop(1, '#c2185b');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.18; g.strokeStyle = '#3b0a1e'; g.lineWidth = m * 0.02;              // diagonal stripes moving, period 2 s
  const sp = m * 0.09, o = u * sp * 2;
  for (let k = -H / sp - 4; k < (W + H) / sp + 4; k++) { const x = k * sp + o; g.beginPath(); g.moveTo(x, 0); g.lineTo(x - H, H); g.stroke(); }
  g.restore();
  const cx = 0.64 * W, cy = 0.45 * H, r = 0.2 * H;
  g.fillStyle = 'rgba(20,6,40,0.85)'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.12; g.beginPath(); g.arc(cx, cy, r * 0.9, 0, TAU); g.stroke();
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.lineWidth = r * 0.04; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62); g.lineTo(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74); g.stroke(); }
  const ha = ph - Math.PI / 2; g.strokeStyle = '#ffd27a'; g.lineWidth = r * 0.07; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ha) * r * 0.58, cy + Math.sin(ha) * r * 0.58); g.stroke();
  g.fillStyle = '#ffffff'; g.font = FONT.replace('{s}', Math.round(m * 0.075)); g.textAlign = 'right'; g.textBaseline = 'bottom';
  g.fillText('SHOT B', W * 0.94, H * 0.93);
}

/** Optional overlay strip: a rate curve with a playhead (used by the speed-ramp demo). */
export function paintCurve(g, W, H, rateAt, t0, t1, tNow, maxRate = 2) {
  const x0 = W * 0.06, x1 = W * 0.94, y0 = H * 0.95, h = H * 0.12;
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x0 - 8, y0 - h - 8, x1 - x0 + 16, h + 16);
  g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(2, H * 0.004); g.beginPath();
  for (let i = 0; i <= 200; i++) { const t = t0 + (t1 - t0) * i / 200, x = x0 + (x1 - x0) * i / 200, y = y0 - h * Math.min(1, rateAt(t) / maxRate); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); const px = x0 + (x1 - x0) * (tNow - t0) / (t1 - t0);
  g.fillStyle = '#4A18ED'; g.fillRect(px - 2, y0 - h, 4, h);
}
