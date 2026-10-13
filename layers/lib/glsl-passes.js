/* motion-pack / layers: the render passes of the Finisher (pre -> bright/down -> up -> composite) and the OverlayLayer program. Owned code. */
import { HEAD, HASH, COLOR, GRADE } from './glsl-common.js';
import { COMMON_U, GRAIN, VIGNETTE, LEAKS, DUST, BOKEH, GLOW, PAPER, RETRO } from './glsl-fx.js';

/* PRE: weave / flicker, lens, glitch slices, VHS tracking, lateral chromatic aberration; source is SRGB8_ALPHA8 (hardware linearised) -> linear RGBA16F */
export const FRAG_PRE = `${HEAD}${HASH}${COLOR}${COMMON_U}
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc;
uniform float uK1, uK2, uCAcorner, uCAhit, uExpo, uWeaveScale; uniform vec2 uWeave;
uniform float uGlitch;                                   // 0..1 envelope (beat / cut triggered)
uniform float uVhsChroma, uVhsTrackY, uVhsTrackH, uVhsTrackAmt, uVhsHead;
vec3 samp(vec2 uv){ return texture(uSrc, uv).rgb; }
vec3 vhsSamp(vec2 uv){
  if (uVhsChroma <= 0.0) return samp(uv);
  vec3 yc = samp(uv); float y = dot(yc, LUMA); vec3 cb = vec3(0.0);
  for (int i = -4; i <= 4; i++){ vec3 s = samp(uv + vec2(float(i) * uVhsChroma * uPX / 4.0 / uRes.x, 0.0)); cb += s - vec3(dot(s, LUMA)); }
  cb /= 9.0; return vec3(y) + mix(yc - vec3(y), cb, 0.85);
}
void main(){
  vec2 uv = vUv;
  uv = 0.5 + (uv - 0.5) / uWeaveScale + uWeave;
  vec2 A = vec2(uAspect, 1.0); vec2 q = (uv - 0.5) * A; float rc2 = dot(A * 0.5, A * 0.5); float r2 = dot(q, q) / rc2;
  if (uK1 != 0.0 || uK2 != 0.0){ q *= (1.0 + uK1 * r2 + uK2 * r2 * r2) / (1.0 + max(uK1 + uK2, 0.0)); uv = q / A + 0.5; }
  if (uGlitch > 0.0){                                    // horizontal slice displacement, 3..5 bands, quantised to 2-frame holds
    float bands = 4.0; float row = floor(uv.y * 24.0); uint k = hash3(uint(row), uint(uFrame / 2), uSeed + 600u);
    float on = step(0.72, u01(k)) * uGlitch; uv.x += on * (u01(pcg(k)) - 0.5) * 2.0 * 60.0 * uPX / uRes.x;
  }
  if (uVhsTrackAmt > 0.0){
    float d = uv.y - uVhsTrackY; if (d > 0.0 && d < uVhsTrackH){ uint k = hash3(uint(uv.y * uRes.y), uint(uFrame), uSeed + 900u); uv.x += (u01(k) - 0.5) * 2.0 * uVhsTrackAmt * uPX / uRes.x * (1.0 - d / uVhsTrackH); }
  }
  if (uVhsHead > 0.0 && gl_FragCoord.y < 8.0 * uPX){ uint k = hash3(uint(gl_FragCoord.y / uPX), uint(uFrame), uSeed + 901u); uv.x += (u01(k) - 0.5) * 2.0 * uVhsHead * uPX / uRes.x; }
  vec3 c;
  vec2 dpx = (uv - 0.5) * uRes; float shiftPx = uCAcorner * r2 + uCAhit * (0.4 + 0.6 * sqrt(r2)) + uGlitch * 6.0 * uPX;
  if (shiftPx > 0.02){
    vec2 off = normalize(dpx + 1e-4) * shiftPx / uRes; float rr = 0.0, gg = 0.0, bb = 0.0; vec3 s;
    for (int i = 0; i < 3; i++){ float f = 0.6 + 0.4 * float(i); rr += vhsSamp(uv + off * 0.5 * f).r; bb += vhsSamp(uv - off * 0.5 * f).b; }
    gg = vhsSamp(uv).g; c = vec3(rr / 3.0, gg, bb / 3.0);
  } else c = vhsSamp(uv);
  c *= uExpo;
  o = vec4(c, 1.0);
}`;

/* DOWN: 13-tap (Jimenez) downsample; the optional bright-pass (soft knee on the display-referred max channel) is applied per tap */
export const FRAG_DOWN = `${HEAD}
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uPx; uniform vec3 uThr;
vec3 B(vec3 c){ if (uThr.z < 0.5) return c; float L = max(c.r, max(c.g, c.b)); float Le = pow(max(L, 1e-5), 1.0 / 2.2); float kn = max(uThr.y, 1e-4);
  float rq = clamp(Le - uThr.x + kn, 0.0, 2.0 * kn); rq = rq * rq / (4.0 * kn); return c * (max(rq, Le - uThr.x) / max(Le, 1e-4)); }
vec3 T(vec2 d){ return B(texture(uTex, vUv + d * uPx).rgb); }
void main(){
  vec3 a = T(vec2(-2,2)), b = T(vec2(0,2)), c = T(vec2(2,2)), d = T(vec2(-1,1)), e = T(vec2(1,1)), f = T(vec2(-2,0)), g = T(vec2(0,0)), h = T(vec2(2,0)),
       i = T(vec2(-1,-1)), j = T(vec2(1,-1)), k = T(vec2(-2,-2)), l = T(vec2(0,-2)), m = T(vec2(2,-2));
  o = vec4((d + e + i + j) * 0.125 + (a + b + f + g) * 0.03125 + (b + c + g + h) * 0.03125 + (f + g + k + l) * 0.03125 + (g + h + l + m) * 0.03125, 1.0);
}`;

/* UP: out = high * wHigh + tent9(low) */
export const FRAG_UP = `${HEAD}
in vec2 vUv; out vec4 o;
uniform sampler2D uLow, uHigh; uniform vec2 uPx; uniform float uWHigh, uWLow;
void main(){
  vec3 s = texture(uLow, vUv + uPx * vec2(-1,-1)).rgb + 2.0 * texture(uLow, vUv + uPx * vec2(0,-1)).rgb + texture(uLow, vUv + uPx * vec2(1,-1)).rgb
         + 2.0 * texture(uLow, vUv + uPx * vec2(-1,0)).rgb + 4.0 * texture(uLow, vUv).rgb + 2.0 * texture(uLow, vUv + uPx * vec2(1,0)).rgb
         + texture(uLow, vUv + uPx * vec2(-1,1)).rgb + 2.0 * texture(uLow, vUv + uPx * vec2(0,1)).rgb + texture(uLow, vUv + uPx * vec2(1,1)).rgb;
  o = vec4(s / 16.0 * uWLow + texture(uHigh, vUv).rgb * uWHigh, 1.0);
}`;

/* COMPOSITE: linear-light fx -> encode -> grade -> paper -> vignette -> scan -> story type -> dust -> grain -> brand -> bars -> dither */
export const FRAG_COMPOSITE = `${HEAD}${HASH}${COLOR}${COMMON_U}${GRADE}${GRAIN}${VIGNETTE}${LEAKS}${DUST}${BOKEH}${GLOW}${PAPER}${RETRO}
in vec2 vUv; out vec4 o;
uniform sampler2D uBase, uBloom, uHala, uDiff, uType, uBrand;
uniform float uBloomAmt, uHalaAmt, uHalaCore, uDiffAmt, uDiffLift, uSharpAmt, uSharpPx, uLeakOn, uBokOn, uGlowOn, uHasType, uHasBrand, uDither, uVhsLift, uVhsSat;
uniform vec3 uBloomTint, uHalaTint;
void main(){
  vec2 uv = vUv, fc = gl_FragCoord.xy; vec3 c = texture(uBase, uv).rgb;
  if (uSharpAmt > 0.0){ vec2 d = uSharpPx * uPX / uRes; vec3 avg = 0.25 * (texture(uBase, uv + vec2(d.x, 0.0)).rgb + texture(uBase, uv - vec2(d.x, 0.0)).rgb + texture(uBase, uv + vec2(0.0, d.y)).rgb + texture(uBase, uv - vec2(0.0, d.y)).rgb); c = max(c + uSharpAmt * (c - avg), 0.0); }
  if (uBloomAmt > 0.0) c += texture(uBloom, uv).rgb * uBloomTint * uBloomAmt;
  if (uHalaAmt > 0.0){ vec3 h = texture(uHala, uv).rgb; c += h * (uHalaTint * uHalaAmt + vec3(uHalaCore * uHalaAmt)); }
  if (uDiffAmt > 0.0){ vec3 d = texture(uDiff, uv).rgb; c = mix(c, d, uDiffAmt) + uDiffLift * (1.0 - c); }
  if (uLeakOn > 0.5){ vec3 l = clamp(leaksCol(uv), 0.0, 1.0); c = 1.0 - (1.0 - min(c, 1.0)) * (1.0 - l); }
  if (uBokOn > 0.5) c += dec(bokehCol(uv));
  if (uGlowOn > 0.5) c += dec(glowCol(uv));
  vec3 d = enc(c);
  d = gradeApply(d);
  d *= paperMul(fc);
  if (uVhsSat != 1.0 || uVhsLift > 0.0){ float l = dot(d, LUMA); d = vec3(l) + (d - vec3(l)) * uVhsSat; d = mix(d, vec3(0.5, 0.45, 0.55), uVhsLift) ; }
  d = vignetteApply(d, uv);
  d = scanApply(d, fc);
  if (uHasType > 0.5){ vec4 t = texture(uType, uv); d = d * (1.0 - t.a) + t.rgb; }
  d = dustApply(d, fc);
  d = grainApply(d, fc);
  if (uHasBrand > 0.5){ vec4 t = texture(uBrand, uv); d = d * (1.0 - t.a) + t.rgb; }
  d *= barsMask(uv);
  if (uDither > 0.5) d = ditherApply(d, fc);
  o = vec4(clamp(d, 0.0, 1.0), 1.0);
}`;

/* OVERLAY: one procedural layer per canvas, premultiplied RGBA for CSS mix-blend-mode compositing in HyperFrames (see overlay.js for the blend table) */
export const FRAG_OVERLAY = `${HEAD}${HASH}${COLOR}${COMMON_U}${GRAIN}${VIGNETTE}${LEAKS}${DUST}${BOKEH}${GLOW}${PAPER}${RETRO}
in vec2 vUv; out vec4 o;
uniform int uKind; uniform float uUnder;     // under = assumed plate luma for dust polarity (0 dark plate -> white marks, 1 bright plate -> dark marks)
void main(){
  vec2 uv = vUv, fc = gl_FragCoord.xy; vec4 r = vec4(0.0);
  if (uKind == 0){ vec3 n = grainApply(vec3(0.5), fc) ; r = vec4(clamp(n, 0.0, 1.0), 1.0); }                       // overlay-blend on a mid-grey canvas
  else if (uKind == 1){ float a = uVigAmt * smoothstep(uVigIn, uVigOut, length(((uv - 0.5) * 2.0) * vec2(mix(1.0, uAspect, uVigRound), 1.0)) * 1.41421356 / length(vec2(mix(1.0, uAspect, uVigRound), 1.0))); r = vec4(uVigColor * a, a); }
  else if (uKind == 2) r = vec4(enc(clamp(leaksCol(uv), 0.0, 1.0)), 1.0);                                           // screen
  else if (uKind == 3){ vec2 m = dustMarks(fc, uUnder); r = vec4(vec3(m.x) * m.y, m.y); }                           // normal
  else if (uKind == 4) r = vec4(enc(clamp(bokehCol(uv), 0.0, 1.0)), 1.0);                                           // screen
  else if (uKind == 5) r = vec4(enc(clamp(glowCol(uv), 0.0, 1.0)), 1.0);                                            // screen
  else if (uKind == 6) r = vec4(clamp(paperMul(fc), 0.0, 1.0), 1.0);                                                // multiply
  else if (uKind == 7){ vec3 s = scanApply(vec3(1.0), fc); float a = 1.0 - min(s.r, min(s.g, s.b)); r = vec4(vec3(0.0), a); }   // normal (black lines)
  else if (uKind == 8){ float m = barsMask(uv); r = vec4(vec3(0.0), 1.0 - m); }                                      // normal
  o = r;
}`;

/* COPY / flat colour helper used for self-tests */
export const FRAG_COPY = `${HEAD}
in vec2 vUv; out vec4 o; uniform sampler2D uTex; void main(){ o = texture(uTex, vUv); }`;
