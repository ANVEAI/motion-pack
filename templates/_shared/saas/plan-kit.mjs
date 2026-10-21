/* templates/_shared/saas/plan-kit.mjs: node helpers that turn a SaaS template's scene list into a pack plan (2026-10-16, lane xp-saas). Pure: no clock, no randomness, no file writes.
   scenesToPlan(list, C, A, extra) takes scenes with RELATIVE times (each item / head `at` in seconds from the scene start) and returns the plan: shots laid end to end on whole frames
   (plan.mjs sequence: transition sweeteners on the cut frame), absolute times, every gfx item's own sound cues (gfxCues) inside its scene, `win` references resolved (a cursor or a callout that
   follows a ui.appWindow names it with `winOf: '<item key>'`), plan.texts for eyes (box, size, colour, time) and plan.claims for lint.proof. */
import { sequence, PLATFORMS } from '../plan.mjs';
import { gfxCues, measure } from '../../../type/gfx/index.js';
import { headBox, plain } from './kit.mjs';

export const ASPECTS = { '16:9': { W: 1920, H: 1080, platform: 'x.video', zone: 'wideTitle', tall: false, key: 'wide' }, '9:16': { W: 1080, H: 1920, platform: 'reels.organic', zone: 'conservative', tall: true, key: 'tall' } };   // zone = type/safezones.js (the gfx parts' safe rect)
export const aspectOf = (C) => { const A = ASPECTS[C.aspect]; if (!A) throw new Error(`aspect "${C.aspect}": use '16:9' or '9:16' (each is its own re-layout, never a crop)`); return { ...A, platform: C.platform || A.platform }; };
const r4 = (v) => +(+v).toFixed(4);
const IMG = /\.(png|jpe?g|webp|gif|svg)$/i, VID = /\.(mp4|webm|mov|m4v)$/i;
export const mediaKind = (src) => (!src ? null : VID.test(src) ? 'video' : IMG.test(src) ? 'image' : 'unknown');
/* a CONFIG.media slot applied to a window / device item: an image goes into the screen slot (assets/media/<name>); a video becomes a DOM <video> layer the page places in the content rect */
export function applyMedia(item, slot, key) {
  if (!slot || !slot.src) return item; const kind = mediaKind(slot.src), name = 'assets/media/' + String(slot.src).split('/').pop();
  if (kind === 'image') return { ...item, screen: undefined, params: { ...item.params, screen: { ...(item.params.screen || {}), src: name, w: slot.w ?? item.params.screen?.w ?? 1440, h: slot.h ?? item.params.screen?.h ?? 900 }, label: slot.label ?? '' } };
  if (kind === 'video') return { ...item, screen: undefined, video: { src: name, start: slot.start ?? 0, key }, params: { ...item.params, screen: { ...(item.params.screen || {}), w: slot.w ?? 1920, h: slot.h ?? 1080 }, label: slot.label ?? '' } };
  throw new Error(`media.${key}.src "${slot.src}": a screenshot (.png .jpg .webp) or a screen recording (.mp4 .webm .mov)`);
}
const stripScreen = (p) => { const { screen, ...rest } = p || {}; return { ...rest, screen: screen ? { w: screen.w, h: screen.h, anchor: screen.anchor } : undefined }; };

export function scenesToPlan(list, C, A, { template, paceRule = { aslMax: 5, longMax: 16.5 }, claims = [], extraCues = [] } = {}) {
  const fps = C.fps, { shots, cues, seconds } = sequence(list.map((s) => ({ id: s.id, dur: s.dur, kind: s.kind, ...(s.tx ? { tx: s.tx, txReason: s.txReason } : {}), ...(s.hold ? { hold: true } : {}), ...(s.txGain != null ? { txGain: s.txGain } : {}) })), fps);
  const scenes = list.map((s, i) => { const st = shots[i].start, en = r4(st + shots[i].dur), abs = (v) => r4(st + v), tail = en + 0.6 - st;
    const items = (s.items || []).map((it) => ({ ...it, at: abs(it.at ?? 0), dur: r4(it.dur ?? Math.max(0.2, tail - (it.at ?? 0))) })), under = (s.under || []).map((it) => ({ ...it, at: abs(it.at ?? 0), dur: r4(it.dur ?? Math.max(0.2, tail - (it.at ?? 0))) }));
    const all = [...under, ...items], byKey = Object.fromEntries(all.filter((it) => it.key).map((it) => [it.key, it]));
    for (const it of all) if (it.winOf) { const w = byKey[it.winOf]; if (!w) throw new Error(`scene ${s.id}: winOf "${it.winOf}" names no item`); it.params = { ...it.params, win: { at: w.at, dur: w.dur, params: stripScreen(w.params) } }; delete it.winOf; }
    const heads = (s.heads || []).map((h) => ({ ...h, at: abs(h.at ?? 0), ...(h.out != null ? { out: abs(h.out) } : {}) })), kickers = (s.kickers || []).map((k) => ({ ...k, at: abs(k.at ?? 0) }));
    return { id: s.id, start: st, end: en, bg: s.bg || 'paper', grid: s.grid ?? 0, heads, kickers, items, under, ...(s.mark ? { mark: { ...s.mark, at: abs(s.mark.at ?? 0) } } : {}), ...(s.card ? { card: { ...s.card, at: abs(s.card.at ?? 0) } } : {}),
      ...(s.caption ? { caption: s.caption } : {}), ...(s.labels ? { labels: s.labels.map((l) => ({ ...l, at: abs(l.at ?? 0) })) } : {}), why: s.why }; });
  /* sound: every item's own action cues inside its scene window, then the scene's extra cues (relative), then the template's */
  for (const [i, sc] of scenes.entries()) { for (const it of [...sc.under, ...sc.items]) { if (it.mute) continue; for (const q of gfxCues(it.id, { at: it.at, params: it.params, dur: it.dur })) if (q.t >= sc.start - 1e-6 && q.t < sc.end - 1 / fps) cues.push({ ...q, scene: sc.id, ...(it.cueDb != null ? { overBedDb: it.cueDb } : {}) }); }
    for (const q of list[i].cues || []) cues.push({ ...q, t: r4(sc.start + q.t), scene: sc.id }); }
  for (const q of extraCues) cues.push(q);
  for (const c of cues) c.t = r4(Math.floor(c.t * fps + 0.5 + 1e-9) / fps);   // whole frames (the mixer places a cue on round(t * fps))
  cues.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  /* plan.texts: every headline and kicker with its box for eyes (node measure = the textW estimate; the page measures with canvas metrics) */
  const texts = []; for (const sc of scenes) { sc.heads.forEach((h, j) => { const b = headBox(h, measure); texts.push({ id: `${sc.id}.head${j}`, text: plain(h.text), t: [h.at, r4(Math.min(h.out ?? sc.end, sc.end))], box: b, fontPx: h.size, role: h.role || 'headline', fg: h.color ?? C.brand.ink, ...(/\*[^*]+\*/.test(h.text || '') ? { fgAlt: [C.brand.accent] } : {}) }); });   // a two-colour line declares its accent, so eyes reads the accent glyphs as text, not backdrop
    if (sc.card) texts.push({ id: `${sc.id}.cta`, text: C.brand.cta, t: [r4(sc.card.at + 0.45), sc.end], box: null, fontPx: Math.round(52 * (sc.card.unit ?? 1)), role: 'endcard', fg: '#FFFFFF' }); }
  const videos = []; for (const sc of scenes) for (const it of [...sc.under, ...sc.items]) if (it.video) videos.push({ scene: sc.id, item: it.key || it.id, src: it.video.src, start: it.video.start, at: it.at, dur: it.dur });
  const P = PLATFORMS[A.platform] || PLATFORMS['x.video'];
  return { template, fps, seconds, aspect: C.aspect, W: A.W, H: A.H, platform: A.platform, zone: A.zone, safe: P.safe, brand: C.brand, length: C.length, shots, scenes, videos, cues, claims, texts, paceRule,
    music: C.music, musicGainDb: C.musicGainDb ?? 0, ceilingDb: C.ceilingDb ?? -2.5, fadeInMs: C.fadeInMs ?? 30, layers: C.layers || [] };
}
/* the copy of CONFIG.text is the only place words live: a missing key is a build error, not an empty frame */
export const need = (o, path) => { const v = path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); if (v == null || v === '') throw new Error(`CONFIG.${path} is empty: every on-screen line lives in CONFIG.text`); return v; };
/* a digit in the copy that is not a sourced claim: the template refuses it (lint.proof only reads plan.claims, so copy is checked here) */
export function digitsInCopy(text, allow = []) { const out = []; const walk = (v, p) => { if (typeof v === 'string') { if (/\d/.test(v) && !allow.some((a) => p.startsWith(a))) out.push(`text.${p}: "${v}" has a digit: put the number in CONFIG.claims with its source, or write it in words`); } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}.${i}`)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k); }; walk(text, ''); return out; }
