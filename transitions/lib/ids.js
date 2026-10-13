/* motion-pack / transitions / lib / ids.js
   One resolver for every transition id the rest of the pack writes: 'transitions/<name>'.
   <name> may be the registry key (whip, zoomThrough), its kebab-case form (zoom-through), a registry alias (dipToBlack),
   or one of the edit-grammar ids below. resolveTx(id) -> { id, key, params, kind } where kind is
     'cut'   : hard cut (no window, no sound)              'smash' : hard cut that carries the smash sound (cuts/patterns.json smash)
     'dom'   : has a DOM back-end (HyperFrames DOM templates); approx: true = GL-only look, DOM approximation (tx-dom-x.js APPROX)   'gl' : GL-only (canvas sources, tx-gl.js / tx-three.js)
   Unknown ids return null (templates log them as TODO and hard-cut; tools/check_ids.py fails the build on them). */
import { REGISTRY } from './registry.js';
import { DOM_KEYS, APPROX_KEYS } from './tx-dom.js';
import { XFADE } from './xfade.js';

const kebab = k => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
/* edit-grammar ids used by templates and planners that are not plain registry keys */
export const GRAMMAR = {
  cut: { key: null, kind: 'cut', params: {} },
  smash: { key: null, kind: 'smash', params: {} },
  'dip-to-black': { key: 'dip', params: { color: '#000000' } },
  'dip-to-white': { key: 'dip', params: { color: '#ffffff' } },
  'dip-to-brand': { key: 'dip', params: { color: '#4a18ed' } },   // brand violet; pass params.color for another brand
  crossfade: { key: 'dissolve', params: {} },
  'whip-pan': { key: 'whip', params: {} },
  'iris-out': { key: 'iris', params: {} },
};
export const ALIASES = (() => {
  const a = {};
  for (const [key, e] of Object.entries(REGISTRY)) {
    a[key] = { key, params: {} }; a[kebab(key)] = { key, params: {} };
    for (const al of e.aliases || []) a[al] = { key, params: {} };
  }
  for (const [m, x] of Object.entries(XFADE)) a['xfade-' + m] = { key: x.key, params: { ...x.params }, xfade: m };   // ffmpeg xfade modes (lib/xfade.js)
  a.dipToBlack = GRAMMAR['dip-to-black']; a.dipToWhite = GRAMMAR['dip-to-white']; a.dipToBrand = GRAMMAR['dip-to-brand'];
  return { ...a, ...GRAMMAR };
})();
export function resolveTx(id) {
  if (!id) return null;
  const name = String(id).replace(/^transitions\//, ''), hit = ALIASES[name];
  if (!hit) return null;
  const approx = !hit.kind && !DOM_KEYS.includes(hit.key) && APPROX_KEYS.includes(hit.key);
  const kind = hit.kind || (DOM_KEYS.includes(hit.key) || approx ? 'dom' : 'gl');
  return { id: 'transitions/' + name, key: hit.key, params: { ...hit.params }, kind, ...(approx ? { approx: true } : {}), ...(hit.xfade ? { xfade: hit.xfade } : {}) };
}
