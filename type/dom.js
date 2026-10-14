/* motion-pack / type / dom.js: DOM renderer for the kinetic presets and captions in HyperFrames / HTML compositions. Same pure state functions as the canvas renderer.
   mountType(container, spec, {fontPx})        -> spans per unit (word | char | line), line boxes for masks
   bakeType(tl, mounted, spec, opts)           -> one GSAP tl.set per CHANGED frame per unit (deduped): the timeline stays the single source of truth, seek-safe
   driveType(mounted, spec, opts)              -> same states applied straight from 'hf-seek' (no timeline cost)
   mountCaptions / bakeCaptions / driveCaptions -> the caption engine on DOM spans, positioned in the platform safe zone.
   units: x/y in em of the font size, blur in px @1080 scaled by H/1080. Mask presets clip to the line box (overflow hidden on .mp-line).                                              */
import { PRESETS, unitStates } from './presets.js';
import { captionFrame } from './captions.js';
import { captionBox } from './safezones.js';
import { iconSVG } from './icons.js';

const css = (el, o) => Object.assign(el.style, o);
export function mountType(container, spec, { fontPx = 124, font = {}, H = 1080 } = {}) {
  const def = PRESETS[spec.preset], unit = spec.unit || def.unit, root = document.createElement('div'); root.className = 'mp-type'; css(root, { fontSize: fontPx + 'px', fontWeight: String(font.weight ?? 800), fontFamily: font.family ?? 'Manrope, "Helvetica Neue", Arial, sans-serif', letterSpacing: (font.tracking ?? -0.035) + 'em', lineHeight: String(font.lineHeight ?? 1.0), whiteSpace: 'pre-wrap' });
  const lines = spec.lines || [spec.text], units = [], texts = [];
  lines.forEach((ln, li) => { const L = document.createElement('div'); L.className = 'mp-line'; css(L, { position: 'relative', paddingBottom: '0.12em', overflow: def.mask === 'line' ? 'hidden' : 'visible' });
    if (unit === 'line') { const s = document.createElement('span'); s.className = 'mp-u'; s.textContent = ln; css(s, { display: 'inline-block', willChange: 'transform' }); L.appendChild(s); units.push({ el: s, text: ln, line: li }); texts.push(ln); }
    else ln.split(/(\s+)/).forEach((tok) => { if (!tok) return; if (/^\s+$/.test(tok)) { L.appendChild(document.createTextNode(tok)); return; }
      if (unit === 'word') { const s = document.createElement('span'); s.className = 'mp-u'; s.textContent = tok; css(s, { display: 'inline-block' }); L.appendChild(s); units.push({ el: s, text: tok, line: li }); texts.push(tok); }
      else for (const ch of tok) { const s = document.createElement('span'); s.className = 'mp-u'; s.textContent = ch; css(s, { display: 'inline-block' }); L.appendChild(s); units.push({ el: s, text: ch, line: li }); texts.push(ch); } });
    root.appendChild(L); });
  /* outline presets (outlineFill): fill and stroke follow two CSS variables the bake sets per frame; colour stays currentColor (accent <em> recolours keep working) */
  if (def.outline) for (const u of units) css(u.el, { webkitTextFillColor: 'color-mix(in srgb, currentColor calc(var(--mp-fill, 1) * 100%), transparent)', webkitTextStroke: 'calc(var(--mp-stroke, 0) * 1em) currentColor' });
  container.appendChild(root); return { root, units, texts, fontPx, H, spec };
}
/* a unit state -> GSAP vars / CSS values */
export function stateToVars(s, fontPx, H, originalText) {
  const S = H / 1080; const clip = s.clip < 1 ? `inset(-20% ${((1 - s.clip) * 100).toFixed(2)}% -20% -20%)` : 'none';
  return { x: +(s.x * fontPx + s.shake[0] * S).toFixed(2), y: +(s.y * fontPx + s.shake[1] * S).toFixed(2), scale: +s.scale.toFixed(4), rotation: +s.rot.toFixed(3), rotationX: +s.rotX.toFixed(2), transformPerspective: s.rotX ? 900 : 0, opacity: +Math.min(1, Math.max(0, s.opacity)).toFixed(4),
    clipPath: clip, letterSpacing: s.track ? s.track.toFixed(4) + 'em' : 'normal', fontVariationSettings: s.wght != null ? `"wght" ${Math.round(s.wght)}` : 'normal', filter: s.blur > 0.3 ? `blur(${(s.blur * S).toFixed(2)}px)` : 'none', textContent: s.glyph ?? originalText,
    ...(s.fill != null ? { '--mp-fill': +s.fill.toFixed(4), '--mp-stroke': +(s.stroke ?? 0).toFixed(5) } : {}) };
}
export function bakeType(tl, m, spec, { t0 = 0, dur, fps = 30 } = {}) {
  const n = Math.round(dur * fps), prev = m.units.map(() => null);
  for (let i = 0; i <= n; i++) { const t = i / fps, R = unitStates(spec, m.texts, t0 + t);
    m.units.forEach((u, k) => { const v = stateToVars(R.states[k], m.fontPx, m.H, u.text), key = JSON.stringify(v); if (i > 0 && key === prev[k]) return; prev[k] = key; const { textContent, ...gv } = v;
      if (i === 0) tl.fromTo(u.el, gv, { ...gv, duration: 1 / fps / 2, ease: 'none', immediateRender: true }, t0); else tl.set(u.el, gv, t0 + t);
      }); }
  if (spec.preset === 'scramble') console.warn('type/dom: scramble swaps glyph text, which a timeline cannot hold seek-safely: use driveType (hf-seek) or the canvas renderer');
  return tl;
}
export function driveType(m, spec, { t0 = 0 } = {}) {
  const f = (t) => { const R = unitStates(spec, m.texts, t - t0); m.units.forEach((u, k) => { const v = stateToVars(R.states[k], m.fontPx, m.H, u.text), e = u.el; e.style.transform = `perspective(${v.transformPerspective || 0}px) translate(${v.x}px, ${v.y}px) rotateX(${v.rotationX}deg) rotate(${v.rotation}deg) scale(${v.scale})`.replace('perspective(0px) ', ''); e.style.opacity = v.opacity; e.style.clipPath = v.clipPath; e.style.letterSpacing = v.letterSpacing; e.style.fontVariationSettings = v.fontVariationSettings; e.style.filter = v.filter; if (v['--mp-fill'] != null) { e.style.setProperty('--mp-fill', v['--mp-fill']); e.style.setProperty('--mp-stroke', v['--mp-stroke']); } if (e.textContent !== v.textContent) e.textContent = v.textContent; }); return R; };
  window.addEventListener('hf-seek', (e) => f(e.detail.time)); f(window.__hfThreeTime || 0); return f;
}
/* ---- captions ---- */
export function mountCaptions(root, chunks, style, { W = 1080, H = 1920, platform = 'conservative', font = 'Manrope, "Helvetica Neue", Arial, sans-serif', box = null } = {}) {
  const S = (H > W ? W : H) / 1080, fontPx = style.size * S, b = box || captionBox(platform, W, H, { lines: 2, fontPx }), els = [];
  chunks.forEach((c) => { const d = document.createElement('div'); d.className = 'mp-cap'; css(d, { position: 'absolute', left: b.x0 + 'px', width: b.w + 'px', top: b.y0 + 'px', height: b.h + 'px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'flex-end', gap: `0 ${(fontPx * 0.28).toFixed(1)}px`, opacity: '0', fontFamily: font, fontWeight: String(style.weight), fontSize: fontPx + 'px', lineHeight: '1.18', color: style.color, textAlign: 'center', pointerEvents: 'none',
      textShadow: style.shadow ? `0 ${(style.shadow * fontPx * 0.35).toFixed(1)}px ${(style.shadow * fontPx * 1.2).toFixed(1)}px rgba(0,0,0,.55)` : 'none', webkitTextStroke: style.stroke ? `${(style.stroke * fontPx * 1.0).toFixed(2)}px rgba(8,8,16,.92)` : '0', paintOrder: 'stroke fill' });
    const ws = c.words.map((w) => { const s = document.createElement('span'); s.textContent = style.upper ? w.w.toUpperCase() : w.w; css(s, { display: 'inline-block', padding: style.pill ? `0 ${(fontPx * 0.22).toFixed(1)}px` : '0', borderRadius: (fontPx * 0.3).toFixed(1) + 'px', willChange: 'transform' }); d.appendChild(s); return s; }); root.appendChild(d); els.push({ chunk: c, el: d, words: ws }); });
  return { els, fontPx, style, box: b };
}
const capVars = (m, F) => F ? { chunkOp: Math.min(1, F.words[0] ? F.words[0].opacity : 0), words: F.words.map((w) => ({ opacity: +w.opacity.toFixed(3), scale: +w.scale.toFixed(4), color: w.color, background: m.style.pill && w.bg > 0.01 ? m.style.accent : 'transparent' })) } : null;
export function bakeCaptions(tl, m, chunks, { t0 = 0, dur, fps = 30 } = {}) {
  const n = Math.round(dur * fps), cache = new Map();
  for (let i = 0; i <= n; i++) { const t = i / fps; m.els.forEach((e, ci) => { const live = t + t0 >= e.chunk.s - 1e-9 && t + t0 < e.chunk.e, wasLive = i > 0 && (t - 1 / fps + t0 >= e.chunk.s - 1e-9 && t - 1 / fps + t0 < e.chunk.e);
      if (!live && !wasLive && i > 0) return; const F = live ? captionFrame(chunks, t0 + t, m.style) : null, v = F && F.index === ci ? capVars(m, F) : null, key = JSON.stringify(v);
      if (i > 0 && cache.get(ci) === key) return; cache.set(ci, key);
      const dv = { opacity: v ? 1 : 0 }; if (i === 0) tl.fromTo(e.el, dv, { ...dv, duration: 1 / fps / 2, ease: 'none', immediateRender: true }, t0); else tl.set(e.el, dv, t0 + t);
      if (v) e.words.forEach((s, k) => { const w = v.words[k]; if (i === 0) tl.fromTo(s, w, { ...w, duration: 1 / fps / 2, ease: 'none', immediateRender: true }, t0); else tl.set(s, w, t0 + t); }); }); }
  return tl;
}
export function driveCaptions(m, chunks, { t0 = 0 } = {}) {
  const f = (t) => { m.els.forEach((e, ci) => { const F = captionFrame(chunks, t - t0 + 0, m.style), v = F && F.index === ci ? capVars(m, F) : null; e.el.style.opacity = v ? '1' : '0'; if (v) e.words.forEach((s, k) => { const w = v.words[k]; s.style.opacity = w.opacity; s.style.transform = `scale(${w.scale})`; s.style.color = w.color; s.style.background = w.background; }); }); };
  window.addEventListener('hf-seek', (e) => f(e.detail.time)); f(window.__hfThreeTime || 0); return f;
}
export { iconSVG };
