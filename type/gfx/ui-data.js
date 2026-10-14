/* motion-pack / type / gfx / ui-data.js: UI kit round 3 (2026-10-14), data and voice pieces. Same contract as ui.js (svg(L, p, ctx) -> SVG, a pure function of t,
   closed-form springs from ../ease.js, `scale` / `theme` / `accent` on every item, uiCues for one sound per UI action). Generic layouts of our own; demo copy is for a
   fictional "Acme Voice". Every number these pieces print is ILLUSTRATIVE and carries a `source` label (printed in the frame) - replace it with real logs and cite.
     ui.liveTranscript  glass transcript panel: speaker turns stream in word by word, per-turn latency badge, AI-voice label, tag chips, optional mini waveform, auto-scroll
     ui.wordRegenerate  sentence card over a word-keyed waveform: one word is selected, Regenerate is clicked, the word is re-typed in the accent and only its segment redraws
     ui.receiptCompare  2-3 option cards with line items; fees tick in red on one card while the other total stays flat; optional error chip (e.g. 429)
     ui.failoverRoute   hub-and-spoke routing: request packets flow along lit connectors; one provider goes down, packets hold at the hub, then re-route to the next node
     ui.fileChip        file chip (type tile, name, size) with a Download button: cursor click -> progress -> check -> "Open" */
import { E, clamp, lerp, seg, TAU, FONT, BRAND, f2, text, hashf, measure } from './core.js';
import { springTrack, spring } from '../ease.js';
import { KIT, rr, TICKS } from './ui.js'; import { wrapIndex } from './safe.js';
const { th, GREEN, AMBER, bx, uid, op, rect, shadowDef, softShadow, icon, spinner, checkBadge, cursorSvg, ripple, pressAt, typed } = KIT;
const RED = '#E5484D';
const fade = (L) => op(clamp(L.in * 1.5) * (1 - L.out));
/* word wrap on measured widths (canvas in the browser, an estimate in node): [[word, ...], ...] */
export function wrapWords(str, size, weight, maxW) { const lines = []; let cur = [];
  for (const w of String(str).split(/\s+/).filter(Boolean)) { if (cur.length && measure([...cur, w].join(' '), size, { weight }) > maxW) { lines.push(cur); cur = [w]; } else cur.push(w); }
  if (cur.length) lines.push(cur); return lines; }
const pill = (x, y, w, h, fill, extra = '') => rect(x, y, w, h, h / 2, fill, extra);
const money = (v, cur) => cur + v.toFixed(2);
/* small live waveform: n bars, amplitude env 0..1, pure function of u (seeded phases) */
function miniWave(x, cy, w, hMax, u, env, color, seed, n = 18) { const bw = w / n; let o = '';
  for (let j = 0; j < n; j++) { const a = 0.18 + 0.82 * env * (0.5 + 0.5 * Math.sin(TAU * (2.1 + 3.3 * hashf(seed, j)) * u + TAU * hashf(j, seed, 7))) * (0.55 + 0.45 * Math.sin(Math.PI * (j + 0.5) / n)), bh = Math.max(bw * 0.5, hMax * a);
    o += rect(x + j * bw + bw * 0.2, cy - bh / 2, bw * 0.6, bh, bw * 0.3, color); } return o; }

/* ---------- 1. live transcript ---------- */
const TURNS = [{ speaker: 'Caller', text: 'Hi, can I move my delivery to Friday?', at: 0.3 },
  { speaker: 'Acme Voice', ai: true, text: 'Of course. Friday morning or afternoon?', at: 1.75, latency: 0.34, tags: ['Booking'] },
  { speaker: 'Caller', text: 'Morning, please.', at: 3.25 },
  { speaker: 'Acme Voice', ai: true, text: 'Done. A text with the new slot is on its way.', at: 4.0, latency: 0.31, tags: ['Calendar', 'SMS'] }];
function transcriptLayout(p, s, iw) { let y = 0; return p.turns.map((tn) => { const lines = wrapWords(tn.text, 27 * s, 600, iw), words = lines.flat().length, hd = 38 * s, lh = 37 * s, tg = tn.tags?.length ? 46 * s : 0;
  const end = tn.at + words / p.wps, b = { y, lines, words, end, h: hd + lines.length * lh + tg + 26 * s }; y += b.h; return b; }); }
/* ---------- 2. word regenerate ---------- */
const regenTimes = (p) => { const old = String(p.words.split(/\s+/)[p.target]), delEnd = p.replaceAt + old.length / (p.cps * 2.5), typeEnd = delEnd + String(p.replacement).length / p.cps; return { old, delEnd, typeEnd, playAt: p.playAt ?? typeEnd + 0.45 }; };
function regenWord(p, u) { const { old, delEnd } = regenTimes(p); if (u < p.replaceAt) return { str: old, phase: 'old' };
  if (u < delEnd) return { str: old.slice(0, Math.max(0, old.length - Math.floor((u - p.replaceAt) * p.cps * 2.5))), phase: 'del' }; return { str: typed(p.replacement, u, delEnd, p.cps), phase: 'new' }; }
/* ---------- 3. receipt compare ---------- */
const RECEIPTS = [{ title: 'Option A · direct', lines: [{ label: 'Voice minutes', amount: 240 }], note: 'No added fees' },
  { title: 'Option B · reseller', lines: [{ label: 'Voice minutes', amount: 240 }, { label: 'Platform fee', amount: 12.4, fee: true, at: 0.9 }, { label: 'Card processing', amount: 6.96, fee: true, at: 1.45 }, { label: 'Top-up fee', amount: 2.5, fee: true, at: 2.0 }],
    error: { at: 2.55, text: '429 Too many requests' } }];
const cardTotal = (cd, u) => cd.lines.reduce((a, l) => a + (l.fee ? l.amount * clamp(springTrack(u, [[0, 0], [l.at, 1]], 'ui'), 0, 1) : l.amount), 0);
/* ---------- 4. failover route ---------- */
const PROVIDERS = [{ label: 'Provider A' }, { label: 'Provider B' }, { label: 'Provider C' }];
function routeGeo(p, c) { const [x, y, w, h] = bx(p.box, c), s = c.s, n = p.providers.length, src = [x + w * 0.09, y + h * 0.5], hub = [x + w * 0.45, y + h * 0.5];
  const prov = p.providers.map((_, i) => [x + w * 0.86, y + h * (n === 1 ? 0.5 : 0.16 + 0.68 * i / (n - 1))]), hw = 120 * s;
  const curve = (i) => { const a = [hub[0] + hw, hub[1]], b = [prov[i][0] - hw, prov[i][1]], m = (a[0] + b[0]) / 2; return [a, [m, a[1]], [m, b[1]], b]; };
  return { s, src, hub, prov, hw, seg1: [[src[0] + hw, src[1]], [hub[0] - hw, hub[1]]], curves: prov.map((_, i) => curve(i)) }; }
const bez = ([a, b, c2, d], k) => { const m = 1 - k; return [m * m * m * a[0] + 3 * m * m * k * b[0] + 3 * m * k * k * c2[0] + k * k * k * d[0], m * m * m * a[1] + 3 * m * m * k * b[1] + 3 * m * k * k * c2[1] + k * k * k * d[1]]; };
const bezPath = ([a, b, c2, d]) => `M${f2(a[0])} ${f2(a[1])} C${f2(b[0])} ${f2(b[1])} ${f2(c2[0])} ${f2(c2[1])} ${f2(d[0])} ${f2(d[1])}`;
const nextUp = (p) => (p.active + 1) % p.providers.length;
/* where packet k is at local time u: { x, y, state: 'on' | 'hold' | 'drop', a } or null. Spawned at start + k * rate; seg 1 takes t1, the curve t2.
   If it reaches the hub after failAt it waits there until rerouteAt, then takes the next provider; packets already on the failed curve at failAt turn red and drop. */
function packet(k, u, p, G) { const ts = p.start + k * p.rate, t1 = p.travel * 0.45, t2 = p.travel * 0.55; if (u < ts) return null; const tHub = ts + t1;
  if (u < tHub) { const q = (u - ts) / t1; return { x: lerp(G.seg1[0][0], G.seg1[1][0], q), y: G.seg1[0][1], state: 'on', a: clamp(q * 4) }; }
  const late = tHub >= p.failAt, go = late ? Math.max(tHub, p.rerouteAt) : tHub, to = late ? nextUp(p) : p.active;
  if (u < go) { const j = k % 5; return { x: G.hub[0] + G.hw + 10 * G.s + j * 8 * G.s, y: G.hub[1] + (j - 2) * 9 * G.s, state: 'hold', a: 1 }; }
  const q = (u - go) / t2; if (q >= 1) return null; const [x, y] = bez(G.curves[to], E.soft(q));
  if (!late && to === p.active && u >= p.failAt) { const d = u - Math.max(p.failAt, go); return d > 0.3 ? null : { x, y, state: 'drop', a: 1 - d / 0.3 }; }
  return { x, y, state: 'on', a: 1 - seg(q, 0.85, 1) }; }
/* ---------- 5. file chip ---------- */
const dlIcon = (x, y, size, color, sw) => `<path transform="translate(${f2(x)} ${f2(y)}) scale(${f2(size / 24)})" d="M12 4v11 M7 10.5l5 5l5-5 M5 20h14" fill="none" stroke="${color}" stroke-width="${f2(sw)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
const sizeOf = (str) => { const m = /([\d.]+)\s*(\w+)/.exec(String(str)); return m ? [parseFloat(m[1]), m[2]] : [1, 'MB']; };

export const UI2 = {
  'ui.liveTranscript': { file: 'type/gfx/ui-data.js', tags: ['ui', 'voice', 'transcript', 'latency', 'agent', 'call', 'glass', 'product-film'], dur: 6.2, inF: 8, outF: 8,
    d: { box: [0.56, 0.1, 0.38, 0.8], title: 'Live transcript', turns: TURNS, wps: 3.4, waveform: true, aiLabel: 'AI voice', source: 'latency values illustrative', theme: 'dark', glass: true, accent: BRAND },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, [x, y, w, h] = bx(p.box, c), id = uid('lt', x, y, w, h), pad = 28 * s, iw = w - 2 * pad - 8 * s, head = 74 * s, foot = p.source ? 44 * s : 16 * s, bh = h - head - foot;
      const lay = transcriptLayout(p, s, iw), scroll = springTrack(u, [{ t: 0, v: 0 }, ...p.turns.map((tn, i) => ({ t: tn.at, v: Math.max(0, lay[i].y + lay[i].h - bh) }))], 'panel');
      const panelFill = p.theme === 'dark' ? (p.glass ? 'rgba(24,23,31,0.80)' : T.panel) : p.glass ? 'rgba(255,255,255,0.84)' : T.panel, k = spring(u, 'panel');
      let body = ''; p.turns.forEach((tn, i) => { const b = lay[i], kin = spring(u - tn.at, 'ui'); if (kin <= 0) return; const ty = y + head + b.y - scroll + 18 * (1 - kin) * s, streaming = u < b.end + 0.05;
        if (ty > y + h || ty + b.h < y + head - 40 * s) return; const col = tn.ai ? p.accent : T.muted, ax = x + pad;
        let o = streaming ? rect(x + 10 * s, ty - 8 * s, w - 20 * s, b.h - 8 * s, 14 * s, p.accent, 'opacity="0.10"') : '';
        o += `<circle cx="${f2(ax + 13 * s)}" cy="${f2(ty + 14 * s)}" r="${f2(13 * s)}" fill="${col}" opacity="${tn.ai ? 1 : 0.35}"/>` + icon(tn.ai ? 'spark' : 'user', ax + 4 * s, ty + 5 * s, 18 * s, tn.ai ? '#FFFFFF' : T.ink, 2.2 * s);
        const nw = measure(tn.speaker, 21 * s, { weight: 700 }); o += text(tn.speaker, ax + 36 * s, ty + 21 * s, { size: 21 * s, weight: 700, fill: tn.ai ? T.ink : T.muted });
        let cx = ax + 48 * s + nw; if (tn.ai && p.aiLabel) { const lw = measure(p.aiLabel, 15 * s, { weight: 700 }) + 20 * s; o += pill(cx, ty + 3 * s, lw, 24 * s, 'none', `stroke="${p.accent}" stroke-width="${f2(1.5 * s)}"`) + text(p.aiLabel, cx + 10 * s, ty + 20 * s, { size: 15 * s, weight: 700, fill: p.accent }); cx += lw + 12 * s; }
        if (p.waveform) { const env = seg(u, tn.at, tn.at + 0.12) * (1 - seg(u, b.end, b.end + 0.3)); if (env > 0.001) o += `<g${op(clamp(env * 3))}>${miniWave(cx, ty + 15 * s, 92 * s, 24 * s, u, env, col, i + 1)}</g>`; }
        if (tn.latency != null) { const lk = spring(u - tn.at, 'headline'), lab = tn.latency.toFixed(2) + ' s', lw = measure(lab, 17 * s, { weight: 700, font: FONT }) + 46 * s, lx = x + w - pad - lw;
          if (lk > 0) o += `<g transform="translate(${f2(lx + lw / 2)} ${f2(ty + 15 * s)}) scale(${f2(Math.max(0.001, lk))}) translate(${f2(-lx - lw / 2)} ${f2(-ty - 15 * s)})">${pill(lx, ty + 1 * s, lw, 28 * s, T.chip)}${icon('clock', lx + 8 * s, ty + 5 * s, 20 * s, GREEN, 2.2 * s)}${text(lab, lx + 34 * s, ty + 21 * s, { size: 17 * s, weight: 700, fill: T.ink, extra: 'font-variant-numeric="tabular-nums"' })}</g>`; }
        let wi = 0; b.lines.forEach((ln, li) => { let wx = ax + 36 * s; const ly = ty + 38 * s + 27 * s + li * 37 * s; for (const wd of ln) { const wt = tn.at + wi / p.wps, a = seg(u, wt, wt + 0.09);
          if (a > 0) o += text(wd, wx, ly + 6 * s * (1 - a), { size: 27 * s, weight: 600, fill: T.ink, op: a }); wx += measure(wd + ' ', 27 * s, { weight: 600 }); wi++; } });
        if (tn.tags?.length) { let gx = ax + 36 * s; const gy = ty + 38 * s + b.lines.length * 37 * s + 10 * s; tn.tags.forEach((g, gi) => { const gk = spring(u - b.end - 0.08 - gi * 0.08, 'ui'), gw = measure(g, 17 * s, { weight: 700 }) + 26 * s;
          if (gk > 0) o += `<g${op(gk)}>${pill(gx, gy + 6 * s * (1 - gk), gw, 30 * s, T.chip, `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`)}${text(g, gx + 13 * s, gy + 21 * s + 6 * s * (1 - gk), { size: 17 * s, weight: 700, fill: T.muted })}</g>`; gx += gw + 10 * s; }); }
        body += `<g${op(clamp(kin * 1.4))}>${o}</g>`; });
      const rec = 0.55 + 0.45 * Math.cos(TAU * u * 0.9), hdr = text(p.title, x + pad, y + 46 * s, { size: 25 * s, weight: 800, fill: T.ink }) + `<circle cx="${f2(x + w - pad - 52 * s)}" cy="${f2(y + 38 * s)}" r="${f2(7 * s)}" fill="${RED}" opacity="${f2(rec)}"/>` +
        text('LIVE', x + w - pad, y + 45 * s, { size: 18 * s, weight: 800, fill: RED, anchor: 'end', ls: 1.5 }) + `<line x1="${f2(x)}" x2="${f2(x + w)}" y1="${f2(y + head - 4 * s)}" y2="${f2(y + head - 4 * s)}" stroke="${T.line}" stroke-width="${f2(1.2 * s)}"/>`;
      const src = p.source ? text(p.source, x + pad, y + h - 17 * s, { size: 16 * s, weight: 600, fill: T.muted }) : '';
      return `<defs>${shadowDef(id + 's', s)}<clipPath id="${id}c"><rect x="${f2(x)}" y="${f2(y + head)}" width="${f2(w)}" height="${f2(bh)}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.10"/><stop offset="0.4" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs>` +
        `<g${fade(L)} transform="translate(0 ${f2(20 * s * (1 - k))})">${softShadow(id + 's', x, y, w, h, 26 * s, s, 1, 'rgba(0,0,0,0.30)')}${rect(x, y, w, h, 26 * s, panelFill, `stroke="${p.theme === 'dark' ? 'rgba(255,255,255,0.14)' : T.line}" stroke-width="${f2(1.5 * s)}"`)}${p.glass ? rect(x, y, w, h, 26 * s, `url(#${id}g)`) : ''}${hdr}<g clip-path="url(#${id}c)">${body}</g>${src}</g>`; } },

  'ui.wordRegenerate': { file: 'type/gfx/ui-data.js', tags: ['ui', 'voice', 'tts', 'edit', 'waveform', 'regenerate', 'word', 'product-film'], dur: 4.2, inF: 8, outF: 8,
    d: { box: [0.12, 0.3, 0.76, 0.4], title: 'Script · line 2', words: 'Your table for four is booked for Friday at eight.', target: 7, replacement: 'Saturday', selectAt: 0.45, clickAt: 1.1, replaceAt: 1.45, cps: 13, playAt: null, playDur: 1.3,
      button: 'Regenerate', cursor: true, waveform: true, theme: 'light', accent: BRAND },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, [x, y, w, h] = bx(p.box, c), id = uid('wr', x, y, w, h), pad = 44 * s, fs = 46 * s, words = p.words.split(/\s+/), { typeEnd, playAt } = regenTimes(p), cur = regenWord(p, u), k = spring(u, 'panel');
      const strs = words.map((wd, i) => (i === p.target ? cur.str : wd)), sp = measure(' ', fs, { weight: 700 }), ws = strs.map((wd, i) => Math.max(i === p.target ? 6 * s : 0, measure(wd, fs, { weight: 700 }))), total = ws.reduce((a, v) => a + v, 0) + sp * (ws.length - 1);
      const x0 = x + Math.max(pad, (w - total) / 2), ty = y + h * 0.47; let xx = x0; const pos = ws.map((v) => { const a = xx; xx += v + sp; return a; });
      const tx0 = pos[p.target], tw = ws[p.target], selK = spring(u - p.selectAt, 'ui') * (1 - seg(u, typeEnd + 0.2, typeEnd + 0.6) * 0.6), pk = clamp((u - playAt) / p.playDur), playX = lerp(x0, x0 + total, pk);
      let o = selK > 0 ? `<g${op(selK)}>${rect(tx0 - 8 * s, ty - fs * 0.92, tw + 16 * s, fs * 1.28, 8 * s, p.accent, 'opacity="0.14"')}${rect(tx0 - 10 * s, ty - fs * 0.98, 3.5 * s, fs * 1.4, 1.5 * s, p.accent)}${rect(tx0 + tw + 7 * s, ty - fs * 0.98, 3.5 * s, fs * 1.4, 1.5 * s, p.accent)}</g>` : '';
      strs.forEach((wd, i) => { o += text(wd, pos[i], ty, { size: fs, weight: 700, fill: i === p.target && cur.phase === 'new' ? p.accent : T.ink }); });
      if (u >= p.replaceAt && u < typeEnd + 0.1) o += rect(tx0 + tw + 2 * s, ty - fs * 0.78, 3 * s, fs * 0.98, 1.5 * s, p.accent);
      if (p.waveform) { const bw = 9 * s, wy = ty + 74 * s, hm = 46 * s; words.forEach((_, i) => { const isT = i === p.target, wdw = ws[i], n = Math.max(3, Math.floor(wdw / bw));
        let amp = 1, seed = i + 1, col = T.faint, drawK = 1; if (isT) { if (cur.phase !== 'old') { const down = 1 - seg(u, p.replaceAt, p.replaceAt + 0.25); seed = cur.phase === 'new' ? 101 : i + 1; col = cur.phase === 'new' ? p.accent : T.faint; amp = cur.phase === 'new' ? 1 : down; drawK = cur.phase === 'new' ? seg(u, regenTimes(p).delEnd, typeEnd + 0.25) : 1; } else col = selK > 0.5 ? p.accent : T.faint; }
        for (let j = 0; j < n; j++) { const bxp = pos[i] + (j + 0.5) * wdw / n, on = isT && cur.phase === 'new' ? clamp(drawK * n - j) : 1, a = (0.22 + 0.78 * hashf(seed, j)) * (0.6 + 0.4 * Math.sin(Math.PI * (j + 0.5) / n)) * amp * on;
          const played = pk > 0 && bxp < playX, fill = played ? (isT ? p.accent : T.ink) : col, bh = Math.max(3 * s, hm * a); o += rect(bxp - bw * 0.3, wy - bh / 2, bw * 0.6, bh, bw * 0.3, fill, played && !isT ? 'opacity="0.75"' : ''); } });
        if (pk > 0 && pk < 1) o += rect(playX - 1.5 * s, wy - hm * 0.75, 3 * s, hm * 1.5, 1.5 * s, p.accent); }
      const bl = p.button ? measure(p.button, 22 * s, { weight: 700 }) + 76 * s : 0, bxx = x + w - pad - bl, byy = y + 26 * s, bh2 = 52 * s, bcx = bxx + bl / 2, bcy = byy + bh2 / 2, pr = pressAt(u, p.clickAt), busy = u >= p.clickAt && u < typeEnd;
      const btn = p.button ? `<g transform="translate(${f2(bcx)} ${f2(bcy)}) scale(${f2(1 - 0.08 * pr)}) translate(${f2(-bcx)} ${f2(-bcy)})">${pill(bxx, byy, bl, bh2, busy ? p.accent : T.chip, busy ? '' : `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`)}` +
        (busy ? spinner(bxx + 27 * s, bcy, 10 * s, u - p.clickAt, '#FFFFFF', 3 * s) : u >= typeEnd ? checkBadge(bxx + 27 * s, bcy, 12 * s, u - typeEnd, GREEN) : icon('spark', bxx + 15 * s, bcy - 12 * s, 24 * s, p.accent, 2.2 * s)) + text(p.button, bxx + 50 * s, bcy + 8 * s, { size: 22 * s, weight: 700, fill: busy ? '#FFFFFF' : T.ink }) + '</g>' : '';
      const cur2 = p.cursor && p.button ? (() => { const [qx, qy] = springTrack(u, [[0, [bcx + 240 * s, bcy + 260 * s]], [p.clickAt - 0.6, [bcx + 6 * s, bcy + 8 * s]], [p.clickAt + 0.35, [bcx + 120 * s, bcy + 300 * s]]], 'panel'), co = seg(u, p.clickAt - 0.95, p.clickAt - 0.7) * (1 - seg(u, p.clickAt + 0.5, p.clickAt + 0.8)); return co > 0 ? `<g${op(co)}>${cursorSvg(qx, qy, 1.4 * s, pr)}</g>` : ''; })() : '';
      return `<defs>${shadowDef(id + 's', s)}</defs><g${fade(L)} transform="translate(0 ${f2(18 * s * (1 - k))})">${softShadow(id + 's', x, y, w, h, 28 * s, s)}${rect(x, y, w, h, 28 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`)}` +
        text(p.title, x + pad, y + 60 * s, { size: 22 * s, weight: 700, fill: T.muted }) + o + btn + ripple(bcx, bcy, u - p.clickAt, s, p.accent) + `</g><g${op(1 - L.out)}>${cur2}</g>`; } },

  'ui.receiptCompare': { file: 'type/gfx/ui-data.js', tags: ['ui', 'pricing', 'receipt', 'fees', 'compare', 'cost', 'error', 'product-film'], dur: 3.8, inF: 8, outF: 8,
    d: { box: [0.1, 0.17, 0.8, 0.66], cards: RECEIPTS, currency: '$', start: 0.1, stagger: 0.18, source: 'illustrative prices', theme: 'light', accent: BRAND },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, [x, y, w, h] = bx(p.box, c), id = uid('rc', x, y, w, h), n = p.cards.length, gap = 40 * s, cw = (w - gap * (n - 1)) / n, ch = h - (p.source ? 44 * s : 0), pad = 32 * s;
      let o = ''; p.cards.forEach((cd, i) => { const cx = x + i * (cw + gap), kk = spring(u - p.start - i * p.stagger, 'panel'); if (kk <= 0) return; const fees = cd.lines.some((l) => l.fee), base = cd.lines.filter((l) => !l.fee).reduce((a, l) => a + l.amount, 0), tot = cardTotal(cd, u);
        const err = cd.error && u >= cd.error.at ? cd.error : null, shake = err ? Math.sin(TAU * 9 * (u - err.at)) * Math.exp(-6 * (u - err.at)) * 10 * s : 0;
        let r = softShadow(id + 's', cx, y, cw, ch, 24 * s, s, 0.9) + rect(cx, y, cw, ch, 24 * s, T.panel, `stroke="${err ? RED : T.line}" stroke-width="${f2((err ? 2.5 : 1.5) * s)}"`) + text(cd.title, cx + pad, y + 58 * s, { size: 27 * s, weight: 800, fill: T.ink });
        cd.lines.forEach((l, li) => { const ly = y + 120 * s + li * 58 * s, lk = l.fee ? spring(u - l.at, 'ui') : 1; if (lk <= 0) return; const dx = 30 * s * (1 - lk), flash = l.fee ? 1 - seg(u, l.at, l.at + 0.6) : 0;
          r += `<g${op(clamp(lk * 1.3))} transform="translate(${f2(dx)} 0)">` + (flash > 0 ? rect(cx + 14 * s, ly - 34 * s, cw - 28 * s, 50 * s, 10 * s, RED, `opacity="${f2(0.14 * flash)}"`) : '') + text(l.label, cx + pad, ly, { size: 24 * s, weight: 600, fill: l.fee ? RED : T.muted }) +
            text((l.fee ? '+' : '') + money(l.amount, p.currency), cx + cw - pad, ly, { size: 24 * s, weight: 700, fill: l.fee ? RED : T.ink, anchor: 'end', extra: 'font-variant-numeric="tabular-nums"' }) + '</g>'; });
        const tyy = y + ch - 54 * s; r += `<line x1="${f2(cx + pad)}" x2="${f2(cx + cw - pad)}" y1="${f2(tyy - 52 * s)}" y2="${f2(tyy - 52 * s)}" stroke="${T.line}" stroke-width="${f2(1.5 * s)}" stroke-dasharray="${f2(6 * s)} ${f2(6 * s)}"/>` +
          text('Total', cx + pad, tyy, { size: 26 * s, weight: 700, fill: T.ink }) + text(money(tot, p.currency), cx + cw - pad, tyy + 2 * s, { size: 40 * s, weight: 800, fill: tot > base + 1e-6 ? RED : T.ink, anchor: 'end', extra: 'font-variant-numeric="tabular-nums"' });
        if (!fees && cd.note) { const lastFee = Math.max(0, ...p.cards.flatMap((q) => q.lines.filter((l) => l.fee).map((l) => l.at))), nk = spring(u - lastFee - 0.25, 'ui'), nw = measure(cd.note, 20 * s, { weight: 700 }) + 66 * s, nx = cx + pad, ny = tyy - 118 * s;
          if (nk > 0) r += `<g${op(nk)}>${pill(nx, ny, nw, 42 * s, GREEN, 'opacity="0.12"')}${checkBadge(nx + 22 * s, ny + 21 * s, 12 * s, u - lastFee - 0.25, GREEN)}${text(cd.note, nx + 44 * s, ny + 28 * s, { size: 20 * s, weight: 700, fill: GREEN })}</g>`; }
        if (err) { const ek = spring(u - err.at, 'headline'), ew = measure(err.text, 19 * s, { weight: 700 }) + 64 * s, ex = cx + cw - ew - 18 * s, ey = y - 22 * s;
          r += `<g transform="translate(${f2(ex + ew / 2)} ${f2(ey + 22 * s)}) scale(${f2(Math.max(0.001, ek))}) translate(${f2(-ex - ew / 2)} ${f2(-ey - 22 * s)})">${pill(ex, ey, ew, 44 * s, RED)}<circle cx="${f2(ex + 24 * s)}" cy="${f2(ey + 22 * s)}" r="${f2(10 * s)}" fill="none" stroke="#FFF" stroke-width="${f2(2.4 * s)}"/>` +
            `<path d="M${f2(ex + 24 * s)} ${f2(ey + 16 * s)} V${f2(ey + 23 * s)} M${f2(ex + 24 * s)} ${f2(ey + 27 * s)} V${f2(ey + 27.5 * s)}" stroke="#FFF" stroke-width="${f2(2.6 * s)}" stroke-linecap="round"/>${text(err.text, ex + 44 * s, ey + 29 * s, { size: 19 * s, weight: 700, fill: '#FFFFFF' })}</g>`; }
        o += `<g${op(clamp(kk * 1.4))} transform="translate(${f2(shake)} ${f2(24 * s * (1 - kk))})">${r}</g>`; });
      return `<defs>${shadowDef(id + 's', s)}</defs><g${fade(L)}>${o}${p.source ? text(p.source, x, y + h - 8 * s, { size: 18 * s, weight: 600, fill: T.muted }) : ''}</g>`; } },

  'ui.failoverRoute': { file: 'type/gfx/ui-data.js', tags: ['ui', 'routing', 'failover', 'diagram', 'network', 'uptime', 'infrastructure', 'product-film'], dur: 4.4, inF: 8, outF: 8,
    d: { box: [0.05, 0.16, 0.9, 0.66], source: { label: 'Your app', icon: 'doc' }, hub: { label: 'Acme router', icon: 'branch' }, providers: PROVIDERS, active: 0, start: 0.25, rate: 0.17, travel: 1.0, failAt: 1.9, rerouteAt: 2.3,
      status: ['Routing', 'Provider A down', 'Rerouted to Provider B'], note: 'timings illustrative', theme: 'dark', accent: BRAND },
    svg(L, p0, c) { const p = { ...p0, active: wrapIndex(p0.active, p0.providers.length) }; const T = th(p), u = L.u, G = routeGeo(p, c), s = G.s, id = uid('fr', G.src[0], G.hub[0], p.providers.length), nx = nextUp(p), failed = u >= p.failAt, moved = u >= p.rerouteAt, kin = spring(u, 'panel');
      const lineC = (i) => (i === p.active ? (failed ? RED : p.accent) : i === nx && moved ? GREEN : T.faint);
      let o = `<line x1="${f2(G.seg1[0][0])}" y1="${f2(G.seg1[0][1])}" x2="${f2(G.seg1[1][0])}" y2="${f2(G.seg1[1][1])}" stroke="${p.accent}" stroke-width="${f2(4 * s)}" stroke-linecap="round" opacity="0.85"/>`;
      G.curves.forEach((cv, i) => { const lit = (i === p.active && !failed) || (i === nx && moved), dk = seg(u, 0.1 + i * 0.1, 0.5 + i * 0.1);
        o += `<path d="${bezPath(cv)}" fill="none" stroke="${lineC(i)}" stroke-width="${f2((lit ? 4 : 2.5) * s)}" stroke-linecap="round" opacity="${f2(lit ? 0.9 : 0.55)}" ${i === p.active && failed ? `stroke-dasharray="${f2(8 * s)} ${f2(10 * s)}"` : `stroke-dasharray="${f2(1600 * s)} ${f2(1600 * s)}" stroke-dashoffset="${f2(1600 * s * (1 - dk))}"`}/>`; });
      const nMax = Math.ceil((u - p.start) / p.rate) + 1; for (let kk = Math.max(0, nMax - 40); kk <= nMax; kk++) { const q = packet(kk, u, p, G); if (!q) continue;
        const col = q.state === 'drop' ? RED : q.state === 'hold' ? AMBER : '#FFFFFF'; o += `<circle cx="${f2(q.x)}" cy="${f2(q.y)}" r="${f2(7 * s)}" fill="${col}" opacity="${f2(q.a)}"/><circle cx="${f2(q.x)}" cy="${f2(q.y)}" r="${f2(14 * s)}" fill="${col === '#FFFFFF' ? p.accent : col}" opacity="${f2(0.25 * q.a)}"/>`; }
      const node = (xy, lab, ic, col, ring = 0, badge = '') => { const nw = G.hw * 2, nh = 92 * s, x0 = xy[0] - nw / 2, y0 = xy[1] - nh / 2;
        return (ring > 0 ? rect(x0 - 8 * s * ring, y0 - 8 * s * ring, nw + 16 * s * ring, nh + 16 * s * ring, 26 * s, col, `opacity="${f2(0.22 * ring)}"`) : '') + rect(x0, y0, nw, nh, 20 * s, T.panel, `stroke="${col}" stroke-width="${f2(2 * s)}"`) +
          rect(x0 + 16 * s, y0 + 20 * s, 52 * s, 52 * s, 14 * s, T.chip) + icon(ic, x0 + 28 * s, y0 + 32 * s, 28 * s, col, 2.4 * s) + text(lab, x0 + 82 * s, y0 + 55 * s, { size: 23 * s, weight: 700, fill: T.ink }) + badge; };
      let nodes = node(G.src, p.source.label, p.source.icon || 'doc', T.muted) + node(G.hub, p.hub.label, p.hub.icon || 'branch', p.accent, 0.5 + 0.5 * Math.sin(TAU * u * 0.8) * 0.4);
      p.providers.forEach((pv, i) => { const isF = i === p.active && failed, isN = i === nx && moved, col = isF ? RED : (i === p.active && !failed) || isN ? GREEN : T.muted, sh = isF ? Math.sin(TAU * 10 * (u - p.failAt)) * Math.exp(-7 * (u - p.failAt)) * 8 * s : 0;
        const st = isF ? 'down' : 'up', bw = 64 * s, bx2 = G.prov[i][0] + G.hw - bw - 10 * s, by2 = G.prov[i][1] - 46 * s - 22 * s, bk = isF ? spring(u - p.failAt, 'headline') : 1;
        const badge = `<g transform="translate(${f2(bx2 + bw / 2)} ${f2(by2 + 15 * s)}) scale(${f2(Math.max(0.001, bk))}) translate(${f2(-bx2 - bw / 2)} ${f2(-by2 - 15 * s)})">${pill(bx2, by2, bw, 30 * s, col)}${text(st, bx2 + bw / 2, by2 + 21 * s, { size: 17 * s, weight: 800, fill: '#FFFFFF', anchor: 'middle' })}</g>`;
        nodes += `<g transform="translate(${f2(sh)} 0)">${node(G.prov[i], pv.label, pv.icon || 'db', col, isN ? 1 - seg(u, p.rerouteAt + 0.6, p.rerouteAt + 1.4) * 0.6 : 0, badge)}</g>`; });
      const stI = moved ? 2 : failed ? 1 : 0, stT = p.status[stI] || '', stC = stI === 1 ? RED : stI === 2 ? GREEN : T.muted, sw2 = measure(stT, 22 * s, { weight: 700 }) + 70 * s, sx = G.hub[0] - sw2 / 2, sy = G.hub[1] + 80 * s, sk = spring(u - [0.2, p.failAt, p.rerouteAt][stI], 'ui');
      const status = `<g${op(clamp(sk * 1.5))}>${pill(sx, sy, sw2, 48 * s, T.panel, `stroke="${stC}" stroke-width="${f2(1.6 * s)}"`)}${stI === 2 ? checkBadge(sx + 26 * s, sy + 24 * s, 12 * s, u - p.rerouteAt, GREEN) : `<circle cx="${f2(sx + 26 * s)}" cy="${f2(sy + 24 * s)}" r="${f2(7 * s)}" fill="${stC}"/>`}${text(stT, sx + 46 * s, sy + 32 * s, { size: 22 * s, weight: 700, fill: stI ? stC : T.ink })}</g>`;
      const [bx0, by0, , bh0] = bx(p.box, c);
      return `<g${fade(L)} transform="translate(0 ${f2(16 * s * (1 - kin))})">${o}${nodes}${status}${p.note ? text(p.note, bx0, by0 + bh0, { size: 18 * s, weight: 600, fill: T.muted }) : ''}</g>`; } },

  'ui.fileChip': { file: 'type/gfx/ui-data.js', tags: ['ui', 'file', 'download', 'export', 'progress', 'cursor', 'click'], dur: 3.4, inF: 8, outF: 8,
    d: { center: [0.5, 0.5], name: 'acme-voice-calls.csv', size: '4.8 MB', ext: 'CSV', kind: 'Spreadsheet', clickAt: 0.95, dlDur: 1.15, button: 'Download', doneLabel: 'Open', cursor: true, source: null, theme: 'light', accent: BRAND },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, cw = 720 * s, ch = 128 * s, x = p.center[0] * c.W - cw / 2, y = p.center[1] * c.H - ch / 2, id = uid('fc', x, y, cw), k = spring(u, 'panel'), done = p.clickAt + p.dlDur, [sv, su] = sizeOf(p.size);
      const prog = clamp(E.soft(seg(u, p.clickAt + 0.05, done))), dl = u >= p.clickAt, fin = u >= done, pr = pressAt(u, p.clickAt), extC = { CSV: GREEN, PDF: RED, ZIP: AMBER }[p.ext] || p.accent;
      const tile = rect(x + 22 * s, y + 22 * s, 84 * s, 84 * s, 18 * s, extC, 'opacity="0.12"') + icon('doc', x + 38 * s, y + 34 * s, 52 * s, extC, 2.4 * s) + pill(x + 40 * s, y + 70 * s, 48 * s, 24 * s, extC) + text(p.ext, x + 64 * s, y + 87 * s, { size: 14 * s, weight: 800, fill: '#FFFFFF', anchor: 'middle' });
      const meta = fin ? `Downloaded · ${p.size}` : dl ? `${(sv * prog).toFixed(1)} / ${sv} ${su}` : `${p.kind} · ${p.size}`;
      const lab = fin ? p.doneLabel : p.button, bw = measure(lab, 22 * s, { weight: 700 }) + 78 * s, bxx = x + cw - bw - 24 * s, byy = y + ch / 2 - 28 * s, bcx = bxx + bw / 2, bcy = byy + 28 * s;
      const btn = `<g transform="translate(${f2(bcx)} ${f2(bcy)}) scale(${f2(1 - 0.08 * pr)}) translate(${f2(-bcx)} ${f2(-bcy)})">${pill(bxx, byy, bw, 56 * s, fin ? T.chip : p.accent, fin ? `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"` : '')}` +
        (fin ? checkBadge(bxx + 28 * s, bcy, 13 * s, u - done, GREEN) : dl ? spinner(bxx + 28 * s, bcy, 10 * s, u - p.clickAt, '#FFFFFF', 3 * s) : dlIcon(bxx + 16 * s, bcy - 12 * s, 24 * s, '#FFFFFF', 2.6 * s)) +
        text(lab, bxx + 52 * s, bcy + 8 * s, { size: 22 * s, weight: 700, fill: fin ? T.ink : '#FFFFFF' }) + '</g>';
      const barW = bxx - (x + 128 * s) - 30 * s, bar = dl && !fin ? rect(x + 128 * s, y + ch - 26 * s, barW, 8 * s, 4 * s, T.chip) + rect(x + 128 * s, y + ch - 26 * s, barW * prog, 8 * s, 4 * s, p.accent) : '';
      const cur = p.cursor ? (() => { const [qx, qy] = springTrack(u, [[0, [bcx + 300 * s, bcy + 240 * s]], [p.clickAt - 0.6, [bcx + 4 * s, bcy + 6 * s]], [done, [bcx + 160 * s, bcy + 220 * s]]], 'panel'), co = seg(u, 0.1, 0.3) * (1 - seg(u, done + 0.2, done + 0.5)); return co > 0 ? `<g${op(co)}>${cursorSvg(qx, qy, 1.4 * s, pr)}</g>` : ''; })() : '';
      return `<defs>${shadowDef(id + 's', s)}</defs><g${fade(L)} transform="translate(0 ${f2(20 * s * (1 - k))})">${softShadow(id + 's', x, y, cw, ch, 24 * s, s)}${rect(x, y, cw, ch, 24 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`)}${tile}` +
        text(p.name, x + 128 * s, y + 58 * s, { size: 27 * s, weight: 700, fill: T.ink }) + text(meta, x + 128 * s, y + 92 * s, { size: 20 * s, weight: 600, fill: fin ? GREEN : T.muted, extra: 'font-variant-numeric="tabular-nums"' }) + bar + btn + ripple(bcx, bcy, u - p.clickAt, s, p.accent) +
        (p.source ? text(p.source, x, y + ch + 36 * s, { size: 17 * s, weight: 600, fill: T.muted }) : '') + `</g><g${op(1 - L.out)}>${cur}</g>`; } },
};
for (const g of Object.values(UI2)) { const f = g.svg; g.d.scale = 1; g.svg = (L, p, c) => f(L, p, p.scale && p.scale !== 1 ? { ...c, s: c.s * p.scale } : c); }

export const UI2_CUES = {
  'ui.liveTranscript': (p) => { const out = []; let ai = 0, n = 0; p.turns.forEach((tn, i) => { out.push({ t: tn.at, id: tn.ai ? rr(['sfx/ui/ai_reply', 'sfx/device/notify_soft'], ai++) : rr(['sfx/device/message_received', 'sfx/ui/blip'], n++), why: (tn.ai ? 'AI' : 'caller') + ' turn ' + (i + 1) + ' starts' });
    if (tn.latency != null) out.push({ t: tn.at + 0.05, id: 'sfx/ui/tick', why: 'latency badge' }); }); return out.sort((a, b) => a.t - b.t); },
  'ui.wordRegenerate': (p) => { const { delEnd, typeEnd, playAt } = regenTimes(p); return [{ t: p.selectAt, id: 'sfx/ui/slide', why: 'word selected' }, ...(p.button ? [{ t: p.clickAt, id: 'sfx/ui/click', why: 'Regenerate clicked' }, { t: p.clickAt + 0.06, id: 'sfx/ui/ai_think_pulse', why: 'regenerating' }] : []),
    { t: delEnd, id: 'sfx/ui/typing_burst', why: 'new word typed' }, { t: typeEnd, id: 'sfx/ui/success', why: 'word replaced' }, { t: playAt, id: 'sfx/ui/blip', why: 'playback' }]; },
  'ui.receiptCompare': (p) => { const out = p.cards.map((_, i) => ({ t: p.start + i * p.stagger, id: rr(['sfx/device/card_flip', 'sfx/ui/pop'], i), why: 'card ' + (i + 1) + ' lands' })); let f = 0;
    for (const cd of p.cards) { for (const l of cd.lines) if (l.fee) out.push({ t: l.at, id: rr(TICKS, f++), why: 'fee ticks in' }); if (cd.error) out.push({ t: cd.error.at, id: 'sfx/ui/error', why: 'error chip' }); }
    const lastFee = Math.max(0, ...p.cards.flatMap((q) => q.lines.filter((l) => l.fee).map((l) => l.at))); if (p.cards.some((cd) => cd.note && !cd.lines.some((l) => l.fee))) out.push({ t: lastFee + 0.25, id: 'sfx/ui/success', why: 'flat total confirmed' });
    return out.sort((a, b) => a.t - b.t); },
  'ui.failoverRoute': (p) => [{ t: p.start, id: 'sfx/ui/toggle_on', why: 'traffic starts' }, { t: p.failAt, id: 'sfx/ui/error', why: 'provider goes down' }, { t: p.rerouteAt, id: 'sfx/tx/match_link', why: 're-route' }, { t: p.rerouteAt + 0.35, id: 'sfx/ui/success', why: 'traffic restored' }],
  'ui.fileChip': (p) => [{ t: 0, id: 'sfx/ui/pop', why: 'chip lands' }, { t: p.clickAt, id: 'sfx/ui/click', why: 'download click' }, { t: p.clickAt + 0.08, id: 'sfx/device/progress_fill', why: 'downloading' }, { t: p.clickAt + p.dlDur, id: 'sfx/ui/success', why: 'download done' }],
};
export { transcriptLayout, regenWord, regenTimes, packet, routeGeo, cardTotal };
