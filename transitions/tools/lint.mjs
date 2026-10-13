#!/usr/bin/env node
/* motion-pack / transitions / tools / lint.mjs: registry/shader/DOM/demo/QA/sound-pairing consistency.
   usage: node tools/lint.mjs [--no-demos]   exit 1 on any error; warnings are printed but do not fail. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
import { REGISTRY } from '../lib/registry.js';
import { SHADERS, PRELUDE } from '../lib/tx-shaders.js';
import { DOM_KEYS } from '../lib/tx-dom.js';
import { EASES } from '../lib/tx-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), PACK = path.resolve(ROOT, '..');
const errs = [], warns = [], E = (k, m) => errs.push(`${k}: ${m}`), Wn = (k, m) => warns.push(`${k}: ${m}`);
const REASONS = ['LINK', 'ENERGY', 'CONTRAST', 'TIME', 'PLACE', 'BRIDGE_AUDIO', 'REVEAL', 'EMPHASIS', 'BEAT'];
const TYPES = ['float', 'vec2', 'vec4', 'color', 'bool', 'enum', 'text'], AT = ['cut', 'start', 'end', 'peak'];
const DERIVED = ['uPose0', 'uPose1', 'uPose2', 'uAnc', 'uWhich', 'uMeet', 'uAnchor'];
const noDemos = process.argv.includes('--no-demos');

// sound registry (other builder's module): collect snd.<cat>.<name> ids from sfx/**.py if present
const sndIds = new Set();
(function scan(d) { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
  if (fs.statSync(p).isDirectory()) { if (!f.startsWith('__')) scan(p); } else if (f.endsWith('.py')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/["'](snd\.[a-z_]+\.[a-z0-9_]+)["']/g)) sndIds.add(m[1]); } })(path.join(PACK, 'sfx'));

let pairs = 0, present = 0;
for (const [key, e] of Object.entries(REGISTRY)) {
  if (!/^(tx|cam)\.[a-zA-Z]+$/.test(e.id)) E(key, `bad id ${e.id}`);
  if (!e.name || !e.use || !e.avoid) E(key, 'name/use/avoid required');
  if (!Array.isArray(e.backends) || !e.backends.length) E(key, 'backends required');
  const t = e.timing || {};
  if (!(t.ms > 0 && t.beats > 0 && t.cut >= 0 && t.cut < 1)) E(key, 'timing needs ms>0, beats>0, 0<=cut<1');
  if (!EASES[t.ease]) E(key, `unknown ease ${t.ease}`);
  for (const [p, s] of Object.entries(e.params)) {
    if (!TYPES.includes(s.type)) E(key, `param ${p}: type ${s.type}`);
    if (!s.doc) E(key, `param ${p}: doc missing`);
    const d = s.default;
    if (s.type === 'color' && !/^#[0-9a-fA-F]{6}$/.test(d)) E(key, `param ${p}: colour default ${d}`);
    if (s.type === 'enum' && !(s.opts || []).includes(d)) E(key, `param ${p}: enum default not in opts`);
    if (s.type === 'vec2' && !(Array.isArray(d) && d.length === 2)) E(key, `param ${p}: vec2 default`);
    if (s.type === 'vec4' && !(Array.isArray(d) && d.length === 4)) E(key, `param ${p}: vec4 default`);
    if (s.type === 'float' && (typeof d !== 'number' || (s.min != null && d < s.min) || (s.max != null && d > s.max))) E(key, `param ${p}: float default out of range`);
    if (s.type === 'bool' && typeof d !== 'boolean') E(key, `param ${p}: bool default`);
  }
  if (!e.sfx || !e.sfx.length) E(key, 'at least one sound pairing required');
  for (const s of e.sfx || []) {
    if (!/^sfx\/[a-z]+\/[a-z0-9_]+$/.test(s.id)) E(key, `sfx id ${s.id} does not follow sfx/<category>/<name>`);
    if (!AT.includes(s.at) || typeof s.offset_f !== 'number' || typeof s.gain_db !== 'number') E(key, `sfx ${s.id}: at/offset_f/gain_db`);
    pairs++; const snd = 'snd.' + s.id.slice(4).replace('/', '.');
    if (sndIds.has(snd)) present++; else if (sndIds.size) Wn(key, `sound ${s.id} (${snd}) not in the sound registry yet${/pending/.test(s.note || '') ? ' (marked pending)' : ''}`);
  }
  if (!(e.reasons || []).length || e.reasons.some(r => !REASONS.includes(r))) E(key, `reasons ${e.reasons}`);
  if ((e.tags || []).length < 3) E(key, 'need >= 3 tags');
  // back-end consistency
  if (e.backends.includes('gl')) {
    const src = SHADERS[key]; if (!src) { E(key, 'gl back-end without shader'); continue; }
    for (const [p, s] of Object.entries(e.params)) if (s.type !== 'text' && !s.js && !new RegExp(`uniform\\s+\\w+\\s+u_${p}\\b`).test(src)) E(key, `shader lacks uniform u_${p}`);
    for (const m of src.matchAll(/uniform\s+\w+\s+(u_\w+)/g)) if (!(m[1].slice(2) in e.params)) E(key, `shader uniform ${m[1]} has no registry param`);
    for (const m of src.matchAll(/uniform\s+\w+\s+(u[A-Z]\w*)/g)) if (!DERIVED.includes(m[1])) E(key, `shader uniform ${m[1]} is not a known derived uniform`);
    if (/\b(iTime|uTime|time)\b/.test(src)) E(key, 'shader references a clock');
  } else if (SHADERS[key]) Wn(key, 'shader present but gl not listed in backends');
  if (e.backends.includes('dom') && !DOM_KEYS.includes(key)) E(key, 'dom back-end listed but missing in tx-dom.js');
  if (!e.backends.includes('dom') && DOM_KEYS.includes(key)) E(key, 'tx-dom.js implements it but backends lacks dom');
  if (!noDemos) {
    if (!fs.existsSync(path.join(ROOT, `renders/${key}.mp4`))) E(key, 'demo mp4 missing');
    const q = path.join(ROOT, `renders/qa/${key}.json`);
    if (!fs.existsSync(q)) E(key, 'QA json missing'); else if (!JSON.parse(fs.readFileSync(q, 'utf8')).pass) E(key, 'QA failed (see renders/qa)');
  }
}
if (/\bMath\.random\b|Date\.now|performance\.now/.test(fs.readdirSync(path.join(ROOT, 'lib')).map(f => fs.readFileSync(path.join(ROOT, 'lib', f), 'utf8')).join('\n'))) E('lib', 'clock or unseeded random in lib/');
if (/\bMath\.random\b/.test(PRELUDE)) E('prelude', 'random');
// determinism across runs
const H = path.join(ROOT, 'renders/hashes.json');
if (!noDemos && fs.existsSync(H)) { const h = JSON.parse(fs.readFileSync(H, 'utf8')); for (const k of Object.keys(REGISTRY)) if (!h[k]) E(k, 'no cross-launch hash'); for (const [k, v] of Object.entries(h)) if (!v.same) E(k, 'cross-launch stills differ (renders/hashes.json)'); }
else if (!noDemos) Wn('hashes', 'renders/hashes.json missing (run tools/hashes.sh)');
// README + catalog freshness
try { execFileSync('node', [path.join(ROOT, 'tools/build.mjs'), '--check'], { stdio: 'pipe' }); } catch (x) { E('build', String(x.stderr || x.message).trim()); }
for (const k of Object.keys(REGISTRY)) if (!fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').includes(`### \`${k}\``)) E(k, 'README entry missing');

console.log(`transitions: ${Object.keys(REGISTRY).length} | gl ${Object.keys(SHADERS).length} | dom ${DOM_KEYS.length} | sound pairs ${pairs} (${present} present in sfx registry of ${sndIds.size} ids)`);
for (const w of warns) console.log('WARN ' + w);
for (const e of errs) console.log('ERROR ' + e);
console.log(errs.length ? `FAIL: ${errs.length} error(s)` : `PASS (${warns.length} warning(s))`);
process.exit(errs.length ? 1 : 0);
