/* TEMPLATE saas-feature-drop: the changelog / "new in" film, 15 / 20 / 30 s, 16:9 + a 9:16 RE-LAYOUT (LY.wide / LY.tall).
   hook (payoff-first: the new thing already happening on frame 0, a NEW kicker and the feature's name) -> before (the old way, one at a time) -> after (the new way: select, the shortcut chip,
   everything at once, a toast) -> compare (before / after split of the same screen) -> the shortcut, big -> CTA (where it is live, the changelog URL). One feature per film.
   Every screen is an HTML placeholder of the FICTIONAL "Acme Flow" ("placeholder UI · demo data") until CONFIG.media gives yours. Edit the CONFIG block only:
     node make.mjs [--set length=15|20|30] [--set aspect=9:16] [--set text.feature=...]   then the render command it prints.
   HONESTY: a digit in CONFIG.text fails the build; the UI's own counts ("8 selected") sit inside the labelled placeholder screen and are listed in claims with their source. */
import { aspectOf, scenesToPlan, digitsInCopy, applyMedia } from '../_shared/saas/plan-kit.mjs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  length: 20, aspect: '16:9', platform: null, fps: 30,
  brand: { name: 'Acme Flow', accent: '#3B5BFD', ink: '#14131A', paper: '#F5F4F0', logo: null, url: 'flow.example/changelog', cta: 'Live today', font: { display: 'Manrope', text: 'Manrope' } },   // FICTIONAL demo brand
  text: {
    kicker: 'New in Acme Flow', feature: 'Route *all at once*.',
    before: 'Before: one at a *time*.', after: 'Now: select, then *route*.', compare: 'Same inbox. *One move.*', shortcut: 'Route selected', toast: ['Routed together', 'Each request went to its team', 'branch'],
    fine: 'Acme Flow is fictional · placeholder UI · demo data',
  },
  media: { before: { src: null, label: '' }, after: { src: null, label: '' } },   // screenshots or recordings of the old and the new way (null = the labelled HTML placeholder)
  shortcut: ['⇧', '⌘', 'R'],
  claims: [{ text: 'The selection count in the UI (8 selected)', source: 'placeholder UI, demo data: the fictional Acme Flow screen' }],
  transitions: { 'hook>before': ['transitions/smash', 'EMOTION: the new way, then the pain it removes'], 'after>compare': ['transitions/push', 'STORY: the two ways side by side'], 'compare>shortcut': ['transitions/scale-punch', 'ENERGY: the one thing to remember'] },
  music: 'music/bed_tech_pulse_loop8', bpm: 120, musicGainDb: 0, ceilingDb: -2.5, fadeInMs: 30,   // soft four-on-the-floor + plucks (120 BPM: every scene is a whole number of beats)
  sfx: { head: 'sfx/whoosh/swish_xs', kicker: 'sfx/ui/pop', cascade: 'sfx/ui/success_chime', logo: 'sfx/logo/two_note' },
  tail: { liftS: 1.6, fadeS: 0.9, bedDb: -40 },
  layers: [{ kind: 'grain', params: { stock: 'upload-safe' } }],
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta',
  'brand.font.display': 'brand.font.display', 'brand.font.text': 'brand.font.text', 'text.headline': 'text.feature', 'text.kicker': 'text.kicker', 'text.subhead': 'text.after', 'text.cta': 'brand.cta', 'text.fine': 'text.fine',
  'media.before': 'media.before', 'media.after': 'media.after', 'media.screen': 'media.after', 'claims': 'claims', 'music': 'music', 'aspects': 'aspect', 'length': 'length' };

export const BUDGETS = { 15: { hook: 2, before: 3, after: 4.5, shortcut: 2, cta: 3.5 }, 20: { hook: 2.5, before: 4, after: 5, compare: 3.5, shortcut: 2, cta: 3 }, 30: { hook: 3, before: 5.5, after: 7, compare: 5, shortcut: 3, cta: 6.5 } };
export const LY = {
  wide: { top: { x: 110, y: 62, w: 1700, size: 76 }, kicker: { x: 110, y: 40, size: 28 }, hookHead: { x: 110, y: 112, w: 1700, size: 96 }, win: [0.09, 0.22, 0.82, 0.74], hookWin: [0.09, 0.3, 0.82, 0.66],
    split: [0.08, 0.21, 0.84, 0.74], chip: [0.5, 0.48], chipSize: 2.2, toasts: { pos: [0.64, 0.25], width: 0.32 }, tz: {} },
  tall: { top: { x: 80, y: 290, w: 900, size: 80 }, kicker: { x: 80, y: 250, size: 30 }, hookHead: { x: 80, y: 320, w: 900, size: 104 }, win: [0.03, 0.31, 0.94, 0.5], hookWin: [0.03, 0.4, 0.94, 0.46],
    split: [0.04, 0.31, 0.92, 0.48], chip: [0.5, 0.44], chipSize: 1.8, toasts: { pos: [0.08, 0.33], width: 0.84 }, tz: { inbox: [0.17, 0.05, 0.62, 0.62] } },
};
const ROW = (i) => 0.169 + 0.084 * i, TAGX = 0.86, CHKX = 0.219, BULK = [0.905, 0.068];   // where things are on the placeholder inbox (measured in Chrome, 1440 x 900)

export function dropScenes(C, A, B) {
  const T = C.text, L = LY[A.key], tall = A.tall, BUD = BUDGETS[C.length] || BUDGETS[20], M = C.media || {}, out = [];
  const tx = (k) => (C.transitions[k] ? { tx: C.transitions[k][0], txReason: C.transitions[k][1] } : {}), add = (s) => { if (BUD[s.id] != null) out.push({ ...s, dur: BUD[s.id], ...tx(`${out.at(-1)?.id}>${s.id}`) }); };
  const win = (key, box, screen, o = {}) => ({ id: 'ui.appWindow', key, at: 0, screen, params: { box, theme: 'light', title: B.name, url: 'flow.example', accent: B.accent, label: 'placeholder UI · demo data', labelSize: tall ? 24 : 22, enter: 'none', ...(tall && L.tz.inbox ? { zoom: [{ t: 0, rect: L.tz.inbox }] } : {}), ...o } });
  const hd = (text, at, base, o = {}) => ({ text, at, ...base, ...o });
  /* HOOK: the cascade is already running on frame 0 (payoff-first) */
  add({ id: 'hook', bg: 'paper', grid: 1, why: 'payoff-first hook: the new thing happening on frame 0', kickers: [{ text: T.kicker, at: 0.05, ...L.kicker }], heads: [hd(T.feature, 0.15, L.hookHead)],
    items: [applyMedia(win('hookWin', L.hookWin, { name: 'inbox', keys: [[0, { select: 8, bulk: 1, calm: 0 }], [0.05, { calm: 1 }, 1.3]] }, { kb: [1.02, 1.07] }), M.after, 'after')], cues: [{ t: 0.05, id: C.sfx.kicker, why: 'NEW pops: the first sound on frame 1' }, { t: 1.2, id: C.sfx.cascade, why: 'the cascade lands' }] });
  /* BEFORE: one at a time (three slow clicks, each flips one row) */
  const b = BUD.before, clicks = [0.9, 0.9 + (b - 1.4) / 2, b - 0.5].map((t, i) => ({ t, i }));
  add({ id: 'before', bg: 'paper', grid: 1, why: 'the pain the feature removes, at its real slow rhythm', heads: [hd(T.before, 0.05, L.top)],
    items: [applyMedia(win('bWin', L.win, { name: 'inbox', keys: [[0, { calm: 0 }], ...clicks.map((k) => [k.t + 0.1, { calm: (k.i + 1) / 10 }, 0.15])] }, { kb: [1, 1.03] }), M.before, 'before'),
      { id: 'ui.cursorJourney', at: 0, winOf: 'bWin', params: { path: [{ t: 0.3, x: 0.6, y: 0.75 }, ...clicks.flatMap((k) => [{ t: k.t - 0.25, x: TAGX - 0.01, y: ROW(k.i) + 0.01, hover: [0.79, ROW(k.i) - 0.042, 0.18, 0.084] }, { t: k.t, x: TAGX, y: ROW(k.i), click: true }])], size: tall ? 1.15 : 1 } }] });
  /* AFTER: select (shift-click), the shortcut chip, everything routes, a toast */
  const a = BUD.after, sel0 = 0.6, sel1 = 1.5, press = Math.min(a - 2, 2.6);
  add({ id: 'after', bg: 'paper', grid: 1, why: 'the new way: select, one shortcut, everything at once', heads: [hd(T.after, 0.05, L.top)],
    items: [applyMedia(win('aWin', L.win, { name: 'inbox', keys: [[0, { select: 0, calm: 0, bulk: 0 }], [sel0, { select: 1 }, 0.05], [sel1, { select: 8, bulk: 1 }, 0.5], [press + 0.15, { calm: 1 }, 1.0]] }, { kb: [1, 1.03] }), M.after, 'after'),
      { id: 'ui.cursorJourney', at: 0, winOf: 'aWin', params: { path: [{ t: 0.2, x: 0.5, y: 0.7 }, { t: sel0, x: CHKX, y: ROW(0), click: true }, { t: sel1, x: CHKX, y: ROW(7), click: true }, { t: press - 0.2, x: BULK[0] - 0.01, y: BULK[1] + 0.01, hover: [0.83, 0.036, 0.15, 0.064] }], size: tall ? 1.15 : 1 } },
      { id: 'ui.shortcutChip', at: press - 0.7, dur: 1.4, params: { keys: C.shortcut, label: T.shortcut, pos: tall ? [0.5, 0.86] : [0.5, 0.88], pressAt: 0.55, stagger: 0.07, size: tall ? 1.1 : 1, stack: false } },
      { id: 'ui.notifyStack', at: press + 1.2, params: { ...L.toasts, max: 1, accent: B.accent, app: B.name, items: [{ at: 0, title: T.toast[0], body: T.toast[1], icon: T.toast[2] }] } }],
    cues: [{ t: press + 1.0, id: C.sfx.cascade, why: 'everything routed' }] });
  /* COMPARE: the same screen, before and after */
  if (BUD.compare != null) {
    const sp = { id: 'ui.beforeAfterSplit', at: 0.05, screens: { before: { name: 'inbox', keys: [[0, { calm: 0.3 }]] }, after: { name: 'inbox', keys: [[0, { calm: 1 }]] } }, params: { box: L.split, accent: B.accent, before: { label: 'Before' }, after: { label: 'Now' }, keys: [[0.2, 1], [1.0, 0.1], [1.8, 0.5]], screen: tall ? { anchor: [0.62, 0] } : {} } };
    if (M.before?.src && /\.(png|jpe?g|webp)$/i.test(M.before.src)) sp.params.before.src = 'assets/media/' + M.before.src.split('/').pop();
    if (M.after?.src && /\.(png|jpe?g|webp)$/i.test(M.after.src)) sp.params.after.src = 'assets/media/' + M.after.src.split('/').pop();
    add({ id: 'compare', bg: 'paper', grid: 1, why: 'the two ways on one screen', heads: [hd(T.compare, 0.05, L.top)], items: [sp] }); }
  /* THE SHORTCUT, big */
  add({ id: 'shortcut', bg: 'soft', why: 'the one thing to remember: the keys', items: [{ id: 'ui.shortcutChip', at: 0.05, params: { keys: C.shortcut, label: T.shortcut, pos: L.chip, pressAt: 0.35, stagger: 0.12, size: L.chipSize, stack: true, accent: B.accent } }] });
  /* CTA */
  add({ id: 'cta', bg: 'paper', hold: true, why: 'where it is live, held', card: { at: 0.05, unit: tall ? 1.2 : 1, stack: tall, cy: A.H * (tall ? 0.3 : 0.36), fine: T.fine, fineY: tall ? 600 : 64 }, cues: [{ t: 0.2, id: C.sfx.logo, why: 'sonic logo on the name' }] });
  return out;
}

export function buildPlan(C) {
  const A = aspectOf(C), B = C.brand, bad = digitsInCopy(C.text);
  if (bad.length) throw new Error('saas-feature-drop honesty: ' + bad.join(' | '));
  const list = dropScenes(C, A, B);
  for (const s of list) for (const h of s.heads || []) (s.cues ||= []).push({ t: h.at ?? 0, id: C.sfx.head, why: 'headline rises', overBedDb: -9 });
  const plan = scenesToPlan(list, C, A, { template: 'saas-feature-drop', claims: C.claims, paceRule: { aslMax: 4.5, longMax: 7.5 } });
  const end = plan.scenes.at(-1), F = C.fps, lift = Math.round((end.start + C.tail.liftS) * F), fade = Math.round(C.tail.fadeS * F);
  plan.bedAutomation = [{ frame: 0, gain_db: 0 }, { frame: lift, gain_db: 0 }, { frame: lift + fade, gain_db: C.tail.bedDb }];
  plan.audio = { mode: 'music', quiet: [{ t: [+((lift + fade) / F).toFixed(4), plan.seconds], kind: 'hold', why: 'end card on a quiet hold after the sonic logo' }] };
  plan.honesty = 'fictional product (Acme Flow); placeholder HTML screens labelled in frame';
  return plan;
}
