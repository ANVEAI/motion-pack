/* motion-pack / layers: GLSL ES 3.00 shared chunks (hash, colour, grade). Pure strings, no DOM. Owned code.
   Determinism rule: no sin()-hash, no wall clock. Every random value is an integer PCG hash of (cell, frame, seed). */

export const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
`;

export const VERT = `${HEAD}
out vec2 vUv;
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }
`;

/* PCG integer hash (O'Neill) + uniform floats in [0,1). Frame-keyed, platform independent (32-bit uint wraparound). */
export const HASH = `
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
uint hash2(uint a, uint b){ return pcg(a ^ pcg(b + 0x9e3779b9u)); }
uint hash3(uint a, uint b, uint c){ return pcg(a ^ pcg(b + 0x9e3779b9u ^ pcg(c + 0x85ebca6bu))); }
float u01(uint h){ return float(h >> 8) * (1.0 / 16777216.0); }
float rnd2(uint a, uint b){ return u01(hash2(a, b)); }
float rnd3(uint a, uint b, uint c){ return u01(hash3(a, b, c)); }
`;

export const COLOR = `
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
vec3 enc(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 dec(vec3 c){ c = max(c, 0.0); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 hue2rgb(float h){ h = fract(h / 360.0) * 6.0; return clamp(vec3(abs(h - 3.0) - 1.0, 2.0 - abs(h - 2.0), 2.0 - abs(h - 4.0)), 0.0, 1.0); }
`;

/* Colour grade, display-referred, ONE closed-form function (mirror of layers/grade.js gradeRGB, same order):
   gain/white-balance -> contrast (normalised logistic about pivot) -> ASC CDL (slope, offset, power) -> saturation (Rec.709 luma)
   -> split-tone (luminance-neutral chroma shift, shadow/highlight weights) -> fade (black lift) -> clamp */
export const GRADE = `
uniform float uGradeOn;
uniform vec3  uGWB;                 // gain * white balance multipliers
uniform vec4  uGCon;                // k, pivot, f0, 1/(f1-f0)   (k==0: identity branch)
uniform vec3  uGSlope, uGOffset, uGPower;
uniform float uGSat;
uniform vec3  uGShadowT, uGHighT;   // luminance-neutral tint vectors already multiplied by their saturation
uniform float uGBal, uGFade;
vec3 gradeApply(vec3 c){
  if (uGradeOn < 0.5) return c;
  c = clamp(c * uGWB, 0.0, 1.0);
  if (uGCon.x != 0.0){ c = 1.0 / (1.0 + exp(-uGCon.x * (c - uGCon.y))); c = (c - uGCon.z) * uGCon.w; }
  c = clamp(pow(max(c * uGSlope + uGOffset, 0.0), uGPower), 0.0, 1.0);
  float l = dot(c, LUMA); c = clamp(vec3(l) + (c - vec3(l)) * uGSat, 0.0, 1.0);
  l = dot(c, LUMA);
  float ws = 1.0 - smoothstep(0.0, 0.55 + uGBal * 0.4, l), wh = smoothstep(0.45 + uGBal * 0.4, 1.0, l);
  c += uGShadowT * ws + uGHighT * wh;
  c = uGFade + c * (1.0 - uGFade);
  return clamp(c, 0.0, 1.0);
}
`;
