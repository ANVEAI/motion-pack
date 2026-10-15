/* motion-pack/objects/lib/hwplate.js (xp-hardware, 2026-10-16): the three.js PLATE of a hardware film, driven by the plan (objects/lib/hwshots.js director).
     <script type="module"> import { runHwPlate } from './objects/lib/hwplate.js'; runHwPlate(await (await fetch('out/plate.json')).json()); </script>
   plate.json: { name, seconds, fps, aspect, paper, accent, device: nodeSpec overrides, shots3d: [...], media: { model: {src}, photo: {src, depth} } }
   Builds the dark studio + rim / top / sweep rig, the device (the generic node, or YOUR model from media.model.src), the desk props for the scale shot (the pack's
   laptop and mug), a cable for the ports shot and an x-ray of the shell. A photo (media.photo.src) replaces the device in the hero / spin / card / end shots as a
   2.5D plate; the shots that need real geometry (explode, ports, inside) keep the generic device, which the template labels. Implements the kit render contract
   (runScene): tools/render.mjs renders it on the GPU with 4 subframes; every value comes from the director at t. */
import { runScene } from '../kit/studio-lite.js';
import { stageConfig } from '../stage.js';
import { makeDarkStudio, makeHwRig } from './studio-hw.js';
import { makeNode, makeCable } from './hardware.js';
import { makeXray } from './xray.js';
import { loadModel, makePhotoParallax } from './hwmedia.js';
import { makeLaptop, makeMug } from './devices.js';
import { director } from './hwshots.js';
import { MAT, grainTex } from './mat.js';
import * as THREE from 'three';

const PHOTO_KINDS = new Set(['hero', 'spin', 'card', 'end']);
export async function runHwPlate(P) {
  const D = director(P), L = D.layout, fps = P.fps || 30;
  window.CONFIG = stageConfig({ name: P.name || 'hw-plate', seconds: P.seconds, fps, qaFrames: P.qaFrames || [], colors: { backdrop: P.paper || '#07080a' }, lights: { key: { kelvin: 5600 } },
    grade: { vignette: 0.22, dofK: 12, dofMax: 3.0, bloom: 0.75, grain: 0.012, ...(P.grade || {}) } });
  const st = {};
  runScene({
    async build(ctx) {
      st.studio = makeDarkStudio(ctx, { paper: P.paper || '#07080a' }); st.rig = makeHwRig(ctx, { target: [0, 0.15, 0] }); const G = st.studio.parent;
      const m = P.media || {};
      if (m.model && m.model.src) { st.model = await loadModel(ctx, G, m.model.src, { size: m.model.size ?? L.spec.w, axis: m.model.axis || 'w', yaw: m.model.yaw || 0 }); }
      st.node = makeNode(ctx, G, P.device || {});
      if (st.model) st.node.group.visible = false;
      if (m.photo && m.photo.src) st.photo = await makePhotoParallax(ctx, G, { src: m.photo.src, depth: m.photo.depth || null, w: m.photo.w ?? L.spec.w * 1.25, amount: m.photo.amount ?? 0.1 });
      // desk props (scale shot): a dark walnut desk top, the pack's laptop and mug
      const desk = new THREE.MeshPhysicalMaterial({ color: '#2a2119', roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4, roughnessMap: grainTex(19, 256, 0.08, 0.55) });
      st.desk = ctx.add(G, new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.04, 3.0), desk), { recv: true, cast: false, name: 'desk' }); st.desk.position.set(0.4, -0.02, 0.1);
      st.laptop = makeLaptop(ctx, G, { color: '#9da1a8' }); st.laptop.pose([1.55, 0, 0.12], -0.18); st.laptop.set({ open: 0.92, screen: 0.0 });
      st.mug = makeMug(ctx, G, {}); st.mug.group.position.set(-0.95, 0, 0.42);
      const p1 = L.ports[1] || L.ports[0];
      st.cable = makeCable(ctx, G, { from: [-p1.x + 0.4, 0.0, -1.7], to: [-p1.x, p1.y + L.foot, -L.spec.d / 2 - 0.006], dir: [0, 0, 1], plug: p1.kind, color: '#1a1b1f' });
      st.xray = makeXray(ctx, st.node.parts.shell, { color: P.accent || '#5cc8ff', ghost: 0.06 });
      st.xrayTop = makeXray(ctx, st.node.parts.top, { color: P.accent || '#5cc8ff', ghost: 0.06 });
      ctx.probes = { shell: st.node.probes.shell, band: st.node.probes.band };
    },
    update(ctx, t, n, slot) {
      const S = D.stateAt(t); if (!S) return;
      st.rig.update(n, slot, S.lights);
      const usePhoto = st.photo && PHOTO_KINDS.has(S.kind), dev = st.model && S.kind !== 'explode' && S.kind !== 'inside' && S.kind !== 'ports' ? 'model' : 'node';
      st.node.group.visible = !usePhoto && (dev === 'node' || !st.model);
      if (st.model) { st.model.group.visible = !usePhoto && dev === 'model'; st.model.pose(S.pose.p, S.pose.yaw); st.model.applyExplode(null); }
      if (st.photo) { st.photo.group.visible = usePhoto; st.photo.pose([0, S.pose.p[1], 0], 0); }
      st.node.pose(S.pose.p, S.pose.yaw);
      st.node.set({ band: S.band, bandSweep: S.bandSweep, explode: S.explode, die: S.die, dieGlow: S.dieGlow, fanSpin: S.fanSpin, accent: P.accent, cardGlow: S.kind === 'explode' || S.kind === 'inside' ? 0.8 : 0 });
      const wire = S.xray ?? 0; st.xray.set(1 - wire); st.xrayTop.set(1 - wire);
      for (const k of ['desk', 'laptop', 'mug']) { const o = st[k].group || st[k]; o.visible = !!S.show[k]; }
      st.cable.group.visible = !!S.show.cable; if (S.show.cable) st.cable.set({ insert: S.cable });
    },
    camera(ctx, t) { return D.cameraAt(t); },
    focus(ctx, t) { const S = D.stateAt(t), c = D.cameraAt(t); return S && S.kind === 'inside' ? [c.target[0], c.target[1], c.target[2]] : [c.target[0], Math.max(0.12, c.target[1]), c.target[2] + 0.1]; },
    subframes() { return 4; },
  });
}
