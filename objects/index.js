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
import * as DOME from './lib/dome.js';
import * as LOGO from './lib/logo.js';
import * as FLAT from './lib/flat.js';
import * as MASCOT from './characters/mascot2d.js';
import * as WORKER from './characters/worker.js';
import * as POSES from './characters/poses.js';
import * as HW from './lib/hardware.js';           // xp-hardware 2026-10-16: enclosure, vent grille, ports, cable, the assembled demo node
import * as HWB from './lib/hwboard.js';          // PCB, chip + die, heatsink, fan, GPU-like card
import * as HWX from './lib/xray.js';            // x-ray / wireframe-to-solid
import * as HWS from './lib/studio-hw.js';       // dark studio + rim / top / sweep rig
import * as HWM from './lib/hwmedia.js';         // your own GLB / OBJ, or a photo as a 2.5D plate
import * as HWD from './lib/hwdata.js';          // the device layout as pure data (anchors for callouts)
import * as HWE from './lib/explode.js';         // the exploded-view choreographer (pure)
import * as NIGHT from './lib/night.js';          // v0.6 hero style scenes: the night reading room, lamp, book, rain glass, cut-paper layers, page peel
import * as CRAFT from './lib/scene-craft.js';    // v0.6: the style craft as pure functions of time (stepTime, handheld, rainDrops, paperJitter, peel, ...)

export const O = { ...SET, ...BOX, ...CHROME, ...PAPER, ...READ, ...METER, ...PANELS, ...DEV, ...MATS, ...DOME, ...LOGO, ...FLAT, ...MASCOT, ...WORKER, ...POSES, ...HW, ...HWB, ...HWX, ...HWS, ...HWM, ...HWD, ...HWE, ...NIGHT, CRAFT };

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
  'objects/glass-dome': r((ctx, p, o) => DOME.makeGlassDome(ctx, p, o), ['set', 'platform', 'dome', 'glass', 'floating', 'new'], 'update(t), set({y, yaw, lift})', 'NEW floating round platform under a clear iridescent glass dome; props go in .inside'),
  'objects/icon-orbit': r((ctx, p, o) => DOME.makeIconOrbit(ctx, p, o), ['icons', 'orbit', 'apps', 'integrations', 'tiles', 'new'], 'update(t)', 'NEW generic rounded app-icon tiles (own line icons, no brand logos) orbiting on a tilted ring'),
  'objects/clay': r((_ctx, _p, o) => ({ material: DOME.makeClay(o.color, o), group: null }), ['material', 'clay', 'matte', 'subsurface', 'character', 'new'], 'material uniforms userData.clay', 'NEW clay material preset: soft matte, warm core + light-bleed rim; objects/worker takes spec.clay'),
  'objects/mascot2d': r((ctx, p, o) => FLAT.makeMascotPlane(ctx, p, o), ['character', 'mascot', '2d', 'flat', 'narrator', 'squash-stretch', 'original', 'new'], 'mascotSVG(t, spec) | drawMascot2d(g, t, spec) | plane update(t)', 'NEW flat 2D mascot rig: bean body + sprout, eyes, mouth, blinks, hops with squash and stretch; poses idle point read cheer dive wave think; SVG, canvas or a three.js plane'),
  'objects/logo-extrude': r((ctx, p, o) => LOGO.makeLogoExtrude(ctx, p, o), ['logo', 'mark', 'extrude', 'bevel', 'chrome', 'glass', 'iridescent', 'satin', 'brand', 'new'], 'update(t), set({yaw, tilt, slice, scale})', 'NEW three.js extrude of an SVG mark (own mark only; placeholder orbit mark) with bevel, presets chrome glass iridescent satin, optional sliced-offset beat, spin'),
  'objects/worker': r((ctx, p, o) => WORKER.makeWorker(ctx, p, o.spec || o, o.zoneX, o.rimLight), ['character', 'mascot', 'pantomime', 'original'], 'update(t) from spec {keys, path, blinks}', 'periwinkle ceramic worker: rig, hops, follow-through, blinks'),
  /* xp-hardware (2026-10-16): generic hardware props for device launch films; no brand marks, generic port names */
  'objects/enclosure': r((ctx, p, o) => HW.makeEnclosure(ctx, p, o), ['hardware', 'device', 'enclosure', 'chamfer', 'led', 'anodised', 'glass', 'new'], 'setBand(level, hex, sweep), pose(p, yaw, s); parts {shell, top, base}', 'NEW configurable device enclosure: dimensions, chamfer, footprint radius, anodised / matte black / smoked glass, glass or grille top, LED light band, side vents, generic back ports, feet'),
  'objects/vent-grille': r((ctx, p, o) => HW.makeVentGrille(ctx, p, o), ['hardware', 'vent', 'grille', 'slots', 'hex', 'new'], 'static', 'NEW instanced vent field: slots or hex holes, optional plate'),
  'objects/ports': r((ctx, p, o) => HW.makePorts(ctx, p, o), ['hardware', 'ports', 'io', 'connector', 'new'], 'static; centres for callouts', 'NEW generic port cut-outs (power, network, display out, data, wide data, audio): recess + metal surround'),
  'objects/cable': r((ctx, p, o) => HW.makeCable(ctx, p, o), ['hardware', 'cable', 'plug', 'connector', 'new'], 'set({insert})', 'NEW cable on a sagging curve with a plug that pushes home'),
  'objects/hw-node': r((ctx, p, o) => HW.makeNode(ctx, p, o), ['hardware', 'device', 'product', 'explode', 'hero', 'new'], 'set({band, bandSweep, explode, die, dieGlow, fanSpin, cardGlow, accent})', 'NEW the assembled generic demo device: enclosure + board + chip + heatsink + fan + card, every part its own explode group'),
  'objects/pcb': r((ctx, p, o) => HWB.makePCB(ctx, p, o), ['hardware', 'pcb', 'board', 'chips', 'new'], 'static; .chip.set({open, glow})', 'NEW circuit board: seeded traces, a chip with a die, memory, chokes, MLCC field, gold fingers'),
  'objects/chip-die': r((ctx, p, o) => HWB.makeChip(ctx, p, o), ['hardware', 'chip', 'die', 'silicon', 'reveal', 'new'], 'set({open, glow, accent})', 'NEW chip package whose lid lifts and whose die blocks light one by one (generic, decorative die pattern)'),
  'objects/heatsink': r((ctx, p, o) => HWB.makeHeatsink(ctx, p, o), ['hardware', 'heatsink', 'fins', 'copper', 'new'], 'static', 'NEW instanced fin stack on a copper base with heat pipes'),
  'objects/fan': r((ctx, p, o) => HWB.makeFan(ctx, p, o), ['hardware', 'fan', 'spin', 'new'], 'set({spin})', 'NEW framed axial fan, swept blades'),
  'objects/gpu-card': r((ctx, p, o) => HWB.makeGPUCard(ctx, p, o), ['hardware', 'gpu', 'card', 'accelerator', 'fans', 'new'], 'set({spin, glow, accent})', 'NEW GPU-like accelerator card: board, faceted shroud, fans, backplate, accent strip, bracket (generic, no vendor look)'),
  'objects/xray': r((ctx, p, o) => HWX.makeXray(ctx, o.root || p, o), ['hardware', 'xray', 'wireframe', 'transition', 'scan', 'new'], 'set(k) 0 wire .. 1 solid', 'NEW x-ray / wireframe-to-solid sweep for any object (edges + clipping plane + glowing scan band)'),
  'objects/hw-studio': r((ctx, _p, o) => ({ studio: HWS.makeDarkStudio(ctx, o), rig: HWS.makeHwRig(ctx, o) }), ['hardware', 'studio', 'light', 'rim', 'sweep', 'dark', 'new'], 'rig.update(n, slot, {rim, top, key, edge, sweep})', 'NEW dark product studio + rim / top / sweep rig (edge-light silhouette, travelling strip)'),
  'objects/model': r((ctx, p, o) => HWM.loadModel(ctx, p, o.url, o), ['hardware', 'model', 'glb', 'gltf', 'obj', 'your-product', 'new'], 'async; applyExplode(offs), pose(p, yaw, s)', 'NEW load YOUR model (GLB / glTF / OBJ): centred, stood on the floor, sized; top-level children become explode parts'),
  /* v0.6 hero style scenes (templates/style-scene): one night reading room in four worlds; the craft is pure (objects/lib/scene-craft.js, node-tested) */
  'objects/night-set': r((ctx, p, o) => NIGHT.makeNightSet(ctx, p, o), ['set', 'room', 'night', 'window', 'style', 'clay', 'paper', 'neon', 'documentary', 'new'], 'static; lights {hemi, moon, extra}', 'NEW night reading room in four worlds (clay, doc, neon, paper): floor, wall with a window onto a night sky, desk, rug, moonlight key'),
  'objects/lamp': r((ctx, p, o) => NIGHT.makeLamp(ctx, p, o), ['prop', 'lamp', 'light', 'bloom', 'squash-stretch', 'new'], 'set({on, squash}), pose(p, yaw)', 'NEW desk lamp: arm, cone shade, a bulb that blooms, a warm spot pool with shadows; squash keeps volume (the clay tap)'),
  'objects/book': r((ctx, p, o) => NIGHT.makeBook(ctx, p, o), ['prop', 'book', 'paper', 'open', 'pages', 'new'], 'set({open, flip}), pose(p, yaw)', 'NEW book: a board that swings open on the spine, a page block, loose pages that run one after another'),
  'objects/rain-glass': r((ctx, p, o) => NIGHT.makeRainGlass(ctx, p, o), ['glass', 'rain', 'weather', 'neon', 'light-streaks', 'new'], 'update(t)', 'NEW rain on a window pane: drops that stick and run with trails, passing light streaks behind (pure f(t))'),
  'objects/paper-layers': r((ctx, p, o) => NIGHT.makePaperLayers(ctx, p, o), ['paper', 'cut-out', 'diorama', 'parallax', 'boil', 'shadow', 'new'], 'update(t, {px, deg, boilFps})', 'NEW cut-paper layers (hills, skyline, trees, clouds, curtain, star) at their own depths, real drop shadows, boil on twelves'),
  'objects/page-peel': r((ctx, _p, o) => NIGHT.makePagePeel(ctx, o), ['transition', 'paper', 'page-peel', 'curl', 'camera', 'new'], 'fit(dist), set(k)', 'NEW page-peel transition sheet on the camera: unrolls over the frame (k 0.5 covers it) and peels off, an inextensible curl'),
  'objects/photo-25d': r((ctx, p, o) => HWM.makePhotoParallax(ctx, p, o), ['hardware', 'photo', 'parallax', '2.5d', 'your-product', 'new'], 'async; pose(p, yaw)', 'NEW one product photo as a displaced 2.5D plate (your depth map, or alpha + a soft bulge); keep orbits small'),
};
export function create(ctx, parent, id, params = {}) { const e = REGISTRY[id]; if (!e) throw new Error('objects: unknown id ' + id + ' (have ' + Object.keys(REGISTRY).join(', ') + ')'); return e.build(ctx, parent, params); }
export const ids = (tag) => Object.keys(REGISTRY).filter((k) => !tag || REGISTRY[k].tags.includes(tag));
