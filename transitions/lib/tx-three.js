/* motion-pack / transitions / lib / tx-three.js
   three.js adapter for the v9 studio kit (and any three scene): the same GLSL as tx-gl.js on a full-screen quad.
   Render shot A and shot B into two WebGLRenderTargets, then:

   import { makeTransitionPass } from '../motion-pack/transitions/lib/tx-three.js';
   const pass = makeTransitionPass(THREE, 'whip', { dir: [1, 0] });
   pass.set({ from: rtA.texture, to: rtB.texture, p, width: W, height: H });   // pure: call per frame from renderAt(t)
   renderer.setRenderTarget(null); renderer.render(pass.scene, pass.camera);

   Render-target textures are already GL-oriented, which is what the shaders expect. For a canvas/image texture set
   texture.flipY = true (three's default for Texture) so orientation matches. GL-only keys work here; 'speedRamp'
   is a curve (tx-core.speedRamp), not a pass. Text masks for maskReveal come from tx-gl.textMask (DOM canvas). */
import { REGISTRY } from './registry.js';
import { PRELUDE, SHADERS, VERT_THREE, PASSTHROUGH } from './tx-shaders.js';
import { ease, resolveParams, hexToRgb } from './tx-core.js';
import { DERIVE } from './tx-gl.js';

function toUniformValue(THREE, spec, v) {
  switch (spec.type) {
    case 'bool': return v ? 1 : 0;
    case 'enum': return spec.opts.indexOf(v);
    case 'color': return new THREE.Vector3(...hexToRgb(v));
    case 'vec2': return new THREE.Vector2(v[0], v[1]);
    case 'vec4': return new THREE.Vector4(v[0], v[1], v[2], v[3]);
    case 'text': return undefined;
    default: return +v;
  }
}
const vecOf = (THREE, v) => typeof v === 'number' ? v : v.length === 2 ? new THREE.Vector2(...v) : v.length === 3 ? new THREE.Vector3(...v) : new THREE.Vector4(...v);

export function makeTransitionPass(THREE, key, params = {}, { seed = 1, dur_s = null, easeName = null, cut = null, fps = 30 } = {}) {
  const entry = REGISTRY[key]; if (!entry || !SHADERS[key]) throw new Error(`'${key}' has no GL shader`);
  const P = resolveParams(entry, params), dur = dur_s ?? entry.timing.ms / 1000, cp = cut ?? entry.timing.cut;
  const uniforms = { uFrom: { value: null }, uTo: { value: null }, uMask: { value: null }, uP: { value: 0 }, uE: { value: 0 }, uCut: { value: cp },
    uRes: { value: new THREE.Vector2(1, 1) }, uSeed: { value: seed }, uDur: { value: dur },
    uPose0: { value: new THREE.Vector4() }, uPose1: { value: new THREE.Vector4() }, uPose2: { value: new THREE.Vector4() }, uAnc: { value: new THREE.Vector2() },
    uWhich: { value: 0 }, uMeet: { value: new THREE.Vector4() }, uAnchor: { value: new THREE.Vector2(0.5, 0.5) } };
  for (const [k, spec] of Object.entries(entry.params)) { const v = toUniformValue(THREE, spec, P[k]); if (v !== undefined) uniforms['u_' + k] = { value: v }; }
  // PRELUDE declares precision + varying; three prepends its own precision, which is compatible.
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT_THREE, fragmentShader: PRELUDE + SHADERS[key], depthTest: false, depthWrite: false });
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT_THREE, fragmentShader: PRELUDE + PASSTHROUGH, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); scene.add(mesh);
  let maskTex = null;
  function set({ from, to, p, width, height }) {
    const pc = Math.min(1, Math.max(0, p));
    uniforms.uFrom.value = from; uniforms.uTo.value = to; uniforms.uRes.value.set(width, height);
    // endpoints exact: p <= 0 -> A, p >= 1 -> B through the passthrough material (shaders assume 0 < p < 1)
    mesh.material = pc <= 0 || pc >= 1 ? pass : material;
    uniforms.uP.value = pc; uniforms.uE.value = ease(easeName || entry.timing.ease, pc);
    const d = DERIVE[key] && pc > 0 && pc < 1 && DERIVE[key](pc, P, { cut: cp, frames: Math.round(dur * fps), width, height });
    if (d) {
      for (const [n, v] of Object.entries(d.uniforms || {})) if (uniforms[n]) uniforms[n].value = vecOf(THREE, v);
      if (d.mask) { if (!maskTex || maskTex.image !== d.mask) { maskTex = new THREE.CanvasTexture(d.mask); maskTex.flipY = true; } uniforms.uMask.value = maskTex; }
    }
  }
  return { scene, camera, material, set, dispose: () => { material.dispose(); pass.dispose(); if (maskTex) maskTex.dispose(); } };
}
