/* templates/_shared/saas/screens.mjs: the PLACEHOLDER screens of the fictional "Acme Flow" (a request-routing tool), built in HTML, never drawn by an image model (2026-10-16, lane xp-saas).
   screenHTML(name, st, B) -> an HTML string at the screen's native size (desktop 1440 x 900, mobile 390 x 844), a pure function of the state `st` (the template interpolates st from t).
   SCREEN_CSS(B) -> the CSS, injected once into the page head (classes are prefixed af-; no ids, so the gfx def-id namespacing never touches them).
   Every screen is demo data for a fictional product: the template's window prints "placeholder UI · demo data" over it. Replace a screen with your own screenshot or recording through CONFIG.media. */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const f2 = (v) => (Math.round(v * 100) / 100).toString();
export const SIZES = { desktop: [1440, 900], mobile: [390, 844] };

export const SCREEN_CSS = (B) => `
.af{position:relative;width:1440px;height:900px;background:#F6F5F2;font-family:Manrope,sans-serif;color:${B.ink};overflow:hidden;display:flex;letter-spacing:-0.01em}
.af *{box-sizing:border-box}
.af-side{width:248px;background:#FFFFFF;border-right:1px solid #E6E3EA;padding:26px 18px;display:flex;flex-direction:column;gap:6px}
.af-ws{display:flex;align-items:center;gap:12px;font-weight:800;font-size:19px;margin:0 6px 22px}
.af-mk{width:34px;height:34px;border-radius:10px;background:${B.accent};color:#fff;display:grid;place-items:center;font-weight:800;font-size:18px}
.af-nav{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-radius:10px;font-weight:600;font-size:17px;color:#55525E}
.af-nav.on{background:${B.accent}14;color:${B.accent};font-weight:700}
.af-cnt{font-size:14px;font-weight:700;background:#EFEDF3;color:#55525E;border-radius:20px;padding:2px 9px}
.af-nav.on .af-cnt{background:${B.accent};color:#fff}
.af-main{flex:1;padding:28px 34px;display:flex;flex-direction:column;gap:18px;min-width:0}
.af-top{display:flex;align-items:center;justify-content:space-between}
.af-h1{font-size:30px;font-weight:800;letter-spacing:-0.02em}
.af-sub{font-size:16px;color:#77737F;font-weight:600;margin-top:4px}
.af-btn{background:${B.accent};color:#fff;font-weight:700;font-size:17px;padding:12px 20px;border-radius:12px;display:flex;align-items:center;gap:8px}
.af-btn.ghost{background:#FFFFFF;color:${B.ink};border:1px solid #E1DEE6}
.af-btn.hov{box-shadow:0 0 0 5px ${B.accent}33}
.af-card{background:#FFFFFF;border:1px solid #E6E3EA;border-radius:16px}
.af-row{display:flex;align-items:center;gap:16px;padding:15px 20px;border-bottom:1px solid #EFEDF2;font-size:17px;font-weight:600}
.af-row:last-child{border-bottom:0}
.af-av{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;font-size:15px;font-weight:800;color:#fff;flex:none}
.af-tag{font-size:14px;font-weight:700;padding:5px 11px;border-radius:20px;white-space:nowrap}
.af-dim{color:#8A8693;font-weight:600}
.af-grow{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.af-canvas{flex:1;border-radius:18px;background-color:#FBFAF8;background-image:radial-gradient(circle,#D9D5DE 1.3px,transparent 1.6px);background-size:26px 26px;border:1px solid #E6E3EA;position:relative;overflow:hidden}
.af-node{position:absolute;width:330px;background:#fff;border:1.5px solid #E1DEE6;border-radius:16px;padding:10px 18px;box-shadow:0 6px 18px rgba(20,18,30,.07)}
.af-node .k{font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8A8693}
.af-node .t{font-size:19px;font-weight:800;margin-top:4px}
.af-node .d{font-size:15px;font-weight:600;color:#77737F;margin-top:2px}
.af-node.hl{border-color:${B.accent};box-shadow:0 0 0 5px ${B.accent}22,0 10px 26px rgba(20,18,30,.12)}
.af-node.run{border-color:#17A865}
.af-ok{width:22px;height:22px;border-radius:11px;background:#17A865;display:inline-grid;place-items:center;color:#fff;font-size:13px;font-weight:900;vertical-align:-4px}
.af-kpi{flex:1;padding:20px 22px}
.af-kpi .v{font-size:38px;font-weight:800;letter-spacing:-0.03em;margin-top:8px}
.af-m{width:390px;height:844px;background:#F6F5F2;font-family:Manrope,sans-serif;color:${B.ink};overflow:hidden;padding:58px 18px 18px;display:flex;flex-direction:column;gap:12px;letter-spacing:-0.01em}
.af-m *{box-sizing:border-box}
`;

/* ---------- shared bits ---------- */
const TEAM = { Billing: ['#E7F0FF', '#2457C5'], Support: ['#E5F6EE', '#137A4B'], Access: ['#FFF1E0', '#A35A00'], Product: ['#F2E9FF', '#6A35C9'], Sales: ['#FFE9EE', '#B3264A'] };
const tag = (txt, [bg, fg]) => `<span class="af-tag" style="background:${bg};color:${fg}">${esc(txt)}</span>`;
const side = (B, on, counts = {}) => `<div class="af-side"><div class="af-ws"><div class="af-mk">${esc(B.name.slice(0, 1))}</div>${esc(B.name)}</div>` +
  ['Inbox', 'Flows', 'Runs', 'Teams', 'Settings'].map((n) => `<div class="af-nav${n === on ? ' on' : ''}"><span>${n}</span>${counts[n] != null ? `<span class="af-cnt">${esc(counts[n])}</span>` : ''}</div>`).join('') + '</div>';
const REQ = [['Refund for a double charge', 'Billing', 'MK', '#D9734E'], ['Cannot log in after reset', 'Access', 'JT', '#3A8F7B'], ['Export button does nothing', 'Support', 'RS', '#6C5BD4'], ['Invoice needs a new address', 'Billing', 'AL', '#C4508A'],
  ['Feature idea: dark mode', 'Product', 'PW', '#4D7CC9'], ['Seats for the new team', 'Sales', 'DN', '#B8862F'], ['Webhook keeps timing out', 'Support', 'CF', '#3F9B5A'], ['Change the owner of a workspace', 'Access', 'EV', '#8A5BD1'],
  ['Discount for a nonprofit?', 'Sales', 'OB', '#D05A5A'], ['Card declined on renewal', 'Billing', 'HS', '#2E8FA8']];

/* ---------- inbox: chaos (st.calm 0) -> handled (st.calm 1); st.scroll in rows; st.flash = index of a row to flag ---------- */
function inbox(st, B) {
  const calm = cl(+st.calm || 0), rows = REQ.map((r, i) => { const routed = calm > (i + 0.5) / REQ.length, flag = st.flash === i;
    const right = routed ? `${tag('Routed → ' + r[1], TEAM[r[1]])}<span class="af-ok">✓</span>` : `${tag('Unassigned', ['#FDE8E6', '#B2382E'])}<span class="af-dim">${esc(['waiting', 'no owner', 'waiting', 'forwarded twice', 'waiting'][i % 5])}</span>`;
    return `<div class="af-row" style="${flag ? `background:#FFF4F2;box-shadow:inset 4px 0 0 #D9473F;` : ''}"><div class="af-av" style="background:${r[3]}">${r[2]}</div><div class="af-grow">${esc(r[0])}<div class="af-dim" style="font-size:14px;margin-top:3px">via ${['email', 'chat', 'form', 'email', 'chat'][i % 5]}</div></div>${right}</div>`; });
  const open = Math.round((1 - calm) * 48);
  return `<div class="af">${side(B, 'Inbox', { Inbox: open || '0', Flows: '1' })}<div class="af-main"><div class="af-top"><div><div class="af-h1">Requests</div><div class="af-sub">${calm >= 1 ? 'All routed · nothing waiting' : 'From email, chat and forms'}</div></div><div style="display:flex;gap:10px"><div class="af-btn ghost">Filter</div><div class="af-btn ghost">Assign</div></div></div>` +
    `<div class="af-card" style="overflow:hidden"><div style="transform:translateY(${f2(-(+st.scroll || 0) * 67)}px)">${rows.join('')}${rows.slice(0, 4).join('')}</div></div></div></div>`;
}
/* ---------- flows list: st.hover (the New flow button) ---------- */
function flows(st, B) {
  const list_ = [['Route new requests', 'Draft', '#8A8693'], ['Weekly summary to the team channel', 'Paused', '#A35A00'], ['Tag refunds', 'Paused', '#A35A00']].map(([n, s, c]) => `<div class="af-row"><div class="af-mk" style="background:#EFEDF3;color:${B.ink}">↳</div><div class="af-grow">${esc(n)}</div><span class="af-tag" style="background:#F2F0F5;color:${c}">${s}</span></div>`);
  return `<div class="af">${side(B, 'Flows', { Inbox: 48 })}<div class="af-main"><div class="af-top"><div><div class="af-h1">Flows</div><div class="af-sub">Rules that move work for you</div></div><div class="af-btn${st.hover ? ' hov' : ''}" style="${st.press ? 'transform:scale(.96)' : ''}">+ New flow</div></div>` +
    `<div class="af-card">${list_.join('')}</div><div class="af-card" style="flex:1;display:grid;place-items:center;color:#8A8693;font-weight:700;font-size:18px">Pick a flow, or describe a new one</div></div></div>`;
}
/* ---------- builder: st.nodes (how many nodes are built, fractional = the next one fading in), st.hl (node index), st.swap 0..1 (the reply node moves above the branch), st.run (0..n, nodes ticked) ---------- */
export const BUILDER_NODES = [{ k: 'When', t: 'A request comes in', d: 'Email, chat or form' }, { k: 'Read', t: 'Find the topic', d: 'From the words in it' }, { k: 'Branch', t: 'Pick the owning team', d: 'Billing · Support · Access · Sales' },
  { k: 'Then', t: 'Post to that team', d: 'With the request attached' }, { k: 'Then', t: 'Reply to the customer', d: 'Tell them who has it' }];
function builder(st, B) {
  const n = +st.nodes || 0, sw = cl(+st.swap || 0), run = +st.run || 0, lerp = (a, b, k) => a + (b - a) * k;
  const P = [[90, 16], [90, 128], [90, 240], [90, 360], [520, 360]], at = (i) => (i === 4 ? [lerp(520, 90, sw), lerp(360, 472, sw)] : P[i]);   // compact: the whole flow fits in the top 75% of the screen (a 16:9 window crops the bottom)   // the reply node is dragged from beside the post node to below it (st.swap)
  const nodes = BUILDER_NODES.map((nd, i) => { const a = cl(n - i); if (a <= 0) return ''; const [x, y] = at(i), hl = st.hl === i, ok = run > i;
    return `<div class="af-node${hl ? ' hl' : ''}${ok ? ' run' : ''}" style="left:${f2(x)}px;top:${f2(y + (1 - a) * 18)}px;opacity:${f2(a)}"><div class="k">${nd.k}${ok ? ' <span class="af-ok">✓</span>' : ''}</div><div class="t">${esc(nd.t)}</div><div class="d">${esc(nd.d)}</div></div>`; }).join('');
  const link = (i, j) => { if (n < j + 0.6) return ''; const [x1, y1] = at(i), [x2, y2] = at(j), a = cl(n - j); const sx = x1 + 165, sy = y1 + 98, ex = x2 + 165, ey = y2 - 2; return `<path d="M${f2(sx)} ${f2(sy)} C${f2(sx)} ${f2(sy + 30)} ${f2(ex)} ${f2(ey - 30)} ${f2(ex)} ${f2(ey)}" fill="none" stroke="#BDB8C6" stroke-width="2.5" opacity="${f2(a)}"/>`; };
  const svg = `<svg width="1100" height="760" style="position:absolute;left:0;top:0">${link(0, 1)}${link(1, 2)}${link(2, 3)}${sw < 0.5 ? link(2, 4) : link(3, 4)}</svg>`;
  const ready = n >= 5;
  return `<div class="af">${side(B, 'Flows', { Inbox: 48 })}<div class="af-main"><div class="af-top"><div><div class="af-h1">Route new requests</div><div class="af-sub">${ready ? (run >= 5 ? 'Test run passed' : 'Ready to test') : n > 0 ? 'Building…' : 'Empty flow'}</div></div><div style="display:flex;gap:10px"><div class="af-btn ghost">Share</div><div class="af-btn${st.hoverRun ? ' hov' : ''}">▶ Run test</div></div></div>` +
    `<div class="af-canvas">${svg}${nodes}${n <= 0 ? '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#8A8693;font-weight:700;font-size:19px">Describe the flow you want</div>' : ''}</div></div></div>`;
}
/* ---------- runs: st.rows visible (fractional), st.hl row ---------- */
function runs(st, B) {
  const R = [['Refund for a double charge', 'Billing', '0.8 s'], ['Cannot log in after reset', 'Access', '0.6 s'], ['Export button does nothing', 'Support', '0.7 s'], ['Seats for the new team', 'Sales', '0.9 s'], ['Card declined on renewal', 'Billing', '0.5 s'], ['Webhook keeps timing out', 'Support', '0.8 s']];
  const n = st.rows == null ? R.length : +st.rows;
  const rows = R.map((r, i) => { const a = cl(n - i); if (a <= 0) return ''; return `<div class="af-row" style="opacity:${f2(a)};${st.hl === i ? `background:${B.accent}0F;box-shadow:inset 4px 0 0 ${B.accent}` : ''}"><span class="af-ok">✓</span><div class="af-grow">${esc(r[0])}</div>${tag(r[1], TEAM[r[1]])}<span class="af-dim" style="width:70px;text-align:right">${r[2]}</span><span class="af-dim" style="width:90px;text-align:right">just now</span></div>`; }).join('');
  return `<div class="af">${side(B, 'Runs', { Inbox: 0 })}<div class="af-main"><div class="af-top"><div><div class="af-h1">Runs</div><div class="af-sub">Every request, every step, on record</div></div><div class="af-btn ghost">Export</div></div>` +
    `<div style="display:flex;gap:16px">${[['Routed today', '1,284'], ['Needed a person', '31'], ['Median time to route', '0.7 s']].map(([k, v]) => `<div class="af-card af-kpi"><div class="af-dim" style="font-size:15px">${k}</div><div class="v">${v}</div></div>`).join('')}</div>` +
    `<div class="af-card" style="overflow:hidden">${rows}</div></div></div>`;
}
/* ---------- mobile: the same inbox, phone layout ---------- */
function mobileInbox(st, B) {
  const calm = cl(+st.calm || 0), rows = REQ.slice(0, 7).map((r, i) => { const routed = calm > (i + 0.5) / 7;
    return `<div class="af-card" style="padding:14px 14px;display:flex;gap:12px;align-items:center"><div class="af-av" style="background:${r[3]};width:34px;height:34px">${r[2]}</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r[0])}</div><div style="margin-top:6px">${routed ? tag('→ ' + r[1], TEAM[r[1]]) : tag('Unassigned', ['#FDE8E6', '#B2382E'])}</div></div></div>`; });
  return `<div class="af-m"><div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:26px;font-weight:800">Requests</div><div class="af-mk">${esc(B.name.slice(0, 1))}</div></div><div class="af-dim" style="font-size:14px">${calm >= 1 ? 'All routed' : 'From email, chat and forms'}</div>${rows.join('')}</div>`;
}
/* ---------- the problem world (generic, not the product): a team chat channel and a tracker sheet ---------- */
const MSGS = [['DN', '#B8862F', 'Who owns the refund one?'], ['MK', '#D9734E', 'Not me, maybe Billing?'], ['JT', '#3A8F7B', 'Billing is out today'], ['RS', '#6C5BD4', 'Forwarding it again…'], ['AL', '#C4508A', 'Did anyone reply to the customer?']];
function chat(st, B) {
  const n = st.msgs == null ? MSGS.length : +st.msgs, pasted = cl(+st.pasted || 0);
  const msg = (m, a) => `<div style="display:flex;gap:14px;opacity:${f2(a)};transform:translateY(${f2((1 - a) * 14)}px)"><div class="af-av" style="background:${m[1]}">${m[0]}</div><div><div style="font-weight:800;font-size:16px">${m[0] === 'DN' ? 'Dana' : m[0] === 'MK' ? 'Mo' : m[0] === 'JT' ? 'Jo' : m[0] === 'RS' ? 'Ravi' : 'Ana'} <span class="af-dim" style="font-size:13px">just now</span></div><div style="font-size:18px;font-weight:600;margin-top:4px">${esc(m[2])}</div></div></div>`;
  const quote = pasted > 0 ? `<div style="opacity:${f2(pasted)};border-left:4px solid #C8C3D0;padding:10px 16px;background:#FAF9F7;border-radius:8px;font-size:17px;font-weight:600">“Refund for a double charge” <span class="af-dim">· pasted from the inbox</span></div>` : '';
  return `<div class="af" style="background:#FFFFFF"><div class="af-side" style="background:#F3F1EE"><div class="af-ws"><div class="af-mk" style="background:#55525E">#</div>Team chat</div>${['general', 'support', 'billing', 'random'].map((c, i) => `<div class="af-nav${i === 1 ? ' on' : ''}" style="${i === 1 ? 'background:#E6E3EA;color:#14131A' : ''}"># ${c}</div>`).join('')}</div>` +
    `<div class="af-main" style="gap:22px"><div class="af-h1" style="font-size:24px"># support</div>${quote}${MSGS.map((m, i) => { const a = cl(n - i); return a > 0 ? msg(m, a) : ''; }).join('')}</div></div>`;
}
function sheet(st, B) {
  const n = st.rows == null ? 12 : +st.rows, H = ['Request', 'From', 'Owner', 'Status', 'Last touched'];
  const cells = (r, i) => [REQ[i % REQ.length][0], ['email', 'chat', 'form'][i % 3], i % 4 === 1 ? 'Mo?' : '', i % 3 === 0 ? 'waiting' : 'unassigned', i % 2 ? 'Tue' : 'Mon'];
  const row = (i) => { const a = cl(n - i); if (a <= 0) return ''; const c = cells(null, i); return `<div style="display:grid;grid-template-columns:2.4fr 1fr 1fr 1.2fr 1fr;opacity:${f2(a)};border-bottom:1px solid #E6E3EA">${c.map((v, j) => `<div style="padding:12px 14px;font-size:16px;font-weight:600;border-right:1px solid #EEECEF;${j === 3 ? 'color:#B2382E;background:#FDF0EE' : ''}${j === 2 && !v ? 'background:#FFF8E5' : ''}">${esc(v || '—')}</div>`).join('')}</div>`; };
  return `<div class="af" style="background:#FFFFFF;flex-direction:column"><div style="padding:18px 24px;border-bottom:1px solid #E6E3EA;font-weight:800;font-size:20px">requests-tracker-FINAL-v3</div>` +
    `<div style="display:grid;grid-template-columns:2.4fr 1fr 1fr 1.2fr 1fr;background:#F3F1EE;border-bottom:1px solid #DDD9E0">${H.map((h) => `<div style="padding:12px 14px;font-size:15px;font-weight:800;color:#55525E">${h}</div>`).join('')}</div>${Array.from({ length: 14 }, (_, i) => row(i)).join('')}</div>`;
}
const SCREENS = { inbox, flows, builder, runs, chat, sheet, 'mobile.inbox': mobileInbox };
export const SCREEN_NAMES = Object.keys(SCREENS);
export function screenHTML(name, st = {}, B) { const f = SCREENS[name]; if (!f) throw new Error('unknown screen ' + name + ' (have: ' + SCREEN_NAMES.join(', ') + ')'); return f(st || {}, B); }
export const screenSize = (name) => (String(name).startsWith('mobile.') ? SIZES.mobile : SIZES.desktop);
/* a screen state from keyframes: keys = [[t, {field: value}, easeS?, curve?], ...] in seconds. A number eases from the previous key's value of that field over the key's easeS (default `ease`)
   with curve 'smooth' (smoothstep, default) or 'cam' (the cursor's own bezier 0.33 0 0.12 1, so a dragged element follows ui.cursorJourney exactly: give it the leg from cursorLeg()); anything else steps. Pure in t. */
const camE = (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, u = x; for (let i = 0; i < 30; i++) { u = (lo + hi) / 2; const bx = 3 * (1 - u) ** 2 * u * 0.33 + 3 * (1 - u) * u * u * 0.12 + u ** 3; if (bx < x) lo = u; else hi = u; } return 3 * (1 - u) * u * u + u ** 3; };
export function stateAt(keys, t, ease = 0.45) {
  const by = {}; for (const [kt, vals, es, cv] of (keys || []).slice().sort((a, b) => a[0] - b[0])) for (const [k, v] of Object.entries(vals || {})) (by[k] ||= []).push([kt, v, es, cv]);
  const st = {}; for (const [k, ks] of Object.entries(by)) { let i = -1; while (i + 1 < ks.length && ks[i + 1][0] <= t) i++; if (i < 0) continue; const [kt, v, es, cv] = ks[i], pv = i ? ks[i - 1][1] : null;
    if (typeof v === 'number' && typeof pv === 'number') { const u = cl((t - kt) / Math.max(1e-3, es ?? ease)), e = cv === 'cam' ? camE(u) : u * u * (3 - 2 * u); st[k] = pv + (v - pv) * e; } else st[k] = v; }
  return st;
}
