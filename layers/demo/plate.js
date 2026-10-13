/* motion-pack / layers / demo / plate.js: a procedural test plate (owned, no assets): backdrop gradient, skin ramp, primaries, grey ramp, hot lights (bloom / halation),
   a product card with type, and a sweeping highlight bar so motion is visible. Deterministic from t. Used by the demos and the tests. */
const skin = ['#F6D5BE', '#E8B896', '#C98C62', '#A56A45', '#7A4A30', '#4E2E1F'];
const prim = ['#E5322D', '#2FA84F', '#2A56D6', '#18B6C9', '#D6329E', '#F2C318'];
export function drawPlate(g, W, H, t = 0, { mood = 'day', type = true } = {}) {
  const tall = H > W, S = H / 1080, u = Math.min(W, H);
  const bg = g.createLinearGradient(0, 0, 0, H);
  if (mood === 'night') { bg.addColorStop(0, '#0a1230'); bg.addColorStop(0.6, '#17224d'); bg.addColorStop(1, '#2a1a3c'); } else { bg.addColorStop(0, '#5c6f8f'); bg.addColorStop(0.55, '#a9b4c4'); bg.addColorStop(1, '#d9c9b6'); }
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  /* window (hot highlight) + lamps */
  const wx = tall ? W * 0.08 : W * 0.06, wy = tall ? H * 0.06 : H * 0.08, ww = tall ? W * 0.36 : W * 0.20, wh = tall ? H * 0.14 : H * 0.34;
  g.fillStyle = '#fff6e3'; g.fillRect(wx, wy, ww, wh); g.fillStyle = 'rgba(30,40,60,.35)'; g.fillRect(wx + ww / 2 - 3 * S, wy, 6 * S, wh); g.fillRect(wx, wy + wh / 2 - 3 * S, ww, 6 * S);
  const lamps = tall ? [[0.72, 0.09], [0.86, 0.13], [0.62, 0.17]] : [[0.78, 0.14], [0.88, 0.22], [0.70, 0.10]];
  lamps.forEach(([x, y], i) => { const r = (14 + i * 6) * S * (tall ? 1.2 : 1); const gr = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#fff3d0'); gr.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x * W, y * H, r, 0, 7); g.fill(); });
  /* product card */
  const cw = tall ? W * 0.78 : W * 0.34, ch = tall ? H * 0.26 : H * 0.36, cx = tall ? W * 0.11 : W * 0.60, cy = tall ? H * 0.28 : H * 0.34, rad = 28 * S;
  g.fillStyle = '#f7f5ef'; g.beginPath(); g.roundRect(cx, cy, cw, ch, rad); g.fill();
  g.fillStyle = '#4a18ed'; g.beginPath(); g.roundRect(cx + 22 * S, cy + 22 * S, cw * 0.2, cw * 0.2, 18 * S); g.fill();
  if (type) { g.fillStyle = '#111'; g.font = `800 ${(tall ? 64 : 52) * S}px Helvetica, Arial, sans-serif`; g.textBaseline = 'alphabetic'; g.fillText('Voice that sells', cx + 32 * S + cw * 0.2, cy + 70 * S); g.fillStyle = '#6b665c'; g.font = `500 ${(tall ? 34 : 28) * S}px Helvetica, Arial, sans-serif`; g.fillText('Plate for finishing tests', cx + 32 * S + cw * 0.2, cy + 118 * S); }
  g.fillStyle = '#e8e4da'; g.fillRect(cx + 22 * S, cy + ch - 70 * S, cw - 44 * S, 14 * S); g.fillStyle = '#4a18ed'; g.fillRect(cx + 22 * S, cy + ch - 70 * S, (cw - 44 * S) * (0.35 + 0.1 * Math.sin(t * 2)), 14 * S);
  /* skin ramp */
  const sw = (tall ? W * 0.86 : W * 0.5) / skin.length, sx = tall ? W * 0.07 : W * 0.06, sy = tall ? H * 0.58 : H * 0.62, sh = tall ? H * 0.07 : H * 0.12;
  skin.forEach((c, i) => { g.fillStyle = c; g.fillRect(sx + i * sw, sy, sw, sh); });
  /* primaries */
  const py = sy + sh + 12 * S; prim.forEach((c, i) => { g.fillStyle = c; g.fillRect(sx + i * sw, py, sw, sh * 0.8); });
  /* grey ramp */
  const gy = py + sh * 0.8 + 12 * S, gw = (tall ? W * 0.86 : W * 0.5) / 10; for (let i = 0; i < 10; i++) { const v = Math.round(255 * i / 9); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(sx + i * gw, gy, gw, sh * 0.8); }
  /* sweeping highlight bar + a mid-grey flat patch (for grain sigma) */
  const bx = ((t * 0.18) % 1.4 - 0.2) * W; const lg = g.createLinearGradient(bx - 60 * S, 0, bx + 60 * S, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(bx - 60 * S, H * 0.04, 120 * S, H * 0.9);
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(W - u * 0.18, H - u * 0.18, u * 0.14, u * 0.14);
}
export const flatGrey = (g, W, H, v = 128) => { g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, 0, W, H); };
/* 9x9x9 colour chart: 729 patches (levels 0,32,...,255) on a 27x27 grid; returns the patch centres + their exact 8-bit RGB. For grade-parity tests. */
export const CHART_LEVELS = [0, 32, 64, 96, 128, 160, 192, 224, 255];
export function drawChart(g, W, H) {
  const cw = W / 27, ch = H / 27, list = []; let k = 0;
  for (const r of CHART_LEVELS) for (const gg of CHART_LEVELS) for (const b of CHART_LEVELS) { const x = (k % 27) * cw, y = Math.floor(k / 27) * ch; g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(x, y, cw + 1, ch + 1); list.push({ cx: Math.round(x + cw / 2), cy: Math.round(y + ch / 2), rgb: [r, gg, b] }); k++; }
  return list;
}
