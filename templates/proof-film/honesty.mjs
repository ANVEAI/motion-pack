/* templates/proof-film/honesty.mjs: the HONESTY GATE of the proof film (pure: node + browser, no DOM, no clock).
   A proof film is a pile of numbers, so the template refuses to build one it cannot stand behind:
     1 every NUMBER FIELD needs a `source` AND a `method`          (a blank, whitespace-only, filler ("n/a", ".") or identical source / method counts as missing; a field inherits from its container)
     2 the claim is at most 6 words with exactly one *accent* word
     3 a number may only appear through a number field, never in prose (claim, brand name, URL, labels, cards, axis units, captions, diagram text) and never in the VOICE: a figure typed or
       spoken into a sentence has no source line, so the gate points at the field and asks for a number field instead. "A number" is a digit in ANY script (6, ６, ٦, ६, ², ½, ①), a
       currency sign, a percent sign, or a number word (two ... ninety, hundred, million, percent, twice, double, half, tenfold, zero; NOT "one", which is a pronoun as often as a count)
     4 three stat cards, one builder of a known kind (trace is landscape-only: refused on 9:16), a known format, a hard cut only with its Murch reason
   `numberFields(C)` lists every number the film prints (path, label, value, effective source and method, where each came from); `problems(C, { voWords })` is the list of messages
   (each names the field path); `assertHonest(C, ctx)` throws one HonestyError that carries them all. config.mjs `gateProblems` reads the VO transcript for it; make.mjs prints the
   messages and exits 2 before it builds anything; config.mjs buildPlan calls it too, so `node templates/_shared/cues.mjs templates/proof-film` fails the same way.
   Limits (stated, not hidden): the gate cannot tell a TRUE source from a made-up one (it refuses empty, filler and repeated text, not lies), a made-up brand, "one", ordinals and vague
   quantities ("a lot cheaper"), or what a recording says beyond the words.json you give it. Read the sheet and listen before you publish. */
export const MAX_CLAIM_WORDS = 6;
export const BUILDERS = ['scatter', 'trace', 'table'];
export const UNITS = ['', 'K', 'M', '%', '$', 's', 'ms', 'dur'];   // the formats type/gfx fmtUnit knows: a unit is a token the part formats, never typed prose
export const FORMATS = ['wide', 'tall'];
export const STAGES = ['claim', 'name', 'setting', 'builder', 'h2h', 'numbers', 'cards', 'end'];
export const CUT_REASONS = ['EMOTION', 'STORY', 'RHYTHM', 'ENERGY', 'REVEAL', 'PLACE', 'EYE_TRACE', 'SCREEN_PLANE', 'SPACE'];   // Murch's order (docs/research/edit.md) + story-script's txReason list
export class HonestyError extends Error { constructor(problems) { super('proof-film honesty gate: ' + problems.length + ' problem' + (problems.length === 1 ? '' : 's') + '\n  - ' + problems.join('\n  - ')); this.name = 'HonestyError'; this.problems = problems; } }

export const blank = (v) => typeof v !== 'string' || !v.trim();   // a source or method is a string: a blank, whitespace-only or non-string value (0, null, a number) counts as missing
/* the words of a claim with its accent marked *like this*: { words: ['Better', 'answers,', 'lower', 'cost.'], accent: [2], marks: 1 } (a *two word* accent is one mark and two accent words) */
const wordsOf = (s) => s.replace(/\*/g, '').trim().split(/\s+/).filter(Boolean);
export function claimWords(text) {
  const s = String(text ?? ''), accent = [], marks = [...s.matchAll(/\*([^*]+)\*/g)];
  for (const m of marks) { const before = wordsOf(s.slice(0, m.index)).length; for (let k = 0; k < wordsOf(m[1]).length; k++) accent.push(before + k); }
  return { words: wordsOf(s), accent, marks: marks.length };
}

/* ---------- what counts as "a number" in prose and in the voice ---------- */
const SYMBOL = /[\p{N}\p{Sc}%٪﹪％‰‱]/u;   // \p{N}: a digit in any script (0-9, ６０, ٦٠, ६०, ², ½, ①, Ⅷ); \p{Sc}: $ € £ ₹ ¥ ...; the percent signs (plain, Arabic, small, fullwidth) and per-mille
const DIGIT = /\p{N}/u;                    // a unit token ($, %, x) may stand in an axis prefix or suffix, a digit may not
const UNITS_1_9 = 'one|two|three|four|five|six|seven|eight|nine', TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const NUM_WORDS = new Set(('zero two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen ' + TENS.replace(/\|/g, ' ') +
  ' fourty hundred hundreds thousand thousands million millions billion billions trillion dozen dozens percent twice thrice double doubled doubles doubling triple tripled quadruple quadrupled half halved halves').split(' '));
const NUM_FUSED = new RegExp(`^(?:${TENS})(?:${UNITS_1_9})$`), NUM_FOLD = new RegExp(`^(?:two|three|four|five|six|seven|eight|nine|ten|${TENS}|hundred|thousand|million)fold$`);
/* the first number-like fragment of a text ('' when none): a symbol or digit, or a number word. `symbols: false` lets a currency or percent sign through (an axis unit) */
export function numberIn(str, { symbols = true } = {}) {
  const s = String(str ?? ''), m = (symbols ? SYMBOL : DIGIT).exec(s); if (m) return m[0];
  for (const w of s.toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (w && (NUM_WORDS.has(w) || NUM_FUSED.test(w) || NUM_FOLD.test(w))) return w;
  return '';
}

/* ---------- a source or a method has to say something ---------- */
const FILLER = /^(?:n\/?a|na|none|nil|null|undefined|nan|tbd|tba|todo|xx+|test(?:ing)?|asdf+|foo|bar|baz|lorem(?: ipsum)?|source|method|unknown|trust me|see above|same|ditto|[-.?!_*#/\\]+)$/i;
/* '' when `v` is plausible text, else why not. A source may be one name ("OECD", "run 4"); a method is a fragment ("mean of the runs"): at least two words and eight letters */
export function weak(kind, v) {
  const s = String(v ?? '').trim().replace(/\s+/g, ' '), letters = s.toLowerCase().match(/\p{L}/gu) || [], distinct = new Set(letters).size, words = s.split(' ').length;
  if (FILLER.test(s)) return `"${s}" is filler, not ${kind === 'source' ? 'a source' : 'a method'}`;
  if (kind === 'source' ? letters.length < 2 || distinct < 2 : letters.length < 8 || distinct < 4 || words < 2) return `"${s}" is too short to be ${kind === 'source' ? 'a source (name where the number comes from)' : 'a method (say how it was measured or computed, in a few words)'}`;
  return '';
}

/* a number field is { value, source, method } (+ label / unit / dec for display). `box` is the nearest container with a source / method of its own; srcAt / methAt say where the effective one was written */
const A = (v) => (Array.isArray(v) ? v : []);
const num = (path, label, value, own, box, ownKey, boxKey) => ({ path, label, value, source: own.source ?? box.source, method: own.method ?? box.method,
  srcAt: (own.source ?? null) !== null || !boxKey ? `${ownKey}.source` : `${boxKey}.source`, methAt: (own.method ?? null) !== null || !boxKey ? `${ownKey}.method` : `${boxKey}.method` });
export function numberFields(C) {
  const out = [], push = (...a) => out.push(num(...a)); const b = C.builder || {};
  A(C.setting?.numbers).forEach((n, i) => push(`setting.numbers[${i}]`, n.label, n.value, n, C.setting, `setting.numbers[${i}]`, 'setting'));
  if (b.kind === 'scatter') { const s = b.scatter || {};
    A(s.points).forEach((p, i) => { for (const a of ['x', 'y']) push(`builder.scatter.points[${i}].${a}`, `${p.label} ${a}`, p[a], p, s, `builder.scatter.points[${i}]`, 'builder.scatter'); });
    if (s.hero) for (const a of ['x', 'y']) push(`builder.scatter.hero.${a}`, `${s.hero.label} ${a}`, s.hero[a], s.hero, s, 'builder.scatter.hero', 'builder.scatter'); }
  const tab = (key, t) => A(t?.rows).forEach((r, i) => A(r.values).forEach((v, j) => push(`${key}.rows[${i}].values[${j}]`, `${r.label} (${t.columns?.[j + 1]?.label ?? 'column ' + (j + 1)})`, v, r, t, `${key}.rows[${i}]`, key)));
  if (b.kind === 'table') tab('builder.table', b.table); else tab('h2h', C.h2h);
  A(C.numbers?.items).forEach((n, i) => push(`numbers.items[${i}]`, n.label, n.value, n, C.numbers, `numbers.items[${i}]`, 'numbers'));
  A(C.cards).forEach((n, i) => { push(`cards[${i}]`, n.label, n.value, n, {}, `cards[${i}]`, ''); if (n.alt !== undefined) push(`cards[${i}].alt`, `${n.label} (alternative)`, n.alt, n, {}, `cards[${i}]`, ''); });
  return out;
}
/* every text the film prints or says that is NOT a number field: [path, value, mode, time (voice only)]. A number in one is a number with no source line (mode 'unit': a currency or percent sign is fine, a digit is not) */
export function proseFields(C, voWords = []) {
  const out = [], add = (path, v, mode = 'prose', t) => { if (v !== undefined && v !== null) out.push([path, v, mode, t]); }, b = C.builder || {}, B = C.brand || {};
  add('brand.name', B.name); if (B.urlHasNumber !== true) add('brand.url', B.url);   // a domain with a digit in it ("forms2go.example") is allowed only when brand.urlHasNumber is true: the line says it is a name, not a statistic
  add('claim', C.claim); add('name.intro', C.name?.intro); add('name.promise', C.name?.promise); add('end.line', C.end?.line); A(C.end?.chips).forEach((v, i) => add(`end.chips[${i}]`, v));
  add('setting.title', C.setting?.title); A(C.setting?.rows).forEach((r, i) => { add(`setting.rows[${i}].label`, r.label); add(`setting.rows[${i}].text`, r.text); }); A(C.setting?.numbers).forEach((n, i) => add(`setting.numbers[${i}].label`, n.label));
  add('numbers.title', C.numbers?.title); A(C.numbers?.items).forEach((n, i) => add(`numbers.items[${i}].label`, n.label));
  A(C.cards).forEach((n, i) => { add(`cards[${i}].label`, n.label); add(`cards[${i}].line`, n.line); add(`cards[${i}].altLabel`, n.altLabel); });
  const tab = (key, t) => { if (!t) return; add(`${key}.finding`, t.finding); add(`${key}.bars.title`, t.bars?.title); A(t.columns).forEach((c, i) => add(`${key}.columns[${i}].label`, c.label)); A(t.rows).forEach((r, i) => add(`${key}.rows[${i}].label`, r.label)); };
  tab('h2h', C.h2h); if (b.kind === 'table') tab('builder.table', b.table);
  if (b.kind === 'scatter') { const s = b.scatter || {}; add('builder.scatter.title', s.title); A(s.points).forEach((p, i) => add(`builder.scatter.points[${i}].label`, p.label));
    if (s.hero) { add('builder.scatter.hero.label', s.hero.label); const co = s.hero.callout; (Array.isArray(co) ? co : co === undefined ? [] : [co]).forEach((v, i) => add(`builder.scatter.hero.callout[${i}]`, v)); }
    for (const a of ['x', 'y']) { add(`builder.scatter.${a}.label`, s[a]?.label); add(`builder.scatter.${a}.prefix`, s[a]?.prefix, 'unit'); add(`builder.scatter.${a}.suffix`, s[a]?.suffix, 'unit'); } }
  if (b.kind === 'trace') { const t = b.trace || {}; A(t.input?.lines).forEach((v, i) => add(`builder.trace.input.lines[${i}]`, v)); add('builder.trace.input.title', t.input?.title); add('builder.trace.decision.title', t.decision?.title);
    A(t.decision?.forks).forEach((f, i) => add(`builder.trace.decision.forks[${i}]`, f.label)); A(t.lanes).forEach((ln, i) => { add(`builder.trace.lanes[${i}].label`, ln.label); A(ln.steps).forEach((st, k) => { add(`builder.trace.lanes[${i}].steps[${k}].label`, st.label); A(st.forks).forEach((f, m) => add(`builder.trace.lanes[${i}].steps[${k}].forks[${m}]`, f.label)); }); }); }
  A(voWords).forEach((w, i) => add(`vo.words[${i}]`, w?.w, 'voice', w?.s));
  return out;
}
/* is the film labelled illustrative? (the frame prints ILLUSTRATIVE on every number panel) */
const SRC_TAG = /illustrative|placeholder/i;
export const isIllustrative = (C) => C.illustrative === true || numberFields(C).some((n) => SRC_TAG.test(String(n.source ?? '')));

/* a list the config must give as a list (a string where a list belongs would otherwise be iterated letter by letter or crash) */
const LISTS = ['setting.rows', 'setting.numbers', 'numbers.items', 'cards', 'end.chips', 'h2h.rows', 'h2h.columns', 'builder.scatter.points', 'builder.scatter.hero.callout', 'builder.table.rows', 'builder.table.columns', 'builder.trace.input.lines', 'builder.trace.lanes', 'builder.trace.decision.forks'];
const at = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

function check(C, ctx) {
  const p = [], b = C.builder || {};
  if (!FORMATS.includes(C.format)) p.push(`format: "${C.format}" is not one of ${FORMATS.join(' | ')}`);
  if (!BUILDERS.includes(b.kind)) p.push(`builder.kind: "${b.kind}" is not one of ${BUILDERS.join(' | ')} (ONE builder)`);
  if (C.format === 'tall' && b.kind === 'trace') p.push('builder.kind: "trace" (ui.branchTrace) is a landscape diagram: on a 1080 x 1920 frame its type would be about 7 px, unreadable on a phone. Use "scatter" or "table" for format tall (or render the 16:9 master)');
  if (C.illustrative !== undefined && typeof C.illustrative !== 'boolean') p.push(`illustrative: must be true or false, got ${JSON.stringify(C.illustrative)}`);
  for (const path of LISTS) { const v = at(C, path); if (v !== undefined && !Array.isArray(v)) p.push(`${path}: must be a list, got ${typeof v}`); }
  for (const [k, why] of Object.entries(C.cut || {})) { const [a, b2] = k.split('>');
    if (!STAGES.includes(a) || !STAGES.includes(b2) || STAGES.indexOf(a) + 1 !== STAGES.indexOf(b2) && !(a === 'builder' && b2 === 'numbers')) p.push(`cut.${k}: not a boundary between neighbouring stages (${STAGES.join(' > ')}; h2h is skipped when the builder is a table)`);
    const m = /^([A-Z_]+)\s*:\s*(\S[\s\S]*)$/.exec(String(why ?? '').trim());
    if (!m || !CUT_REASONS.includes(m[1]) || weak('method', m[2])) p.push(`cut.${k}: a hard cut needs a reason "REASON: why" where REASON is one of ${CUT_REASONS.join(', ')} and why says it in a few words, e.g. "EMOTION: payoff -> pain"`); }
  const cw = claimWords(C.claim);
  if (!cw.words.length) p.push('claim: empty');
  if (cw.words.length > MAX_CLAIM_WORDS) p.push(`claim: ${cw.words.length} words, at most ${MAX_CLAIM_WORDS} ("${C.claim}")`);
  if (cw.accent.length === 0) p.push('claim: no accent word: mark exactly one word with *asterisks*');
  else if (cw.accent.length > 1 || cw.marks > 1) p.push(`claim: ${cw.accent.length} accent words, exactly one allowed ("${C.claim}")`);
  if (blank(C.brand?.name)) p.push('brand.name: empty'); if (blank(C.brand?.url)) p.push('brand.url: empty');
  if (!Array.isArray(C.cards) || C.cards.length !== 3) p.push(`cards: ${Array.isArray(C.cards) ? C.cards.length : 0} stat cards, exactly 3 (better / leaner / cheaper)`);
  const nums = A(C.numbers?.items); if (nums.length < 1 || nums.length > 3) p.push(`numbers.items: ${nums.length} big numbers, 1 to 3`);
  const weakAt = new Set();   // a filler source written once on a container is one problem, not thirty
  for (const n of numberFields(C)) {
    const where = `${n.path}${n.label ? ` ("${n.label}")` : ''}`, ws = blank(n.source) ? '' : weak('source', n.source), wm = blank(n.method) ? '' : weak('method', n.method);
    if (blank(n.source)) p.push(`${where}: no \`source\` (where does this number come from?)`);
    else if (ws && !weakAt.has(n.srcAt)) { weakAt.add(n.srcAt); p.push(`${n.srcAt}: ${ws} (it covers ${where})`); }
    if (blank(n.method)) p.push(`${where}: no \`method\` (how was it measured or computed?)`);
    else if (wm && !weakAt.has(n.methAt)) { weakAt.add(n.methAt); p.push(`${n.methAt}: ${wm} (it covers ${where})`); }
    if (!ws && !wm && !blank(n.source) && !blank(n.method) && n.source.trim().toLowerCase() === n.method.trim().toLowerCase() && !weakAt.has(n.methAt + '=')) { weakAt.add(n.methAt + '='); p.push(`${n.methAt}: the method repeats the source ("${n.method.trim()}"): a source says where, a method says how (it covers ${where})`); }
    if (typeof n.value !== 'number' || !Number.isFinite(n.value)) p.push(`${where}: \`value\` must be a finite number, got ${JSON.stringify(n.value)}`);
  }
  const unitOf = [...A(C.setting?.numbers).map((n, i) => [`setting.numbers[${i}]`, n]), ...A(C.numbers?.items).map((n, i) => [`numbers.items[${i}]`, n]), ...A(C.cards).map((n, i) => [`cards[${i}]`, n]),
    ...A(b.kind === 'table' ? b.table?.rows : C.h2h?.rows).map((r, i) => [`${b.kind === 'table' ? 'builder.table' : 'h2h'}.rows[${i}]`, r]), ...A(b.kind === 'table' ? b.table?.columns : C.h2h?.columns).map((c, i) => [`${b.kind === 'table' ? 'builder.table' : 'h2h'}.columns[${i}]`, c])];
  for (const [path, n] of unitOf) if (n.unit !== undefined && !UNITS.includes(n.unit)) p.push(`${path}.unit: "${n.unit}" is not one of ${UNITS.map((x) => JSON.stringify(x)).join(' ')}`);
  for (const [path, v, mode, t] of proseFields(C, ctx.voWords)) {
    if (typeof v !== 'string') { p.push(`${path}: must be text, got ${typeof v} ${JSON.stringify(v)} (a number belongs in a number field {value, source, method})`); continue; }
    const hit = numberIn(v, { symbols: mode !== 'unit' });
    if (hit) p.push(mode === 'voice' ? `${path} ("${v}"${t !== undefined ? ` at ${t} s` : ''}): the voice says a number ("${hit}") that has no source or method on screen: say it without the figure ("a lower cost") and put the number in a number field {value, source, method}`
      : `${path}: "${v}" has a number in prose ("${hit}"): put the number in a number field {value, source, method} so its source prints with it`);
  }
  if (C.illustrative === false) for (const n of numberFields(C)) if (SRC_TAG.test(String(n.source ?? ''))) { p.push(`${n.path}: illustrative is false but the source still says "${n.source}"`); break; }
  return [...new Set(p)];
}
/* ctx.voWords: the VO transcript [{w, s, e}] (config.mjs gateProblems reads it from vo.words) */
export function problems(C, ctx = {}) {
  try { return check(C, ctx); } catch (e) { return [`config: the CONFIG block has the wrong shape (${e.message}): every list must be a list and every block an object`]; }
}
export function assertHonest(C, ctx = {}) { const p = problems(C, ctx); if (p.length) throw new HonestyError(p); return true; }
