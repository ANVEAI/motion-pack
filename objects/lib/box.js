/* PROVENANCE: extracted from kit/props.js makeAnveBox + the ANVE v10 film set's src/box.js makeBoxPath (the move vocabulary place/drop/glide/travel works for ANY prop with a base-centre pose) (2026-10-13). Behaviour unchanged unless noted; see objects/README.md. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, seg, E, springU, springKick, rad } from '../kit/util.js';
import { at } from '../kit/tl.js';
import { std } from './mat.js';

/* v10 set: THE BOX (one instance, s1 mesh and size) and its choreography. The timeline gives `box: { moves: [...], bandOn, ledsOn, glints }`.
   moves (seconds; each move owns the box from its start until the next move starts):
     { do: 'absent', t }                          not in the set
     { do: 'place',  zone, t }                    at rest on the zone's spot from t (no motion)
     { do: 'drop',   zone, contact }              s1: lowered from above the frame (y 9 -> hang 0.80 over 14 f, 2 f crouch, 8 f fall), contact
                                                  squash + spring (0.45, 4 Hz); its own shadow from the top pool leads it
     { do: 'glide',  zone, contact, from: 1|-1 }  s2: slides in from the right (+1) or left (-1) on a falling arc over 6 f, hang, 3 f fall, contact
     { do: 'travel', to, start, contact, apex }   from wherever it rests: 5 f crouch, a parabolic hop (apex default 1.1 above the higher spot,
                                                  E.move along the desk), 3% stretch in flight, contact squash + spring. Lands on the dock in WALL.
   bandOn: the amber band ignites (E.soft over 9 f, one 0.55 flicker 2 f in); ledsOn: the mint LEDs (1.6 -> 1.0 over 6 f); glints: [[t0, t1]]
   (a 6500 K glint sweeps the chamfers; s1 / s2 used it in the hold). Positions are desk space; zone spots come from each zone module. */
/* ---------- the ANVE box: body, lid + seam, frosted amber band, base plinth, two LEDs (proportions of the Blender plate) ---------- */
export function makeAnveBox(ctx, B) {
  const outer = new THREE.Group(), g = new THREE.Group(); outer.add(g);
  const W = B.w, H = B.h, D = B.d, body = new THREE.MeshPhysicalMaterial({ color: B.body, roughness: B.rough, metalness: 0, clearcoat: B.clearcoat, clearcoatRoughness: B.ccRough });
  const lidM = new THREE.MeshPhysicalMaterial({ color: B.lid, roughness: B.rough * 0.9, metalness: 0, clearcoat: B.clearcoat, clearcoatRoughness: B.ccRough });
  const baseM = new THREE.MeshPhysicalMaterial({ color: B.base, roughness: 0.34, metalness: 0.55 }), seamM = std('#050505', { roughness: 0.8 });
  const hBody = H - B.baseH - B.bandH - B.lidH - B.seam;
  ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(W, B.baseH, D, 4, 0.035), baseM), { cast: true }).position.y = B.baseH / 2;
  const bandMat = new THREE.MeshBasicMaterial({ color: 0x000000 }), bandBloom = new THREE.MeshBasicMaterial({ color: 0x000000 });
  ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(W - 0.014, B.bandH, D - 0.014), bandMat), { cast: true, bloom: bandBloom }).position.y = B.baseH + B.bandH / 2;
  ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(W, hBody, D, 6, B.r), body), { cast: true }).position.y = B.baseH + B.bandH + hBody / 2;
  ctx.add(g, new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, B.seam + 0.004, D - 0.03), seamM), { cast: false }).position.y = H - B.lidH - B.seam / 2;
  ctx.add(g, new THREE.Mesh(new RoundedBoxGeometry(W, B.lidH, D, 4, 0.035), lidM), { cast: true }).position.y = H - B.lidH / 2;
  const ledMat = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: '#2a2a2a' })), ledBloom = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const leds = [-1, 1].map((s, i) => { const m = ctx.add(g, new THREE.Mesh(new THREE.CircleGeometry(B.led, 20), ledMat[i]), { bloom: ledBloom[i] }); m.position.set(s * B.ledX, B.baseH * 0.5, D / 2 + 0.0015); return m; });
  return {
    group: outer, inner: g, W, H, D,
    /* pose: base-centre position, squash about the base (sx horizontal, sy vertical), yaw */
    pose(p, sx = 1, sy = 1, yaw = 0) { outer.position.set(p[0], p[1], p[2]); outer.rotation.set(0, yaw, 0); g.scale.set(sx, sy, sx); },
    setBand(level, flicker = 1) { const a = clamp(level) * flicker; bandMat.color.copy(a > 0 ? ctx.emis(B.band, 1.0 * a + 0.0) : new THREE.Color('#2b2118')); if (a <= 0) bandMat.color.setRGB(0.035, 0.025, 0.018, THREE.LinearSRGBColorSpace); bandBloom.color.copy(ctx.emis(B.band, 1.4 * a)); },
    setLeds(hexOn, level) { for (let i = 0; i < 2; i++) { if (level > 0) ledMat[i].color.copy(ctx.emis(hexOn, Math.min(level, 1.6))); else ledMat[i].color.set('#2a2a2a'); ledBloom[i].color.copy(ctx.emis(hexOn, 1.8 * level)); } },
    leds,
  };
}


const FPS = 30;
export function moveStart(m) { if (m.do === 'drop') return m.contact - 24 / FPS; if (m.do === 'glide') return m.contact - 10 / FPS; if (m.do === 'travel') return m.start; return m.t ?? 0; }

export function makeBoxPath(spec, spotOf) {
  const moves = (spec.moves || []).map((m) => ({ ...m, t0: moveStart(m) })).sort((a, b) => a.t0 - b.t0);
  // resting spot after each move (travel needs where it came from)
  let rest = null; for (const m of moves) { m.from = rest; if (m.do === 'absent') rest = null; else rest = spotOf(m.zone || m.to); m.to3 = rest; }
  const contacts = moves.filter((m) => m.contact !== undefined).map((m) => m.contact);
  return {
    moves, contacts,
    /* pose at time t: { vis, p:[x,y,z], sx, sy, roll, zone, landed (0..1 contact occlusion), airborne } */
    pose(t) {
      let m = null; for (const x of moves) if (x.t0 <= t) m = x;
      if (!m || m.do === 'absent') return { vis: false, p: [0, 99, 0], sx: 1, sy: 1, roll: 0, zone: null, landed: 0 };
      const F = t * FPS, P = m.to3; let p = P.slice(), sx = 1, sy = 1, roll = 0, landed = 1, air = false;
      const settle = (C, z = 0.45, hz = 4.0, a = 0.035, b = 0.045) => { const hold = F < C + 2 ? 1 : springU((F - C - 2) / FPS, z, hz); sx = 1 + a * hold; sy = 1 - b * hold; };
      if (m.do === 'drop') {
        const C = m.contact * FPS, e0 = C - 24, h0 = C - 10, h1 = C - 8, hang = 0.80, from = 9.0;
        if (F < h0) { p[1] = P[1] + lerp(from, hang, E.enter(seg(F, e0, h0))); air = true; }
        else if (F < h1) { p[1] = P[1] + hang; const c = E.soft(seg(F, h0, h1)); sx = 1 + 0.02 * c; sy = 1 - 0.028 * c; air = true; }
        else if (F < C) { const u = seg(F, h1, C); p[1] = P[1] + hang * (1 - u * u); const rel = 1 - E.soft(seg(F, h1, h1 + 2)), s2 = E.soft(seg(F, C - 4, C)); sx = 1 + 0.02 * rel - 0.035 * s2; sy = 1 - 0.028 * rel + 0.045 * s2; air = true; }
        else settle(C);
        landed = E.soft(seg(F, C - 4, C));
      } else if (m.do === 'glide') {
        const C = m.contact * FPS, g0 = C - 10, g1 = C - 4, hg = C - 3, s = m.from ?? 1, X0 = 3.3, Y0 = 0.16, hover = 0.08;
        if (F < g1) { const u = seg(F, g0, g1), k = Math.pow(1 - u, 2.2); p[0] = P[0] + s * X0 * k; p[1] = P[1] + lerp(hover, Y0, k); roll = s * rad(3) * Math.sin(Math.PI * u); air = true; }
        else if (F < hg) { p[1] = P[1] + hover; const c = E.soft(seg(F, g1, hg)); sx = 1 + 0.02 * c; sy = 1 - 0.025 * c; air = true; }
        else if (F < C) { const u = seg(F, hg, C); p[1] = P[1] + hover * (1 - u * u); const rel = 1 - E.soft(seg(F, hg, hg + 1.5)), str = E.soft(seg(F, C - 3, C)); sx = 1 + 0.02 * rel - 0.03 * str; sy = 1 - 0.025 * rel + 0.04 * str; air = true; }
        else settle(C, 0.45, 4.0, 0.035, 0.04);
        landed = F < C ? E.soft(seg(F, C - 3, C)) : 1;
      } else if (m.do === 'travel') {
        const S = m.start * FPS, C = m.contact * FPS, A = m.from || P, L0 = S + 5;
        const apex = Math.max(A[1], P[1]) + (m.apex ?? 1.1);
        if (F < L0) { p = A.slice(); const c = E.soft(seg(F, S, L0)); sx = 1 + 0.025 * c; sy = 1 - 0.035 * c; landed = 1 - c; }
        else if (F < C) {
          const u = seg(F, L0, C), h = E.move(u); p = [lerp(A[0], P[0], h), 0, lerp(A[2], P[2], h)];
          p[1] = lerp(A[1], P[1], u) + 4 * u * (1 - u) * (apex - lerp(A[1], P[1], u)) ;
          const rel = 1 - E.soft(seg(F, L0, L0 + 3)), str = E.soft(seg(F, C - 3, C)); sx = 1 + 0.025 * rel - 0.03 * str; sy = 1 - 0.035 * rel + 0.03 * Math.sin(Math.PI * u) + 0.04 * str;
          roll = -Math.sign(P[0] - A[0]) * rad(4) * Math.sin(Math.PI * u) * (1 - u); landed = E.soft(seg(F, C - 4, C)); air = true;
        } else settle(C);
      } // 'place': at rest
      return { vis: true, p, sx, sy, roll, zone: m.zone || m.to, landed: clamp(landed), airborne: air };
    },
    /* the desk's bob: every contact so far (s1: -0.045 x springKick(0.35, 2.2 Hz)) */
    dip(t) { let d = 0; for (const c of contacts) { const a = t - c; if (a > 0) d += -0.045 * springKick(a, 0.35, 2.2); } return d; },
    band(t, n) { const on = at(spec.bandOn), u = seg(t * FPS, on * FPS, on * FPS + 9), fl = n === Math.round(on * FPS) + 2 ? 0.55 : 1; return [E.soft(u), fl]; },
    leds(n) { const on = Math.round(at(spec.ledsOn) * FPS); return n >= on ? 1 + 0.6 * (1 - seg(n, on, on + 6)) : 0; },
    glint(t, bx) { for (const [a, b] of spec.glints || []) { const u = seg(t, a, b); if (u > 0 && u < 1) return [bx - 1.36 + 2.8 * E.move(u), Math.sin(Math.PI * u)]; } return null; },
  };
}

