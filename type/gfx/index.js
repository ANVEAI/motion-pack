/* motion-pack / type / gfx / index.js: ONE registry for the editor-staple graphics (2026-10-13).
     renderSVG(id, t, { at = 0, dur, params }, { W, H, platform, seed }) -> full-frame '<svg ...>' string ('' when the item is off screen)
     mountGfx(root, items, { W, H, platform })   items = [{ id, at, dur?, params? }]  -> { render(t) }   (one absolutely positioned <svg> per root)
     bindHF(stack) re-renders on every 'hf-seek' (HyperFrames contract).
   Families: lowerThird.* counter.* title.* (editorial.js), lowerThird.docSuper + caption.subtitleSpeedGag (doc.js), callout.* fx.emotion.* fx.impact.* (callouts.js), social.* device.* caption.* chart.* map.route (social.js),
   sticker.place / reaction.place / reaction.burst (stickers.js), ui.* (ui.js + ui-data.js + ui-nav.js: the UI kit, with uiCues for per-action sound),
   type.wordWheel / inlineMedia / letterAssemble / glyphMorphCursor / marquee / bleedWord (kinetic.js),
   layout.scatterCollage / mosaicBurst / logoWall / orbitRing + callout.connectorLabel (collage.js; SVG fields, not DOM-shot layouts). Layouts (layout.js, incl. layout.cornerPin from cornerpin.js) and draw-on (drawon.js) act on DOM shots and are exported here too.
   Round 4+5 proof parts: chart.scatterFrontier, ui.dataTable, ui.costTicker, type.paramReadout (ui-proof.js), ui.branchTrace, caption.sceneBubble, lowerThird.personalTag, ui.promptBar.attach (ui-trace.js).
   Round 4/5 (r45-type.js, r45-glyph.js): title.partnerLockup, layout.iconMergeLockup, type.flankWords, type.behindSubject, type.asciiMosaic, type.textOnPath, type.electricOutline.
   Round 6 (r6.js): chart.hoverTooltip, ui.dockLaunch, title.verbCard, ui.connectRows, layout.degradingDiagram, type.commandPill.
   Card systems (canvas): layout.cardStack + layout.cardRiver (cards.js), layout.evidenceBoard (board.js): mountCards / mountBoard -> { render(t) }. */
import { EDITORIAL } from './editorial.js'; import { CALLOUTS } from './callouts.js'; import { SOCIAL } from './social.js'; import { STICKER_GFX, STICKER_NAMES, REACTIONS, MOTIONS, setGlyphSource } from './stickers.js';
import { KINETIC } from './kinetic.js'; import { COLLAGE } from './collage.js';
import { life, ctxFor } from './core.js'; import { saneParams } from './safe.js'; import { GFX_LIM } from './limits.js'; import { UI as UI1, UI_CUES as UI1_CUES, hooks as uiHooks } from './ui.js'; import { UI2, UI2_CUES } from './ui-data.js'; import { UI3, UI3_CUES } from './ui-nav.js';
import { PROOF, PROOF_CUES } from './ui-proof.js'; import { TRACE, TRACE_CUES } from './ui-trace.js'; import { R6, R6_CUES } from './r6.js';
import { HW_GFX, HW_CUES } from './hw.js';
import { EXPLAIN, EXPLAIN_CUES } from './explain.js'; import { EXPLAIN_DATA, EXPLAIN_DATA_CUES } from './explain-data.js'; import { EXPLAIN_LIM } from './explain-lim.js'; Object.assign(GFX_LIM, EXPLAIN_LIM);   /* xp-explainer 2026-10-16: diagram.*, chart.story, map.hexTile, callout.datum, counter.hero, layout.scrolly, process.*, title.takeaway, chart.sourceFooter */   // xp-hardware 2026-10-16: hw.specCallout, hw.dimensionLine, hw.chipDie, hw.edgeGlint, hw.dateCard, hw.specCard
/* round 4+5 (ui-proof.js, ui-trace.js): the ui.* ones join the UI kit (uiCues); chart.*, caption.*, type.* and lowerThird.* ones get per-action cues through gfxCues */
const R45 = { ...PROOF, ...TRACE }, R45_CUES = { ...PROOF_CUES, ...TRACE_CUES }, onlyUI = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k.startsWith('ui.')));
const UI = { ...UI1, ...UI2, ...UI3, ...onlyUI(R45), ...onlyUI(R6) }, UI_CUES = { ...UI1_CUES, ...UI2_CUES, ...UI3_CUES, ...onlyUI(R45_CUES), ...onlyUI(R6_CUES) }; import { DOC } from './doc.js';
import { HUMAN, HUMAN_CUES, HUMAN_LIM } from './human.js'; Object.assign(GFX_LIM, HUMAN_LIM);   /* lane human (2026-10-16): tutorial / personal / human-blended parts */
import { SWAP, SWAP_CUES } from './swap.js'; import { TYPE_R45, TYPE_R45_CUES } from './r45-type.js'; import { GLYPH_R45, GLYPH_R45_CUES, ELECTRIC_SOUND } from './r45-glyph.js'; import { BADGES, BADGE_CUES } from './badges.js'; import { BRAND_LAYOUTS, BRAND_CUES } from './brand.js';
export { stepAt, mixHex } from './swap.js'; export { selectionZoom, selectionZoomCss } from './badges.js'; export { CIRCLE4, SPARK4, PLATES } from './brand.js';
export { PARTNER_MARKS, MERGE_ICONS, lintPartnerMarks, inkFromMask, markFromImage, partnerLockupLayout, iconMergeFit, iconMergeState, flankBox, flankFitK, lintFlank, flankShots, flankState, srcAt, figurePlate } from './r45-type.js';
export { RAMP, RAMP_INK, LUM_PLATES, lumGrid, asciiMosaicGrid, textOnPathState, STROKE_FACE, strokeOutline, electricGeo, electricGlowPools, ELECTRIC_SOUND, ELECTRIC_ARC } from './r45-glyph.js'; export { flattenPath, arcTable, pointAt, resample, PATHS } from './pathsample.js';
export { nodeGraphCam, isoTiltCss, ATTACH, attachList } from './ui.js'; export { frontierOf, fmtUnit, keysAt, trackAt, niceTicks, noSrc, scatterTimes, tableTimes, readoutGeo } from './ui-proof.js'; export { lintBranchTrace, traceTimes, traceCaptions, captionAt, bubbleGeo } from './ui-trace.js'; export { pageFlyCam } from './ui-nav.js'; export { wrapWords } from './ui-data.js';
export { SHAPES, PIXEL5x7, pixelGlyph, tokenize } from './kinetic.js'; export { photoTile, slotMedia, placeholderLogo, MARKS, DEFAULT_MARK } from './media.js'; export { measure } from './core.js';
export { CARDS, CARD_IDS, cardsAt, stackFlipTimes, drawCards, renderCards, mountCards, placeholderCard, placeholderCards, loadImages } from './cards.js';
export { BOARD, BOARD_D, boardAt, drawBoard, mountBoard } from './board.js';
export { PIN_LAYOUTS, homography, matrix3d, cornersAt, lintQuad, drawQuad, mountPin } from './cornerpin.js';
export { LAYOUTS, layoutAt, applyLayout } from './layout.js'; export { prepareDrawOn, drawOnAt, trimAt, bindDrawOn, drawAttrs } from './drawon.js';
export { STICKER_NAMES, REACTIONS, MOTIONS, setGlyphSource };
export const GFX = { ...EDITORIAL, ...CALLOUTS, ...SOCIAL, ...STICKER_GFX, ...UI, ...KINETIC, ...COLLAGE, ...DOC, ...SWAP, ...BADGES, ...BRAND_LAYOUTS, ...R45, ...TYPE_R45, ...GLYPH_R45, ...R6, ...HUMAN, ...HW_GFX, ...EXPLAIN, ...EXPLAIN_DATA };
export { fmtNum, pointAt as hwPointAt, dieBlocks } from './hw.js';
export { fmtNumber, fmtAxis, groupDigits, compactParts, LOCALES } from './numfmt.js'; export { parseGraph, layoutGraph, edgeKey } from './graph.js'; export { chartGeom, datumXY, niceDomain, hexLayout, footerSVG } from './explain-data.js'; export { diagramTimes, camAt, scrollyGeom, stepActive, wrap as wrapText } from './explain.js'; export { ICONS, ICON_NAMES, iconSVG } from './explain-icons.js';
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
  ui: ['sfx/ui/pop', 1, -2], 'ui.promptBar': ['sfx/ui/click', 1, -2], 'ui.checklist': ['sfx/ui/pop', 1, -2], 'ui.scanOverlay': ['sfx/ui/camera_ping', 1, -2], 'ui.isometricTilt': ['sfx/whoosh/swish_xs', 0, -3], 'ui.stateMorph': ['sfx/ui/click', 1, -2],
  'ui.liveTranscript': ['sfx/ui/ai_reply', 1, -3], 'ui.wordRegenerate': ['sfx/ui/click', 1, -2], 'ui.receiptCompare': ['sfx/device/card_flip', 1, -3], 'ui.failoverRoute': ['sfx/ui/toggle_on', 1, -3],
  'ui.fileChip': ['sfx/ui/pop', 1, -2], 'ui.pageFlythrough': ['sfx/whoosh/swish_s', 0, -3], 'ui.tabPillNav': ['sfx/ui/slide', 1, -3], 'ui.windowWall': ['sfx/whoosh/whoosh_l', 0, -3], 'ui.optionPicker': ['sfx/ui/tick', 1, -3],
  'type.wordWheel': ['sfx/ui/tick', 1, -4], 'type.inlineMedia': ['sfx/ui/pop', 1, -3], 'type.letterAssemble': ['sfx/whoosh/magic_swirl', 12, -4], 'type.glyphMorphCursor': ['sfx/ui/typing_burst', 0, -6],
  'type.marquee': ['sfx/whoosh/swish_s', 0, -4], 'type.bleedWord': ['sfx/whoosh/whip_pan', 0, -2], 'layout.scatterCollage': ['sfx/whoosh/whoosh_m', 34, -2], 'layout.mosaicBurst': ['sfx/whoosh/whoosh_l', 0, -2],
  'layout.logoWall': ['sfx/ui/pop', 9, -4], 'layout.orbitRing': ['sfx/whoosh/swish_s', 13, -3], 'callout.connectorLabel': ['sfx/ui/slide', 1, -3],
  'lowerThird.docSuper': ['sfx/tx/cut_tick', 0, -6], 'caption.subtitleSpeedGag': ['sfx/ui/click', 46, -2], 'layout.cardStack': ['sfx/paper/flip', 0, -3], 'layout.cardRiver': ['sfx/whoosh/swish_s', 0, -2], 'layout.cornerPin': ['sfx/ui/pop', 1, -4], 'layout.evidenceBoard': ['sfx/foley/stamp', 1, -2],
  /* round 3 (2026-10-14): type + layout parts; gfxCues(id) gives one cue per action */
  'type.accentSwap': ['sfx/whoosh/swish_xs', 0, -4], 'callout.selectionBox': ['sfx/ui/slide', 0, -3], 'counter.scoreIterate': ['sfx/ui/count_tick', 1, -3], 'counter.stepPill': ['sfx/ui/count_tick', 1, -4],
  'type.wordSplitMedia': ['sfx/ui/slide', 11, -3], 'type.imageFill': ['sfx/tx/mask_reveal', 0, -4], 'type.strikeOut': ['sfx/whoosh/zip', 21, -4], 'caption.speakerTag': ['sfx/ui/mic_on', 0, -6],
  'type.glowWord': ['sfx/sparkle/shimmer', 0, -4], 'type.ledDigits': ['sfx/device/loading_tick', 0, -4], 'title.timeCard': ['sfx/cartoon/surprise_sting', 0, -2],
  'layout.paletteColumns': ['sfx/whoosh/swish_s', 0, -3], 'layout.logoConstruction': ['sfx/sparkle/letter_assemble', 30, -4], 'layout.mockupInContext': ['sfx/whoosh/whoosh_in_m', 0, -4],
  'layout.typeSpecimen': ['sfx/ui/tick', 11, -4], 'layout.backdropSwap': ['sfx/tx/cut_tick', 15, -4], 'layout.lineup': ['sfx/whoosh/swish_s', 0, -3],
  /* round 4+5 (2026-10-14): proof-film parts; gfxCues(id) gives one cue per action */
  'chart.scatterFrontier': ['sfx/ui/slide', 1, -3], 'ui.branchTrace': ['sfx/ui/toggle_on', 1, -3], 'ui.dataTable': ['sfx/ui/slide', 7, -3], 'caption.sceneBubble': ['sfx/ui/pop', 7, -4],
  'ui.costTicker': ['sfx/ui/count_run', 10, -4], 'type.paramReadout': ['sfx/ui/count_tick', 6, -5], 'lowerThird.personalTag': ['sfx/whoosh/swish_s', 0, -3], 'ui.promptBar.attach': ['sfx/device/mouse_click', 9, -2],
  /* round 4/5 (2026-10-14): r45-type.js + r45-glyph.js; electricOutline reads ELECTRIC_SOUND (the glitch stutter until sfx/elec/arc is in the library) */
  'title.partnerLockup': ['sfx/hit/soft', 1, -2], 'layout.iconMergeLockup': ['sfx/hit/soft', 1, -3], 'type.asciiMosaic': ['sfx/whoosh/magic_swirl', 10, -4], 'type.textOnPath': ['sfx/whoosh/flyby', 3, -4],
  'type.flankWords': ['sfx/whoosh/swish_s', 0, -4], 'type.electricOutline': [ELECTRIC_SOUND, 0, -6], 'type.behindSubject': ['sfx/whoosh/whoosh_in_m', 0, -4],
  /* round 6 (2026-10-15): r6.js; gfxCues / uiCues give one cue per action */
  'chart.hoverTooltip': ['sfx/ui/tick', 1, -4], 'ui.dockLaunch': ['sfx/device/mouse_click', 1, -2], 'title.verbCard': ['sfx/hit/soft', 1, -2], 'ui.connectRows': ['sfx/device/mouse_click', 1, -2], 'layout.degradingDiagram': ['sfx/ui/pop', 1, -4], 'type.commandPill': ['sfx/ui/type_key', 1, -5],
  /* lane human (2026-10-16): human.js; gfxCues gives one cue per action */
  'ui.keyCombo': ['sfx/device/keyboard_mech_clack', 5, -4], 'callout.highlightBox': ['sfx/ui/slide', 0, -4], 'ui.codeCallout': ['sfx/whoosh/swish_xs', 0, -4], 'ui.stepCounter': ['sfx/ui/count_tick', 1, -5], 'ui.cursorTrack': ['sfx/device/mouse_click', 0, -4],
  'ui.waveform': ['sfx/ui/blip', 0, -10], 'title.locationCard': ['sfx/whoosh/swish_s', 0, -3], 'title.yearTimeline': ['sfx/ui/slide', 0, -4], 'caption.pullQuote': ['sfx/paper/flip', 3, -4], 'ui.quizCard': ['sfx/ui/pop', 1, -3],
  'title.recapCard': ['sfx/ui/pop', 15, -4], 'title.hookCard': ['sfx/hit/soft', 0, -2], 'title.endScreen': ['sfx/whoosh/whoosh_in_m', 0, -3], 'callout.resultReveal': ['sfx/tx/mask_reveal', 0, -3], 'title.stepCard': ['sfx/whoosh/whoosh_in_m', 0, -3],
  /* xp-hardware (2026-10-16): hw.js; gfxCues gives one cue per action */
  hw: ['sfx/hw/click_detent', 1, -3], 'hw.dateCard': ['sfx/hit/soft', 4, -2], 'hw.edgeGlint': ['sfx/hw/light_sweep', 18, -4], 'hw.chipDie': ['sfx/hw/led_on', 10, -3],
  /* xp-explainer (2026-10-16): explain.js + explain-data.js; gfxCues gives one cue per action */
  diagram: ['sfx/ui/pop', 1, -3], 'diagram.flow': ['sfx/whoosh/swish_s', 0, -4], 'chart.story': ['sfx/ui/count_run', 1, -3], 'chart.sourceFooter': ['sfx/ui/blip', 0, -12], 'callout.datum': ['sfx/ui/pop', 1, -3], 'map.hexTile': ['sfx/sparkle/shimmer', 3, -4],
  'counter.hero': ['sfx/ui/count_run', 1, -2], 'layout.scrolly': ['sfx/ui/slide', 0, -4], 'title.takeaway': ['sfx/hit/soft', 0, -2], process: ['sfx/ui/count_tick', 1, -4], 'process.beforeAfter': ['sfx/tx/mask_reveal', 0, -3] };
export const sfxFor = (id) => { let best = null; for (const k of Object.keys(GFX_SFX)) if ((id === k || id.startsWith(k + '.')) && (!best || k.length > best.length)) best = k; return best ? { id: GFX_SFX[best][0], offset_f: GFX_SFX[best][1], gain_db: GFX_SFX[best][2] } : null; };
/* def ids are document-wide: every <svg> of every host in a page shares one id namespace, and url(#id) resolves to the FIRST match. Parts used to name their defs by hand ('lc' / 'lg' in chart.line, 'neon', 'odo',
   'dsScrim') or by a hash of a few params (uidOf: no `at`, most params missing), so two items in one host (two chart.line items; two ui.stateMorph with the same text at different times) shared a def and the second
   was clipped with the first one's progress: a picture that depended on the OTHER item, not on t. renderInner now namespaces every id an item defines (and the url(#...) references to them) with a 64-bit hash of the
   item's own markup: the same id then always means the same defs, whatever else is in the host, and equal pictures (however the params were spelled) keep equal strings. Pure: a function of the markup. */
const hash64 = (str) => { let a = 2166136261 >>> 0, b = 0x9e3779b9; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b ^ c, 2246822519) >>> 0; b = (b ^ (b >>> 15)) >>> 0; } return 'k' + a.toString(36) + b.toString(36); };
const ID_ATTR = /(?<![\w-])id="([^"]+)"/g, URL_REF = /url\(#([^)\s"']+)\)/g;
export function nsIds(svg) {
  const ids = new Set(); for (const m of svg.matchAll(ID_ATTR)) ids.add(m[1]); if (!ids.size) return svg;
  const key = hash64(svg); return svg.replace(ID_ATTR, (_, i) => `id="${i}-${key}"`).replace(URL_REF, (m, i) => (ids.has(i) ? `url(#${i}-${key})` : m));
}
export function renderInner(id, t, { at = 0, dur, params = {} } = {}, ctx) {
  const g = GFX[id]; if (!g) throw new Error('unknown gfx ' + id); const p = saneParams({ ...g.d, ...params }, g.d, GFX_LIM[id]), L = life(t, at, dur ?? p.dur ?? g.dur, g.inF ?? 12, g.outF ?? 9);
  L.t = t; L.at = at;   // composition time and the item's start: lets a part follow layout.cornerPin data, whose keys are in composition time (ui.costTicker, caption.sceneBubble anchors)
  return L.on ? nsIds(g.svg(L, p, ctx)) : '';
}
export function renderSVG(id, t, opts = {}, { W = 1920, H = 1080, platform = null, seed = 1 } = {}) {
  const ctx = ctxFor(W, H, platform, seed), inner = renderInner(id, t, opts, ctx);
  return inner ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${inner}</svg>` : '';
}
export function mountGfx(root, items, { W = 1920, H = 1080, platform = null, seed = 1 } = {}) {
  const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); host.setAttribute('viewBox', `0 0 ${W} ${H}`);
  Object.assign(host.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }); root.appendChild(host);
  const ctx = ctxFor(W, H, platform, seed);
  return { host, render(t) { host.innerHTML = items.map((it, i) => renderInner(it.id, t, it, { ...ctx, item: i })).join(''); return this; } };
}
export function bindHF(stack, { t0 = 0 } = {}) { const f = (t) => stack.render(t - t0); window.addEventListener('hf-seek', (e) => f(e.detail.time)); f(window.__hfThreeTime || 0); return f; }
/* ui.* sound cue hook: every action of a UI-kit item (keystrokes, clicks, ticks, lock-on, morphs) as [{ t (absolute s), id: 'sfx/<cat>/<name>', why }] for the plan's cue sheet */
export function uiCues(id, { at = 0, params = {} } = {}) { const g = UI[id], f = UI_CUES[id]; if (!g || !f) return []; return f({ ...g.d, ...params }).map((c) => ({ ...c, t: +(c.t + at).toFixed(4) })); }
uiHooks.renderInner = renderInner;
/* per-action sound cues for every gfx id that has them (the ui.* kit and the round-3 parts): [{ t (absolute s), id: 'sfx/<cat>/<name>', why }];
   ids without an action table fall back to their single sfxFor() default at `at` + offset. */
const ACTION_CUES = { ...SWAP_CUES, ...BADGE_CUES, ...BRAND_CUES, ...R45_CUES, ...TYPE_R45_CUES, ...GLYPH_R45_CUES, ...R6_CUES, ...HUMAN_CUES, ...HW_CUES, ...EXPLAIN_CUES, ...EXPLAIN_DATA_CUES };
export function gfxCues(id, { at = 0, params = {}, dur } = {}) {
  if (UI_CUES[id]) return uiCues(id, { at, params }); const g = GFX[id], f = ACTION_CUES[id];
  if (g && f) return f({ ...g.d, dur: dur ?? g.dur, ...params }).map((c) => ({ ...c, t: +(c.t + at).toFixed(4) }));
  const d = sfxFor(id); return d ? [{ t: +(at + d.offset_f / 30).toFixed(4), id: d.id, why: id + ' default' }] : [];
}
