/* motion-pack/objects/lib/hwmedia.js (xp-hardware, 2026-10-16): drop in YOUR OWN product (a GLB / glTF / OBJ model, or product photos) instead of the generic device.
     const M = await loadModel(ctx, parent, '/abs/or/served/path/device.glb', { size: 1.0, axis: 'w' });   -> { group, parts: {name: Group}, explode: parts list, bbox, probes }
     const P = await makePhotoParallax(ctx, parent, { src: 'hero.png', depth: null | 'depth.png', w: 1.4, amount: 0.12 });   a 2.5D plate from ONE still
   loadModel: the model is centred on its footprint, stood on y = 0 and scaled so its width (axis 'w'), height ('h') or largest side ('max') is `size` kit units
   (1 ~ 25 cm). Its top-level children become explode parts (each moves away from the model centre along the line from the centre to its own centre, so any
   multi-part model gets an exploded view); a model with one mesh gets none. Materials are kept; metals get the studio's chrome env when they have none.
   makePhotoParallax: the photo on a subdivided plane displaced by a depth map (white = near). With no depth map it uses a soft elliptical bulge plus the
   photo's own alpha (a cut-out PNG separates from its background), which gives a believable few degrees of parallax for a camera push or orbit. The caller
   LABELS the result (the templates print "your photo, 2.5D" or "placeholder"): a single still cannot show sides it does not have, so keep orbits under ~8 degrees.
   Loaders come from three@0.160.0/examples/jsm (the kit's pinned importmap); every value after loading is static: seek-safe. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export async function loadModel(ctx, parent, url, o = {}) {
  o = { size: 1.0, axis: 'w', yaw: 0, explodeDist: 0.35, ...o };
  const ext = String(url).split('?')[0].split('.').pop().toLowerCase();
  let obj;
  if (ext === 'obj') obj = await new OBJLoader().loadAsync(url);
  else obj = (await new GLTFLoader().loadAsync(url)).scene;
  const root = new THREE.Group(); parent.add(root); const norm = new THREE.Group(); root.add(norm); norm.add(obj); obj.rotation.y = o.yaw;
  obj.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(obj, true), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  const ref = o.axis === 'h' ? size.y : o.axis === 'max' ? Math.max(size.x, size.y, size.z) : size.x, k = o.size / Math.max(1e-6, ref);
  norm.scale.setScalar(k); norm.position.set(-c.x * k, -bb.min.y * k, -c.z * k);
  const meshes = []; obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; meshes.push(m); const mats = Array.isArray(m.material) ? m.material : [m.material]; for (const mt of mats) if (mt && mt.metalness > 0.5 && !mt.envMap && ctx.metalEnv) mt.envMap = ctx.metalEnv; } });
  // explode parts: the top-level children (wrapped so a part group can be offset without touching the model's own transforms)
  const kids = obj.children.filter((ch) => { let has = false; ch.traverse((m) => { if (m.isMesh) has = true; }); return has; });
  const parts = {}, explode = [], centre = new THREE.Vector3(0, size.y * k / 2, 0);
  root.updateMatrixWorld(true);
  if (kids.length > 1) kids.slice(0, 32).forEach((ch, i) => {
    const id = (ch.name || 'part' + i).replace(/[^\w.-]/g, '_') + (parts[ch.name] ? '_' + i : '');
    const wrap = new THREE.Group(); ch.parent.add(wrap); wrap.add(ch); parts[id] = wrap;
    const cb = new THREE.Box3().setFromObject(ch, true).getCenter(new THREE.Vector3()), dir = cb.sub(centre); if (dir.length() < 1e-4) dir.set(0, 1, 0);
    dir.normalize(); explode.push({ id, dir: [dir.x, dir.y * 1.3, dir.z], dist: o.explodeDist * o.size, order: i });
  });
  // the wrappers live in the model's own (scaled) space: parts offsets from explodeAt() are in kit units, so divide by k when applying (applyExplode does it)
  const api = { group: root, model: obj, parts, explode, scale: k, size: [size.x * k, size.y * k, size.z * k], meshes, probes: { model: obj },
    pose(p = [0, 0, 0], yaw = 0, sc = 1) { root.position.set(p[0], p[1], p[2]); root.rotation.set(0, yaw, 0); root.scale.setScalar(sc); },
    /* offs = explodeAt() result: offsets in kit units in the model's root frame -> each wrapper's frame (the model's yaw undone, its scale divided out) */
    applyExplode(offs) { const cy = Math.cos(-o.yaw), sy = Math.sin(-o.yaw);
      for (const [id, g] of Object.entries(parts)) { const x = offs && offs[id]; if (!x) { g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); continue; }
        const [ox, oy, oz] = x.off; g.position.set((cy * ox + sy * oz) / k, oy / k, (-sy * ox + cy * oz) / k); g.rotation.set(x.rot[0], x.rot[1], x.rot[2]); } } };
  return api;
}

function depthFromAlpha(img, n = 128) {
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.drawImage(img, 0, 0, n, n); const d = g.getImageData(0, 0, n, n).data, out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const u = x / (n - 1) - 0.5, v = y / (n - 1) - 0.5, bulge = Math.max(0, 1 - (u * u) / 0.22 - (v * v) / 0.22); out[y * n + x] = (d[(y * n + x) * 4 + 3] / 255) * (0.35 + 0.65 * Math.sqrt(bulge)); }
  return { n, out };
}
function depthFromMap(img, n = 128) {
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.drawImage(img, 0, 0, n, n); const d = g.getImageData(0, 0, n, n).data, out = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) out[i] = d[i * 4] / 255; return { n, out };
}
export async function makePhotoParallax(ctx, parent, o = {}) {
  o = { src: null, depth: null, w: 1.4, amount: 0.12, segs: 127, ...o };
  const tl = new THREE.TextureLoader(), tex = await tl.loadAsync(o.src); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const img = tex.image, aspect = img.height / img.width, h = o.w * aspect;
  const D = o.depth ? depthFromMap((await tl.loadAsync(o.depth)).image, o.segs + 1) : depthFromAlpha(img, o.segs + 1);
  const geo = new THREE.PlaneGeometry(o.w, h, o.segs, o.segs), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const ix = i % (o.segs + 1), iy = Math.floor(i / (o.segs + 1)); pos.setZ(i, D.out[iy * D.n + ix] * o.amount); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, toneMapped: false }); mat.color.copy(ctx.emis('#ffffff', 1));
  const g = new THREE.Group(); parent.add(g); const m = ctx.add(g, new THREE.Mesh(geo, mat), { cast: false, recv: false, name: 'photo' }); m.position.y = h / 2;
  return { group: g, mesh: m, size: [o.w, h], probes: { photo: m }, pose(p = [0, 0, 0], yaw = 0) { g.position.set(p[0], p[1], p[2]); g.rotation.set(0, yaw, 0); } };
}
