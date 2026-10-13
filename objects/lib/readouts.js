/* PROVENANCE: extracted from kit/props.js makeCounter + makeReadout, the ANVE v10 film set's src/clock.js makeClock (2026-10-13). Behaviour unchanged unless noted; see objects/README.md. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { std, canvasTex } from './mat.js';

/* ---------- a drum counter on a stand: digits roll on a cylinder behind a window; a label beside it ---------- */
export function makeCounter(ctx, parent, o) {
  const g = new THREE.Group(); g.position.set(o.pos[0], 0, o.pos[2]); parent.add(g);
  const white = std(o.housing, { roughness: 0.5 }), black = std('#161616', { roughness: 0.45, metalness: 0.3 });
  ctx.add(g, new THREE.Mesh(new THREE.CylinderGeometry(o.baseR, o.baseR * 1.08, 0.04, 40), black), { cast: true }).position.y = 0.02;
  ctx.add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, o.y - o.size[1] / 2, 12), black), { cast: true }).position.y = (o.y - o.size[1] / 2) / 2;
  const head = new THREE.Group(); head.position.y = o.y; head.rotation.y = o.yaw; g.add(head);
  const [HW, HH, HD] = o.size, win = o.win, wx = -HW / 2 + o.winX;
  ctx.add(head, new THREE.Mesh(new RoundedBoxGeometry(HW, HH, HD * 0.7, 4, 0.04), white), { cast: true }).position.z = -HD * 0.15;
  const fz = HD / 2 - 0.02;                                                      // front plate pieces around the window
  const piece = (w, h, x, y) => { const m = ctx.add(head, new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.04, 2, 0.012), white), { cast: true }); m.position.set(x, y, fz); };
  piece(HW, (HH - win[1]) / 2, 0, (HH + win[1]) / 4); piece(HW, (HH - win[1]) / 2, 0, -(HH + win[1]) / 4);
  piece(wx - win[0] / 2 + HW / 2, win[1], (-HW / 2 + wx - win[0] / 2) / 2, 0); piece(HW / 2 - wx - win[0] / 2, win[1], (HW / 2 + wx + win[0] / 2) / 2, 0);
  // the drum face: a drum of radius 0.85 x window height drawn in 2D (digits ride up/down with cos-foreshortening and shading)
  const DC = document.createElement('canvas'); DC.width = 256; DC.height = Math.round(256 * win[1] / win[0]); const drumTex = new THREE.CanvasTexture(DC); drumTex.colorSpace = THREE.SRGBColorSpace; drumTex.anisotropy = 8;
  const drumMat = new THREE.MeshStandardMaterial({ map: drumTex, roughness: 0.5 }), drum = ctx.add(head, new THREE.Mesh(new THREE.PlaneGeometry(win[0], win[1]), drumMat), {});
  drum.position.set(wx, 0, fz - 0.006);
  let drumKey = '';
  function drawDrum(value, col) {
    const key = value.toFixed(4) + col; if (key === drumKey) return; drumKey = key;
    const g2 = DC.getContext('2d'), w = DC.width, h = DC.height, R = 0.85 * h, d0 = Math.floor(value + 1e-9), u = value - d0, PITCH = Math.PI / 5;
    g2.fillStyle = '#f7f5f0'; g2.fillRect(0, 0, w, h);
    for (const [dg, a] of [[d0 - 1, (u + 1) * PITCH], [d0, u * PITCH], [d0 + 1, (u - 1) * PITCH], [d0 + 2, (u - 2) * PITCH]]) {
      if (Math.abs(a) > Math.PI / 2 - 0.05) continue; const yc = h / 2 - R * Math.sin(a), sy = Math.cos(a);
      g2.save(); g2.translate(w / 2, yc); g2.scale(1, sy); g2.fillStyle = col; g2.font = `800 ${Math.round(h * 0.78)}px "Manrope"`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(String(((dg % 10) + 10) % 10), 0, h * 0.04); g2.restore();
    }
    const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(40,36,30,0.42)'); gr.addColorStop(0.22, 'rgba(40,36,30,0.0)'); gr.addColorStop(0.78, 'rgba(40,36,30,0.0)'); gr.addColorStop(1, 'rgba(40,36,30,0.46)'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
    drumTex.needsUpdate = true;
  }
  let labelTex = null, labelCol = '';
  const lab = ctx.add(head, new THREE.Mesh(new THREE.PlaneGeometry(o.labelSize[0], o.labelSize[1]), new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.7, depthWrite: false })), {});
  lab.position.set(o.labelX, 0, fz + 0.0215);
  const drawLabel = (col) => canvasTex(1024, Math.round(1024 * o.labelSize[1] / o.labelSize[0]), (gg, w, h) => { gg.clearRect(0, 0, w, h); gg.fillStyle = col; const px = Math.round(h * 0.34); gg.font = `600 ${px}px "IBM Plex Mono"`; gg.letterSpacing = (px * 0.06).toFixed(1) + 'px'; gg.textBaseline = 'alphabetic';
    o.label.forEach((ln, i) => gg.fillText(ln, 4, h * (0.44 + 0.44 * i))); });
  return {
    group: g, head, drum, label: lab,
    /* value in digits (fractional while rolling), colour hex for digits + label */
    set(value, col) {
      drawDrum(value, col);
      if (col !== labelCol) { labelCol = col; if (labelTex) labelTex.dispose(); labelTex = drawLabel(col); lab.material.map = labelTex; lab.material.needsUpdate = true; }
    },
  };
}

/* ---------- an ENGRAVED readout on a face (default for counters: no stand, no housing): a recessed panel, a rolling digit drum
   (radius 1.0 x window height, neighbours foreshortened by cos, 42% shading at the window edges) and a mono label. Lies in the
   parent's XY plane facing +z at o.pos (put it on the slab's front face: z = depth/2 + 0.001). ---------- */
export function makeReadout(ctx, parent, o) {
  const g = new THREE.Group(); g.position.set(...o.pos); parent.add(g);
  const [ww, wh] = o.win, [lw, lh] = o.labelSize, W0 = ww + o.gap + lw, H0 = Math.max(wh, lh), pad = o.pad, fontK = o.digitFont || 0.88;
  const pTex = canvasTex(1024, Math.round((1024 * (H0 + 2 * pad)) / (W0 + 2 * pad)), (gg, w, h) => {
    const r = h * 0.16; gg.clearRect(0, 0, w, h); gg.fillStyle = o.panel || '#eeebe5'; gg.beginPath(); gg.roundRect(2, 2, w - 4, h - 4, r); gg.fill();
    const sh = gg.createLinearGradient(0, 0, 0, h * 0.22); sh.addColorStop(0, 'rgba(60,52,40,0.16)'); sh.addColorStop(1, 'rgba(60,52,40,0)'); gg.save(); gg.beginPath(); gg.roundRect(2, 2, w - 4, h - 4, r); gg.clip(); gg.fillStyle = sh; gg.fillRect(0, 0, w, h * 0.22); gg.restore(); });
  const panel = ctx.add(g, new THREE.Mesh(new THREE.PlaneGeometry(W0 + 2 * pad, H0 + 2 * pad), new THREE.MeshStandardMaterial({ map: pTex, transparent: true, roughness: 0.6, depthWrite: false })), { recv: true });
  panel.position.z = 0.001; panel.renderOrder = 2;
  const DC = document.createElement('canvas'); DC.width = 256; DC.height = Math.round((256 * wh) / ww); const drumTex = new THREE.CanvasTexture(DC); drumTex.colorSpace = THREE.SRGBColorSpace; drumTex.anisotropy = 8;
  const drum = ctx.add(g, new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshStandardMaterial({ map: drumTex, roughness: 0.5 })), {}); drum.position.set(-W0 / 2 + ww / 2, 0, 0.002); drum.renderOrder = 3;
  const lab = ctx.add(g, new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.7, depthWrite: false })), {}); lab.position.set(-W0 / 2 + ww + o.gap + lw / 2, 0, 0.002); lab.renderOrder = 3;
  let drumKey = '', labelTex = null, labelCol = '';
  function drawDrum(value, col) {
    const key = value.toFixed(4) + col; if (key === drumKey) return; drumKey = key;
    const g2 = DC.getContext('2d'), w = DC.width, h = DC.height, R = 1.2 * h, d0 = Math.floor(value + 1e-9), u = value - d0, PITCH = Math.PI / 5;
    g2.fillStyle = '#f8f6f1'; g2.fillRect(0, 0, w, h);
    for (const [dg, a] of [[d0 - 1, (u + 1) * PITCH], [d0, u * PITCH], [d0 + 1, (u - 1) * PITCH], [d0 + 2, (u - 2) * PITCH]]) {
      if (Math.abs(a) > Math.PI / 2 - 0.05) continue; const yc = h / 2 - R * Math.sin(a), sy = Math.cos(a);
      g2.save(); g2.translate(w / 2, yc); g2.scale(1, sy); g2.fillStyle = col; g2.font = `800 ${Math.round(h * fontK)}px "Manrope"`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(String(((dg % 10) + 10) % 10), 0, h * 0.04); g2.restore();
    }
    const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(40,36,30,0.42)'); gr.addColorStop(0.2, 'rgba(40,36,30,0.0)'); gr.addColorStop(0.8, 'rgba(40,36,30,0.0)'); gr.addColorStop(1, 'rgba(40,36,30,0.46)'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
    drumTex.needsUpdate = true;
  }
  const drawLabel = (col) => canvasTex(1024, Math.round((1024 * lh) / lw), (gg, w, h) => { gg.clearRect(0, 0, w, h); gg.fillStyle = col; const px = Math.round(h * 0.34); gg.font = `600 ${px}px "IBM Plex Mono"`; gg.letterSpacing = (px * 0.06).toFixed(1) + 'px'; gg.textBaseline = 'alphabetic';
    o.label.forEach((ln, i) => gg.fillText(ln, 4, h * (0.44 + 0.44 * i))); });
  return {
    group: g, head: g, drum, label: lab,
    set(value, col) { drawDrum(value, col); if (col !== labelCol) { labelCol = col; if (labelTex) labelTex.dispose(); labelTex = drawLabel(col); lab.material.map = labelTex; lab.material.needsUpdate = true; } },
  };
}

/* v10 set: the engraved CLOCK on the desk's front face (the s1 readout language: recessed panel, rolling digit drums). HH:MM, 24 h.
   set(minutes): minutes since midnight, fractional = the minute drum mid-roll; higher drums roll like an odometer (a drum moves only
   while every drum below it is passing 9 -> 0 / 59 -> 00). The 23:59 -> 00:00 roll is not supported. */


export function makeClock(ctx, parent, o) {
  const g = new THREE.Group(); g.position.set(...o.pos); parent.add(g);
  const [ww, wh] = o.win, gap = o.gap, colon = o.colon, W0 = 4 * ww + 2 * gap + colon, pad = o.pad, PW = W0 + 2 * pad, PH = wh + 2 * pad;
  const panel = ctx.add(g, new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: canvasTex(1024, Math.round(1024 * PH / PW), (gg, w, h) => {
    const r = h * 0.16; gg.fillStyle = '#eeebe5'; gg.beginPath(); gg.roundRect(2, 2, w - 4, h - 4, r); gg.fill();
    const sh = gg.createLinearGradient(0, 0, 0, h * 0.22); sh.addColorStop(0, 'rgba(60,52,40,0.16)'); sh.addColorStop(1, 'rgba(60,52,40,0)'); gg.save(); gg.beginPath(); gg.roundRect(2, 2, w - 4, h - 4, r); gg.clip(); gg.fillStyle = sh; gg.fillRect(0, 0, w, h * 0.22); gg.restore();
    const ppu = w / PW, cx = (pad + 2 * ww + gap + colon / 2) * ppu; gg.fillStyle = o.ink; [-0.17, 0.17].forEach((dy) => { gg.beginPath(); gg.arc(cx, h / 2 + dy * wh * ppu, wh * ppu * 0.055, 0, Math.PI * 2); gg.fill(); });
  }), transparent: true, roughness: 0.6, depthWrite: false })), { recv: true });
  panel.position.z = 0.001; panel.renderOrder = 2;
  const xs = [0, 1, 2, 3].map((i) => -W0 / 2 + ww / 2 + i * (ww + gap) + (i >= 2 ? colon - gap : 0));
  const drums = xs.map((x) => { const DC = document.createElement('canvas'); DC.width = 256; DC.height = Math.round(256 * wh / ww); const tx = new THREE.CanvasTexture(DC); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
    const m = ctx.add(g, new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5 })), {}); m.position.set(x, 0, 0.002); m.renderOrder = 3; return { DC, tx, m, key: '' }; });
  function draw(d, value) {
    const key = value.toFixed(4); if (key === d.key) return; d.key = key;
    const g2 = d.DC.getContext('2d'), w = d.DC.width, h = d.DC.height, R = 1.2 * h, d0 = Math.floor(value + 1e-9), u = value - d0, PITCH = Math.PI / 5;
    g2.fillStyle = '#f8f6f1'; g2.fillRect(0, 0, w, h);
    for (const [dg, a] of [[d0 - 1, (u + 1) * PITCH], [d0, u * PITCH], [d0 + 1, (u - 1) * PITCH], [d0 + 2, (u - 2) * PITCH]]) {
      if (Math.abs(a) > Math.PI / 2 - 0.05) continue; const yc = h / 2 - R * Math.sin(a), sy = Math.cos(a);
      g2.save(); g2.translate(w / 2, yc); g2.scale(1, sy); g2.fillStyle = o.ink; g2.font = `800 ${Math.round(h * 0.84)}px "Manrope"`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(String(((dg % 10) + 10) % 10), 0, h * 0.04); g2.restore();
    }
    const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(40,36,30,0.42)'); gr.addColorStop(0.2, 'rgba(40,36,30,0)'); gr.addColorStop(0.8, 'rgba(40,36,30,0)'); gr.addColorStop(1, 'rgba(40,36,30,0.46)'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h); d.tx.needsUpdate = true;
  }
  return {
    group: g, drums: drums.map((d) => d.m),
    set(minutes) {
      const m = Math.max(0, minutes), mu = m % 10, mt0 = Math.floor(m / 10) % 6, c1 = mu > 9 ? mu - 9 : 0, mm = m % 60, c2 = mm > 59 ? mm - 59 : 0;
      const hh = Math.floor(m / 60) % 24, hu = hh % 10, ht = Math.floor(hh / 10);
      draw(drums[3], mu); draw(drums[2], mt0 + c1); draw(drums[1], hu + c2); draw(drums[0], ht + (hu === 9 ? c2 : 0));
    },
  };
}

