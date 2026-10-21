/* motion-pack/objects/lib/mat.js: shared helpers + the LIMITED MATERIAL SET (docs/evidence/visual.md 6.1 "premium, not toy").
   Helpers v3/linCol/std/canvasTex/softRectTex are the kit's (props.js lines 8-12), moved here so every prop shares them.
   Rules baked into MAT: whites <= 0.85 linear albedo, blacks >= 0.03, roughness never 0, clearcoat for satin plastics, metals F0 ~0.9.
   Every material factory returns a NEW material (props mutate colours per frame). */
import * as THREE from 'three';

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const linCol = (k) => new THREE.Color().setRGB(k[0], k[1], k[2], THREE.LinearSRGBColorSpace);
export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
export function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; }
export function softRectTex(rx = 22, blur = 26) { return canvasTex(512, 512, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); g.filter = `blur(${blur}px)`; g.fillStyle = '#fff'; g.beginPath(); g.roundRect(110, 110, 292, 292, rx); g.fill(); }, false); }
export function radialTex(n = 128) { return canvasTex(n, n, (g) => { const gr = g.createRadialGradient(n / 2, n / 2, n / 32, n / 2, n / 2, n / 2 - 2); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }, false); }

/* seeded value noise into a roughness/bump map (imperfection rule: roughness +-0.08) */
export function grainTex(seed = 1, n = 256, amp = 0.08, base = 0.5) {
  let s = seed >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return canvasTex(n, n, (g) => { const im = g.createImageData(n, n); for (let i = 0; i < n * n; i++) { const v = Math.round(255 * Math.min(1, Math.max(0, base + (r() * 2 - 1) * amp))); im.data[4 * i] = im.data[4 * i + 1] = im.data[4 * i + 2] = v; im.data[4 * i + 3] = 255; } g.putImageData(im, 0, 0); }, false);
}

/* the material set (colour is a design hex; the kit's white balance + exposure return it on screen) */
export const MAT = {
  clay: (hex = '#d9d4cc', o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.70, metalness: 0, sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffffff'), ...o }),
  satin: (hex = '#f3f1ec', o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.38, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.28, ...o }),
  ceramic: (hex = '#f2efe8', o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.22, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.08, ...o }),
  anodised: (hex = '#b9bcc2', o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.30, metalness: 1.0, ...o }),
  darkMetal: (hex = '#2b2c30', o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.34, metalness: 0.85, ...o }),
  glass: (o = {}) => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.06, metalness: 0, transmission: 0.9, ior: 1.45, thickness: 0.02, transparent: true, ...o }),
  blackGlass: (o = {}) => new THREE.MeshPhysicalMaterial({ color: '#0b0b0d', roughness: 0.06, metalness: 0, clearcoat: 1.0, clearcoatRoughness: 0.04, ...o }),
  rubber: (hex = '#1c1c1f', o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.82, metalness: 0, ...o }),
  paper: (hex = '#f6f4ef', o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0, ...o }),
  ink: (hex = '#121018', o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.18, metalness: 0, clearcoat: 1.0, clearcoatRoughness: 0.08, ...o }),
  liquid: (hex = '#3b2416', o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.04, metalness: 0, clearcoat: 1.0, clearcoatRoughness: 0.02, ...o }),
};

/* rounded-rectangle Shape centred on 0 (w x h, corner r) */
export function rrShape(w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2); s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2); s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5); return s; }
/* planar UVs from x/y (for faces of extrusions) */
export function planarUV(geo, sx, sy, ox, oy) { const p = geo.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[2 * i] = p.getX(i) * sx + ox; uv[2 * i + 1] = p.getY(i) * sy + oy; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
/* a bevelled rounded slab: footprint w x h (in XY), thickness d along Z, centred; bevel b (premium rule: 2..4% of the smallest dimension) */
export function slabGeo(w, h, d, r, b = Math.max(0.002, 0.03 * Math.min(w, h, d)), curve = 16) {
  b = Math.min(b, d / 2.2, r * 0.9); const geo = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, Math.max(0.0005, r - b)), { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: curve });
  geo.translate(0, 0, -(d - 2 * b) / 2); return geo;
}
/* a printed face plane with rounded corners (UV 0..1 over w x h) */
export function faceGeo(w, h, r, curve = 12) { const g = new THREE.ShapeGeometry(rrShape(w, h, r), curve); planarUV(g, 1 / w, 1 / h, 0.5, 0.5); return g; }
/* lathe from a [r, y] profile with smooth normals */
export function latheGeo(pts, seg = 96) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg); }
