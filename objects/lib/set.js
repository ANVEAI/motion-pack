/* PROVENANCE: extracted from the ANVE v9 studio kit's kit/props.js (env, slab, slab fx, blob shadow, studio lights) + the ANVE v10 film set's src/desk.js (desk, room rig, env scaler) (2026-10-13). Behaviour unchanged unless noted; see objects/README.md. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, kelvin, clickLevel, rad } from '../kit/util.js';
import { v3, linCol, std, canvasTex, softRectTex } from './mat.js';
const lumNorm = (hex) => { const c = new THREE.Color(hex); return c.multiplyScalar(1 / (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b)); };

/* ---------- the studio environment: an analytic warm studio sphere baked to cube maps ----------
   fill  -> PMREM -> scene.environment (IBL for every PBR material; no black panel)
   chrome-> cube texture used as the far background inside reflection cube cameras (adds the camera-side black panel + a strip) */
export function makeStudioEnv(ctx, o) {
  const { renderer } = ctx, S = new THREE.Scene(), paper = new THREE.Color(o.paper);
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { uTint: { value: new THREE.Vector3(...(o.tint || [1, 1, 1])) }, uPaper: { value: new THREE.Vector3(paper.r, paper.g, paper.b) }, uFloor: { value: o.floor }, uCeil: { value: o.ceil }, uTop: { value: o.top }, uSide: { value: o.side }, uChrome: { value: 0 }, uCamAz: { value: o.camAz }, uStrip: { value: o.strip || 3.0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uPaper, uTint; uniform float uFloor, uCeil, uTop, uSide, uChrome, uCamAz, uStrip; varying vec3 vDir;
float band(float x, float a, float b, float s){ return smoothstep(a - s, a + s, x) * (1.0 - smoothstep(b - s, b + s, x)); }
float wrapA(float a){ return atan(sin(a), cos(a)); }
void main(){ vec3 d = normalize(vDir); float el = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, d.z); vec3 warm = vec3(1.0, 0.972, 0.93), c;
  float hz = smoothstep(-0.04, 0.04, d.y);                                     // soft horizon
  c = mix(uPaper * uFloor * mix(1.0, 0.78, smoothstep(0.0, -1.0, d.y)), warm * uCeil * mix(1.0, 0.72, max(d.y, 0.0)), hz);
  c += warm * uTop * smoothstep(0.80, 1.15, el);                                  // overhead bank
  c += warm * uSide * band(wrapA(az - uCamAz + 1.05), -0.48, 0.48, 0.12) * band(el, 0.04, 0.80, 0.10);
  if (uChrome > 0.5) {   // calm chrome: big soft panels, one soft dark side toward the camera, no hard strips
    float cam = smoothstep(0.85, 0.20, abs(wrapA(az - uCamAz))) * smoothstep(-0.30, 0.12, el) * (1.0 - smoothstep(0.50, 0.95, el));
    c = mix(c, warm * 0.06, 0.80 * cam);
    c += warm * uStrip * band(wrapA(az - uCamAz + 0.95), -0.42, 0.42, 0.20) * band(el, 0.10, 0.85, 0.18);   // key bank, front-left
    c += warm * uStrip * 0.7 * band(wrapA(az - uCamAz - 2.30), -0.38, 0.38, 0.20) * band(el, 0.05, 0.70, 0.18);   // back-right bank
  }
  gl_FragColor = vec4(c * uTint, 1.0); }` });
  S.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat));
  const setLv = (lv) => { mat.uniforms.uFloor.value = lv.floor; mat.uniforms.uCeil.value = lv.ceil; mat.uniforms.uTop.value = lv.top; mat.uniforms.uSide.value = lv.side; };
  const bake = (chrome) => { mat.uniforms.uChrome.value = chrome; setLv(chrome ? { ...o, ...(o.chrome || {}) } : o); const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: false }); const cc = new THREE.CubeCamera(0.1, 50, rt); cc.update(renderer, S); return rt; };
  const fillRT = bake(0), chromeRT = bake(1), pmrem = new THREE.PMREMGenerator(renderer);
  const fillPM = pmrem.fromCubemap(fillRT.texture);
  ctx.scene.environment = fillPM.texture;
  return { fillRT, chromeRT, fillPM, pmrem };
}

/* ---------- backdrop + floating slab ---------- */
export function makeSet(ctx, o) {
  const { scene } = ctx;
  const floor = ctx.add(scene, new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std(o.paper, { roughness: 1.0 })), { recv: true, name: 'floor' });
  floor.rotation.x = -Math.PI / 2; floor.position.y = o.floorY;
  const under = ctx.add(scene, new THREE.Mesh(new THREE.PlaneGeometry(o.w * 2.05, o.d * 2.05), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: softRectTex(), transparent: true, opacity: o.underShadow, depthWrite: false })), { recv: false, decal: true });
  under.rotation.x = -Math.PI / 2; under.position.y = o.floorY + 0.004;
  const slabG = new THREE.Group(); scene.add(slabG);
  const slab = ctx.add(slabG, new THREE.Mesh(new RoundedBoxGeometry(o.w, o.h, o.d, 4, o.r), std(o.slab, { roughness: 0.8 })), { cast: true, recv: true, name: 'slab' });
  slab.position.y = -o.h / 2;
  return { floor, under, slabG, slab, setDip(y) { slabG.position.y = y; under.material.opacity = o.underShadow * (1 + 0.6 * y); } };
}

/* flat decals on the slab top driven by shaders (slab-local x/z):
   ring + perimeter: alpha-blended in the design colour (a glowing line has to TINT a white slab; additive light on white is invisible)
   glow: additive (light), a soft falloff around a rectangle (the box band's spill) */
export function makeSlabFx(ctx, parent, o) {
  const u = { uRing: { value: new THREE.Vector4(0, 0, 0, 0) /* cx, cz, radius, alpha */ }, uRingW: { value: o.ringW }, uEdge: { value: 0 }, uEdgeW: { value: o.edgeW },
    uHalf: { value: new THREE.Vector2(o.w / 2, o.d / 2) }, uRad: { value: o.r }, uCol: { value: new THREE.Color() }, uGlow: { value: new THREE.Vector4(0, 0, 0.5, 0.5) /* cx, cz, hx, hz */ }, uGlowA: { value: 0 }, uGlowCol: { value: new THREE.Color() } };
  const vs = 'varying vec2 vP; void main(){ vP = position.xy * vec2(1.0, -1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const sd = 'float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }';
  const lineMat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, vertexShader: vs,
    fragmentShader: `uniform vec4 uRing; uniform float uRingW, uEdge, uEdgeW, uRad; uniform vec2 uHalf; uniform vec3 uCol; varying vec2 vP; ${sd}
void main(){ float dRect = sdRR(vP, uHalf, uRad); if (dRect > 0.0) discard;
  float ring = uRing.w * smoothstep(uRingW, uRingW * 0.25, abs(length(vP - uRing.xy) - uRing.z));
  float edge = uEdge * smoothstep(uEdgeW, uEdgeW * 0.3, -dRect - 0.014);
  float a = clamp(max(ring, edge), 0.0, 1.0); if (a < 0.002) discard; gl_FragColor = vec4(uCol, a); }` });
  const glowMat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: vs,
    fragmentShader: `uniform vec4 uGlow; uniform float uGlowA, uRad; uniform vec2 uHalf; uniform vec3 uGlowCol; varying vec2 vP; ${sd}
void main(){ if (sdRR(vP, uHalf, uRad) > 0.0) discard; float g = sdRR(vP - uGlow.xy, uGlow.zw, 0.06); gl_FragColor = vec4(uGlowCol * uGlowA * exp(-max(g, 0.0) / 0.20) * step(0.0, g), 1.0); }` });
  const geo = new THREE.PlaneGeometry(o.w, o.d);
  const glow = ctx.add(parent, new THREE.Mesh(geo, glowMat), { recv: false, decal: true, bloom: glowMat }); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.002; glow.renderOrder = 2;
  const line = ctx.add(parent, new THREE.Mesh(geo, lineMat), { recv: false, decal: true, bloom: lineMat }); line.rotation.x = -Math.PI / 2; line.position.y = 0.003; line.renderOrder = 3;
  return { mesh: line, glow, u };
}
/* soft dark ellipse on the slab top (anticipation / contact shadow) */
export function makeBlobShadow(ctx, parent, w, d) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: softRectTex(60, 34), transparent: true, opacity: 0, depthWrite: false });
  const m = ctx.add(parent, new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat), { recv: false, decal: true }); m.rotation.x = -Math.PI / 2; m.position.y = 0.0015; m.renderOrder = 1;
  return m;
}

/* ---------- the three lights that click on (+ a glint). FIXTURE-FREE by default: the key is an off-screen directional, the rim and
   top are shadowed spots from off-frame; the click reads through the light itself (shadows, a pool on the slab, a violet edge,
   highlights on the chrome). L.fixtures = true adds a visible rim strip on a tripod + a top lamp on a boom (legacy look). ---------- */
export function makeStudioLights(ctx, slabG, L) {
  const { scene } = ctx, fixtures = !!L.fixtures, FEET = [], rods = [], metal = std('#161616', { roughness: 0.45, metalness: 0.3 });
  const kc = linCol(kelvin(L.key.kelvin)), tc = linCol(kelvin(L.top.kelvin)), rc = new THREE.Color(L.rim.color); rc.multiplyScalar(1 / (0.2126 * rc.r + 0.7152 * rc.g + 0.0722 * rc.b));   // luminance-normalised: cd means luminous
  const K = L.key, kDir = v3(...K.dir).normalize(), KT = v3(...K.target);
  const key = new THREE.DirectionalLight(kc, 0); scene.add(key); scene.add(key.target); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 40 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = K.shadowRadius || 9;
  const spot = (col, o, mapSize) => { const l = new THREE.SpotLight(col, 0, 0, (o.coneDeg / 2) * Math.PI / 180, o.penumbra ?? 1.0, 2); scene.add(l); scene.add(l.target); l.castShadow = true; l.shadow.mapSize.set(mapSize, mapSize); l.shadow.bias = -0.0003; l.shadow.normalBias = 0.02; l.shadow.radius = o.shadowRadius || 8; l.shadow.camera.near = 0.3; l.shadow.camera.far = 20; return l; };
  const R = L.rim, T = L.top, rim = spot(rc, R, 2048), top = spot(tc, T, 2048);
  let rimFaceMat = null, rimFace = null, lensRimMat = null, lensRim = null, lensMat = null, lens = null, lamp = null, rimG = null;
  if (fixtures) {
    const feetMat = std('#111111', { roughness: 0.8 });
    const cyl = (parent, a, b, r, mat = metal, cast = true) => { const d = new THREE.Vector3().subVectors(b, a), len = d.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize()); rods.push(m); return ctx.add(parent, m, { cast }); };
    const tripod = (cx, cz, topY, spread, legTop, phase) => { cyl(slabG, v3(cx, 0.03, cz), v3(cx, topY, cz), 0.022); for (let i = 0; i < 3; i++) { const a = phase + (i * 2 * Math.PI) / 3, fx = cx + spread * Math.sin(a), fz = cz + spread * Math.cos(a); cyl(slabG, v3(cx, legTop, cz), v3(fx, 0.03, fz), 0.014); const ft = ctx.add(slabG, new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), feetMat), { cast: true }); ft.position.set(fx, 0.03, fz); rods.push(ft); FEET.push([fx, fz]); } };
    tripod(R.stand[0], R.stand[1], R.pos[1] - R.size[1] / 2 - 0.05, 0.3, 0.5, 1.1);
    rimG = new THREE.Group(); rimG.position.set(...R.pos); slabG.add(rimG); rimG.lookAt(v3(...R.aim)); rimG.updateMatrixWorld(true);
    ctx.add(rimG, new THREE.Mesh(new THREE.BoxGeometry(R.size[0] + 0.1, R.size[1] + 0.1, 0.1), std('#161616', { roughness: 0.6 }))).position.z = -0.052;
    rimFaceMat = new THREE.MeshStandardMaterial({ color: '#5a5862', roughness: 0.9, emissive: 0x000000 }); rimFace = ctx.add(rimG, new THREE.Mesh(new THREE.PlaneGeometry(R.size[0], R.size[1]), rimFaceMat), { bloom: new THREE.MeshBasicMaterial({ color: 0x000000 }) }); rimFace.position.z = 0.003;
    lamp = new THREE.Group(); lamp.position.set(...T.pos); slabG.add(lamp); lamp.lookAt(v3(...T.aim)); lamp.updateMatrixWorld(true);
    { const rd = v3(...(T.rod || [0, 1, 0])).normalize(); cyl(slabG, v3(...T.pos).addScaledVector(rd, 9), v3(...T.pos).addScaledVector(rd, 0.2), 0.02, metal, false); }
    { const hood = ctx.add(lamp, new THREE.Mesh(new THREE.CylinderGeometry(T.r, T.r * 0.8, 0.5, 32, 1, true), std('#161616', { roughness: 0.5, side: THREE.DoubleSide }))); hood.rotation.x = Math.PI / 2; }
    lensRimMat = new THREE.MeshStandardMaterial({ color: '#4b4f55', roughness: 0.4, emissive: 0x000000 }); lensRim = ctx.add(lamp, new THREE.Mesh(new THREE.TorusGeometry(T.r, 0.035, 12, 48), lensRimMat), { bloom: new THREE.MeshBasicMaterial({ color: 0x000000 }) }); lensRim.position.z = 0.25;
    lensMat = new THREE.MeshStandardMaterial({ color: '#555a61', roughness: 0.3, emissive: 0x000000 }); lens = ctx.add(lamp, new THREE.Mesh(new THREE.CircleGeometry(T.r * 0.92, 32), lensMat), { bloom: new THREE.MeshBasicMaterial({ color: 0x000000 }) }); lens.position.z = 0.246;
    for (const f of FEET) if (Math.abs(f[0]) > L.slabHalf[0] - 0.03 || Math.abs(f[1]) > L.slabHalf[1] - 0.03) console.error('tripod foot off the slab', f);
  }
  const glint = new THREE.RectAreaLight(linCol(kelvin(L.glint.kelvin)), 0, L.glint.size[0], L.glint.size[1]); scene.add(glint);
  const keyRight = new THREE.Vector3().crossVectors(kDir, v3(0, 1, 0)).normalize(), keyUp = new THREE.Vector3().crossVectors(keyRight, kDir).normalize();
  const em = (hex, amt, k) => ctx.emis(hex, amt, k), rDir = v3(...R.aim).sub(v3(...R.pos)).normalize(), tDir = v3(...T.aim).sub(v3(...T.pos)).normalize();
  return {
    key, rim, top, glint, lamp, rimG, FEET, rods,
    /* n = output frame (clicks are quantised to it), slot = subframe (soft key), dip = slab bob, glintX = [x, level] or null */
    update(n, slot, dip = 0, glintX = null) {
      const kL = clickLevel(n, K.click), rL = clickLevel(n, R.click), tL = clickLevel(n, T.click), JX = [-0.6, 0.2, 0.6, -0.2][slot], JY = [-0.2, -0.45, 0.2, 0.45][slot];
      key.position.copy(KT).addScaledVector(kDir, 12).addScaledVector(keyRight, JX * 12 * K.softness * 0.5).addScaledVector(keyUp, JY * 12 * K.softness * 0.5); key.target.position.copy(KT); key.intensity = K.intensity * kL;
      rim.intensity = R.cd * rL; rim.position.set(R.pos[0], R.pos[1] + dip, R.pos[2]).addScaledVector(rDir, fixtures ? 0.06 : 0); rim.target.position.set(R.aim[0], R.aim[1] + dip, R.aim[2]);
      top.intensity = T.cd * tL; top.position.set(T.pos[0], T.pos[1] + dip, T.pos[2]).addScaledVector(tDir, fixtures ? 0.25 : 0); top.target.position.set(T.aim[0], T.aim[1] + dip, T.aim[2]);
      if (fixtures) {
        rimFaceMat.emissive.copy(em('#b9a6ff', R.face * rL, [1, 1, 1])); rimFace.userData.bloomMat.color.copy(em(R.color, R.face * 0.9 * rL, [1, 1, 1]));
        lensRimMat.emissive.copy(em('#cfe0ff', 2.6 * tL, kelvin(T.kelvin))); lensRim.userData.bloomMat.color.copy(em('#cfe0ff', 3.5 * tL, kelvin(T.kelvin)));
        lensMat.emissive.copy(em('#ffffff', T.face * tL, kelvin(T.kelvin))); lens.userData.bloomMat.color.copy(em('#ffffff', T.face * 0.6 * tL, kelvin(T.kelvin)));
      }
      if (glintX === null) glint.intensity = 0; else { glint.intensity = L.glint.nits * glintX[1]; glint.position.set(glintX[0], L.glint.y, L.glint.z); glint.lookAt(glintX[0] * 0.3, L.glint.y - 0.4, 0); }
      return { kL, rL, tL };
    },
  };
}

/* desk spans x0..x1 (desk-local), depth d, height h; floating above the paper floor; the under-shadow matches its aspect */
export function makeDesk(ctx, o) {
  const { scene } = ctx, len = o.x1 - o.x0, cx = (o.x0 + o.x1) / 2;
  const floor = ctx.add(scene, new THREE.Mesh(new THREE.PlaneGeometry(600, 600), std(o.paper, { roughness: 1.0 })), { recv: true, name: 'floor' });
  floor.rotation.x = -Math.PI / 2; floor.position.y = o.floorY;
  const UW = len + o.d * 1.05, UD = o.d * 2.05, TW = 2048, TH = Math.max(64, Math.round(2048 * UD / UW));
  const blur = 26 * (TH / 512) * 1.0, mx = (o.d * 0.52 / UW) * TW, my = TH * 0.215;
  const shTex = canvasTex(TW, TH, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, TW, TH); g.filter = `blur(${blur.toFixed(1)}px)`; g.fillStyle = '#fff'; g.beginPath(); g.roundRect(mx, my, TW - 2 * mx, TH - 2 * my, Math.min(22, TH * 0.04)); g.fill(); }, false);
  const under = ctx.add(scene, new THREE.Mesh(new THREE.PlaneGeometry(UW, UD), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shTex, transparent: true, opacity: o.underShadow, depthWrite: false })), { recv: false, decal: true });
  under.rotation.x = -Math.PI / 2; under.position.set(cx, o.floorY + 0.004, 0);
  const deskG = new THREE.Group(); scene.add(deskG);
  const slab = ctx.add(deskG, new THREE.Mesh(new RoundedBoxGeometry(len, o.h, o.d, 4, o.r), std(o.slab, { roughness: 0.8 })), { cast: true, recv: true, name: 'desk' });
  slab.position.set(cx, -o.h / 2, 0);
  return { floor, under, deskG, slab, cx, len, setDip(y) { deskG.position.y = y; under.material.opacity = o.underShadow * (1 + 0.6 * y); } };
}

/* the ROOM LIGHT rig. L = { key, rim, top, back, glint } presets (kit values). update(n, slot, S) with S = {
     at: desk-local x the light centres on, spread 0..1 (key footprint: one zone .. the whole desk), key 0..1, pool 0..1 (top pool),
     tension 0..1, solution 0..1, handoff 0..1, back 0..1, clicks: [frames] (rim gel flicker), on: { key, rim, top } frames, dip, glint: [x, level] | null }
   Key = the kit's soft directional key (2.5, jittered per subframe), its 4096 shadow frustum (+-5 units) centred on `at`, opening to +-16
   with the spread (the wide). Idle zones read low-key through the top pool and the rim, which stay on `at`; dim the key for a wide. Problem: cool key (+1100 K x tension) + RED rim (9 + 19 x tension cd).
   Solution: warm key (-300 K) + VIOLET rim (11 cd). Neutral (both 0) = the v9 s1 look (violet rim 11 cd, key 4300 K). */
export function makeRig(ctx, L) {
  const { scene } = ctx, K = L.key, kDir = v3(...K.dir).normalize(), keyRight = new THREE.Vector3().crossVectors(kDir, v3(0, 1, 0)).normalize(), keyUp = new THREE.Vector3().crossVectors(keyRight, kDir).normalize();
  const spot = (o, mapSize, shadow = true) => { const l = new THREE.SpotLight(0xffffff, 0, 0, rad(o.coneDeg / 2), o.penumbra ?? 1.0, 2); scene.add(l); scene.add(l.target); l.castShadow = shadow;
    if (shadow) { l.shadow.mapSize.set(mapSize, mapSize); l.shadow.bias = -0.0003; l.shadow.normalBias = 0.02; l.shadow.radius = o.shadowRadius || 8; l.shadow.camera.near = 0.5; l.shadow.camera.far = 80; } return l; };
  const key = new THREE.DirectionalLight(0xffffff, 0); scene.add(key); scene.add(key.target); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 60 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = K.shadowRadius || 9;
  let frustum = 5;
  const rim = spot(L.rim, 2048), top = spot(L.top, 2048), back = spot(L.back, 512, false);
  const glint = new THREE.RectAreaLight(linCol(kelvin(L.glint.kelvin)), 0, L.glint.size[0], L.glint.size[1]); scene.add(glint);
  const RED = lumNorm(L.rim.red), VIO = lumNorm(L.rim.color), tc = linCol(kelvin(L.top.kelvin));
  const flick = (n, list) => { let k = 1; for (const f of list || []) { const d = n - f; if (d >= 0 && d < 3) k = [0.95, 0.12, 0.70][d]; } return k; };
  return {
    key, rim, top, back, glint,
    update(n, slot, S) {
      const h = clamp(S.handoff || 0), live = (1 - h) * (1 - h), at = S.at || 0, dip = S.dip || 0, sp = clamp(S.spread || 0);
      const on = S.on || {}, kL = clickLevel(n, on.key ?? -99), rL = clickLevel(n, on.rim ?? -99), tL = clickLevel(n, on.top ?? -99);
      const ten = clamp(S.tension || 0), sol = clamp(S.solution || 0);
      // key: Kelvin from the story state; distance + cone open with the spread (illuminance held: cd = 2.5 x d^2)
      const kel = 4300 + 1100 * ten * (1 - sol) - 300 * sol; key.color.copy(linCol(kelvin(kel)));
      const T = v3(at, lerp(K.target[1], 0.0, sp), lerp(K.target[2], 0.0, sp)), d = lerp(12, 30, sp);
      const JX = [-0.6, 0.2, 0.6, -0.2][slot] * K.softness * 0.5 * 12, JY = [-0.2, -0.45, 0.2, 0.45][slot] * K.softness * 0.5 * 12;
      key.position.copy(T).addScaledVector(kDir, d).addScaledVector(keyRight, JX).addScaledVector(keyUp, JY); key.target.position.copy(T);
      const fr = lerp(5, 16, sp); if (fr !== frustum) { frustum = fr; Object.assign(key.shadow.camera, { left: -fr, right: fr, top: fr, bottom: -fr, far: d + 30 }); key.shadow.camera.updateProjectionMatrix(); }
      key.intensity = K.intensity * kL * (S.key ?? 1) * live;
      // rim: red (problem) or violet; gel flicker on the click frames
      const red = ten > 0.001 && sol < 0.5; rim.color.copy(red ? RED : VIO);
      rim.intensity = (red ? 9 + 19 * ten : L.rim.cd) * rL * flick(n, S.clicks) * live;
      const R = L.rim; rim.position.set(at + R.pos[0], R.pos[1] + dip, R.pos[2]); rim.target.position.set(at + R.aim[0], R.aim[1] + dip, R.aim[2]);
      // top pool: follows `at`; level from the story
      const P = L.top; top.color.copy(tc); top.intensity = P.cd * tL * (S.pool ?? 1) * live;
      top.position.set(at + P.pos[0], P.pos[1] + dip, P.pos[2]); top.target.position.set(at + P.aim[0], P.aim[1] + dip, P.aim[2]);
      // back gel pool on the paper behind the set (s5's background light): red in the problem, violet in the solution
      const B = L.back; back.color.copy(red ? RED : VIO); back.intensity = (red ? B.redCd : B.vioCd) * (S.back || 0) * flick(n, S.clicks) * live;
      back.position.set(at + B.pos[0], B.pos[1], B.pos[2]); back.target.position.set(at + B.aim[0], B.aim[1], B.aim[2]);
      if (!S.glint) glint.intensity = 0; else { glint.intensity = L.glint.nits * S.glint[1] * live; glint.position.set(S.glint[0], L.glint.y + dip, L.glint.z); glint.lookAt(S.glint[0] * 0.3 + at * 0.7, L.glint.y - 0.4, 0); }
      return { kL, rL, tL, live, red };
    },
  };
}

/* handoff: scale every material's environment light (the fill) by k; the chrome's own level is set by the zone */
export function envScaler(scene, exclude = []) {
  const mats = new Map(), ex = new Set(exclude);
  scene.traverse((o) => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m && 'envMapIntensity' in m && !m.isShaderMaterial && !ex.has(m) && !mats.has(m)) mats.set(m, m.envMapIntensity); }); });
  let last = -1;
  return (k) => { if (Math.abs(k - last) < 1e-5) return; last = k; mats.forEach((base, m) => { m.envMapIntensity = base * k; }); };
}

