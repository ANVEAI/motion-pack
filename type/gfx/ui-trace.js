/* motion-pack / type / gfx / ui-trace.js: explainer + people parts, round 4+5 (2026-10-14). Same contract as ui.js (svg(L, p, ctx) -> SVG, a pure function of t,
   closed-form springs, `scale` / `theme` / `accent`, one sound per action). Generic layouts and copy of our own; nothing from a reference is reproduced.
     ui.branchTrace         input card -> N parallel lanes of step boxes (2-4 fork options each, one correct) -> decision card -> pass / fail badge. The run is a list
                            of chosen fork ids: 'pass' lights the path, a wrong pick turns red and the red runs down the lane's edges to the decision and the result.
                            Edge colour is a function of t and the run's step times (never accumulated). A caption bar under the diagram changes per step.
     caption.sceneBubble    a speech bubble anchored beside a speaker in footage (static or tracked anchor). Words appear on their own timestamps (words.json shape
                            [{w, s, e}]), the bubble ticks "Captured" and can dock into a dark glass list card (`dock.fill` overrides it). Width is fixed from the final text (no reflow). Speaker label
                            always on; `ai: true` adds an "AI voice" badge for synthetic speech.
     lowerThird.personalTag name + role super with a second tier: a round avatar / initials chip and one personal line; tier 2 arrives 0.3 s after the name, leaves first
     ui.promptBar.attach    ui.promptBar with its `attach` param set (a thumbnail is dragged in and docks as a chip before the request is typed); same code (ui.js) */
import { E, clamp, lerp, seg, TAU, BRAND, f2, text, measure, anchor } from './core.js';
import { springTrack, spring } from '../ease.js';
import { KIT, UI, UI_CUES, ATTACH, rr, TICKS, POPS } from './ui.js';
import { wrapWords } from './ui-data.js';
import { stepAt } from './swap.js';
import { trackAt } from './ui-proof.js';
const { th, GREEN, bx, uid, op, rect, shadowDef, softShadow, icon, checkBadge } = KIT;
const RED = '#E5484D';
const fade = (L) => op(clamp(L.in * 1.5) * (1 - L.out));
const pill = (x, y, w, h, fill, extra = '') => rect(x, y, w, h, h / 2, fill, extra);

/* ---------- 1. branch trace ---------- */
const F = (id, label) => ({ id, label });
const LANES = [
  { label: 'Intent', icon: 'search', steps: [{ label: 'Classify', forks: [F('in-move', 'Reschedule'), F('in-cancel', 'Cancel')], correct: 'in-move' }, { label: 'Details', forks: [F('in-keep', 'Same party size'), F('in-size', 'New party size')], correct: 'in-keep' }] },
  { label: 'Identity', icon: 'user', steps: [{ label: 'Verify', forks: [F('id-code', 'Code matches'), F('id-name', 'Name only')], correct: 'id-code' }, { label: 'Account', forks: [F('id-found', 'Booking found'), F('id-guest', 'Guest booking')], correct: 'id-found' }] },
  { label: 'Calendar', icon: 'clock', steps: [{ label: 'Read', forks: [F('ca-read', 'Read the slots'), F('ca-guess', 'Guess a slot')], correct: 'ca-read' }, { label: 'Slot', forks: [F('ca-free', 'Fri 10:00 free'), F('ca-taken', 'Fri 10:00 taken')], correct: 'ca-free' }] }];
const DECISION = { title: 'Decision', forks: [F('d-move', 'Move the booking'), F('d-human', 'Pass to a person')], correct: 'd-move' };
/* lint: every picked id must exist, at most one pick per step; [] when the run is valid */
export function lintBranchTrace(p) { const errs = [], known = new Map(); p.lanes.forEach((ln, i) => ln.steps.forEach((st, k) => st.forks.forEach((f) => known.set(f.id, `${i}:${k}`)))); p.decision.forks.forEach((f) => known.set(f.id, 'dec'));
  const used = new Map(); for (const id of p.run || []) { if (!known.has(id)) errs.push(`run picks "${id}", which is not a fork of any step`); else { const at = known.get(id); if (used.has(at)) errs.push(`two picks for one step: "${used.get(at)}" and "${id}"`); used.set(at, id); } }
  p.lanes.forEach((ln) => ln.steps.forEach((st) => { if (!st.forks.some((f) => f.id === st.correct)) errs.push(`step "${st.label}" has no correct fork "${st.correct}"`); })); return errs; }
const chosen = (st, run) => (st.forks.find((f) => (run || []).includes(f.id)) || st.forks.find((f) => f.id === st.correct)).id;
/* every time in the run, from params only: lanes resolve their steps in parallel (laneLag apart); the first wrong pick is the failure, red spreads from it */
export function traceTimes(p) { const nL = p.lanes.length, nS = Math.max(...p.lanes.map((l) => l.steps.length)), ed = p.edgeDur;
  const edgeStart = (i, k) => p.runAt + k * p.stepDur + i * p.laneLag, resolve = (i, k) => edgeStart(i, k) + ed, decisionAt = p.runAt + nS * p.stepDur + (nL - 1) * p.laneLag + ed, outcomeAt = decisionAt + 0.15 + ed;
  let fail = null; p.lanes.forEach((ln, i) => ln.steps.forEach((st, k) => { const c = chosen(st, p.run); if (c !== st.correct && (!fail || resolve(i, k) < fail.t)) fail = { lane: i, k, t: resolve(i, k) }; }));
  const dpick = chosen(p.decision, p.run); if (!fail && dpick !== p.decision.correct) fail = { lane: -1, k: -1, t: decisionAt };
  const red = (lane, k, start) => { if (!fail) return null; let d; if (lane === 'out') d = fail.lane < 0 ? 1 : p.lanes[fail.lane].steps.length - fail.k + 1; else if (lane !== fail.lane || k <= fail.k) return null; else d = k - fail.k;
    return Math.max(fail.t + d * p.delay, start); };   // red never outruns the run: an edge turns red no earlier than the run reaches it
  return { nL, nS, ed, edgeStart, resolve, decisionAt, outcomeAt: fail ? Math.max(outcomeAt, red('out', 0, decisionAt + 0.15) + ed) : outcomeAt, fail, dpick, red, laneAt: (i) => p.lanesAt + i * p.laneStagger }; }
export function traceCaptions(p) { if (p.captions) return p.captions; const tm = traceTimes(p), out = [[0, 'One request, three checks side by side.'], [p.runAt, 'Every step has options. Only one is right.']];
  if (!tm.fail) out.push([tm.decisionAt, 'Every check is right, so the decision is right.'], [tm.outcomeAt, 'The run passes.']);
  else { out.push([tm.fail.t, 'One wrong pick turns red…'], [tm.fail.t + 0.9, '…and the red runs down the line to the result.']);
    out.push([tm.outcomeAt, tm.dpick === p.decision.correct ? 'The run fails, even with the right final decision.' : 'The run fails.']); }
  return out.sort((a, b) => a[0] - b[0]); }
export const captionAt = (p, u) => stepAt(traceCaptions(p), u, 0.25);
function traceGeo(p, c) { const [x, y, w, h] = bx(p.box, c), s = c.s, capH = p.caption ? 66 * s : 0, dh = h - capH - (capH ? 22 * s : 0), nL = p.lanes.length, nS = Math.max(...p.lanes.map((l) => l.steps.length));
  const iw = 0.15 * w, ih = Math.min(220 * s, dh * 0.42), inp = [x, y + (dh - ih) / 2, iw, ih], lx0 = x + 0.2 * w, lx1 = x + 0.735 * w, lh = dh / nL, gap = 34 * s;
  const nF = Math.max(...p.lanes.flatMap((l) => l.steps.map((st) => st.forks.length))), lanes = p.lanes.map((ln, i) => { const lh0 = lh - 16 * s, sh = Math.min(lh0 - 58 * s, 52 * s + nF * 46 * s), lhh = Math.min(lh0, sh + 62 * s), ly = y + i * lh + 8 * s + (lh0 - lhh) / 2, sw = (lx1 - lx0 - 28 * s - gap * (nS - 1)) / nS, sy = ly + 46 * s;
    return { box: [lx0, ly, lx1 - lx0, lhh], steps: ln.steps.map((_, k) => [lx0 + 14 * s + k * (sw + gap), sy, sw, sh]) }; });
  const nd = p.decision.forks.length, dw = 0.155 * w, dhh = Math.min(dh * 0.6, 92 * s + nd * 50 * s), dec = [x + 0.785 * w, y + (dh - dhh) / 2, dw, dhh], R = Math.min(40 * s, 0.03 * w), out = [x + w - R - 6 * s, y + dh / 2];
  return { x, y, w, h, s, dh, capH, inp, lanes, dec, R, out }; }
const bez = (a, b) => { const m = (b[0] - a[0]) * 0.5; return [a, [a[0] + m, a[1]], [b[0] - m, b[1]], b]; };
const bezD = ([a, b, c2, d]) => `M${f2(a[0])} ${f2(a[1])} C${f2(b[0])} ${f2(b[1])} ${f2(c2[0])} ${f2(c2[1])} ${f2(d[0])} ${f2(d[1])}`;
const bezLen = (B) => { let l = 0, q = B[0]; for (let i = 1; i <= 24; i++) { const k = i / 24, m = 1 - k, r = [0, 1].map((j) => m * m * m * B[0][j] + 3 * m * m * k * B[1][j] + 3 * m * k * k * B[2][j] + k * k * k * B[3][j]); l += Math.hypot(r[0] - q[0], r[1] - q[1]); q = r; } return l; };
const drawn = (B, k, col, sw, extra = '') => { if (k <= 0) return ''; const L = bezLen(B); return `<path d="${bezD(B)}" fill="none" stroke="${col}" stroke-width="${f2(sw)}" stroke-linecap="round" stroke-dasharray="${f2(L)} ${f2(L + 1)}" stroke-dashoffset="${f2(L * (1 - clamp(k)))}" ${extra}/>`; };

/* ---------- 2. scene bubble ---------- */
const SAY = 'Remind me to call the venue before five';
const WORDS = SAY.split(' ').map((w, i) => ({ w, s: +(0.35 + i * 0.27).toFixed(3), e: +(0.35 + i * 0.27 + 0.22).toFixed(3) }));
/* bubble geometry: fixed size from the FINAL text (no reflow while words arrive), placed beside the anchor, clamped inside the safe rect; then docked by springTrack */
export function bubbleGeo(p, c, u) { const s = c.s, S = p.size * s, pad = 0.75 * S, Sf = c.safe, maxW = Math.min(p.maxW * s, Sf.w - 2 * pad - 40 * s), all = p.words.map((q) => q.w).join(' '), lines = balanced(all, S, maxW);
  const hs = 0.62 * S, head = hs + 0.7 * S, badgeW = p.ai && p.aiLabel ? measure(p.aiLabel, hs * 0.9, { weight: 700 }) + 0.9 * S : 0, headW = 1.3 * S + measure(p.speaker + (p.capturedLabel ? '  ·  ' + p.capturedLabel : ''), hs, { weight: 700 }) + badgeW;
  const lw = lines.map((ln) => measure(ln.join(' '), S, { weight: 600 })), bw = Math.max(headW, ...lw) + 2 * pad, bh = head + lines.length * 1.3 * S + 1.3 * pad, [fx, fy] = trackAt(p.anchor, u), ax = fx * c.W, ay = fy * c.H;
  let x0 = p.side === 'left' ? ax - p.offset[0] * s - bw : ax + p.offset[0] * s, y0 = ay + p.offset[1] * s; x0 = clamp(x0, Sf.x0, Sf.x1 - bw); y0 = clamp(y0, Sf.y0, Sf.y1 - bh);
  let x = x0, y = y0, sc = 1, dk = 0, dx = 0, dy = 0, dw = 0, dh = 0; if (p.dock) { dk = clamp(springTrack(u, [[0, 0], [p.dock.at, 1]], 'panel'), 0, 1.05);
    dw = bw * p.dock.scale + 48 * s; dh = bh * p.dock.scale + 150 * s; dx = clamp(p.dock.to[0] * c.W, Sf.x0 + 24 * s, Sf.x1 - dw + 24 * s); dy = clamp(p.dock.to[1] * c.H, Sf.y0 + 74 * s, Sf.y1 - dh + 74 * s);   // the dock card (list) is clamped inside the safe rect too
    x = lerp(x0, dx, dk); y = lerp(y0, dy, dk); sc = lerp(1, p.dock.scale, dk); }
  return { S, pad, hs, head, lines, bw, bh, ax, ay, x, y, sc, dk, badgeW, dx, dy, dw, dh }; }
/* balanced wrap: same line count as a greedy wrap at maxW, but the narrowest width that keeps it (no one-word orphan line) */
function balanced(str, S, maxW) { const g = wrapWords(str, S, 600, maxW), n = g.length; if (n < 2) return g; const tot = measure(str, S, { weight: 600 });
  for (let w = tot / n; w < maxW; w += S * 0.5) { const t = wrapWords(str, S, 600, w); if (t.length === n) return t; } return g; }
const capturedAt = (p) => p.capturedAt ?? p.words.at(-1).e + 0.3;

/* ---------- 3. personal tag ---------- */
const PT_OUT = 9 / 30;

export const TRACE = {
  'ui.branchTrace': { file: 'type/gfx/ui-trace.js', tags: ['ui', 'diagram', 'pipeline', 'decision', 'branches', 'failure', 'explainer', 'trust', 'benchmark'], dur: 6.4, inF: 8, outF: 9,
    d: { box: [0.04, 0.08, 0.92, 0.82], input: { title: 'Request', lines: ['"Move my booking', 'to Friday morning"'], icon: 'mail' }, lanes: LANES, decision: DECISION, run: ['id-name'],
      lanesAt: 0.35, laneStagger: 0.12, runAt: 1.3, stepDur: 0.8, laneLag: 0.1, edgeDur: 0.3, delay: 0.3, outcome: { pass: 'Pass', fail: 'Fail' }, caption: true, captions: null, note: 'illustrative run', theme: 'light', accent: BRAND },
    svg(L, p, c) { const T = th(p), u = L.u, G = traceGeo(p, c), s = G.s, id = uid('bt', G.x, G.y, G.w, G.h), errs = lintBranchTrace(p);
      if (errs.length) return `<g${fade(L)}>${rect(G.x, G.y, Math.min(G.w, 1100 * s), 140 * s, 18 * s, '#FFFFFF', `stroke="${RED}" stroke-width="${f2(3 * s)}"`)}${text('ui.branchTrace: the run does not match the diagram', G.x + 28 * s, G.y + 52 * s, { size: 28 * s, weight: 800, fill: RED })}${text(errs[0], G.x + 28 * s, G.y + 96 * s, { size: 21 * s, weight: 600, fill: '#16151B' })}</g>`;
      const tm = traceTimes(p), ed = tm.ed, mid = (b, side) => [side ? b[0] + b[2] : b[0], b[1] + b[3] / 2], failed = !!tm.fail, sw = 3 * s;
      const card = (b, k, border, extra = '') => k <= 0 ? '' : softShadow(id + 's', b[0], b[1], b[2], b[3], 16 * s, s, 0.6 * k) + rect(b[0], b[1], b[2], b[3], 16 * s, T.panel, `stroke="${border}" stroke-width="${f2((border === T.line ? 1.5 : 2.4) * s)}" ${extra}`);
      let edges = '', nodes = '';
      // input card
      const ik = spring(u - 0.05, 'ui'), I = G.inp; nodes += `<g${op(clamp(ik * 1.4))}>${card(I, ik, T.line)}${rect(I[0] + 18 * s, I[1] + 20 * s, 40 * s, 40 * s, 10 * s, T.chip)}${icon(p.input.icon || 'doc', I[0] + 26 * s, I[1] + 28 * s, 24 * s, p.accent, 2.2 * s)}` +
        text(p.input.title, I[0] + 70 * s, I[1] + 48 * s, { size: 22 * s, weight: 800, fill: T.ink }) + p.input.lines.map((l, j) => text(l, I[0] + 20 * s, I[1] + 98 * s + j * 32 * s, { size: 22 * s, weight: 600, fill: T.muted })).join('') + '</g>';
      // lanes, steps, forks
      p.lanes.forEach((ln, i) => { const Ln = G.lanes[i], lk = spring(u - tm.laneAt(i), 'panel'); if (lk <= 0) return; const lb = Ln.box;
        edges += `<path d="${bezD(bez(mid(I, 1), mid(Ln.steps[0], 0)))}" fill="none" stroke="${T.line}" stroke-width="${f2(2 * s)}" opacity="${f2(lk)}"/>` + drawn(bez(mid(I, 1), mid(Ln.steps[0], 0)), seg(u, tm.edgeStart(i, 0), tm.edgeStart(i, 0) + ed), p.accent, sw);
        let o = rect(lb[0], lb[1], lb[2], lb[3], 20 * s, T.chip, 'opacity="0.55"') + icon(ln.icon || 'doc', lb[0] + 16 * s, lb[1] + 11 * s, 22 * s, T.muted, 2 * s) + text(ln.label, lb[0] + 46 * s, lb[1] + 30 * s, { size: 21 * s, weight: 800, fill: T.ink });
        ln.steps.forEach((st, k) => { const B = Ln.steps[k], tr = tm.resolve(i, k), res = u >= tr, ch = chosen(st, p.run), redAt = tm.red(i, k, tm.edgeStart(i, k)), isFail = tm.fail && tm.fail.lane === i && tm.fail.k === k;
          const redK = redAt != null ? seg(u, redAt + ed, redAt + ed + 0.15) : isFail ? seg(u, tr, tr + 0.15) : 0, border = redK > 0.5 ? RED : res ? (ch === st.correct ? GREEN : RED) : T.line;
          if (k) { const Bp = bez(mid(Ln.steps[k - 1], 1), mid(B, 0)), es = tm.edgeStart(i, k); edges += `<path d="${bezD(Bp)}" fill="none" stroke="${T.line}" stroke-width="${f2(2 * s)}" opacity="${f2(lk)}"/>` + (redAt != null ? drawn(Bp, seg(u, redAt, redAt + ed), RED, sw) : drawn(Bp, seg(u, es, es + ed), p.accent, sw)); }
          o += card(B, 1, border) + text(st.label.toUpperCase(), B[0] + 16 * s, B[1] + 27 * s, { size: 15 * s, weight: 800, fill: T.muted, ls: 1.2 });
          const nf = st.forks.length, fh = Math.min(38 * s, (B[3] - 46 * s) / nf - 6 * s); st.forks.forEach((f, j) => { const fy = B[1] + 40 * s + j * (fh + 6 * s), fx = B[0] + 12 * s, fw = B[2] - 24 * s, isC = f.id === ch, ok = f.id === st.correct, fk = res ? spring(u - tr, 'headline') : 0;
            const col = isC && res ? (ok ? GREEN : RED) : null, dim = res && !isC ? 0.45 : 1, shake = isC && !ok && res ? Math.sin(TAU * 9 * (u - tr)) * Math.exp(-6 * (u - tr)) * 6 * s : 0;
            o += `<g${op(dim)} transform="translate(${f2(shake)} 0)">${rect(fx, fy, fw, fh, 9 * s, col || T.panel, col ? `opacity="${f2(0.16 * clamp(fk))}"` : `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`)}` + (col ? rect(fx, fy, fw, fh, 9 * s, 'none', `stroke="${col}" stroke-width="${f2(2 * s)}"`) : '') +
              text(f.label, fx + 14 * s, fy + fh / 2 + 7 * s, { size: 19 * s, weight: isC && res ? 800 : 600, fill: col || T.ink }) +
              (col ? (ok ? checkBadge(fx + fw - 18 * s, fy + fh / 2, 10 * s, u - tr, GREEN) : `<path d="M${f2(fx + fw - 24 * s)} ${f2(fy + fh / 2 - 6 * s)} l${f2(12 * s)} ${f2(12 * s)} M${f2(fx + fw - 12 * s)} ${f2(fy + fh / 2 - 6 * s)} l${f2(-12 * s)} ${f2(12 * s)}" stroke="${RED}" stroke-width="${f2(2.6 * s)}" stroke-linecap="round" opacity="${f2(clamp(fk))}"/>`) : '') + '</g>'; });
          if (isFail && u >= tr) { const r0 = u - tr; if (r0 < 1) o += rect(B[0] - 10 * s * r0, B[1] - 10 * s * r0, B[2] + 20 * s * r0, B[3] + 20 * s * r0, 18 * s, 'none', `stroke="${RED}" stroke-width="${f2(2 * s)}" opacity="${f2(0.7 * (1 - r0))}"`); } });
        nodes += `<g${op(clamp(lk * 1.4))} transform="translate(${f2(20 * s * (1 - lk))} 0)">${o}</g>`;
        // last step -> decision
        const kL = ln.steps.length, Bd = bez(mid(Ln.steps[kL - 1], 1), mid(G.dec, 0)), es = tm.edgeStart(i, tm.nS), rd = tm.red(i, kL, es);
        edges += `<path d="${bezD(Bd)}" fill="none" stroke="${T.line}" stroke-width="${f2(2 * s)}" opacity="${f2(lk)}"/>` + (rd != null ? drawn(Bd, seg(u, rd, rd + ed), RED, sw) : drawn(Bd, seg(u, es, es + ed), p.accent, sw)); });
      // decision card
      const D = G.dec, dk = spring(u - tm.laneAt(p.lanes.length), 'panel'), dRes = u >= tm.decisionAt, dRedAt = tm.fail ? (tm.fail.lane < 0 ? tm.decisionAt : tm.red(tm.fail.lane, p.lanes[tm.fail.lane].steps.length, tm.edgeStart(tm.fail.lane, tm.nS)) + ed) : null, dRed = dRedAt != null && u >= dRedAt;
      let dd = card(D, dk, dRed ? RED : dRes ? GREEN : T.line) + text(p.decision.title.toUpperCase(), D[0] + 18 * s, D[1] + 34 * s, { size: 16 * s, weight: 800, fill: dRed ? RED : T.muted, ls: 1.2 });
      p.decision.forks.forEach((f, j) => { const fy = D[1] + 54 * s + j * 50 * s, isC = f.id === tm.dpick, ok = f.id === p.decision.correct, col = dRes && isC ? (ok ? GREEN : RED) : null;
        dd += `<g${op(dRes && !isC ? 0.45 : 1)}>${rect(D[0] + 14 * s, fy, D[2] - 28 * s, 40 * s, 9 * s, col || T.panel, col ? 'opacity="0.16"' : `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`)}${col ? rect(D[0] + 14 * s, fy, D[2] - 28 * s, 40 * s, 9 * s, 'none', `stroke="${col}" stroke-width="${f2(2 * s)}"`) : ''}` +
          text(f.label, D[0] + 28 * s, fy + 27 * s, { size: 19 * s, weight: col ? 800 : 600, fill: col || T.ink }) + '</g>'; });
      nodes += `<g${op(clamp(dk * 1.4))}>${dd}</g>`;
      // decision -> outcome
      const Bo = bez(mid(D, 1), [G.out[0] - G.R, G.out[1]]), oes = tm.decisionAt + 0.15, ord = tm.red('out', 0, oes);
      edges += `<path d="${bezD(Bo)}" fill="none" stroke="${T.line}" stroke-width="${f2(2 * s)}" opacity="${f2(dk)}"/>` + (ord != null ? drawn(Bo, seg(u, ord, ord + ed), RED, sw) : drawn(Bo, seg(u, oes, oes + ed), p.accent, sw));
      const ok2 = !failed, okk = spring(u - tm.outcomeAt, 'headline'), [ox, oy] = G.out, R = G.R, col = ok2 ? GREEN : RED;
      let badge = `<circle cx="${f2(ox)}" cy="${f2(oy)}" r="${f2(R)}" fill="${T.panel}" stroke="${T.faint}" stroke-width="${f2(2 * s)}" stroke-dasharray="${f2(5 * s)} ${f2(5 * s)}" opacity="${f2(dk)}"/>`;
      if (okk > 0) badge += `<g transform="translate(${f2(ox)} ${f2(oy)}) scale(${f2(Math.max(0.001, okk))}) translate(${f2(-ox)} ${f2(-oy)})"><circle cx="${f2(ox)}" cy="${f2(oy)}" r="${f2(R)}" fill="${col}"/>` +
        (ok2 ? `<path d="M${f2(ox - R * 0.4)} ${f2(oy)} l${f2(R * 0.28)} ${f2(R * 0.3)} l${f2(R * 0.55)} ${f2(-R * 0.6)}" fill="none" stroke="#FFF" stroke-width="${f2(R * 0.17)}" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M${f2(ox - R * 0.32)} ${f2(oy - R * 0.32)} l${f2(R * 0.64)} ${f2(R * 0.64)} M${f2(ox + R * 0.32)} ${f2(oy - R * 0.32)} l${f2(-R * 0.64)} ${f2(R * 0.64)}" stroke="#FFF" stroke-width="${f2(R * 0.17)}" stroke-linecap="round"/>`) +
        `</g>` + text(ok2 ? p.outcome.pass : p.outcome.fail, ox, oy + R + 34 * s, { size: 24 * s, weight: 800, fill: col, anchor: 'middle', op: clamp(okk) });
      let cap = ''; if (p.caption) { const cy = G.y + G.dh + 22 * s, st = captionAt(p, u), ck = E.enter(st.k);
        cap = rect(G.x, cy, G.w, G.capH, G.capH / 2, T.chip) + `<g${op(1 - ck)}>${text(st.prev, G.x + 36 * s, cy + G.capH / 2 + 9 * s - 10 * s * ck, { size: 26 * s, weight: 700, fill: T.ink })}</g>` +
          `<g${op(ck)}>${text(st.cur, G.x + 36 * s, cy + G.capH / 2 + 9 * s + 10 * s * (1 - ck), { size: 26 * s, weight: 700, fill: T.ink })}</g>` + (p.note ? text(p.note, G.x + G.w - 32 * s, cy + G.capH / 2 + 7 * s, { size: 18 * s, weight: 600, fill: T.muted, anchor: 'end' }) : ''); }
      return `<defs>${shadowDef(id + 's', s)}</defs><g${fade(L)}>${edges}${nodes}${badge}${cap}</g>`; } },

  'caption.sceneBubble': { file: 'type/gfx/ui-trace.js', tags: ['caption', 'speech-bubble', 'transcript', 'voice', 'footage', 'tracked', 'speaker', 'honesty'], dur: 4.6, inF: 4, outF: 8,
    d: { words: WORDS, anchor: [0.4, 0.3], side: 'right', offset: [36, -150], size: 30, maxW: 540, speaker: 'Speaker', ai: false, aiLabel: 'AI voice', capturedLabel: 'Captured', capturedAt: null,
      dock: null, fill: 'rgba(32,30,28,0.58)', ink: '#FFFFFF', accent: '#7FE3A6' },
    svg(L, p, c) { const u = L.u, G = bubbleGeo(p, c, u), s = c.s, S = G.S, first = p.words[0].s - 0.12, k = spring(u - first, 'ui'), id = uid('sb', G.bw, G.bh, p.words.length, p.words[0].s); if (k <= 0) return '';
      const cap = capturedAt(p), done = u >= cap, speaking = !done && u < p.words.at(-1).e + 0.1, x = G.x, y = G.y, hy = y + G.pad * 0.55 + G.hs;
      let head = done ? checkBadge(x + G.pad + 0.36 * S, hy - 0.3 * G.hs, 0.36 * S, u - cap, p.accent, '#16151B') : '';
      if (!done) for (let j = 0; j < 4; j++) { const a = speaking ? 0.35 + 0.65 * Math.abs(Math.sin(TAU * (1.3 + 0.4 * j) * u + j)) : 0.3; head += rect(x + G.pad + j * 0.2 * S, hy - 0.3 * G.hs - 0.32 * S * a, 0.11 * S, 0.64 * S * a, 0.05 * S, p.ink, 'opacity="0.8"'); }
      head += text(p.speaker + (done && p.capturedLabel ? '  ·  ' + p.capturedLabel : ''), x + G.pad + 1.0 * S, hy, { size: G.hs, weight: 700, fill: done ? p.accent : p.ink, op: done ? 1 : 0.7 });
      if (p.ai && p.aiLabel) { const bx0 = x + G.bw - G.pad - G.badgeW + 0.3 * S; head += pill(bx0, hy - 0.86 * G.hs, G.badgeW - 0.3 * S, 1.2 * G.hs, 'none', `stroke="${p.ink}" stroke-width="${f2(1.4 * s)}" opacity="0.8"`) + text(p.aiLabel, bx0 + 0.3 * S, hy - 0.02 * G.hs, { size: G.hs * 0.9, weight: 700, fill: p.ink }); }
      let body = '', wi = 0; G.lines.forEach((ln, li) => { let wx = x + G.pad; const ly = y + G.head + G.pad * 0.55 + (li + 0.82) * 1.3 * S; for (const wd of ln) { const wq = p.words[wi++], a = wq ? seg(u, wq.s, wq.s + 0.08) : 1;
        if (a > 0) body += text(wd, wx, ly + 0.15 * S * (1 - a), { size: S, weight: 600, fill: p.ink, op: a }); wx += measure(wd + ' ', S, { weight: 600 }); } });
      const tailOn = (1 - G.dk) * clamp(k), tx0 = p.side === 'left' ? x + G.bw : x, ty0 = y + G.bh * 0.7, tail = tailOn > 0.02 && Math.hypot(G.ax - tx0, G.ay - ty0) > 30 * s ? (() => { const dx = G.ax - tx0, dy = G.ay - ty0, dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl, tip = [tx0 + ux * Math.min(dl * 0.55, 46 * s), ty0 + uy * Math.min(dl * 0.55, 46 * s)];
        return `<path d="M${f2(tx0)} ${f2(ty0 - 14 * s)} L${f2(tip[0])} ${f2(tip[1])} L${f2(tx0)} ${f2(ty0 + 14 * s)} Z" fill="${p.fill}" opacity="${f2(tailOn)}"/>`; })() : '';
      const d1 = clamp(G.dk, 0, 1), cx = lerp(x + (p.side === 'left' ? G.bw : 0), x, d1), cy = lerp(y + G.bh * 0.7, y, d1), sc = G.sc * lerp(0.86, 1, k);   // scale about the tail side, and about the top-left once docked (the docked box then sits exactly in the card)
      const dockCard = p.dock ? (() => { const dk2 = spring(u - p.dock.at + 0.25, 'panel'); if (dk2 <= 0) return ''; const tx = G.dx, ty = G.dy, cw = G.dw, chh = G.dh;
        return `<g${op(clamp(dk2 * 1.3))}>${rect(tx - 24 * s, ty - 74 * s, cw, chh, 22 * s, p.dock.fill || 'rgba(14,13,20,0.86)', `stroke="rgba(255,255,255,0.14)" stroke-width="${f2(1.5 * s)}"`)}${text(p.dock.title || 'Notes', tx, ty - 30 * s, { size: 24 * s, weight: 800, fill: p.ink })}` +
          rect(tx, ty + G.bh * p.dock.scale + 22 * s, cw * 0.62, 12 * s, 6 * s, 'rgba(255,255,255,0.16)') + rect(tx, ty + G.bh * p.dock.scale + 46 * s, cw * 0.4, 12 * s, 6 * s, 'rgba(255,255,255,0.09)') + '</g>'; })() : '';
      return `<g${op(clamp(k * 1.5) * (1 - L.out))}>${dockCard}${tail}<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(Math.max(0.001, sc))}) translate(${f2(-cx)} ${f2(-cy)})">` +
        rect(x, y, G.bw, G.bh, 0.55 * S, p.fill, `stroke="rgba(255,255,255,0.22)" stroke-width="${f2(1.4 * s)}"`) + head + body + '</g></g>'; } },

  'lowerThird.personalTag': { file: 'type/gfx/ui-trace.js', tags: ['lower-third', 'name', 'documentary', 'team', 'personal', 'interview', 'humanise'], dur: 3.6, inF: 12, outF: 9,
    d: { name: 'Maya Rao', role: 'Research lead', personal: 'Off duty: restores old radios', chip: { initials: 'MR', href: null, icon: null }, pos: 'bl', accent: BRAND, tierAt: 0.3, tierLeadOut: 0.35, panel: 'rgba(12,12,18,0.74)', color: '#FFFFFF' },
    svg(L, p, c) { const s = c.s, u = L.u, ns = 50 * s, rs = 28 * s, ps = 25 * s, pad = 28 * s, w1 = Math.max(measure(p.name, ns, { weight: 800 }), measure(p.role, rs, { weight: 600 })) + 2 * pad + 8 * s, h1 = ns + rs + 2 * pad - 2 * s;
      const ch = 54 * s, R = 19 * s, w2 = 24 * s + 2 * R + measure(p.personal, ps, { weight: 600 }) + 26 * s, gap = 10 * s, W = Math.max(w1, w2), H = h1 + gap + ch, [x, y] = anchor(p.pos, c, W, H);
      const holdEnd = L.total - PT_OUT, k1 = E.hero(L.in) * (1 - E.exit(L.out)), k2 = E.hero(seg(u, p.tierAt, p.tierAt + 0.4)) * (1 - E.exit(seg(u, holdEnd - p.tierLeadOut, holdEnd))), id = uid('pt', x, y, W, H);
      const t1 = `<defs><clipPath id="${id}a"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w1 * k1)}" height="${f2(h1)}"/></clipPath><clipPath id="${id}b"><rect x="${f2(x)}" y="${f2(y + h1 + gap)}" width="${f2(w2 * k2)}" height="${f2(ch)}"/></clipPath></defs>` +
        `<g clip-path="url(#${id}a)">${rect(x, y, w1, h1, 12 * s, p.panel)}${rect(x, y, 6 * s, h1, 3 * s, p.accent)}${text(p.name, x + pad + 8 * s, y + pad + ns * 0.8, { size: ns, weight: 800, fill: p.color })}${text(p.role, x + pad + 8 * s, y + pad + ns + rs * 0.82, { size: rs, weight: 600, fill: p.color, op: 0.72 * seg(u, 0.15, 0.45) })}</g>`;
      const cx = x + 8 * s + R + 2 * s, cy = y + h1 + gap + ch / 2, ch0 = p.chip || {}, av = ch0.href ? `<clipPath id="${id}c"><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(R)}"/></clipPath><image href="${String(ch0.href).replace(/"/g, '')}" x="${f2(cx - R)}" y="${f2(cy - R)}" width="${f2(2 * R)}" height="${f2(2 * R)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}c)"/>` :
        `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(R)}" fill="${p.accent}"/>` + (ch0.icon ? icon(ch0.icon, cx - R * 0.6, cy - R * 0.6, R * 1.2, '#FFFFFF', 2 * s) : text(ch0.initials || '', cx, cy + R * 0.36, { size: R * 0.95, weight: 800, fill: '#FFFFFF', anchor: 'middle' }));
      const t2 = k2 > 0.001 ? `<g clip-path="url(#${id}b)" opacity="${f2(clamp(k2 * 1.5))}">${pill(x, y + h1 + gap, w2, ch, p.panel)}${av}${text(p.personal, cx + R + 14 * s, cy + ps * 0.36, { size: ps, weight: 600, fill: p.color, op: 0.92 })}</g>` : '';
      return `<g>${t1}${t2}</g>`; } },
};
for (const g of Object.values(TRACE)) { const f = g.svg; g.d.scale = 1; g.svg = (L, p, c) => f(L, p, p.scale && p.scale !== 1 ? { ...c, s: c.s * p.scale } : c); }
/* ui.promptBar with an attachment: the same registered part (ui.js does the drawing and the scale), new defaults; typing starts after the chip docks */
const PB = UI['ui.promptBar'];
TRACE['ui.promptBar.attach'] = { ...PB, file: 'type/gfx/ui.js', tags: [...PB.tags, 'attach', 'drag', 'image', 'sketch'], dur: 4.4,
  d: { ...PB.d, attach: ATTACH, text: 'Turn this sketch into a banner', typeAt: 1.55, title: 'What should we make?', chip: null, placeholder: 'Describe what you want…' } };

/* ---------- sound: one cue per action (local times; index.js adds the item's at) ---------- */
export const TRACE_CUES = {
  'ui.branchTrace': (p) => { if (lintBranchTrace(p).length) return [{ t: 0, id: 'sfx/ui/error', why: 'run does not match the diagram' }]; const tm = traceTimes(p), out = [{ t: 0.05, id: 'sfx/ui/slide', why: 'input card' }];
    p.lanes.forEach((_, i) => out.push({ t: tm.laneAt(i), id: rr(POPS, i), why: 'lane ' + (i + 1) + ' lands' })); let n = 0;
    for (let k = 0; k < tm.nS; k++) { const ts = p.lanes.map((ln, i) => (k < ln.steps.length ? tm.resolve(i, k) : null)).filter((v) => v != null); if (ts.length) out.push({ t: ts[0], id: rr(TICKS, n++), why: 'step ' + (k + 1) + ' resolves' }); }
    if (tm.fail) out.push({ t: tm.fail.t, id: 'sfx/ui/error', why: 'wrong pick turns red' }); out.push({ t: tm.decisionAt, id: 'sfx/ui/toggle_on', why: 'decision' });
    out.push({ t: tm.outcomeAt, id: tm.fail ? 'sfx/hit/low_thump' : 'sfx/ui/success', why: tm.fail ? 'run fails' : 'run passes' });
    const seen = []; for (const q of out.sort((a, b) => a.t - b.t)) if (!seen.length || q.t - seen.at(-1).t > 0.07) seen.push(q); else if (/error|thump/.test(q.id)) seen[seen.length - 1] = q; return seen; },
  'caption.sceneBubble': (p) => [{ t: Math.max(0, p.words[0].s - 0.12), id: 'sfx/ui/pop', why: 'bubble appears' }, { t: capturedAt(p), id: 'sfx/ui/success', why: 'captured' }, ...(p.dock ? [{ t: p.dock.at, id: 'sfx/whoosh/swish_xs', why: 'bubble docks into the card' }] : [])],
  'lowerThird.personalTag': (p) => [{ t: 0, id: 'sfx/whoosh/swish_s', why: 'name super' }, { t: p.tierAt, id: 'sfx/ui/pop', why: 'personal tag' }],
  'ui.promptBar.attach': (p) => UI_CUES['ui.promptBar'](p),
};
