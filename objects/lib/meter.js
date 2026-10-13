/* PROVENANCE: generalised from the ANVE v10 film set's src/zones/bill.js makeGauge + needlePre (2026-10-13). The film's TOKEN BILL
   numbers became params; the needle spring and the red-zone glow are unchanged.
   makeMeter(ctx, parent, o) -> { group, setValue(v), setNeedle(deg), setZone(level), probes }
   o: { pos, R 1.0, depth 0.30, body, face, vmax, red (value where the red band starts), arc [165, 15] deg, label 'TOKEN BILL',
        majorEvery, minorEvery, redHex, envMap (chrome env texture, optional) }
   needleSpring(F, steps, o): closed-form needle angle at frame F for a list of jumps [{f, v}] (v0 = o.v0): spring 0.6 / 5 Hz with an
   optional 2-frame kickback (the bill's "it hurts" read). Pure function of F. */
import * as THREE from 'three';
import { springU, rad, TAU } from '../kit/util.js';
import { canvasTex } from './mat.js';

export const METER = { pos: [0, 0.98, -0.62], R: 1.0, depth: 0.30, body: '#fbfaf7', faceR: 0.93, face: '#f8f6f1', bezel: [0.965, 0.042], pivotY: 0.20,
  arc: [165, 15], vmax: 140000, red: 110000, tickMajor: [0.52, 0.65, 0.018], tickMinor: [0.585, 0.65, 0.009], majorEvery: 20000, minorEvery: 5000,
  redBand: [0.665, 0.70], needle: { len: 0.62, w0: 0.022, w1: 0.006, tail: 0.14, cw: 0.05, z: 0.024, th: 0.012 }, hub: 0.065, label: 'TOKEN BILL', labelEm: 0.125, labelDy: 0.25,
  redHex: '#e5483a', v0: 0, spring: [0.6, 5.0], kick: 1.5, kickN: 8 };

export const meterAngle = (o, v) => o.arc[0] - (o.arc[0] - o.arc[1]) * v / o.vmax;
export function needleSpring(o, F, steps, fps = 30) {
  const O = { ...METER, ...o }; let a = meterAngle(O, O.v0); const [z, hz] = O.spring;
  steps.forEach((s, j) => { const prev = j ? steps[j - 1].v : O.v0, d = meterAngle(O, s.v) - meterAngle(O, prev), tau = (F - s.f) / fps; if (tau > 0) a += d * (1 - springU(tau, z, hz));
    if (j < O.kickN && O.kick) { const tk = (F - (s.f - 2)) / fps; if (tk > 0) a += O.kick * (1 - springU(tk, z, hz)); if (tau > 0) a -= O.kick * (1 - springU(tau, z, hz)); } });
  return a;
}

export function makeMeter(ctx, parent, o = {}) {
  const G = { ...METER, ...o }, g = new THREE.Group(); g.position.set(...G.pos); parent.add(g);
  const d = G.depth / 2;
  const body = new THREE.MeshPhysicalMaterial({ color: G.body, roughness: 0.52, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.3 });
  const disc = ctx.add(g, new THREE.Mesh(new THREE.CylinderGeometry(G.R, G.R, G.depth, 160, 1), body), { cast: true, recv: true, name: 'meter' }); disc.rotation.x = Math.PI / 2;
  const chrome = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.12, envMap: G.envMap || null, envMapIntensity: 1 }); chrome.color.setRGB(0.92, 0.92, 0.92, THREE.LinearSRGBColorSpace);
  const bz = ctx.add(g, new THREE.Mesh(new THREE.TorusGeometry(G.bezel[0] * G.R, G.bezel[1] * G.R, 32, 220), chrome), { cast: true, recv: true }); bz.position.z = d;
  const ang = (v) => meterAngle(G, v);
  const N = 2048, faceR = G.faceR * G.R, ppu = N / (2 * faceR), cx = N / 2, cy = N / 2 - G.pivotY * G.R * ppu, s = G.R;
  const tex = canvasTex(N, N, (c) => {
    c.fillStyle = G.face; c.beginPath(); c.arc(N / 2, N / 2, N / 2 - 1, 0, TAU); c.fill();
    const sh = c.createRadialGradient(N / 2, N / 2, N * 0.40, N / 2, N / 2, N / 2); sh.addColorStop(0, 'rgba(60,52,40,0)'); sh.addColorStop(1, 'rgba(60,52,40,0.10)'); c.fillStyle = sh; c.beginPath(); c.arc(N / 2, N / 2, N / 2, 0, TAU); c.fill();
    const A = (v) => rad(ang(v));
    if (G.red < G.vmax) { c.strokeStyle = G.redHex; c.lineWidth = (G.redBand[1] - G.redBand[0]) * s * ppu; c.beginPath(); c.arc(cx, cy, (G.redBand[0] + G.redBand[1]) / 2 * s * ppu, -A(G.red), -A(G.vmax), false); c.stroke(); }
    const tick = (v, r0, r1, w, col) => { const a = A(v); c.strokeStyle = col; c.lineWidth = w * s * ppu; c.lineCap = 'butt'; c.beginPath(); c.moveTo(cx + Math.cos(a) * r0 * s * ppu, cy - Math.sin(a) * r0 * s * ppu); c.lineTo(cx + Math.cos(a) * r1 * s * ppu, cy - Math.sin(a) * r1 * s * ppu); c.stroke(); };
    for (let v = 0; v <= G.vmax + 1e-6; v += G.minorEvery) { if (Math.abs(v / G.majorEvery - Math.round(v / G.majorEvery)) < 1e-6) tick(v, G.tickMajor[0], G.tickMajor[1], G.tickMajor[2], '#1a1917'); else tick(v, G.tickMinor[0], G.tickMinor[1], G.tickMinor[2], '#4a463f'); }
    const px = G.labelEm * s * ppu; c.font = `600 ${Math.round(px)}px "IBM Plex Mono"`; c.letterSpacing = (px * 0.06).toFixed(1) + 'px'; c.fillStyle = '#5d5850'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (G.label) c.fillText(G.label, cx, cy - G.labelDy * s * ppu);
  });
  const face = ctx.add(g, new THREE.Mesh(new THREE.CircleGeometry(faceR, 160), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })), { recv: true, name: 'dial' }); face.position.z = d + 0.002;
  const zMat = new THREE.MeshBasicMaterial({ color: 0x000000, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), zBloom = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const a0 = rad(G.arc[1]), a1 = rad(ang(Math.min(G.red, G.vmax)));
  const zone = ctx.add(g, new THREE.Mesh(new THREE.RingGeometry((G.redBand[0] - 0.004) * s, (G.redBand[1] + 0.004) * s, 64, 1, a0, Math.max(1e-3, a1 - a0)), zMat), { recv: false, bloom: zBloom }); zone.position.set(0, G.pivotY * s, d + 0.004); zone.renderOrder = 4; zone.visible = false;
  const Nd = G.needle, nG = new THREE.Group(); nG.position.set(0, G.pivotY * s, d + Nd.z * s); g.add(nG);
  const sh2 = new THREE.Shape(); sh2.moveTo(Nd.len * s, -Nd.w1 * s); sh2.lineTo(0, -Nd.w0 * s); sh2.lineTo(-Nd.tail * s, -Nd.w0 * 0.8 * s); sh2.lineTo(-Nd.tail * s, Nd.w0 * 0.8 * s); sh2.lineTo(0, Nd.w0 * s); sh2.lineTo(Nd.len * s, Nd.w1 * s); sh2.closePath();
  const ink = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.42, metalness: 0.1 });
  const blade = ctx.add(nG, new THREE.Mesh(new THREE.ExtrudeGeometry(sh2, { depth: Nd.th * s, bevelEnabled: false }), ink), { cast: true, recv: false }); blade.position.z = -Nd.th * s / 2;
  const cw = ctx.add(nG, new THREE.Mesh(new THREE.CylinderGeometry(Nd.cw * s, Nd.cw * s, Nd.th * 1.6 * s, 40), ink), { cast: true, recv: false }); cw.rotation.x = Math.PI / 2; cw.position.x = -Nd.tail * s;
  const hub = ctx.add(nG, new THREE.Mesh(new THREE.SphereGeometry(G.hub * s, 40, 20), chrome), { cast: true, recv: false }); hub.scale.set(1, 1, 0.55); hub.position.z = Nd.th * 0.6 * s;
  const api = { group: g, disc, face, needle: nG, zone, chrome, probes: { meter: disc },
    setNeedle(deg) { nG.rotation.z = rad(deg); },
    setValue(v) { api.setNeedle(ang(v)); },
    setZone(level) { zMat.color.copy(ctx.emis(G.redHex, 0.55 * level)); zBloom.color.copy(ctx.emis(G.redHex, 1.3 * level)); zone.visible = level > 0.002; } };
  api.setValue(G.v0);
  return api;
}
