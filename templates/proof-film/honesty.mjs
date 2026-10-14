/* templates/proof-film/honesty.mjs: the HONESTY GATE of the proof film (pure: node + browser, no DOM, no clock).
   A proof film is a pile of numbers, so the template refuses to build one it cannot stand behind:
     1 every NUMBER FIELD needs a `source` AND a `method`          (a blank or whitespace-only string counts as missing; a field inherits from its container)
     2 the claim is at most 6 words with exactly one *accent* word
     3 a digit may only appear through a number field, never in prose (claim, labels, cards, captions, diagram text): a number
       typed into a sentence has no source line, so the gate points at the field and asks for a number field instead
     4 three stat cards, one builder of a known kind, a known format
   `numberFields(C)` lists every number the film prints (path, label, value, effective source and method); `problems(C)` is the list of messages
   (each names the field path); `assertHonest(C)` throws one HonestyError that carries them all. make.mjs prints them and exits 2 before it builds
   anything; config.mjs buildPlan calls it too, so `node templates/_shared/cues.mjs templates/proof-film` fails the same way.
   Not detected (stated limit): numbers spelled out in words ("six systems") and a made-up brand: read the sheet before you publish. */
export const MAX_CLAIM_WORDS = 6;
export const BUILDERS = ['scatter', 'trace', 'table'];
export const UNITS = ['', 'K', 'M', '%', '$', 's', 'ms', 'dur'];   // the formats type/gfx fmtUnit knows: a unit is a token the part formats, never typed prose
export const FORMATS = ['wide', 'tall'];
export const STAGES = ['claim', 'name', 'setting', 'builder', 'h2h', 'numbers', 'cards', 'end'];
export class HonestyError extends Error { constructor(problems) { super('proof-film honesty gate: ' + problems.length + ' problem' + (problems.length === 1 ? '' : 's') + '\n  - ' + problems.join('\n  - ')); this.name = 'HonestyError'; this.problems = problems; } }

export const blank = (v) => typeof v !== 'string' || !v.trim();   // a source or method is a string: a blank, whitespace-only or non-string value (0, null, a number) counts as missing
/* the words of a claim with its accent marked *like this*: { words: ['Better', 'answers,', 'lower', 'cost.'], accent: [2], marks: 1 } (a *two word* accent is one mark and two accent words) */
const wordsOf = (s) => s.replace(/\*/g, '').trim().split(/\s+/).filter(Boolean);
export function claimWords(text) {
  const s = String(text ?? ''), accent = [], marks = [...s.matchAll(/\*([^*]+)\*/g)];
  for (const m of marks) { const before = wordsOf(s.slice(0, m.index)).length; for (let k = 0; k < wordsOf(m[1]).length; k++) accent.push(before + k); }
  return { words: wordsOf(s), accent, marks: marks.length };
}
const DIGIT = /[0-9%$€£₹]/;
const SRC_TAG = /illustrative|placeholder/i;

/* a number field is { value, source, method } (+ label / unit / dec for display). `box` is the nearest container with a source / method of its own. */
const num = (path, label, value, own, box) => ({ path, label, value, source: own.source ?? box.source, method: own.method ?? box.method, ownSource: own.source, ownMethod: own.method });
export function numberFields(C) {
  const out = [], push = (...a) => out.push(num(...a)); const b = C.builder || {};
  (C.setting?.numbers || []).forEach((n, i) => push(`setting.numbers[${i}]`, n.label, n.value, n, C.setting));
  if (b.kind === 'scatter') { const s = b.scatter || {};
    (s.points || []).forEach((p, i) => { push(`builder.scatter.points[${i}].x`, `${p.label} x`, p.x, p, s); push(`builder.scatter.points[${i}].y`, `${p.label} y`, p.y, p, s); });
    if (s.hero) { push('builder.scatter.hero.x', `${s.hero.label} x`, s.hero.x, s.hero, s); push('builder.scatter.hero.y', `${s.hero.label} y`, s.hero.y, s.hero, s); } }
  const tab = (key, t) => (t?.rows || []).forEach((r, i) => (r.values || []).forEach((v, j) => push(`${key}.rows[${i}].values[${j}]`, `${r.label} (${t.columns?.[j + 1]?.label ?? 'column ' + (j + 1)})`, v, r, t)));
  if (b.kind === 'table') tab('builder.table', b.table); else tab('h2h', C.h2h);
  (C.numbers?.items || []).forEach((n, i) => push(`numbers.items[${i}]`, n.label, n.value, n, C.numbers));
  (C.cards || []).forEach((n, i) => { push(`cards[${i}]`, n.label, n.value, n, {}); if (n.alt !== undefined) push(`cards[${i}].alt`, `${n.label} (alternative)`, n.alt, n, {}); });
  return out;
}
/* every prose field the film prints (a digit in one is a number with no source) */
export function proseFields(C) {
  const out = [], add = (path, v) => { if (typeof v === 'string') out.push([path, v]); }, b = C.builder || {};
  add('claim', C.claim); add('name.intro', C.name?.intro); add('name.promise', C.name?.promise); add('end.line', C.end?.line); (C.end?.chips || []).forEach((v, i) => add(`end.chips[${i}]`, v));
  add('setting.title', C.setting?.title); (C.setting?.rows || []).forEach((r, i) => { add(`setting.rows[${i}].label`, r.label); add(`setting.rows[${i}].text`, r.text); }); (C.setting?.numbers || []).forEach((n, i) => add(`setting.numbers[${i}].label`, n.label));
  add('numbers.title', C.numbers?.title); (C.numbers?.items || []).forEach((n, i) => add(`numbers.items[${i}].label`, n.label));
  (C.cards || []).forEach((n, i) => { add(`cards[${i}].label`, n.label); add(`cards[${i}].line`, n.line); add(`cards[${i}].altLabel`, n.altLabel); });
  const tab = (key, t) => { if (!t) return; add(`${key}.finding`, t.finding); (t.columns || []).forEach((c, i) => add(`${key}.columns[${i}].label`, c.label)); (t.rows || []).forEach((r, i) => add(`${key}.rows[${i}].label`, r.label)); };
  tab('h2h', C.h2h); if (b.kind === 'table') tab('builder.table', b.table);
  if (b.kind === 'scatter') { const s = b.scatter || {}; add('builder.scatter.title', s.title); (s.points || []).forEach((p, i) => add(`builder.scatter.points[${i}].label`, p.label)); if (s.hero) { add('builder.scatter.hero.label', s.hero.label); (s.hero.callout || []).forEach((v, i) => add(`builder.scatter.hero.callout[${i}]`, v)); }
    add('builder.scatter.x.label', s.x?.label); add('builder.scatter.y.label', s.y?.label); }
  if (b.kind === 'trace') { const t = b.trace || {}; (t.input?.lines || []).forEach((v, i) => add(`builder.trace.input.lines[${i}]`, v)); add('builder.trace.input.title', t.input?.title); add('builder.trace.decision.title', t.decision?.title);
    (t.decision?.forks || []).forEach((f, i) => add(`builder.trace.decision.forks[${i}]`, f.label)); (t.lanes || []).forEach((ln, i) => { add(`builder.trace.lanes[${i}].label`, ln.label); (ln.steps || []).forEach((st, k) => { add(`builder.trace.lanes[${i}].steps[${k}].label`, st.label); (st.forks || []).forEach((f, m) => add(`builder.trace.lanes[${i}].steps[${k}].forks[${m}]`, f.label)); }); }); }
  return out;
}
/* is the film labelled illustrative? (the frame prints ILLUSTRATIVE on every number panel) */
export const isIllustrative = (C) => C.illustrative === true || numberFields(C).some((n) => SRC_TAG.test(String(n.source ?? '')));

export function problems(C) {
  const p = [], b = C.builder || {};
  if (!FORMATS.includes(C.format)) p.push(`format: "${C.format}" is not one of ${FORMATS.join(' | ')}`);
  if (!BUILDERS.includes(b.kind)) p.push(`builder.kind: "${b.kind}" is not one of ${BUILDERS.join(' | ')} (ONE builder)`);
  for (const [k, why] of Object.entries(C.cut || {})) { const [a, b] = k.split('>'); if (!STAGES.includes(a) || !STAGES.includes(b) || STAGES.indexOf(a) + 1 !== STAGES.indexOf(b) && !(a === 'builder' && b === 'numbers')) p.push(`cut.${k}: not a boundary between neighbouring stages (${STAGES.join(' > ')}; h2h is skipped when the builder is a table)`);
    if (blank(why) || !/^[A-Z]{3,}\b/.test(String(why).trim())) p.push(`cut.${k}: a hard cut needs a reason that starts with its Murch reason in capitals (EMOTION, STORY, RHYTHM, ENERGY, REVEAL, PLACE...), e.g. "EMOTION: payoff -> pain"`); }
  const cw = claimWords(C.claim);
  if (!cw.words.length) p.push('claim: empty');
  if (cw.words.length > MAX_CLAIM_WORDS) p.push(`claim: ${cw.words.length} words, at most ${MAX_CLAIM_WORDS} ("${C.claim}")`);
  if (cw.accent.length === 0) p.push('claim: no accent word: mark exactly one word with *asterisks*');
  else if (cw.accent.length > 1 || cw.marks > 1) p.push(`claim: ${cw.accent.length} accent words, exactly one allowed ("${C.claim}")`);
  if (!Array.isArray(C.cards) || C.cards.length !== 3) p.push(`cards: ${Array.isArray(C.cards) ? C.cards.length : 0} stat cards, exactly 3 (better / leaner / cheaper)`);
  const nums = (C.numbers?.items || []); if (nums.length < 1 || nums.length > 3) p.push(`numbers.items: ${nums.length} big numbers, 1 to 3`);
  for (const n of numberFields(C)) {
    const where = `${n.path}${n.label ? ` ("${n.label}")` : ''}`;
    if (blank(n.source)) p.push(`${where}: no \`source\` (where does this number come from?)`);
    if (blank(n.method)) p.push(`${where}: no \`method\` (how was it measured or computed?)`);
    if (typeof n.value !== 'number' || !Number.isFinite(n.value)) p.push(`${where}: \`value\` must be a finite number, got ${JSON.stringify(n.value)}`);
  }
  const unitOf = [...(C.setting?.numbers || []).map((n, i) => [`setting.numbers[${i}]`, n]), ...(C.numbers?.items || []).map((n, i) => [`numbers.items[${i}]`, n]), ...(C.cards || []).map((n, i) => [`cards[${i}]`, n]),
    ...(b.kind === 'table' ? b.table?.rows || [] : C.h2h?.rows || []).map((r, i) => [`${b.kind === 'table' ? 'builder.table' : 'h2h'}.rows[${i}]`, r])];
  for (const [path, n] of unitOf) if (n.unit !== undefined && !UNITS.includes(n.unit)) p.push(`${path}.unit: "${n.unit}" is not one of ${UNITS.map((x) => JSON.stringify(x)).join(' ')}`);
  for (const [path, v] of proseFields(C)) if (DIGIT.test(v)) p.push(`${path}: "${v}" has a digit or currency mark in prose: put the number in a number field {value, source, method} so its source prints with it`);
  if (C.illustrative === false) for (const n of numberFields(C)) if (SRC_TAG.test(String(n.source ?? ''))) { p.push(`${n.path}: illustrative is false but the source still says "${n.source}"`); break; }
  return [...new Set(p)];
}
export function assertHonest(C) { const p = problems(C); if (p.length) throw new HonestyError(p); return true; }
