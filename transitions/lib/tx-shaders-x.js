/* motion-pack / transitions / lib / tx-shaders-x.js
   Expansion set (2026-10-13): 24 more owned GL transitions. Same contract as tx-shaders.js (PRELUDE helpers, uE eased
   progress, uCut swap point, u_<param> uniforms, endpoints drawn as passthrough by the runner).
   Every shader here was written for this pack. The effect ideas come from the MIT-licensed gl-transitions collection
   (gl-transitions.com); the original author of each idea is credited in the registry entry (`credit`). No shader source
   was copied: the maths below is our own (ray-cast cube, hex grid, venetian slats, page fold, etc.). */

export const SHADERS_X = {
ripple: `
uniform float u_amp; uniform float u_freq; uniform vec2 u_center;
void main(){
  vec2 c = tl(u_center); vec2 d = vUv - c; d.x *= aspect(); float r = length(d), e = uE;
  float w = sin(r * u_freq - e * 24.0) * u_amp * sin(PI * e);
  vec2 o = (r > 1e-4 ? d / r : vec2(0.0)) * w; o.x /= aspect();
  vec2 uv = mp_mirror(vUv + o);
  gl_FragColor = vec4(mix(A(uv).rgb, B(uv).rgb, smoothstep(0.3, 0.7, e)), 1.0);
}`,

swirl: `
uniform float u_radius; uniform float u_turns; uniform vec2 u_center;
void main(){
  vec2 c = tl(u_center); vec2 d = vUv - c; d.x *= aspect(); float r = length(d), k = sin(PI * uE);
  if (r < u_radius){ float q = (u_radius - r) / u_radius; d = rot2(d, q * q * k * u_turns * 2.0 * PI); }
  d.x /= aspect(); vec2 uv = mp_mirror(c + d);
  gl_FragColor = vec4(mix(A(uv).rgb, B(uv).rgb, smoothstep(0.35, 0.65, uE)), 1.0);
}`,

crossWarp: `
uniform vec2 u_dir;
void main(){
  vec2 v = normalize(vec2(u_dir.x, -u_dir.y) + 1e-6); float s = clamp(dot(vUv - 0.5, v) + 0.5, 0.0, 1.0);
  float x = smoothstep(0.0, 1.0, uE * 2.0 + s - 1.0);
  vec3 a = A((vUv - 0.5) * (1.0 - x) + 0.5).rgb, b = B((vUv - 0.5) * x + 0.5).rgb;
  gl_FragColor = vec4(mix(a, b, x), 1.0);
}`,

directionalWarp: `
uniform vec2 u_dir; uniform float u_soft;
void main(){
  vec2 v = normalize(vec2(u_dir.x, -u_dir.y) + 1e-6); v /= abs(v.x) + abs(v.y);
  float d = dot(v, vec2(0.5));
  float m = 1.0 - smoothstep(-u_soft, 0.0, dot(v, vUv) - (d - 0.5 + uE * (1.0 + u_soft)));
  vec3 a = A((vUv - 0.5) * (1.0 - m) + 0.5).rgb, b = B((vUv - 0.5) * m + 0.5).rgb;
  gl_FragColor = vec4(mix(a, b, m), 1.0);
}`,

cube: `
uniform float u_persp; uniform float u_zoom; uniform vec3 u_bg; uniform float u_shade;
/* ray-cast a unit cube turning about the vertical axis: face A (front) leaves left, face B (right side) arrives */
void main(){
  float th = uE * 0.5 * PI, z = 1.0 + u_zoom * sin(PI * uE);
  vec2 sp = (vUv - 0.5) * z + 0.5;                     /* zoom out a little mid-turn so the edges show */
  float D = u_persp; vec2 O = vec2(0.0, -0.5 - D);      /* camera, relative to cube centre (x, z) */
  vec2 R = vec2(sp.x - 0.5, D);                         /* ray hits the screen plane z = -0.5 at s = 1 */
  float c = cos(th), s = sin(th);
  vec2 Ol = vec2(O.x * c - O.y * s, O.x * s + O.y * c), Rl = vec2(R.x * c - R.y * s, R.x * s + R.y * c);
  float best = 1e9; vec3 col = u_bg;
  if (abs(Rl.y) > 1e-6){ float t = (-0.5 - Ol.y) / Rl.y; float x = Ol.x + t * Rl.x; float y = 0.5 + t * (sp.y - 0.5);
    if (t > 0.0 && abs(x) <= 0.5 && y >= 0.0 && y <= 1.0){ best = t; col = A(vec2(x + 0.5, y)).rgb * mix(1.0, c, u_shade); } }
  if (abs(Rl.x) > 1e-6){ float t = (0.5 - Ol.x) / Rl.x; float zz = Ol.y + t * Rl.y; float y = 0.5 + t * (sp.y - 0.5);
    if (t > 0.0 && t < best && abs(zz) <= 0.5 && y >= 0.0 && y <= 1.0){ col = B(vec2(zz + 0.5, y)).rgb * mix(1.0, s, u_shade); } }
  gl_FragColor = vec4(col, 1.0);
}`,

doorway: `
uniform float u_depth; uniform vec3 u_bg;
void main(){
  float e = uE, a = e * 0.5 * PI, w = 0.5 * cos(a), x = vUv.x; vec3 col;
  float sc = mix(u_depth, 1.0, e); vec2 bu = (vUv - 0.5) / sc + 0.5;
  col = (bu.x >= 0.0 && bu.x <= 1.0 && bu.y >= 0.0 && bu.y <= 1.0) ? B(bu).rgb : u_bg;
  if (x < w){ float f = x / max(w, 1e-4); float h = 1.0 + 0.35 * sin(a) * f; float y = (vUv.y - 0.5) / h + 0.5;
    if (y >= 0.0 && y <= 1.0) col = A(vec2(f * 0.5, y)).rgb * (1.0 - 0.5 * sin(a) * f); }
  if (x > 1.0 - w){ float f = (1.0 - x) / max(w, 1e-4); float h = 1.0 + 0.35 * sin(a) * f; float y = (vUv.y - 0.5) / h + 0.5;
    if (y >= 0.0 && y <= 1.0) col = A(vec2(1.0 - f * 0.5, y)).rgb * (1.0 - 0.5 * sin(a) * f); }
  gl_FragColor = vec4(col, 1.0);
}`,

kaleido: `
uniform float u_segments; uniform float u_spin;
void main(){
  float k = sin(PI * uE); vec2 d = vUv - 0.5; d.x *= aspect();
  float r = length(d), an = atan(d.y, d.x) + u_spin * k * PI, sg = 2.0 * PI / max(u_segments, 2.0);
  an = mod(an, sg); an = min(an, sg - an); vec2 kd = vec2(cos(an), sin(an)) * r * (1.0 - 0.25 * k); kd.x /= aspect();
  vec2 ku = mp_mirror(kd + 0.5); float w = smoothstep(0.4, 0.6, uE);
  vec3 a = mix(A(vUv).rgb, A(ku).rgb, k), b = mix(B(vUv).rgb, B(ku).rgb, k);
  gl_FragColor = vec4(mix(a, b, w), 1.0);
}`,

hexagonalize: `
uniform float u_size;
vec2 hexC(vec2 p){ vec2 r = vec2(1.0, 1.7320508), h = r * 0.5; vec2 a = mod(p, r) - h, b = mod(p - h, r) - h; return p - (dot(a, a) < dot(b, b) ? a : b); }
void main(){
  float s = u_size * pow(sin(PI * uE), 1.5); vec2 uv = vUv;
  if (s > 0.0015){ vec2 q = vec2(vUv.x * aspect(), vUv.y) / s; vec2 c = hexC(q) * s; uv = clamp(vec2(c.x / aspect(), c.y), 0.0, 1.0); }
  gl_FragColor = vec4(mix(A(uv).rgb, B(uv).rgb, smoothstep(0.42, 0.58, uE)), 1.0);
}`,

windowSlice: `
uniform float u_count; uniform float u_soft; uniform float u_vertical;
void main(){
  float x = u_vertical > 0.5 ? 1.0 - vUv.y : vUv.x;
  float pr = smoothstep(-u_soft, 0.0, x - uE * (1.0 + u_soft));
  float s = step(pr, fract(u_count * x));
  gl_FragColor = vec4(mix(A(vUv).rgb, B(vUv).rgb, s), 1.0);
}`,

blinds: `
uniform float u_count; uniform float u_vertical; uniform vec3 u_gap; uniform float u_shade;
void main(){
  float y = u_vertical > 0.5 ? vUv.x : 1.0 - vUv.y, n = u_count, i = floor(y * n), f = fract(y * n);
  float k = uP < uCut ? 1.0 - uE / max(uCut, 1e-4) : (uE - uCut) / max(1.0 - uCut, 1e-4); k = clamp(k, 0.0, 1.0);
  float dy = abs(f - 0.5) * 2.0; vec3 col = u_gap;
  if (dy <= k){ float f2 = 0.5 + (f - 0.5) / max(k, 1e-3); float sy = (i + f2) / n; vec2 uv = u_vertical > 0.5 ? vec2(sy, vUv.y) : vec2(vUv.x, 1.0 - sy);
    col = (uP < uCut ? A(uv).rgb : B(uv).rgb) * mix(1.0, 0.55 + 0.45 * k, u_shade) * (1.0 - u_shade * 0.25 * dy); }
  gl_FragColor = vec4(col, 1.0);
}`,

squeeze: `
uniform float u_split; uniform float u_vertical;
void main(){
  bool v = u_vertical > 0.5; float y = v ? vUv.x : vUv.y, k;
  bool first = uP < uCut; k = first ? 1.0 - uE / max(uCut, 1e-4) : (uE - uCut) / max(1.0 - uCut, 1e-4); k = clamp(k, 0.0, 1.0);
  float sy = (y - 0.5) / max(k, 1e-3) + 0.5; vec3 col = vec3(0.0);
  if (sy >= 0.0 && sy <= 1.0){ float o = u_split * (1.0 - k);
    vec2 uv = v ? vec2(sy, vUv.y) : vec2(vUv.x, sy), dd = v ? vec2(o, 0.0) : vec2(0.0, o);
    col = first ? vec3(A(uv + dd).r, A(uv).g, A(uv - dd).b) : vec3(B(uv + dd).r, B(uv).g, B(uv - dd).b); }
  gl_FragColor = vec4(col, 1.0);
}`,

polkaDots: `
uniform float u_dots; uniform vec2 u_center; uniform float u_soft;
void main(){
  vec2 g = vec2(vUv.x * aspect(), vUv.y) * u_dots; float d = length(fract(g) - 0.5);
  float r = uE / max(distance(vUv, tl(u_center)), 0.04) * 0.5;
  float m = 1.0 - smoothstep(r - u_soft, r + u_soft, d); if (uE >= 0.999) m = 1.0;
  gl_FragColor = vec4(mix(A(vUv).rgb, B(vUv).rgb, m), 1.0);
}`,

tvStatic: `
uniform float u_hold; uniform float u_roll;
void main(){
  float a0 = uCut - u_hold * 0.5, a1 = uCut + u_hold * 0.5; vec3 col;
  if (uP < a0) col = A(vUv).rgb; else if (uP > a1) col = B(vUv).rgb;
  else { float fr = floor(uP * uDur * 30.0); float n = mp_hash(floor(vUv * uRes / 2.0) + fr * 7.31);
    float band = smoothstep(0.0, 0.08, abs(fract(vUv.y - fr * u_roll * 0.13) - 0.5)); col = vec3(n) * (0.65 + 0.35 * band); }
  float edge = 1.0 - smoothstep(0.0, 0.06, min(abs(uP - a0), abs(uP - a1)));
  col = mix(col, vec3(mp_hash(vUv * uRes + uP * 97.0)), edge * 0.6);
  gl_FragColor = vec4(col, 1.0);
}`,

burnOut: `
uniform vec2 u_center; uniform vec3 u_color; uniform float u_wave; uniform float u_glow;
void main(){
  vec2 c = tl(u_center); vec2 d = vUv - c; d.x *= aspect();
  float n = mp_fbm(vUv * vec2(aspect(), 1.0) * 4.0) * u_wave + 0.04 * sin(atan(d.y, d.x) * 7.0 + uE * 6.0) * u_wave;
  float v = length(d) / 1.15 + n - uE * (1.0 + u_wave + 0.15); float m = smoothstep(0.0, 0.03, v);
  vec3 col = mix(B(vUv).rgb, A(vUv).rgb, m);
  float rim = exp(-abs(v) * 28.0) * u_glow * sin(PI * uE); col += u_color * rim * 1.6 + vec3(1.0, 0.9, 0.7) * pow(rim, 3.0);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,

dreamyZoom: `
uniform float u_rot; uniform float u_scale; uniform float u_glow;
void main(){
  float e = uE, r = radians(u_rot), w = smoothstep(0.3, 0.7, e);
  vec2 d = vUv - 0.5; d.x *= aspect();
  vec2 da = rot2(d, r * e) / mix(1.0, u_scale, e), db = rot2(d, -r * (1.0 - e)) / mix(1.0, u_scale, 1.0 - e);
  da.x /= aspect(); db.x /= aspect();
  vec3 col = mix(A(mp_mirror(da + 0.5)).rgb, B(mp_mirror(db + 0.5)).rgb, w);
  col = col + u_glow * sin(PI * e) * (col * col + 0.08);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,

linearBlur: `
uniform float u_amount; uniform float u_angle;
vec3 lb(float which, float r){ vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * vec2(uRes.y / uRes.x, 1.0) * r; vec3 acc = vec3(0.0);
  for (int i = 0; i < 20; i++){ float t = float(i) / 19.0 - 0.5; acc += S(which, mp_mirror(vUv + dir * t)); } return acc / 20.0; }
void main(){ float r = u_amount * sin(PI * uP); gl_FragColor = vec4(mix(lb(0.0, r), lb(1.0, r), smoothstep(0.35, 0.65, uE)), 1.0); }`,

gridFlip: `
uniform vec2 u_grid; uniform float u_rand; uniform float u_gap; uniform vec3 u_bg;
void main(){
  vec2 g = u_grid, cell = floor(vUv * g), f = fract(vUv * g);
  float dl = mp_hash(cell + 3.1) * u_rand, lp = clamp((uE - dl) / (1.0 - u_rand), 0.0, 1.0);
  float sx = abs(cos(PI * lp)), x = (f.x - 0.5) / max(sx, 1e-3) + 0.5; vec3 col = u_bg;
  float pad = u_gap * sin(PI * uE);
  if (x >= pad && x <= 1.0 - pad && f.y >= pad && f.y <= 1.0 - pad){ vec2 uv = (cell + vec2(x, f.y)) / g;
    col = (lp < 0.5 ? A(uv).rgb : B(uv).rgb) * (0.7 + 0.3 * sx); }
  gl_FragColor = vec4(col, 1.0);
}`,

bookFlip: `
uniform float u_bend; uniform float u_shadow;
void main(){
  float th = uE * PI, c = cos(th), s = sin(th), x = vUv.x; vec3 col;
  vec3 under = x > 0.5 ? B(vUv).rgb : A(vUv).rgb;  /* right half shows B once the page lifts; left half keeps A until it lands */
  col = under;
  if (c > 0.0 && x > 0.5){ float w = 0.5 * c, f = (x - 0.5) / max(w, 1e-4);
    if (f <= 1.0){ float h = 1.0 + u_bend * s * f; float y = (vUv.y - 0.5) / h + 0.5;
      col = (y >= 0.0 && y <= 1.0) ? A(vec2(0.5 + f * 0.5, y)).rgb * (1.0 - 0.35 * s) : B(vUv).rgb; }
    else col = B(vUv).rgb * (1.0 - u_shadow * s * exp(-(f - 1.0) * 4.0)); }
  if (c < 0.0 && x < 0.5){ float w = -0.5 * c, f = (0.5 - x) / max(w, 1e-4);
    if (f <= 1.0){ float h = 1.0 + u_bend * s * f; float y = (vUv.y - 0.5) / h + 0.5;
      col = (y >= 0.0 && y <= 1.0) ? B(vec2(0.5 - f * 0.5, y)).rgb * (1.0 - 0.35 * s) : A(vUv).rgb; }
    else col = A(vUv).rgb * (1.0 - u_shadow * s * exp(-(f - 1.0) * 4.0)); }
  gl_FragColor = vec4(col, 1.0);
}`,

pinwheel: `
uniform float u_blades; uniform vec2 u_center; uniform float u_soft;
void main(){
  vec2 d = vUv - tl(u_center); d.x *= aspect(); float an = atan(d.x, d.y) / (2.0 * PI) + 0.5;
  float f = fract(an * u_blades); float m = 1.0 - smoothstep(uE - u_soft, uE + u_soft, f * (1.0 - 2.0 * u_soft) + u_soft);
  if (uE >= 0.999) m = 1.0;
  gl_FragColor = vec4(mix(A(vUv).rgb, B(vUv).rgb, m), 1.0);
}`,

radial: `
uniform vec2 u_center; uniform float u_start; uniform float u_soft; uniform float u_ccw;
void main(){
  vec2 d = vUv - tl(u_center); d.x *= aspect(); float an = atan(d.x, d.y);
  float f = fract((u_ccw > 0.5 ? -an : an) / (2.0 * PI) + 0.5 - u_start / 360.0);
  float m = 1.0 - smoothstep(uE * (1.0 + u_soft) - u_soft, uE * (1.0 + u_soft), f);
  gl_FragColor = vec4(mix(A(vUv).rgb, B(vUv).rgb, m), 1.0);
}`,

waterDrop: `
uniform float u_amp; uniform float u_speed; uniform vec2 u_center;
void main(){
  vec2 d = vUv - tl(u_center); d.x *= aspect(); float r = length(d), e = uE, R = e * 1.25;
  vec3 col;
  if (r > R) col = mix(A(vUv).rgb, B(vUv).rgb, e * e);
  else { vec2 o = (r > 1e-4 ? d / r : vec2(0.0)) * sin(r * u_amp - e * u_speed) * 0.02 * (1.0 - e); o.x /= aspect();
    col = mix(A(mp_mirror(vUv + o)).rgb, B(mp_mirror(vUv + o * 0.5)).rgb, smoothstep(0.0, 0.6, e)); }
  float ring = exp(-abs(r - R) * 90.0) * sin(PI * e) * 0.25; col += ring;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,

wind: `
uniform float u_size; uniform float u_rows; uniform vec2 u_dir;
void main(){
  bool vert = abs(u_dir.y) > abs(u_dir.x); float along = vert ? (u_dir.y > 0.0 ? 1.0 - vUv.y : vUv.y) : (u_dir.x > 0.0 ? vUv.x : 1.0 - vUv.x);
  float row = floor((vert ? vUv.x : vUv.y) * u_rows), r = mp_hash(vec2(row, 7.0));
  float m = smoothstep(0.0, -u_size, along * (1.0 - u_size) + u_size * r - uE * (1.0 + u_size));
  float sm = (1.0 - m) * m * 4.0; vec2 sh = (vert ? vec2(0.0, sign(u_dir.y)) : vec2(-sign(u_dir.x), 0.0)) * sm * 0.03 * r;
  gl_FragColor = vec4(mix(A(mp_mirror(vUv + sh)).rgb, B(vUv).rgb, m), 1.0);
}`,

luminanceMelt: `
uniform float u_drip; uniform float u_dark;
void main(){
  float e = uE, col_n = mp_noise(vec2(vUv.x * 60.0, 3.0)), fall = e * e * u_drip * (0.35 + 0.65 * col_n);
  vec2 su = vec2(vUv.x, min(1.0, vUv.y + fall)); vec3 a = A(su).rgb; float l = lum(a);
  float keep = u_dark > 0.5 ? l : 1.0 - l;            /* u_dark: dark areas hold longest; else bright ones do */
  float m = smoothstep(keep - 0.08, keep + 0.08, e * 1.16 - 0.08 + 0.1 * col_n * e);
  gl_FragColor = vec4(mix(a, B(vUv).rgb, m), 1.0);
}`,

overexposure: `
uniform float u_strength; uniform vec3 u_tint;
vec3 tm(vec3 x){ return 1.0 - exp(-x); }
void main(){
  float k = bellp(uP, uCut) * u_strength, ex = exp2(k * 6.0);
  vec3 src = uP < uCut ? A(vUv).rgb : B(vUv).rgb; vec3 lin = pow(src, vec3(2.2)) * ex;
  vec3 col = pow(tm(lin * 1.6) / tm(vec3(1.6)), vec3(1.0 / 2.2)); col = mix(col, u_tint, smoothstep(0.6, 1.0, k) * 0.5);
  gl_FragColor = vec4(clamp(mix(src, col, smoothstep(0.0, 0.15, k)), 0.0, 1.0), 1.0);
}`,

ditherDissolve: `
uniform float u_cell; uniform float u_matrix; uniform vec3 u_color; uniform float u_band; uniform float u_sweep; uniform vec2 u_dir; uniform float u_jitter;
/* Bayer index of block c for a 2^k matrix, normalised to (0, 1): sum over bits i (finest first) of 4^(k-1-i) * (2 (x_i xor y_i) + y_i) */
float mp_bayer(vec2 c, float k){ float v = 0.0;
  for (int i = 0; i < 3; i++){ float fi = float(i); if (fi >= k) break; float s = pow(2.0, fi);
    float xb = mod(floor(c.x / s), 2.0), yb = mod(floor(c.y / s), 2.0); v += pow(4.0, k - 1.0 - fi) * (abs(xb - yb) * 2.0 + yb); }
  return (v + 0.5) / pow(4.0, k); }
void main(){
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes; float cs = max(1.0, floor(u_cell * uRes.y / 1080.0 + 0.5));
  vec2 c = floor(px / cs), q = (c + 0.5) * cs / uRes; float dd = 0.5 * (abs(u_dir.x) + abs(u_dir.y));
  float ramp = dd > 0.0 ? clamp(dot(q - 0.5, u_dir) / dd * 0.5 + 0.5, 0.0, 1.0) : 0.5;
  float v = mix(mix(mp_bayer(c, u_matrix + 2.0), ramp, u_sweep), mp_hash(c), u_jitter), a = v * (1.0 - u_band);
  vec3 col = uE < a ? A(vUv).rgb : (uE < a + u_band ? u_color : B(vUv).rgb);
  gl_FragColor = vec4(col, 1.0);
}`,
};
