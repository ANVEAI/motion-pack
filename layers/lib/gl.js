/* motion-pack / layers: tiny WebGL2 helpers (program with typed uniform setter, float render targets, fullscreen triangle). Owned code. */
export function getGL(canvas, attrs = {}) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, premultipliedAlpha: true, ...attrs });
  if (!gl) throw new Error('WebGL2 unavailable');
  gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
  return gl;
}
export class Prog {
  constructor(gl, vs, fs, name = 'prog') {
    this.gl = gl; this.name = name; const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`${name}: ${gl.getShaderInfoLog(s)}\n${src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n')}`); return s; };
    this.p = gl.createProgram(); gl.attachShader(this.p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(this.p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(this.p);
    if (!gl.getProgramParameter(this.p, gl.LINK_STATUS)) throw new Error(`${name}: link ${gl.getProgramInfoLog(this.p)}`);
    this.u = {}; const n = gl.getProgramParameter(this.p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(this.p, i), nm = a.name.replace(/\[0\]$/, ''); this.u[nm] = { loc: gl.getUniformLocation(this.p, a.name), type: a.type, size: a.size }; }
  }
  use() { this.gl.useProgram(this.p); return this; }
  has(n) { return n in this.u; }
  set(n, v) {
    const e = this.u[n]; if (!e) return this; const gl = this.gl, T = gl;
    switch (e.type) {
      case T.FLOAT: e.size > 1 ? gl.uniform1fv(e.loc, v) : gl.uniform1f(e.loc, +v); break;
      case T.FLOAT_VEC2: gl.uniform2fv(e.loc, v.flat ? Float32Array.from(v.flat(2)) : v); break;
      case T.FLOAT_VEC3: gl.uniform3fv(e.loc, Float32Array.from(v.flat(2))); break;
      case T.FLOAT_VEC4: gl.uniform4fv(e.loc, Float32Array.from(v.flat(2))); break;
      case T.INT: case T.SAMPLER_2D: gl.uniform1i(e.loc, v | 0); break;
      case T.UNSIGNED_INT: gl.uniform1ui(e.loc, v >>> 0); break;
      default: throw new Error(`${this.name}: unsupported uniform type ${e.type} for ${n}`);
    }
    return this;
  }
  setAll(o) { for (const k in o) this.set(k, o[k]); return this; }
}
export function makeTex(gl, w, h, { float = true, filter = 'linear' } = {}) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  const f = filter === 'linear' ? gl.LINEAR : gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
export function makeRT(gl, w, h, opts) {
  const tex = makeTex(gl, w, h, opts), fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete');
  return { tex, fb, w, h };
}
export function bindTex(gl, unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
export function draw(gl, rt, w, h) { gl.bindFramebuffer(gl.FRAMEBUFFER, rt ? rt.fb : null); gl.viewport(0, 0, rt ? rt.w : w, rt ? rt.h : h); gl.drawArrays(gl.TRIANGLES, 0, 3); }
/* deterministic helpers shared by finisher / overlay */
export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
