/* table-player.js: plays an anve-physics-table/1 table (written by bake.mjs). Dependency-free ES module (no three import, no DOM, no Node API).
   Everything here is a PURE FUNCTION of t: no state, no clock, no history, no allocation in the hot path (pass `out`). Works in Node and in the browser.

     import { createTablePlayer } from './table-player.js';
     const player = createTablePlayer(table);            // table = JSON.parse(text)
     player.poseAt(t, bodyIndex, out)                    // out = [x, y, z, qx, qy, qz, qw] (any array-like of length >= 7); lerp position, slerp (shortest arc) orientation between the two bracketing steps
     player.aliveAt(t, bodyIndex)                        // false before the body's born step (the box before t = 2.0 s)
     player.apply(t, objects)                            // objects[i] drives body i; each needs position.set(x,y,z), quaternion.set(x,y,z,w), and optionally .visible (set to aliveAt)
     player.motion(t)                                    // fastest "tip speed" of any live body in units/s (linear + 0.25 * angular): for the kit's subframes(n) / fast(n) hook
     player.firstContact(id) / player.events             // contact starts recorded by the bake: [step, idA, idB, speedBeforeImpact] (for sound cues and the desk dip)
     player.index[id], player.ids, player.duration, player.step

   t is seconds from the start of the table; it is clamped to [0, duration], so a loop wrap or an overshoot holds the last pose. */
export function createTablePlayer(table) {
  const { meta, frames } = table, nb = meta.bodies.length, steps = meta.steps, dt = meta.step, row = nb * 7;
  const D = new Float64Array((steps + 1) * row);
  for (let s = 0; s <= steps; s++) D.set(frames[s], s * row);
  const ids = meta.bodies.map((b) => b.id), index = Object.fromEntries(ids.map((id, i) => [id, i])), born = meta.bodies.map((b) => b.born);
  const EPS = 1e-6;                                       // in steps: t = born * dt must count as alive despite the float product

  /* per-step motion table, built once: max over live bodies of |dp| / dt + 0.25 * |dq| / dt */
  const mot = new Float64Array(steps);
  for (let s = 0; s < steps; s++) {
    let m = 0;
    for (let i = 0; i < nb; i++) {
      if (s + 1 < born[i]) continue;
      const a = s * row + i * 7, b = a + row, d = Math.hypot(D[b] - D[a], D[b + 1] - D[a + 1], D[b + 2] - D[a + 2]);
      const c = Math.min(1, Math.abs(D[a + 3] * D[b + 3] + D[a + 4] * D[b + 4] + D[a + 5] * D[b + 5] + D[a + 6] * D[b + 6])), w = 2 * Math.acos(c);
      m = Math.max(m, (d + 0.25 * w) / dt);
    }
    mot[s] = m;
  }
  const locate = (t) => { const x = Math.min(Math.max(t / dt, 0), steps), i0 = Math.min(Math.floor(x), steps - 1); return [i0, x - i0, x]; };
  const scratch = new Array(7);                           // written and read inside one apply() call: carries no information between calls

  const player = {
    ids, index, step: dt, steps, duration: steps * dt, events: meta.events || [], meta,
    aliveAt(t, i) { return Math.min(Math.max(t / dt, 0), steps) + EPS >= born[i]; },
    poseAt(t, i, out = new Array(7)) {
      const [i0, u] = locate(t), a = i0 * row + i * 7, b = a + row;
      out[0] = D[a] + (D[b] - D[a]) * u; out[1] = D[a + 1] + (D[b + 1] - D[a + 1]) * u; out[2] = D[a + 2] + (D[b + 2] - D[a + 2]) * u;
      const ax = D[a + 3], ay = D[a + 4], az = D[a + 5], aw = D[a + 6];
      let bx = D[b + 3], by = D[b + 4], bz = D[b + 5], bw = D[b + 6], cos = ax * bx + ay * by + az * bz + aw * bw;
      if (cos < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; cos = -cos; }                         // shortest arc
      let s0 = 1 - u, s1 = u;
      if (cos < 0.9995) { const th = Math.acos(cos), sn = Math.sin(th); s0 = Math.sin((1 - u) * th) / sn; s1 = Math.sin(u * th) / sn; }
      const qx = s0 * ax + s1 * bx, qy = s0 * ay + s1 * by, qz = s0 * az + s1 * bz, qw = s0 * aw + s1 * bw, l = 1 / Math.hypot(qx, qy, qz, qw);
      out[3] = qx * l; out[4] = qy * l; out[5] = qz * l; out[6] = qw * l;
      return out;
    },
    apply(t, objects) {
      const o = scratch;
      for (let i = 0; i < nb; i++) {
        const obj = objects[i]; if (!obj) continue;
        player.poseAt(t, i, o); obj.position.set(o[0], o[1], o[2]); obj.quaternion.set(o[3], o[4], o[5], o[6]);
        if ('visible' in obj) obj.visible = player.aliveAt(t, i);
      }
    },
    motion(t) { const [i0, u] = locate(t); return Math.max(mot[i0], u > 0.5 ? mot[Math.min(i0 + 1, steps - 1)] : 0, i0 > 0 && u < 0.5 ? mot[i0 - 1] : 0); },
    firstContact(id) { const e = player.events.find((x) => x[1] === id || x[2] === id); return e ? e[0] * dt : null; },
  };
  return player;
}
