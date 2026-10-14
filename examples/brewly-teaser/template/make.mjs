/* templates/brewly/make.mjs: a copy of templates/ad/make.mjs, re-laid out for 9:16 (and 16:9) with drawn props instead of video plates.
     node make.mjs [--set aspect=16:9]   then   npx -y hyperframes@0.8.142 render . -o out/brewly-9x16.mp4 --crf 23
   Same pipeline as the ad template: CONFIG -> plan (cues.mjs, lint) -> SFX + music mix (audio.py -> music/mixer.py) -> static HyperFrames
   index.html whose paused GSAP timeline is built from the same plan. Every prop animation is a timeline tween at an absolute time (seek-safe).
   BREWLY IS A FICTIONAL BRAND: every screen below is a drawn illustration, labelled in frame. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { stage, runPlan, head, esc, write } from '../_shared/compose.mjs';
import { txPlan, span, txCalls } from '../_shared/txplan.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared');
runPlan(DIR);   // plan + lint gates: exits 2 on lint.proof / lint.tx (--allow-lint waives)
const plan = JSON.parse(fs.readFileSync(path.join(DIR, 'out', 'plan.json'), 'utf8'));
const { CONFIG } = await import('./config.mjs'); const C = structuredClone(CONFIG);
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--set') { const [k, v] = process.argv[++i].split('='); let o = C; const ks = k.split('.'); for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v !== '' && !isNaN(+v) ? +v : v; }
const st = stage(DIR, { media: [], layers: (C.layers || []).length > 0 });
if (!process.env.SKIP_MIX) execFileSync('python3', [path.join(SH, 'audio.py'), path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav')], { stdio: 'inherit' });
const TALL = C.aspect !== '16:9', W = TALL ? 1080 : 1920, H = TALL ? 1920 : 1080, B = C.brand, F = plan.fps, T = plan.seconds;
const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
/* palette from design.json (no CONFIG keys for these roles: kept here, see design.json handoff) */
const P = { night: '#24170F', nightInk: '#F6EFE6', accentNight: '#F2A65A', mutedNight: '#C9B39F', muted: '#6B5547', success: '#166534', kraft: '#C49A6C', counter: '#33221A' };

/* ---------- drawn props (inline SVG, original artwork) ---------- */
const bean = (id) => `<svg id="${id}" class="bean" viewBox="0 0 40 56"><ellipse cx="20" cy="28" rx="16" ry="24" fill="#5A3420"/><path d="M21 6 C 11 20, 29 36, 19 50" stroke="#2A170C" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="13" cy="18" rx="4" ry="8" fill="#7A4A2E" opacity="0.6"/></svg>`;
const bag = (label = '', open = false) => `<svg viewBox="0 0 300 420" class="bagsvg">
  <path d="M40 60 L260 60 L282 400 Q282 414 268 414 L32 414 Q18 414 18 400 Z" fill="${P.kraft}"/>
  <path d="M40 60 L260 60 L282 400 Q282 414 268 414 L150 414 L150 60 Z" fill="#B1875A" opacity="0.55"/>
  <path d="M40 60 L260 60 L262 92 L38 92 Z" fill="#A97E52"/>
  ${open ? '<path d="M40 60 L260 60 L252 30 L48 30 Z" fill="#B88F62"/><ellipse cx="150" cy="32" rx="104" ry="13" fill="#1E120B"/>' : '<path d="M40 20 L60 34 L80 20 L100 34 L120 20 L140 34 L160 20 L180 34 L200 20 L220 34 L240 20 L260 34 L260 60 L40 60 Z" fill="#B88F62"/>'}
  <rect x="62" y="170" width="176" height="150" rx="14" fill="#F6EFE6"/>
  ${label ? `<text x="150" y="262" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="44" fill="#B4410F" letter-spacing="-1">${label}</text>` : `<ellipse cx="150" cy="245" rx="26" ry="38" fill="#5A3420"/><path d="M152 210 C 140 232, 164 258, 150 282" stroke="#F6EFE6" stroke-width="6" fill="none" stroke-linecap="round"/>`}
</svg>`;
const mug = (full) => `<svg viewBox="0 0 400 360" class="mugsvg">
  <ellipse cx="190" cy="338" rx="168" ry="18" fill="#000" opacity="0.18"/>
  <path d="M318 120 C 392 120, 392 250, 318 250" stroke="#FFFFFF" stroke-width="30" fill="none" stroke-linecap="round"/>
  <path d="M40 70 L340 70 L322 300 Q318 336 282 336 L98 336 Q62 336 58 300 Z" fill="#FFFFFF"/>
  <path d="M250 70 L340 70 L322 300 Q318 336 282 336 L262 336 Z" fill="#E9DFD4"/>
  <ellipse cx="190" cy="70" rx="150" ry="34" fill="#FFFFFF"/>
  <ellipse cx="190" cy="72" rx="132" ry="26" fill="${full ? '#5B2E14' : '#E9E0D6'}"/>
  ${full ? '<ellipse cx="190" cy="72" rx="132" ry="26" fill="none" stroke="#B07A4A" stroke-width="7" opacity="0.9"/><ellipse cx="160" cy="66" rx="40" ry="8" fill="#8A5530" opacity="0.7"/>' : '<ellipse cx="190" cy="84" rx="112" ry="15" fill="#D8CCBF"/>'}
  <rect x="96" y="150" width="120" height="16" rx="8" fill="${full ? '#B4410F' : '#D8CCBF'}" opacity="${full ? 0.9 : 0.6}"/>
</svg>`;
const steam = `<svg viewBox="0 0 400 220" class="steam">${[110, 190, 270].map((x, i) => `<path id="st${i}" d="M${x} 210 C ${x - 30} 170, ${x + 30} 130, ${x} 90 C ${x - 26} 60, ${x + 20} 30, ${x} 4" stroke="#C9B39F" stroke-width="12" fill="none" stroke-linecap="round" opacity="0"/>`).join('')}</svg>`;
const appIcon = (px) => `<div class="appicon" style="width:${px}px;height:${px}px;border-radius:${px * 0.24}px"><svg viewBox="0 0 40 56" style="width:${px * 0.46}px"><ellipse cx="20" cy="28" rx="16" ry="24" fill="#FFFFFF"/><path d="M21 6 C 11 20, 29 36, 19 50" stroke="${B.accent}" stroke-width="4.5" fill="none" stroke-linecap="round"/></svg></div>`;

/* ---------- layout (9:16 primary; 16:9 re-layout, not a crop) ---------- */
const L = TALL ? {
  textBox: 'left:65px; right:120px; top:300px;', hl: 108, card: 96, wordmark: 200, name: 184, cta: 56,
  bag: 'left:390px; top:470px; width:300px;', mugHook: 'left:345px; top:1000px; width:390px;', mugBig: 'left:300px; top:780px; width:480px;',
  phoneDark: 'left:790px; top:1196px; width:250px; height:92px;', counter: 'top:1250px;',
  phone: 'left:305px; top:620px; width:470px; height:960px;', phoneProof: 'left:305px; top:640px; width:470px; height:960px;',
  clock: 160, endMug: 'left:330px; top:370px; width:420px;', endSteam: 'left:330px; top:220px; width:420px;', endText: 'left:65px; right:120px; top:770px;',
  label: 'left:65px; top:1188px;', beanFrom: { x: 511, y: 870 }, beanTo: { y: 1075 },
} : {
  textBox: 'left:96px; width:900px; top:120px;', hl: 104, card: 96, wordmark: 190, name: 170, cta: 50,
  bag: 'left:1290px; top:40px; width:260px;', mugHook: 'left:1250px; top:640px; width:340px;', mugBig: 'left:1180px; top:490px; width:440px;',
  phoneDark: 'left:1560px; top:760px; width:260px; height:96px;', counter: 'top:900px;',
  phone: 'left:1240px; top:110px; width:470px; height:860px;', phoneProof: 'left:1240px; top:110px; width:470px; height:860px;',
  clock: 170, endMug: 'left:1180px; top:330px; width:420px;', endSteam: 'left:1180px; top:180px; width:420px;', endText: 'left:96px; width:960px; top:330px;',
  label: 'left:96px; top:966px;', beanFrom: { x: 1400, y: 380 }, beanTo: { y: 680 },
};
const css = `
#root { background: ${P.night}; }
.scene { overflow: hidden; z-index: 1; }
.night { background: radial-gradient(120% 70% at 50% 62%, #3A2619 0%, ${P.night} 62%); }
.paper { background: ${B.paper}; }
.cam { position: absolute; inset: 0; transform-origin: 50% 62%; }
.counter { position: absolute; left: 0; right: 0; bottom: 0; ${L.counter} background: linear-gradient(${P.counter}, #1A110B); border-top: 3px solid #4A3326; }
.tb { position: absolute; ${L.textBox} }
.hl { font-weight: 800; font-size: ${L.hl}px; line-height: 1.02; letter-spacing: -0.035em; color: ${P.nightInk}; }
.hl em { font-style: normal; color: ${P.accentNight}; }
.paper .hl { color: ${B.ink}; } .paper .hl em { color: ${B.accent}; }
.cardtxt { font-size: ${L.card}px; }
.clocktxt { font-family: "IBM Plex Mono"; font-weight: 600; font-size: ${L.clock}px; letter-spacing: 0.01em; color: ${P.accentNight}; text-shadow: 0 0 40px rgba(242,166,90,0.35); }
.prop { position: absolute; }
.bagw { position: absolute; ${L.bag} transform-origin: 50% 50%; }
.bagsvg, .mugsvg, .steam { display: block; width: 100%; height: auto; }
.bean { position: absolute; left: 0; top: 0; width: 58px; height: 83px; }
.mugw { position: absolute; }
.phone { position: absolute; background: #0E0A08; border-radius: 68px; padding: 16px; box-shadow: 0 40px 80px rgba(0,0,0,0.45), inset 0 0 0 3px #2B211B; }
.screen { position: relative; width: 100%; height: 100%; border-radius: 54px; overflow: hidden; background: #050403; }
.lock { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 20%, #F2A65A 0%, #B4410F 45%, #3A1A0B 100%); opacity: 0; }
.lock .time { position: absolute; top: 120px; width: 100%; text-align: center; font-weight: 300; font-size: 120px; color: rgba(255,255,255,0.92); letter-spacing: -0.04em; }
.notif { position: absolute; left: 22px; right: 22px; top: 300px; background: rgba(250,246,241,0.94); border-radius: 30px; padding: 22px; display: flex; gap: 18px; align-items: center; opacity: 0; box-shadow: 0 12px 30px rgba(0,0,0,0.25); }
.notif .nt { font-weight: 800; font-size: 36px; color: ${B.ink}; } .notif .nb { font-weight: 600; font-size: 40px; color: ${B.ink}; line-height: 1.15; }
.appicon { background: ${B.accent}; display: grid; place-items: center; flex: none; }
.appicon svg { height: auto; }
.wm { position: absolute; ${TALL ? 'left:65px; right:120px; top:290px; text-align:center;' : 'left:96px; width:1000px; top:360px;'} font-weight: 800; font-size: ${L.wordmark}px; letter-spacing: -0.05em; color: ${P.nightInk}; line-height: 1; }
.glow { position: absolute; inset: 0; background: radial-gradient(60% 40% at ${TALL ? '50% 60%' : '76% 50%'}, rgba(242,166,90,0.55), rgba(242,166,90,0) 70%); opacity: 0; }
.app { position: absolute; inset: 0; background: #FFFFFF; padding: 70px 34px 0; font-family: "Manrope"; color: ${B.ink}; }
.app .bar { display: flex; align-items: center; gap: 14px; font-weight: 800; font-size: 40px; letter-spacing: -0.03em; }
.app .h { margin-top: 56px; font-weight: 800; font-size: 46px; letter-spacing: -0.03em; }
.app .sub { margin-top: 8px; font-weight: 600; font-size: 28px; color: ${P.muted}; }
.gauge { position: relative; margin-top: 34px; height: 64px; border-radius: 32px; background: #EFE6DC; overflow: hidden; }
.gauge .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 72%; background: ${B.accent}; border-radius: 32px; }
.gauge .low { position: absolute; left: 20%; top: 8px; bottom: 8px; width: 4px; background: ${B.ink}; opacity: 0.35; border-radius: 2px; }
.gl { display: flex; justify-content: space-between; margin-top: 12px; font-weight: 600; font-size: 26px; color: ${P.muted}; }
.chip { position: absolute; left: 30px; top: 430px; display: inline-flex; align-items: center; gap: 12px; padding: 18px 26px; border-radius: 40px; font-weight: 800; font-size: 36px; white-space: nowrap; }
.chip.a { background: #F3ECE4; color: ${P.muted}; } .chip.b { background: #E7F3EA; color: ${P.success}; opacity: 0; }
.nextcard { position: absolute; left: 34px; right: 34px; top: 590px; border-radius: 28px; background: #F6EFE6; padding: 22px; display: flex; gap: 20px; align-items: center; opacity: 0.0; }
.nextcard .mini { width: 72px; } .nextcard .t1 { font-weight: 800; font-size: 30px; } .nextcard .t2 { font-weight: 600; font-size: 26px; color: ${P.muted}; }
.endtxt { position: absolute; ${L.endText} display: flex; flex-direction: column; align-items: ${TALL ? 'center' : 'flex-start'}; gap: 30px; }
.end .name { font-weight: 800; font-size: ${L.name}px; letter-spacing: -0.05em; color: ${B.ink}; line-height: 1; }
.end .name i { font-style: normal; color: ${B.accent}; }
.end .cta { font-weight: 700; font-size: ${L.cta}px; background: ${B.accent}; color: #fff; padding: 20px 52px; border-radius: 60px; }
.end .url { font-family: "IBM Plex Mono"; font-weight: 600; font-size: 34px; color: ${P.muted}; letter-spacing: 0.04em; }
.lbl { position: absolute; ${L.label} right: auto; bottom: auto; width: max-content; z-index: 4; font-family: "IBM Plex Mono"; font-weight: 600; font-size: 30px; letter-spacing: 0.02em; color: ${B.paper}; background: rgba(36,23,15,0.86); padding: 8px 16px; border-radius: 10px; white-space: nowrap; height: 40px; line-height: 40px; }
#fx { pointer-events: none; } #fx canvas { z-index: 5; }   /* layers over picture + type; z on the canvases, NOT on #fx */`;

/* ---------- shots ---------- */
let body = '', tl = '';
const PL = txPlan(plan.shots, F);   // transition overlap windows; every section goes through span()
const sp = (sel, start, dur) => { const o = span(PL, { sel, start, dur }); return `data-start="${o.start.toFixed(4)}" data-duration="${o.dur.toFixed(4)}"`; };
const typeCall = (preset, sel, at, dur, kind) => `\n  MP.type(tl, ${JSON.stringify(preset)}, '${sel}', { at: ${at.toFixed(4)}, dur: ${dur.toFixed(4)}, fps: ${F}, kind: ${JSON.stringify(kind)}, H: ${H} });`;
const sec = (s, cls, inner) => `\n<section id="${s.id}" class="clip scene ${cls}" ${sp('#' + s.id, s.start, s.dur)} data-track-index="1">${inner}</section>`;
for (const s of plan.shots) {
  const a = s.start, d = s.dur, tid = 't-' + s.id;
  if (s.id === 'hook') {   // s01: the upside-down bag shakes its last three beans into the empty mug (frame 0 already moving)
    body += sec(s, 'night', `<div class="cam" id="hk-cam"><div class="counter"></div>
      ${bean('b1')}${bean('b2')}${bean('b3')}
      <div class="mugw" style="${L.mugHook}">${mug(false)}</div>
      <div class="bagw" id="hk-bag">${bag('', true)}</div></div>
      <div class="tb"><div class="hl" id="${tid}">${rich(s.text)}</div></div>`);
    tl += `\n  tl.fromTo('#hk-cam', { scale: 1.0 }, { scale: 1.05, duration: ${(d + 0.3).toFixed(3)}, ease: 'none' }, ${a});`;
    tl += `\n  tl.fromTo('#hk-bag', { rotation: 166 }, { rotation: 174, duration: 0.1, ease: 'sine.inOut', yoyo: true, repeat: 13, immediateRender: true }, 0);`;
    tl += `\n  tl.fromTo('#hk-bag', { y: 0 }, { y: 16, duration: 0.06, ease: 'power1.inOut', yoyo: true, repeat: 7, immediateRender: false }, 1.44);`;
    const fx = L.beanFrom.x, fy = L.beanFrom.y, ty = L.beanTo.y;
    [[0, -60, 0.30, 'b1', -8], [0.33, 0, 0.30, 'b2', 6], [0.67, 40, 0.30, 'b3', -4]].forEach(([t0, y0off, du, id, dx], i) => {
      tl += `\n  tl.set('#${id}', { x: ${fx + dx}, y: ${fy + y0off}, rotation: ${20 + i * 40}, opacity: ${i ? 0 : 1} }, 0);`;
      if (i) tl += `\n  tl.set('#${id}', { opacity: 1 }, ${t0});`;
      tl += `\n  tl.to('#${id}', { y: ${ty}, x: ${fx + dx * 2}, rotation: ${200 + i * 60}, duration: ${du}, ease: 'power2.in' }, ${t0});`;
      tl += `\n  tl.to('#${id}', { opacity: 0, duration: 0.05, ease: 'none' }, ${(t0 + du).toFixed(3)});`;
    });
  } else if (s.id === 'problem0') {   // s02: the kitchen clock (in-world)
    body += sec(s, 'night', `<div class="cam" id="p0-cam"><div class="tb" style="top:${TALL ? 660 : 400}px; text-align:center; ${TALL ? '' : 'left:96px; right:96px; width:auto;'}"><div class="clocktxt" id="${tid}">${esc(s.text)}</div></div></div>`);
    tl += `\n  tl.fromTo('#p0-cam', { scale: 1.06 }, { scale: 1.0, duration: ${d.toFixed(3)}, ease: 'power1.out' }, ${a});`;
  } else if (s.id === 'problem1') {   // s03: the empty mug alone, the phone dark beside it
    body += sec(s, 'night', `<div class="cam" id="p1-cam"><div class="counter"></div>
      <div class="mugw" style="${L.mugBig}">${mug(false)}</div></div>
      <div class="tb"><div class="hl" id="${tid}">${rich(s.text)}</div></div>`);
    tl += `\n  tl.fromTo('#p1-cam', { scale: 1.0 }, { scale: 1.04, duration: ${(d + 0.3).toFixed(3)}, ease: 'none' }, ${a});`;
  } else if (s.kind === 'reveal') {   // s04: the phone lights up with the Brewly notification; the word mark lands and holds
    body += sec(s, 'night', `<div class="glow" id="rv-glow"></div><div class="cam" id="rv-cam">
      <div class="phone" id="rv-phone" style="${L.phone}"><div class="screen"><div class="lock" id="rv-lock"><div class="time">7:03</div></div>
        <div class="notif" id="rv-notif">${appIcon(84)}<div><div class="nt">${esc(B.name)}</div><div class="nb">Next bag: at your door.</div></div></div></div></div></div>
      <div class="wm" id="${tid}">${esc(s.text)}</div>`);
    tl += `\n  tl.fromTo('#rv-cam', { scale: 1.0 }, { scale: 1.05, duration: ${(d + 0.35).toFixed(3)}, ease: 'none' }, ${(a - 0.15).toFixed(3)});`;
    tl += `\n  tl.fromTo('#rv-lock', { opacity: 0 }, { opacity: 1, duration: 0.1, ease: 'power1.out' }, ${(a + 0.1).toFixed(3)});`;
    tl += `\n  tl.fromTo('#rv-glow', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' }, ${(a + 0.1).toFixed(3)});`;
    tl += `\n  tl.fromTo('#rv-phone', { x: -7 }, { x: 7, duration: 0.04, ease: 'none', yoyo: true, repeat: 7, immediateRender: false }, ${(a + 0.1).toFixed(3)});`;
    tl += `\n  tl.set('#rv-phone', { x: 0 }, ${(a + 0.42).toFixed(3)});`;
    tl += `\n  tl.fromTo('#rv-notif', { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.27, ease: 'power2.out' }, ${(a + 0.5).toFixed(3)});`;
    tl += typeCall(C.type.headline, '#' + tid, a + 0.15, d - 0.15, s.kind);
  } else if (s.kind === 'card') {   // s05: the product line on paper
    body += sec(s, 'paper', `<div class="tb" style="top:${TALL ? 560 : 360}px"><div class="hl cardtxt" id="${tid}">${rich(s.text)}</div></div>`);
  } else if (s.kind === 'proof') {   // s06: the one feature, shown on the (fictional, drawn) app screen
    body += sec(s, 'paper', `<div class="tb"><div class="hl cardtxt" id="${tid}">${rich(s.text)}</div></div>
      <div class="cam" id="pf-cam"><div class="phone" style="${L.phoneProof}"><div class="screen"><div class="app">
        <div class="bar">${appIcon(56)}<span>${esc(B.name)}</span></div>
        <div class="h">Your beans</div><div class="sub">House blend · whole bean</div>
        <div class="gauge"><div class="fill" id="pf-fill"></div><div class="low"></div></div>
        <div class="gl"><span>low</span><span>full</span></div>
        <div class="chip a" id="pf-chipA">Watching your pace</div>
        <div class="chip b" id="pf-chipB"><svg viewBox="0 0 64 64" width="40" height="40"><circle cx="32" cy="32" r="30" fill="${P.success}"/><path d="M18 33 L28 43 L47 22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>Next bag shipped</div>
      </div></div></div></div>`);
    tl += `\n  tl.fromTo('#pf-fill', { width: '72%' }, { width: '18%', duration: 1.35, ease: 'power1.inOut' }, ${(a + 0.45).toFixed(3)});`;
    tl += `\n  tl.to('#pf-chipA', { opacity: 0, duration: 0.1, ease: 'none' }, ${(a + 1.85).toFixed(3)});`;
    tl += `\n  tl.fromTo('#pf-chipB', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(1.6)' }, ${(a + 1.9).toFixed(3)});`;
    tl += `\n  tl.fromTo('#pf-cam', { scale: 1.0 }, { scale: 1.03, duration: ${(d + 0.3).toFixed(3)}, ease: 'none' }, ${a});`;
  } else if (s.kind === 'end') {   // s07: the payoff (full, steaming mug) + name + CTA + URL
    body += sec(s, 'paper end', `<div class="prop" style="${L.endSteam}">${steam}</div><div class="prop" style="${L.endMug}">${mug(true)}</div>
      <div class="endtxt"><div class="name" id="${tid}">${esc(B.name)}<i>.</i></div><div class="cta" id="${tid}-cta">${esc(s.text)}</div><div class="url" id="${tid}-url">${esc(B.url)}</div></div>`);
    [0, 1, 2].forEach((i) => { for (const k of [0, 1]) { const t = a + 0.1 + i * 0.35 + k * 1.3;
      tl += `\n  tl.fromTo('#st${i}', { opacity: 0, y: 30 }, { opacity: 0.75, y: 0, duration: 0.6, ease: 'sine.out', immediateRender: false }, ${t.toFixed(3)});`;
      tl += `\n  tl.to('#st${i}', { opacity: 0, y: -40, duration: 0.7, ease: 'sine.in' }, ${(t + 0.6).toFixed(3)});`; } });
    tl += typeCall(C.type.sub, '#' + tid + '-cta', a + 0.25, d - 0.25, 'sub') + typeCall(C.type.sub, '#' + tid + '-url', a + 0.4, d - 0.4, 'sub');
  }
  if (s.text && s.kind !== 'reveal') tl += typeCall(s.type, '#' + tid, s.kind === 'plate' && s.id === 'hook' ? 0 : a, s.textDur ?? d, s.kind);
}
/* honesty labels (design.json frames.labels): one line from the reveal to the end, text per the shot list */
const lab = (id, t0, t1, txt) => `\n<div id="${id}" class="clip lbl" data-start="${t0.toFixed(4)}" data-duration="${(t1 - t0).toFixed(4)}" data-track-index="3">${esc(txt)}</div>`;
const sh = Object.fromEntries(plan.shots.map((s) => [s.id, s]));
body += lab('lbl1', sh.reveal.start, sh.proof0.start, 'Fictional app · concept') + lab('lbl2', sh.proof0.start, sh.cta.start, 'Fictional app · demo screen') + lab('lbl3', sh.cta.start, T, 'Fictional brand · concept teaser');
tl += txCalls(PL, { W, H });
if (PL.todo.length) console.log('transitions todo:', PL.todo.join(' | '));
fs.writeFileSync(path.join(DIR, 'out', 'tx.json'), JSON.stringify(PL.wins, null, 1));
const layers = JSON.stringify(C.layers || []);
const html = `${head({ W, H, title: 'Brewly teaser (fictional brand) ' + (TALL ? '9x16' : '16x9'), bg: P.night, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">${body}
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
${st.adapters.map((x) => `<script type="module" src="${x}"></script>`).join('\n')}
<script type="module">
import { MP } from './assets/mp/pack.mjs';
${(C.layers || []).length && !st.todo.some((x) => x.startsWith('layers')) ? `import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${layers}, { width: ${W}, height: ${H}, fps: ${F}, seed: 7 }), { fps: ${F} });` : `MP._miss('layers/*', 'no finishing layers');`}
gsap.config({ force3D: false });   // motion-stack 2d.md rule 4: no translate3d promotion -> bit-exact rasters
const tl = gsap.timeline({ paused: true });${tl}
tl.seek(tl.duration()).seek(0);   // motion-stack 2d.md rule 5: one warm pass before registering
window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), TALL ? '9:16' : '16:9', 'todo:', st.todo.join(' | ') || 'none');
