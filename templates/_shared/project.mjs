/* motion-pack/templates/_shared/project.mjs: ONE project file drives any template.
     project.json (schema: _shared/project.schema.json) --validate--> PROJECT_MAP of the template (config.mjs) --apply--> CONFIG --> --set key=value on top --> buildPlan(C)
   Used by cues.mjs and every genre template's make.mjs (loadConfig), and by tools/mp.mjs (the `mp` CLI). Node only, no dependencies.

   PROJECT_MAP (exported by templates/<id>/config.mjs): { '<project path>': entry }. The project path is a field of the project file ('brand.name', 'text.headline',
   'media.screen', 'media.screen.src', 'voice.words', 'music', 'claims', 'length') or one of the two DERIVED fields: 'aspect' (the aspect being built: --aspect, --set aspect=,
   or the first of project.aspects) and 'platform' (the first preset in project.platforms whose shape matches that aspect). An entry is
     'cfg.path'                         copy the value there
     ['cfg.a', 'cfg.b']                 copy it to every path
     { to, values, fn, list, split, required, note }
       to        a path or a list of paths (CONFIG paths; numeric parts index arrays: 'broll.0.src')
       values    a lookup table for the value ({ '16:9': 'wide', '9:16': 'tall' }); a value not in it is an error that names the allowed ones
       fn        (value, ctx) => value, or => [one value per `to` path]; ctx = { project, template, aspect, defaults (the template's CONFIG), music(id) -> music/manifest.json item, seconds(file), warn(msg) }
       list      wrap a single string in a list;  split: split a string on spaces into a list
       required  the template cannot render without it: an error when the project does not give it AND the CONFIG default at `to` is null / ''
   The longest map key that is a prefix of a project field wins: 'media.hook.src' is used before 'media.hook'. A project field no key covers is IGNORED by this template
   (reported; a near miss of a mapped key, e.g. text.hedline, is an error with the suggestion, because it is almost certainly a typo).
   Optional exports next to it: ASPECTS = { '16:9': { how: 'native' | 'relayout' | 'manual', tag?, note? }, ... } (what `mp render --aspect all` builds; 'manual' = not built).

   Errors are clear and stop the build (exit 2): unknown key (with a suggestion), wrong type, a missing file, a missing required slot, a digit in on-screen copy with no sourced claim,
   a claim with a digit and a blank or generic source (the same rule as lint.proof), an aspect the template does not support. */
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL, fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
import { sourceOk } from './plan.mjs';

export const SH = path.dirname(fileURLToPath(import.meta.url)), PACK = path.resolve(SH, '..', '..');
export const SCHEMA_FILE = path.join(SH, 'project.schema.json');
export const ASPECT_SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
export const ASPECT_SHAPE = { '16:9': 'wide', '9:16': 'tall', '1:1': 'square', '4:5': 'portrait' };
export class ProjectError extends Error { constructor(problems, file) { super(`${file ? file + ': ' : ''}${problems.length} problem${problems.length === 1 ? '' : 's'}\n  - ${problems.join('\n  - ')}`); this.problems = problems; } }

/* ---------- small helpers ---------- */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const stripComments = (v) => Array.isArray(v) ? v.map(stripComments) : isObj(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('//')).map(([k, x]) => [k, stripComments(x)])) : v;
function lev(a, b) { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
export function suggest(word, candidates, max = 2) { let best = null, bd = Infinity; for (const c of candidates) { const d = lev(String(word).toLowerCase(), String(c).toLowerCase()); if (d < bd) { bd = d; best = c; } } const n = String(word).length; return bd <= (n <= 4 ? 1 : Math.max(max, Math.floor(n / 4))) ? best : null; }   // short words: one edit at most (3:2 is not 1:1)
const typeOf = (v) => v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
const typeOk = (v, t) => [].concat(t).some((x) => x === typeOf(v) || (x === 'number' && typeof v === 'number' && Number.isFinite(v)));
const show = (v) => { const s = JSON.stringify(v); return s && s.length > 60 ? s.slice(0, 57) + '...' : s; };

/* ---------- a JSON Schema subset validator (the keywords project.schema.json uses: type, properties, additionalProperties, patternProperties, propertyNames, required,
   enum, const, pattern, minLength, maxLength, minimum, maximum, minItems, maxItems, uniqueItems, items, anyOf, $ref to #/$defs) ---------- */
export function validate(schema, value, root = schema, at = '') {
  const out = [], where = at || '(top level)';
  if (schema.$ref) { const def = schema.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o[k], root); return validate({ ...def, ...Object.fromEntries(Object.entries(schema).filter(([k]) => k !== '$ref')) }, value, root, at); }
  if (schema.anyOf) { const errs = schema.anyOf.map((s) => validate(s, value, root, at)); if (errs.every((e) => e.length)) { const flat = errs.flat(); return [flat.find((e) => !/should be/.test(e)) || `${where}: ${show(value)} should be ${schema.anyOf.map((s) => [].concat(s.type || 'value').join('|')).join(' or ')}`]; } }
  if ('const' in schema && value !== schema.const) out.push(`${where}: must be ${show(schema.const)}, got ${show(value)}`);
  if (schema.enum && !schema.enum.includes(value)) { const s = typeof value === 'string' ? suggest(value, schema.enum) : null; out.push(`${where}: ${show(value)} is not allowed${s ? ` (did you mean ${show(s)}?)` : ''}; allowed: ${schema.enum.join(', ')}`); }
  if (schema.type && !typeOk(value, schema.type)) { out.push(`${where}: should be ${[].concat(schema.type).join(' or ')}, got ${typeOf(value)} ${show(value)}`); return out; }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) out.push(`${where}: is empty`);
    if (schema.maxLength != null && value.length > schema.maxLength) out.push(`${where}: is ${value.length} characters, at most ${schema.maxLength} (shorter copy reads on a phone)`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) out.push(`${where}: ${show(value)} does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') { if (schema.minimum != null && value < schema.minimum) out.push(`${where}: ${value} < ${schema.minimum}`); if (schema.maximum != null && value > schema.maximum) out.push(`${where}: ${value} > ${schema.maximum}`); }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) out.push(`${where}: needs at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}`);
    if (schema.maxItems != null && value.length > schema.maxItems) out.push(`${where}: at most ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) out.push(`${where}: has a repeated item`);
    if (schema.items) value.forEach((v, i) => out.push(...validate(schema.items, v, root, `${at}[${i}]`)));
  }
  if (isObj(value)) {
    const props = schema.properties || {}, pats = Object.entries(schema.patternProperties || {}).map(([p, s]) => [new RegExp(p), s]);
    for (const r of schema.required || []) if (!(r in value)) out.push(`${at ? at + '.' : ''}${r}: is required${at.startsWith('media.') ? ' (src: null renders a labelled placeholder)' : ''}`);
    for (const [k, v] of Object.entries(value)) {
      const p = at ? `${at}.${k}` : k;
      if (schema.propertyNames && schema.propertyNames.pattern && !new RegExp(schema.propertyNames.pattern).test(k)) { out.push(`${p}: the key "${k}" is not a valid name (letters, digits and _; start with a letter)`); continue; }
      if (props[k]) { out.push(...validate(props[k], v, root, p)); continue; }
      const pm = pats.find(([re]) => re.test(k)); if (pm) { out.push(...validate(pm[1], v, root, p)); continue; }
      if (schema.additionalProperties === false) { const s = suggest(k, Object.keys(props)); out.push(`${p}: unknown key${s ? ` (did you mean ${at ? at + '.' : ''}${s}?)` : ''}; known: ${Object.keys(props).join(', ')}`); continue; }
      if (isObj(schema.additionalProperties)) out.push(...validate(schema.additionalProperties, v, root, p));
    }
  }
  return out;
}

/* ---------- read + validate a project file ---------- */
export const readSchema = () => JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
export function parseProject(text, file = 'project.json') {
  let raw; try { raw = JSON.parse(text); } catch (e) { throw new ProjectError([`not valid JSON (${e.message}). Comments go in keys that start with //, e.g. "//": "note"`], file); }
  if (!isObj(raw)) throw new ProjectError(['the project file must be a JSON object { ... }'], file);
  const problems = validate(readSchema(), raw); if (problems.length) throw new ProjectError(problems, file);
  const p = stripComments(raw); delete p.$schema; return p;
}
export function loadProject(file) {
  const abs = path.resolve(file); if (!fs.existsSync(abs)) throw new ProjectError([`project file not found: ${abs}`]);
  const project = parseProject(fs.readFileSync(abs, 'utf8'), abs), dir = path.dirname(abs);
  const problems = [...honesty(project), ...resolveFiles(project, dir)]; if (problems.length) throw new ProjectError(problems, abs);
  return { project, file: abs, dir };
}
export const templatesOf = (p) => [].concat(p.template || []);

/* ---------- honesty: a digit in on-screen copy needs a sourced claim; a claim with a digit needs a real source (lint.proof's rule, plan.mjs sourceOk) ---------- */
export function honesty(p) {
  const out = [], claims = p.claims || [];
  claims.forEach((c, i) => { if (/\d/.test(c.text) && !sourceOk(c.source)) out.push(`claims[${i}]: "${c.text}" has a digit and ${c.source == null || !String(c.source).trim() ? 'no source' : `a source that says nothing ("${c.source}")`}: give the document, measurement or URL the number comes from, or take the number out`); });
  const copy = [...Object.entries(p.text || {}).map(([k, v]) => ['text.' + k, v]), ...['cta', 'line'].filter((k) => p.brand && p.brand[k] != null).map((k) => ['brand.' + k, p.brand[k]])];
  for (const [key, v] of copy) for (const line of [].concat(v)) {
    if (!/\d/.test(line)) continue;
    const backed = claims.some((c) => (c.key === key || c.text === line) && sourceOk(c.source));
    if (!backed) out.push(`${key}: "${line}" shows a digit on screen with no sourced claim: add {"text": ${JSON.stringify(line)}, "source": "<where the number comes from>", "key": "${key}"} to claims, or take the number out`);
  }
  return out;
}

/* ---------- files: every path is relative to the project file; it must exist (null = placeholder) ---------- */
function resolveFiles(p, dir) {
  const out = [], abs = (f) => path.isAbsolute(f) ? f : path.resolve(dir, f), chk = (key, f) => { if (f == null) return f; const a = abs(f); if (!fs.existsSync(a)) out.push(`${key}: file not found: ${a} (paths are relative to the project file; null = a labelled placeholder)`); return a; };
  if (p.brand && p.brand.logo != null) p.brand.logo = chk('brand.logo', p.brand.logo);
  for (const [k, s] of Object.entries(p.media || {})) if (s.src != null) s.src = chk(`media.${k}.src`, s.src);
  if (p.voice) { if (p.voice.words != null) p.voice.words = chk('voice.words', p.voice.words); if (p.voice.audio != null) p.voice.audio = chk('voice.audio', p.voice.audio); }
  return out;
}

/* ---------- voice: any words.json shape or an .srt -> one normalised {words: [{w, s, e}]} file (talking-head, proof-film and the new templates read the same thing) ---------- */
const srtTime = (t) => { const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t); if (!m) throw new Error('bad SRT time ' + t); return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0').slice(0, 3) / 1000; };
export function parseSrt(text) {
  const words = [];
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean), ti = lines.findIndex((l) => l.includes('-->')); if (ti < 0) continue;
    const [a, b] = lines[ti].split('-->').map(srtTime), ws = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean); if (!ws.length || !(b > a)) continue;
    const step = (b - a) / ws.length; ws.forEach((w, i) => words.push({ w, s: +(a + i * step).toFixed(3), e: +(a + (i + 1) * step).toFixed(3) }));
  }
  return words;
}
export function readWords(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.srt$/i.test(file)) return { words: parseSrt(text), approx: true };
  let j; try { j = JSON.parse(text); } catch (e) { throw new ProjectError([`voice.words: ${file} is not JSON or SRT (${e.message})`]); }
  const list = Array.isArray(j) ? j : j && j.words; if (!Array.isArray(list)) throw new ProjectError([`voice.words: ${file} is not [{w, s, e}] or {words: [...]}`]);
  const bad = list.findIndex((w, i) => !w || typeof w.w !== 'string' || !Number.isFinite(w.s) || !Number.isFinite(w.e) || w.e < w.s || (i && w.s < list[i - 1].s));
  if (bad >= 0) throw new ProjectError([`voice.words[${bad}]: ${show(list[bad])} is not {w: "text", s, e} in seconds, in order`]);
  return { words: list.map((w) => ({ w: w.w, s: w.s, e: w.e, ...(w.emph ? { emph: true } : {}) })), approx: false };
}

/* ---------- object paths ---------- */
const keyOf = (o, k) => (Array.isArray(o) && /^\d+$/.test(k) ? +k : k);
export function hasPath(o, p) { let x = o; for (const k of p.split('.')) { if (x == null || typeof x !== 'object' || !(keyOf(x, k) in x)) return false; x = x[keyOf(x, k)]; } return true; }
export function getPath(o, p) { let x = o; for (const k of p.split('.')) { if (x == null) return undefined; x = x[keyOf(x, k)]; } return x; }
/* set a CONFIG path. The parent must exist; the leaf must exist too unless create (a map entry that adds an optional field). Returns an error string or null. */
export function setPath(o, p, v, { create = false } = {}) {
  const ks = p.split('.'); let x = o;
  for (let i = 0; i < ks.length - 1; i++) { const k = keyOf(x, ks[i]); if (x[k] == null || typeof x[k] !== 'object') return `"${ks.slice(0, i + 1).join('.')}" is not an object in CONFIG`; x = x[k]; }
  const last = keyOf(x, ks.at(-1)); if (!(last in x) && !create) return `"${p}" is not a CONFIG field`; x[last] = v; return null;
}
export function configPaths(o, pre = '') { const out = []; if (isObj(o)) for (const [k, v] of Object.entries(o)) { const p = pre ? `${pre}.${k}` : k; out.push(p); if (isObj(v)) out.push(...configPaths(v, p)); } return out; }
/* project leaves: objects recurse (media slots to src/start/label), arrays and scalars are leaves */
export function leaves(o, pre = '') { const out = []; for (const [k, v] of Object.entries(o)) { const p = pre ? `${pre}.${k}` : k; if (isObj(v) && !['overrides'].includes(p)) out.push(...leaves(v, p)); else out.push([p, v]); } return out; }

/* ---------- the map ---------- */
export function normEntry(e) { if (typeof e === 'string' || Array.isArray(e)) e = { to: e }; return { ...e, to: [].concat(e.to || []) }; }
const normKey = (k) => k.replace(/^brand\.font(\.|$)/, 'brand.fonts$1');   // CONFIG says brand.font, the project file says brand.fonts: both spellings work in a map
const MANIFEST = () => { try { return JSON.parse(fs.readFileSync(path.join(PACK, 'music', 'manifest.json'), 'utf8')).items; } catch { return []; } };
const DERIVED = new Set(['aspect', 'platform']);
/* the duration of a media file in seconds (ffprobe), for a map fn that needs it (beat-edit's clip len) */
export function mediaSeconds(file) { try { return +(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim()).toFixed(3); } catch (e) { throw new Error(`cannot read the duration of ${file} (ffprobe: ${e.message.split('\n')[0]})`); } }
/* a project field that is one or two edits away from a mapped key in the same group (text.hedline vs text.headline; media.hok.src vs media.hook.src) */
export function nearMiss(p, keys) {
  const cand = keys.filter((k) => k.split('.')[0] === p.split('.')[0]);
  for (const k of cand) { const n = k.split('.').length, head = p.split('.').slice(0, n).join('.'); if (head !== k && lev(head, k) <= 2 && head.length > 3) return k + p.split('.').slice(n).map((x) => '.' + x).join(''); }
  return null;
}

/* the platform preset for an aspect: the first of project.platforms with that shape (plan.mjs PLATFORMS), else none */
export async function platformFor(project, aspect) {
  if (!aspect || !project.platforms) return null; const { PLATFORMS } = await import('./plan.mjs');
  return project.platforms.find((id) => PLATFORMS[id] && PLATFORMS[id].aspect === ASPECT_SHAPE[aspect]) || null;
}

/* applyProject(CONFIG, MAP, project, {template, aspect, platform, ASPECTS, voiceOut}) -> { config, applied, ignored, warnings }; throws ProjectError on any error */
export function applyProject(CONFIG, MAP = {}, project = {}, opts = {}) {
  const C = structuredClone(CONFIG), errors = [], warnings = [], applied = [], ignored = [], tpl = opts.template || 'template';
  const map = Object.fromEntries(Object.entries(MAP || {}).map(([k, e]) => [normKey(k), normEntry(e)]));
  const keys = Object.keys(map).sort((a, b) => b.length - a.length), find = (p) => keys.find((k) => p === k || p.startsWith(k + '.'));
  const ctx = { project, template: tpl, aspect: opts.aspect || null, defaults: CONFIG, seconds: mediaSeconds, music: (id) => MANIFEST().find((i) => i.id === 'music.' + String(id).replace(/^music\//, '')) || null, warn: (m) => warnings.push(m) };
  // which aspects the template can build
  if (opts.aspect) { const A = opts.ASPECTS; if (A && !A[opts.aspect]) errors.push(`aspect ${opts.aspect}: ${tpl} does not support it (supported: ${Object.keys(A).join(', ')})`);
    else if (A && A[opts.aspect].how === 'manual') errors.push(`aspect ${opts.aspect}: ${tpl} needs a MANUAL re-layout for it (${A[opts.aspect].note || 'no automatic layout'}); build ${Object.entries(A).filter(([, v]) => v.how !== 'manual').map(([k]) => k).join(' / ')} instead`); }
  const fields = [...(opts.aspect ? [['aspect', opts.aspect]] : []), ...(opts.platform ? [['platform', opts.platform]] : []),
    ...leaves(Object.fromEntries(Object.entries(project).filter(([k]) => !['template', 'version', 'overrides', 'aspects', 'platforms'].includes(k))))];
  if (project.voice && project.voice.words && opts.voiceOut) {   // normalise once: every template reads {words: [{w, s, e}]}
    const { words, approx } = readWords(project.voice.words); fs.mkdirSync(path.dirname(opts.voiceOut), { recursive: true });
    fs.writeFileSync(opts.voiceOut, JSON.stringify({ source: path.basename(project.voice.words) + (approx ? ' (SRT: word times spread evenly over each cue, approximate)' : ''), words }, null, 1));
    const i = fields.findIndex(([k]) => k === 'voice.words'); fields[i] = ['voice.words', opts.voiceOut]; if (approx) warnings.push('voice.words: SRT word times are approximate (spread evenly over each cue); use whisper word timings for tight cuts');
  }
  for (const [p, v0] of fields) {
    const k = find(p);
    if (!k) {
      if (DERIVED.has(p)) { if (!(p === 'aspect' && opts.ASPECTS && opts.ASPECTS[v0])) ignored.push(p); continue; }   // a 3D template takes the aspect as a render argument (ASPECTS), not a CONFIG field
      const near = nearMiss(p, keys); if (near) { errors.push(`${p}: ${tpl} has no such field (did you mean ${near}?)`); continue; }   // one or two letters off a mapped key: a typo, not another template's field
      ignored.push(p); continue; }
    const e = map[k], rest = p === k ? '' : p.slice(k.length + 1);
    let v = v0;
    if (e.split && typeof v === 'string') v = v.split(/\s+/).filter(Boolean);
    if (e.list && typeof v === 'string') v = [v];
    if (e.values) { if (!(v in e.values)) { errors.push(`${p}: ${show(v)} is not one ${tpl} accepts (allowed: ${Object.keys(e.values).join(', ')})`); continue; } v = e.values[v]; }
    if (e.fn) { try { v = e.fn(v, ctx); } catch (err) { errors.push(`${p}: ${err.message}`); continue; } }
    e.to.forEach((t, i) => {
      const target = rest ? `${t}.${rest}` : t, val = e.fn && Array.isArray(v) && e.to.length > 1 ? v[i] : v;
      if (val === undefined) return;
      const err = setPath(C, target, structuredClone(val), { create: !!e.create || !!rest && hasPath(C, t) && isObj(getPath(C, t)) });
      if (err) errors.push(`${p}: PROJECT_MAP of ${tpl} sends it to ${err} (a template bug: fix PROJECT_MAP['${k}'])`); else applied.push({ from: p, to: target, value: val });
    });
  }
  // required slots: the template cannot render without them
  for (const [k, e] of Object.entries(map)) if (e.required) {
    const given = fields.some(([p, v]) => (p === k || p.startsWith(k + '.')) && v != null), dflt = e.to.map((t) => getPath(C, t));
    if (fields.some(([p, v]) => (p === k || p === k + '.src') && v == null)) errors.push(`${k}: ${tpl} needs a real file here (required slot, no placeholder${e.note ? ': ' + e.note : ''})`);
    else if (!given && dflt.every((d) => d == null || d === '')) errors.push(`${k}: ${tpl} needs it (required slot${e.note ? ': ' + e.note : ''}); set it in the project file`);
  }
  // raw overrides for this template
  for (const [cp, v] of Object.entries((project.overrides || {})[tpl] || {})) { if (cp.startsWith('//')) continue; const err = setPath(C, cp, structuredClone(v));
    if (err) { const s = suggest(cp, configPaths(CONFIG)); errors.push(`overrides.${tpl}.${cp}: ${err}${s ? ` (did you mean ${s}?)` : ''}`); } else applied.push({ from: `overrides.${tpl}.${cp}`, to: cp, value: v }); }
  if (errors.length) throw new ProjectError(errors);
  return { config: C, applied, ignored, warnings };
}

/* ---------- --set key=value (CONFIG paths, as before; a project-only path like aspect goes through the map) ---------- */
export function coerce(v) {
  if (v === 'true') return true; if (v === 'false') return false; if (v === 'null') return null;
  if (/^[[{]/.test(v)) { try { return JSON.parse(v); } catch { /* a plain string */ } }
  return v !== '' && !isNaN(+v) ? +v : v;
}
export function applySets(C, sets, { MAP = {}, project = {}, template, ASPECTS } = {}) {
  const errors = [], applied = [];
  for (const s of sets) {
    const i = s.indexOf('='); if (i < 1) { errors.push(`--set ${s}: write --set key=value`); continue; }
    const k = s.slice(0, i), v = coerce(s.slice(i + 1));
    const parent = k.split('.').slice(0, -1).join('.'), inList = /\.\d+(\.|$)/.test(parent + '.') || Array.isArray(getPath(C, parent));   // an optional field of a list item (proof.0.source) may be added; anything else must exist
    if (hasPath(C, k) || (parent && hasPath(C, parent) && inList)) { setPath(C, k, v, { create: true }); applied.push({ from: '--set ' + k, to: k, value: v }); continue; }
    if (MAP && MAP[k]) { try { const r = applyProject(C, { [k]: MAP[k] }, k === 'aspect' ? {} : { [k]: v }, { template, aspect: k === 'aspect' ? v : null, ASPECTS }); Object.assign(C, r.config); applied.push(...r.applied); } catch (e) { errors.push(...e.problems); } continue; }
    const s2 = suggest(k, configPaths(C)); errors.push(`--set ${k}: not a CONFIG field of ${template || 'this template'}${s2 ? ` (did you mean ${s2}?)` : ''}`);
  }
  if (errors.length) throw new ProjectError(errors);
  return { config: C, applied };
}

/* ---------- command line: --project p.json, --aspect 9:16, --set k=v (repeatable), --strict (an ignored project field is an error) ---------- */
export function parseArgs(argv) {
  const o = { project: null, aspect: null, sets: [], strict: false };
  for (let i = 0; i < argv.length; i++) { const a = argv[i];
    if (a === '--project') o.project = argv[++i]; else if (a.startsWith('--project=')) o.project = a.slice(10);
    else if (a === '--aspect') o.aspect = argv[++i]; else if (a.startsWith('--aspect=')) o.aspect = a.slice(9);
    else if (a === '--set') o.sets.push(argv[++i]); else if (a === '--strict') o.strict = true; }
  if (!o.project && process.env.MP_PROJECT) o.project = process.env.MP_PROJECT;
  return o;
}

/* resolve(dir, args) -> { C, report }: CONFIG of templates/<dir> + project + --set. Pure apart from reading files and writing the normalised voice file. */
export async function resolve(dir, args = {}) {
  const mod = await import(pathToFileURL(path.join(dir, 'config.mjs')).href), template = path.basename(dir);
  let C = structuredClone(mod.CONFIG), report = { template, project: null, aspect: null, platform: null, applied: [], ignored: [], warnings: [] };
  let aspect = args.aspect || null;
  if (args.project) {
    const { project, file } = loadProject(args.project); report.project = file;
    const listed = templatesOf(project); if (listed.length && !listed.includes(template)) report.warnings.push(`the project lists template ${listed.join(', ')}, building ${template}`);
    aspect ??= args.sets.some((s) => s.startsWith('aspect=')) ? null : (project.aspects || [])[0] || null;
    const platform = await platformFor(project, aspect);
    const r = applyProject(C, mod.PROJECT_MAP, project, { template, aspect, platform, ASPECTS: mod.ASPECTS, voiceOut: path.join(dir, 'out', 'voice.words.json') });
    C = r.config; Object.assign(report, { aspect, platform, applied: r.applied, ignored: r.ignored, warnings: [...report.warnings, ...r.warnings] });
    if (args.strict && r.ignored.length) throw new ProjectError(r.ignored.map((p) => `${p}: ${template} does not use it (--strict)`));
  } else if (aspect) { const r = applyProject(C, mod.PROJECT_MAP, {}, { template, aspect, ASPECTS: mod.ASPECTS }); C = r.config; report.aspect = aspect; report.applied = r.applied; }
  if (args.sets.length) { const r = applySets(C, args.sets, { MAP: mod.PROJECT_MAP, template, ASPECTS: mod.ASPECTS }); C = r.config; report.applied.push(...r.applied); const a = args.sets.find((s) => s.startsWith('aspect=')); if (a) report.aspect = a.slice(7); }
  return { C, report, mod };
}

/* loadConfig(dir, argv) for cues.mjs / make.mjs: the resolved CONFIG, or the problems printed and exit 2. With nothing to apply it returns structuredClone(CONFIG), byte for byte the old path.
   When something was applied it writes out/config.resolved.json (a three.js scene.html reads it through ?config=) and out/project.report.json (what was applied and ignored). */
export async function loadConfig(dir, argv = process.argv.slice(2), { quiet = false, who = 'project' } = {}) {
  const args = parseArgs(argv);
  try {
    const { C, report } = await resolve(dir, args);
    if (args.project || args.sets.length || args.aspect) {
      fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'out', 'config.resolved.json'), JSON.stringify(C, null, 1));
      fs.writeFileSync(path.join(dir, 'out', 'project.report.json'), JSON.stringify(report, null, 1));
      // printed once per build, by cues.mjs (every make.mjs runs it): make.mjs resolves the same project silently
      if (!quiet && args.project && who === 'cues.mjs') console.error(`${who}: ${report.applied.length} field${report.applied.length === 1 ? '' : 's'} applied from ${path.basename(report.project)}${report.aspect ? ' at ' + report.aspect : ''}${report.ignored.length ? `; not used by ${report.template}: ${report.ignored.join(', ')}` : ''}${report.warnings.length ? '\n  warn: ' + report.warnings.join('\n  warn: ') : ''}`);
    }
    return C;
  } catch (e) {
    if (!(e instanceof ProjectError)) throw e;
    console.error(`\n${who}: ${e.message}\n\nFix the project file (schema: templates/_shared/project.schema.json; \`mp list\` shows each template's fields), then build again.`); process.exit(2);
  }
}
