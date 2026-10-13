/* motion-pack / layers / fx2.js: expansion overlay layers (2026-10-13), procedural WebGL2, no plate needed, no downloads.
   Lens: flareStreak (anamorphic), flareGhosts, starburst, lensDirt, rainGlass, fog, godRays.
   Comic / retro: halftone, speedLines, vhs, burnEdge.   Texture plates: paperFold, crumple, cardboard, canvas, cloth, concrete, brushedMetal, tornEdge.
   Utility: noiseMap (grey fbm, a luma matte source for lumaWipe-style transitions).
   Same contract as overlay.js: one <canvas> per layer, CSS mix-blend-mode, a pure function of (t, frame, seed) -> seek-safe.
   Randomness is the pack's PCG integer hash (glsl-common.js HASH), never sin()-hash or a clock. Mounted through overlay.js mountStack. */
import { getGL, Prog, draw } from './lib/gl.js';
import { VERT, HEAD, HASH } from './lib/glsl-common.js';
import { hexRGB, dec } from './lib/fx-params.js';

const c3 = (h) => hexRGB(h).map(dec);
/* kind: id, blend, order (stacking like overlay.js KINDS), tags, defaults, pack(p) -> {A,B,C,col1,col2,I} uniforms */
export const FX2_KINDS = {
  flareStreak: { id: 0, blend: 'screen', order: 13, tags: ['flare', 'anamorphic', 'lens', 'cinematic', 'sci-fi'], d: { x: 0.72, y: 0.38, length: 0.9, thick: 0.006, color: '#6FA8FF', intensity: 0.9, flicker: 0.15 },
    pack: (p) => ({ A: [p.x, p.y, p.length, p.thick], B: [p.flicker, 0, 0, 0], col1: c3(p.color), I: p.intensity }) },
  flareGhosts: { id: 1, blend: 'screen', order: 14, tags: ['flare', 'ghosts', 'lens', 'sun'], d: { x: 0.78, y: 0.25, count: 6, size: 0.06, color: '#FFB46A', color2: '#7AD0FF', intensity: 0.5 },
    pack: (p) => ({ A: [p.x, p.y, p.count, p.size], col1: c3(p.color), col2: c3(p.color2), I: p.intensity }) },
  starburst: { id: 2, blend: 'screen', order: 15, tags: ['flare', 'star', 'sparkle', 'sun', 'glint'], d: { x: 0.5, y: 0.4, rays: 8, spin: 0.05, falloff: 6, color: '#FFF2D8', intensity: 0.8 },
    pack: (p) => ({ A: [p.x, p.y, p.rays, p.spin], B: [p.falloff, 0, 0, 0], col1: c3(p.color), I: p.intensity }) },
  lensDirt: { id: 3, blend: 'screen', order: 16, tags: ['lens', 'dirt', 'smudge', 'flare', 'realism'], d: { x: 0.75, y: 0.3, radius: 0.6, color: '#FFE6C8', intensity: 0.45, scale: 1 },
    pack: (p) => ({ A: [p.x, p.y, p.radius, p.scale], col1: c3(p.color), I: p.intensity }) },
  rainGlass: { id: 4, blend: 'normal', order: 55, tags: ['rain', 'glass', 'window', 'mood', 'weather'], d: { density: 1, speed: 0.25, size: 1, intensity: 0.8 },
    pack: (p) => ({ A: [p.density, p.speed, p.size, 0], I: p.intensity }) },
  fog: { id: 5, blend: 'screen', order: 17, tags: ['fog', 'haze', 'mist', 'atmosphere', 'mood'], d: { density: 0.55, scale: 2.2, drift: 0.04, ground: 0.6, color: '#C9D3DE', intensity: 0.6 },
    pack: (p) => ({ A: [p.density, p.scale, p.drift, p.ground], col1: c3(p.color), I: p.intensity }) },
  godRays: { id: 6, blend: 'screen', order: 18, tags: ['god-rays', 'light', 'volumetric', 'sun', 'church'], d: { x: 0.25, y: -0.05, rays: 22, falloff: 1.6, sway: 0.06, color: '#FFE2A8', intensity: 0.55 },
    pack: (p) => ({ A: [p.x, p.y, p.rays, p.falloff], B: [p.sway, 0, 0, 0], col1: c3(p.color), I: p.intensity }) },
  halftone: { id: 7, blend: 'multiply', order: 31, tags: ['halftone', 'comic', 'print', 'pop-art', 'mime'], d: { cell: 12, angle: 45, x: 0.5, y: 0.5, spread: 1.3, color: '#1A1A2E', intensity: 0.45 },
    pack: (p) => ({ A: [p.cell, p.angle, p.x, p.y], B: [p.spread, 0, 0, 0], col1: c3(p.color), I: p.intensity }) },
  speedLines: { id: 8, blend: 'normal', order: 58, tags: ['speed-lines', 'manga', 'anime', 'impact', 'comic'], d: { x: 0.5, y: 0.5, lines: 90, fps: 12, clear: 0.28, color: '#FFFFFF', intensity: 0.85 },
    pack: (p) => ({ A: [p.x, p.y, p.lines, p.fps], B: [p.clear, 0, 0, 0], col1: c3(p.color), I: p.intensity }) },
  vhs: { id: 9, blend: 'normal', order: 52, tags: ['vhs', 'tape', 'tracking', 'retro', '90s'], d: { tracking: 0.6, speed: 0.15, headSwitch: 1, chroma: 0.5, intensity: 0.7 },
    pack: (p) => ({ A: [p.tracking, p.speed, p.headSwitch, p.chroma], I: p.intensity }) },
  burnEdge: { id: 10, blend: 'screen', order: 19, tags: ['film-burn', 'edge', 'analog', 'film', 'warm'], d: { edge: 'right', reach: 0.35, flicker: 1, color: '#FF5A12', color2: '#FFE7B0', intensity: 0.85 },
    pack: (p) => ({ A: [['left', 'right', 'top', 'bottom', 'all'].indexOf(p.edge), p.reach, p.flicker, 0], col1: c3(p.color), col2: c3(p.color2), I: p.intensity }) },
  paperFold: { id: 11, blend: 'multiply', order: 30, tags: ['paper', 'fold', 'crease', 'texture', 'print'], d: { folds: 3, intensity: 0.6, tint: '#F4EEDF' }, pack: (p) => ({ A: [p.folds, 0, 0, 0], col1: c3(p.tint), I: p.intensity }) },
  crumple: { id: 12, blend: 'multiply', order: 30, tags: ['paper', 'crumple', 'texture', 'craft'], d: { cells: 9, intensity: 0.55, tint: '#F3EEE4' }, pack: (p) => ({ A: [p.cells, 0, 0, 0], col1: c3(p.tint), I: p.intensity }) },
  cardboard: { id: 13, blend: 'multiply', order: 30, tags: ['cardboard', 'kraft', 'texture', 'craft', 'unboxing'], d: { flutes: 60, intensity: 0.7, tint: '#C9A27A' }, pack: (p) => ({ A: [p.flutes, 0, 0, 0], col1: c3(p.tint), I: p.intensity }) },
  canvas: { id: 14, blend: 'multiply', order: 30, tags: ['canvas', 'weave', 'texture', 'art', 'painting'], d: { weave: 220, intensity: 0.45, tint: '#EFE8DA' }, pack: (p) => ({ A: [p.weave, 0, 0, 0], col1: c3(p.tint), I: p.intensity }) },
  cloth: { id: 15, blend: 'multiply', order: 30, tags: ['cloth', 'fabric', 'twill', 'texture', 'fashion'], d: { weave: 380, intensity: 0.4, tint: '#E6E2EE' }, pack: (p) => ({ A: [p.weave, 0, 0, 0], col1: c3(p.tint), I: p.intensity }) },
  concrete: { id: 16, blend: 'multiply', order: 30, tags: ['concrete', 'urban', 'texture', 'wall', 'grunge'], d: { scale: 3, pits: 0.6, intensity: 0.5, tint: '#D9D8D4' }, pack: (p) => ({ A: [p.scale, p.pits, 0, 0], col1: c3(p.tint), I: p.intensity }) },
  brushedMetal: { id: 17, blend: 'overlay', order: 30, tags: ['metal', 'brushed', 'texture', 'premium', 'product'], d: { angle: 0, streaks: 900, intensity: 0.5 }, pack: (p) => ({ A: [p.angle, p.streaks, 0, 0], I: p.intensity }) },
  tornEdge: { id: 18, blend: 'normal', order: 88, tags: ['torn', 'paper', 'edge', 'collage', 'craft'], d: { side: 'bottom', depth: 0.12, rough: 1, tint: '#F6F1E6', intensity: 1 },
    pack: (p) => ({ A: [['top', 'bottom', 'left', 'right'].indexOf(p.side), p.depth, p.rough, 0], col1: c3(p.tint), I: p.intensity }) },
  noiseMap: { id: 19, blend: 'normal', order: 1, tags: ['noise', 'matte', 'displacement', 'luma', 'utility'], d: { scale: 3, octaves: 5, contrast: 1.2, drift: 0, intensity: 1 },
    pack: (p) => ({ A: [p.scale, p.octaves, p.contrast, p.drift], I: p.intensity }) },
};

const FRAG = `${HEAD}${HASH}
in vec2 vUv; out vec4 o;
uniform int uKind; uniform vec2 uRes; uniform float uAspect, uTime, uI; uniform uint uFrame, uSeed; uniform vec4 uA, uB; uniform vec3 uCol1, uCol2;
#define PI 3.14159265
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); uint s = uSeed;
  float a = rnd3(uint(int(i.x)), uint(int(i.y)), s), b = rnd3(uint(int(i.x) + 1), uint(int(i.y)), s), c = rnd3(uint(int(i.x)), uint(int(i.y) + 1), s), d = rnd3(uint(int(i.x) + 1), uint(int(i.y) + 1), s);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
float fbm(vec2 p, int oct){ float s = 0.0, a = 0.5, n = 0.0; for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a * vn(p); n += a; p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.03 + 17.3; a *= 0.5; } return s / n; }
vec2 asp(vec2 uv){ return vec2(uv.x * uAspect, uv.y); }
vec2 dsg(vec2 xy){ return vec2(xy.x, 1.0 - xy.y); }   /* designer top-left -> GL */
float fl(){ return rnd2(uFrame, uSeed + 7u); }
void main(){
  vec2 uv = vUv, P = asp(uv); vec4 r = vec4(0.0); float t = uTime;
  if (uKind == 0){ vec2 s = asp(dsg(uA.xy)), d = P - s; float k = (1.0 - uB.x * fl());
    float streak = exp(-abs(d.y) / uA.w) * exp(-abs(d.x) / (uA.z * 0.5)), core = exp(-length(d) * 22.0), halo = exp(-length(d) * 5.0) * 0.25;
    vec3 c = uCol1 * (streak + halo) + vec3(1.0) * core; r = vec4(c * uI * k, 1.0); }
  else if (uKind == 1){ vec2 s = asp(dsg(uA.xy)), cc = asp(vec2(0.5)), axis = cc - s; vec3 c = vec3(0.0);
    for (int i = 0; i < 10; i++){ if (float(i) >= uA.z) break; float k = 0.35 + 1.9 * rnd2(uint(i), uSeed), rad = uA.w * (0.4 + 1.4 * rnd2(uint(i) + 40u, uSeed));
      vec2 g = s + axis * k * 2.0; float dd = length(P - g); float ring = smoothstep(rad, rad * 0.82, dd) * (0.35 + 0.65 * smoothstep(0.0, rad, dd));
      c += mix(uCol1, uCol2, rnd2(uint(i) + 80u, uSeed)) * ring * (0.25 + 0.5 * rnd2(uint(i) + 9u, uSeed)); }
    r = vec4(c * uI, 1.0); }
  else if (uKind == 2){ vec2 s = asp(dsg(uA.xy)), d = P - s; float rr = length(d), an = atan(d.y, d.x) + uA.w * t;
    float rays = pow(abs(cos(an * uA.z * 0.5)), 24.0) * exp(-rr * uB.x) + pow(abs(cos(an * uA.z * 0.5 + 0.7)), 60.0) * exp(-rr * uB.x * 0.6) * 0.5;
    float core = exp(-rr * 30.0) + exp(-rr * 9.0) * 0.3; r = vec4(uCol1 * (rays + core) * uI, 1.0); }
  else if (uKind == 3){ vec2 s = asp(dsg(uA.xy)); float prox = exp(-length(P - s) / max(uA.z, 0.05));
    float smudge = smoothstep(0.55, 0.85, fbm(P * 3.0 * uA.w, 5)); float specks = 0.0;
    vec2 g = P * 34.0 * uA.w, cell = floor(g); float h = rnd3(uint(int(cell.x)), uint(int(cell.y)), uSeed + 3u);
    if (h > 0.86){ vec2 c0 = cell + vec2(rnd3(uint(int(cell.x)), uint(int(cell.y)), uSeed + 4u), rnd3(uint(int(cell.x)), uint(int(cell.y)), uSeed + 5u)); specks = smoothstep(0.32, 0.0, length(g - c0)) * (h - 0.86) * 7.0; }
    r = vec4(uCol1 * (smudge * 0.6 + specks) * (0.25 + prox) * uI, 1.0); }
  else if (uKind == 4){ float a = 0.0; vec3 c = vec3(0.0); vec2 g = P * 9.0 / uA.z;
    for (int L = 0; L < 2; L++){ vec2 q = g * (L == 0 ? 1.0 : 2.3), cell = floor(q); float h = rnd3(uint(int(cell.x)), uint(int(cell.y)), uSeed + uint(L));
      if (h < 0.55 * uA.x){ vec2 c0 = cell + 0.2 + 0.6 * vec2(rnd3(uint(int(cell.x)), uint(int(cell.y)), uSeed + 11u), rnd3(uint(int(cell.x)), uint(int(cell.y)), uSeed + 12u));
        float rad = 0.12 + 0.2 * h, dd = length((q - c0) * vec2(1.0, 0.85));
        float body = smoothstep(rad, rad * 0.8, dd), rim = body * smoothstep(rad * 0.5, rad, dd), hl = smoothstep(rad * 0.35, 0.0, length(q - c0 - vec2(-0.3, 0.35) * rad));
        a = max(a, rim * 0.55 + body * 0.12); c += vec3(1.0) * hl * 0.9; } }
    float col = floor(P.x * 26.0 / uA.z), sp = 0.4 + rnd2(uint(int(col)), uSeed + 21u); float yy = fract(uv.y + t * uA.y * sp + rnd2(uint(int(col)), uSeed + 22u));
    float lane = smoothstep(0.05, 0.0, abs(fract(P.x * 26.0 / uA.z) - 0.5) - 0.06) * step(rnd2(uint(int(col)), uSeed + 23u), 0.35 * uA.x);
    float trail = lane * smoothstep(0.0, 0.25, yy) * smoothstep(0.32, 0.25, yy) * 0.5; a = max(a, trail); c += vec3(0.9) * trail * 0.5;
    r = vec4(c * uI, a * uI); r.rgb = min(r.rgb, vec3(r.a)); }
  else if (uKind == 5){ float n = fbm(P * uA.y + vec2(t * uA.z, t * uA.z * 0.3), 6); float h = mix(1.0, smoothstep(1.0, 0.0, uv.y), uA.w);
    float f = smoothstep(1.0 - uA.x, 1.0, n + 0.35) * h; r = vec4(uCol1 * f * uI, 1.0); }
  else if (uKind == 6){ vec2 s = asp(dsg(uA.xy)), d = P - s; float an = atan(d.x, -d.y), rr = length(d);
    float n = fbm(vec2(an * uA.z, t * uB.x * 10.0), 4), rays = smoothstep(0.45, 0.85, n) * exp(-rr * uA.w);
    r = vec4(uCol1 * rays * uI, 1.0); }
  else if (uKind == 7){ float ang = radians(uA.y), c0 = cos(ang), s0 = sin(ang); vec2 px = gl_FragCoord.xy, q = mat2(c0, -s0, s0, c0) * px / uA.x;
    vec2 cc = fract(q) - 0.5; float tone = clamp(1.0 - length(uv - dsg(uA.zw)) * uB.x, 0.0, 1.0); float rad = sqrt(tone) * 0.62;
    float dotm = smoothstep(rad + 0.06, rad - 0.06, length(cc)); r = vec4(mix(vec3(1.0), uCol1, dotm * uI), 1.0); }
  else if (uKind == 8){ vec2 s = asp(dsg(uA.xy)), d = P - s; float an = atan(d.y, d.x) / (2.0 * PI) + 0.5, rr = length(d);
    uint q = uint(floor(t * uA.w)); float bin = floor(an * uA.z), fr = fract(an * uA.z), on = step(0.45, rnd3(uint(int(bin)), q, uSeed));
    float w = rnd3(uint(int(bin)) + 300u, q, uSeed) * 0.45 + 0.05, start = uB.x * (0.8 + 0.5 * rnd3(uint(int(bin)) + 600u, q, uSeed));
    float line = on * smoothstep(w, w * 0.4, abs(fr - 0.5)) * smoothstep(start, start + 0.15, rr); r = vec4(uCol1 * line * uI, line * uI); }
  else if (uKind == 9){ float a = 0.0; vec3 c = vec3(0.0); float band = fract(t * uA.y + 0.3), dy = abs(uv.y - band);
    float tr = smoothstep(0.06, 0.0, dy) * uA.x; float nz = rnd3(uint(gl_FragCoord.x / 3.0), uint(gl_FragCoord.y / 2.0), uFrame + uSeed);
    a = max(a, tr * nz * 0.7); c += vec3(nz) * tr * 0.7;
    float hs = step(uv.y, 0.035) * uA.z; float hn = rnd3(uint(gl_FragCoord.y / 2.0), uFrame, uSeed + 2u); a = max(a, hs * (0.4 + 0.5 * hn)); c += vec3(0.85, 0.9, 1.0) * hs * hn * 0.6;
    float ln = step(0.985, rnd3(uint(gl_FragCoord.y / 3.0), uFrame / 2u, uSeed + 5u)) * uA.w; a = max(a, ln * 0.5); c += vec3(1.0, 0.2, 0.6) * ln * 0.5;
    r = vec4(c * uI, a * uI); r.rgb = min(r.rgb, vec3(r.a)); }
  else if (uKind == 10){ int e = int(uA.x + 0.5); float dist = e == 0 ? uv.x : e == 1 ? 1.0 - uv.x : e == 2 ? 1.0 - uv.y : e == 3 ? uv.y : min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float n = fbm(P * 2.5 + vec2(t * 0.6, t * 0.2), 5), flick = 1.0 - uA.z * 0.3 * fl(); float v = smoothstep(uA.y, 0.0, dist + (n - 0.5) * uA.y * 0.9);
    vec3 c = mix(uCol1, uCol2, smoothstep(0.5, 1.0, v)) * v * flick; r = vec4(c * uI * 1.4, 1.0); }
  else if (uKind >= 11 && uKind <= 16){ float s = 1.0;
    if (uKind == 11){ for (int i = 0; i < 6; i++){ if (float(i) >= uA.x) break; float a0 = rnd2(uint(i), uSeed) * PI; vec2 n = vec2(cos(a0), sin(a0)); float off = (rnd2(uint(i) + 9u, uSeed) - 0.5) * 0.8;
        float sd = dot(uv - 0.5, n) - off; s *= 1.0 - 0.18 * exp(-abs(sd) * 140.0) + 0.06 * sign(sd) * exp(-abs(sd) * 12.0); } s *= 0.97 + 0.05 * fbm(P * 40.0, 3); }
    else if (uKind == 12){ vec2 g = P * uA.x, cell = floor(g); float best = 9.0, second = 9.0; vec2 bp = vec2(0.0);
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 c0 = cell + vec2(x, y); vec2 pt = c0 + vec2(rnd3(uint(int(c0.x)), uint(int(c0.y)), uSeed), rnd3(uint(int(c0.x)), uint(int(c0.y)), uSeed + 1u));
        float dd = length(g - pt); if (dd < best){ second = best; best = dd; bp = pt; } else if (dd < second) second = dd; }
      float facet = rnd3(uint(int(bp.x * 7.0)), uint(int(bp.y * 7.0)), uSeed + 2u); s = 0.84 + 0.16 * facet - 0.22 * exp(-(second - best) * 30.0); }
    else if (uKind == 13){ float f = sin(uv.y * uA.x * PI * 2.0) * 0.5 + 0.5; s = 0.88 + 0.08 * f + 0.06 * (fbm(vec2(P.x * 300.0, P.y * 8.0), 3) - 0.5) + 0.05 * (fbm(P * 6.0, 4) - 0.5); }
    else if (uKind == 14 || uKind == 15){ vec2 g = gl_FragCoord.xy * uA.x / uRes.y; float w1 = sin(g.x * PI) * sin(g.y * PI * (uKind == 15 ? 1.0 : 0.5) + g.x * (uKind == 15 ? 0.5 : 0.0));
        s = 0.9 + 0.08 * w1 + 0.05 * (rnd3(uint(g.x), uint(g.y), uSeed) - 0.5) + 0.04 * (fbm(P * 5.0, 4) - 0.5); }
    else { float n = fbm(P * uA.x, 6); float pits = step(0.93, rnd3(uint(gl_FragCoord.x / 2.0), uint(gl_FragCoord.y / 2.0), uSeed)) * uA.y; s = 0.78 + 0.3 * n - 0.25 * pits; }
    vec3 c = uCol1 * clamp(s, 0.0, 1.2); r = vec4(mix(vec3(1.0), c, uI), 1.0); }
  else if (uKind == 17){ float a0 = radians(uA.x); vec2 dir = vec2(cos(a0), sin(a0)), q = vec2(dot(P, dir), dot(P, vec2(-dir.y, dir.x)));
    float n = 0.5 * fbm(vec2(q.x * 2.0, q.y * uA.y), 3) + 0.5 * rnd3(uint(int(q.y * uA.y * 3.0) + 100000), 0u, uSeed); r = vec4(vec3(mix(0.5, n, uI)), 1.0); }
  else if (uKind == 18){ int sd = int(uA.x + 0.5); float d = sd == 0 ? 1.0 - uv.y : sd == 1 ? uv.y : sd == 2 ? uv.x : 1.0 - uv.x; float along = sd < 2 ? P.x : uv.y;
    float edge = uA.y * (0.6 + 0.4 * fbm(vec2(along * 9.0, 0.0), 5) + 0.15 * uA.z * (rnd2(uint(along * 400.0), uSeed) - 0.5));
    float paper = smoothstep(edge + 0.002, edge - 0.002, d); float fib = smoothstep(edge + 0.012, edge, d) * (1.0 - paper);
    vec3 c = uCol1 * (0.94 + 0.06 * fbm(P * 30.0, 3)); float a = max(paper, fib * 0.6) * uI; r = vec4(c * a, a); }
  else if (uKind == 19){ float n = fbm(P * uA.x + vec2(t * uA.w, 0.0), int(uA.y + 0.5)); n = clamp((n - 0.5) * uA.z + 0.5, 0.0, 1.0); r = vec4(vec3(n) * uI, 1.0); }
  o = r;
}`;

export class Fx2Layer {
  constructor(canvas, kind, params = {}, { width = 1920, height = 1080, fps = 30, seed = 1 } = {}) {
    if (!FX2_KINDS[kind]) throw new Error('unknown fx2 kind ' + kind);
    this.kind = kind; this.canvas = canvas; this.W = canvas.width = width; this.H = canvas.height = height; this.fps = fps; this.seed = seed;
    const gl = this.gl = getGL(canvas, { alpha: true, premultipliedAlpha: true }); this.prog = new Prog(gl, VERT, FRAG, 'fx2'); gl.bindVertexArray(gl.createVertexArray());
    this.setParams(params); canvas.style.mixBlendMode = FX2_KINDS[kind].blend; canvas.dataset.mpKind = kind;
  }
  setParams(p) { this.p = { ...FX2_KINDS[this.kind].d, ...p }; return this; }
  render(t, { frame } = {}) {
    const k = FX2_KINDS[this.kind], u = k.pack(this.p), n = frame ?? Math.round(t * this.fps), gl = this.gl;
    this.prog.use().setAll({ uKind: k.id, uRes: [this.W, this.H], uAspect: this.W / this.H, uTime: t, uFrame: n >>> 0, uSeed: (this.p.seed ?? this.seed) >>> 0,
      uA: u.A || [0, 0, 0, 0], uB: u.B || [0, 0, 0, 0], uCol1: u.col1 || [1, 1, 1], uCol2: u.col2 || [1, 1, 1], uI: u.I ?? 1 });
    gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); draw(gl, null, this.W, this.H); return this;
  }
}
