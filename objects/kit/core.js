/* motion-pack/objects/kit: extracted unchanged from ANVE's v9 launch-film studio kit (kit/core.js) on 2026-10-13; this copy is the one to edit. */
/* ANVE v9 studio kit: the render harness (renderer, post chain, camera rig, the renderAt(t) contract, boot).
   A scene calls runScene(def) once. def = {
     build(ctx)                       -> builds meshes (use ctx.add / the props.js builders). Runs once, after fonts.
     update(ctx, t, n, slot)          -> sets EVERYTHING from t (seconds, film = local); n = output frame (int, for quantised states).
     camera(ctx, t)                   -> { fov, elev, az, dist, target:[x,y,z], screen:[px,py], punch } (all in the config's units).
     focus(ctx, t)                    -> [x,y,z] world point the depth of field holds.
     preRender(ctx, t, slot)          -> optional: cube cameras etc., after update + camera, before the main render.
     drawType(ctx, g2d, t, n)         -> optional: the preview typography into a W x H canvas (skipped with ?notype=1).
   }
   Contract for scripts/render.mjs (spec-to-loop): window.CONFIG {fps, loopFrames, width, height, qaFrames, name}, __ready, __error,
   __gpu, renderAt(t), renderFrame(n, fps), captureFrame(n, fps), __hashFrame(n, fps), __hashAt(t). */
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { clamp, rad, kelvin } from './util.js';

export const JIT = [[-0.375, -0.125], [0.125, -0.375], [0.375, 0.125], [-0.125, 0.375]];   // rotated grid, quarter-pixel (px)
export const SHUTTER = [-0.1875, -0.0625, 0.0625, 0.1875];                                // 180-degree shutter centred on the frame

export function params() {
  const q = new URLSearchParams(location.search), sz = (q.get('size') || '').toLowerCase();
  const aspect = q.get('aspect') || (sz.includes('tall') ? 'tall' : 'wide');
  const notype = q.has('notype') || sz.includes('notype');
  const scale = q.has('scale') ? +q.get('scale') : (sz.includes('half') ? 0.5 : 1);
  return { q, aspect, notype, scale, W: Math.round((aspect === 'tall' ? 1080 : 1920) * scale), H: Math.round((aspect === 'tall' ? 1920 : 1080) * scale) };
}

/* soft shadows: 32-tap Vogel PCF (patched before the first compile; jittered light positions would otherwise stack hard copies) */
function patchShadows() {
  const sc = THREE.ShaderChunk.shadowmap_pars_fragment, a = sc.indexOf('#if defined( SHADOWMAP_TYPE_PCF )\n\t\t\tvec2 texelSize'), b = sc.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
  if (a < 0 || b < 0) { console.error('shadow chunk patch failed'); return; }
  THREE.ShaderChunk.shadowmap_pars_fragment = sc.slice(0, a) + `#if defined( SHADOWMAP_TYPE_PCF )
\t\t\tvec2 texelSize = vec2( 1.0 ) / shadowMapSize;
\t\t\tfloat ang0 = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
\t\t\tfloat acc = 0.0;
\t\t\tfor ( int i = 0; i < 32; i ++ ) { float fi = float( i ) + 0.5; float rr = sqrt( fi / 32.0 ); float aa = fi * 2.3999632 + ang0; acc += texture2DCompare( shadowMap, shadowCoord.xy + vec2( cos( aa ), sin( aa ) ) * rr * shadowRadius * texelSize, shadowCoord.z ); }
\t\t\tshadow = acc / 32.0;
\t\t` + sc.slice(b);
}

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function postMaterials(P, W, H, PX) {
  const sm = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
  const dof = sm(`precision highp float; uniform sampler2D tColor, tDepth; uniform float uNear, uFar, uFocus, uK, uMax; uniform vec2 uTexel; varying vec2 vUv;
#include <packing>
float vz(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
float cocOf(float z){ return clamp(uK * abs(z - uFocus) / z, 0.0, uMax); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){ vec3 base = texture2D(tColor, vUv).rgb; float z0 = vz(vUv), c0 = cocOf(z0); if (c0 < 0.4) { gl_FragColor = vec4(base, 1.0); return; }
  vec3 acc = base; float ws = 1.0; float rot = h21(gl_FragCoord.xy) * 6.2831853;
  for (int i = 0; i < 36; i++){ float fi = float(i) + 0.5; float rr = sqrt(fi / 36.0) * c0; float a = fi * 2.3999632 + rot; vec2 uv = vUv + vec2(cos(a), sin(a)) * rr * uTexel; float zs = vz(uv), cs = cocOf(zs); float ce = zs > z0 ? min(cs, c0) : cs; float w = clamp(ce - rr + 0.5, 0.0, 1.0); acc += texture2D(tColor, uv).rgb * w; ws += w; }
  gl_FragColor = vec4(acc / ws, 1.0); }`, { tColor: { value: null }, tDepth: { value: null }, uNear: { value: 1 }, uFar: { value: 100 }, uFocus: { value: 20 }, uK: { value: P.dofK * PX }, uMax: { value: P.dofMax * PX }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) } });
  const down = sm(`precision highp float; uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv; vec3 s(float x, float y){ return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }
void main(){ vec3 a = s(-2.,2.), b = s(0.,2.), c = s(2.,2.), d = s(-2.,0.), e = s(0.,0.), f = s(2.,0.), g = s(-2.,-2.), h = s(0.,-2.), i = s(2.,-2.), j = s(-1.,1.), k = s(1.,1.), l = s(-1.,-1.), m = s(1.,-1.);
  gl_FragColor = vec4(e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125, 1.0); }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const up = sm(`precision highp float; uniform sampler2D tLow, tHigh; uniform vec2 uTexel; uniform float uW; varying vec2 vUv; vec3 s(float x, float y){ return texture2D(tLow, vUv + vec2(x, y) * uTexel).rgb; }
void main(){ vec3 t = s(-1.,1.) + 2.*s(0.,1.) + s(1.,1.) + 2.*s(-1.,0.) + 4.*s(0.,0.) + 2.*s(1.,0.) + s(-1.,-1.) + 2.*s(0.,-1.) + s(1.,-1.); gl_FragColor = vec4(mix(texture2D(tHigh, vUv).rgb, t / 16.0, uW), 1.0); }`,
    { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() }, uW: { value: 0.5 } });
  const comp = sm(`precision highp float; uniform sampler2D tColor, tBloom, tSrc; uniform vec3 uWB; uniform float uExp, uBloom, uKnee, uVig, uAspect; varying vec2 vUv;
void main(){ vec3 sr = texture2D(tSrc, vUv).rgb; float inside = smoothstep(0.03, 0.30, max(sr.r, max(sr.g, sr.b)));
  vec3 c = texture2D(tColor, vUv).rgb + uBloom * texture2D(tBloom, vUv).rgb * (1.0 - inside); c *= uWB * uExp;
  vec3 u = clamp((c - uKnee) / (2.0 * (1.0 - uKnee)), 0.0, 1.0); c = mix(c, vec3(uKnee) + (1.0 - uKnee) * (1.0 - (1.0 - u) * (1.0 - u)), step(vec3(uKnee), c));
  vec2 q = vUv * 2.0 - 1.0; c *= 1.0 - uVig * smoothstep(0.35, 1.4142, length(q)); gl_FragColor = vec4(c, 1.0); }`,
    { tColor: { value: null }, tBloom: { value: null }, tSrc: { value: null }, uWB: { value: new THREE.Vector3(1, 1, 1) }, uExp: { value: 1 }, uBloom: { value: P.bloom }, uKnee: { value: P.shoulder }, uVig: { value: P.vignette }, uAspect: { value: W / H } });
  const fin = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `precision highp float; precision highp int; in vec2 vUv; out vec4 outColor;
uniform sampler2D s0, s1, s2, s3, tType; uniform vec4 uWt; uniform float uFlip, uGrain, uType; uniform uint uSeed;
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(uvec2 p, uint salt){ return float(pcg(p.x + pcg(p.y + pcg(salt)))) * (1.0 / 4294967295.0); }
vec3 enc(vec3 l){ return mix(l * 12.92, 1.055 * pow(max(l, vec3(0.0031308)), vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), l)); }
void main(){ vec2 uv = vec2(vUv.x, uFlip > 0.5 ? 1.0 - vUv.y : vUv.y);
  vec3 lin = texture(s0, uv).rgb * uWt.x + texture(s1, uv).rgb * uWt.y + texture(s2, uv).rgb * uWt.z + texture(s3, uv).rgb * uWt.w;
  vec3 c = enc(clamp(lin, 0.0, 1.0)); uvec2 px = uvec2(gl_FragCoord.xy);
  float g = rnd(px, uSeed) + rnd(px, uSeed + 7919u) - 1.0; float luma = dot(c, vec3(0.2126, 0.7152, 0.0722)); c += g * uGrain * (0.55 + 0.45 * (1.0 - abs(2.0 * luma - 1.0)));
  c += (rnd(px, 12345u) + rnd(px, 54321u) - 1.0) / 255.0;
  if (uType > 0.5) { vec4 L = texture(tType, vec2(uv.x, 1.0 - uv.y)); c = c * (1.0 - L.a) + L.rgb; }   // canvas is premultiplied, top row first
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`,
    uniforms: { s0: { value: null }, s1: { value: null }, s2: { value: null }, s3: { value: null }, tType: { value: null }, uType: { value: 0 }, uWt: { value: new THREE.Vector4(1, 0, 0, 0) }, uFlip: { value: 0 }, uSeed: { value: 0 }, uGrain: { value: P.grain } }, depthTest: false, depthWrite: false });
  return { dof, down, up, comp, fin };
}

/* fonts from kit/fonts through the FontFace API (no network; MIME-agnostic) */
export async function loadFonts() {
  const list = [['Manrope', 'Manrope-Variable.ttf', '200 800'], ['IBM Plex Mono', 'IBMPlexMono-Medium.ttf', '500'], ['IBM Plex Mono', 'IBMPlexMono-SemiBold.ttf', '600']];
  for (const [fam, file, weight] of list) {
    const buf = await (await fetch(new URL('./fonts/' + file, import.meta.url))).arrayBuffer();
    const ff = new FontFace(fam, buf, { weight, style: 'normal' }); await ff.load(); document.fonts.add(ff);
  }
  await document.fonts.ready;
  const ok = document.fonts.check('800 40px "Manrope"') && document.fonts.check('600 40px "IBM Plex Mono"');
  if (!ok) console.error('kit fonts did not load');
  return ok;
}

export async function runScene(def) {
  try {
    const C = window.CONFIG, P = C.grade, prm = params(), W = prm.W, H = prm.H, PX = Math.min(W, H) / 1080, FPS = C.fps, NF = C.loopFrames, LEN = NF / FPS;
    C.width = W; C.height = H; C.aspect = prm.aspect; C.notype = prm.notype;
    document.body.style.background = C.colors.backdrop;
    patchShadows();
    const canvas = document.createElement('canvas'); document.body.appendChild(canvas); canvas.width = W; canvas.height = H; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; renderer.setClearColor(0x000000, 1);
    RectAreaLightUniformsLib.init();
    { const gl = renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); window.__gpu = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; }
    const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, colorSpace: THREE.LinearSRGBColorSpace };
    const sceneRT = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, depthBuffer: true, samples: 4 }), bloomSrcRT = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, depthBuffer: true, samples: 4 });
    const depthRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, depthTexture: new THREE.DepthTexture(W, H, THREE.UnsignedIntType) });
    const dofRT = new THREE.WebGLRenderTarget(W, H, rtOpts), BL = 6, bloomDown = [], bloomUp = [];
    for (let i = 0; i < BL; i++) { const w = Math.max(2, W >> (i + 1)), h = Math.max(2, H >> (i + 1)); bloomDown.push(new THREE.WebGLRenderTarget(w, h, rtOpts)); bloomUp.push(new THREE.WebGLRenderTarget(w, h, rtOpts)); }
    const compRT = new THREE.WebGLRenderTarget(W, H, rtOpts), accRT = new THREE.WebGLRenderTarget(W, H, rtOpts);
    const outRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(20, W / H, 1, 200);
    const typeCanvas = document.createElement('canvas'); typeCanvas.width = W; typeCanvas.height = H;
    const typeTex = new THREE.CanvasTexture(typeCanvas); typeTex.colorSpace = THREE.NoColorSpace; typeTex.minFilter = typeTex.magFilter = THREE.NearestFilter; typeTex.generateMipmaps = false; typeTex.premultiplyAlpha = true; typeTex.flipY = false;
    const ctx = { THREE, C, P, W, H, PX, FPS, NF, LEN, aspect: prm.aspect, notype: prm.notype, scale: prm.scale, q: prm.q, renderer, scene, camera, typeCanvas, ALL: [], probes: {} };
    ctx.add = (parent, m, { cast = false, recv = true, decal = false, bloom = null, name = null } = {}) => { m.castShadow = cast; m.receiveShadow = recv; if (decal) m.userData.decal = true; if (bloom) m.userData.bloomMat = bloom; if (name) m.name = name; parent.add(m); return m; };
    ctx.K_KEY = kelvin(C.lights.key.kelvin);
    ctx.WB = new THREE.Vector3(1 / ctx.K_KEY[0], 1 / ctx.K_KEY[1], 1 / ctx.K_KEY[2]);
    const tmpC = new THREE.Color();
    ctx.emis = (hex, amt, k = ctx.K_KEY) => tmpC.set(hex).multiply(new THREE.Color().setRGB(k[0], k[1], k[2], THREE.LinearSRGBColorSpace)).multiplyScalar(amt / P.exposure).clone();   // pre-multiplied so the grade returns the design hex

    await loadFonts();
    await def.build(ctx);
    const PM = postMaterials(P, W, H, PX), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
    const runPass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, ortho); };
    const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking }), blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    PM.fin.uniforms.tType.value = typeTex;

    /* camera rig: orbit about a look-at point + lens shift (setViewOffset) so the look-at lands on a chosen pixel; jitter in [8],[9] */
    let baseProj = new THREE.Matrix4(), focusDist = 20;
    function rig(t, slot) {
      const c = def.camera(ctx, t), el = rad(c.elev), az = rad(c.az), d = c.dist * (1 - (c.punch || 0)), T = c.target;
      camera.position.set(T[0] + d * Math.sin(az) * Math.cos(el), T[1] + d * Math.sin(el), T[2] + d * Math.cos(az) * Math.cos(el));
      camera.up.set(0, 1, 0); camera.lookAt(T[0], T[1], T[2]);
      camera.fov = c.fov; camera.aspect = W / H; camera.near = c.near || 4; camera.far = c.far || 140;
      const sx = c.screen[0] * ctx.scale, sy = c.screen[1] * ctx.scale; camera.setViewOffset(W, H, W / 2 - sx, H / 2 - sy, W, H);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); baseProj.copy(camera.projectionMatrix);
      if (slot >= 0) { camera.projectionMatrix.elements[8] += (2 * JIT[slot][0]) / W; camera.projectionMatrix.elements[9] += (2 * JIT[slot][1]) / H; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); }
      const f = def.focus(ctx, t), fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); focusDist = new THREE.Vector3(...f).sub(camera.position).dot(fwd);
    }
    ctx.rig = rig;
    function drawSample(t, n, slot, target) {
      def.update(ctx, t, n, slot); rig(t, slot); scene.updateMatrixWorld(true);
      renderer.shadowMap.needsUpdate = true;
      if (def.preRender) def.preRender(ctx, t, slot);
      renderer.shadowMap.needsUpdate = true;
      scene.overrideMaterial = null; renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.render(scene, camera);
      const ALL = ctx.ALL;
      for (const m of ALL) if (m.userData.decal) m.visible = false;
      scene.overrideMaterial = depthMat; renderer.setRenderTarget(depthRT); renderer.clear(); renderer.render(scene, camera); scene.overrideMaterial = null;
      for (const m of ALL) if (m.userData.decal) m.visible = m.userData.vis !== false;
      const saved = ALL.map((m) => m.material); ALL.forEach((m) => { m.material = m.userData.bloomMat || blackMat; });
      const bg = scene.background; scene.background = null; renderer.setRenderTarget(bloomSrcRT); renderer.clear(); renderer.render(scene, camera); scene.background = bg;
      ALL.forEach((m, i) => { m.material = saved[i]; });
      PM.dof.uniforms.tColor.value = sceneRT.texture; PM.dof.uniforms.tDepth.value = depthRT.depthTexture; PM.dof.uniforms.uFocus.value = focusDist; PM.dof.uniforms.uNear.value = camera.near; PM.dof.uniforms.uFar.value = camera.far; runPass(PM.dof, dofRT);
      let src = bloomSrcRT, sw = W, sh = H; for (let i = 0; i < BL; i++) { PM.down.uniforms.tSrc.value = src.texture; PM.down.uniforms.uTexel.value.set(1 / sw, 1 / sh); runPass(PM.down, bloomDown[i]); src = bloomDown[i]; sw = src.width; sh = src.height; }
      let low = bloomDown[BL - 1]; for (let i = BL - 2; i >= 0; i--) { PM.up.uniforms.tLow.value = low.texture; PM.up.uniforms.tHigh.value = bloomDown[i].texture; PM.up.uniforms.uTexel.value.set(1 / low.width, 1 / low.height); runPass(PM.up, bloomUp[i]); low = bloomUp[i]; }
      PM.comp.uniforms.tColor.value = dofRT.texture; PM.comp.uniforms.tBloom.value = bloomUp[0].texture; PM.comp.uniforms.tSrc.value = bloomSrcRT.texture; PM.comp.uniforms.uWB.value.copy(ctx.WB); PM.comp.uniforms.uExp.value = P.exposure;
      runPass(PM.comp, target);
    }
    let typeKey = null;
    function drawType(t, n) {
      const on = !ctx.notype && !!def.drawType; PM.fin.uniforms.uType.value = on ? 1 : 0; if (!on) return;
      const key = n + ':' + t.toFixed(5); if (key === typeKey) return; typeKey = key;
      const g = typeCanvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.save(); def.drawType(ctx, g, t, n); g.restore(); typeTex.needsUpdate = true;
    }
    const accMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: 'uniform sampler2D tSrc; uniform float uW; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uW, 1.0); }',
      uniforms: { tSrc: { value: null }, uW: { value: 1 } }, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false });
    function accumulate(k, N) { if (k === 0) { renderer.setRenderTarget(accRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.setClearColor(0x000000, 1); } accMat.uniforms.tSrc.value = compRT.texture; accMat.uniforms.uW.value = 1 / N; const ac = renderer.autoClear; renderer.autoClear = false; runPass(accMat, accRT); renderer.autoClear = ac; }   // autoClear would turn the sum into a replace
    function resolve(weights, n, target, flip) {
      const F = PM.fin.uniforms; F.s0.value = accRT.texture; F.s1.value = accRT.texture; F.s2.value = accRT.texture; F.s3.value = accRT.texture;
      F.uWt.value.set(1, 0, 0, 0); F.uSeed.value = ((n % NF) + NF) % NF + 1; F.uFlip.value = flip ? 1 : 0;
      quad.material = PM.fin; renderer.setRenderTarget(target); renderer.render(quadScene, ortho); F.uFlip.value = 0;
    }
    const wrapT = (t) => t - Math.floor(t / LEN) * LEN;
    let last = { w: [1, 0, 0, 0], n: 0 };
    window.renderAt = (t) => { t = wrapT(t); const n = Math.floor(t * FPS + 1e-6), slot = clamp(Math.floor((t * FPS - n) * 4 + 1e-6), 0, 3); drawSample(t, n, slot, compRT); accumulate(0, 1); last = { w: [1, 0, 0, 0], n }; drawType(n / FPS, n); resolve(last.w, n, null, false); };
    /* frame n = N samples (N = 4, or def.subframes(n) for fast action) at t = (n + ((k + 0.5) / N - 0.5) * 0.5) / fps: a 180-degree shutter centred on the frame */
    window.renderFrame = (n, fps = FPS) => { const nf = Math.round(LEN * fps), nw = ((n % nf) + nf) % nf, N = def.subframes ? def.subframes(nw) : 4;
      for (let k = 0; k < N; k++) { drawSample((nw + ((k + 0.5) / N - 0.5) * 0.5) / fps, nw, k % 4, compRT); accumulate(k, N); }
      last = { w: [1, 0, 0, 0], n: nw }; drawType(nw / fps, nw); resolve(last.w, nw, null, false); };
    const readBuf = new Uint8Array(W * H * 4);
    function readTop() { resolve(last.w, last.n, outRT, true); renderer.readRenderTargetPixels(outRT, 0, 0, W, H, readBuf); renderer.setRenderTarget(null); return readBuf; }
    const b64 = (u8) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result.slice(fr.result.indexOf(',') + 1)); fr.readAsDataURL(new Blob([u8])); });
    const sha = async (u8) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
    window.captureFrame = (n, fps) => { window.renderFrame(n, fps); return b64(readTop()); };
    window.__hashFrame = (n, fps) => { window.renderFrame(n, fps); return sha(readTop()); };
    window.__hashAt = (t) => { window.renderAt(t); return sha(readTop()); };
    /* probes: world -> pixel (unjittered), mean of a pixel box of the last captured frame, screen bbox of a named object */
    window.__project = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(baseProj); return [(v.x * 0.5 + 0.5) * W, (1 - (v.y * 0.5 + 0.5)) * H]; };
    window.__mean = (x0, y0, x1, y1) => { let r = 0, g = 0, b = 0, c = 0; for (let y = Math.round(y0); y < y1; y++) for (let x = Math.round(x0); x < x1; x++) { const i = (y * W + x) * 4; r += readBuf[i]; g += readBuf[i + 1]; b += readBuf[i + 2]; c++; } return [r / c, g / c, b / c].map((v) => +v.toFixed(1)); };
    window.__bbox = (obj) => { const bb = new THREE.Box3().setFromObject(obj, true); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; if (bb.isEmpty()) return null; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { const p = window.__project(x, y, z); x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return [x0, y0, x1, y1].map(Math.round); };
    window.__layout = (t) => { def.update(ctx, t, Math.floor(t * FPS + 1e-6), 0); rig(t, -1); scene.updateMatrixWorld(true); const out = {}; for (const [k, o] of Object.entries(ctx.probes)) out[k] = o.visible === false ? null : window.__bbox(o); return out; };
    window.__ctx = ctx; ctx.dbg = { sceneRT, dofRT, bloomSrcRT, bloomUp, compRT, accRT, outRT, PM };
    /* boot: collect meshes, warm up every program, ready */
    scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) ctx.ALL.push(o); });
    window.renderAt(0); renderer.getContext().finish();
    window.__ready = true;
    if (prm.q.has('t')) window.renderAt(parseFloat(prm.q.get('t')));
    else if (!prm.q.has('norun')) { let n = 0; const loop = () => { window.renderFrame(n); n = (n + 1) % NF; requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  } catch (err) { window.__error = String((err && err.stack) || err); console.error(window.__error); window.__ready = true; }
}
