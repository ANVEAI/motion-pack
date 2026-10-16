/* lane explainer tests (node only: no browser, no GPU, no render). run: node templates/_explain/explain.test.mjs
   1 numfmt     Indian lakh / crore grouping and words, international K / M, eu / si separators, one scale per axis, non-finite input
   2 graph      the layered layout is deterministic (same input -> same bytes, in this process and in a fresh one), layers follow the edges, cycles do not hang,
                no two nodes overlap, long edges route through their own slots, the caps hold, the DSL reports what it cannot read
   3 honesty    data-story make.mjs EXITS 2 on a dataset without source / method, a non-zero bar baseline, an unlabelled truncated axis, footer: false, a missing column;
                buildPlan throws HonestyError; the parts draw the axis break + its label and the source footer on every visible frame; bars ignore a non-zero yMin
   4 plans      each template: pure, sections ordered and covering [0, T], hook text by 0.5 s, no motion gap over 3.5 s outside planned holds, every cue a real sound,
                every claim sourced, the committed out/plan.json and plan-tall.json are current, 9:16 is a re-layout (own boxes / direction), structure_check >= 70
   5 voice      explainer beats anchored to words land on the words; captions follow the voice; the plan carries the voice stem and mode 'vo'
   6 media      process-howto photo slots sit in the before / after windows and render a labelled PLACEHOLDER
   7 parts      every new gfx id is registered, has a limit entry (the fuzz test renders every registered id: tools/tests/fuzz-params.test.mjs) and is a pure function of t
                (any seek order gives the same markup) */
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { reporter } from '../../layers/tests/harness.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..'), R = reporter('explainer lane');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { fmtNumber, fmtAxis, groupDigits } = await imp('type/gfx/numfmt.js');
const { parseGraph, layoutGraph } = await imp('type/gfx/graph.js');
const { GFX, GFX_IDS, renderSVG } = await imp('type/gfx/index.js'), { GFX_LIM } = await imp('type/gfx/limits.js');
const { chartProblems, datasetProblems, HonestyError } = await imp('templates/_explain/honesty.mjs');
const { parseCSV } = await imp('templates/_explain/dataset.mjs');
const { lintClaims } = await imp('templates/_shared/plan.mjs');

/* ---------- 1 numfmt ---------- */
R.check('Indian grouping: 1234567 -> 12,34,567; 12345678.9 (1 dp) -> 1,23,45,678.9; international 1,234,567', fmtNumber(1234567, { locale: 'in' }) === '12,34,567' && fmtNumber(12345678.9, { locale: 'in', dec: 1 }) === '1,23,45,678.9' && fmtNumber(1234567) === '1,234,567' && groupDigits('123', 'in') === '123');
R.check('Indian words: 1.5 lakh, 2.5 Cr, 3 lakh crore; international 2.5M, 999,950 rounds up to 1.0M (not 1,000.0K)', fmtNumber(150000, { locale: 'in', compact: 'long', dec: 1 }) === '1.5 lakh' && fmtNumber(25000000, { locale: 'in', compact: 'short', dec: 1 }) === '2.5 Cr'
  && fmtNumber(3e12, { locale: 'in', compact: 'long' }) === '3 lakh crore' && fmtNumber(2500000, { compact: 'short', dec: 1 }) === '2.5M' && fmtNumber(999950, { compact: 'short', dec: 1 }) === '1.0M');
R.check('eu 1.234,5 with a true minus; si thin-space groups; % glued, other units after a thin space; NaN prints an en dash', fmtNumber(-1234.5, { locale: 'eu', dec: 1 }) === '−1.234,5' && fmtNumber(1234567, { locale: 'si' }) === '1 234 567'
  && fmtNumber(42, { unit: '%' }) === '42%' && fmtNumber(42, { unit: 'kg' }) === '42 kg' && fmtNumber(NaN) === '–' && fmtNumber(Infinity) === '–');
{ const t = [0, 20000, 40000, 60000, 80000, 100000, 120000, 140000], lab = t.map((v) => fmtAxis(v, { locale: 'in', ref: 140000, ticks: t }));
  R.check(`one scale per axis: an Indian axis to 1.4 lakh reads ${lab.slice(3, 6).join(', ')} (never 80K under 1 L), the baseline is a plain 0, all distinct`, lab[0] === '0' && lab.slice(1).every((l) => l.endsWith(' L')) && new Set(lab).size === lab.length); }

/* ---------- 2 graph ---------- */
const DSL = 'Ask -> Find -> Rank -> Answer\nFind -> Cache\nCache -> Rank : "hit"\nAsk -> Answer\nAnswer -> Ask\nnode Rank "Rank results" group=core kind=decision\ngroup core "Core"';
const g1 = parseGraph(DSL), L1 = layoutGraph(g1, { box: [100, 100, 1700, 800] }), L2 = layoutGraph(parseGraph(DSL), { box: [100, 100, 1700, 800] });
R.check('the DSL parses chains, labels, node attributes and groups (5 nodes, 7 edges, 1 group, no problems)', g1.nodes.length === 5 && g1.edges.length === 7 && g1.groups.length === 1 && !g1.problems.length && g1.nodes.find((n) => n.id === 'Rank').label === 'Rank results');
R.check('layout is deterministic: the same input gives the same JSON twice in one process', JSON.stringify(L1) === JSON.stringify(L2));
{ const code = `import('${pathToFileURL(path.join(ROOT, 'type/gfx/graph.js')).href}').then(({ parseGraph, layoutGraph }) => process.stdout.write(JSON.stringify(layoutGraph(parseGraph(${JSON.stringify(DSL)}), { box: [100, 100, 1700, 800] }))))`;
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' }); R.check('... and the same bytes in a fresh Node process', r.stdout === JSON.stringify(L1), r.stderr.slice(0, 200)); }
R.check('layers follow the edges (Ask 0, Find 1, Cache 2, Rank 3, Answer 4); the cycle Answer -> Ask is kept as a back edge', ['Ask', 'Find', 'Cache', 'Rank', 'Answer'].every((id, i) => L1.nodes[id].layer === i) && L1.edges.find((e) => e.id === 'Answer>Ask').back === true);
R.check('a long edge (Ask -> Answer, 4 layers) routes through its own slots (4 cubic segments) instead of crossing nodes', L1.edges.find((e) => e.id === 'Ask>Answer').segs.length === 4);
{ const big = { nodes: Array.from({ length: 60 }, (_, i) => ({ id: 'n' + i })), edges: Array.from({ length: 150 }, (_, i) => ({ from: 'n' + (i % 60), to: 'n' + ((i * 7 + 3) % 60) })) }, t0 = performance.now(), B = layoutGraph(big, { box: [0, 0, 1920, 1080], sweeps: 8 }), ms = performance.now() - t0;
  const ov = []; const N = Object.values(B.nodes); for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) { const a = N[i], b = N[j]; if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) ov.push(a.id + '/' + b.id); }
  R.check(`a 60-node, 150-edge graph with cycles lays out in ${ms.toFixed(0)} ms, no two nodes overlap, no NaN`, ms < 500 && !ov.length && !/NaN/.test(JSON.stringify(B)), ov.slice(0, 3).join(' ')); }
{ const huge = { nodes: Array.from({ length: 500 }, (_, i) => ({ id: 'n' + i })), edges: Array.from({ length: 2000 }, (_, i) => ({ from: 'n' + (i % 500), to: 'n' + ((i * 7 + 3) % 500) })) }, t0 = performance.now(), H = layoutGraph(huge, { box: [0, 0, 1920, 1080] });
  R.check(`the caps hold: 500 nodes / 2000 edges -> ${Object.keys(H.nodes).length} nodes laid out, the rest reported in dropped (${H.dropped.nodes} nodes), ${(performance.now() - t0).toFixed(0)} ms`, Object.keys(H.nodes).length === 200 && H.dropped.nodes === 300 && performance.now() - t0 < 1500); }
R.check('the DSL names what it cannot read and edges to missing nodes (never throws)', parseGraph('A -> \nwhat is this').problems.length === 2 && parseGraph({ nodes: [{ id: 'a' }], edges: [{ from: 'a', to: 'b' }] }).problems.length === 1);

/* ---------- 3 honesty ---------- */
const mk = (args) => spawnSync(process.execPath, [path.join(ROOT, 'templates/data-story/make.mjs'), ...args], { encoding: 'utf8', cwd: path.join(ROOT, 'templates/data-story') });
for (const [why, args, needle] of [
  ['a dataset with no source', ['--set', 'data.monthly.source='], 'no source'],
  ['a generic source ("internal data")', ['--set', 'data.branches.source=internal data'], 'says nothing'],
  ['a dataset with no method', ['--set', 'data.monthly.method='], 'no method'],
  ['a method that repeats the source', ['--set', 'data.branches.method=Fictional demo data (Orbit City is not a real place)'], 'says nothing new'],
  ['a bar chart with yMin 100000', ['--set', 'beats.5.chart.yMin=100000'], 'starts at zero'],
  ['a truncated line axis without a label', ['--set', 'beats.1.chart.yMin=90000'], 'not zero'],
  ['footer: false', ['--set', 'beats.1.chart.footer=false'], 'footer'],
  ['a column that is not in the file', ['--set', 'beats.1.chart.y=["this_year","nope"]'], 'nope']]) {
  const r = mk(args); R.check(`data-story make.mjs exits 2 on ${why}, naming it, before anything is built`, r.status === 2 && r.stderr.includes(needle), `status ${r.status}: ${(r.stderr || r.stdout).slice(-240)}`); }
{ const r = mk(['--set', 'beats.1.chart.yMin=90000', '--set', 'beats.1.chart.truncated=Axis starts at 90,000 books', '--set', 'aspect=bogus']);
  R.check('a truncated axis WITH its label passes the gate (the build then stops on the next problem, an unknown aspect, not on honesty)', r.status !== 0 && !/honesty gate/.test(r.stderr), r.stderr.slice(-200)); }
{ const { CONFIG, buildPlan } = await imp('templates/data-story/config.mjs'), C = structuredClone(CONFIG); C.data.monthly.source = ''; let err = null; try { buildPlan(C); } catch (e) { err = e; }
  R.check('buildPlan itself throws HonestyError (code 2) on an unsourced dataset, so no other path renders it', err instanceof HonestyError && err.code === 2 && /no source/.test(err.message)); }
R.check('chartProblems: area with yMin refused, line yMin 0 fine, scatter truncated with label fine, unit required', chartProblems('c', { kind: 'area', yMin: 5, unit: 'mm' }, {}).length === 1 && !chartProblems('c', { kind: 'line', yMin: 0, unit: 'mm' }, {}).length
  && !chartProblems('c', { kind: 'scatter', yMin: 3, truncated: 'Axis starts at 3', unit: 'kg' }, {}).length && chartProblems('c', { kind: 'bar' }, {}).some((p) => /no unit/.test(p)));
R.check('datasetProblems: a real-looking source + method passes', !datasetProblems('d', { source: 'Rainfall table, Demo Met Office yearbook 2024, p. 12', method: 'monthly totals of the daily gauge, rounded to 1 mm', problems: [] }).length);
{ const base = { kind: 'line', labels: ['a', 'b', 'c'], series: [{ name: 's', values: [95, 97, 99] }], unit: 'kg', source: 'Demo source table', method: 'demo method text' };
  const tr = renderSVG('chart.story', 3, { params: { ...base, yMin: 90 } }), lab = renderSVG('chart.story', 3, { params: { ...base, yMin: 90, truncated: 'Axis starts at 90 kg' } });
  R.check('a truncated line axis is ALWAYS labelled in frame by the part (default "Axis starts at 90, not zero"; your words when given) and draws an axis break', /not zero/.test(tr) && /Axis starts at 90 kg/.test(lab) && (tr.match(/stroke="#B3261E"/g) || []).length >= 2);
  const bar = renderSVG('chart.story', 3, { params: { ...base, kind: 'bar', yMin: 90 } }), bar0 = renderSVG('chart.story', 3, { params: { ...base, kind: 'bar' } });
  R.check('a bar chart ignores a non-zero yMin (the part draws the same zero-based bars; the gate refuses the config)', bar === bar0 && !/not zero/.test(bar)); }
for (const id of ['chart.story', 'map.hexTile', 'counter.hero']) { const g = GFX[id], end = (g.inF ?? 12) / 30 + g.dur + (g.outF ?? 9) / 30; let vis = 0, miss = [];
  for (let t = 0; t < end; t += 1 / 15) { const s = renderSVG(id, t, { params: { source: 'Demo table', method: 'a demo method' } }); if (!s) continue; vis++; if (!/Source: Demo table/.test(s) || !/DEMO DATA/.test(s)) miss.push(t.toFixed(2)); }
  R.check(`${id}: the source footer and the DEMO DATA pill are in every visible frame (${vis} frames from entrance to exit)`, vis > 10 && !miss.length, miss.slice(0, 4).join(' ')); }

/* ---------- 4 plans ---------- */
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), MUSIC = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'music/manifest.json'), 'utf8')).items.map((i) => i.id));
const soundOk = (id) => (/^sfx\//.test(id) ? SFX.has('snd.' + id.split('/').slice(1).join('.')) : /^music\//.test(id) ? MUSIC.has('music.' + id.slice(6)) : false);
for (const t of ['explainer-diagram', 'data-story', 'process-howto']) {
  const { CONFIG, buildPlan } = await imp(`templates/${t}/config.mjs`), wide = buildPlan(structuredClone(CONFIG)), again = buildPlan(structuredClone(CONFIG)), tall = buildPlan({ ...structuredClone(CONFIG), aspect: '9:16' });
  R.check(`${t}: buildPlan is pure (same JSON twice)`, JSON.stringify(wide) === JSON.stringify(again));
  for (const [P, tag] of [[wide, '16:9'], [tall, '9:16']]) {
    const S = P.structure.sections, T = P.seconds, ev = P.audio.events, holds = P.audio.quiet.filter((q) => q.kind === 'hold'), gaps = ev.map((e, i) => [e, (ev[i + 1] ?? T) - e]).filter(([e, g]) => g > 3.5 + 1e-6 && !holds.some((q) => e + g / 2 >= q.t[0] - 0.5 && e + g / 2 <= q.t[1] + 0.5));
    R.check(`${t} ${tag}: sections ordered and covering 0..${T} s, hook text by 0.5 s, no motion gap over 3.5 s outside a planned hold`, S[0].t[0] === 0 && Math.abs(S.at(-1).t[1] - T) < 1e-3 && S.every((x, i) => !i || Math.abs(x.t[0] - S[i - 1].t[1]) < 1e-3)
      && P.texts.some((x) => x.t[0] <= 0.5 && x.role === 'hook') && !gaps.length, gaps.map(([e, g]) => `${g.toFixed(1)} s from ${e}`).join(' '));
    R.check(`${t} ${tag}: every cue and the bed resolve, every claim is sourced (lint.proof), ${P.cues.length} cues`, P.cues.length > 5 && P.cues.every((c) => soundOk(c.id)) && soundOk(P.music) && !lintClaims(P.claims).length);
    const file = path.join(ROOT, 'templates', t, 'out', tag === '16:9' ? 'plan.json' : 'plan-tall.json'), committed = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    if (committed) delete committed.lint; R.check(`${t} ${tag}: the committed ${path.basename(file)} is current`, committed && JSON.stringify(committed) === JSON.stringify(P), committed ? `stale: node templates/_shared/cues.mjs templates/${t}${tag === '9:16' ? ' --set aspect=9:16 --name plan-tall' : ''}` : 'missing');
    const r = spawnSync('python3', [path.join(ROOT, 'tools/structure_check.py'), file, '--json'], { encoding: 'utf8' }); let sc = -1; try { sc = JSON.parse(r.stdout).score; } catch {}
    R.check(`${t} ${tag}: structure_check scores ${sc} (>= 70)`, sc >= 70, r.stderr.slice(0, 200)); }
  const boxes = (P) => JSON.stringify([...P.scene.gfx, ...P.scene.gfxTop].map((i) => i.params.box || i.params.dir || i.params.layout || i.params.pos || ''));
  R.check(`${t}: 9:16 is a re-layout (${tall.size.join('x')}, its own boxes / direction), not the 16:9 plan cropped`, tall.size[0] === 1080 && tall.size[1] === 1920 && boxes(tall) !== boxes(wide));
}

/* ---------- 5 voice ---------- */
{ const { CONFIG, buildPlan } = await imp('templates/explainer-diagram/config.mjs'), C = structuredClone(CONFIG); C.voice.words = 'words.example.json';
  const note = C.beats.find((b) => b.do === 'note' && b.node === 'door'); note.word = { word: 'door.', offset: 0 }; const flow = C.beats.find((b) => b.do === 'flow' && b.diagram === 'naive'); flow.word = 'drop';
  const P = buildPlan(C), it = P.scene.gfx.find((g) => g.id === 'diagram.graph' && g.params.notes.some((q) => q.node === 'door')), q = it && it.params.notes.find((x) => x.node === 'door'), f = it && it.params.flow[0];
  R.check('with voice.words, a beat anchored to a word lands on it (note on "door." at 5.62 s, flow on "drop" at 3.18 s, frame-quantised)', q && Math.abs(it.at + q.at - Math.round(5.62 * 30) / 30) < 1e-3 && Math.abs(it.at + f.at - Math.round(3.18 * 30) / 30) < 1e-3);
  R.check('with a voice: captions follow the words, no caption supers, a voice stem, mode vo, cues placed under the voice', P.scene.captions && P.scene.captions.chunks.length > 0 && !P.scene.gfxTop.some((x) => x.silent) && P.voice && P.vo === 'vo.wav' && P.audio.mode === 'vo' && P.cues.every((c) => c.overVoDb != null));
  let err = null; try { const C2 = structuredClone(CONFIG); C2.beats[3].word = 'door.'; C2.voice.words = null; buildPlan(C2); } catch (e) { err = e; }
  R.check('without a voice, beats use their t (a word anchor is ignored, the build does not need a transcript)', err === null); }

/* ---------- 6 media ---------- */
{ const { CONFIG, buildPlan } = await imp('templates/process-howto/config.mjs');
  for (const a of ['16:9', '9:16']) { const P = buildPlan({ ...structuredClone(CONFIG), aspect: a }), sl = P.scene.slots, ba = P.scene.gfx.find((g) => g.id === 'process.beforeAfter');
    R.check(`process-howto ${a}: the before / after photo slots are null, labelled PLACEHOLDER PHOTO, inside the frame, and live while the cards are up`, sl.length === 2 && sl.every((s) => s.src === null && /PLACEHOLDER/.test(s.phLabel[0]) && s.rect[0] >= 0 && s.rect[1] >= 0 && s.rect[0] + s.rect[2] <= P.size[0] && s.rect[1] + s.rect[3] <= P.size[1] && s.start >= ba.at && s.end <= ba.at + ba.dur + 0.3)); } }

/* ---------- 7 parts ---------- */
const NEW = ['diagram.graph', 'diagram.flow', 'layout.scrolly', 'title.takeaway', 'process.steps', 'process.beforeAfter', 'chart.story', 'callout.datum', 'map.hexTile', 'counter.hero', 'chart.sourceFooter'];
R.check(`all ${NEW.length} new parts are registered (the fuzz test renders every registered id) and each has a limit entry`, NEW.every((id) => GFX_IDS.includes(id) && GFX_LIM[id]));
for (const id of NEW) { const g = GFX[id], end = (g.inF ?? 12) / 30 + g.dur + (g.outF ?? 9) / 30, ts = Array.from({ length: 24 }, (_, i) => (i * end) / 23), fwd = ts.map((t) => renderSVG(id, t, {})), shuffled = [...ts.keys()].sort((a, b) => ((a * 7919) % 23) - ((b * 7919) % 23));
  const bad = shuffled.filter((i) => renderSVG(id, ts[i], {}) !== fwd[i]); R.check(`${id}: a pure function of t (24 times, shuffled order, same markup); no NaN / undefined`, !bad.length && !fwd.some((s) => /NaN|undefined/.test(s))); }
R.check('CSV parser: quotes, doubled quotes, CRLF, numeric columns, blanks as null', (() => { const d = parseCSV('a,b,c\r\n"x, y",1,\r\n"he said ""hi""",2.5,3\n'); return d.rows[0].a === 'x, y' && d.rows[1].a === 'he said "hi"' && d.rows[1].b === 2.5 && d.rows[0].c === null && d.rows[1].c === 3; })());
process.exit(R.done() && R.failed ? 1 : 0);
