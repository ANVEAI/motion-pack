/* TEMPLATE saas-explainer: the "how it works" film, 60 / 70 / 90 s, 16:9 + a 9:16 RE-LAYOUT. Captions on every line, so it works on mute; an OPTIONAL voice-over through words.json.
   question (the pain, as a question) -> the wrong model (what teams do today) -> the reframe (the product, once) -> step 1 -> step 2 -> step 3 (a kicker, one line, the UI doing it) ->
   result (what changes) -> end card. NO VO (the default): the narration lines are captions, timed at reading speed inside each scene, and scenes sit on the bed's beats.
   WITH VO: --set voice.words=/abs/words.json (whisper-style [{w, s, e}] or {words: [...]}, one narration line per scene, in order) [--set voice.audio=/abs/voice.wav]: every scene change lands in
   the breath between two lines (never inside a word), the captions highlight the spoken word, the bed ducks under the voice; no audio = a labelled guide signal for a dry run (proof-film/vo.py).
   Every screen is an HTML placeholder of the FICTIONAL "Acme Flow" ("placeholder UI · demo data"). Edit the CONFIG block only:  node make.mjs [--set length=60|70|90] [--set aspect=9:16]
   HONESTY: a digit in CONFIG.text fails the build; the dashboard figures print "demo data" and are listed in claims. */
import fs from 'node:fs'; import path from 'node:path';
import { aspectOf, scenesToPlan, digitsInCopy, applyMedia } from '../_shared/saas/plan-kit.mjs';
import { chunkCaptions } from '../_shared/plan.mjs';
import { measure } from '../../type/gfx/index.js';
import { plain } from '../_shared/saas/kit.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  length: 70, aspect: '16:9', platform: null, fps: 30,
  brand: { name: 'Acme Flow', accent: '#3B5BFD', ink: '#14131A', paper: '#F5F4F0', logo: null, url: 'flow.example', cta: 'Start free', font: { display: 'Manrope', text: 'Manrope' } },   // FICTIONAL demo brand
  text: {                          // heads = the one line on screen; say = the narration (captions; the VO when voice.words is set: one line per scene, in this order)
    question: { head: 'Who owns this *request*?', say: 'Every team gets requests from email, chat and forms.' },
    wrong: { head: 'Today: forward it and *hope*.', say: 'Most get forwarded by hand, and some never find an owner.' },
    reframe: { head: 'What if each request knew *where to go*?', say: 'Acme Flow routes them for you, in three steps.' },
    step1: { kicker: 'Step one', head: '*Connect* where requests arrive.', say: 'First, connect the places your requests come from.' },
    step2: { kicker: 'Step two', head: '*Describe* the rule in a sentence.', say: 'Then write the rule the way you would say it, and the steps build themselves.' },
    step3: { kicker: 'Step three', head: 'Requests *route themselves*.', say: 'Now each new request goes to the team that owns it, and the customer hears back.' },
    result: { head: 'Nothing waits *without an owner*.', say: 'You see every run, and nothing waits without an owner.' },
    end: { say: '' },
    prompt: 'Send each new request to the team that owns it', askTitle: 'Ask Acme Flow', apply: 'Apply flow',
    answer: ['Done. Here is your flow:', '• Read each request as it lands', '• Pick the owning team from its topic', '• Post it to that team', '• Tell the customer who has it'],
    chaseLabel: 'Still nobody owns it', runToasts: [['Request routed', 'Refund → Billing', 'branch'], ['Request routed', 'Login issue → Access', 'branch'], ['Customer told', 'Billing has it', 'mail']],
    dashTitle: 'Overview', fine: 'Acme Flow is fictional · placeholder UI · demo data',
  },
  voice: { words: null, audio: null },   // optional VO: words = /abs/words.json; audio = your recording (null = a labelled guide signal); synthetic speech is AI content: say so in the post
  media: { step2: { src: null, label: '' }, step3: { src: null, label: '' } },
  integrations: ['mail', 'chat', 'doc', 'calendar', 'db', 'sheet', 'cloud', 'bell'],
  dashSource: 'placeholder data',
  claims: [{ text: 'Dashboard figures (1,284 routed and the others)', source: 'placeholder data: the demo dashboard of the fictional Acme Flow' }],
  transitions: { 'wrong>reframe': ['transitions/blur-cross', 'STORY: from the problem to the idea'], 'reframe>step1': ['transitions/push', 'STORY: the first step'], 'step1>step2': ['transitions/push', 'STORY: the next step'],
    'step2>step3': ['transitions/push', 'STORY: the next step'], 'step3>result': ['transitions/dissolve', 'EMOTION: the calm after the routing'] },
  music: 'music/bed_documentary_marimba_loop8', bpm: 90, musicGainDb: 0, ceilingDb: -2.5, fadeInMs: 30, duckDb: 12,   // curious explainer bed (90 BPM: a beat is 20 frames); with a VO the bed ducks duckDb under it
  sfx: { head: 'sfx/whoosh/swish_xs', kicker: 'sfx/ui/pop', logo: 'sfx/logo/hybrid', reveal: 'sfx/hit/soft' },
  caption: { wide: { size: 46, y: 1000, w: 1500, maxWords: 5, maxChars: 34 }, tall: { size: 62, y: 1200, w: 900, maxWords: 4, maxChars: 18 } },
  tail: { liftS: 2.0, fadeS: 1.2, bedDb: -40 },
  layers: [{ kind: 'grain', params: { stock: 'upload-safe' } }],
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': { to: ['brand.name', 'text.askTitle', 'text.reframe.say'], fn: (v, ctx) => { const re = (x) => String(x).split(ctx.defaults.brand.name).join(v); return [v, re(ctx.defaults.text.askTitle), re(ctx.defaults.text.reframe.say)]; }, note: 'also renames the demo brand inside the copy that names it' }, 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta',
  'brand.font.display': 'brand.font.display', 'brand.font.text': 'brand.font.text', 'text.headline': 'text.question.head', 'text.subhead': 'text.reframe.head', 'text.cta': 'brand.cta', 'text.fine': 'text.fine',
  'voice.words': 'voice.words', 'voice.audio': 'voice.audio', 'media.screen': 'media.step2', 'media.screen2': 'media.step3', 'claims': 'claims', 'music': 'music', 'aspects': 'aspect', 'length': 'length' };
export const ORDER = ['question', 'wrong', 'reframe', 'step1', 'step2', 'step3', 'result', 'end'];
export const BEATS = { 60: { question: 8, wrong: 11, reframe: 7, step1: 13, step2: 16, step3: 14, result: 12, end: 9 }, 70: { question: 9, wrong: 12, reframe: 8, step1: 16, step2: 18, step3: 16, result: 16, end: 10 },
  90: { question: 12, wrong: 16, reframe: 10, step1: 20, step2: 24, step3: 21, result: 20, end: 12 } };   // scene lengths in beats of the bed (no VO)
export const LY = {
  wide: { top: { x: 110, y: 62, w: 1700, size: 72 }, topK: { x: 110, y: 112, w: 1700, size: 68 }, kicker: { x: 110, y: 56, size: 26 }, side: { x: 110, y: 300, w: 700, size: 100 }, sideWin: [0.47, 0.12, 0.5, 0.7], win: [0.09, 0.22, 0.82, 0.64], winAsk: [0.04, 0.22, 0.6, 0.64],
    ask: [0.6, 0.22, 0.37, 0.62], ints: [0.16, 0.24, 0.68, 0.54], dash: [0.08, 0.19, 0.84, 0.66], toasts: { pos: [0.64, 0.22], width: 0.32 }, markY: 0.36, tz: {} },
  tall: { top: { x: 80, y: 290, w: 870, size: 76 }, topK: { x: 80, y: 340, w: 870, size: 72 }, kicker: { x: 80, y: 278, size: 28 }, side: { x: 80, y: 290, w: 870, size: 96 }, sideWin: [0.04, 0.3, 0.92, 0.42], win: [0.03, 0.33, 0.94, 0.42], winAsk: [0.03, 0.56, 0.94, 0.2],
    ask: [0.05, 0.27, 0.9, 0.3], ints: [0.1, 0.33, 0.8, 0.32], dash: [0.06, 0.3, 0.88, 0.44], toasts: { pos: [0.08, 0.34], width: 0.84 }, markY: 0.36, tz: { inbox: [0.17, 0.06, 0.55, 0.6], chat: [0.17, 0, 0.55, 0.62] } },
};
const SPOT = { runTest: [0.933, 0.068], runBox: [0.884, 0.035, 0.098, 0.066] };

/* narration words per scene (the VO is matched to the lines in order) */
const lineWords = (C, id) => String(C.text[id]?.say ?? '').split(/\s+/).filter(Boolean);
function voWords(C) { const f = path.resolve(HERE, C.voice.words), j = JSON.parse(fs.readFileSync(f, 'utf8')), w = Array.isArray(j) ? j : j.words;
  if (!Array.isArray(w) || !w.length || w.some((x) => !x || typeof x.w !== 'string' || !Number.isFinite(x.s) || !Number.isFinite(x.e) || x.e < x.s)) throw new Error(`voice.words ${f}: not a [{w, s, e}] list in seconds`); return w.map((x) => ({ w: x.w, s: x.s, e: x.e })); }
/* scene lengths: from the bed's beats (no VO) or from the voice: each change sits in the middle of the breath between two lines, on a whole frame, never inside a word */
export function sceneTimes(C) {
  const fps = C.fps, ids = ORDER, beat = 60 / C.bpm;
  if (!C.voice?.words) { const B = BEATS[C.length] || BEATS[70]; return { durs: ids.map((id) => +(B[id] * beat).toFixed(4)), words: null }; }
  const W = voWords(C), counts = ids.map((id) => lineWords(C, id).length), need = counts.reduce((a, b) => a + b, 0);
  if (W.length !== need) throw new Error(`voice.words: ${W.length} words, but the narration (CONFIG.text.*.say) has ${need}: one line per scene, in order (${ids.filter((_, i) => counts[i]).map((id, i) => id).join(', ')})`);
  const firstOf = [], lastOf = []; let k = 0; ids.forEach((id, i) => { firstOf[i] = counts[i] ? W[k] : null; k += counts[i]; lastOf[i] = counts[i] ? W[k - 1] : null; });
  const starts = [0]; for (let i = 1; i < ids.length; i++) { const prev = lastOf.slice(0, i).filter(Boolean).at(-1), nx = firstOf[i];
    const t = nx ? (prev.e + nx.s) / 2 : prev.e + 0.45; if (nx && nx.s - prev.e < 0.12) throw new Error(`voice.words: no breath between "${prev.w}" and "${nx.w}" (${(nx.s - prev.e).toFixed(2)} s): leave 0.12 s or more between the lines`);
    starts.push(Math.round(t * fps) / fps); }
  const endHold = Math.max(4.5, (BEATS[C.length] || BEATS[70]).end * beat), seconds = starts.at(-1) + endHold;
  return { durs: starts.map((s, i) => +((i + 1 < starts.length ? starts[i + 1] : seconds) - s).toFixed(4)), words: W };
}
export function explainerScenes(C, A, B, durs) {
  const T = C.text, L = LY[A.key], tall = A.tall, M = C.media || {}, out = [], D = Object.fromEntries(ORDER.map((id, i) => [id, durs[i]]));
  const tx = (k) => (C.transitions[k] ? { tx: C.transitions[k][0], txReason: C.transitions[k][1] } : {}), add = (s) => out.push({ ...s, dur: D[s.id], ...tx(`${out.at(-1)?.id}>${s.id}`) });
  const hd = (text, at, base, o = {}) => ({ text, at, ...base, ...o }), kk = (text, at) => ({ text, at, ...L.kicker });
  const win = (key, box, screen, o = {}) => ({ id: 'ui.appWindow', key, at: o.at ?? 0, screen, params: { box, theme: 'light', title: o.title ?? B.name, url: o.url ?? B.url, accent: B.accent, label: 'placeholder UI · demo data', labelSize: tall ? 24 : 22, enter: o.enter ?? 'none', ...(tall && o.tz && L.tz[o.tz] ? { zoom: [{ t: 0, rect: L.tz[o.tz] }] } : {}), ...(o.params || {}) } });
  const toasts = (at, items, base) => ({ id: 'ui.notifyStack', at, params: { ...base, max: 3, accent: B.accent, app: 'Inbox', items } });
  /* 1-2: the question and the wrong model */
  add({ id: 'question', bg: 'paper', grid: 1, why: 'the pain as a question, on frame 0', heads: [hd(T.question.head, 0.12, L.side)],
    items: [win('qWin', L.sideWin, { name: 'inbox', keys: [[0, { calm: 0, scroll: 0 }], [0.01, { scroll: 2 }, D.question]] }, { tz: 'inbox', params: { kb: [1, 1.05] } }), toasts(0.1, [['New request', 'Refund for a double charge', 'mail'], ['New message', 'Cannot log in after reset', 'search'], ['New form', 'Export button does nothing', 'doc']].map((q, i) => ({ at: 0.3 + i * 0.7, title: q[0], body: q[1], icon: q[2] })), L.toasts)] });
  add({ id: 'wrong', bg: 'paper', grid: 1, why: 'the wrong model: forwarding by hand', heads: [hd(T.wrong.head, 0.08, L.side)],
    items: [win('wWin', L.sideWin, { name: 'chat', keys: [[0, { msgs: 1 }], [0.2, { msgs: 5 }, Math.min(3, D.wrong * 0.5)]] }, { tz: 'chat', title: 'Team chat', url: 'chat.example', params: { kb: [1.02, 1.07] } }),
      { id: 'callout.arrowLabel', at: Math.min(3.4, D.wrong * 0.55), params: { from: tall ? [0.62, 0.62] : [0.33, 0.78], to: tall ? [0.45, 0.55] : [0.62, 0.66], label: T.chaseLabel, accent: '#D9473F', size: tall ? 1.15 : 1 } }] });
  /* 3: the reframe, the product named once */
  add({ id: 'reframe', bg: 'paper', hold: true, why: 'the reframe: the product, once', mark: { at: 0.1, cx: A.W / 2, cy: A.H * L.markY, size: tall ? 150 : 130, nameSize: tall ? 104 : 96, row: !tall },
    heads: [hd(T.reframe.head, 0.8, { x: tall ? 80 : 210, y: A.H * L.markY + (tall ? 300 : 140), w: tall ? 920 : 1500, size: tall ? 70 : 64, align: 'center', weight: 800 })], cues: [{ t: 0.1, id: C.sfx.reveal, why: 'the mark lands' }] });
  /* 4: step 1, connect */
  add({ id: 'step1', bg: 'paper', grid: 1, why: 'step 1: connect the sources (neutral glyphs)', kickers: [kk(T.step1.kicker, 0.05)], heads: [hd(T.step1.head, 0.12, L.topK)],
    items: [{ id: 'ui.integrationGrid', at: 0.3, params: { box: L.ints, hub: B.name.slice(0, 1), accent: B.accent, glyphs: C.integrations, stagger: 0.12, connectAt: 0.8, scale: tall ? 1.1 : 1 } }], cues: [{ t: 0.05, id: C.sfx.kicker, why: 'step kicker' }] });
  /* 5: step 2, describe: the answer streams, the steps build */
  const d2 = D.step2, typeAt = 0.9, apply = Math.max(typeAt + 5.6, d2 - 1.6);
  add({ id: 'step2', bg: 'paper', grid: 1, why: 'step 2: describe the rule, the steps build', kickers: [kk(T.step2.kicker, 0.05)], heads: [hd(T.step2.head, 0.12, L.topK)],
    items: [applyMedia(win('s2Win', L.win, { name: 'builder', keys: [[0, { nodes: 0 }], [typeAt + 2.9, { nodes: 5 }, Math.max(1.5, apply - typeAt - 3.2)]] }, { params: { move: [{ t: 0.15, box: L.winAsk }, { t: apply + 0.3, box: L.win }], zoom: tall ? [{ t: 0, rect: [0.15, 0.06, 0.6, 0.8] }] : [] } }), M.step2, 'step2'),
      { id: 'ui.aiAnswer', at: 0.3, dur: apply + 0.4 - 0.3, params: { box: L.ask, prompt: T.prompt, answer: T.answer, typeAt: typeAt - 0.3, cps: 22, thinkS: 0.5, wps: 9, applyAt: apply - 0.3, apply: T.apply, accent: B.accent, title: T.askTitle, avatar: B.name.slice(0, 1), scale: tall ? 1.15 : 1.05 } }],
    cues: [{ t: 0.05, id: C.sfx.kicker, why: 'step kicker' }] });
  /* 6: step 3, it runs: the test ticks, the requests route */
  const run = 1.6;
  add({ id: 'step3', bg: 'paper', grid: 1, why: 'step 3: it runs on its own', kickers: [kk(T.step3.kicker, 0.05)], heads: [hd(T.step3.head, 0.12, L.topK)],
    items: [applyMedia(win('s3Win', L.win, { name: 'builder', keys: [[0, { nodes: 5, run: 0 }], [run - 0.3, { hoverRun: 1 }], [run + 0.15, { run: 5, hoverRun: 0 }, 1.2]] }, { params: { zoom: tall ? [{ t: 0, rect: [0.15, 0.06, 0.6, 0.8] }, { t: run - 0.7, rect: [0.52, 0, 0.48, 0.5] }, { t: run + 0.4, rect: [0.15, 0.06, 0.6, 0.8] }] : [] } }), M.step3, 'step3'),
      { id: 'ui.cursorJourney', at: 0, winOf: 's3Win', params: { path: [{ t: 0.3, x: 0.6, y: 0.6 }, { t: run - 0.3, x: SPOT.runTest[0] - 0.01, y: SPOT.runTest[1] + 0.01, hover: SPOT.runBox }, { t: run, x: SPOT.runTest[0], y: SPOT.runTest[1] + 0.005, click: true }, { t: run + 1.4, x: 0.7, y: 0.5 }], size: tall ? 1.15 : 1 } },
      toasts(run + 1.0, T.runToasts.map((q, i) => ({ at: i * 0.6, title: q[0], body: q[1], icon: q[2] })), L.toasts)], cues: [{ t: 0.05, id: C.sfx.kicker, why: 'step kicker' }] });
  /* 7: result */
  add({ id: 'result', bg: 'paper', grid: 1, why: 'the result: what changes', heads: [hd(T.result.head, 0.12, L.top)],
    items: [{ id: 'ui.dashboardAssemble', at: 0.25, params: { box: L.dash, accent: B.accent, title: B.name + ' · ' + T.dashTitle, cols: tall ? 2 : 4, rows: tall ? 4 : 3, source: C.dashSource, scale: tall ? 1.1 : 1, ...(tall ? { cards: DASH_TALL } : {}) } }] });
  /* 8: end card */
  add({ id: 'end', bg: 'paper', hold: true, why: 'end card held', card: { at: 0.05, unit: tall ? 1.2 : 1, stack: tall, cy: A.H * (tall ? 0.3 : 0.36), fine: T.fine, fineY: tall ? 600 : 64 }, cues: [{ t: 0.2, id: C.sfx.logo, why: 'sonic logo on the name' }] });
  return out;
}
const DASH_TALL = [{ kind: 'kpi', label: 'Requests routed', value: 1284, span: [0, 0, 1, 1] }, { kind: 'kpi', label: 'Open right now', value: 7, span: [1, 0, 1, 1] }, { kind: 'line', label: 'Routed per day', span: [0, 1, 2, 1] },
  { kind: 'bar', label: 'By topic', span: [0, 2, 1, 2] }, { kind: 'donut', label: 'By team', value: 0.64, span: [1, 2, 1, 2] }];

/* captions: no VO = the narration line chunked and timed at reading speed inside its scene; VO = the spoken words (chunkCaptions), the active word lit */
function captionsFor(C, A, plan, words) {
  const cfg = C.caption[A.key], out = [], read = (n) => Math.max(0.5, 0.35 + 0.28 * n);
  if (words) for (const ch of chunkCaptions(words, { maxWords: cfg.maxWords, maxChars: cfg.maxChars })) out.push({ text: ch.words.map((w) => w.w).join(' '), start: +ch.start.toFixed(4), end: +ch.end.toFixed(4), words: ch.words });
  else for (const sc of plan.scenes) { const ws = lineWords(C, sc.id); if (!ws.length) continue; const chunks = []; let cur = [];
    for (const w of ws) { const nx = [...cur, w].join(' '); if (cur.length && (cur.length >= cfg.maxWords || nx.length > cfg.maxChars)) { chunks.push(cur); cur = []; } cur.push(w); if (/[.,?!]$/.test(w)) { chunks.push(cur); cur = []; } } if (cur.length) chunks.push(cur);
    const t0 = sc.start + 0.35, t1 = sc.end - 0.35, need = chunks.reduce((a, c) => a + read(c.length), 0), k = Math.min(1.25, (t1 - t0) / need); let t = t0;
    for (const c of chunks) { const d = read(c.length) * k; out.push({ text: c.join(' '), start: +t.toFixed(4), end: +Math.min(t + d, t1).toFixed(4) }); t += d; } }
  return { ...cfg, chunks: out };
}
export function buildPlan(C) {
  const A = aspectOf(C), B = C.brand, bad = digitsInCopy(C.text);
  if (bad.length) throw new Error('saas-explainer honesty: ' + bad.join(' | '));
  const { durs, words } = sceneTimes(C), list = explainerScenes(C, A, B, durs);
  for (const s of list) for (const h of s.heads || []) (s.cues ||= []).push({ t: h.at ?? 0, id: C.sfx.head, why: 'headline rises', overBedDb: -10 });
  const plan = scenesToPlan(list, C, A, { template: 'saas-explainer', claims: C.claims, paceRule: { aslMax: 10, longMax: 16.5 } });
  const cap = captionsFor(C, A, plan, words); for (const sc of plan.scenes) sc.caption = { ...cap, chunks: cap.chunks.filter((c) => c.end > sc.start - 0.6 && c.start < sc.end + 0.6) };
  for (const ch of cap.chunks) { const w = measure(ch.text, cap.size, { weight: 800 }); plan.texts.push({ id: 'caption', text: ch.text, t: [ch.start, ch.end], box: [Math.round(A.W / 2 - w / 2 - cap.size * 0.45), Math.round(cap.y - cap.size * 0.92), Math.round(A.W / 2 + w / 2 + cap.size * 0.45), Math.round(cap.y + cap.size * 0.3)], fontPx: cap.size, role: 'caption', fg: '#FFFFFF' }); }
  const end = plan.scenes.at(-1), F = C.fps, lift = Math.round((end.start + C.tail.liftS) * F), fade = Math.round(C.tail.fadeS * F);
  plan.bedAutomation = [{ frame: 0, gain_db: 0 }, { frame: lift, gain_db: 0 }, { frame: lift + fade, gain_db: C.tail.bedDb }];
  plan.audio = { mode: words ? 'vo' : 'music', role: 'explainer', quiet: [{ t: [+((lift + fade) / F).toFixed(4), plan.seconds], kind: 'hold', why: 'end card on a quiet hold' }] };
  if (words) { plan.vo = 'vo.wav'; plan.duckDb = C.duckDb; plan.voice = { words, audio: C.voice.audio ?? null }; for (const c of plan.cues) if (words.some((w) => c.t >= w.s - 0.1 && c.t <= w.e + 0.15)) c.overVoDb = -20; }
  /* the beats on the explainer beat sheet (patterns/structures.json `explainer`; tools/structure_check.py reads plan.structure): the three steps are the reframe's
     walkthrough (the new model shown working), the result is the proof (the same inbox, routed), the end card is the so-what */
  const BEAT = { question: 'question', wrong: 'wrongmodel', reframe: 'reframe', step1: 'reframe', step2: 'reframe', step3: 'reframe', result: 'proof', end: 'sowhat' }, secs = [];
  for (const sc of plan.scenes) { const name = BEAT[sc.id] || sc.id, last = secs.at(-1); if (last && last.name === name) last.t[1] = sc.end; else secs.push({ name, t: [sc.start, sc.end] }); }
  plan.structure = { pattern: 'explainer', sections: secs };
  plan.honesty = `fictional product (${C.brand.name}); placeholder HTML screens labelled in frame` + (words && !C.voice.audio ? '; the VO is a labelled guide signal (no voice)' : '');
  return plan;
}
