/* motion-pack / type / gfx / review.js (xp-r78, 2026-10-16): two product-UI parts from the round 7 / 8 reference studies. Same gfx contract as every part (core.js):
   { tags, dur, inF, outF, d, svg(L, p, c) } -> SVG markup, a pure function of t.
     ui.reviewLayer    a comment layer on a prototype: name-flag cursors that fly in from the frame edge and follow a track, pinned comment bubbles with avatars that pop on
                       their own frame, a record pill with a blinking red dot and a clock, and a rating-slider question card with a face on its handle.
                       flags: [{ name, track: [[t, x, y], ...], at, color }]   (track keys in COMPOSITION seconds, frame fractions: as hw.specCallout; a flag with no track sits at `xy`)
                       pins: [{ at, xy: [x, y], text, who }]                    (at in local seconds)
                       record: { at, dur }                                       (the clock reads floor(clamp(u - at, 0, dur)): the same digits for the same t in any order)
                       slider: { at, prompt, value, low, high }                  (value 0..1; the handle travels from the middle to `value`)
                     HONESTY: every name, avatar and comment is a placeholder; the layer prints `note` ("placeholder names and comments") for as long as it is on screen, and the
                     defaults are fictional ("Maya Rao"). Pass your own note, or '' to remove it once the names are real and used with permission.
     ui.approvalSlider an approval gate: a pending request card, a slide-to-approve track whose thumb travels on an eased curve, a working spinner, then the state flips to
                       'approved' (a filled pill, a check, a glow that decays) or, with outcome 'declined', to 'declined'. An optional decline button. approvalState(p, u) is the
                       closed-form state machine ('pending' | 'sliding' | 'approving' | 'approved' | 'declined'); approvalTimes(p) exports the flip frame for sound sync (the
                       cue sheet puts `sfx/ui/success_chime` on it). The default frame says "prototype" and describes a fictional request: it shows no shipping product.
   Guards: every numeric param is clamped (num), lists are capped (flags 6, pins 8), colours are #hex only, text is capped. */
import { E, clamp, lerp, seg, f2, text, esc, measure, MONO } from './core.js';
import { pointAt } from './hw.js';
import { num, str, list, hex, obj, sc, rgbOf, mixHex, boxPx, rrPath, alive } from './r78-util.js';

const TAU = Math.PI * 2, PAL = ['#4C8DFF', '#F5A524', '#2FD487', '#F0529C', '#9B6BFF', '#22C3D6'];
const wrap = (s, fs, maxW, lines = 3, weight = 600) => { const out = []; let cur = ''; for (const w of str(s, '', 200).split(/\s+/).filter(Boolean)) { const t = cur ? cur + ' ' + w : w; if (cur && measure(t, fs, { weight }) > maxW) { out.push(cur); cur = w; if (out.length >= lines) break; } else cur = t; }
  if (cur && out.length < lines) out.push(cur); return out; };
const clock = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const cursorPath = (x, y, k) => `<path d="M${f2(x)} ${f2(y)}L${f2(x + 0.0 * k)} ${f2(y + 22 * k)}L${f2(x + 6 * k)} ${f2(y + 17 * k)}L${f2(x + 11 * k)} ${f2(y + 27 * k)}L${f2(x + 15 * k)} ${f2(y + 25 * k)}L${f2(x + 10 * k)} ${f2(y + 15 * k)}L${f2(x + 17 * k)} ${f2(y + 15 * k)}Z"/>`;

/* ================================================================ ui.reviewLayer ================================================================ */
const REVIEW_D = { flags: [{ name: 'Maya Rao', track: [[0, 0.03, 0.2], [1.2, 0.2, 0.34], [3.4, 0.27, 0.44]], at: 0.15 }, { name: 'Dev Patel', track: [[0, 0.97, 0.7], [1.5, 0.76, 0.58], [3.6, 0.7, 0.5]], at: 0.4 }, { name: 'Sam Lee', track: [[0, 0.5, 0.02], [1.8, 0.46, 0.2], [3.5, 0.5, 0.3]], at: 0.7 }],
  pins: [{ at: 0.9, xy: [0.3, 0.38], text: 'Can this button be larger?', who: 'Maya Rao' }, { at: 1.5, xy: [0.72, 0.5], text: 'Love the new spacing here.', who: 'Dev Patel' }, { at: 2.1, xy: [0.5, 0.26], text: 'Placeholder copy: please review.', who: 'Sam Lee' }],
  record: { at: 2.4, dur: 3 }, slider: { at: 3.0, prompt: 'How clear was this step?', value: 0.72, low: 'Unclear', high: 'Clear' }, note: 'placeholder names and comments', accent: '#4C8DFF', panel: '#14161D', ink: '#F4F6FA', muted: '#9AA3B2', recBox: [0.5, 0.9], card: [0.6, 0.58, 0.34, 0.25] };
export function recordClock(pIn, u) {
  const r = obj(obj(pIn).record), at = num(r.at, 2.4, 0, 1e4), dur = num(r.dur, 3, 0.5, 600), e = u - at;
  return { on: e >= 0 && e < dur + 0.5, secs: Math.floor(clamp(e, 0, dur) + 1e-9), text: clock(Math.floor(clamp(e, 0, dur) + 1e-9)), dotOn: ((e % 1) + 1) % 1 < 0.7, e, dur, at };
}
const REVIEW = { tags: ['review', 'comment', 'feedback', 'prototype', 'cursor', 'flag', 'pin', 'record', 'slider', 'ui', 'collaboration'], dur: 5.2, inF: 6, outF: 9, d: REVIEW_D,
  svg(L, p, c) {
    const s = sc(c), u = L.u, t = L.t ?? L.u, o = alive(L), acc = hex(p.accent, REVIEW_D.accent), pan = hex(p.panel, REVIEW_D.panel), ink = hex(p.ink, REVIEW_D.ink), mut = hex(p.muted, REVIEW_D.muted);
    let out = `<g opacity="${f2(o)}">`;
    /* pins: avatar dot + bubble, popping on their own frame */
    list(p.pins, 8).filter((q) => q && typeof q === 'object').forEach((q, i) => { const at = num(q.at, 0.9, 0, 1e4), k = E.pop(seg(u, at, at + 0.4)); if (k <= 0.001) return; const xy = Array.isArray(q.xy) ? q.xy : [0.4, 0.4], px = num(xy[0], 0.4, -1, 2) * c.W, py = num(xy[1], 0.4, -1, 2) * c.H;
      const col = PAL[i % PAL.length], who = str(q.who, '', 30), ini = (who || str(q.text, '?', 2)).trim().charAt(0).toUpperCase() || '?', fs = 26 * s, lines = wrap(q.text, fs, 300 * s, 3), bw = Math.max(...lines.map((l) => measure(l, fs, { weight: 600 })), 60 * s) + 36 * s, bh = lines.length * fs * 1.3 + 28 * s;
      const flip = px + 40 * s + bw > c.W * 0.97, bx = flip ? px - 40 * s - bw : px + 40 * s, by = py - bh / 2, kk = clamp(k, 0, 1.2);
      out += `<g transform="translate(${f2(px)} ${f2(py)}) scale(${f2(kk)}) translate(${f2(-px)} ${f2(-py)})"><circle cx="${f2(px)}" cy="${f2(py)}" r="${f2(21 * s)}" fill="${col}" stroke="#FFFFFF" stroke-width="${f2(3 * s)}"/>` + text(ini, px, py + 9 * s, { size: 24 * s, weight: 800, fill: '#FFFFFF', anchor: 'middle' }) +
        `<rect x="${f2(bx)}" y="${f2(by)}" width="${f2(bw)}" height="${f2(bh)}" rx="${f2(16 * s)}" fill="${pan}" fill-opacity="0.94" stroke="${col}" stroke-opacity="0.8" stroke-width="${f2(2 * s)}"/>` +
        lines.map((l, j) => text(l, bx + 18 * s, by + 14 * s + fs * 1.05 + j * fs * 1.3, { size: fs, weight: 600, fill: ink })).join('') + (who ? text(who, bx + 18 * s, by - 8 * s, { size: 19 * s, weight: 700, fill: col, ls: 0.4 * s }) : '') + '</g>'; });
    /* name flags: a cursor arrow and a tag, flying in from the nearest frame edge to the first track key */
    list(p.flags, 6).filter((q) => q && typeof q === 'object').forEach((q, i) => { const at = num(q.at, i * 0.25, 0, 1e4), kin = E.enter(seg(u, at, at + 0.7)); if (kin <= 0.001) return;
      const tgt = pointAt(q.track ?? q.xy, t, [0.5, 0.5]), tx = tgt[0] * c.W, ty = tgt[1] * c.H, fx = tgt[0] < 0.5 ? -0.05 * c.W : 1.05 * c.W, fy = tgt[1] < 0.5 ? -0.05 * c.H : 1.05 * c.H, x = lerp(fx, tx, kin), y = lerp(fy, ty, kin);
      const col = hex(q.color, PAL[i % PAL.length]), name = str(q.name, '', 24), fs = 22 * s, tw = measure(name, fs, { weight: 700 }) + 24 * s;
      out += `<g opacity="${f2(clamp(kin * 2))}"><g fill="${col}" stroke="#FFFFFF" stroke-width="${f2(1.6 * s)}" stroke-linejoin="round">${cursorPath(x, y, s)}</g><rect x="${f2(x + 16 * s)}" y="${f2(y + 26 * s)}" width="${f2(tw)}" height="${f2(fs * 1.7)}" rx="${f2(fs * 0.85)}" fill="${col}"/>` +
        text(name, x + 16 * s + tw / 2, y + 26 * s + fs * 1.2, { size: fs, weight: 700, fill: '#FFFFFF', anchor: 'middle' }) + '</g>'; });
    /* record pill: a red dot, REC, the clock */
    const R = recordClock(p, u);
    if (R.on) { const rb = Array.isArray(p.recBox) ? p.recBox : REVIEW_D.recBox, cx = num(rb[0], 0.5, 0, 1) * c.W, cy = num(rb[1], 0.9, 0, 1) * c.H, kin = E.pop(seg(R.e, 0, 0.35)), kout = 1 - seg(R.e, R.dur, R.dur + 0.4), w = 210 * s, h = 54 * s;
      out += `<g opacity="${f2(clamp(kin) * kout)}" transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(clamp(kin, 0, 1.15))}) translate(${f2(-cx)} ${f2(-cy)})"><rect x="${f2(cx - w / 2)}" y="${f2(cy - h / 2)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(h / 2)}" fill="${pan}" fill-opacity="0.95" stroke="#FFFFFF" stroke-opacity="0.18"/>` +
        `<circle cx="${f2(cx - w / 2 + 30 * s)}" cy="${f2(cy)}" r="${f2(10 * s)}" fill="#E5484D" opacity="${R.dotOn ? 1 : 0.25}"/>` + text('REC', cx - w / 2 + 52 * s, cy + 8 * s, { size: 23 * s, weight: 800, fill: ink, ls: 2 * s }) + text(R.text, cx + w / 2 - 22 * s, cy + 9 * s, { size: 26 * s, weight: 700, fill: ink, anchor: 'end', font: MONO, extra: 'font-variant-numeric="tabular-nums"' }) + '</g>'; }
    /* rating-slider question card */
    const sl = obj(p.slider), sat = num(sl.at, 3, 0, 1e4), ks = E.enter(seg(u, sat, sat + 0.5));
    if (ks > 0.001) { const [bx, by, bw, bh] = boxPx(p.card, REVIEW_D.card, c), y0 = by + (1 - ks) * 26 * s, v = num(sl.value, 0.72, 0, 1), kh = E.move(seg(u, sat + 0.5, sat + 1.5)), hv = lerp(0.5, v, kh), tx0 = bx + 40 * s, tx1 = bx + bw - 40 * s, hx = lerp(tx0, tx1, hv), ty = y0 + bh * 0.62, fs = 27 * s;
      out += `<g opacity="${f2(ks)}"><rect x="${f2(bx)}" y="${f2(y0)}" width="${f2(bw)}" height="${f2(bh)}" rx="${f2(22 * s)}" fill="${pan}" fill-opacity="0.94" stroke="#FFFFFF" stroke-opacity="0.16"/>`;
      wrap(str(sl.prompt, REVIEW_D.slider.prompt, 90), fs * 1.1, bw - 80 * s, 2, 700).forEach((l, j) => { out += text(l, bx + 40 * s, y0 + 50 * s + j * fs * 1.35, { size: fs * 1.1, weight: 700, fill: ink }); });
      out += `<rect x="${f2(tx0)}" y="${f2(ty - 5 * s)}" width="${f2(tx1 - tx0)}" height="${f2(10 * s)}" rx="${f2(5 * s)}" fill="#FFFFFF" fill-opacity="0.16"/><rect x="${f2(tx0)}" y="${f2(ty - 5 * s)}" width="${f2(hx - tx0)}" height="${f2(10 * s)}" rx="${f2(5 * s)}" fill="${acc}"/>`;
      const hr = 25 * s, smile = (hv - 0.5) * 2;   // the face: eyes, and a mouth that curves with the value
      out += `<circle cx="${f2(hx)}" cy="${f2(ty)}" r="${f2(hr)}" fill="#FFD34D" stroke="#FFFFFF" stroke-width="${f2(3 * s)}"/><circle cx="${f2(hx - 8 * s)}" cy="${f2(ty - 6 * s)}" r="${f2(2.6 * s)}" fill="#3A2A00"/><circle cx="${f2(hx + 8 * s)}" cy="${f2(ty - 6 * s)}" r="${f2(2.6 * s)}" fill="#3A2A00"/>` +
        `<path d="M${f2(hx - 9 * s)} ${f2(ty + 8 * s)}Q${f2(hx)} ${f2(ty + 8 * s + smile * 9 * s)} ${f2(hx + 9 * s)} ${f2(ty + 8 * s)}" fill="none" stroke="#3A2A00" stroke-width="${f2(2.4 * s)}" stroke-linecap="round"/>`;
      out += text(str(sl.low, 'Unclear', 14), tx0, y0 + bh - 24 * s, { size: 21 * s, weight: 600, fill: mut }) + text(str(sl.high, 'Clear', 14), tx1, y0 + bh - 24 * s, { size: 21 * s, weight: 600, fill: mut, anchor: 'end' }) + '</g>'; }
    const nt = str(p.note, '', 60); if (nt) out += text(nt, 0.5 * c.W, c.safe.y1 - 6 * s, { size: 21 * s, weight: 600, fill: mut, anchor: 'middle', op: 0.95 });
    return out + '</g>';
  } };

/* ================================================================ ui.approvalSlider ================================================================ */
const APPROVE_D = { box: [0.3, 0.2, 0.4, 0.56], title: 'Agent request', detail: 'Wants to run one task for you', items: ['Scope: example files only', 'Can be undone'], slideAt: 0.9, slideDur: 1.1, workDur: 1.0, outcome: 'approved', decline: false,
  labels: { pending: 'Slide to approve', working: 'Approving', approved: 'Approved', declined: 'Declined' }, label: 'prototype · example request', accent: '#2FD487', danger: '#E5484D', panel: '#14161D', ink: '#F4F6FA', muted: '#9AA3B2' };
/* the times of the gate (local seconds): the thumb starts, lands, and the state flips (approvedAt is the flip frame: put the sound on it) */
export function approvalTimes(pIn) {
  const p = obj(pIn), a = num(p.slideAt, 0.9, 0, 1e4), d = num(p.slideDur, 1.1, 0.1, 60), w = num(p.workDur, 1, 0, 60);
  return { slideStart: a, slideEnd: a + d, approvedAt: a + d + w };
}
export function approvalState(pIn, u) {
  const p = obj(pIn), T = approvalTimes(p), thumb = E.move(seg(u, T.slideStart, T.slideEnd)), declined = p.outcome === 'declined';
  const state = u < T.slideStart ? 'pending' : u < T.slideEnd ? 'sliding' : u < T.approvedAt ? 'approving' : declined ? 'declined' : 'approved';
  return { state, thumb, spin: state === 'approving' ? ((u - T.slideEnd) * 1.4) % 1 : 0, glow: u >= T.approvedAt && !declined ? Math.exp(-(u - T.approvedAt) * 1.7) : 0, flipK: E.pop(seg(u, T.approvedAt, T.approvedAt + 0.45)), T };
}
const APPROVE = { tags: ['approval', 'consent', 'gate', 'slide-to-approve', 'human-in-the-loop', 'agent', 'request', 'ui', 'prototype'], dur: 5.0, inF: 10, outF: 9, d: APPROVE_D,
  svg(L, p, c) {
    const s = sc(c), u = L.u, o = alive(L), S = approvalState(p, u), [x, y, w, h] = boxPx(p.box, APPROVE_D.box, c), acc = hex(p.accent, APPROVE_D.accent), dan = hex(p.danger, APPROVE_D.danger), pan = hex(p.panel, APPROVE_D.panel), ink = hex(p.ink, APPROVE_D.ink), mut = hex(p.muted, APPROVE_D.muted);
    const lb = Object.assign({}, APPROVE_D.labels, obj(p.labels)), kin = E.enter(seg(u, 0, 0.5)), ya = y + (1 - kin) * 30 * s, pad = 36 * s, declined = S.state === 'declined', final = declined ? dan : acc;
    const trH = 84 * s, trW = w - 2 * pad, trX = x + pad, trY = ya + h - pad - trH - (p.decline ? 58 * s : 0) - 26 * s, thr = trH / 2 - 8 * s, thX = lerp(trX + trH / 2, trX + trW - trH / 2, S.thumb);
    const done = S.state === 'approved' || S.state === 'declined', kf = done ? S.flipK : 0, rid = 'ap';
    let defs = `<filter id="${rid}g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${f2(34 * s)}"/></filter><clipPath id="${rid}c"><rect x="${f2(trX)}" y="${f2(trY)}" width="${f2(trW)}" height="${f2(trH)}" rx="${f2(trH / 2)}"/></clipPath>` +
      `<linearGradient id="${rid}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.5"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`;
    let out = `<g data-state="${S.state}" opacity="${f2(o)}">`;
    if (S.glow > 0.004 || kf > 0.02) out += `<g style="mix-blend-mode:screen" opacity="${f2(clamp(S.glow * 0.9 + kf * 0.25))}" filter="url(#${rid}g)"><rect x="${f2(x - 20 * s)}" y="${f2(ya - 20 * s)}" width="${f2(w + 40 * s)}" height="${f2(h + 40 * s)}" rx="${f2(40 * s)}" fill="${acc}"/></g>`;
    out += `<rect x="${f2(x)}" y="${f2(ya)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(30 * s)}" fill="${pan}" fill-opacity="${f2(0.95 * kin)}" stroke="${done ? final : '#FFFFFF'}" stroke-opacity="${f2(done ? 0.9 : 0.16)}" stroke-width="${f2(done ? 2.4 * s : 1.5 * s)}"/>`;
    /* the request */
    const hk = E.enter(seg(u, 0.1, 0.55)); out += `<g opacity="${f2(hk)}"><path d="M${f2(x + pad + 24 * s)} ${f2(ya + pad + 2 * s)}l${f2(23 * s)} ${f2(9 * s)}v${f2(19 * s)}q0 ${f2(16 * s)} ${f2(-23 * s)} ${f2(26 * s)}q${f2(-23 * s)} ${f2(-10 * s)} ${f2(-23 * s)} ${f2(-26 * s)}v${f2(-19 * s)}z" fill="none" stroke="${acc}" stroke-width="${f2(3 * s)}" stroke-linejoin="round"/>` +
      text(str(p.title, 'Agent request', 40), x + pad + 62 * s, ya + pad + 32 * s, { size: 38 * s, weight: 800, fill: ink }) + text(str(p.detail, '', 80), x + pad, ya + pad + 90 * s, { size: 28 * s, weight: 600, fill: mut });
    list(p.items, 4).forEach((it, i) => { const yy = ya + pad + 150 * s + i * 62 * s; out += `<rect x="${f2(x + pad)}" y="${f2(yy - 34 * s)}" width="${f2(trW)}" height="${f2(50 * s)}" rx="${f2(12 * s)}" fill="#FFFFFF" fill-opacity="0.06"/>` + text(str(it, '', 60), x + pad + 18 * s, yy, { size: 26 * s, weight: 600, fill: ink }); });
    out += '</g>';
    /* the track */
    out += `<defs>${defs}</defs><rect x="${f2(trX)}" y="${f2(trY)}" width="${f2(trW)}" height="${f2(trH)}" rx="${f2(trH / 2)}" fill="#FFFFFF" fill-opacity="0.09"/><g clip-path="url(#${rid}c)">`;
    if (!done) out += `<rect x="${f2(trX)}" y="${f2(trY)}" width="${f2(thX - trX + thr)}" height="${f2(trH)}" fill="${acc}" fill-opacity="${f2(0.35 * S.thumb)}"/>`;
    if (S.state === 'pending') { const sh = ((u * 0.55) % 1) * (trW + 240 * s) - 120 * s; out += `<rect x="${f2(trX + sh - 120 * s)}" y="${f2(trY)}" width="${f2(240 * s)}" height="${f2(trH)}" fill="url(#${rid}s)" opacity="0.3"/>`; }
    if (done) out += `<rect x="${f2(trX)}" y="${f2(trY)}" width="${f2(trW * clamp(kf * 1.1))}" height="${f2(trH)}" fill="${final}"/>`;
    out += '</g>';
    const lab = done ? lb[S.state] : S.state === 'approving' ? lb.working : lb.pending, labFill = done ? '#06140C' : ink, la = S.state === 'sliding' ? 1 - S.thumb : 1;
    if (!(S.state === 'approving')) out += text(str(lab, '', 30), trX + trW / 2 + (done ? 0 : 30 * s), trY + trH / 2 + 10 * s, { size: 30 * s, weight: 800, fill: labFill, anchor: 'middle', ls: 0.5 * s, op: clamp(done ? kf : la) });
    else out += text(str(lab, '', 30), trX + trW / 2, trY + trH / 2 + 10 * s, { size: 30 * s, weight: 800, fill: ink, anchor: 'middle', ls: 0.5 * s });
    if (!done) { const tcx = S.state === 'approving' ? trX + trW - trH / 2 : thX, tcy = trY + trH / 2;
      out += `<circle cx="${f2(tcx)}" cy="${f2(tcy)}" r="${f2(thr)}" fill="#FFFFFF"/>`;
      if (S.state === 'approving') { const a0 = S.spin * TAU, r = thr * 0.55; out += `<path d="M${f2(tcx + Math.cos(a0) * r)} ${f2(tcy + Math.sin(a0) * r)}A${f2(r)} ${f2(r)} 0 1 1 ${f2(tcx + Math.cos(a0 + 4.4) * r)} ${f2(tcy + Math.sin(a0 + 4.4) * r)}" fill="none" stroke="#14161D" stroke-width="${f2(5 * s)}" stroke-linecap="round"/>`; }
      else out += `<path d="M${f2(tcx - 7 * s)} ${f2(tcy - 12 * s)}l${f2(12 * s)} ${f2(12 * s)}l${f2(-12 * s)} ${f2(12 * s)}" fill="none" stroke="#14161D" stroke-width="${f2(5 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`; }
    else { const cx = trX + trH / 2 + 4 * s, cy = trY + trH / 2; out += declined ? `<path d="M${f2(cx - 10 * s)} ${f2(cy - 10 * s)}l${f2(20 * s)} ${f2(20 * s)}m${f2(-20 * s)} 0l${f2(20 * s)} ${f2(-20 * s)}" fill="none" stroke="#06140C" stroke-width="${f2(6 * s)}" stroke-linecap="round" opacity="${f2(kf)}"/>`
      : `<path d="M${f2(cx - 14 * s)} ${f2(cy)}l${f2(10 * s)} ${f2(11 * s)}l${f2(19 * s)} ${f2(-22 * s)}" fill="none" stroke="#06140C" stroke-width="${f2(6.5 * s)}" stroke-linecap="round" stroke-linejoin="round" opacity="${f2(kf)}"/>`; }
    if (p.decline) { const dk = 1 - clamp(S.thumb * 1.4) * (done ? 1 : 0.6); out += text('Decline', trX + trW / 2, trY + trH + 52 * s, { size: 26 * s, weight: 700, fill: declined ? dan : mut, anchor: 'middle', op: clamp(dk * kin) }); }
    const lbl = str(p.label, '', 60); if (lbl) out += text(lbl, x + w / 2, ya + h + 38 * s, { size: 22 * s, weight: 600, fill: mut, anchor: 'middle', op: 0.95 });
    return out + '</g>';
  } };

export const REVIEW_GFX = { 'ui.reviewLayer': REVIEW, 'ui.approvalSlider': APPROVE };
for (const g of Object.values(REVIEW_GFX)) g.file = 'type/gfx/review.js';
export const REVIEW_CUES = {
  'ui.reviewLayer': (p) => [...list(p.pins, 8).filter((q) => q && typeof q === 'object').map((q, i) => ({ t: num(q.at, 0.9, 0, 1e4), id: 'sfx/ui/pop', why: `comment pin ${i + 1} pops` })),
    ...(obj(p.record).at != null || p.record === undefined ? [{ t: num(obj(p.record).at, 2.4, 0, 1e4), id: 'sfx/ui/mic_on', why: 'the record pill starts' }] : []),
    ...(p.slider === undefined || p.slider ? [{ t: num(obj(p.slider).at, 3, 0, 1e4), id: 'sfx/ui/toast_in', why: 'the rating question lands' }] : [])],
  'ui.approvalSlider': (p) => { const T = approvalTimes(p); return [{ t: T.slideStart, id: 'sfx/ui/drag_lift', why: 'the thumb is grabbed' }, { t: T.approvedAt, id: 'sfx/ui/success_chime', why: p.outcome === 'declined' ? 'the state flips to declined (replace with sfx/ui/error if you want a different sound)' : 'the state flips to approved: the loudest point of the mix goes here' }]; },
};
