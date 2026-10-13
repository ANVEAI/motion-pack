/* motion-pack icon pipeline: SVGO 4.1.0 config for icons that will be animated (draw-on, per-element stagger), measured in the
   motion-stack bake-off (vector lane, 13 Oct 2026).
   Run:   npx svgo@4.1.0 --config scripts/svgo.config.mjs -r -f external/<set>/svg -o external/<set>/optimized   (never `svgo` with no config: see the numbers below)
   When:  once per icon set after scripts/fetch-external.sh (Lucide, Phosphor, Fluent flat, anything an agent pastes inline). NOT at render time, NOT per video.
          Write the output next to the set (external/ is gitignored); keep the untouched originals (they are the source of truth for licence + hashes).

   Measured on the three pinned sets (111 + 108 + 279 icons; raster PSNR at 256 px on white and black, draw-on geometry via the pack's drawon.js selector + getTotalLength):
     SVGO default (preset-default)    lucide -14.4 % raw, but 380 -> 195 drawable elements (70 of 111 icons lose stagger units: bell 2 -> 1, alarm-clock 6 -> 2); fluent min 32.9 dB (20 emoji < 40 dB)
     this config                      lucide -8.9 %, phosphor -2.5 %, fluent -34.8 % raw (all sets -30.7 %), 0 icons change drawable count, min PSNR 42.8 dB (fluent) / 52.0 dB (lucide) / 54.9 dB (phosphor)
   Why each override (ablation: switching each of the 33 preset plugins off one at a time):
     mergePaths: false          fuses sibling <path>s that share attributes into ONE path: a draw-on that staggers per element then draws them in one go. The ONLY plugin that changes the drawable count.
     convertShapeToPath: false  rect/line/polyline/polygon -> path. Harmless to geometry (start/end points identical) but changes the tag the engine and agents see; saves only 209 B over 498 icons.
     convertPathData.makeArcs: false   default arc fitting (threshold 2.5, tolerance 0.5 % of the radius) moves outlines: 0.089 units on a 32-unit emoji (0.28 % of the viewBox, 0.7 px at 256 px; 0.001 units with it off, measured on
                                fluent/disguised-face), the cause of every PSNR < 40 dB. The rest of convertPathData
                                (relative coords, shorthands, 3-digit rounding) is what makes the savings and is kept; element length, start point and end point stay within 0.4 % of the viewBox for all
                                2217 elements, bar one end-point artifact (fluent/face-with-spiral-eyes ends in a dangling `m` after its last drawn segment; drawn pixels are unchanged).
   Not used: multipass (+0.0 % saved, and the 2nd pass deleted a real element from fluent/folded-hands), reusePaths / removeOffCanvasPaths (change the element list), removeViewBox / removeDimensions (needed for sizing).
   Kept on purpose: viewBox, width/height, xmlns (an <img src=...> or a data: URL needs it), currentColor, stroke attributes on the root <svg> (Lucide relies on them being inherited).
   prefixIds is ADDED as insurance: cleanupIds shrinks every id to "a" (measured: all 4 Fluent flat files that carry a <clipPath id> end up with id="a"), so inlining two such icons in one page makes them share one clipPath.
                for these 4 the clip is the same 32x32 rect, so pixels do not change today (4 inlined: 46.4 dB default, 61.3 dB this config, vs the originals); it would break for gradients or differently shaped clips. Each id gets its file name as prefix.
   Optional: floatPrecision 4 (set FLOAT_PRECISION below) costs ~7 points of Fluent savings and lifts Lucide's worst PSNR from 52 to 70 dB. Not needed for 4K output: 3 digits = 0.0005 unit = 0.01 px at 25 px/unit. */
const FLOAT_PRECISION = 3;

export default {
  multipass: false,
  plugins: [
    {
      name: 'preset-default',
      params: {
        floatPrecision: FLOAT_PRECISION,
        overrides: {
          mergePaths: false,
          convertShapeToPath: false,
          convertPathData: { makeArcs: false, floatPrecision: FLOAT_PRECISION },
        },
      },
    },
    { name: 'prefixIds', params: { prefixIds: true, prefixClassNames: true, delim: '__' } },
  ],
};
