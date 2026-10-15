/* motion-pack / templates/_shared/human/plates.mjs: PROCEDURAL, LABELLED placeholder plates for human-led templates (node + browser; SVG strings, pure functions of t).
   They stand in for footage the user has not supplied yet, and say so in frame. They never imitate a person, a voice, a real app or a real operating system:
     speakerPlate   a flat silhouette (head and shoulders, no face) labelled SPEAKER PLACEHOLDER, a level ring that follows the word timings (not a mouth)
     desktopPlate   a fake desktop recording drawn in SVG for a FICTIONAL app ("Orbit Notes"), labelled PLACEHOLDER RECORDING; its state replays plan events
                    (typing, file select, a toggle, terminal lines) so a tutorial can be built and timed before the real recording exists
     photoPlate     a still placeholder (abstract hills and a sun) labelled YOUR PHOTO HERE
     brollPlate     a moving placeholder (drifting stripes) labelled YOUR B-ROLL HERE with the shot the user should film
     slidePlate     a lesson slide drawn from CONFIG text (the user's own copy: no label needed); bullets reveal on plan times
   DESKTOP_TARGETS gives the click targets of the fake desktop as screen fractions, so a tutorial's clicks can name a target instead of guessing pixels. */
const f2 = (v) => (Math.round(v * 100) / 100).toString(), clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FONT = "Manrope, 'Helvetica Neue', Arial, sans-serif", MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
const T = (s, x, y, { size = 30, weight = 700, fill = '#111', anchor = 'start', font = FONT, op = 1, ls = 0 } = {}) => `<text x="${f2(x)}" y="${f2(y)}" font-family="${esc(font)}" font-size="${f2(size)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${op < 1 ? ` opacity="${f2(op)}"` : ''}${ls ? ` letter-spacing="${f2(ls)}"` : ''} xml:space="preserve">${esc(s)}</text>`;
const R = (x, y, w, h, r, fill, extra = '') => `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(Math.max(0, w))}" height="${f2(Math.max(0, h))}" rx="${f2(r)}" fill="${fill}" ${extra}/>`;
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 1597334677)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const svg = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
/* a label chip that reads at phone size: >= 30 px at 1080 on the shorter side */
function chip(w, h, title, sub, { pos = 'tl', dark = true } = {}) {
  if (Math.min(w, h) < 560) {   /* a small slot (a PiP): one centred two-line label near the bottom, sized to the slot so it is never clipped */
    const ts = Math.max(18, w * 0.075), ss = Math.max(13, w * 0.05), cy = h * 0.8;
    return R(w * 0.14, cy - ts * 1.2, w * 0.72, ts * 1.2 + ss * 1.7, ts * 0.4, 'rgba(10,10,14,0.78)') + T(title, w / 2, cy - ts * 0.12, { size: ts, weight: 800, fill: '#FFFFFF', anchor: 'middle', ls: 1 }) + T(sub, w / 2, cy + ss * 1.1, { size: ss, weight: 600, fill: 'rgba(255,255,255,0.8)', anchor: 'middle', font: MONO });
  }
  const S = Math.min(w, h) / 1080, ts = Math.max(30, 34 * S), ss = Math.max(22, 24 * S), cw = Math.max(title.length * ts * 0.66, sub.length * ss * 0.6) + 48 * S, ch = ts + ss + 44 * S;
  const x = pos.includes('r') ? w - cw - 36 * S : 36 * S, y = pos.startsWith('b') ? h - ch - 36 * S : 36 * S;
  return R(x, y, cw, ch, 14 * S, dark ? 'rgba(10,10,14,0.78)' : 'rgba(255,255,255,0.86)') + T(title, x + 24 * S, y + 18 * S + ts * 0.85, { size: ts, weight: 800, fill: dark ? '#FFFFFF' : '#111', ls: 1.5 * S }) +
    T(sub, x + 24 * S, y + 28 * S + ts + ss * 0.8, { size: ss, weight: 600, fill: dark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.65)', font: MONO });
}

/* speaker placeholder: w x h slot, level 0..1 (from the word timings), tint, name; t drives a slow light drift and a breath-like sway so frame 0 is already moving */
export function speakerPlate(t, { w = 1920, h = 1080, level = 0, tint = '#2B3A4A', name = '', slot = 'speaker', seed = 1, active = 1, label = 'SPEAKER PLACEHOLDER' } = {}) {
  const S = Math.min(w, h) / 1080, cx = w * 0.5, base = h * 1.02, hr = Math.min(w * 0.17, h * 0.2), sway = Math.sin(t * 0.9 + seed) * 0.8, bob = Math.sin(t * 1.3 + seed * 2) * 3 * S;
  let g = `<defs><radialGradient id="sg${seed}" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${tint}" stop-opacity="1"/><stop offset="1" stop-color="#0B0D12"/></radialGradient></defs>` + `<rect width="${w}" height="${h}" fill="url(#sg${seed})"/>`;
  for (let i = 0; i < 7; i++) { const x = ((hash(seed, i) + t * 0.012 * (0.5 + hash(seed, i + 9))) % 1) * w, y = hash(seed, i + 20) * h * 0.7, r = (60 + hash(seed, i + 40) * 140) * S; g += `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}" fill="#FFFFFF" opacity="${f2(0.035 + 0.03 * hash(seed, i + 60))}"/>`; }
  const hy = base - hr * 3.05 + bob, ring = hr * (1.18 + 0.1 * level), body = `M${f2(cx - hr * 2.3)} ${f2(base)} C${f2(cx - hr * 2.2)} ${f2(hy + hr * 1.7)} ${f2(cx - hr * 1.0)} ${f2(hy + hr * 1.25)} ${f2(cx)} ${f2(hy + hr * 1.25)} C${f2(cx + hr * 1.0)} ${f2(hy + hr * 1.25)} ${f2(cx + hr * 2.2)} ${f2(hy + hr * 1.7)} ${f2(cx + hr * 2.3)} ${f2(base)} Z`;
  g += `<g transform="rotate(${f2(sway)} ${f2(cx)} ${f2(base)})" opacity="${f2(0.55 + 0.45 * active)}"><path d="${body}" fill="#5A6472"/><rect x="${f2(cx - hr * 0.38)}" y="${f2(hy + hr * 0.7)}" width="${f2(hr * 0.76)}" height="${f2(hr * 0.75)}" fill="#5A6472"/>`;
  g += `<ellipse cx="${f2(cx)}" cy="${f2(hy)}" rx="${f2(hr * 0.86)}" ry="${f2(hr)}" fill="#6B7584"/>`;
  g += `<circle cx="${f2(cx)}" cy="${f2(hy)}" r="${f2(ring)}" fill="none" stroke="#FFFFFF" stroke-width="${f2(5 * S)}" opacity="${f2(0.1 + 0.6 * level)}"/></g>`;
  return svg(w, h, g + chip(w, h, label, Math.min(w, h) < 560 ? 'placeholder' : `set media.${slot}.src${name ? ' · ' + name : ''}`));
}

/* ---------- fake desktop recording (1920 x 1080 screen space) ---------- */
export const DESKTOP = { W: 1920, H: 1080, win: [120, 92, 1680, 916], side: 300, preview: 540, term: 170, bar: 56 };
const WX = DESKTOP.win[0], WY = DESKTOP.win[1], WW = DESKTOP.win[2], WH = DESKTOP.win[3];
const EDX = WX + DESKTOP.side, EDW = WW - DESKTOP.side - DESKTOP.preview, PVX = EDX + EDW, BODY_Y = WY + DESKTOP.bar, TERM_Y = WY + WH - DESKTOP.term;
export const FILES = ['index.js', 'theme.js', 'settings.js', 'notes.md'];
const fx = (x) => +(x / 1920).toFixed(4), fy = (y) => +(y / 1080).toFixed(4);
export const DESKTOP_TARGETS = {
  ...Object.fromEntries(FILES.map((f, i) => ['file:' + f, [fx(WX + 40 + 110), fy(BODY_Y + 96 + i * 62 + 18)]])),
  toggle: [fx(PVX + DESKTOP.preview - 110), fy(BODY_Y + 121)], run: [fx(PVX + DESKTOP.preview - 120), fy(TERM_Y + 52)],
  editor: [fx(EDX + 300), fy(BODY_Y + 260)], line: (n) => [fx(EDX + 420), fy(BODY_Y + 46 + (n - 1) * 44)],
};
/* boxes [x, y, w, h] (screen fractions) of the same regions, for highlight boxes, spotlights and the result reveal */
const bx = (x, y, w, h) => [fx(x), fy(y), fx(w), fy(h)];
export const DESKTOP_BOXES = {
  ...Object.fromEntries(FILES.map((f, i) => ['file:' + f, bx(WX + 14, BODY_Y + 96 + i * 62 - 10, DESKTOP.side - 28, 56)])),
  toggle: bx(PVX + DESKTOP.preview - 162, BODY_Y + 88, 104, 66), run: bx(PVX + DESKTOP.preview - 200, TERM_Y + 16, 170, 72),
  preview: bx(PVX + 6, BODY_Y + 6, DESKTOP.preview - 12, TERM_Y - BODY_Y - 12), editor: bx(EDX, BODY_Y, EDW, TERM_Y - BODY_Y), terminal: bx(EDX, TERM_Y, WW - DESKTOP.side, DESKTOP.term),
};
/* state = replay of events up to t: { kind: 'file', file } | { kind: 'type', line, text, cps } | { kind: 'toggle', on } | { kind: 'term', text } | { kind: 'code', lines } */
export function desktopState(events, t, base = {}) {
  const st = { file: base.file || 'settings.js', lines: [...(base.lines || [])], dark: !!base.dark, term: [...(base.term || [])], caret: null, typing: false };
  for (const e of events || []) { if (t < e.t) break;
    if (e.kind === 'file') st.file = e.file; else if (e.kind === 'code') st.lines = [...e.lines]; else if (e.kind === 'toggle') st.dark = !!e.on; else if (e.kind === 'term') st.term.push(e.text);
    else if (e.kind === 'type') { const n = Math.min(e.text.length, Math.floor((t - e.t) * (e.cps || 18))); while (st.lines.length < e.line) st.lines.push(''); st.lines[e.line - 1] = (e.prefix ?? st.lines[e.line - 1] ?? '') + e.text.slice(0, n); if (n < e.text.length) { st.caret = [e.line, st.lines[e.line - 1].length]; st.typing = true; } } }
  return st;
}
const KW = /^(const|let|function|return|if|else|import|from|export|true|false|new)$/;
function codeLine(s, x, y, size, dark) { let cx = x, out = `<text x="${f2(x)}" y="${f2(y)}" font-family="${esc(MONO)}" font-size="${size}" font-weight="600" xml:space="preserve">`; const cw = size * 0.6;
  for (const m of String(s).matchAll(/(\/\/.*$)|('[^']*'|"[^"]*")|([A-Za-z_]\w*)|(\s+)|(.)/g)) { const tok = m[0], col = m[1] ? '#8C8A93' : m[2] ? (dark ? '#8FE3B0' : '#0F7A45') : m[3] && KW.test(m[3]) ? (dark ? '#B9A6FF' : '#4A18ED') : dark ? '#E7E5E0' : '#1B1A22'; out += `<tspan x="${f2(cx)}" fill="${col}">${esc(tok)}</tspan>`; cx += tok.length * cw; }
  return out + '</text>'; }
export function desktopPlate(t, { events = [], base = {}, label = 'PLACEHOLDER RECORDING', slot = 'screen', app = 'Orbit Notes', accent = '#4A18ED', chipPos = 'tr', chip: showChip = true } = {}) {
  const st = desktopState(events, t, base), D = st.dark, ui = D ? '#1E1E26' : '#FFFFFF', ui2 = D ? '#262631' : '#F3F1EC', ink = D ? '#ECEAF2' : '#1B1A22', mute = D ? '#9A98A6' : '#77736B', line = D ? '#33333F' : '#E2DED5';
  let g = `<defs><linearGradient id="wp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9D3C7"/><stop offset="1" stop-color="#B9C2C9"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#wp)"/>`;
  g += `<circle cx="${f2(1600 + Math.sin(t * 0.2) * 20)}" cy="180" r="260" fill="#FFFFFF" opacity="0.18"/>`;
  g += R(0, 0, 1920, 40, 0, 'rgba(255,255,255,0.72)') + T(app, 24, 28, { size: 20, weight: 800 }) + T('File   Edit   View', 180, 28, { size: 18, weight: 600, fill: '#555' });
  g += R(WX, WY, WW, WH, 14, ui, `stroke="${line}" stroke-width="2"`) + R(WX, WY, WW, DESKTOP.bar, 14, ui2) + R(WX, WY + DESKTOP.bar - 14, WW, 14, 0, ui2);
  for (let i = 0; i < 3; i++) g += R(WX + 22 + i * 30, WY + 20, 16, 16, 4, mute, 'opacity="0.6"');
  g += T(`${app} · ${st.file}`, WX + WW / 2, WY + 36, { size: 22, weight: 700, fill: mute, anchor: 'middle' });
  /* sidebar */
  g += R(WX, BODY_Y, DESKTOP.side, WH - DESKTOP.bar, 0, ui2) + T('FILES', WX + 32, BODY_Y + 56, { size: 18, weight: 700, fill: mute, font: MONO, ls: 2 });
  FILES.forEach((f, i) => { const y = BODY_Y + 96 + i * 62, on = f === st.file; if (on) g += R(WX + 16, y - 8, DESKTOP.side - 32, 52, 10, accent, 'opacity="0.16"'); g += R(WX + 36, y + 6, 22, 26, 4, on ? accent : mute, 'opacity="0.7"') + T(f, WX + 72, y + 28, { size: 24, weight: on ? 800 : 600, fill: on ? ink : mute }); });
  /* editor */
  g += R(EDX, BODY_Y, EDW, TERM_Y - BODY_Y, 0, D ? '#16161D' : '#FCFBF8');
  st.lines.slice(0, 15).forEach((ln, i) => { const y = BODY_Y + 46 + i * 44; g += T(String(i + 1), EDX + 56, y, { size: 22, weight: 600, fill: mute, anchor: 'end', font: MONO }) + codeLine(ln, EDX + 84, y, 24, D); });
  if (st.caret && Math.floor(t * 2.5) % 2 === 0) { const [l, c] = st.caret; g += R(EDX + 84 + c * 14.4, BODY_Y + 46 + (l - 1) * 44 - 24, 3, 30, 1, accent); }
  /* preview with the toggle */
  g += R(PVX, BODY_Y, DESKTOP.preview, TERM_Y - BODY_Y, 0, D ? '#101015' : '#F7F5F0') + `<line x1="${PVX}" y1="${BODY_Y}" x2="${PVX}" y2="${TERM_Y}" stroke="${line}" stroke-width="2"/>`;
  g += T('Preview', PVX + 36, BODY_Y + 56, { size: 22, weight: 800, fill: mute }) + T('Dark mode', PVX + 36, BODY_Y + 128, { size: 26, weight: 700, fill: ink });
  const tx = PVX + DESKTOP.preview - 150, ty = BODY_Y + 100; g += R(tx, ty, 80, 42, 21, D ? accent : '#CFCAC0') + `<circle cx="${f2(tx + (D ? 59 : 21))}" cy="${f2(ty + 21)}" r="16" fill="#FFFFFF"/>`;
  const card = (y, w) => R(PVX + 36, y, w, 18, 9, D ? '#3A3A48' : '#DCD7CC');
  g += R(PVX + 24, BODY_Y + 180, DESKTOP.preview - 48, 300, 16, D ? '#1C1C25' : '#FFFFFF', `stroke="${line}" stroke-width="2"`) + T('Today', PVX + 52, BODY_Y + 236, { size: 30, weight: 800, fill: ink });
  for (let i = 0; i < 5; i++) g += card(BODY_Y + 270 + i * 38, [380, 300, 420, 260, 340][i]);
  /* terminal */
  g += R(EDX, TERM_Y, WW - DESKTOP.side, DESKTOP.term, 0, '#121218') + T('TERMINAL', EDX + 30, TERM_Y + 36, { size: 16, weight: 700, fill: '#77737F', font: MONO, ls: 2 });
  g += R(PVX + DESKTOP.preview - 190, TERM_Y + 26, 150, 52, 12, accent) + T('Run', PVX + DESKTOP.preview - 115, TERM_Y + 60, { size: 24, weight: 800, fill: '#FFFFFF', anchor: 'middle' });
  st.term.slice(-3).forEach((l, i) => { g += T(l, EDX + 30, TERM_Y + 76 + i * 30, { size: 22, weight: 600, fill: '#D6D3DE', font: MONO }); });
  return svg(1920, 1080, g + (showChip ? chip(1920, 1080, label, `fictional app · set media.${slot}.src`, { pos: chipPos }) : ''));
}

export function photoPlate(t, { w = 1600, h = 1200, label = 'YOUR PHOTO HERE', what = '', slot = 'photo', seed = 1, tint = '#C9B79C', chip: showChip = true } = {}) {
  const S = Math.min(w, h) / 1080; let g = `<rect width="${w}" height="${h}" fill="${tint}"/>`;
  g += `<circle cx="${f2(w * (0.66 + 0.1 * hash(seed, 1)))}" cy="${f2(h * 0.32)}" r="${f2(h * 0.12)}" fill="#F4E9D2" opacity="0.9"/>`;
  for (let k = 0; k < 3; k++) { const y0 = h * (0.55 + k * 0.12), a = 40 + 60 * hash(seed, k + 3); let d = `M0 ${f2(h)} L0 ${f2(y0)}`; for (let i = 1; i <= 8; i++) d += ` L${f2((w * i) / 8)} ${f2(y0 - Math.sin(i * 0.9 + seed + k) * a * S)}`; g += `<path d="${d} L${w} ${f2(h)} Z" fill="#000" opacity="${f2(0.12 + 0.1 * k)}"/>`; }
  return svg(w, h, g + (showChip ? chip(w, h, label, what ? what : `set media.${slot}.src`, { pos: 'bl' }) : ''));
}
export function brollPlate(t, { w = 1920, h = 1080, label = 'YOUR B-ROLL HERE', what = '', slot = 'broll', seed = 1, tint = '#3E4A3C' } = {}) {
  const S = Math.min(w, h) / 1080, step = 120 * S, off = (t * 60 * S) % step; let g = `<rect width="${w}" height="${h}" fill="${tint}"/>`;
  for (let x = -h - step; x < w + step; x += step) g += `<path d="M${f2(x + off)} 0 L${f2(x + off + h)} ${h}" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="${f2(44 * S)}"/>`;
  g += T(what || 'the shot you will film', w / 2, h / 2 + 20 * S, { size: Math.max(40, 64 * S), weight: 800, fill: '#FFFFFF', anchor: 'middle', op: 0.92 });
  return svg(w, h, g + chip(w, h, label, `set media.${slot}.src`, { pos: 'tl' }));
}
/* lesson slide from the user's own text. reveal: bullet i appears at at[i] (s, slide-local) */
export function slidePlate(t, { w = 1920, h = 1080, title = '', bullets = [], at = [], kicker = '', accent = '#4A18ED', paper = '#FBFAF7', ink = '#16151B' } = {}) {
  const S = Math.min(w, h) / 1080, tall = h > w, pad = (tall ? 80 : 130) * S, ts = (tall ? 88 : 84) * S, bs = (tall ? 54 : 48) * S;
  let g = `<rect width="${w}" height="${h}" fill="${paper}"/>` + R(pad, pad, 90 * S, 12 * S, 6 * S, accent);
  if (kicker) g += T(kicker.toUpperCase(), pad, pad + 70 * S, { size: 28 * S, weight: 700, fill: accent, font: MONO, ls: 2 * S });
  const words = String(title).split(/\s+/), lines = []; let cur = ''; const maxC = Math.floor((w - 2 * pad) / (ts * 0.56));
  for (const wd of words) { if ((cur + ' ' + wd).trim().length > maxC && cur) { lines.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); } if (cur) lines.push(cur);
  lines.slice(0, 3).forEach((l, i) => { g += T(l, pad, pad + 150 * S + i * ts * 1.1, { size: ts, weight: 800, fill: ink }); });
  const by = pad + 150 * S + Math.min(3, lines.length) * ts * 1.1 + 50 * S;
  bullets.slice(0, 6).forEach((b, i) => { const k = seg(t, at[i] ?? 0, (at[i] ?? 0) + 0.35), e = 1 - (1 - k) ** 3, y = by + i * bs * 1.9;
    g += `<g opacity="${f2(k)}" transform="translate(${f2((1 - e) * 30 * S)} 0)"><circle cx="${f2(pad + 14 * S)}" cy="${f2(y - bs * 0.32)}" r="${f2(10 * S)}" fill="${accent}"/>` + T(b, pad + 52 * S, y, { size: bs, weight: 600, fill: ink }) + '</g>'; });
  return svg(w, h, g);
}
/* speaking level 0..1 from word intervals [[s, e], ...] (output seconds): rises 60 ms before a word, holds, decays over ~120 ms; a small flutter while speaking. Pure. */
export function speakingLevel(iv, t) { let v = 0; for (const [s, e] of iv || []) { if (t < s - 0.06 || t > e + 0.6) continue; const k = t < s ? (t - (s - 0.06)) / 0.06 : t <= e ? 0.82 + 0.18 * Math.sin(t * 23 + s * 7) : Math.exp(-(t - e) / 0.12); if (k > v) v = k; } return clamp(v); }
