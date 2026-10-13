/* motion-pack / transitions / lib / tx-shaders.js
   Owned GLSL (ES 1.00, also valid inside three.js ShaderMaterial on WebGL2) for every GL transition.
   Contract: uFrom / uTo (shots, GL orientation), uP = linear progress, uE = eased progress, uCut = swap point,
   uRes = pixels, uSeed, uDur = seconds, u_<param> per registry param. Every shader is a pure function of its uniforms.
   Ideas, not code, come from the open-source gl-transitions collection (gl-transitions.com, read for vocabulary
   only; nothing vendored). Endpoints are exact: the runner draws a passthrough at p <= 0 and p >= 1. */

import { SHADERS_X } from './tx-shaders-x.js';

export const VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
export const VERT_THREE = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const PRELUDE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uFrom; uniform sampler2D uTo; uniform sampler2D uMask;
uniform float uP; uniform float uE; uniform float uCut; uniform vec2 uRes; uniform float uSeed; uniform float uDur;
#define PI 3.14159265359
vec4 A(vec2 uv){ return texture2D(uFrom, uv); }
vec4 B(vec2 uv){ return texture2D(uTo, uv); }
vec3 S(float which, vec2 uv){ return which < 0.5 ? texture2D(uFrom, uv).rgb : texture2D(uTo, uv).rgb; }
float aspect(){ return uRes.x / uRes.y; }
vec2 tl(vec2 c){ return vec2(c.x, 1.0 - c.y); }                 /* designer top-left -> GL */
vec2 mp_mirror(vec2 uv){ vec2 m = mod(uv, 2.0); return mix(m, 2.0 - m, step(1.0, m)); }
float mp_hash(vec2 p){ vec2 q = fract(p * vec2(0.3183099, 0.3678794) + fract(uSeed * 0.6180339)); q += dot(q, q + 17.17); return fract(q.x * q.y * 2.0); }
float mp_noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = mp_hash(i), b = mp_hash(i + vec2(1.0, 0.0)), c = mp_hash(i + vec2(0.0, 1.0)), d = mp_hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
float mp_fbm(vec2 p){ float s = 0.0, a = 0.5; mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++){ s += a * mp_noise(p); p = r * p * 2.03 + 11.7; a *= 0.5; } return s / 0.97; }
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float inExpo(float x){ return x <= 0.0 ? 0.0 : pow(2.0, 10.0 * x - 10.0); }
float outExpo(float x){ return x >= 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * x); }
float inCubic(float x){ return x * x * x; }
float outCubic(float x){ float y = 1.0 - x; return 1.0 - y * y * y; }
float bellp(float p, float c){ return p < c ? pow(sin(PI * 0.5 * p / c), 2.0) : pow(sin(PI * 0.5 * (1.0 - p) / (1.0 - c)), 2.0); }
vec2 rot2(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
`;

export const PASSTHROUGH = `void main(){ gl_FragColor = vec4(uP < 0.5 ? A(vUv).rgb : B(vUv).rgb, 1.0); }`;

export const SHADERS = {
flash: `
uniform vec3 u_color; uniform float u_peak; uniform float u_bloom;
void main(){
  float p = uP; vec3 src = p < uCut ? A(vUv).rgb : B(vUv).rgb;
  float env = p < uCut ? pow(p / uCut, 2.0) : pow(1.0 - (p - uCut) / (1.0 - uCut), 2.2);
  env *= u_peak;
  vec3 c = src * (1.0 + u_bloom * env * 2.0);
  gl_FragColor = vec4(clamp(mix(c, u_color, env), 0.0, 1.0), 1.0);
}`,

shutter: `
uniform vec3 u_color; uniform float u_bars; uniform float u_stagger; uniform float u_vertical; uniform float u_edge;
float sm3(float x){ x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float closeAt(float p, float d){ return sm3((p / uCut - d) / (1.0 - u_stagger)); }
float openAt(float p, float d){ return sm3(((p - uCut) / (1.0 - uCut) - d) / (1.0 - u_stagger)); }
void main(){
  float p = uP; bool vert = u_vertical > 0.5;
  float along = vert ? 1.0 - vUv.y : vUv.x, across = vert ? vUv.x : 1.0 - vUv.y;
  float i = floor(across * u_bars); float dir = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
  float x = dir > 0.0 ? along : 1.0 - along;
  float d = (i / max(u_bars - 1.0, 1.0)) * u_stagger;
  float dp = 0.5 / max(uDur * 30.0, 1.0);                       /* half a frame at 30 fps: analytic edge motion blur */
  float cl = closeAt(p, d), op = openAt(p, d);
  float px = 1.5 / (vert ? uRes.y : uRes.x);
  float bc = max(px, abs(closeAt(p + dp, d) - closeAt(p - dp, d)) * 0.5), bo = max(px, abs(openAt(p + dp, d) - openAt(p - dp, d)) * 0.5);
  float covered = p < uCut ? 1.0 - smoothstep(cl - bc, cl + bc, x) : smoothstep(op - bo, op + bo, x);
  vec3 src = p < uCut ? A(vUv).rgb : B(vUv).rgb;
  float e = p < uCut ? cl - x : x - op;
  float hl = covered * exp(-max(e, 0.0) * 70.0) * u_edge;
  vec3 bar = u_color * (0.82 + 0.18 * fract(across * u_bars)) + vec3(hl);
  vec3 c = mix(src, bar, covered);
  c *= 1.0 - (1.0 - covered) * exp(-abs(e) * 45.0) * 0.35 * step(0.001, cl) * (1.0 - step(0.999, op));
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,

lumaWipe: `
uniform float u_matte; uniform float u_angle; uniform float u_softness; uniform float u_invert; uniform vec2 u_center;
uniform float u_blinds; uniform vec3 u_edgeColor; uniform float u_edgeGlow;
float matte(vec2 uv){
  int m = int(u_matte + 0.5); float th = radians(u_angle); vec2 d = vec2(cos(th), -sin(th));
  vec2 P = vec2(uv.x, 1.0 - uv.y);                                     /* top-left space */
  if (m == 0){ float ext = 0.5 * (abs(d.x) + abs(d.y)); return dot(P - 0.5, d) / (2.0 * ext) + 0.5; }
  if (m == 5){ return fract(dot(P, d) * u_blinds); }
  vec2 c = u_center; float ar = aspect(); vec2 q = vec2((P.x - c.x) * ar, P.y - c.y);
  vec2 far = vec2(max(c.x, 1.0 - c.x) * ar, max(c.y, 1.0 - c.y));
  if (m == 1) return length(q) / length(far);
  if (m == 2) return clamp((mp_fbm(P * vec2(ar, 1.0) * 3.0) - 0.2) / 0.6, 0.0, 1.0);
  if (m == 3) return fract(atan(q.x, -q.y) / (2.0 * PI) + 1.0);
  return (abs(q.x) + abs(q.y)) / (far.x + far.y);
}
void main(){
  float m = matte(vUv); if (u_invert > 0.5) m = 1.0 - m;
  float s = max(u_softness, 1e-4); float w = smoothstep(m, m + s, uE * (1.0 + s));
  vec3 c = mix(A(vUv).rgb, B(vUv).rgb, w) + u_edgeColor * u_edgeGlow * 4.0 * w * (1.0 - w);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,

iris: `
uniform float u_shape; uniform vec2 u_center; uniform float u_softness; uniform float u_overscan; uniform float u_throughBlack;
uniform vec3 u_color; uniform float u_ring; uniform float u_points;
float sd(vec2 q){
  int s = int(u_shape + 0.5);
  if (s == 0) return length(q);
  if (s == 1) return (abs(q.x) + abs(q.y)) * 0.7071;
  if (s == 2){ float a = atan(q.x, q.y); float t = abs(fract(a * u_points / (2.0 * PI)) - 0.5) * 2.0; return length(q) / mix(0.45, 1.0, t * t); }
  vec2 b = abs(q) / vec2(aspect(), 1.0); return pow(pow(b.x, 4.0) + pow(b.y, 4.0), 0.25) * 0.75;
}
void main(){
  float ar = aspect(); vec2 c = u_center; vec2 P = vec2(vUv.x, 1.0 - vUv.y);
  float far = max(max(sd(vec2(-c.x * ar, -c.y)), sd(vec2((1.0 - c.x) * ar, -c.y))), max(sd(vec2(-c.x * ar, 1.0 - c.y)), sd(vec2((1.0 - c.x) * ar, 1.0 - c.y))));
  float d = sd(vec2((P.x - c.x) * ar, P.y - c.y)); float s = max(u_softness, 1.0 / uRes.y);
  vec3 col;
  if (u_throughBlack > 0.5){
    float pa = clamp(uP / uCut, 0.0, 1.0), pb = clamp((uP - uCut) / (1.0 - uCut), 0.0, 1.0);
    float r = (uP < uCut ? 1.0 - pa * pa * (3.0 - 2.0 * pa) : pb * pb * (3.0 - 2.0 * pb)) * far * u_overscan;
    float inside = 1.0 - smoothstep(r - s, r, d);
    col = mix(u_color, uP < uCut ? A(vUv).rgb : B(vUv).rgb, inside);
  } else {
    float r = uE * far * u_overscan; float inside = 1.0 - smoothstep(r - s, r, d);
    col = mix(A(vUv).rgb, B(vUv).rgb, inside);
    if (u_ring > 0.0) col = mix(col, u_color, (1.0 - smoothstep(u_ring * 0.5, u_ring * 0.5 + s, abs(d - r))) * step(0.001, uE));
  }
  gl_FragColor = vec4(col, 1.0);
}`,

whip: `
uniform vec2 u_dir; uniform float u_blurMax; uniform float u_chroma;
void main(){
  vec2 d = vec2(u_dir.x, -u_dir.y);                                    /* top-left dir -> GL */
  vec2 ax = abs(d); float o = uE;
  float v = sin(PI * clamp(uP, 0.0, 1.0)); v *= v;
  float blur = u_blurMax * v; vec2 ch = d * u_chroma * v / uRes;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 16; i++){
    float k = (float(i) / 15.0 - 0.5) * blur; vec2 q = vUv + d * (o + k);
    vec2 axq = ax; float t = dot(q, axq);
    vec3 cg = (d.x + d.y > 0.0) ? (t < 1.0 ? A(q).rgb : B(q - axq).rgb) : (t >= 0.0 ? A(q).rgb : B(q + axq).rgb);
    vec2 qr = q + ch, qb = q - ch; float tr = dot(qr, axq), tb = dot(qb, axq);
    float r = (d.x + d.y > 0.0) ? (tr < 1.0 ? A(qr).r : B(qr - axq).r) : (tr >= 0.0 ? A(qr).r : B(qr + axq).r);
    float b = (d.x + d.y > 0.0) ? (tb < 1.0 ? A(qb).b : B(qb - axq).b) : (tb >= 0.0 ? A(qb).b : B(qb + axq).b);
    acc += vec3(r, cg.g, b);
  }
  gl_FragColor = vec4(acc / 16.0, 1.0);
}`,

zoomThrough: `
uniform vec2 u_center; uniform float u_scaleOut; uniform float u_scaleIn; uniform float u_radialBlur; uniform float u_band; uniform float u_shake;
vec3 radial(float which, vec2 uv, vec2 c, float s, float amt){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 12; i++){ float k = 1.0 - amt * 0.22 * float(i) / 11.0; acc += S(which, mp_mirror(c + (uv - c) / s * k)); }
  return acc / 12.0;
}
void main(){
  vec2 c = tl(u_center); float p = uP;
  float fr = floor(p * uDur * 30.0); float sh = u_shake * bellp(p, uCut);
  vec2 uv = vUv + (vec2(mp_hash(vec2(fr, 1.0)), mp_hash(vec2(fr, 2.0))) - 0.5) * sh;
  float pa = clamp(p / uCut, 0.0, 1.0), pb = clamp((p - uCut) / (1.0 - uCut), 0.0, 1.0);
  float w = smoothstep(uCut - u_band * 0.5, uCut + u_band * 0.5, p);
  vec3 ca = w < 1.0 ? radial(0.0, uv, c, mix(1.0, u_scaleOut, inExpo(pa)), u_radialBlur * inExpo(pa)) : vec3(0.0);
  vec3 cb = w > 0.0 ? radial(1.0, uv, c, mix(u_scaleIn, 1.0, outExpo(pb)), u_radialBlur * (1.0 - outExpo(pb))) : vec3(0.0);
  gl_FragColor = vec4(mix(ca, cb, w), 1.0);
}`,

match: `
uniform vec4 uPose0; uniform vec4 uPose1; uniform vec4 uPose2; uniform vec2 uAnc; uniform float uWhich; uniform vec4 uMeet;
uniform vec4 u_anchorA; uniform vec4 u_anchorB; uniform float u_blur; uniform float u_guides;
vec3 posed(vec4 pose, vec2 P){
  float ar = aspect(); vec2 X = (P - pose.xy) * vec2(ar, 1.0);
  vec2 src = uAnc + rot2(X, -pose.w) / pose.z / vec2(ar, 1.0);
  return S(uWhich, mp_mirror(vec2(src.x, 1.0 - src.y)));
}
float ring(vec2 P, vec2 c, float r){ float ar = aspect(); float d = abs(length((P - c) * vec2(ar, 1.0)) - r); return 1.0 - smoothstep(0.0015, 0.004, d); }
void main(){
  vec2 P = vec2(vUv.x, 1.0 - vUv.y);
  vec3 c = posed(uPose1, P);
  if (u_blur > 0.0) c = mix(c, (posed(uPose0, P) + c + posed(uPose2, P)) / 3.0, clamp(u_blur, 0.0, 1.0));
  if (u_guides > 0.5){
    float rr = (uWhich < 0.5 ? u_anchorA.z : u_anchorB.z) * 0.5 * uPose1.z;
    c = mix(c, uWhich < 0.5 ? vec3(1.0, 0.2, 0.25) : vec3(0.1, 0.9, 1.0), ring(P, uPose1.xy, rr));
    float ar = aspect(); vec2 m = (P - uMeet.xy) * vec2(ar, 1.0);
    float cross = (1.0 - smoothstep(0.001, 0.003, abs(m.x))) * step(abs(m.y), 0.05) + (1.0 - smoothstep(0.001, 0.003, abs(m.y))) * step(abs(m.x), 0.05);
    c = mix(c, vec3(1.0), clamp(cross, 0.0, 1.0));
  }
  gl_FragColor = vec4(c, 1.0);
}`,

morph: `
uniform float u_warp; uniform float u_spread;
vec2 grad(float which, vec2 uv){ vec2 e = u_spread / uRes;
  return vec2(lum(S(which, uv + vec2(e.x, 0.0))) - lum(S(which, uv - vec2(e.x, 0.0))), lum(S(which, uv + vec2(0.0, e.y))) - lum(S(which, uv - vec2(0.0, e.y)))); }
void main(){
  float p = uP; float k = u_warp * 0.12 * sin(PI * p);
  vec2 ga = grad(0.0, vUv), gb = grad(1.0, vUv);
  vec3 a = A(mp_mirror(vUv + gb * k * (0.5 + p))).rgb;
  vec3 b = B(mp_mirror(vUv - ga * k * (1.5 - p))).rgb;
  gl_FragColor = vec4(mix(a, b, smoothstep(0.15, 0.85, uE)), 1.0);
}`,

lightLeak: `
uniform vec3 u_c1; uniform vec3 u_c2; uniform vec3 u_c3; uniform float u_intensity; uniform float u_drift; uniform float u_grain; uniform float u_band;
vec3 blob(vec2 uv, vec2 c, float r, vec3 col){ vec2 d = (uv - c) * vec2(aspect(), 1.0); return col * exp(-dot(d, d) / (r * r)); }
void main(){
  float p = uP; float env = pow(bellp(p, uCut), 1.2); float s = uSeed * 1.37;
  vec2 c1 = vec2(-0.15 + 1.3 * p * u_drift, 0.72 + 0.12 * sin(6.2832 * (p * 0.5 + s)));
  vec2 c2 = vec2(1.15 - 1.2 * p * u_drift, 0.32 + 0.10 * cos(6.2832 * (p * 0.4 + s * 0.7)));
  vec2 c3 = vec2(0.5 + 0.35 * sin(6.2832 * (p * 0.3 + s * 0.3)), 0.5 + 0.3 * cos(6.2832 * (p * 0.35 + s)));
  float r = 0.35 + 0.45 * env;
  vec3 leak = blob(vUv, c1, r * 1.2, u_c1) + blob(vUv, c2, r, u_c2) + blob(vUv, c3, r * 0.8, u_c3);
  float lx = 0.2 + 0.6 * p; leak += u_c3 * exp(-pow((vUv.x - lx) * 7.0, 2.0)) * 0.6;
  leak *= env * u_intensity;
  vec3 base = mix(A(vUv).rgb, B(vUv).rgb, smoothstep(uCut - u_band, uCut + u_band, p));
  vec3 c = 1.0 - (1.0 - base) * (1.0 - clamp(leak, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.95, 0.86), env * env * 0.55 * u_intensity);
  c += (mp_hash(vUv * uRes + floor(p * uDur * 24.0) * vec2(17.0, 31.0)) - 0.5) * u_grain * env;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,

filmBurn: `
uniform float u_from; uniform vec3 u_core; uniform vec3 u_rim; uniform vec3 u_char; uniform float u_flicker; uniform float u_grain; uniform float u_weave;
void main(){
  float p = uP; float fr = floor(p * uDur * max(u_flicker, 1.0)); float env = bellp(p, uCut);
  vec2 uv = vUv; uv.y += (mp_hash(vec2(fr, 7.0)) - 0.5) * u_weave * 2.0 / uRes.y * env;
  float ar = aspect(); float f = mp_fbm(uv * vec2(ar, 1.0) * 2.5 + uSeed * 3.1);
  int fm = int(u_from + 0.5);
  float g = fm == 0 ? uv.x : fm == 1 ? 1.0 - uv.x : fm == 2 ? length((uv - 0.5) * vec2(ar, 1.0)) / length(vec2(ar, 1.0) * 0.5) : f;
  float m = mix(g, f, 0.45);
  vec3 c;
  if (p < uCut){
    float pa = p / uCut; float front = mix(-0.15, 1.15, pa * pa * (3.0 - 2.0 * pa) * 0.6 + pa * 0.4);
    float d = m - front;
    float burned = smoothstep(0.02, -0.05, d);
    float rim = exp(-pow((d + 0.006) / 0.018, 2.0));
    float scorch = smoothstep(0.14, 0.0, d) * (1.0 - burned);
    c = mix(A(uv).rgb, u_char, scorch * 0.75);
    c = mix(c, u_core, burned) + u_rim * rim * 1.4;
  } else {
    float pb = (p - uCut) / (1.0 - uCut);
    float w = smoothstep(f - 0.2, f + 0.2, pb * 1.45 - 0.22);
    c = mix(u_core, B(uv).rgb, w) + u_rim * 0.7 * 4.0 * w * (1.0 - w) * (1.0 - pb);
  }
  c *= 0.94 + 0.12 * mp_hash(vec2(fr, 3.0)) * env + (1.0 - env) * 0.06;
  c += (mp_hash(uv * uRes + fr * vec2(13.0, 7.0)) - 0.5) * u_grain * env;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,

glitch: `
uniform float u_rgbSplit; uniform float u_slices; uniform float u_sliceShift; uniform float u_scanlines; uniform float u_quantFps; uniform float u_blocks;
void main(){
  float n = max(uDur * u_quantFps, 1.0); float q = floor(uP * n); float pq = (q + 0.5) / n;
  float inten = sin(PI * clamp(pq, 0.0, 1.0));
  vec2 uv = vUv;
  float sl = floor(uv.y * u_slices + mp_hash(vec2(q, 1.0)) * 3.0); float h = mp_hash(vec2(sl, q + 0.5));
  if (h > 0.55) uv.x += (mp_hash(vec2(sl, q + 9.0)) - 0.5) * 2.0 * u_sliceShift * inten;
  float bh = mp_hash(floor(vUv * vec2(16.0, 9.0)) + q * 3.1);
  bool blk = bh < u_blocks * inten * 0.5;
  float which = uP < uCut ? 0.0 : 1.0;
  if ((h > 0.85 && inten > 0.3) || blk) which = 1.0 - which;
  float off = u_rgbSplit * inten;
  vec3 c = vec3(S(which, uv + vec2(off, 0.0)).r, S(which, uv).g, S(which, uv - vec2(off, 0.0)).b);
  c *= 1.0 - u_scanlines * inten * (0.5 + 0.5 * sin(vUv.y * uRes.y * PI * 0.5));
  if (blk) c = floor(c * 4.0 + 0.5) / 4.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,

ink: `
uniform float u_source; uniform vec2 u_center; uniform float u_viscosity; uniform float u_warp; uniform float u_softness;
uniform vec3 u_edgeTint; uniform float u_tintAmt;
void main(){
  float ar = aspect(); vec2 P = vec2(vUv.x, 1.0 - vUv.y) * vec2(ar, 1.0);
  float freq = mix(5.0, 1.6, u_viscosity);
  vec2 w = vec2(mp_fbm(P * freq + uSeed), mp_fbm(P * freq + 5.2 + uSeed)) - 0.5;
  vec2 Pw = P + w * u_warp;
  int s = int(u_source + 0.5); vec2 c = u_center * vec2(ar, 1.0);
  float far = length(vec2(max(c.x, ar - c.x), max(c.y, 1.0 - c.y)));
  float g = s == 0 ? length(Pw - c) / far : s == 1 ? Pw.x / ar : mp_fbm(Pw * freq * 0.7 + 3.0) * 1.2 - 0.1;
  float m = g + (mp_fbm(Pw * freq * 2.2 + 9.0) - 0.5) * 0.18;
  float t = mix(-0.3, 1.5, uE); float sf = u_softness;
  float wv = smoothstep(m - sf, m + sf, t);
  float edge = 4.0 * wv * (1.0 - wv);
  vec2 refr = w * 0.015 * edge;
  vec3 col = mix(A(vUv).rgb, B(mp_mirror(vUv + refr)).rgb, wv);
  col = mix(col, u_edgeTint, clamp(edge * u_tintAmt * 3.0, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`,

maskReveal: `
uniform vec2 uAnchor; uniform float u_hold; uniform float u_scaleTo; uniform float u_shadow;
float M(vec2 P){ if (P.x < 0.0 || P.y < 0.0 || P.x > 1.0 || P.y > 1.0) return 0.0; return texture2D(uMask, vec2(P.x, 1.0 - P.y)).r; }
void main(){
  float p = uP; vec2 P = vec2(vUv.x, 1.0 - vUv.y);
  float z = p < u_hold ? 0.0 : (p - u_hold) / (1.0 - u_hold);
  float sc = pow(u_scaleTo, pow(z, 2.2));
  vec2 mu = uAnchor + (P - uAnchor) / sc;
  float appear = smoothstep(0.0, max(u_hold * 0.6, 0.02), p);
  float m = M(mu) * appear;
  float sh = M(mu + vec2(-0.004, -0.007) / sc) * appear * u_shadow * (1.0 - z);
  vec3 a = A(vUv).rgb * (1.0 - sh * (1.0 - m));
  gl_FragColor = vec4(mix(a, B(vUv).rgb, max(m, smoothstep(0.93, 1.0, p))), 1.0);
}`,

push: `
uniform vec2 u_dir; uniform float u_parallax; uniform float u_shadow;
void main(){
  vec2 d = vec2(u_dir.x, -u_dir.y); float e = uE; vec2 ad = abs(d); float sg = d.x + d.y;
  vec2 qa = vUv + d * e * (1.0 - u_parallax);
  vec2 qb = vUv + d * (e - 1.0);
  float t = dot(qb, ad); bool inB = t >= 0.0 && t <= 1.0;
  if (inB){ gl_FragColor = vec4(B(qb).rgb, 1.0); return; }
  float dist = sg > 0.0 ? -t : t - 1.0;
  vec3 ca = A(mp_mirror(qa)).rgb * (1.0 - 0.45 * e * min(u_parallax * 4.0, 1.0));
  ca *= 1.0 - u_shadow * exp(-dist * 30.0) * step(0.001, e);
  gl_FragColor = vec4(ca, 1.0);
}`,

swipeUp: `
uniform float u_radius; uniform float u_scaleA; uniform float u_scaleB; uniform float u_dim;
float rbox(vec2 pp, vec2 hb, float r){ vec2 b = hb - r; return length(max(abs(pp) - b, 0.0)) + min(max(abs(pp).x - b.x, abs(pp).y - b.y), 0.0) - r; }
void main(){
  float e = uE; vec2 P = vUv;
  float sB = mix(u_scaleB, 1.0, smoothstep(0.35, 1.0, e)); vec2 cB = vec2(0.5, 0.5 - (1.0 - e) * 1.04);
  float sA = mix(1.0, u_scaleA, e); vec2 cA = vec2(0.5, 0.5 + e * 0.06);
  float rr = u_radius * uRes.y * (1.0 - smoothstep(0.75, 1.0, e)); float rA = u_radius * uRes.y * smoothstep(0.0, 0.3, e);
  float dB = rbox((P - cB) * uRes, 0.5 * uRes * sB, rr), dA = rbox((P - cA) * uRes, 0.5 * uRes * sA, rA);
  vec3 bg = vec3(0.02);
  vec3 ca = mix(A((P - cA) / sA + 0.5).rgb * (1.0 - u_dim * e), bg, smoothstep(-0.75, 0.75, dA));
  float shadow = exp(-max(dB, 0.0) / (0.03 * uRes.y)) * 0.55 * step(0.001, e);
  ca *= 1.0 - shadow;
  float inB = 1.0 - smoothstep(-0.75, 0.75, dB);
  gl_FragColor = vec4(mix(ca, B((P - cB) / sB + 0.5).rgb, inB), 1.0);
}`,

spin: `
uniform float u_turns; uniform float u_zoom; uniform float u_blur; uniform vec2 u_center; uniform float u_ccw;
vec3 rs(float which, vec2 uv, vec2 c, float ang, float z){ float ar = aspect(); vec2 q = rot2((uv - c) * vec2(ar, 1.0), -ang) / z; return S(which, mp_mirror(c + q / vec2(ar, 1.0))); }
void main(){
  vec2 c = tl(u_center); float sg = u_ccw > 0.5 ? 1.0 : -1.0; float full = 2.0 * PI * u_turns * sg;
  float z = 1.0 + (u_zoom - 1.0) * sin(PI * uP);
  float vel = sin(PI * uP); float spread = u_blur * vel * 0.35 * u_turns;
  float which = uP < uCut ? 0.0 : 1.0; float ang = which < 0.5 ? full * uE : full * (uE - 1.0);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 12; i++){ float k = (float(i) / 11.0 - 0.5) * spread; acc += rs(which, vUv, c, ang + k, z); }
  gl_FragColor = vec4(acc / 12.0, 1.0);
}`,

pagePeel: `
uniform float u_from; uniform float u_radius; uniform float u_backTint; uniform float u_shadow;
void main(){
  float ar = aspect(); vec2 P = vec2(vUv.x * ar, vUv.y); int f = int(u_from + 0.5);
  vec2 O; vec2 far;
  if (f == 0){ O = vec2(ar, 0.0); far = vec2(0.0, 1.0); } else if (f == 1){ O = vec2(0.0, 0.0); far = vec2(ar, 1.0); }
  else if (f == 2){ O = vec2(ar, 1.0); far = vec2(0.0, 0.0); } else if (f == 3){ O = vec2(0.0, 1.0); far = vec2(ar, 0.0); }
  else if (f == 4){ O = vec2(ar, 0.5); far = vec2(0.0, 0.5); } else { O = vec2(0.0, 0.5); far = vec2(ar, 0.5); }
  vec2 n = normalize(far - O); float sMax = dot(far - O, n); float R = u_radius;
  float L = uE * (sMax + 1.6 * R + 0.01);
  float s = dot(P - O, n);
  vec3 col = vec3(0.0); bool done = false;
  if (s >= L){
    float s0 = 2.0 * L - PI * R - s; vec2 P0 = P - n * (s - s0);
    if (s0 >= 0.0 && P0.x >= 0.0 && P0.x <= ar && P0.y >= 0.0 && P0.y <= 1.0){ col = mix(A(vec2(P0.x / ar, P0.y)).rgb, vec3(0.97), u_backTint) * 0.92; done = true; }
  }
  if (!done && s > L - R && s < L){
    float th = PI - asin(clamp((L - s) / R, 0.0, 1.0)); float s0 = L - th * R; vec2 P0 = P - n * (s - s0);
    if (s0 >= 0.0 && P0.x >= 0.0 && P0.x <= ar && P0.y >= 0.0 && P0.y <= 1.0){ col = mix(A(vec2(P0.x / ar, P0.y)).rgb, vec3(0.97), u_backTint) * (0.65 + 0.35 * sin(th)); done = true; }
  }
  if (!done && s > L - R && s < L){
    float th = asin(clamp((L - s) / R, 0.0, 1.0)); float s0 = L - th * R; vec2 P0 = P - n * (s - s0);
    if (s0 >= 0.0 && P0.x >= 0.0 && P0.x <= ar && P0.y >= 0.0 && P0.y <= 1.0){ col = A(vec2(P0.x / ar, P0.y)).rgb * (1.0 - 0.45 * th / (0.5 * PI)); done = true; }
  }
  if (!done && s >= L){ col = A(vUv).rgb; done = true; }
  if (!done){ col = B(vUv).rgb * (1.0 - u_shadow * exp(-max(L - s, 0.0) / (R * 0.9)) * step(0.0005, uE)); }
  gl_FragColor = vec4(col, 1.0);
}`,

pixelSort: `
uniform vec2 u_dir; uniform float u_length; uniform float u_threshold; uniform float u_jitter;
void main(){
  vec2 d = normalize(vec2(u_dir.x, -u_dir.y)); float inten = sin(PI * uP); float which = uP < uCut ? 0.0 : 1.0;
  vec2 perp = vec2(abs(d.y), abs(d.x)); float colI = floor(dot(vUv * uRes, perp) / 2.0);
  float h = mp_hash(vec2(colI, 3.0)); float len = u_length * inten * (1.0 - u_jitter + u_jitter * h);
  float thr = mix(1.0, u_threshold, inten);
  vec3 best = S(which, vUv); float bl = lum(best);
  for (int i = 1; i <= 24; i++){
    vec2 q = vUv - d * len * float(i) / 24.0; vec3 c = S(which, clamp(q, 0.0, 1.0)); float l = lum(c);
    if (l > thr && l > bl){ best = c; bl = l; }
  }
  gl_FragColor = vec4(best, 1.0);
}`,

dip: `
uniform vec3 u_color; uniform float u_hold;
void main(){
  float p = uP; float a0 = (1.0 - u_hold) * 0.5;
  float wo = smoothstep(0.0, a0, p), wi = 1.0 - smoothstep(a0 + u_hold, 1.0, p);
  vec3 c = p < 0.5 ? mix(A(vUv).rgb, u_color, wo) : mix(B(vUv).rgb, u_color, wi);
  gl_FragColor = vec4(c, 1.0);
}`,

dissolve: `
uniform float u_mode;
void main(){
  vec3 a = A(vUv).rgb, b = B(vUv).rgb; float e = uE; int m = int(u_mode + 0.5); vec3 c;
  if (m == 0) c = mix(a, b, e);
  else if (m == 1) c = pow(mix(pow(a, vec3(2.2)), pow(b, vec3(2.2)), e), vec3(1.0 / 2.2));
  else c = clamp(a * clamp(2.0 - 2.0 * e, 0.0, 1.0) + b * clamp(2.0 * e, 0.0, 1.0), 0.0, 1.0);
  gl_FragColor = vec4(c, 1.0);
}`,

blurCross: `
uniform float u_radius;
vec3 bl(float which, vec2 uv, float r){
  vec3 acc = vec3(0.0); vec2 k = vec2(uRes.y / uRes.x, 1.0);
  for (int i = 0; i < 24; i++){ float t = (float(i) + 0.5) / 24.0; float a = float(i) * 2.39996323; acc += S(which, uv + vec2(cos(a), sin(a)) * sqrt(t) * r * k); }
  return acc / 24.0;
}
void main(){ float r = u_radius * sin(PI * uP); float w = smoothstep(0.3, 0.7, uE);
  gl_FragColor = vec4(mix(bl(0.0, vUv, r), bl(1.0, vUv, r), w), 1.0); }`,

scalePunch: `
uniform float u_from; uniform float u_anticip; uniform float u_flash; uniform vec2 u_center;
void main(){
  vec2 c = tl(u_center); float p = uP; vec3 col;
  if (p < uCut){ float pa = p / uCut; float s = mix(1.0, u_anticip, pa * pa); col = A(c + (vUv - c) / s).rgb; }
  else { float pb = (p - uCut) / (1.0 - uCut); float s = mix(u_from, 1.0, outCubic(pb)); col = B(c + (vUv - c) / s).rgb; col += u_flash * pow(1.0 - pb, 3.0); }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};
Object.assign(SHADERS, SHADERS_X);   // 2026-10-13 expansion (lib/tx-shaders-x.js)
