/* motion-pack / transitions / lib / tx-gl.js
   WebGL runner for the owned transition shaders. Sources = any texImage2D source (canvas, img, video, ImageBitmap).
   render({key, from, to, p, params}) draws one frame from p alone (seek-safe; the only state is the program cache
   and the mask-texture cache, both keyed by their inputs).

   const tx = createTxRenderer(canvas);
   tx.render({ key: 'whip', from: shotA, to: shotB, p: 0.42, params: { dir: [1, 0] } });                   */
import { REGISTRY } from './registry.js';
import { PRELUDE, VERT, SHADERS, PASSTHROUGH } from './tx-shaders.js';
import { ease, resolveParams, hexToRgb, matchPose } from './tx-core.js';

/** Convert one param value to a uniform setter call. */
function setUniform(gl, loc, spec, v) {
  if (loc == null) return;
  switch (spec.type) {
    case 'float': gl.uniform1f(loc, +v); break;
    case 'bool': gl.uniform1f(loc, v ? 1 : 0); break;
    case 'enum': { const i = spec.opts.indexOf(v); if (i < 0) throw new Error(`bad enum value ${v}`); gl.uniform1f(loc, i); break; }
    case 'color': gl.uniform3fv(loc, hexToRgb(v)); break;
    case 'vec2': gl.uniform2fv(loc, v); break;
    case 'vec4': gl.uniform4fv(loc, v); break;
    default: break;   // text: JS only
  }
}

// ---------- derived uniforms (transitions that need JS-side solving) ----------
const maskCache = new Map();
/** Text mask canvas (white on black) the size of the frame + an auto anchor inside the thickest stroke near centre. */
export function textMask(text, W, H, { weight = 900, fill = 0.8, family = 'Helvetica Neue, Helvetica, Arial, sans-serif' } = {}) {
  const key = [text, W, H, weight, fill, family].join('|');
  if (maskCache.has(key)) return maskCache.get(key);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  let size = H * 0.5; g.font = `${weight} ${size}px ${family}`;
  const m0 = g.measureText(text); size = Math.min(size * (W * fill) / Math.max(1, m0.width), H * 0.62); g.font = `${weight} ${size}px ${family}`;
  const m = g.measureText(text), asc = m.actualBoundingBoxAscent || size * 0.72, desc = m.actualBoundingBoxDescent || 0;
  g.fillText(text, W / 2, H / 2 + (asc - desc) / 2);
  // auto anchor: chamfer distance transform on a coarse grid; pick max inscribed radius, ties broken toward centre
  const gw = 192, gh = Math.max(8, Math.round(192 * H / W)), sm = document.createElement('canvas'); sm.width = gw; sm.height = gh;
  const sg = sm.getContext('2d'); sg.drawImage(c, 0, 0, gw, gh); const px = sg.getImageData(0, 0, gw, gh).data;
  const D = new Float32Array(gw * gh); for (let i = 0; i < gw * gh; i++) D[i] = px[i * 4] > 127 ? 1e9 : 0;
  const pass = (x, y, dx, dy, w) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) return 0; return D[yy * gw + xx] + w; };
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x; if (D[i]) D[i] = Math.min(D[i], pass(x, y, -1, 0, 1), pass(x, y, 0, -1, 1), pass(x, y, -1, -1, 1.414), pass(x, y, 1, -1, 1.414)); }
  for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) { const i = y * gw + x; if (D[i]) D[i] = Math.min(D[i], pass(x, y, 1, 0, 1), pass(x, y, 0, 1, 1), pass(x, y, 1, 1, 1.414), pass(x, y, -1, 1, 1.414)); }
  let best = -1, ax = 0.5, ay = 0.5;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const v = D[y * gw + x] - 0.02 * Math.hypot(x / gw - 0.5, y / gh - 0.5) * gw; if (v > best) { best = v; ax = (x + 0.5) / gw; ay = (y + 0.5) / gh; } }
  const out = { canvas: c, anchor: [ax, ay] }; maskCache.set(key, out); return out;
}

export const DERIVE = {
  match(p, P, ctx) {
    const a = { x: P.anchorA[0], y: P.anchorA[1], scale: P.anchorA[2], rot: P.anchorA[3] }, b = { x: P.anchorB[0], y: P.anchorB[1], scale: P.anchorB[2], rot: P.anchorB[3] };
    const o = { cut: ctx.cut, lead: P.lead, settle: P.settle, meet: P.meet }, dp = 0.5 / Math.max(1, ctx.frames);
    const at = q => { const s = matchPose(a, b, Math.min(1, Math.max(0, q)), o); return s; };
    const p1 = at(p), side = q => (q < ctx.cut) === (p < ctx.cut) ? at(q) : p1;    // never blur across the cut
    const v = s => [s.at.x, s.at.y, s.k, s.rot], an = p1.anchor;
    const M = P.meet === 'B' ? b : P.meet === 'A' ? a : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return { uniforms: { uPose0: v(side(p - dp)), uPose1: v(p1), uPose2: v(side(p + dp)), uAnc: [an.x, an.y], uWhich: p1.shot === 'A' ? 0 : 1, uMeet: [M.x, M.y, 0, 0] } };
  },
  maskReveal(p, P, ctx) {
    const m = textMask(P.text, ctx.width, ctx.height, { weight: P.weight, fill: P.fill });
    const anchor = P.anchor[0] < 0 ? m.anchor : P.anchor;
    return { mask: m.canvas, uniforms: { uAnchor: anchor } };
  },
};

export function createTxRenderer(canvas, { webgl1 = false } = {}) {
  const attrs = { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false, depth: false };
  const gl = (!webgl1 && canvas.getContext('webgl2', attrs)) || canvas.getContext('webgl', attrs);
  if (!gl) throw new Error('WebGL unavailable');
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const tex = [0, 1, 2].map(() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); return t; });
  const programs = new Map();
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader compile: ' + gl.getShaderInfoLog(s)); return s; };
  function program(key) {
    if (programs.has(key)) return programs.get(key);
    const body = key === '__pass' ? PASSTHROUGH : SHADERS[key];
    if (!body) throw new Error(`no GL shader for '${key}'`);
    const pr = gl.createProgram(); gl.attachShader(pr, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, PRELUDE + body));
    gl.bindAttribLocation(pr, 0, 'aPos'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(`link ${key}: ` + gl.getProgramInfoLog(pr));
    const loc = n => gl.getUniformLocation(pr, n), out = { pr, loc, cache: {} };
    out.u = n => (n in out.cache ? out.cache[n] : (out.cache[n] = loc(n)));
    programs.set(key, out); return out;
  }
  function upload(unit, src) {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex[unit]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }
  /** Draw one transition frame. p is linear progress (0..1); dur_s defaults to the registry ms. */
  function render({ key, from, to, p, params = {}, dur_s = null, seed = 1, easeName = null, cut = null, fps = 30 }) {
    const entry = REGISTRY[key]; if (!entry) throw new Error(`unknown transition '${key}'`);
    const P = resolveParams(entry, params), pc = Math.min(1, Math.max(0, p));
    const W = canvas.width, H = canvas.height, dur = dur_s ?? entry.timing.ms / 1000, cp = cut ?? entry.timing.cut;
    const endpoint = pc <= 0 || pc >= 1, pg = program(endpoint ? '__pass' : key);
    gl.viewport(0, 0, W, H); gl.useProgram(pg.pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    upload(0, from); upload(1, to);
    gl.uniform1i(pg.u('uFrom'), 0); gl.uniform1i(pg.u('uTo'), 1); gl.uniform1i(pg.u('uMask'), 2);
    gl.uniform1f(pg.u('uP'), pc); gl.uniform1f(pg.u('uE'), ease(easeName || entry.timing.ease, pc)); gl.uniform1f(pg.u('uCut'), cp);
    gl.uniform2f(pg.u('uRes'), W, H); gl.uniform1f(pg.u('uSeed'), seed); gl.uniform1f(pg.u('uDur'), dur);
    if (!endpoint) {
      for (const [k, spec] of Object.entries(entry.params)) setUniform(gl, pg.u('u_' + k), spec, P[k]);
      const d = DERIVE[key] && DERIVE[key](pc, P, { cut: cp, frames: Math.round(dur * fps), width: W, height: H });
      if (d) {
        if (d.mask) upload(2, d.mask);
        for (const [n, v] of Object.entries(d.uniforms || {})) { const l = pg.u(n); if (l == null) continue;
          if (typeof v === 'number') gl.uniform1f(l, v); else if (v.length === 2) gl.uniform2fv(l, v); else if (v.length === 3) gl.uniform3fv(l, v); else gl.uniform4fv(l, v); }
      }
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  /** Compile every GL shader now (fail fast at load, not mid-render). Returns the list of keys compiled. */
  function compileAll() { const ok = []; for (const k of Object.keys(SHADERS)) { program(k); ok.push(k); } program('__pass'); return ok; }
  return { gl, render, compileAll, programs };
}
