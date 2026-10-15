/* TEMPLATE proof-film: the proof film (storyboard shape I, success-patterns round 4/5; launch-playbook L8). 36-60 s, 16:9 master + a 9:16 re-layout.
   claim (<= 6 words, one accent word) -> name -> method / setting card -> ONE builder (chart.scatterFrontier | ui.branchTrace | ui.dataTable) -> head-to-head rows
   -> big numbers -> three stat cards -> URL held on a quiet end card. ONE continuous camera (camera/cam2d.js) travels between the panels: no hard cuts by default.
   Sound: a light bed (20-36% bass share, `plan.audio.role` proof), a quiet UI tick per state change, ONE soft hit on the number reveal, a planned quiet open, NO stinger on
   the end card and a planned quiet hold (plan.audio.quiet kind hold). Optional sparse VO: `vo: { audio, words }` puts every camera move in a speech gap (cutgen walkthrough).
   HONESTY GATE (honesty.mjs, the point of the template): EVERY number field needs BOTH a `source` and a `method` that say something; a number in prose, the brand, an axis unit or the
   VOICE is refused; the build FAILS (exit 2, the field named) when one is missing.
   DEMO CONTENT: "Acme Reader" is a FICTIONAL brand and every number is a labelled placeholder (source "illustrative placeholder, replace" + a method line); the frame prints
   ILLUSTRATIVE on every number panel. Replace the source and method with real ones, then set `illustrative: false`.
   Edit the CONFIG block only; `node make.mjs [--set format=tall] [--set builder.kind=trace]` then `hyperframes render`. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { PLATFORMS, SIZES, beatGrid } from '../_shared/plan.mjs';
import { GFX, gfxCues, scatterTimes, tableTimes, traceTimes } from '../../type/gfx/index.js';
import { safeInset, pillH } from './panels.mjs';
import { problems, HonestyError, numberFields, isIllustrative, claimWords, blank } from './honesty.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);

const SRC = 'illustrative placeholder, replace';   // the source every demo number carries
const F = (id, label) => ({ id, label });

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  format: 'wide', fps: 30,                         // 'wide' 1920x1080 | 'tall' 1080x1920 (a re-layout, not a crop)
  illustrative: true,                              // the frame prints ILLUSTRATIVE on every number panel; false only when every source is real (the gate checks)
  brand: { name: 'Acme Reader', accent: '#4a18ed', ink: '#16151B', paper: '#F4F2EE', muted: '#5D5A66', url: 'reader.example' },   // FICTIONAL placeholder brand (palette.accent -> brand.accent like the ad template)
  claim: 'Better answers, *lower* cost.',          // at most 6 words, exactly one *accent* word
  name: { intro: 'Introducing', promise: 'A fictional product. Every number in this film is a placeholder.' },
  setting: { title: 'How we measured',               // the method card: what was measured, on what, against whom, and the counts (each a number field)
    rows: [{ label: 'What', text: 'Answer score and cost per task' }, { label: 'On what', text: 'A placeholder task set: replace it with yours' }, { label: 'Against', text: 'Other systems, same tasks, same budget' }],
    numbers: [{ label: 'Tasks', value: 120, source: SRC, method: 'count of tasks in the placeholder set' }, { label: 'Runs per task', value: 3, source: SRC, method: 'repeats averaged per task (placeholder)' },
      { label: 'Systems', value: 7, source: SRC, method: 'count of systems in the placeholder field' }] },
  builder: { kind: 'scatter',                       // ONE builder: 'scatter' (chart.scatterFrontier) | 'trace' (ui.branchTrace) | 'table' (ui.dataTable; it IS the head-to-head, so that stage is skipped)
    scatter: { title: 'Score against cost per task', source: SRC, method: 'score = mean graded answer; cost = list price x tokens; frontier = no other system is both cheaper and higher scoring',
      points: [{ label: 'System A', x: 12.4, y: 54.0 }, { label: 'System B', x: 9.1, y: 52.5 }, { label: 'System C', x: 6.8, y: 47.0 }, { label: 'System D', x: 4.7, y: 42.5 }, { label: 'System E', x: 3.9, y: 36.0 }, { label: 'System F', x: 7.9, y: 40.5 }, { label: 'System G', x: 5.6, y: 34.0 }],
      hero: { label: 'Acme Reader', x: 3.6, y: 58.5, callout: ['Highest score', 'at the lowest cost'] },
      x: { min: 0, max: 14, ticks: [0, 2, 4, 6, 8, 10, 12, 14], prefix: '$', label: 'Cost per task  ·  cheaper →', invert: true }, y: { min: 30, max: 70, ticks: [30, 40, 50, 60, 70], label: 'Score' } },
    trace: { source: 'illustrative placeholder run', input: { title: 'Question', lines: ['"Which clause covers', 'late delivery?"'], icon: 'mail' }, run: ['r-flat'],   // one wrong fork: the red runs down the line to the result
      lanes: [{ label: 'Find', icon: 'search', steps: [{ label: 'Locate', forks: [F('f-sec', 'Right section'), F('f-old', 'Old version')], correct: 'f-sec' }, { label: 'Scope', forks: [F('f-part', 'Just the clause'), F('f-all', 'Whole file')], correct: 'f-part' }] },
        { label: 'Read', icon: 'doc', steps: [{ label: 'Parse', forks: [F('r-tab', 'Table intact'), F('r-flat', 'Table flattened')], correct: 'r-tab' }, { label: 'Quote', forks: [F('r-exact', 'Exact words'), F('r-para', 'Paraphrase')], correct: 'r-exact' }] },
        { label: 'Check', icon: 'check', steps: [{ label: 'Verify', forks: [F('c-src', 'Matches the source'), F('c-guess', 'Plausible guess')], correct: 'c-src' }, { label: 'Cite', forks: [F('c-cite', 'Cites the page'), F('c-none', 'No citation')], correct: 'c-cite' }] }],
      decision: { title: 'Decision', forks: [F('d-ans', 'Answer with citation'), F('d-abst', 'Abstain')], correct: 'd-ans' } },
    table: { finding: 'Acme Reader scored higher and cost less on the same tasks.', source: SRC, method: 'mean per task over the placeholder run; cost = list price x tokens',
      columns: [{ label: 'Metric' }, { label: 'Alternative' }, { label: 'Acme Reader' }], highlight: { col: 2 },
      rows: [{ label: 'Answer score', unit: '', dec: 1, values: [52.5, 58.5] }, { label: 'Cost per task', unit: '$', dec: 2, values: [9.1, 3.6] }, { label: 'Tokens per task', unit: 'M', dec: 2, values: [2330000, 1350000] }] } },
  h2h: { finding: 'Same tasks, same budget. Acme Reader answered more, for less.', source: SRC, method: 'mean per task over the placeholder run; cost = list price x tokens',   // head-to-head rows (skipped when builder.kind is table)
    columns: [{ label: 'Metric' }, { label: 'Alternative' }, { label: 'Acme Reader' }], highlight: { col: 2 },
    rows: [{ label: 'Tokens per task', unit: 'M', dec: 2, values: [2330000, 1350000] }, { label: 'Cost per task', unit: '$', dec: 2, values: [9.1, 3.6] }, { label: 'Answer score', unit: '', dec: 1, values: [52.5, 58.5] }] },
  numbers: { items: [{ label: 'answer score', value: 58.5, dec: 1, unit: '', source: SRC, method: 'mean graded answer over the placeholder run' },
    { label: 'lower cost per task', value: 60, dec: 0, unit: '%', source: SRC, method: '1 - (cost, Acme Reader / cost, alternative); placeholder inputs' }] },   // 1 to 3 big numbers, each with its own source and method on screen
  cards: [{ label: 'Better', value: 58.5, dec: 1, unit: '', line: 'answer score', alt: 52.5, altLabel: 'alternative', source: SRC, method: 'mean graded answer (placeholder)' },   // exactly three: better / leaner / cheaper
    { label: 'Leaner', value: 1350000, dec: 2, unit: 'M', line: 'tokens per task', alt: 2330000, altLabel: 'alternative', source: SRC, method: 'mean tokens per task (placeholder)' },
    { label: 'Cheaper', value: 3.6, dec: 2, unit: '$', line: 'cost per task', alt: 9.1, altLabel: 'alternative', source: SRC, method: 'list price x tokens (placeholder)' }],
  end: { line: 'Replace every placeholder before you publish.', chips: [] },   // the URL is brand.url; chips are benefit pills without digits
  tail: { holdS: 5.4, liftS: 0.8, fadeMs: 600, bedDb: -40, roomDb: -26 },   // end card: quiet hold (plan.audio.quiet kind hold): the bed lifts liftS, then drops to bedDb and a steady room tone (roomDb under the un-dipped bed) takes over, so the hold is flat, not a pulsing bed; NO stinger. The near-silent part must be 3 to 9 s
  timing: { minS: 36, maxS: 60, travelS: 1.1, enterS: 0.15, ease: 'soft', dip: 0.08, push: 0.035, holdS: 1.4, claim: 2.4, name: 1.8, setting: 2.6, numbers: 2.8, cards: 3.0, endBuild: 1.2, quietOpenS: 1.2 },   // seconds of build per stage; stages are rounded up to whole beats; a stage's content starts `enterS` after the camera leaves for it (the camera is still settling); the camera dips `dip` in a move and pushes `push` while it dwells
  cut: {},                                           // a motivated hard cut instead of a camera move: { 'builder>h2h': 'EMOTION: ...' } (a boundary 'from>to'; the reason is required)
  vo: { words: null, audio: null },                  // optional sparse VO: words = a words.json [{w, s, e}] (seconds) turns it on; audio = your recording (null = a labelled guide signal for a dry run)
  music: 'music/bed_playful_bounce_loop8', bpm: 120, musicGainDb: 0, ceilingDb: -3.0, fadeInMs: 40, duckDb: 16, sfxUnderVoDb: -22,   // bpm = the bed's snapped tempo (music/manifest.json); stages start on its beats
  layers: [{ kind: 'grain', params: { stock: 'digital-soft' } }],
  sfx: { hold: 'sfx/amb/room_tone', claim: 'sfx/ui/tick', travel: ['sfx/ui/slide', 'sfx/whoosh/swish_xs'], arrive: 'sfx/ui/tick', numbers: 'sfx/hit/soft', count: 'sfx/ui/count_run', card: 'sfx/ui/pop', cut: 'sfx/tx/cut_tick' },   // saas_launch / product_ad palette; no end sting; hold = the room tone under the quiet hold
};
/* ============================================================================== */

/* the shared project file -> this CONFIG (`mp list proof-film`). Numbers stay in the CONFIG number fields (each needs source AND method); a project sets them through overrides['proof-film'].
   A music id also sets bpm from music/manifest.json (stages start on the bed's beats) */
export const PROJECT_MAP = {
  // the brand name also renames the hero in the builder and the head-to-head column, and every finding / method line that named the demo brand
  'brand.name': { to: ['brand.name', 'builder.scatter.hero.label', 'builder.table.columns.2.label', 'h2h.columns.2.label', 'builder.table.finding', 'h2h.finding', 'numbers.items.1.method'],
    fn: (v, ctx) => { const D = ctx.defaults, was = D.brand.name, re = (s) => s.split(was).join(v); return [v, v, v, v, re(D.builder.table.finding), re(D.h2h.finding), re(D.numbers.items[1].method)]; } },
  'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.muted': 'brand.muted', 'brand.url': 'brand.url',
  'text.headline': 'claim', 'text.intro': 'name.intro', 'text.promise': 'name.promise', 'text.end': 'end.line',
  'voice.words': 'vo.words', 'voice.audio': 'vo.audio',
  'music': { to: ['music', 'bpm'], fn: (id, ctx) => { const m = id && ctx.music(id); if (!m) throw new Error(`proof-film needs a pack bed: ${id} is not in music/manifest.json`); return [id, m.bpm]; } },
  'aspect': { to: 'format', values: { '16:9': 'wide', '9:16': 'tall' } },
};
export const ASPECTS = { '16:9': { how: 'native' }, '9:16': { how: 'native', note: 'own FORMAT constants (a re-layout); ui.branchTrace is landscape-only' }, '1:1': { how: 'manual', note: 'FORMAT has wide and tall only' }, '4:5': { how: 'manual', note: 'FORMAT has wide and tall only' } };

const FORMAT = {   // box = [x, y, w, h] as fractions of the safe rect (pulled in by the camera push: panels.mjs safeInset); the callout offset is for the scatter's starred point
  wide: { W: 1920, H: 1080, platform: 'x.video', zone: 'wideTitle', pitch: [1920, 0], box: { scatter: [0, 0, 1, 1], trace: [0, 0, 1, 1], table: [0, 0, 1, 0.76] }, tableScale: 1.4, calloutOffset: [-200, 110] },
  tall: { W: 1080, H: 1920, platform: 'reels.organic', zone: 'conservative', pitch: [0, 1920], box: { scatter: [0, 0, 1, 1], trace: [0, 0, 1, 1], table: [0, 0, 1, 0.72] }, tableScale: 1.12, calloutOffset: [-380, -60] },   // 'conservative' 9:16 union: x 65-960, y 269-1248
};
const boxFor = (fm, push, key, reserve = 0) => { const S = safeInset(fm.zone, fm.W, fm.H, push), r = fm.box[key]; return [(S.x0 + r[0] * S.w) / fm.W, (S.y0 + r[1] * S.h) / fm.H, (r[2] * S.w) / fm.W, (r[3] * S.h - reserve) / fm.H]; };   // reserve: px kept free at the bottom of the box (the ILLUSTRATIVE pill sits there)
const pillRoom = (fm, ill) => (ill ? pillH(fm.H > fm.W) + 18 : 0);
export const STAGE_KINDS = (C) => ['claim', 'name', 'setting', 'builder', ...(C.builder.kind === 'table' ? [] : ['h2h']), 'numbers', 'cards', 'end'];
const distinct = (a) => [...new Set(a.filter((v) => !blank(v)).map((v) => String(v).trim()))];

/* ---------- the builder + head-to-head parts: gfx ids and params (the parts print their own source / method / illustrative notes) ---------- */
function tableParams(C, fm, t, extra = {}) {
  const row = (r) => ({ label: r.label, unit: r.unit ?? '', dec: r.dec, values: r.values });
  return { box: boxFor(fm, C.timing.push, 'table'), scale: fm.tableScale, finding: t.finding, columns: t.columns, rows: t.rows.map(row), highlight: t.highlight, source: distinct([t.source, ...t.rows.map((r) => r.source)]).join(' · '), accent: C.brand.accent, theme: 'light', ...extra };
}
export function builderPart(C, fm) {
  const b = C.builder, ill = isIllustrative(C);
  if (b.kind === 'scatter') { const s = b.scatter, nums = [...s.points, ...(s.hero ? [s.hero] : [])];
    const params = { box: boxFor(fm, C.timing.push, 'scatter', pillRoom(fm, ill)), title: s.title, points: s.points.map((p) => ({ label: p.label, x: p.x, y: p.y, source: p.source ?? s.source })), x: s.x, y: s.y, accent: C.brand.accent, theme: 'light', note: '', calloutOffset: fm.calloutOffset,   // note '': the honesty label is the pill panels.mjs draws (28 px), not the part's 17 px footnote
      method: distinct([s.method, ...nums.map((p) => p.method)]).join(' · '), ...(s.hero ? { hero: { label: s.hero.label, x: s.hero.x, y: s.hero.y, source: s.hero.source ?? s.source, callout: s.hero.callout } } : { hero: null }) };
    const tm = scatterTimes({ ...GFX['chart.scatterFrontier'].d, ...params }); return { id: 'chart.scatterFrontier', params, settleS: tm.calloutAt + 0.9 }; }
  if (b.kind === 'trace') { const t = b.trace, params = { box: boxFor(fm, C.timing.push, 'trace', pillRoom(fm, ill)), input: t.input, lanes: t.lanes, decision: t.decision, run: t.run, note: '', accent: C.brand.accent, theme: 'light' };
    const tm = traceTimes({ ...GFX['ui.branchTrace'].d, ...params }); return { id: 'ui.branchTrace', params, settleS: tm.outcomeAt + 0.9 }; }
  const params = tableParams(C, fm, b.table, b.table.bars ? { bars: b.table.bars } : {}), tm = tableTimes({ ...GFX['ui.dataTable'].d, ...params });
  return { id: 'ui.dataTable', params, settleS: tm.hlAt + 0.9 };
}
const h2hPart = (C, fm) => { const params = tableParams(C, fm, C.h2h), tm = tableTimes({ ...GFX['ui.dataTable'].d, ...params }); return { id: 'ui.dataTable', params, settleS: tm.hlAt + 0.9 }; };

/* ---------- VO: every stage change goes into a speech gap (cuts/story45.py walkthrough: advance at gap start + 2 frames, never inside a word) ---------- */
function voSteps(C, nSteps, fps) {
  const py = process.env.PYTHON || 'python3', words = path.resolve(HERE, C.vo.words);
  return JSON.parse(execFileSync(py, [path.join(HERE, '..', '..', 'cuts', 'cutgen.py'), 'walkthrough', '--words', words, '--fps', String(fps), '--steps', String(nSteps), '--end-hold', String(C.tail.holdS)], { encoding: 'utf8' }));
}
const rawWords = (C) => { const j = JSON.parse(fs.readFileSync(path.resolve(HERE, C.vo.words), 'utf8')); return Array.isArray(j) ? j : j.words; };
const loadWords = (C) => rawWords(C).map((w) => ({ w: w.w, s: w.s, e: w.e }));
/* a transcript the gate can read: every entry {w: "text", s, e} in seconds, in order (an entry under another key would otherwise be skipped by the number check, and its word never gated) */
function wordShape(words) {
  if (!Array.isArray(words) || !words.length) return ['vo.words: the transcript is empty or not a list: a words.json is [{w, s, e}] in seconds, or {words: [...]}'];
  const bad = []; words.forEach((w, i) => { if (!w || typeof w.w !== 'string' || !w.w.trim() || !Number.isFinite(w.s) || !Number.isFinite(w.e) || w.e < w.s || (i && w.s < words[i - 1].s)) bad.push(`vo.words[${i}]: ${JSON.stringify(w)} is not {w: "text", s, e} in seconds, in order (the key is "w", not "word")`); });
  return bad.slice(0, 5).concat(bad.length > 5 ? [`vo.words: ${bad.length - 5} more entries of the wrong shape`] : []);
}

/* the whole gate: the CONFIG block plus the VO transcript (a number the voice says needs a number field too) */
export function gateProblems(C) {
  let voWords = [];
  if (C.vo && C.vo.audio && !C.vo.words) return ['vo.audio: a recording needs its transcript (vo.words): the gate reads the words for numbers and the camera moves in the gaps between them'];
  if (C.vo && C.vo.words) { let raw; try { raw = rawWords(C); } catch (e) { return [`vo.words: cannot read the transcript "${C.vo.words}" (${e.message}): a words.json is [{w, s, e}] in seconds, or {words: [...]}`]; }
    const shape = wordShape(raw); if (shape.length) return [...shape, ...problems(C, {})]; voWords = loadWords(C); }
  return problems(C, { voWords });
}

export function buildPlan(C) {
  const gate = gateProblems(C); if (gate.length) throw new HonestyError(gate);
  const fps = C.fps, fm = FORMAT[C.format], T = C.timing, kinds = STAGE_KINDS(C), q = (s) => Math.round(s * fps) / fps, sec = (f) => +(f / fps).toFixed(4);
  const hasVo = !!(C.vo && C.vo.words), grid = beatGrid(C.bpm, fps, 600), fpb = grid.framesPerBeat, warnings = [], ill = isIllustrative(C), cw = claimWords(C.claim);
  const part = (k) => (k === 'builder' ? builderPart(C, fm) : k === 'h2h' ? h2hPart(C, fm) : null);
  const build = { claim: T.claim, name: T.name, setting: T.setting, numbers: T.numbers, cards: T.cards, end: T.endBuild }, travel = Math.round(T.travelS * fps);
  /* stage start frames t0 (the camera leaves for it; stage 0 starts at frame 0) and the content-start frame `at` (t0 + the travel) */
  const need = kinds.map((k, i) => { const p = part(k); return q((i ? T.enterS : 0) + (p ? p.settleS : build[k]) + (k === 'end' ? 0 : T.holdS)); });
  let t0 = [], vo = null, endF = null, voSt = null;
  const cutAt = (i) => (i > 0 ? C.cut[`${kinds[i - 1]}>${kinds[i]}`] : null);
  if (hasVo) {
    const W = loadWords(C), st = voSteps(C, kinds.length - 1, fps); voSt = st;
    if (st.steps.length !== kinds.length - 1) throw new Error(`vo: ${st.steps.length} stage changes fit the speech gaps, ${kinds.length - 1} are needed (${kinds.slice(0, -1).join(', ')}): leave a pause of 0.25 s or more between the sentences, one sentence per stage`);
    vo = { words: W, audio: C.vo.audio ?? null };
    t0 = st.steps.map((r) => r.frame); t0.push(Math.round(W.at(-1).e * fps) + 2);   // the end card: the camera leaves for it once the last word is out
  } else {
    /* stage starts on the bed's beats; a film shorter than timing.minS (a table builder skips the head-to-head stage) gets its dwell lengthened, spread over the content stages, until it is long enough */
    const grow = kinds.filter((k) => !['claim', 'name', 'end'].includes(k)).length || 1, lastLead = cutAt(kinds.length - 1) ? 0 : Math.round(T.enterS * fps);
    const lay = (x) => { const t = []; let f = 0; need.forEach((n, i) => { t.push(f); f += Math.ceil((n + (['claim', 'name', 'end'].includes(kinds[i]) ? 0 : x / grow)) * fps / fpb - 1e-9) * fpb; }); return { t, f, seconds: Math.ceil((t.at(-1) + lastLead + Math.round(C.tail.holdS * fps)) / 3) * 3 / fps }; };
    let L0 = lay(0); for (let x = 0.25; L0.seconds < T.minS - 1e-6 && x < 30; x += 0.25) L0 = lay(x);
    t0 = L0.t; endF = L0.f;
  }
  const enter = Math.round(T.enterS * fps), stages = kinds.map((k, i) => { const cut = cutAt(i), lead = i && !cut ? enter : 0, at = t0[i] + lead, next = i + 1 < kinds.length ? t0[i + 1] : null, p = part(k);
    return { i, id: k, kind: k, t0: sec(t0[i]), at: sec(at), until: next == null ? null : sec(next), ...(cut ? { cut: true, why: cut } : {}), ...(p ? { part: { id: p.id, params: p.params } } : {}), ...(k === 'end' ? { hold: true } : {}) }; });
  const last = stages.at(-1), seconds = sec(Math.ceil(Math.round((last.at + C.tail.holdS) * fps) / 3) * 3); last.until = seconds;   // a whole number of tenths of a second at 30 fps (the render's frame count is then exact)
  /* panel data (the own-drawn panels read it; the parts read their params) */
  const num = (n) => ({ label: n.label, value: n.value, unit: n.unit ?? '', dec: n.dec, source: n.source, method: n.method });
  const data = { claim: { text: C.claim, words: cw.words, accent: cw.accent, accentAt: T.quietOpenS }, name: { intro: C.name.intro, brand: C.brand.name, promise: C.name.promise },
    setting: { title: C.setting.title, rows: C.setting.rows, numbers: C.setting.numbers.map(num) }, numbers: { items: C.numbers.items.map(num) }, cards: C.cards.map((n) => ({ ...num(n), line: n.line, alt: n.alt, altLabel: n.altLabel })),
    end: { brand: C.brand.name, url: C.brand.url, line: C.end.line, chips: C.end.chips || [] } };
  for (const s of stages) if (data[s.kind]) s.data = data[s.kind];
  /* the camera: one move per boundary (or a motivated hard cut); focus = the cell centre of each stage */
  const camera = { travelS: sec(travel), ease: T.ease, dip: T.dip, push: T.push, pitch: fm.pitch, legs: stages.slice(1).map((s) => ({ from: s.i - 1, to: s.i, t0: s.t0, dur: s.cut ? 0 : sec(travel) })) };
  /* ---- sound: a quiet UI tick per state change, one soft hit on the number reveal, nothing on the end card ---- */
  const X = C.sfx, cues = [], add = (id, t, why, k = 0) => { if (id) cues.push({ id: Array.isArray(id) ? id[k % id.length] : id, t: +t.toFixed(4), why }); };   // an array of ids rotates by k (the stage index), so a repeated move does not repeat one sound
  const claimSt = stages[0]; add(X.claim, claimSt.at + T.quietOpenS, 'accent word underlined: the sound enters on the first visual event');
  for (const s of stages.slice(1)) { if (s.cut) add(X.cut, s.t0, `hard cut: ${s.why}`); else add(X.travel, s.t0 + 0.05, `camera leaves for ${s.kind}`, s.i);
    if (s.part) for (const c of gfxCues(s.part.id, { at: s.at, params: s.part.params })) { if (c.t < s.until - 0.1) cues.push({ id: c.id, t: c.t, why: `${s.kind}: ${c.why}` }); }
    else if (s.kind === 'numbers') { add(X.numbers, s.at + 0.1, 'ONE soft hit on the number reveal'); add(X.count, s.at + 0.2, 'numbers count up'); }
    else if (s.kind === 'cards') C.cards.forEach((_, j) => add(X.card, s.at + 0.2 + 0.3 * j, `stat card ${j + 1}`));
    else if (s.kind !== 'end') add(X.arrive, s.at + 0.05, `${s.kind} lands`);
    else add(X.arrive, s.at + 0.05, 'end card lands (a tick, no stinger: the quiet hold follows)'); }
  { const tailF = Math.round(last.at * fps), holdT = (tailF + Math.round(C.tail.liftS * fps)) / fps;   // the room tone starts as the bed begins to fall and runs to the end: a flat floor under the hold (the bed's kick would otherwise read as a pulse, ears' 'decay')
    if (X.hold) cues.push({ id: X.hold, t: +holdT.toFixed(4), why: 'room tone under the quiet hold: a steady floor, no beat, no stinger', overBedDb: C.tail.roomDb }); }
  for (const c of cues) c.t = +(Math.floor(c.t * fps + 0.5 + 1e-9) / fps).toFixed(4);   // whole frames: the mixer places a cue on round(t * fps) and a cue at half a frame would round the two ways in node and python
  cues.sort((a, b) => a.t - b.t);
  /* under a voice the cue sits relative to the VOICE (the mixer's default is over the un-ducked bed, which is as loud as the bed was before it ducked) */
  if (hasVo) for (const c of cues) if (vo.words.some((w) => c.t >= w.s - 0.1 && c.t <= w.e + 0.15)) c.overVoDb = C.sfxUnderVoDb;
  /* bed automation: a planned quiet open, then the end card's lift and the quiet hold (frames, linear in dB) */
  const openF = hasVo ? 0 : Math.round(T.quietOpenS * fps), lift = Math.round(C.tail.liftS * fps), fade = Math.round(C.tail.fadeMs / 1000 * fps), tail0 = Math.round(last.at * fps);
  const bedAutomation = [...(openF ? [{ frame: 0, gain_db: -40 }, { frame: Math.max(1, openF - 12), gain_db: -40 }, { frame: openF + 18, gain_db: 0 }] : [{ frame: 0, gain_db: 0 }]), { frame: tail0 + lift, gain_db: 0 }, { frame: tail0 + lift + fade, gain_db: C.tail.bedDb }];
  const quiet = [...(openF ? [{ t: [0, sec(openF)], kind: 'open', why: 'the picture moves from frame 0; the sound enters on the first visual event (the accent word)' }] : []), { t: [sec(tail0 + lift + fade), seconds], kind: 'hold', why: 'end card on near-silence: no stinger, the URL holds' }];
  if (quiet.at(-1).t[1] - quiet.at(-1).t[0] < 3 - 1e-6 || quiet.at(-1).t[1] - quiet.at(-1).t[0] > 9 + 1e-6) warnings.push(`the near-silent end hold is ${(quiet.at(-1).t[1] - quiet.at(-1).t[0]).toFixed(1)} s: the studied proof films hold 3-9 s`);
  /* numbers for the gate record, the claims lint and the sheet */
  const fields = numberFields(C), claims = fields.map((n) => ({ text: `${n.label}: ${n.value}`, source: n.source, method: n.method }));
  const shots = stages.map((s) => ({ id: s.kind, start: s.t0, dur: +((s.until ?? seconds) - s.t0).toFixed(4), ...(s.hold ? { hold: true } : {}), move: s.cut ? 'cut' : s.i ? 'cam2d.pan2d' : 'cam2d.push2d' }));   // stages, not cuts: nothing cuts unless `cut` says so
  const events = [...new Set([...stages.slice(1).map((s) => s.t0), ...stages.map((s) => s.at), ...cues.map((c) => c.t)].map((t) => +t.toFixed(3)))].sort((a, b) => a - b);
  if (seconds < T.minS - 1e-6 || seconds > T.maxS + 1e-6) warnings.push(`the film runs ${seconds.toFixed(1)} s, outside the ${T.minS}-${T.maxS} s window of a proof film${hasVo ? ': the voice sets the length, so lengthen or shorten the words' : ''}`);
  if (hasVo) { for (const w of voSt.warnings || []) warnings.push('vo: ' + w);
    stages.slice(0, -1).forEach((s, i) => { const want = need[i] - (i ? T.enterS : 0) - T.holdS, got = s.until - s.at; if (got < want - 1e-6) warnings.push(`vo: the ${s.kind} stage gets ${got.toFixed(1)} s of speech, its build needs ${want.toFixed(1)} s: lengthen that sentence or the pause after it`); }); }
  const plan = { template: 'proof-film', fps, seconds, format: C.format, size: SIZES[PLATFORMS[fm.platform].aspect], W: fm.W, H: fm.H, platform: fm.platform, safe: PLATFORMS[fm.platform].safe, safeZone: fm.zone, illustrative: ill,
    brand: C.brand, claim: { text: C.claim, words: cw.words, accent: cw.accent }, stages, camera, bpm: grid.bpm, framesPerBeat: fpb, shots, cues,
    music: C.music, musicGainDb: C.musicGainDb, ceilingDb: C.ceilingDb, fadeInMs: C.fadeInMs, bedAutomation, ...(hasVo ? { vo: 'vo.wav', duckDb: C.duckDb, voice: vo } : {}),
    audio: { mode: hasVo ? 'vo' : 'continuous', quiet, events, role: 'proof' },
    honesty: { numbers: fields.map((n) => ({ path: n.path, label: n.label, value: n.value, source: n.source, method: n.method })), illustrative: ill, gate: 'passed' }, claims, warnings,
    paceRule: { aslMax: 8, longMax: 12 } };
  return plan;
}
