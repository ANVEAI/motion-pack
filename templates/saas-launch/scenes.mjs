/* templates/saas-launch/scenes.mjs: the scene list of the SaaS launch film, one RE-LAYOUT per aspect (LY.wide / LY.tall: own boxes, sizes and zoom rects, never a crop).
   Times are relative to each scene's start; config.mjs buildPlan lays the scenes end to end (plan-kit scenesToPlan). Every word comes from CONFIG.text; every screen is a placeholder HTML
   screen (templates/_shared/saas/screens.mjs) unless CONFIG.media gives a screenshot or a recording. Screen coordinates (sx, sy) are fractions of the 1440 x 900 desktop screen. */
import { applyMedia } from '../_shared/saas/plan-kit.mjs';
import { cursorLeg } from '../../type/gfx/index.js';

/* where things are on the placeholder screens (desktop, fractions) */
export const SPOT = { newFlow: [0.932, 0.068], newFlowBox: [0.884, 0.036, 0.097, 0.064], runTest: [0.933, 0.068], runBox: [0.884, 0.035, 0.098, 0.066], branch: [0.259, 0.393, 0.229, 0.111], replyGrab: [0.599, 0.571], replyDrop: [0.301, 0.696], runsRow: [0.197, 0.416, 0.779, 0.067] };   // measured from the placeholder screens in Chrome (getBoundingClientRect / 1440 x 900)
export const LY = {
  wide: { side: { x: 110, y: 300, w: 700, size: 112 }, top: { x: 110, y: 62, w: 1700, size: 72 }, card: { x: 160, y: 400, w: 1600, size: 124, align: 'center' }, sub: { x: 260, y: 640, w: 1400, size: 52, align: 'center', weight: 700 },
    hookWin: [0.47, 0.12, 0.5, 0.76], hookToasts: { pos: [0.6, 0.06], width: 0.36 }, copyA: [0.4, 0.2, 0.42, 0.62], copyB: [0.56, 0.3, 0.4, 0.6], chaseWin: [0.47, 0.14, 0.5, 0.74], repeatWin: [0.47, 0.14, 0.5, 0.74],
    tourWin: [0.09, 0.19, 0.82, 0.77], tourWinAsk: [0.04, 0.19, 0.6, 0.77], ask: [0.6, 0.2, 0.37, 0.72], tourToasts: { pos: [0.64, 0.24], width: 0.32 },
    tourZoom: { branch: [0.13, 0.28, 0.6, 0.42], wide: [0.1, 0.06, 0.82, 0.92], run: [0.45, 0, 0.55, 0.5] },
    featWin: [0.09, 0.22, 0.82, 0.74], cmd: [0.3, 0.3, 0.4, 0.5], chip: [0.5, 0.56], dash: [0.08, 0.2, 0.84, 0.74], ints: [0.14, 0.2, 0.72, 0.68], split: [0.08, 0.21, 0.84, 0.74],
    proof: { pos: [0.5, 0.56] }, price: [0.1, 0.22, 0.8, 0.7], endUnit: 1, markSize: 150, nameSize: 112, markY: 0.42 },
  tall: { side: { x: 80, y: 300, w: 870, size: 104 }, top: { x: 80, y: 290, w: 870, size: 76 }, card: { x: 80, y: 640, w: 920, size: 112, align: 'center' }, sub: { x: 100, y: 1000, w: 880, size: 52, align: 'center', weight: 700 },
    hookWin: [0.04, 0.3, 0.92, 0.5], hookToasts: { pos: [0.08, 0.33], width: 0.84 }, copyA: [0.03, 0.3, 0.8, 0.34], copyB: [0.17, 0.46, 0.8, 0.34], chaseWin: [0.04, 0.3, 0.92, 0.5], repeatWin: [0.04, 0.3, 0.92, 0.5],
    tz: { hook: [0.17, 0.06, 0.55, 0.6], copyA: [0.17, 0.08, 0.5, 0.55], copyB: [0.17, 0, 0.5, 0.55], chase: [0.17, 0, 0.55, 0.62], repeat: [0, 0, 0.6, 0.62], feat1: [0.17, 0.05, 0.6, 0.6] },
    tourWin: [0.03, 0.34, 0.94, 0.52], tourWinAsk: [0.03, 0.62, 0.94, 0.3], ask: [0.05, 0.27, 0.9, 0.34], tourToasts: { pos: [0.08, 0.38], width: 0.84 },
    tourZoom: { flows: [0.52, 0, 0.48, 0.42], builder: [0.14, 0.06, 0.62, 0.86], branch: [0.16, 0.3, 0.42, 0.3], drag: [0.18, 0.32, 0.62, 0.48], run: [0.52, 0, 0.48, 0.5] },
    featWin: [0.03, 0.3, 0.94, 0.5], cmd: [0.06, 0.34, 0.88, 0.34], chip: [0.5, 0.52], dash: [0.06, 0.29, 0.88, 0.52], ints: [0.1, 0.3, 0.8, 0.4], split: [0.04, 0.3, 0.92, 0.46],
    proof: { pos: [0.5, 0.5] }, price: [0.06, 0.25, 0.88, 0.6], endUnit: 1.25, markSize: 170, nameSize: 112, markY: 0.4 },
};
const W = (o) => ({ id: 'ui.appWindow', ...o });
export function launchScenes(C, A, B) {
  const T = C.text, L = LY[A.key], tall = A.tall, len = C.length, BUD = BUDGETS[len] || BUDGETS[60], M = C.media || {}, out = [];
  const tx = (k) => (C.transitions[k] ? { tx: C.transitions[k][0], txReason: C.transitions[k][1] } : {}), add = (s) => { if (BUD[s.id] != null) out.push({ ...s, dur: BUD[s.id], ...tx(`${out.at(-1)?.id}>${s.id}`) }); };
  const hd = (text, at, base, o = {}) => ({ text, at, ...base, ...o }), win = (key, box, screen, o = {}) => W({ key, at: o.at ?? 0, screen, params: { box, theme: 'light', title: B.name, url: B.url, accent: B.accent, label: 'placeholder UI · demo data', labelSize: tall ? 24 : 22, ...(tall && L.tz && L.tz[o.tz] ? { zoom: [{ t: 0, rect: L.tz[o.tz] }] } : {}), ...o.params } });   // 9:16: a zoom to the readable region (it pushes in from frame 0)
  /* 1. HOOK: the pain on frame 0, already moving (enter: none, the inbox scrolls, requests arrive) */
  add({ id: 'hook', bg: 'paper', grid: 1, why: 'problem-agitate hook: the pain is on frame 0 and moving', heads: [hd(T.hook, 0.12, L.side)],
    items: [applyMedia(win('hookWin', L.hookWin, { name: 'inbox', keys: [[0, { calm: 0, scroll: 0 }], [0.01, { scroll: 2.4 }, 3.0]] }, { tz: 'hook', params: { enter: 'none', kb: [1, 1.05] } }), M.hook, 'hook'),
      { id: 'ui.notifyStack', at: 0, mute: false, params: { ...L.hookToasts, max: 3, accent: B.accent, app: 'Inbox', items: T.hookToasts.map((q, i) => ({ at: 0.05 + i * 0.55, title: q[0], body: q[1], icon: q[2] || 'mail' })) } }] });
  /* 2-4. PROBLEM: three beats on the bar, hard cuts */
  add({ id: 'copy', bg: 'paper', grid: 1, why: 'problem 1: work copied by hand between tools', heads: [hd(T.copy, 0.05, L.side)],
    items: [win('copyA', L.copyA, { name: 'inbox', keys: [[0, { calm: 0, scroll: 1 }]] }, { tz: 'copyA', params: { enter: 'none' } }), win('copyB', L.copyB, { name: 'chat', keys: [[0, { msgs: 1, pasted: 0 }], [1.3, { pasted: 1 }, 0.2]] }, { tz: 'copyB', params: { enter: 'none', title: 'Team chat', url: 'chat.example' } }),
      { id: 'ui.cursorJourney', at: 0, params: { path: [{ t: 0.1, x: tall ? 0.3 : 0.5, y: tall ? 0.5 : 0.36 }, { t: 0.45, x: tall ? 0.3 : 0.5, y: tall ? 0.5 : 0.36, down: true, carry: T.copyChip }, { t: 1.25, x: tall ? 0.6 : 0.75, y: tall ? 0.66 : 0.6, up: true, arc: 0.12 }] } }] });
  add({ id: 'chase', bg: 'paper', grid: 1, why: 'problem 2: nobody owns it, so people chase', heads: [hd(T.chase, 0.05, L.side)],
    items: [win('chaseWin', L.chaseWin, { name: 'chat', keys: [[0, { msgs: 1 }], [0.1, { msgs: 5 }, 1.2]] }, { tz: 'chase', params: { enter: 'none', title: 'Team chat', url: 'chat.example', kb: [1.02, 1.08] } }),
      { id: 'callout.arrowLabel', at: 0.9, params: { from: tall ? [0.62, 0.72] : [0.33, 0.78], to: tall ? [0.45, 0.6] : [0.62, 0.7], label: T.chaseLabel, accent: '#D9473F', size: tall ? 1.15 : 1 } }] });
  add({ id: 'repeat', bg: 'paper', grid: 1, why: 'problem 3: the tracker grows, the toasts pile up: the loop that the reveal breaks', heads: [hd(T.repeat, 0.05, L.side)],
    items: [win('repeatWin', L.repeatWin, { name: 'sheet', keys: [[0, { rows: 3 }], [0.05, { rows: 14 }, 1.7]] }, { tz: 'repeat', params: { enter: 'none', title: 'Tracker', url: 'sheet.example', kb: [1, 1.06] } }),
      { id: 'ui.notifyStack', at: 0, params: { ...L.hookToasts, max: 3, accent: '#8A8693', app: 'Inbox', items: T.hookToasts.concat(T.hookToasts).slice(0, 6).map((q, i) => ({ at: 0.1 + i * 0.3, title: q[0], body: q[1], icon: q[2] || 'mail' })) } }] });
  /* 5. REVEAL: the mark, the name, the line */
  add({ id: 'reveal', bg: 'paper', hold: true, why: 'the product as the turn: name once, then the promise', mark: { at: 0.1, cx: A.W / 2, cy: A.H * L.markY, size: L.markSize, nameSize: L.nameSize, row: !tall },
    heads: [hd(T.line, 0.9, { ...L.sub, y: tall ? A.H * L.markY + 330 : A.H * L.markY + 150, size: tall ? 64 : 60 })],
    cues: [{ t: 0.1, id: C.sfx.reveal, why: 'reveal hit on the mark' }, { t: 0.28, id: C.sfx.letters, why: 'the name assembles' }] });
  /* 6. TOUR: one window, a cursor journey through the product (open, describe, build, read, adjust, test) */
  out.push(...tour(C, A, B, L, BUD, tx, hd, win));
  /* 7-9. FEATURE TRIO: one line + a few seconds of UI each */
  const F = T.features;
  add({ id: 'feat1', bg: 'paper', grid: 1, why: 'feature 1: the shortcut, then the palette it opens', heads: [hd(F[0], 0.05, L.top)],
    items: [win('f1Win', L.featWin, { name: 'inbox', keys: [[0, { calm: 0.4, scroll: 0 }]] }, { tz: 'feat1', params: { enter: 'none' } }), { id: 'ui.shortcutChip', at: 0.15, dur: 1.15, params: { keys: C.shortcut, label: T.shortcutLabel, pos: L.chip, pressAt: 0.35, size: tall ? 1.15 : 1.25, stack: tall } },
      { id: 'ui.commandBar', at: 1.25, params: { box: L.cmd, query: T.commandQuery, items: T.commandItems, dim: 0.28, accent: B.accent, scale: tall ? 1.25 : 1.15, cps: 10, typeAt: 0.3 } }] });
  add({ id: 'feat2', bg: 'paper', grid: 1, why: 'feature 2: every run on record', heads: [hd(F[1], 0.05, L.top)],
    items: [applyMedia(win('f2Win', L.featWin, { name: 'runs', keys: [[0, { rows: 0 }], [0.25, { rows: 6 }, 1.1]] }, { params: { enter: 'none', kb: [1, 1.04], zoom: tall ? [{ t: 0, rect: [0.17, 0.2, 0.6, 0.6] }] : [] } }), M.runs, 'runs'),
      { id: 'ui.cursorJourney', at: 0, winOf: 'f2Win', params: { path: [{ t: 0.9, x: 0.7, y: 0.9 }, { t: 1.6, x: 0.55, y: 0.42, hover: [0.18, 0.525, 0.79, 0.067] }] } },
      { id: 'callout.uiHighlight', at: 1.75, winOf: 'f2Win', params: { box: SPOT.runsRow, label: T.runsLabel, pad: 4, size: tall ? 1.2 : 1 } }] });
  add({ id: 'feat3', bg: 'paper', grid: 1, why: 'feature 3: the numbers, live', heads: [hd(F[2], 0.05, L.top)],
    items: [{ id: 'ui.dashboardAssemble', at: 0.1, params: { box: L.dash, accent: B.accent, title: B.name + ' · ' + T.dashTitle, cols: tall ? 2 : 4, rows: tall ? 4 : 3, source: C.dashSource, scale: tall ? 1.1 : 1,
      cards: tall ? DASH_TALL : undefined } }] });
  /* 10. WORKS WITH: neutral glyphs only */
  add({ id: 'works', bg: 'paper', grid: 1, why: 'works with: generic categories, never real marks', heads: [hd(T.works, 0.05, L.top)],
    items: [{ id: 'ui.integrationGrid', at: 0.1, params: { box: L.ints, hub: B.name.slice(0, 1), accent: B.accent, glyphs: C.integrations, scale: tall ? 1.15 : 1 } }] });
  /* 11. PAYOFF: the same inbox as the hook, before and after: the stake, resolved */
  const split = { id: 'ui.beforeAfterSplit', at: 0.1, screens: { before: { name: 'inbox', keys: [[0, { calm: 0, scroll: 1 }]] }, after: { name: 'inbox', keys: [[0, { calm: 1, scroll: 0 }]] } },
    params: { box: L.split, accent: B.accent, before: { label: T.before }, after: { label: T.after }, keys: [[0.25, 1], [1.2, 0.08], [2.1, 0.5]], screen: tall ? { anchor: [0.62, 0] } : {} } };
  if (M.payoffBefore?.src) split.params.before = { ...split.params.before, src: 'assets/media/' + M.payoffBefore.src.split('/').pop() };
  if (M.payoffAfter?.src) split.params.after = { ...split.params.after, src: 'assets/media/' + M.payoffAfter.src.split('/').pop() };
  add({ id: 'payoff', bg: 'paper', grid: 1, why: 'payoff: the hook inbox, handled', heads: [hd(T.payoff, 0.05, L.top)], items: [split] });
  /* 12. PROOF: a sourced number or a labelled placeholder (counter.countUp prints its source) */
  const pr = C.proof, claim = C.claims[pr.claim ?? 0];
  add({ id: 'proof', bg: 'paper', grid: 1, why: 'proof: one number with its source in frame', heads: [hd(T.proof, 0.05, L.top)],
    items: [{ id: 'counter.countUp', at: 0.25, params: { from: 0, to: pr.value, dec: 0, prefix: '', suffix: pr.suffix ?? '', label: pr.label, pos: 'c', size: tall ? 118 : 220, color: B.ink, accent: B.accent, source: claim ? claim.source : '' } }],
    labels: claim && /placeholder|illustrative|demo/i.test(claim.source) ? [{ at: 0.9, text: T.proofNote, x: A.W / 2, y: tall ? 1180 : A.H - 90, size: tall ? 32 : 30, anchor: 'middle', color: '#B2382E' }] : [] });
  add({ id: 'pricing', bg: 'paper', grid: 1, why: 'availability: free to start, the plans', heads: [hd(T.pricing, 0.05, L.top)],
    items: [{ id: 'ui.pricingCards', at: 0.1, params: { box: L.price, plans: C.pricing.plans, source: C.pricing.source, accent: B.accent, badge: T.planBadge, start: 0.15, featuredAt: 0.9, scale: tall ? 1.12 : 1 } }] });
  /* 14. END CARD: mark + name, CTA, URL; held */
  add({ id: 'end', bg: 'paper', hold: true, why: 'end card: the one verb, the URL, held', card: { at: 0.05, unit: L.endUnit, stack: tall, cy: A.H * (tall ? 0.3 : 0.36), fine: T.fine, fineY: tall ? 592 : 64 },
    cues: [{ t: 0.0, id: C.sfx.brandSlam, why: 'one slam: the cut to the end card' }, { t: 0.2, id: C.sfx.logo, why: 'sonic logo on the name' }] });
  return out;
}
/* the tour: a cursor journey through one window; heads change as chapters (the previous head lifts away as the next rises) */
function tour(C, A, B, L, BUD, tx, hd, win) {
  if (BUD.tour == null) return []; const T = C.text, tall = A.tall, long = BUD.tour >= 15, Z = L.tourZoom, S = SPOT;
  const t = long ? { click: 1.5, swap: 1.75, typeAt: 2.4, apply: 8.0, zoomB: 8.4, hl: 8.7, dragDown: 10.6, dragUp: 11.6, run: 12.9, end: BUD.tour } : { click: 1.3, swap: 1.55, typeAt: 2.1, apply: 7.2, zoomB: 7.5, hl: 7.8, dragDown: null, dragUp: null, run: 9.6, end: BUD.tour };
  const winBox = L.tourWin, askBox = L.tourWinAsk;
  const zoom = tall ? [{ t: 0.2, rect: Z.flows }, { t: t.swap + 0.1, rect: Z.builder }, { t: t.zoomB, rect: Z.branch }, ...(t.dragDown ? [{ t: t.dragDown - 0.6, rect: Z.drag }] : []), { t: t.run - 0.6, rect: Z.run }, { t: t.run + 0.5, rect: Z.builder }]
    : [{ t: t.zoomB, rect: Z.branch }, { t: t.hl + 1.4, rect: null }, { t: t.run - 0.5, rect: Z.run }, { t: t.run + 0.6, rect: null }];
  const path = [{ t: 0.3, x: 0.6, y: 0.7 }, { t: t.click - 0.35, x: S.newFlow[0] - 0.02, y: S.newFlow[1] + 0.01, hover: S.newFlowBox }, { t: t.click, x: S.newFlow[0], y: S.newFlow[1] + 0.005, click: true }, { t: t.typeAt + 0.2, x: 0.5, y: 0.55 }];
  if (t.dragDown) path.push({ t: t.dragDown - 0.05, x: S.replyGrab[0], y: S.replyGrab[1], hand: true }, { t: t.dragDown + 0.1, x: S.replyGrab[0], y: S.replyGrab[1], down: true, carry: '', hand: true }, { t: t.dragUp, x: S.replyDrop[0], y: S.replyDrop[1], up: true, arc: 0, hand: true });
  path.push({ t: t.run - 0.3, x: S.runTest[0] - 0.01, y: S.runTest[1] + 0.01, hover: S.runBox }, { t: t.run, x: S.runTest[0], y: S.runTest[1] + 0.005, click: true }, { t: t.end - 0.3, x: 0.7, y: 0.5 });
  const curP = { path }, iUp = path.findIndex((q) => q.up), lg = iUp > 0 ? cursorLeg(curP, iUp) : null;
  const keys = [[0, { _screen: 'flows', hover: 0, press: 0 }], [t.click - 0.35, { hover: 1 }], [t.click, { press: 1 }], [t.swap, { _screen: 'builder', nodes: 0, swap: 0, run: 0, hl: -1 }],
    [t.apply - 2.5, { nodes: 5 }, 2.3], [t.hl, { hl: 2 }], [t.hl + 1.5, { hl: -1 }], ...(lg ? [[lg[0], { swap: 1 }, lg[1] - lg[0], 'cam']] : []), [t.run - 0.3, { hoverRun: 1 }], [t.run + 0.15, { run: 5, hoverRun: 0 }, 1.2]];
  const move = tall ? [{ t: t.swap, box: askBox }, { t: t.apply + 0.4, box: winBox }] : [{ t: t.swap, box: askBox }, { t: t.apply + 0.4, box: winBox }];
  const heads = T.tour.slice(0, long ? 6 : 5), at = long ? [0.05, t.swap, t.apply - 2.4, t.zoomB, t.dragDown - 0.3, t.run - 0.4] : [0.05, t.swap, t.apply - 2.4, t.zoomB, t.run - 0.4];
  const H = heads.map((h, i) => hd(h, at[i], L.top, { ...(i < heads.length - 1 ? { out: at[i + 1] - 0.02, outS: 0.22 } : {}) }));
  return [{ id: 'tour', dur: BUD.tour, hold: true, ...tx('reveal>tour'), bg: 'paper', grid: 1, why: 'the UI tour: a cursor journey (open, describe, build, read, adjust, test)', heads: H,
    items: [applyMedia(win('tourWin', winBox, { name: 'flows', keys }, { params: { move, zoom, kb: [1, 1] } }), C.media?.tour, 'tour'),
      { id: 'ui.aiAnswer', at: t.swap + 0.15, dur: t.apply + 0.5 - t.swap, params: { box: L.ask, prompt: T.prompt, answer: T.answer, typeAt: t.typeAt - t.swap - 0.15, cps: 22, thinkS: 0.55, wps: 10, applyAt: t.apply - t.swap - 0.15, apply: T.apply, accent: B.accent, title: T.askTitle, avatar: B.name.slice(0, 1), scale: tall ? 1.18 : 1.05 } },
      { id: 'callout.uiHighlight', at: t.hl, dur: 1.5, winOf: 'tourWin', params: { box: SPOT.branch, label: T.branchLabel, pad: 6, size: tall ? 1.25 : 1.1 } },
      ...(t.dragDown ? [{ id: 'callout.arrowLabel', at: t.dragDown - 0.9, dur: 0.8, winOf: 'tourWin', params: { from: tall ? [0.62, 0.92] : [0.8, 0.88], to: S.replyGrab, label: T.dragLabel, size: tall ? 1.2 : 1 } }] : []),
      { id: 'ui.cursorJourney', at: 0, winOf: 'tourWin', params: { ...curP, size: tall ? 1.15 : 1 } },
      { id: 'ui.notifyStack', at: t.run + 0.6, params: { ...L.tourToasts, max: 3, accent: B.accent, app: B.name, items: T.runToasts.map((q, i) => ({ at: i * 0.4, title: q[0], body: q[1], icon: q[2] || 'branch' })) } }] }];
}
/* scene lengths in seconds per film length (a section missing from a budget is left out of that cut) */
export const BUDGETS = {
  35: { hook: 3, copy: 2, chase: 2, repeat: 1.5, reveal: 3.5, tour: 8, feat1: 3.5, payoff: 3.5, proof: 3, end: 5 },   // the launch-film format (30-38 s): reveal (bass) at 24%, the end card (name) at 86%
  45: { hook: 3, copy: 2, chase: 2, repeat: 2, reveal: 3.5, tour: 11.5, feat1: 4, feat3: 4, payoff: 4.5, proof: 3.5, end: 5 },
  60: { hook: 3, copy: 2, chase: 2, repeat: 2, reveal: 4, tour: 16, feat1: 4, feat2: 4, feat3: 4, works: 4, payoff: 4, proof: 3.5, pricing: 3.5, end: 4 },
  75: { hook: 3, copy: 2, chase: 2, repeat: 2, reveal: 5, tour: 20, feat1: 5, feat2: 5, feat3: 5, works: 5, payoff: 5.5, proof: 4, pricing: 5.5, end: 6 },
};
const DASH_TALL = [{ kind: 'kpi', label: 'Requests routed', value: 1284, span: [0, 0, 1, 1] }, { kind: 'kpi', label: 'Open right now', value: 7, span: [1, 0, 1, 1] }, { kind: 'line', label: 'Routed per day', span: [0, 1, 2, 1] },
  { kind: 'bar', label: 'By topic', span: [0, 2, 1, 2] }, { kind: 'donut', label: 'By team', value: 0.64, span: [1, 2, 1, 2] }];
