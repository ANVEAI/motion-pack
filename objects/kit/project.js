/* motion-pack/objects/kit/project.js (xp-hardware, 2026-10-16): the kit camera rig as PURE maths (no three.js, no DOM), so node can compute where a 3D point lands
   in the rendered plate. A HyperFrames overlay (a spec callout's leader line, a dimension line, an edge flare) then follows the 3D object frame for frame without
   reading pixels back from the browser.
   It mirrors kit/core.js rig(): orbit about `target` (az, elev in degrees, dist * (1 - punch)), lookAt with +Y up, vertical `fov`, and the lens shift
   (setViewOffset) that puts the look-at on the `screen` pixel. Subframe jitter is not modelled (it is a quarter pixel).
     camBasis(c) -> { pos, fwd, right, up, f }        project(c, p, W, H) -> [px, py, depth]   (depth > 0 = in front of the camera)
   Checked against the page's own window.__project in objects/tests/hw.browser.mjs (max error well under a pixel at 1080p). */
const rad = (d) => (d * Math.PI) / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function camBasis(c) {
  const el = rad(c.elev), az = rad(c.az), d = c.dist * (1 - (c.punch || 0)), T = c.target;
  const pos = [T[0] + d * Math.sin(az) * Math.cos(el), T[1] + d * Math.sin(el), T[2] + d * Math.cos(az) * Math.cos(el)];
  const fwd = norm(sub(T, pos)), right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  return { pos, fwd, right, up, f: 1 / Math.tan(rad(c.fov) / 2) };
}

/* world point -> output pixel (x right, y down), plus the view depth. W, H = the plate size; c.screen is in the same pixels. */
export function project(c, p, W, H, B = camBasis(c)) {
  const v = sub(p, B.pos), z = dot(v, B.fwd), x = dot(v, B.right), y = dot(v, B.up);
  const ndcX = (x / z) * B.f / (W / H), ndcY = (y / z) * B.f, sc = c.screen || [W / 2, H / 2];
  return [(ndcX * 0.5 + 0.5) * W + (sc[0] - W / 2), (1 - (ndcY * 0.5 + 0.5)) * H + (sc[1] - H / 2), z];
}

/* a point in an object's local frame -> world, for a base-centre pose { p: [x, y, z], yaw (rad), s (uniform scale) } (rotation about +Y, then translation) */
export function poseApply(pose, q) {
  const s = pose.s ?? 1, c = Math.cos(pose.yaw || 0), si = Math.sin(pose.yaw || 0), x = q[0] * s, y = q[1] * s, z = q[2] * s, P = pose.p || [0, 0, 0];
  return [P[0] + c * x + si * z, P[1] + y, P[2] - si * x + c * z];
}
