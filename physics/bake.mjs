#!/usr/bin/env node
/* bake.mjs: run Rapier at a fixed step and write a table of per-step transforms (reusable deliverable, isomorphic ES module).

   As a module (Node or a browser):   import { bake, tableToJSON } from './bake.mjs';
                                       const { table, stats } = await bake(RAPIER, spec);       // RAPIER = @dimforge/rapier3d-compat (init is awaited inside)
   As a CLI:  node bake.mjs --spec scene.json --out scene.table.json [--set world.substeps=4] [--set cards.ccd=true] ...
              prints:  <out>  sha256  bytes  gzip bytes  init ms  step ms  bodies  events  engine

   SPEC (generic): { scene, prng?: { seed }, time: { physicsStep, steps }, world: { gravity, substeps?, lengthUnit?, numSolverIterations?, integration? },
                     statics: [{ id, shape, p, q?, friction?, restitution? }],
                     bodies:  [{ id, kind, size?, tint?, born?, p, q, linvel?, angvel?, shape, offset?, density?, friction?, restitution?, restitutionCombine?,
                                 linearDamping?, angularDamping?, gravityScale?, ccd?, softCcdPrediction?, events? }] }
     shape = { type: 'cuboid', half: [x, y, z] } | { type: 'ball', radius } | { type: 'capsule', halfHeight, radius } | { type: 'cylinder', halfHeight, radius }
     born  = the step at which the body is created (default 0); events: true records every contact START of this body (statics are always recorded).
     size  = the VISUAL size the renderer needs (default: the collider's full extents); offset = collider offset from the body origin (e.g. the kit box: origin = base centre).
   The legacy A3 schema { desk, cards: { list }, box } is still accepted and converted (same bytes out).

   Table (anve-physics-table/1):  { format, meta, frames }
     meta.step    the fixed sampling step in seconds (1/60); frames has steps + 1 rows (row s = the state after s steps; row 0 = initial)
     meta.bodies  [{ id, kind, born, size, tint? }]   rows before `born` hold the initial pose
     meta.events  [[step, idA, idB, speedBeforeImpact]]   contact STARTS that involve a static or an events:true body (sound cues, desk dip)
     frames[s]    flat array: for each body, in meta.bodies order: x y z qx qy qz qw (rounded to 1e-6, so the JSON text is stable)
   The table holds nothing wall-clock dependent: the same spec + the same engine build give byte-identical JSON in every process. */

const FORMAT = 'anve-physics-table/1';
const r6 = (x) => { const v = Math.round(x * 1e6) / 1e6; return v === 0 ? 0 : v; };   // 1e-6 grid, never -0

/* "cards.ccd=true" style overrides on a deep copy of the spec (variants for experiments) */
export function withOverrides(spec, sets = []) {
  const s = JSON.parse(JSON.stringify(spec));
  for (const kv of sets) {
    const i = kv.indexOf('='), path = kv.slice(0, i).split('.'), val = JSON.parse(kv.slice(i + 1));
    let o = s; for (let k = 0; k < path.length - 1; k++) o = o[path[k]]; o[path[path.length - 1]] = val;
  }
  return s;
}

/* the first A3 schema (desk + a list of identical cards + one late box) as the generic one */
export function fromLegacy(spec) {
  const D = spec.desk, C = spec.cards, B = spec.box;
  const card = (c) => ({ id: c.id, kind: 'card', tint: c.tint, born: 0, p: c.p, q: c.q, linvel: c.linvel, angvel: c.angvel, shape: { type: 'cuboid', half: C.colliderHalfExtents || C.halfExtents }, size: C.halfExtents.map((h) => r6(2 * h)),
    density: C.density, friction: C.friction, restitution: C.restitution, linearDamping: C.linearDamping, angularDamping: C.angularDamping, gravityScale: C.gravityScale, ccd: C.ccd, softCcdPrediction: C.softCcdPrediction });
  return { ...spec, statics: [{ id: 'desk', shape: { type: 'cuboid', half: D.halfExtents }, p: D.centre, friction: D.friction, restitution: D.restitution }],
    bodies: [...C.list.map(card), { id: B.id, kind: 'box', born: B.bornStep, p: B.p, q: B.q, linvel: B.linvel, angvel: B.angvel, shape: { type: 'cuboid', half: B.halfExtents }, offset: B.colliderOffset, size: B.halfExtents.map((h) => r6(2 * h)),
      density: B.density, friction: B.friction, restitution: B.restitution, restitutionCombine: B.restitutionCombine, linearDamping: B.linearDamping, angularDamping: B.angularDamping, ccd: B.ccd, softCcdPrediction: B.softCcdPrediction, events: true }] };
}

export async function bake(RAPIER, spec0, { sets = [], onStep = null } = {}) {
  const spec0o = withOverrides(spec0, sets), spec = spec0o.bodies ? spec0o : fromLegacy(spec0o);
  const T0 = performance.now();
  await RAPIER.init();
  const initMs = performance.now() - T0;
  const T1 = performance.now();

  const dt = spec.time.physicsStep, steps = spec.time.steps, W = spec.world, sub = Math.max(1, W.substeps || 1);   // sub > 1: the table is still sampled every dt, the engine runs sub steps of dt / sub in between (a baking luxury)
  const world = new RAPIER.World({ x: W.gravity[0], y: W.gravity[1], z: W.gravity[2] });
  world.integrationParameters.dt = dt / sub;
  if (W.lengthUnit) world.integrationParameters.lengthUnit = W.lengthUnit;
  if (W.numSolverIterations) world.integrationParameters.numSolverIterations = W.numSolverIterations;
  for (const [k, v] of Object.entries(W.integration || {})) world.integrationParameters[k] = v;           // any other IntegrationParameters setter, e.g. contact_natural_frequency
  const queue = new RAPIER.EventQueue(true);
  const RULE = { average: RAPIER.CoefficientCombineRule.Average, min: RAPIER.CoefficientCombineRule.Min, multiply: RAPIER.CoefficientCombineRule.Multiply, max: RAPIER.CoefficientCombineRule.Max };
  const EV = RAPIER.ActiveEvents.COLLISION_EVENTS;
  const shapeDesc = (s) => { switch (s.type) { case 'cuboid': return RAPIER.ColliderDesc.cuboid(...s.half); case 'ball': return RAPIER.ColliderDesc.ball(s.radius); case 'capsule': return RAPIER.ColliderDesc.capsule(s.halfHeight, s.radius); case 'cylinder': return RAPIER.ColliderDesc.cylinder(s.halfHeight, s.radius); default: throw new Error('bake: unknown shape ' + s.type); } };
  const quat = (q) => ({ x: q[0], y: q[1], z: q[2], w: q[3] });

  const byCollider = new Map(), isStatic = new Set(), recorded = new Set();
  for (const s of spec.statics || []) {                                                                    // fixed colliders (the desk: top face y = 0)
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...s.p).setRotation(quat(s.q || [0, 0, 0, 1])));
    const col = world.createCollider(shapeDesc(s.shape).setFriction(s.friction ?? 0.5).setRestitution(s.restitution ?? 0).setActiveEvents(EV), rb);
    byCollider.set(col.handle, s.id); isStatic.add(s.id);
  }
  /* bodies in a FIXED order (the list order); each is created at its born step */
  const bodies = spec.bodies.map((b) => ({ ...b, born: b.born || 0, rb: null, col: null, init: [...b.p, ...b.q] }));
  for (const b of bodies) if (b.events) recorded.add(b.id);
  const create = (b) => {
    const d = RAPIER.RigidBodyDesc.dynamic().setTranslation(...b.p).setRotation(quat(b.q)).setLinvel(...(b.linvel || [0, 0, 0])).setAngvel(((a) => ({ x: a[0], y: a[1], z: a[2] }))(b.angvel || [0, 0, 0]))
      .setLinearDamping(b.linearDamping || 0).setAngularDamping(b.angularDamping || 0).setCcdEnabled(!!b.ccd);
    if (b.gravityScale !== undefined) d.setGravityScale(b.gravityScale);
    if (b.softCcdPrediction) d.setSoftCcdPrediction(b.softCcdPrediction);
    const rb = world.createRigidBody(d), cd = shapeDesc(b.shape);
    if (b.offset) cd.setTranslation(...b.offset);
    cd.setDensity(b.density ?? 1).setFriction(b.friction ?? 0.5).setRestitution(b.restitution ?? 0);
    if (b.restitutionCombine) cd.setRestitutionCombineRule(RULE[b.restitutionCombine]);
    const col = world.createCollider(cd.setActiveEvents(EV), rb);
    b.rb = rb; b.col = col; byCollider.set(col.handle, b.id);
  };
  for (const b of bodies) if (b.born === 0) create(b);

  const row = () => { const out = []; for (const b of bodies) { if (b.rb) { const t = b.rb.translation(), q = b.rb.rotation(); out.push(r6(t.x), r6(t.y), r6(t.z), r6(q.x), r6(q.y), r6(q.z), r6(q.w)); } else out.push(...b.init.map(r6)); } return out; };
  const speeds = () => { const m = new Map(); for (const b of bodies) if (b.rb) { const v = b.rb.linvel(); m.set(b.id, Math.hypot(v.x, v.y, v.z)); } return m; };

  const frames = [row()], events = [];
  let prev = speeds();
  for (let s = 0; s < steps; s++) {
    for (const b of bodies) if (b.born === s && s > 0) create(b);
    for (let k = 0; k < sub; k++) {
      world.step(queue);
      queue.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        const a = byCollider.get(h1), b = byCollider.get(h2);
        if (a === undefined || b === undefined) return;
        if (!(isStatic.has(a) || isStatic.has(b) || recorded.has(a) || recorded.has(b))) return;   // other body-body contacts are not recorded
        const dyn = recorded.has(a) ? a : recorded.has(b) ? b : isStatic.has(a) ? b : a;           // the moving body of the pair (an events:true body wins)
        events.push([s + 1, a, b, r6(prev.get(dyn) ?? 0)]);
      });
    }
    frames.push(row()); prev = speeds();
    if (onStep) onStep(s + 1, world, bodies);
  }
  const stepMs = performance.now() - T1;
  events.sort((x, y) => x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : x[2] < y[2] ? -1 : 1));
  const version = typeof RAPIER.version === 'function' ? RAPIER.version() : 'unknown';
  const sizeOf = (b) => b.size || (b.shape.type === 'cuboid' ? b.shape.half.map((h) => r6(2 * h)) : b.shape.type === 'ball' ? [r6(2 * b.shape.radius), r6(2 * b.shape.radius), r6(2 * b.shape.radius)] : [r6(2 * b.shape.radius), r6(2 * (b.shape.halfHeight + (b.shape.type === 'capsule' ? b.shape.radius : 0))), r6(2 * b.shape.radius)]);
  const table = {
    format: FORMAT,
    meta: { engine: '@dimforge/rapier3d-compat', engineVersion: version, scene: spec.scene, seed: spec.prng ? spec.prng.seed : null, step: dt, steps, decimals: 6, sets,
            bodies: bodies.map((b) => (b.tint === undefined ? { id: b.id, kind: b.kind, born: b.born, size: sizeOf(b) } : { id: b.id, kind: b.kind, born: b.born, size: sizeOf(b), tint: b.tint })), events },
    frames,
  };
  world.free();
  return { table, stats: { initMs, stepMs, bodies: bodies.length, rows: frames.length, events: events.length } };
}

/* stable text: meta on one line, one frame row per line (diff-friendly, gzip-friendly) */
export function tableToJSON(table) {
  return '{"format":' + JSON.stringify(table.format) + ',"meta":' + JSON.stringify(table.meta) + ',"frames":[\n' + table.frames.map((r) => JSON.stringify(r)).join(',\n') + '\n]}\n';
}

/* ---------------- CLI (Node only) ---------------- */
if (typeof process !== 'undefined' && process.argv && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] || '').href) {
  const fs = await import('node:fs'), path = await import('node:path'), crypto = await import('node:crypto'), zlib = await import('node:zlib'), { fileURLToPath } = await import('node:url');
  const HERE = path.dirname(fileURLToPath(import.meta.url)), argv = process.argv.slice(2), sets = [];
  let specPath = path.join(HERE, 'examples', 'scatter-drop.spec.json'), out = path.join(HERE, 'examples', 'scatter-drop.table.json');
  for (let i = 0; i < argv.length; i++) { if (argv[i] === '--spec') specPath = path.resolve(argv[++i]); else if (argv[i] === '--out') out = path.resolve(argv[++i]); else if (argv[i] === '--set') sets.push(argv[++i]); }
  const RAPIER = (await import('@dimforge/rapier3d-compat')).default;
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const { table, stats } = await bake(RAPIER, spec, { sets });
  const text = tableToJSON(table);
  fs.writeFileSync(out, text);
  const sha = crypto.createHash('sha256').update(text).digest('hex');
  console.log(`${path.basename(out)} sha256 ${sha} bytes ${Buffer.byteLength(text)} gzip ${zlib.gzipSync(text, { level: 9 }).length} init_ms ${stats.initMs.toFixed(1)} step_ms ${stats.stepMs.toFixed(1)} bodies ${stats.bodies} events ${stats.events} engine ${table.meta.engineVersion}`);
}
