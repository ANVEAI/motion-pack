#!/usr/bin/env node
/* motion-pack / tools / playbook_plan.mjs: `mp plan <format>`: a plan.json skeleton that already carries the playbook's learnings.
     node tools/playbook_plan.mjs <format> [--style S] [--template T] [--length N] [--aspect A] [--platform P] [--brief brief.md] [--research research-pack.json] [--out plan.json] [--project-out project.json] [--playbook DIR]
     node tools/playbook_plan.mjs --defaults            the plan default ids (rule.enforce.default resolves against these; tools/playbook_build.py asks)
     node tools/playbook_plan.mjs --honesty plan.json   {claimsWithoutSource, banned} for mp lint (the same lint.proof as templates/_shared/plan.mjs, the same banned demo words as mp check)
   The plan is in the EXISTING plan shape (fps, seconds, aspect, W, H, shots, structure.sections, texts, claims, audio.quiet ...) that tools/structure_check.py, eyes and ears read, plus
     plan.playbook   the format, the rule ids applied, the plan defaults written in, the sound shape, the template's own length, the research pack and brief it came from
     plan.project    the same film as a project.json for the format's template (its PROJECT_MAP fields): `--project-out` writes it; `mp new <template> <dir> --project project.json` uses it
     plan.style      with --style <id> (playbook/styles/<id>.json): the style laid over the format. applyStyle() writes its palette, fonts and bed into plan.project and,
                     where the template's CONFIG has the block, its type presets (CONFIG.type roles), sounds (CONFIG.sfx roles), overlay stack (CONFIG.layers) and
                     transitions (each CONFIG.transitions boundary keeps its REASON; the style picks the id for that reason) as project overrides, plus the style's
                     own apply[template] paths. plan.style lists what was applied and what the template has no slot for.
   It never writes copy: every line a person or an agent must write is a TODO marker (mp lint FAILs while one is left). makePlan() and applyStyle() are pure functions of their inputs: no clock, no random. */
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL, fileURLToPath } from 'node:url';

const PACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(PACK, p)).href);
const PL = await imp('templates/_shared/plan.mjs'), P = await imp('templates/_shared/project.mjs');
const die = (msg, code = 2) => { console.error('mp plan: ' + msg); process.exit(code); };
const flag = (argv, k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const strip = (v) => Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('//')).map(([k, x]) => [k, strip(x)])) : v;

/* the plan defaults: what `mp plan` writes in, by id. A rule whose enforce.default names one of these lends it its params. */
export const DEFAULTS = {
  'plan.beats': 'shots and structure.sections from the format beats, scaled to --length (cumulative frame rounding, no drift)',
  'plan.audio.quiet_open': 'audio.quiet kind open over the first quiet_open_s, its depth (db) inside quiet_open_db under the body',
  'plan.audio.bass_entry': 'audio.bass_entry_s at bass_entry_pct of the runtime, snapped to a beat start inside the range when one is there',
  'plan.audio.name_silence': 'audio.quiet kind gap (role name) at the start of the name beat, name_silence_s long',
  'plan.audio.tail': 'audio.tail: quiet-hold = audio.quiet kind hold over the end beat; sting / slam / decay recorded for the mix',
  'plan.audio.first_hit': 'audio.first_hit_s: the first hit lands after the quiet open (first_hit_s)',
  'plan.audio.master': 'audio.master: the loudness target (lufs) and the true-peak ceiling (true_peak_max_dbtp)',
  'plan.type.limits': 'type: words per line, the reading speed, and every text slot carries its beat word limit (maxWords)',
  'plan.hook.text': 'a hook text slot from 0.12 s, inside hook_text_by_s, with the hook beat word limit',
  'plan.end.hold': 'the end beat is a hold (shots[].hold) of at least end_hold_s',
  'plan.claims': 'claims: a TODO claim with a TODO source (every digit on screen needs one)',
  'plan.audio.first_sound': 'cues: a placeholder sound on frame 0 when the format has no quiet open (first sound by frame 3)',
  'plan.audio.mixer': 'audio.mixer: the music/mixer.py settings the rules ask for (params and rule ids), applied when the template mixes',
  'plan.template': 'playbook.template.carries: the rules the format template already carries in its own defaults (type/ease.js, plan.mjs PLATFORMS, ctas.json, ...)',
};
const BASE = { quiet_open_db: [-11, -7], quiet_open_s: [1, 2], bass_entry_pct: [0.2, 0.35], name_silence_s: [1.0, 1.5], tail: 'quiet-hold', first_hit_s: [1, 2],
  lufs: -14, true_peak_max_dbtp: -1.5, max_words_per_line: 4, read_base_s: 0.35, read_per_word_s: 0.28, hook_text_by_s: 2, end_hold_s: [1.5, 6] };
const PLATFORM_BY_SHAPE = { wide: 'x.video', tall: 'reels.organic', square: 'linkedin.video' };
const PLATFORM_ALIAS = { x: 'x.video', twitter: 'x.video', shorts: 'shorts.organic', reels: 'reels.organic', instagram: 'reels.organic', tiktok: 'tiktok.organic', linkedin: 'linkedin.video', site: 'hero.web', web: 'hero.web' };
const mid = (r) => Array.isArray(r) ? +((r[0] + r[1]) / 2).toFixed(3) : r;
const r3 = (x) => +x.toFixed(3), r6 = (x) => +x.toFixed(6);   // r6: whole-frame times, as templates/_shared/plan.mjs sequence() writes them

export function ruleIds(fm) { const ids = [...(fm.rules || [])]; for (const b of fm.beats || []) ids.push(...(b.rules || [])); ids.push(...((fm.post || {}).rules || [])); return [...new Set(ids)]; }
/* params for one plan default: BASE <- every applied rule that names it <- the format's sound shape */
/* a *_pct range written in percent ([23, 52]) becomes fractions, as tools/playbook_lib.py norm_params does */
const normPct = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, /_pct$/.test(k) && Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && Math.max(...v) > 1 ? v.map((x) => x / 100) : v]));
export function paramsFor(id, fm, rules) {
  const p = { ...BASE }; for (const rid of ruleIds(fm)) { const r = rules[rid]; if (r && r.enforce && r.enforce.default === id) Object.assign(p, normPct(r.params)); }
  return Object.assign(p, normPct(fm.sound_shape));
}
export function platformFor(aspect, wanted) {
  const shape = P.ASPECT_SHAPE[aspect], want = wanted && (PL.PLATFORMS[wanted] ? wanted : PLATFORM_ALIAS[wanted]);
  if (want && PL.PLATFORMS[want] && PL.PLATFORMS[want].aspect === shape) return want;
  return PLATFORM_BY_SHAPE[shape] || null;
}
const todo = (beat, what) => `TODO(${beat}): ${String(what).replace(/\d+/g, (d) => nword(+d))}`;
/* no digit in a TODO marker: a digit in on-screen copy needs a sourced claim, and the template's honesty gate would refuse the unfilled project */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'], nword = (n) => WORDS[n] || 'a few';

/* makePlan(format, rules {id: rule}, { length, aspect, platform, brief, research, fps }, template { id, fields, lengths, built }) -> plan. PURE. */
export function makePlan(fm, rules, o, tpl) {
  const fps = o.fps || 30, L = +(o.length ?? mid(fm.length_s)), aspect = o.aspect || fm.lead_aspect, [W, H] = P.ASPECT_SIZES[aspect];
  if (!(L > 0)) throw new Error(`--length must be a positive number of seconds (got ${o.length})`);
  if (!(fm.aspects || []).includes(aspect)) throw new Error(`${fm.id} is made for ${fm.aspects.join(', ')} (got ${aspect})`);
  const platform = platformFor(aspect, o.platform), applied = [], used = (id) => { if (!applied.includes(id)) applied.push(id); return paramsFor(id, fm, rules); };
  /* beats -> shots on whole frames */
  used('plan.beats'); const beats = [...fm.beats].sort((a, b) => a.at[0] - b.at[0]), N = Math.round(L * fps);
  const edge = beats.map((b) => Math.round(b.at[0] * N)).concat([N]); edge[0] = 0;
  const shots = beats.map((b, i) => ({ id: b.id, sec: b.id, start: r6(edge[i] / fps), dur: r6((edge[i + 1] - edge[i]) / fps), purpose: b.purpose, ...(b.required === false ? { optional: true } : {}) }));
  const byEvent = (ev, re) => beats.findIndex((b) => ((b.sound || {}).events || []).includes(ev)) >= 0 ? beats.findIndex((b) => ((b.sound || {}).events || []).includes(ev)) : beats.findIndex((b) => re.test(b.id));
  const audio = { mode: 'music', quiet: [] }, hookI = beats.findIndex((b) => b.id === 'hook') >= 0 ? beats.findIndex((b) => b.id === 'hook') : 0;
  /* quiet open */
  const hookLevel = (beats[hookI].sound || {}).level;
  if ((fm.sound_shape && fm.sound_shape.quiet_open_db) || hookLevel === 'quiet' || ruleIds(fm).some((r) => rules[r] && rules[r].enforce && rules[r].enforce.default === 'plan.audio.quiet_open')) {
    const q = used('plan.audio.quiet_open'), len = Math.min(mid(q.quiet_open_s), shots[hookI].start + shots[hookI].dur || mid(q.quiet_open_s));
    audio.quiet.push({ t: [0, r3(len)], kind: 'open', db: mid(q.quiet_open_db), why: `playbook: open ${-q.quiet_open_db[1]}-${-q.quiet_open_db[0]} dB under the body for ${q.quiet_open_s[0]}-${q.quiet_open_s[1]} s over a moving frame 0` });
    const fh = used('plan.audio.first_hit'); audio.first_hit_s = r3(Math.max(len, fh.first_hit_s[0]));
  }
  /* bass entry: the middle of the range, or the beat start inside the range nearest it */
  const bi = byEvent('bass_entry', /^(turn|reveal|drop)$/);
  if ((fm.sound_shape && fm.sound_shape.bass_entry_pct) || bi >= 0) {
    const q = used('plan.audio.bass_entry'), [lo, hi] = q.bass_entry_pct; let t = mid(q.bass_entry_pct) * L;
    const inside = shots.filter((s) => s.start >= lo * L - 1e-6 && s.start <= hi * L + 1e-6); if (bi >= 0 && inside.includes(shots[bi])) t = shots[bi].start; else if (inside.length) t = inside.reduce((a, s) => Math.abs(s.start - t) < Math.abs(a.start - t) ? s : a).start;
    audio.bass_entry_s = r3(t);
  }
  /* silence under the name */
  const ni = byEvent('name_silence', /^(name|title|brand)$/);
  if (ni >= 0) { const q = used('plan.audio.name_silence'), a = shots[ni].start, d = Math.min(mid(q.name_silence_s), shots[ni].dur); audio.quiet.push({ t: [a, r3(a + d)], kind: 'gap', role: 'name', why: `playbook: ${q.name_silence_s[0]}-${q.name_silence_s[1]} s of silence under the name` }); }
  /* tail */
  { const q = used('plan.audio.tail'), last = shots.at(-1), t0 = String(q.tail).split('|')[0].trim(); audio.tail = t0;   // 'slam | decay': the first is the default
    if (t0 === 'quiet-hold' || t0 === 'decay') audio.quiet.push({ t: [last.start, r3(L)], kind: 'hold', why: `playbook: end card on a ${t0 === 'decay' ? 'decaying' : 'quiet'} hold` }); }
  { const q = used('plan.audio.master'); audio.master = { lufs: q.lufs, true_peak_dbtp: q.true_peak_max_dbtp }; }
  const named = (d) => ruleIds(fm).filter((r) => rules[r] && rules[r].enforce && rules[r].enforce.default === d);
  if (named('plan.audio.mixer').length) { used('plan.audio.mixer'); audio.mixer = { tool: 'music/mixer.py', rules: named('plan.audio.mixer'), params: Object.fromEntries(named('plan.audio.mixer').map((r) => [r, rules[r].params || {}])) }; }
  const carries = named('plan.template'); if (carries.length) used('plan.template');
  /* end hold */
  { const q = used('plan.end.hold'), last = shots.at(-1); last.hold = true; if (last.dur < q.end_hold_s[0]) last.why = `playbook: the end card holds at least ${q.end_hold_s[0]} s (this length gives ${last.dur} s)`; }
  /* text slots: one per beat with text; the hook slot from 0.12 s */
  const tp = used('plan.type.limits'), texts = [];
  beats.forEach((b, i) => { if (!b.text) return; const s = shots[i], hook = i === hookI, a = hook ? Math.min(0.12, s.dur / 2) : Math.min(0.1, s.dur / 4);
    if (hook) used('plan.hook.text');
    const mx = b.text.max_words ?? tp.max_words_per_line, fit = Math.max(0, Math.floor((s.dur - a - tp.read_base_s) / tp.read_per_word_s + 1e-9));   // words this slot can hold at the reading speed
    texts.push({ id: `${b.id}.text`, text: todo(b.id, `${b.purpose} (at most ${nword(Math.min(mx, fit))} words)`), t: [r3(s.start + a), r3(s.start + s.dur)], role: hook ? 'headline' : b.id === 'end' ? 'cta' : 'line', maxWords: Math.min(mx, fit),
      ...(fit < mx ? { why: `playbook: at ${L} s this slot reads ${fit} words, under the beat's ${mx} (${tp.read_base_s} s + ${tp.read_per_word_s} s a word)` } : {}), ...(b.text.field ? { field: b.text.field } : {}) }); });
  /* first sound by frame 3 when the format has no quiet open: a soft placeholder cue on frame 0, replaced by the hook's own sound (the template's cues win) */
  const cues = []; if (!audio.quiet.some((x) => x.kind === 'open')) { used('plan.audio.first_sound'); cues.push({ t: 0, id: 'sfx/whoosh/swish_xs', why: 'playbook: a sound on frames 0-3 (replace with the hook\'s own sound)' }); }
  used('plan.claims');
  const claims = [{ text: 'TODO(claims): one entry per claim the film makes; delete this entry when it makes none', source: 'TODO(claims): where it comes from (a document, a measurement, a URL)' }];
  /* the project.json for the template */
  const project = { version: 1, template: tpl.id, aspects: [aspect], ...(platform ? { platforms: [platform] } : {}), brand: {}, text: {}, claims: [] };
  for (const [k, dflt] of Object.entries(tpl.fields || {})) {
    const beat = beats.find((b) => b.text && b.text.field === k), line = beat ? texts.find((t) => t.id === `${beat.id}.text`).text : todo(k, `the ${k.split('.').pop()} line for ${tpl.id}`);
    const v = Array.isArray(dflt) ? dflt.map((_, j) => todo(k, `item ${nword(j + 1)}`)) : line;
    const [top, ...rest] = k.split('.'); if (top === 'brand' && rest.length === 1 && ['name', 'url', 'cta'].includes(rest[0])) project.brand[rest[0]] = rest[0] === 'cta' && beat ? line : todo(k, rest[0] === 'name' ? 'brand name' : rest[0]);
    else if (top === 'text' && rest.length === 1) project.text[rest[0]] = v; }
  /* the format's sound shape for the template (templates/_shared/playbook.mjs applies it to the template's own timeline): fractions travel, seconds of a 35 s plan would not fit a 45 s build */
  { const pbk = { format: fm.id, length: L }, sh = fm.sound_shape || {}, open = audio.quiet.find((x) => x.kind === 'open'), nm = audio.quiet.find((x) => x.role === 'name'), eh = paramsFor('plan.end.hold', fm, rules);
    pbk.quiet_open = open ? { s: r3(open.t[1] - open.t[0]), db: open.db } : false;   // no open in the format: sound from frame 0
    if (audio.bass_entry_s != null) { pbk.bass_entry_pct = r3(audio.bass_entry_s / L); if (bi >= 0) pbk.bass_entry_beat = beats[bi].id; }
    if (nm) pbk.name_silence = { s: r3(nm.t[1] - nm.t[0]), db: sh.name_silence_db ?? -50, ...(ni >= 0 ? { beat: beats[ni].id } : {}), at_pct: r3(nm.t[0] / L) };
    if (audio.tail) { pbk.tail = audio.tail; const td = sh.tail_db_max ?? sh.tail_db; if (td != null) pbk.tail_db = td; }
    pbk.end_hold_s = eh.min_hold_s ?? (Array.isArray(eh.end_hold_s) ? eh.end_hold_s[0] : eh.end_hold_s); pbk.first_sound_frame_max = 3;
    project.playbook = pbk; }
  const music = Object.values(fm.recommended_parts || {}).flat().find((id) => /^music\/bed_/.test(id)); if (music) project.music = music;
  if (tpl.lengths && tpl.lengths.length) project.length = tpl.lengths.reduce((a, x) => Math.abs(x - L) < Math.abs(a - L) ? x : a);
  const builtLen = project.length ?? tpl.built ?? null;
  const tplNote = builtLen == null ? 'the template length is not known' : Math.abs(builtLen - L) <= 1 ? `${tpl.id} builds ${builtLen} s: the same as the playbook timeline` : `${tpl.id} builds ${builtLen} s, not ${L} s (its lengths: ${tpl.lengths && tpl.lengths.length ? tpl.lengths.join(', ') : 'fixed'}): cut its timing to these beats, or plan at ${builtLen} s`;
  return {
    '//': `mp plan skeleton for the ${fm.id} format. Fill every TODO (story-script writes the words, frame-design the look), then: mp lint plan.json. plan.project is the same film for ${tpl.id}.`,
    template: tpl.id, fps, seconds: r3(N / fps), aspect, W, H, platform, safe: platform ? PL.PLATFORMS[platform].safe : null,
    length: L, shots, structure: { sections: shots.map((s) => ({ name: s.id, t: [s.start, r6(s.start + s.dur)] })) }, texts, cues, claims, audio,
    type: { max_words_per_line: tp.max_words_per_line, read_base_s: tp.read_base_s, read_per_word_s: tp.read_per_word_s, hook_text_by_s: tp.hook_text_by_s },
    playbook: { format: fm.id, title: fm.title, length: L, aspect, rules: ruleIds(fm), defaults: applied, sound_shape: fm.sound_shape || {}, hooks: fm.hooks || [], end_shapes: fm.end_shapes || [],
      post: fm.post || null, beats: beats.map((b) => ({ id: b.id, at: b.at, purpose: b.purpose, rules: b.rules || [] })), recommended_parts: fm.recommended_parts || {},
      template: { id: tpl.id, length_built: builtLen, note: tplNote, carries }, research: o.research || null, brief: o.brief || null },
    project,
  };
}

/* applyStyle(plan, style, tpl { id, keys (PROJECT_MAP keys), config (CONFIG) }) -> plan, with plan.style and the style in plan.project. PURE (the plan is changed in place). */
export function applyStyle(plan, st, tpl) {
  const pr = plan.project, keys = new Set(tpl.keys || []), C = tpl.config || {}, applied = [], missing = [], ov = {};
  const pal = st.palette || {}, ty = st.type || {}, snd = st.sound || {}, tr = (st.transitions || {}).by_reason || {};
  pr.brand = pr.brand || {};
  for (const [role, key] of [['accent', 'brand.accent'], ['ink', 'brand.ink'], ['paper', 'brand.paper'], ['muted', 'brand.muted']]) {
    if (!pal[role]) continue; if (keys.has(key)) { pr.brand[role] = pal[role]; applied.push(`${key} ${pal[role]}`); } else missing.push(`${key} (palette.${role})`); }
  /* a map may spell the project key brand.font or brand.fonts */
  if (['brand.font.display', 'brand.fonts.display', 'brand.font', 'brand.fonts'].some((k) => keys.has(k))) { pr.brand.fonts = { display: ty.display, text: ty.text }; applied.push(`brand.fonts ${ty.display} / ${ty.text}`); } else missing.push('brand.fonts (type.display)');
  if (snd.bed) { if (keys.has('music')) { pr.music = snd.bed; applied.push(`music ${snd.bed}`); } else missing.push(`music (sound.bed ${snd.bed})`); }
  /* the CONFIG blocks a style can fill: type roles, sfx roles, the overlay stack, the transitions by reason */
  if (C.type && typeof C.type === 'object') for (const [role, id] of Object.entries(ty.presets || {})) if (typeof C.type[role] === 'string') { ov[`type.${role}`] = id; applied.push(`type.${role} ${id}`); }
  if (C.sfx && typeof C.sfx === 'object') for (const [role, id] of Object.entries(snd.sfx || {})) if (role in C.sfx) { ov[`sfx.${role}`] = id; applied.push(`sfx.${role} ${id}`); }
  if (st.craft) { if (C.craft && typeof C.craft === 'object') { for (const [k, v] of Object.entries(st.craft)) { const val = v && typeof v === 'object' ? v.value : v; if (k in C.craft) { ov[`craft.${k}`] = val; applied.push(`craft.${k} ${JSON.stringify(val)}`); } else missing.push(`craft.${k} (no such craft in ${tpl.id})`); } }
    else missing.push(`craft (${tpl.id} has no CONFIG.craft: render a hero style with templates/style-scene, mp plan <format> --style ${st.id} --template style-scene)`); }
  if (st.world && typeof C.world === 'string') { ov.world = st.world; applied.push(`world ${st.world}`); }
  if (typeof C.textCase === 'string' && ty.case) { ov.textCase = ty.case === 'upper' ? 'upper' : 'as-written'; applied.push(`textCase ${ov.textCase}`); }
  if (Array.isArray(C.layers)) { ov.layers = structuredClone(st.layers || []); applied.push(`layers ${(st.layers || []).map((l) => l.kind).join(' + ') || 'none'}`); } else if ((st.layers || []).length) missing.push('layers (the template has no CONFIG.layers stack)');
  if (C.transitions && typeof C.transitions === 'object') for (const [k, v] of Object.entries(C.transitions)) {
    if (!Array.isArray(v) || typeof v[1] !== 'string') continue; const reason = v[1].split(':')[0].trim().toUpperCase();
    if (tr[reason]) { ov[`transitions.${k}`] = [tr[reason], v[1]]; applied.push(`transitions.${k} ${tr[reason]} (${reason})`); } else missing.push(`transitions.${k} (no ${reason} transition in the style)`); }
  else missing.push('transitions (the template has no CONFIG.transitions block)');
  for (const [k, v] of Object.entries((st.apply || {})[`templates/${tpl.id}`] || {})) { ov[k] = structuredClone(v); applied.push(`${k} ${JSON.stringify(v)} (style apply)`); }
  if (Object.keys(ov).length) { pr.overrides = pr.overrides || {}; pr.overrides[tpl.id] = { ...(pr.overrides[tpl.id] || {}), ...ov }; }
  if (pr.playbook) pr.playbook.style = st.id;
  plan.playbook.style = st.id;
  const keep = ['id', 'tier', 'world', 'craft', 'title', 'line', 'prompt', 'essence', 'not', 'palette', 'type', 'motion', 'transitions', 'layers', 'look', 'grain', 'sound', 'signature_features', 'change_tiers'];
  plan.style = { ...Object.fromEntries(keep.filter((k) => st[k] !== undefined).map((k) => [k, structuredClone(st[k])])), applied, not_applied: missing,
    note: 'the style says what the film looks and sounds like; the format still says what happens when. frame-design starts from plan.style; mp lint checks the signature features.' };
  return plan;
}

/* the template's facts mp plan needs: its text / brand fields (PROJECT_MAP) with the CONFIG defaults, and the lengths it really builds (probed, pure) */
export async function templateInfo(id, aspect) {
  const dir = path.join(PACK, 'templates', id); if (!fs.existsSync(path.join(dir, 'config.mjs'))) throw new Error(`no template ${id} (templates/${id}/config.mjs)`);
  const m = await import(pathToFileURL(path.join(dir, 'config.mjs')).href), map = m.PROJECT_MAP || {}, fields = {};
  for (const [k, e] of Object.entries(map)) if (/^(text|brand)\.[a-zA-Z0-9_]+$/.test(k)) { const to = P.normEntry(e).to[0]; fields[k] = to ? P.getPath(m.CONFIG, to) : null; }
  const lengths = [], build = (project) => { const r = P.applyProject(m.CONFIG, map, project, { template: id, aspect, ASPECTS: m.ASPECTS }); return m.buildPlan(r.config).seconds; };
  let built = null; try { built = build({}); } catch { /* a template that cannot build alone (needs media) */ }
  if ('length' in map) for (let c = 5; c <= 180; c += 5) { try { if (Math.abs(build({ length: c }) - c) <= 1) lengths.push(c); } catch { /* not a length it offers */ } }
  return { id, fields, lengths, built: built == null ? null : +(+built).toFixed(2), keys: Object.keys(map), config: structuredClone(m.CONFIG) };
}

const HON = await imp('templates/_explain/honesty.mjs'), HUM = await imp('templates/_shared/human/core.mjs');
/* the honesty gates the templates run, over a plan: lint.proof (claims), the banned demo words, the data-story dataset gate (source AND a different method; null when the plan
   has no datasets) and the founder-story verbatim quote gate (null when the plan has no quote, or no transcript to check it against) */
export function honesty(plan) {
  const copy = JSON.stringify([(plan.texts || []).map((t) => t.text), plan.claims || [], plan.project && plan.project.text, plan.project && plan.project.brand]).toLowerCase();
  const ds = plan.datasets && typeof plan.datasets === 'object' ? Object.entries(plan.datasets).flatMap(([id, d]) => HON.datasetProblems(id, d)) : null;
  const qt = plan.quote && plan.quote.text != null ? (Array.isArray(plan.transcript) && plan.transcript.length ? HUM.quoteCheck(plan.quote.text, plan.transcript) : { ok: false, why: 'a pull quote with no transcript to check it against' }) : null;
  return { claimsWithoutSource: PL.lintClaims(plan.claims || []).map((c) => c.text), banned: PL.BANNED_DEMO_WORDS.filter((w) => copy.includes(w)), datasets: ds, quote: qt };
}

async function main(argv) {
  if (argv.includes('--defaults')) return console.log(JSON.stringify(DEFAULTS, null, 1));
  if (argv.includes('--honesty')) { const f = flag(argv, '--honesty'); return console.log(JSON.stringify(honesty(JSON.parse(fs.readFileSync(f, 'utf8'))))); }
  const fid = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')); if (!fid) die('usage: mp plan <format> [--style S] [--template T] [--length N] [--aspect 16:9|9:16|1:1|4:5] [--platform P] [--brief brief.md] [--research research-pack.json] [--out plan.json] [--project-out project.json]  (formats: mp formats)');
  const pb = path.resolve(flag(argv, '--playbook') || process.env.MP_PLAYBOOK || path.join(PACK, 'playbook')), ff = path.join(pb, 'formats', fid + '.json');
  if (!fs.existsSync(ff)) { const have = fs.existsSync(path.join(pb, 'formats')) ? fs.readdirSync(path.join(pb, 'formats')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : []; die(`no format "${fid}" in ${path.relative(process.cwd(), pb) || pb}/formats (formats: ${have.join(', ') || 'none yet'})`); }
  const fm = strip(JSON.parse(fs.readFileSync(ff, 'utf8'))), rules = {};
  if (fs.existsSync(path.join(pb, 'rules'))) for (const f of fs.readdirSync(path.join(pb, 'rules')).filter((x) => x.endsWith('.json')).sort()) for (const r of [].concat(JSON.parse(fs.readFileSync(path.join(pb, 'rules', f), 'utf8')))) rules[r.id] = r;
  const missing = ruleIds(fm).filter((r) => !rules[r]); if (missing.length) console.error(`mp plan: warning: ${fid} names rules that are not in the playbook: ${missing.join(', ')} (python3 tools/playbook_build.py --check)`);
  const sid = flag(argv, '--style'); let st = null;
  if (sid) { const sf = path.join(pb, 'styles', sid + '.json'); if (!fs.existsSync(sf)) { const have = fs.existsSync(path.join(pb, 'styles')) ? fs.readdirSync(path.join(pb, 'styles')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : []; die(`no style "${sid}" (styles: ${have.join(', ') || 'none'}; mp styles)`); }
    st = strip(JSON.parse(fs.readFileSync(sf, 'utf8'))); if (st.formats && !st.formats.includes(fid)) console.error(`mp plan: warning: style ${sid} lists the formats ${st.formats.join(', ')}, not ${fid}: check the signature features still fit`); }
  const tid = flag(argv, '--template'); if (tid && !fs.existsSync(path.join(PACK, 'templates', tid, 'config.mjs'))) die(`no template ${tid} (templates/${tid}/config.mjs)`);
  const aspect = flag(argv, '--aspect', fm.lead_aspect), tpl = await templateInfo(tid || path.basename(fm.template), aspect);   // --template: the format's beats and rules on another template (a hero style on style-scene)
  let plan; try { plan = makePlan(fm, rules, { length: flag(argv, '--length') ?? undefined, aspect, platform: flag(argv, '--platform'), brief: flag(argv, '--brief'), research: flag(argv, '--research') }, tpl); } catch (e) { die(e.message); }
  if (st) applyStyle(plan, st, tpl);
  if (plan.length < fm.length_s[0] || plan.length > fm.length_s[1]) console.error(`mp plan: warning: ${plan.length} s is outside ${fid}'s ${fm.length_s[0]}-${fm.length_s[1]} s (mp lint will flag lint.pacing.length)`);
  const out = path.resolve(flag(argv, '--out', 'plan.json')); fs.writeFileSync(out, JSON.stringify(plan, null, 1) + '\n');
  const po = flag(argv, '--project-out'); if (po) fs.writeFileSync(path.resolve(po), JSON.stringify({ $schema: path.join(PACK, 'templates', '_shared', 'project.schema.json'), '//': `from mp plan ${fid}: fill every TODO, then mp new ${tpl.id} <dir> --project ${path.basename(po)}`, ...plan.project }, null, 2) + '\n');
  const todos = JSON.stringify(plan).match(/TODO\(/g) || [];
  console.log(`${path.relative(process.cwd(), out) || out}: ${fid}, ${plan.seconds} s at ${aspect} (${plan.W}x${plan.H}, ${plan.platform || 'no platform preset'}), ${plan.shots.length} beats, ${plan.playbook.rules.length} rules, ${plan.playbook.defaults.length} defaults written in, ${todos.length} TODO`);
  for (const s of plan.shots) console.log(`  ${s.start.toFixed(2).padStart(6)}-${(s.start + s.dur).toFixed(2).padEnd(6)} ${s.id.padEnd(10)} ${s.purpose}`);
  const A = plan.audio; console.log(`  sound: ${A.quiet.map((q) => `${q.kind}${q.role ? '/' + q.role : ''} ${q.t[0]}-${q.t[1]} s`).join(', ') || 'no planned quiet'}${A.bass_entry_s != null ? `, bass enters ${A.bass_entry_s} s` : ''}${A.first_hit_s != null ? `, first hit ${A.first_hit_s} s` : ''}, master ${A.master.lufs} LUFS / ${A.master.true_peak_dbtp} dBTP, tail ${A.tail}`);
  if (plan.style) console.log(`  style: ${plan.style.id} (${plan.style.title}): ${plan.style.applied.length} applied${plan.style.not_applied.length ? `; no slot in ${tpl.id} for: ${plan.style.not_applied.join(', ')}` : ''}`);
  console.log(`  template: ${plan.playbook.template.note}${po ? `; project file ${po}` : ''}\nnext: write the TODOs (story-script, frame-design), then mp lint ${path.basename(out)}`);
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) await main(process.argv.slice(2));
