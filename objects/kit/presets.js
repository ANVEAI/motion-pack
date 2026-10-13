/* motion-pack/objects/kit: extracted unchanged from ANVE's v9 launch-film studio kit (kit/presets.js) on 2026-10-13; this copy is the one to edit. */
/* ANVE v9 studio kit: DEFAULTS every scene starts from (the polished s1 values). Copy into the scene CONFIG and change only
   what the story needs; scripts/measure_layout.js checks a scene against FLOORS. */

/* camera presets for a 2.9 x 0.64 x 1.9 slab (scale them with the slab): vertical FOV 18 (long lens, miniature look),
   slow orbit -12 -> -6 degrees, 4.5% push over the scene, lens shift puts the look-at on a chosen pixel */
export const CAMERA = {
  wide: { fov: 18, elev: 25, az: [-12, -6], dist: [12.9, 12.3], target: [0.22, 0.42, -0.25], screen: [1320, 560] },   // stage x 862..1728
  tall: { fov: 18, elev: 24, az: [-12, -6], dist: [20.6, 19.8], target: [0.18, 0.40, -0.25], screen: [540, 1192] },   // stage y 704..1672 (headline above, label below)
  punch: 0.010,
};

/* the set: fixture-free (no stands, lamps or props that are not part of the story) */
export const SET = { floorY: -1.85, slab: [2.9, 0.64, 1.9], slabR: 0.06, underShadow: 0.34, fixtures: false };

/* lights, all off-frame; each click must read through the light itself (measured on s1: key +78 levels on the slab, violet rim
   +16 blue on the slab's back half, top pool +14 on the slab and paper) */
export const LIGHTS = {
  key: { kelvin: 4300, dir: [-0.62, 0.70, 0.55], target: [0.0, 0.3, 0.0], intensity: 2.5, shadowRadius: 10, softness: 0.55 },
  rim: { color: '#4a18ed', pos: [0.4, 0.95, -4.6], aim: [0.25, 0.62, 0.3], coneDeg: 24, penumbra: 1.0, cd: 11, shadowRadius: 16 },
  top: { kelvin: 4300, pos: [0.1, 7.0, 0.6], aim: [0.1, -0.4, -0.2], coneDeg: 50, penumbra: 0.6, cd: 24 },
  glint: { kelvin: 6500, size: [0.10, 1.4], nits: 60, y: 1.0, z: 2.0, from: -1.0, to: 1.8 },
};

/* calm chrome: soft panels only, no live reflections of slab edges */
export const CHROME = { rough: 0.08, f0: 0.92, res: 96, live: false };
export const ENV = { floor: 0.25, ceil: 0.10, top: 0.60, side: 0.21, strip: 3.0, chrome: { floor: 0.7, ceil: 0.42, top: 1.8, side: 0.9 } };

/* polish floors (measured on the delivered frame; px at 1920x1080 or 1080x1920). A scene ships only when it meets them. */
export const FLOORS = {
  wide: { stage: [862, 108, 1728, 972], stageFillPct: [55, 62], focalCardFaceW: [140, 200], headerPx: 20, digitPx: 70, labelPx: 28, headlineColumnFreeX: 862 },
  tall: { stage: [60, 704, 1020, 1680], stageFillPct: [50, 62], digitPx: 90, labelPx: 30, headlineZoneFreeY: 700, labelLineFreeY: 1680 },
};
