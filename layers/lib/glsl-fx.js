/* motion-pack / layers: GLSL chunks for the procedural finishing layers (no source texture needed). Owned code.
   Pixel units: PX = H/1080 so every size is resolution independent. Every effect is a pure function of (pixel, frame, seed, t). */

export const COMMON_U = `
uniform vec2  uRes;       // output size in px
uniform float uAspect;    // W/H
uniform float uPX;        // H/1080
uniform int   uFrame;     // output frame index (the ONLY source of per-frame randomness)
uniform float uTime;      // seconds (smooth motion: drift, pulses)
uniform float uFps;
uniform uint  uSeed;
`;

/* ---- film grain: PCG triangular noise, kit-compatible (g = r1 + r2 - 1, sigma 0.408), size via renormalised bilinear, chroma var-preserving ---- */
export const GRAIN = `
uniform float uGrainAmt, uGrainSize, uGrainChroma, uGrainMid, uGrainProtect;
uniform int   uGrainFrame;   // pattern index (held for N output frames to emulate 24/18 fps stocks)
float tri(ivec2 c, uint ch){
  uint k = hash3(uint(c.x + 32768), uint(c.y + 32768), uint(uGrainFrame) * 8u + ch + uSeed * 131u);
  return u01(k) + u01(pcg(k ^ 0xa511e9b3u)) - 1.0;
}
float gn(vec2 fc, uint ch){
  if (uGrainSize <= 1.001) return tri(ivec2(floor(fc)), ch);
  vec2 q = fc / uGrainSize - 0.5; ivec2 i = ivec2(floor(q)); vec2 f = fract(q);
  float w00 = (1.0 - f.x) * (1.0 - f.y), w10 = f.x * (1.0 - f.y), w01 = (1.0 - f.x) * f.y, w11 = f.x * f.y;
  float v = tri(i, ch) * w00 + tri(i + ivec2(1, 0), ch) * w10 + tri(i + ivec2(0, 1), ch) * w01 + tri(i + ivec2(1, 1), ch) * w11;
  return v * inversesqrt(w00 * w00 + w10 * w10 + w01 * w01 + w11 * w11);
}
/* c: display-referred colour under the grain. returns c + grain */
vec3 grainApply(vec3 c, vec2 fc){
  if (uGrainAmt <= 0.0) return c;
  float n0 = gn(fc, 0u); vec3 n = vec3(n0);
  if (uGrainChroma > 0.0){ float a = sqrt(1.0 - uGrainChroma), b = sqrt(uGrainChroma); n = vec3(a * n0 + b * gn(fc, 1u), a * n0 + b * gn(fc, 2u), a * n0 + b * gn(fc, 3u)); }
  float L = dot(c, LUMA);
  float w = (1.0 - uGrainMid) + uGrainMid * (1.0 - abs(2.0 * L - 1.0));      // kit: 0.55 + 0.45 * (1 - |2L-1|)
  w *= 1.0 - uGrainProtect * smoothstep(0.92, 1.0, L);                         // never grain pure whites / flat brand fields
  return c + n * (uGrainAmt * w);
}
vec3 ditherApply(vec3 c, vec2 fc){   // TPDF +-1 LSB, last step before 8-bit quantisation
  uint k = hash3(uint(fc.x), uint(fc.y) + 7u, uint(uFrame) + 99991u + uSeed);
  float t = u01(k) + u01(pcg(k ^ 0x68e31da4u)) - 1.0; return c + t / 255.0;
}
`;

/* ---- vignette: smooth multiplicative falloff; roundness 0 = elliptical (kit), 1 = circular in pixel space (stable in 9:16) ---- */
export const VIGNETTE = `
uniform float uVigAmt, uVigIn, uVigOut, uVigRound; uniform vec3 uVigColor;
vec3 vignetteApply(vec3 c, vec2 uv){
  if (uVigAmt <= 0.0) return c;
  float a = mix(1.0, uAspect, uVigRound); vec2 p = (uv - 0.5) * 2.0;
  float d = length(p * vec2(a, 1.0)) * 1.41421356 / length(vec2(a, 1.0));
  float v = smoothstep(uVigIn, uVigOut, d); return mix(c, uVigColor, uVigAmt * v);
}
`;

/* ---- light leaks: 3..5 anisotropic soft gaussian blobs entering from an edge, closed form in t; add to linear light (screen) ---- */
export const LEAKS = `
uniform int uLeakN; uniform vec4 uLeakP[5]; uniform vec4 uLeakM[5]; uniform vec3 uLeakC[5]; uniform float uLeakI;
vec3 leaksCol(vec2 uv){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 5; i++){
    if (i >= uLeakN) break;
    vec4 P = uLeakP[i], M = uLeakM[i];
    vec2 c = P.xy + vec2(M.x * sin(6.2831853 * M.z * uTime + M.w), M.y * cos(6.2831853 * M.z * 0.83 * uTime + M.w * 1.7));
    vec2 d = vec2((uv.x - c.x) * uAspect, uv.y - c.y) / P.zw;
    acc += uLeakC[i] * exp(-0.5 * dot(d, d));
  }
  return acc * uLeakI;
}
`;

/* ---- dust, hair, scratches: hash(seed, frame, i); polarity chosen by the plate luma under the mark ---- */
export const DUST = `
uniform float uDustDen, uDustHair, uDustScr;
float segDist(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
/* dustMarks -> (mark colour, alpha); dustApply composites onto display-space c */
vec2 dustMarks(vec2 fc, float lum){
  if (uDustDen <= 0.0 && uDustHair <= 0.0 && uDustScr <= 0.0) return vec2(0.0);
  float PX = uPX; float pol = lum > 0.5 ? 0.04 : 0.97;   // dark marks on bright plates, white on dark
  uint fr = uint(uFrame); float a = 0.0;
  if (uDustDen > 0.0){
    for (int pass = 0; pass < 2; pass++){
      uint f = pass == 0 ? fr : fr - 1u;
      for (int i = 0; i < 14; i++){
        uint k = hash3(uint(i), f, uSeed * 17u + 5u);
        float live = pass == 0 ? 1.0 : step(rnd2(k, 3u), 0.10);                      // 10% of marks live for 2 frames
        float on = step(float(i) + 0.5, uDustDen * (6.0 + floor(rnd2(f, uSeed + 11u) * 9.0)));
        vec2 p = vec2(rnd2(k, 1u), rnd2(k, 2u)) * uRes;
        float s = exp(mix(log(1.0), log(4.0), rnd2(k, 4u))) * PX;                    // 1..4 px log-normal
        float ang = rnd2(k, 5u) * 6.2831853; vec2 d = fc - p; d = vec2(cos(ang) * d.x + sin(ang) * d.y, -sin(ang) * d.x + cos(ang) * d.y);
        d.x /= 1.0 + 1.4 * rnd2(k, 6u);
        float m = (1.0 - smoothstep(0.55 * s, s + 0.5, length(d))) * mix(0.25, 0.8, rnd2(k, 7u)) * live * on;
        a = max(a, m);
      }
    }
  }
  float hairA = 0.0;
  if (uDustHair > 0.0){
    float P = max(1.0, floor(uFps / (0.3 * uDustHair) + 0.5)); uint slot = uint(floor(float(uFrame) / P)); uint k = hash2(slot, uSeed + 31u);
    float born = float(slot) * P + floor(rnd2(k, 1u) * max(P - 14.0, 1.0)), life = 4.0 + floor(rnd2(k, 2u) * 9.0);
    if (float(uFrame) >= born && float(uFrame) <= born + life){
      vec2 p0 = vec2(rnd2(k, 3u), rnd2(k, 4u)) * uRes; float ang = rnd2(k, 5u) * 6.2831853, len = mix(40.0, 120.0, rnd2(k, 6u)) * PX;
      vec2 dir = vec2(cos(ang), sin(ang)), nrm = vec2(-dir.y, dir.x); vec2 p2 = p0 + dir * len; vec2 pc = p0 + dir * len * 0.5 + nrm * (rnd2(k, 7u) - 0.5) * len * 0.6;
      vec2 wig = (vec2(rnd3(k, uint(uFrame), 8u), rnd3(k, uint(uFrame), 9u)) - 0.5) * 2.0 * PX;
      float dmin = 1e9; vec2 prev = p0 + wig;
      for (int s = 1; s <= 8; s++){ float t = float(s) / 8.0; vec2 q = (1.0 - t) * (1.0 - t) * p0 + 2.0 * t * (1.0 - t) * pc + t * t * p2 + wig; dmin = min(dmin, segDist(fc, prev, q)); prev = q; }
      hairA = (1.0 - smoothstep(0.4 * PX, 1.3 * PX, dmin)) * 0.35;
    }
  }
  float scrA = 0.0;
  if (uDustScr > 0.0){
    float P = max(1.0, floor(uFps / (0.5 * uDustScr) + 0.5));
    for (int j = 0; j < 2; j++){
      uint slot = uint(floor(float(uFrame) / P)) * 2u + uint(j); uint k = hash2(slot, uSeed + 77u);
      float born = floor(float(slot / 2u) * P) + floor(rnd2(k, 1u) * max(P - 10.0, 1.0)), life = 2.0 + floor(rnd2(k, 2u) * 7.0);
      if (rnd2(k, 9u) < 0.5 || float(uFrame) < born || float(uFrame) > born + life) continue;
      float x = rnd2(k, 3u) * uRes.x, y0 = rnd2(k, 4u) * 0.5 * uRes.y, y1 = y0 + mix(0.35, 1.0, rnd2(k, 5u)) * uRes.y;
      float m = (1.0 - smoothstep(0.3 * PX, 0.9 * PX + 0.5, abs(fc.x - x))) * step(y0, fc.y) * step(fc.y, y1) * mix(0.12, 0.30, rnd2(k, 6u));
      scrA = max(scrA, m);
    }
  }
  a = max(a, max(hairA, scrA));
  return vec2(pol, clamp(a, 0.0, 1.0));
}
vec3 dustApply(vec3 c, vec2 fc){ vec2 m = dustMarks(fc, dot(c, LUMA)); return mix(c, vec3(m.x), m.y); }
`;

/* ---- bokeh: out-of-focus lights (soft discs / hexagons) drifting slowly; additive. returns linear-ish glow colour ---- */
export const BOKEH = `
uniform int uBokN; uniform vec2 uBokR; uniform float uBokI, uBokSoft, uBokHex, uBokDrift; uniform vec3 uBokC0, uBokC1, uBokC2;
float hexd(vec2 p){ p = abs(p); return max(p.y, dot(p, vec2(0.8660254, 0.5))) / 0.8660254; }
vec3 bokehCol(vec2 uv){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 32; i++){
    if (i >= uBokN) break;
    uint k = hash2(uint(i), uSeed + 4242u);
    float r = mix(uBokR.x, uBokR.y, rnd2(k, 1u) * rnd2(k, 1u));                     // many small, few large
    vec2 base = vec2(rnd2(k, 2u) * 1.2 - 0.1, rnd2(k, 3u) * 1.2 - 0.1);
    float ph = rnd2(k, 4u) * 6.2831853, hz = mix(0.03, 0.09, rnd2(k, 5u));
    vec2 c = base + uBokDrift * vec2(sin(6.2831853 * hz * uTime + ph), cos(6.2831853 * hz * 0.7 * uTime + ph * 1.3));
    vec2 p = vec2((uv.x - c.x) * uAspect, uv.y - c.y) / r;
    float d = mix(length(p), hexd(p), uBokHex);
    float shape = (0.55 + 0.45 * smoothstep(0.65, 1.0, d)) * (1.0 - smoothstep(1.0 - uBokSoft, 1.0 + 0.02, d));
    float tw = 0.7 + 0.3 * sin(6.2831853 * mix(0.08, 0.25, rnd2(k, 6u)) * uTime + ph * 2.0);
    float pick = rnd2(k, 7u); vec3 col = pick < 0.34 ? uBokC0 : (pick < 0.67 ? uBokC1 : uBokC2);
    acc += col * shape * tw * mix(0.35, 1.0, rnd2(k, 8u)) * (0.4 + 0.6 * smoothstep(0.02, 0.08, r));
  }
  return acc * uBokI;
}
`;

/* ---- glow: up to 3 radial soft light pools (rim wash / sun wash); additive ---- */
export const GLOW = `
uniform int uGlowN; uniform vec4 uGlowP[3]; uniform vec3 uGlowC[3];
vec3 glowCol(vec2 uv){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 3; i++){ if (i >= uGlowN) break; vec4 P = uGlowP[i]; vec2 d = vec2((uv.x - P.x) * uAspect, uv.y - P.y) / P.z; acc += uGlowC[i] * P.w * exp(-1.5 * dot(d, d)); }
  return acc;
}
`;

/* ---- paper: static fibre + mottling + tooth texture, returned as a multiplier (use multiply). frame independent ---- */
export const PAPER = `
uniform float uPaperAmt, uPaperScale, uPaperFiber, uPaperAngle; uniform vec3 uPaperTint;
float vn(vec2 p, uint s){ ivec2 i = ivec2(floor(p)); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = rnd3(uint(i.x + 4096), uint(i.y + 4096), s), b = rnd3(uint(i.x + 4097), uint(i.y + 4096), s), c = rnd3(uint(i.x + 4096), uint(i.y + 4097), s), d = rnd3(uint(i.x + 4097), uint(i.y + 4097), s);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float fbm(vec2 p, uint s){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * vn(p, s + uint(i) * 13u); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
vec3 paperMul(vec2 fc){
  if (uPaperAmt <= 0.0) return vec3(1.0);
  vec2 p = fc;                                                  // px
  float ca = cos(uPaperAngle), sa = sin(uPaperAngle); vec2 r = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);
  float mott = fbm(p / (180.0 * uPaperScale * uPX), uSeed + 1u);                          // large cloudy mottling
  float fib = fbm(vec2(r.x / (3.0 * uPaperScale * uPX), r.y / (90.0 * uPaperScale * uPX)), uSeed + 2u);   // long fibres
  float tooth = rnd3(uint(floor(p.x / uPX)), uint(floor(p.y / uPX)), uSeed + 3u);          // fine tooth
  float t = 0.55 * mott + 0.14 * fib * uPaperFiber + 0.31 * tooth;
  float m = 1.0 - uPaperAmt * (t - 0.40) * 0.45;
  return mix(vec3(1.0), uPaperTint, uPaperAmt * 0.5) * m;
}
`;

/* ---- scanlines / RGB mask / letterbox bars ---- */
export const RETRO = `
uniform float uScanPitch, uScanDepth, uMaskAmt, uBarsRatio, uBarsK;
vec3 scanApply(vec3 c, vec2 fc){
  if (uScanDepth > 0.0){ float s = 0.5 + 0.5 * cos(6.2831853 * fc.y / (uScanPitch * uPX)); c *= 1.0 - uScanDepth * s; }
  if (uMaskAmt > 0.0){ int m = int(mod(floor(fc.x / max(uPX, 0.5)), 3.0)); vec3 tri = vec3(m == 0 ? 1.0 : 1.0 - uMaskAmt, m == 1 ? 1.0 : 1.0 - uMaskAmt, m == 2 ? 1.0 : 1.0 - uMaskAmt); c *= tri; }
  return c;
}
float barsMask(vec2 uv){   // 1 inside the picture. uBarsRatio = target aspect (2.39), uBarsK = reveal 0..1
  if (uBarsK <= 0.0 || uBarsRatio <= 0.0) return 1.0;
  float vis = min(1.0, uAspect / uBarsRatio); float bar = (1.0 - vis) * 0.5 * uBarsK;     // fraction of H per bar
  return step(bar, uv.y) * step(uv.y, 1.0 - bar);
}
`;
