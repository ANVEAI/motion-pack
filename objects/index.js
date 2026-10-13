/* motion-pack/objects: ONE import for every prop, set piece and character (three.js 0.160, the studio-kit render contract).
     import { O, REGISTRY, create } from '../objects/index.js';      // O.makeLaptop(ctx, parent, {...}) or create(ctx, parent, 'objects/laptop', {...})
   Every builder takes (ctx, parent, params) where ctx comes from kit/core.js runScene (ctx.add, ctx.emis, ctx.K_KEY ...).
   Every returned object exposes `group` (or `root`), setters that are pure functions of their arguments, and `probes` for __layout.
   REGISTRY: id -> { build, tags, state, doc }. Ids follow the pack convention objects/<name>. See objects/README.md. */
import * as SET from './lib/set.js';
import * as BOX from './lib/box.js';
import * as CHROME from './lib/chrome.js';
import * as PAPER from './lib/paper.js';
import * as READ from './lib/readouts.js';
import * as METER from './lib/meter.js';
import * as PANELS from './lib/panels.js';
import * as DEV from './lib/devices.js';
import * as MATS from './lib/mat.js';
import * as WORKER from './characters/worker.js';
import * as POSES from './characters/poses.js';

export const O = { ...SET, ...BOX, ...CHROME, ...PAPER, ...READ, ...METER, ...PANELS, ...DEV, ...MATS, ...WORKER, ...POSES };

const r = (build, tags, state, doc) => ({ build, tags, state, doc });
export const REGISTRY = {
  'objects/studio-env': r((ctx, _p, o) => SET.makeStudioEnv(ctx, o), ['set', 'light', 'ibl'], 'static', 'warm studio sphere baked to IBL + calm chrome env'),
  'objects/slab': r((ctx, _p, o) => SET.makeSet(ctx, o), ['set', 'stage', 'miniature'], 'setDip(y)', 'paper floor + floating white slab (props parent to slabG)'),
  'objects/desk': r((ctx, _p, o) => SET.makeDesk(ctx, o), ['set', 'stage', 'long'], 'setDip(y)', 'the slab extended along x for multi-zone sets'),
  'objects/slab-fx': r((ctx, p, o) => SET.makeSlabFx(ctx, p, o), ['decal', 'ring', 'glow'], 'u.uRing/uEdge/uGlow', 'alpha ring + perimeter line + additive glow on the slab top'),
  'objects/blob-shadow': r((ctx, p, o) => SET.makeBlobShadow(ctx, p, o.w, o.d), ['decal', 'shadow'], 'opacity, scale', 'soft contact occlusion ellipse'),
  'objects/studio-lights': r((ctx, p, o) => SET.makeStudioLights(ctx, p, o), ['light', 'click', 'fixture-free'], 'update(n, slot, dip, glint)', 'key + violet rim + top pool, 3-frame click flicker'),
  'objects/room-rig': r((ctx, _p, o) => SET.makeRig(ctx, o), ['light', 'mood', 'tension'], 'update(n, slot, S)', 'follow-light rig: tension (cool key + red rim) / solution (warm + violet)'),
  'objects/product-box': r((ctx, p, o) => { const b = BOX.makeAnveBox(ctx, o); p.add(b.group); return b; }, ['product', 'hero', 'brand'], 'pose(p,sx,sy,yaw), setBand, setLeds', 'the hero product box (proportions from the ANVE launch film)'),
  'objects/box-path': r((_ctx, _p, o) => BOX.makeBoxPath(o.spec, o.spotOf), ['motion', 'drop', 'hop', 'glide'], 'pose(t), dip(t), band(t,n)', 'drop / glide / travel / place choreography for any base-pivoted prop'),
  'objects/chrome-blob': r((ctx, _p, o) => CHROME.makeChromeBlob(ctx, o, o.env), ['liquid', 'chrome', 'sdf', 'cloud'], 'update(centre, prims, k)', 'smooth-min SDF liquid chrome (MarchingCubes)'),
  'objects/sheet': r((ctx, p, o) => PAPER.makeSheet(ctx, p, o, o.tex || PAPER.sheetTexture(o)), ['paper', 'document', 'curl'], 'bend(far, near), set(p, euler, s)', 'inextensible curling paper card'),
  'objects/paper-block': r((ctx, p, o) => PAPER.makePaperBlock(ctx, p, o), ['paper', 'stack'], 'static', 'paper stack block with page edges'),
  'objects/readout': r((ctx, p, o) => READ.makeReadout(ctx, p, o), ['counter', 'number', 'engraved'], 'set(value, hex)', 'engraved rolling-drum readout + mono label'),
  'objects/counter': r((ctx, p, o) => READ.makeCounter(ctx, p, o), ['counter', 'stand', 'legacy'], 'set(value, hex)', 'drum counter on a stand (legacy look)'),
  'objects/clock': r((ctx, p, o) => READ.makeClock(ctx, p, o), ['clock', 'time', 'engraved'], 'set(minutes)', 'HH:MM odometer clock'),
  'objects/meter': r((ctx, p, o) => METER.makeMeter(ctx, p, o), ['gauge', 'dial', 'needle', 'cost'], 'setValue(v), setZone(level)', 'standing dial with spring needle + red zone glow'),
  'objects/window': r((ctx, p, o) => PANELS.makeWindow(ctx, p, o), ['ui', 'app', 'tab', 'card'], 'set(p, {hinge, yaw, lean, scale})', 'satin app-window panel with printed UI face + tag'),
  'objects/tile': r((ctx, p, o) => PANELS.makeTile(ctx, p, o), ['icon', 'block', 'feature'], 'set(p, {yaw, roll, sx, sy})', 'satin block with an owned line icon'),
  'objects/stand-card': r((ctx, p, o) => PANELS.makeStandCard(ctx, p, o), ['card', 'sign', 'audience'], 'set(p, {yaw, lean})', 'standing engraved card: icon + name'),
  'objects/puck': r((ctx, p, o) => PANELS.makePuck(ctx, p, o), ['status', 'flip', 'lock', 'check'], 'set(p, ry, sxy, sz, rx)', 'two-sided enamel puck (flip = state change)'),
  'objects/plug': r((ctx, p, o) => PANELS.makePlug(ctx, p, o), ['integration', 'connector', 'led'], 'set(p, {rock, sz, led})', 'satin connector block with blade + LED bar (no third-party logos)'),
  'objects/laptop': r((ctx, p, o) => DEV.makeLaptop(ctx, p, o), ['device', 'computer', 'screen', 'new'], 'set({open, screen, ui}), pose(p, yaw)', 'NEW anodised laptop: instanced keys, hinged lid, live canvas screen'),
  'objects/phone': r((ctx, p, o) => DEV.makePhone(ctx, p, o), ['device', 'mobile', 'screen', 'new'], 'set({screen, ui}), pose(p, euler)', 'NEW phone: bevelled frame, glass front, camera island, live screen'),
  'objects/mug': r((ctx, p, o) => DEV.makeMug(ctx, p, o), ['prop', 'coffee', 'ceramic', 'new'], 'set({fill, slosh, tilt}), pose(p, yaw)', 'NEW thrown ceramic mug with real wall, handle, crema surface, slosh'),
  'objects/worker': r((ctx, p, o) => WORKER.makeWorker(ctx, p, o.spec || o, o.zoneX, o.rimLight), ['character', 'mascot', 'pantomime', 'original'], 'update(t) from spec {keys, path, blinks}', 'periwinkle ceramic worker: rig, hops, follow-through, blinks'),
};
export function create(ctx, parent, id, params = {}) { const e = REGISTRY[id]; if (!e) throw new Error('objects: unknown id ' + id + ' (have ' + Object.keys(REGISTRY).join(', ') + ')'); return e.build(ctx, parent, params); }
export const ids = (tag) => Object.keys(REGISTRY).filter((k) => !tag || REGISTRY[k].tags.includes(tag));
