/* motion-pack/objects/lib/dome.js (2026-10-14, new, owned): a floating glass-dome platform, an orbit of generic app-icon tiles, and a clay
   material preset. Every setter is a pure function of its arguments and update(t) is closed form: seek-safe (no Date, no Math.random, no
   dependence on the previous frame or on the camera of the last sample).
     makeGlassDome(ctx, parent, o) -> { group, inside, platform, dome, update(t), set({y, yaw, lift}), probes }   props for the interior go in `inside`
     makeIconOrbit(ctx, parent, o) -> { group, tiles, update(t), probes }   rounded tiles printed with the pack's OWN line icons (panels.js ICON_KINDS);
                                       never real brand logos. Tiles face a fixed world direction (o.facing) so no camera is read.
     makeClay(hex, o)               -> MeshPhysicalMaterial: soft matte clay with a subsurface-like gradient (warm core facing the viewer, a
                                       light-bleed rim at grazing angles). Works on any mesh; objects/worker takes it with spec.clay. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { E, seg, clamp, lerp, rad, TAU } from '../kit/util.js';
import { canvasTex, faceGeo, MAT } from './mat.js';
import { drawIcon, ICON_KINDS } from './panels.js';

/* ---------- clay ---------- */
export const CLAY_D = { roughness: 0.82, sheen: 0.6, sheenColor: '#fff1e6', core: null, coreK: 0.35, rim: '#ffb59a', sss: 0.35, pow: 2.4 };
export function makeClay(hex = '#f1c9a8', o = {}) {
  o = { ...CLAY_D, ...o }; const base = new THREE.Color(hex), core = new THREE.Color(o.core || '#' + base.clone().offsetHSL(-0.02, 0.12, 0.04).getHexString());
  const m = new THREE.MeshPhysicalMaterial({ color: base, roughness: o.roughness, metalness: 0, sheen: o.sheen, sheenRoughness: 0.9, sheenColor: new THREE.Color(o.sheenColor) });
  const U = { uCore: { value: core }, uCoreK: { value: o.coreK }, uRim: { value: new THREE.Color(o.rim) }, uSss: { value: o.sss }, uPow: { value: o.pow } };
  m.userData.clay = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (!sh.fragmentShader.includes('#include <emissivemap_fragment>')) throw new Error('clay: emissivemap chunk not found');
    sh.fragmentShader = 'uniform vec3 uCore; uniform float uCoreK; uniform vec3 uRim; uniform float uSss; uniform float uPow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float mpFacing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
       diffuseColor.rgb = mix(diffuseColor.rgb, uCore, mpFacing * mpFacing * uCoreK);      // warmer, denser core where the surface faces the viewer
       totalEmissiveRadiance += uRim * pow(1.0 - mpFacing, uPow) * uSss;                     // light bleeding through the thin silhouette`);
  };
  m.customProgramCacheKey = () => 'mp-clay';
  return m;
}

/* ---------- glass dome on a floating platform ---------- */
export function makeGlassDome(ctx, parent, o = {}) {
  o = { r: 1.0, base: 1.3, thick: 0.16, under: 0.34, y: 0.7, color: '#eeebe6', rim: '#f7f5f1', tint: '#ffffff', iridescence: 0.45, bob: 0.035, hz: 0.22, yawHz: 0, phase: 0, ...o };
  const group = new THREE.Group(); parent.add(group); const bobG = new THREE.Group(); group.add(bobG);
  // platform: flat top, a rounded rim, then a shallow saucer underside (one lathe, smooth normals)
  const R = o.base, T = o.thick, rr = T * 0.5, prof = [[0.0001, 0]];
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; prof.push([R - rr + Math.sin(a) * rr, -rr + Math.cos(a) * rr]); }
  for (let i = 1; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; prof.push([R - rr + Math.cos(a) * rr, -rr - Math.sin(a) * (T - rr)]); }
  for (let i = 1; i <= 24; i++) { const s = i / 24; prof.push([(R - rr) * (1 - s), -T - o.under * Math.sin(s * Math.PI / 2) ** 1.6]); }
  prof.reverse();   // lathe wants bottom -> top so normals face out
  const plat = ctx.add(bobG, new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(Math.max(1e-4, x), y)), 128), MAT.satin(o.color, { roughness: 0.5, clearcoat: 0.2 })), { cast: true, recv: true, name: 'dome-platform' });
  const ring = ctx.add(bobG, new THREE.Mesh(new THREE.TorusGeometry(o.r + 0.012, 0.026, 16, 160), MAT.satin(o.rim, { roughness: 0.3, clearcoat: 0.6 })), { cast: false, recv: true, name: 'dome-ring' }); ring.rotation.x = Math.PI / 2; ring.position.y = 0.012;
  const domeG = new THREE.Group(); bobG.add(domeG);
  const glass = new THREE.MeshPhysicalMaterial({ color: o.tint, roughness: 0.03, metalness: 0, transmission: 1, thickness: 0.06, ior: 1.45, iridescence: o.iridescence, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 520],
    clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMapIntensity: 1.2, transparent: true });
  if (ctx.metalEnv) glass.envMap = ctx.metalEnv;
  const dome = ctx.add(domeG, new THREE.Mesh(new THREE.SphereGeometry(o.r, 128, 64, 0, TAU, 0, Math.PI / 2), glass), { cast: false, recv: false, decal: true, name: 'dome-glass' });   // decal: hidden in the depth pass so DOF focuses on what is inside
  dome.renderOrder = 2;
  const inside = new THREE.Group(); bobG.add(inside);
  const api = {
    group, inside, platform: plat, dome, ring, o,
    /* y: float height; yaw: platform turn (rad); lift: dome raised off the platform (0..1, a reveal) */
    set({ y = o.y, yaw = 0, lift = 0 } = {}) { group.position.y = y; bobG.rotation.y = yaw; domeG.position.y = lift * o.r * 1.4; domeG.visible = lift < 0.999; return api; },
    update(t, extra = {}) { const b = o.bob * Math.sin(TAU * o.hz * t + o.phase); api.set({ y: (extra.y ?? o.y) + b, yaw: (extra.yaw ?? 0) + TAU * o.yawHz * t, lift: extra.lift ?? 0 }); bobG.rotation.z = 0.012 * Math.sin(TAU * o.hz * 0.7 * t + 1.3); return api; },
    /* world corners of the platform's front edge plane etc. are left to the scene; probes for __layout */
    probes: { dome: dome, platform: plat },
  };
  api.set({}); return api;
}

/* ---------- orbit of generic app-icon tiles ---------- */
const GRADS = [['#7b5cff', '#4a18ed'], ['#ff8a5c', '#ff4f7b'], ['#2bd9a0', '#139a8a'], ['#ffc83d', '#ff8a1f'], ['#5ab0ff', '#2f6bff'], ['#ff6fb5', '#b03bd1'], ['#8ee36a', '#2f9e44'], ['#4fd1ff', '#3a6cf0']];
export function iconTileTex(kind, grad, { ink = '#ffffff', accent = '#ffe45c' } = {}) {
  return canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, grad[0]); gr.addColorStop(1, grad[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const hl = g.createLinearGradient(0, 0, 0, h * 0.5); hl.addColorStop(0, 'rgba(255,255,255,0.28)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fillRect(0, 0, w, h * 0.5);
    drawIcon(g, kind, w / 2, h / 2, w * 0.62, ink, accent); });
}
export function makeIconOrbit(ctx, parent, o = {}) {
  o = { n: 8, radius: 1.9, y: 1.0, tilt: 10, speed: 0.08, size: 0.3, depth: 0.08, icons: ICON_KINDS.filter((k) => k !== 'x' && k !== 'lock'), grads: GRADS, facing: [0, 0, 1], bob: 0.05, shadows: false, appearAt: 0, stagger: 0.07, phase: 0, ...o };
  const group = new THREE.Group(); parent.add(group); group.position.y = o.y; group.rotation.x = rad(o.tilt);
  const fy = Math.atan2(o.facing[0], o.facing[2]), r = o.size * 0.24;
  const tiles = Array.from({ length: o.n }, (_, i) => {
    const g = new THREE.Group(); group.add(g); const kind = o.icons[i % o.icons.length], grad = o.grads[i % o.grads.length];
    const body = ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(o.size, o.size, o.depth, 5, r), MAT.satin(grad[1], { roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12 })), { cast: o.shadows, recv: true, name: 'icon-tile-' + i });
    const face = ctx.add(g, new THREE.Mesh(faceGeo(o.size * 0.985, o.size * 0.985, r * 0.98), new THREE.MeshPhysicalMaterial({ map: iconTileTex(kind, grad), roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.1 })), { cast: false, recv: true });
    face.position.z = o.depth / 2 + 0.0015; return { g, body, face, kind };
  });
  const api = {
    group, tiles, o,
    update(t) {
      tiles.forEach((tl, i) => { const a = TAU * (i / o.n + o.speed * t) + o.phase, k = E.pop(seg(t, o.appearAt + i * o.stagger, o.appearAt + i * o.stagger + 0.45));
        tl.g.position.set(o.radius * Math.cos(a), o.bob * Math.sin(TAU * 0.4 * t + i * 1.7), o.radius * Math.sin(a));
        tl.g.rotation.set(-rad(o.tilt) + 0.08 * Math.sin(TAU * 0.3 * t + i), fy + 0.18 * Math.sin(a), 0.06 * Math.sin(TAU * 0.25 * t + i * 2.1));
        tl.g.scale.setScalar(Math.max(1e-4, k)); tl.g.visible = k > 1e-4; });
      return api;
    },
    probes: { orbit: group },
  };
  api.update(0); return api;
}
