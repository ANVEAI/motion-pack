/* motion-pack / type / gfx / index.js: ONE registry for the editor-staple graphics (2026-10-13).
     renderSVG(id, t, { at = 0, dur, params }, { W, H, platform, seed }) -> full-frame '<svg ...>' string ('' when the item is off screen)
     mountGfx(root, items, { W, H, platform })   items = [{ id, at, dur?, params? }]  -> { render(t) }   (one absolutely positioned <svg> per root)
     bindHF(stack) re-renders on every 'hf-seek' (HyperFrames contract).
   Families: lowerThird.* counter.* title.* (editorial.js), callout.* fx.emotion.* fx.impact.* (callouts.js), social.* device.* caption.* chart.* map.route (social.js),
   sticker.place / reaction.place / reaction.burst (stickers.js), ui.* (ui.js: the UI kit, with uiCues for per-action sound). Layouts (layout.js) and draw-on (drawon.js) act on DOM shots and are exported here too. */
import { EDITORIAL } from './editorial.js'; import { CALLOUTS } from './callouts.js'; import { SOCIAL } from './social.js'; import { STICKER_GFX, STICKER_NAMES, REACTIONS, MOTIONS, setGlyphSource } from './stickers.js';
import { life, ctxFor } from './core.js'; import { UI, UI_CUES, hooks as uiHooks } from './ui.js';
export { nodeGraphCam, isoTiltCss } from './ui.js';
export { LAYOUTS, layoutAt, applyLayout } from './layout.js'; export { prepareDrawOn, drawOnAt, trimAt, bindDrawOn, drawAttrs } from './drawon.js';
export { STICKER_NAMES, REACTIONS, MOTIONS, setGlyphSource };
export const GFX = { ...EDITORIAL, ...CALLOUTS, ...SOCIAL, ...STICKER_GFX, ...UI };
export const GFX_IDS = Object.keys(GFX);
/* default sound pairing per gfx id prefix (sfx/<category>/<name>, anchor = the item's at + 1 frame, gain over the bed). Longest prefix wins. */
export const GFX_SFX = {
  lowerThird: ['sfx/whoosh/swish_s', 1, -2], 'lowerThird.newsBar': ['sfx/stinger/bump', 1, 0], 'counter.countUp': ['sfx/ui/count_run', 1, -2], 'counter.wheel': ['sfx/ui/count_tick', 1, -2],
  'counter.statCard': ['sfx/ui/pop', 1, 0], 'counter.ring': ['sfx/ui/count_run', 1, -3], 'counter.priceSlash': ['sfx/cash/ka_ching', 18, 2], 'title.chapterCard': ['sfx/stinger/reveal', 1, 0],
  'title.slate': ['sfx/camera/shutter', 22, 2], 'title.countdown321': ['sfx/ui/tick', 1, 0], 'title.letterboxRamp': ['sfx/whoosh/whoosh_in_m', 0, -4], callout: ['sfx/paper/rustle', 1, -4],
  'callout.spotlight': ['sfx/whoosh/whoosh_in_m', 0, -3], 'callout.pinLeader': ['sfx/ui/pop', 1, -1], 'fx.emotion': ['sfx/cartoon/pop_eye', 1, -2], 'fx.emotion.heartBurst': ['sfx/cartoon/xylo_up', 1, -2],
  'fx.emotion.question': ['sfx/voice/chirp_question', 1, -2], 'fx.emotion.exclaim': ['sfx/stinger/alert', 1, -1], 'fx.emotion.dizzy': ['sfx/cartoon/sproing', 1, -2], 'fx.emotion.bulb': ['sfx/ui/camera_ping', 1, -1],
  'fx.emotion.sparkle': ['sfx/sparkle/shimmer', 0, -3], 'fx.impact': ['sfx/hit/punch', 1, 2], 'fx.impact.dustPoof': ['sfx/cartoon/poof', 0, 0], 'fx.impact.smear': ['sfx/whoosh/whip_pan', 0, 0],
  social: ['sfx/ui/pop', 1, -1], 'social.notification': ['sfx/ui/notify', 1, 0], 'social.typing': ['sfx/ui/typing_burst', 0, -6], 'social.followButton': ['sfx/ui/success', 25, 0], 'social.chatBubbles': ['sfx/ui/swipe_ding', 1, -2],
  device: ['sfx/ui/click', 1, -3], caption: ['sfx/ui/blip', 0, -8], 'caption.oneWordSlam': ['sfx/hit/punch', 1, 0], 'caption.meme': ['sfx/cartoon/record_scratch', 0, -2], chart: ['sfx/ui/count_run', 1, -3],
  'map.route': ['sfx/whoosh/swish_s', 12, -3], 'sticker.place': ['sfx/ui/pop', 1, -1], 'reaction.place': ['sfx/ui/pop', 1, -1], 'reaction.burst': ['sfx/cartoon/boing', 1, -4], layout: ['sfx/whoosh/swish_s', 0, -2], 'layout.freezeFrame': ['sfx/cartoon/record_scratch', 0, 0],
  ui: ['sfx/ui/pop', 1, -2], 'ui.promptBar': ['sfx/ui/click', 1, -2], 'ui.checklist': ['sfx/ui/pop', 1, -2], 'ui.scanOverlay': ['sfx/ui/camera_ping', 1, -2], 'ui.isometricTilt': ['sfx/whoosh/swish_xs', 0, -3], 'ui.stateMorph': ['sfx/ui/click', 1, -2] };
export const sfxFor = (id) => { let best = null; for (const k of Object.keys(GFX_SFX)) if ((id === k || id.startsWith(k + '.')) && (!best || k.length > best.length)) best = k; return best ? { id: GFX_SFX[best][0], offset_f: GFX_SFX[best][1], gain_db: GFX_SFX[best][2] } : null; };
export function renderInner(id, t, { at = 0, dur, params = {} } = {}, ctx) {
  const g = GFX[id]; if (!g) throw new Error('unknown gfx ' + id); const p = { ...g.d, ...params }, L = life(t, at, dur ?? p.dur ?? g.dur, g.inF ?? 12, g.outF ?? 9);
  return L.on ? g.svg(L, p, ctx) : '';
}
export function renderSVG(id, t, opts = {}, { W = 1920, H = 1080, platform = null, seed = 1 } = {}) {
  const ctx = ctxFor(W, H, platform, seed), inner = renderInner(id, t, opts, ctx);
  return inner ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${inner}</svg>` : '';
}
export function mountGfx(root, items, { W = 1920, H = 1080, platform = null, seed = 1 } = {}) {
  const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); host.setAttribute('viewBox', `0 0 ${W} ${H}`);
  Object.assign(host.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }); root.appendChild(host);
  const ctx = ctxFor(W, H, platform, seed);
  return { host, render(t) { host.innerHTML = items.map((it) => renderInner(it.id, t, it, ctx)).join(''); return this; } };
}
export function bindHF(stack, { t0 = 0 } = {}) { const f = (t) => stack.render(t - t0); window.addEventListener('hf-seek', (e) => f(e.detail.time)); f(window.__hfThreeTime || 0); return f; }
/* ui.* sound cue hook: every action of a UI-kit item (keystrokes, clicks, ticks, lock-on, morphs) as [{ t (absolute s), id: 'sfx/<cat>/<name>', why }] for the plan's cue sheet */
export function uiCues(id, { at = 0, params = {} } = {}) { const g = UI[id], f = UI_CUES[id]; if (!g || !f) return []; return f({ ...g.d, ...params }).map((c) => ({ ...c, t: +(c.t + at).toFixed(4) })); }
uiHooks.renderInner = renderInner;
