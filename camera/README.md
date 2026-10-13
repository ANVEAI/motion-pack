# camera: deterministic moves for three.js and the DOM

Presets are modifiers: `preset(base, params) => (t) => state`; nest them. Pure functions of t: any order, any thread, same numbers.

**3D (`cam3d.js`)** speaks the ANVE studio-kit contract `{fov, elev, az, dist, target, screen, punch, near, far}` plus `roll` (deg, positive = clockwise) and `shake` (lens-shift px). `applyToThree(THREE, camera, state, W, H)` is the kit rig (orbit, look-at, lens shift) plus roll and shake.

| Preset | Default | Tags |
|---|---|---|
| `hold` | micro orbit +-0.4 deg / 6 s | calm |
| `pushIn` / `pushSlow` / `pullOut` | x0.88 in 1.2 s (E.hero) / x0.955 over 6 s / x1.25 in 1.6 s | reveal, under type |
| `orbit` | +40 deg az in 5 s, 0.5% parallax | hero |
| `crane` / `truck` | elev 12 to 38 / target.x +1.6 | |
| `dollyZoom` | keeps subject width: fov 20 to 55 takes dist 12 to 4.06; pulls near plane in | once per film |
| `whipPan` | 7 f quint sweep, +-70 deg, roll 2 deg, cut at `whipMid`; blur by 8-16 subframes | transition |
| `handheld` | closed-form seeded sines 0.37 / 0.83 / 1.31 Hz (+-5 px) + 7.1 / 9.3 Hz (0.8 px), roll +-0.25 deg; levels subtle 0.4, doc 1, action 2.5 | human |
| `beatPunch`, `impactShake`, `dutch`, `breathe`, `rackFocus` | env on hits: 1 f up, 8 f down | beat |
| `lock`, `sequence`, `kitDrift`, `lintCameraMoves` | freeze during key actions, cut between cameras, kit's default drift, flag motion under key actions | |

**2D (`cam2d.js`)**: state `{x, y (frame heights), scale, rot, blur, origin}` for a wrapper element. `push2d`, `pull2d`, `pan2d`, `whip2d` (180 deg shutter streak), `handheld2d`, `punchCadence` (1.00 / 1.08 / 1.00 / 1.15, 6 f ease-out expo at sentence boundaries, face-box origin), `punchIn2d`, `beatPunch2d`, `kenBurns`, `dutch2d`, `breathe2d`, `shake2d`, `lock2d`, `sequence2d`, `coverScale` (exact minimum scale that hides edges), `lintPunchCadence`, `toCSS`, `toGSAP`, `blurFilterSVG`. `bake.js`: `bakeGSAP` (one `tl.set` per frame) or `driveSeek` (`hf-seek`).

```js
const cam = handheld(pushIn(hold(KIT.wide), { at: 1, dur: 1.2 }), { level: 'doc', seed: 3 });   // 3D, in the kit's camera(ctx, t)
const cam2 = handheld2d(punchCadence(ID2, { boundaries: sentenceStarts }), { level: 'subtle' }); bakeGSAP(tl, '#world', cam2, { dur, cover: true });
```

**2D expansion (2026-10-13):** `crashZoom` (4 f expo slam, decaying overshoot, shake, motion streak; `returnAt`), `doubleTake` (in, back, harder in), `dollySnap` (creep then snap on the beat), `rackFocus2D` (adds `state.dof = {fg, bg}` blur px for layered shots), `dutchRoll` (popped roll with exact cover scale; presets `DUTCH_PRESETS` unease / comedy / thriller / drunk), `parallaxStack(cam, depths)` (one camera -> per-layer CSS for a 2.5D stack). Demo: `demo/out/cam2d-expansion.jpg`. Speed-ramp curves: see `../cuts/retime.json` (`rampIn`, `rampOut`, `heroRamp`, `freezeStamp` are also `transitions/lib/tx-core.js RAMP_PRESETS`).

## Measured (22 pure + 7 three.js + 3 DOM checks)
Dolly-zoom subject width spread 0.0000% (pure) and 0.05% in real three; look-at lands on the `screen` pixel (0.000 px error); roll is exact to < 0.3 deg; shake px exact; whip speed peaks mid-whip; handheld power 99% in the designed lines, none above 10 Hz; level scaling exactly 2.5x; `coverScale` exact on 200 random cases; GSAP bake under random-access seeks reproduces the pure function exactly; rendered frames (incl. 8-subframe blur) are hash-identical.

## Honest limits
The kit is not vendored: tests run a miniature studio in a locally installed three.js (read-only mount). Whip blur needs subframe sampling in the host render loop (the kit already has 8/16). 2D whip needs the next shot underneath (or a transition from the cuts module); alone it exposes black. Demos: `demo/out/cam3d.jpg`, `cam3d-whip.jpg`, `cam2d.jpg`.
