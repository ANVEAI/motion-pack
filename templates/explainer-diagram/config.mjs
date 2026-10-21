/* TEMPLATE explainer-diagram: a "how it works" film on one diagram canvas, 60-120 s, 16:9 master + a 9:16 re-layout (lane explainer, 2026-10-16).
   Shape (patterns/structures.json `explainer`, craft notes in README.md): QUESTION (the hook line on frame 0 over a diagram already drawing) -> WRONG MODEL (the picture most
   people carry, drawn, then shown to fail) -> REFRAME (the real mechanism built node by node, the camera moving region to region, notes pinned to nodes) -> PROOF (zoom INTO
   one node to open its sub-diagram, then trace one item through the whole system) -> SO WHAT (a recap card, then the takeaway on a held end card).
   One continuous canvas: no hard cuts; every change is a camera beat or a node landing (plan.audio.events), so the pace is read from motion, not shots.
   Diagrams are JSON or the graph DSL (type/gfx/graph.js); the layout is deterministic and layered (LR on 16:9, TB on 9:16: a re-layout, never a crop).
   OPTIONAL VOICE: voice.words = a words.json / .srt of your voice-over; then every beat with a `word` lands on that word, captions follow the voice, and the bed ducks under it
   (voice.audio = your recording; without it a labelled guide signal stands in). Without a voice the beats use their `t` and the on-screen captions carry the story.
   DEMO: a generic explainer of how post reaches another town overnight-style networks, told without a single number (no claims to source). Fictional brand "Orbit Explains". */
import { aspectOf, safeBox, fixSets, loadVoiceWords, beatTime, captionsOf, finish, r3, tagOf, HERE_OF } from '../_explain/core.mjs';
import { parseGraph } from '../../type/gfx/graph.js';
const HERE = HERE_OF(import.meta.url);
/* the layer count of a sub-diagram (each layer is one reveal event) */
const layerList = (g) => { const ids = g.nodes.map((n) => n.id), L = Object.fromEntries(ids.map((i) => [i, 0])); for (let k = 0; k < ids.length; k++) for (const e of g.edges) if (L[e.to] < L[e.from] + 1 && L[e.from] + 1 < ids.length) L[e.to] = L[e.from] + 1; return Object.values(L); };

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'Orbit Explains', accent: '#4A18ED', ink: '#16151B', paper: '#F5F2EA', logo: null, url: 'orbit.example', cta: 'More explainers at orbit.example', font: { display: 'Manrope', text: 'Manrope' } },
  platform: 'youtube', fps: 30, length: 'auto', aspect: '16:9', aspects: ['16:9', '9:16'],
  text: {
    hook: 'How does a letter cross a country?',
    recapTitle: 'Recap', recap: ['Collect it locally', 'Sort it once, at a hub', 'Deliver it locally'],
    takeawayKicker: 'THE TAKEAWAY', takeaway: 'A hub turns many long trips into a few short ones.',
  },
  media: {},   // no footage slots: the diagram is the picture (add a photo or clip slot in your copy if you need one; null renders a labelled placeholder)
  voice: { words: null, audio: null, placeholder: 'guide', chain: false },
  /* the diagrams: JSON { nodes, edges, groups } or the DSL text. Node kinds: io (pill), decision (hexagon), store (cylinder), default (box); icon = an explain-icons name */
  diagrams: {
    naive: { nodes: [{ id: 'you', label: 'Your letter', kind: 'io', icon: 'doc' }, { id: 'door', label: 'Their door', kind: 'io', icon: 'person' }], edges: [{ from: 'you', to: 'door' }] },
    mesh: 'Town A -> Town E\nTown A -> Town F\nTown A -> Town G\nTown A -> Town H\nTown B -> Town E\nTown B -> Town F\nTown B -> Town G\nTown B -> Town H\nTown C -> Town E\nTown C -> Town F\nTown C -> Town G\nTown C -> Town H\nTown D -> Town E\nTown D -> Town F\nTown D -> Town G\nTown D -> Town H',
    hub: { nodes: [{ id: 'tA', label: 'Town A', kind: 'io', group: 'collect' }, { id: 'tB', label: 'Town B', kind: 'io', group: 'collect' }, { id: 'tC', label: 'Town C', kind: 'io', group: 'collect' },
      { id: 'oL', label: 'Collection office', group: 'collect', icon: 'upload' }, { id: 'hub', label: 'Sorting hub', kind: 'decision' }, { id: 'oR', label: 'Delivery office', group: 'deliver', icon: 'download' },
      { id: 'tE', label: 'Town E', kind: 'io', group: 'deliver' }, { id: 'tF', label: 'Town F', kind: 'io', group: 'deliver' }, { id: 'tG', label: 'Town G', kind: 'io', group: 'deliver' }],
      edges: [{ from: 'tA', to: 'oL' }, { from: 'tB', to: 'oL' }, { from: 'tC', to: 'oL' }, { from: 'oL', to: 'hub' }, { from: 'hub', to: 'oR' }, { from: 'oR', to: 'tE' }, { from: 'oR', to: 'tF' }, { from: 'oR', to: 'tG' }],
      groups: [{ id: 'collect', label: 'COLLECT' }, { id: 'deliver', label: 'DELIVER' }] },
    inside: 'Read the address -> Group by region -> Load the truck\nRead the address -> Unclear? : "can\'t read it"\nUnclear? -> Checked by hand -> Group by region\nnode Unclear? "Unclear?" kind=decision',
  },
  /* the beats: t = seconds (no voice) or word = a voice word (with voice.words). sec = the section it belongs to (question, wrongmodel, reframe, proof, sowhat). */
  beats: [
    { t: 0, sec: 'question', do: 'show', diagram: 'naive', until: 10.6 },
    { t: 0, sec: 'question', do: 'hook', dur: 6.6 },
    { t: 3.0, sec: 'question', do: 'flow', diagram: 'naive', edges: 'all', until: 10.4 },
    { t: 5.2, sec: 'question', do: 'note', diagram: 'naive', node: 'door', text: 'the next day?', dur: 3.2 },
    { t: 7.4, sec: 'wrongmodel', do: 'caption', text: 'The picture most of us carry: one straight trip.', dur: 3.4 },
    { t: 10.6, sec: 'wrongmodel', do: 'show', diagram: 'mesh', until: 22.0, reveal: 0.25 },
    { t: 11.2, sec: 'wrongmodel', do: 'caption', text: 'But every town would need a road to every other town.', dur: 5.4 },
    { t: 14.6, sec: 'wrongmodel', do: 'focus', diagram: 'mesh', ids: ['Town_A'] },
    { t: 16.9, sec: 'wrongmodel', do: 'focus', diagram: 'mesh', ids: 'all' },
    { t: 17.0, sec: 'wrongmodel', do: 'caption', text: 'That is a lot of half-empty trucks.', dur: 4.6 },
    { t: 19.6, sec: 'wrongmodel', do: 'flow', diagram: 'mesh', edges: 'all', until: 22.0 },
    { t: 22.0, sec: 'reframe', do: 'show', diagram: 'hub', until: 62.4, steps: [[22.2, ['tA', 'tB', 'tC']], [24.8, ['oL']], [28.0, ['hub']], [31.4, ['oR']], [33.4, ['tE', 'tF', 'tG']]] },
    { t: 22.0, sec: 'reframe', do: 'cam', diagram: 'hub', ids: ['tA', 'tB', 'tC', 'oL'], dur: 0.05 },
    { t: 22.4, sec: 'reframe', do: 'caption', text: 'Instead, letters go to a collection office first.', dur: 5.0 },
    { t: 27.6, sec: 'reframe', do: 'cam', diagram: 'hub', ids: ['oL', 'hub', 'oR'], dur: 0.9 },
    { t: 27.8, sec: 'reframe', do: 'caption', text: 'Every office sends its bag to one sorting hub.', dur: 3.4 },
    { t: 31.0, sec: 'reframe', do: 'cam', diagram: 'hub', ids: ['oR', 'tE', 'tF', 'tG'], dur: 0.9 },
    { t: 31.4, sec: 'reframe', do: 'caption', text: 'From the hub, a few trucks drive out to delivery offices.', dur: 4.8 },
    { t: 36.4, sec: 'reframe', do: 'cam', diagram: 'hub', ids: 'all', dur: 1.0 },
    { t: 36.6, sec: 'reframe', do: 'caption', text: 'Many trips become a few full ones.', dur: 3.8 },
    { t: 38.6, sec: 'reframe', do: 'flow', diagram: 'hub', edges: 'all', until: 45.8 },
    { t: 40.6, sec: 'reframe', do: 'note', diagram: 'hub', node: 'hub', text: 'every letter passes here', dur: 3.6 },
    { t: 40.6, sec: 'reframe', do: 'caption', text: 'Each letter makes three short hops, not one long one.', dur: 5.2 },
    { t: 43.4, sec: 'reframe', do: 'focus', diagram: 'hub', ids: ['hub'] },
    { t: 46.0, sec: 'proof', do: 'focus', diagram: 'hub', ids: 'all' },
    { t: 46.0, sec: 'proof', do: 'zoom', diagram: 'hub', node: 'hub', into: 'inside', title: 'Inside the sorting hub', dur: 1.1, out: 56.6,
      notes: [{ t: 51.0, node: 'Unclear?', text: 'the rare case', dur: 2.6 }, { t: 53.8, node: 'Checked_by_hand', text: 'a person decides', dur: 2.6 }] },
    { t: 47.6, sec: 'proof', do: 'caption', text: 'Inside the hub: read, group, load.', dur: 4.4 },
    { t: 52.2, sec: 'proof', do: 'caption', text: 'Hard-to-read addresses go to a person.', dur: 4.2 },
    { t: 57.9, sec: 'proof', do: 'focus', diagram: 'hub', ids: ['tA', 'oL', 'hub', 'oR', 'tF'] },
    { t: 58.0, sec: 'proof', do: 'flow', diagram: 'hub', edges: ['tA>oL', 'oL>hub', 'hub>oR', 'oR>tF'], until: 62.4 },
    { t: 58.0, sec: 'proof', do: 'caption', text: 'Follow one letter from Town A to Town F.', dur: 4.2 },
    { t: 60.2, sec: 'proof', do: 'note', diagram: 'hub', node: 'tF', text: 'delivered', dur: 2.0 },
    { t: 63.0, sec: 'sowhat', do: 'recap', dur: 6.4, stagger: 1.4 },
    { t: 69.4, sec: 'sowhat', do: 'takeaway', dur: 7.4 },
  ],
  claims: [],   // the demo shows no numbers; any on-screen digit that states a fact needs { text, source }
  captions: { style: { '16:9': 'minimal', '9:16': 'karaoke' } },
  music: 'music/bed_documentary_marimba_loop8', musicGainDb: 0, duckDb: 12, ceilingDb: -2.0,
  layers: [{ kind: 'grain', params: { stock: 'upload-safe' } }],
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta', 'brand.font': 'brand.font',
  'text.headline': 'text.hook', 'text.hook': 'text.hook', 'text.takeaway': 'text.takeaway', 'text.recap': 'text.recap', 'voice.words': 'voice.words', 'voice.audio': 'voice.audio', music: 'music', claims: 'claims', aspects: 'aspects' };
export const ASPECTS = { '16:9': { how: 'native' }, '9:16': { how: 'relayout', tag: 'tall' } };

/* per-aspect constants (a re-layout: the diagram turns from left-to-right into top-to-bottom, captions move to the top band on 9:16) */
const LAYOUT = {
  '16:9': { dir: 'LR', diagram: [0.07, 0.25, 0.86, 0.56], camMax: 1.8, hookPos: 'tc', capPos: 'bc', capSize: 0.62, hookSize: 0.9, nodeSize: 1, recapPos: 'c', takeawaySize: 1 },
  '9:16': { dir: 'TB', diagram: [0.05, 0.255, 0.9, 0.39], camMax: 1.35, hookPos: 'tc', capPos: 'tc', capSize: 0.72, hookSize: 0.82, nodeSize: 0.62, recapPos: 'c', takeawaySize: 0.62 },
};
export function buildPlan(C0) {
  const C = fixSets(C0), A = aspectOf(C), L = LAYOUT[C.aspect] || LAYOUT['16:9'], fps = C.fps, tag = tagOf(C.aspect, '16:9'), sb = safeBox(C.aspect), warnings = [];
  const words = loadVoiceWords(HERE, C), vo = words.length > 0, at = (b) => beatTime(b, words, fps);
  const beats = C.beats.map((b, i) => ({ ...b, i, at: at(b) })).sort((a, b) => a.at - b.at || a.i - b.i);
  const lastWord = vo ? words.at(-1).oe : 0, endBeat = beats.reduce((m, b) => Math.max(m, b.at + (b.dur || 0)), 0), T = +(typeof C.length === 'number' ? C.length : Math.max(endBeat, lastWord + 1.5)).toFixed(4);
  const spec = (k) => { const s = C.diagrams[k]; if (s == null) throw new Error(`beat uses diagram "${k}", which CONFIG.diagrams does not define`); const g = typeof s === 'string' ? parseGraph(s) : s; return g; };
  for (const [k, s] of Object.entries(C.diagrams)) { const g = typeof s === 'string' ? parseGraph(s) : parseGraph(s); if (g.problems.length) throw new Error(`diagram ${k}: ${g.problems.join('; ')}`); }
  /* one diagram.graph item per `show` beat; the other beats edit it (times local to its start) */
  const items = [], top = [], texts = [], events = [], shows = {};
  for (const b of beats.filter((x) => x.do === 'show')) { const until = b.until != null ? at({ t: b.until, word: b.untilWord }) : T, it = { id: 'diagram.graph', at: b.at, dur: r3(until - b.at), params: { spec: spec(b.diagram), dir: L.dir, box: L.diagram, accent: C.brand.accent, ink: C.brand.ink, paper: '#FFFFFF', size: L.nodeSize, reveal: b.reveal ?? 0.3, steps: (b.steps || []).map(([t, ids]) => ({ at: r3(at({ t }) - b.at), show: ids })), focus: [], flow: [], cam: [], notes: [], zoom: null } };
    shows[b.diagram] = it; items.push(it); events.push(b.at); }
  const loc = (b) => { const it = shows[b.diagram]; if (!it) throw new Error(`beat ${b.i} (${b.do}) edits diagram "${b.diagram}" before it is shown`); return [it, r3(b.at - it.at)]; };
  for (const b of beats) {
    if (b.do === 'focus') { const [it, u] = loc(b); it.params.focus.push({ at: u, ids: b.ids }); events.push(b.at); }
    else if (b.do === 'flow') { const [it, u] = loc(b); it.params.flow.push({ at: u, edges: b.edges, until: b.until != null ? r3(b.until - it.at) : null }); }
    else if (b.do === 'cam') { const [it, u] = loc(b); it.params.cam.push({ at: u, ids: b.ids, dur: b.dur ?? 0.9, max: b.max ?? L.camMax }); events.push(b.at); }
    else if (b.do === 'note') { const [it, u] = loc(b); it.params.notes.push({ at: u, node: b.node, text: b.text, dur: b.dur ?? 2.8 }); texts.push({ text: b.text, a: b.at, b: b.at + (b.dur ?? 2.8), role: 'label' }); events.push(b.at); }
    else if (b.do === 'zoom') { const [it, u] = loc(b), out = b.out != null ? at({ t: b.out, word: b.outWord }) : T, sub = spec(b.into), zat = b.at + (b.dur ?? 1.1);
      it.params.zoom = { node: b.node, at: u, dur: b.dur ?? 1.1, out: r3(out - it.at), spec: sub, title: b.title, dir: L.dir, reveal: 0.4, notes: (b.notes || []).map((q) => ({ at: r3(at(q) - it.at), node: q.node, text: q.text, dur: q.dur ?? 2.6 })) };
      texts.push({ text: b.title || '', a: zat, b: out - 0.3, role: 'label' }); for (const q of b.notes || []) texts.push({ text: q.text, a: at(q), b: at(q) + (q.dur ?? 2.6), role: 'label' });
      const lay = parseGraph(sub), depth = Math.max(1, new Set(layerList(lay)).size); events.push(b.at, zat, ...Array.from({ length: depth }, (_, k) => zat + k * 0.4), ...(b.notes || []).map(at), out, out + (b.dur ?? 1.1)); }
    else if (b.do === 'hook') { const p = { line: C.text.hook, kicker: C.brand.name, pos: L.hookPos, accent: C.brand.paper, bg: C.brand.ink, size: L.hookSize }; top.push({ id: 'title.hookCard', at: b.at, dur: b.dur ?? 3, params: p }); texts.push({ text: C.text.hook, a: b.at, b: b.at + (b.dur ?? 3), role: 'hook' }); }
    else if (b.do === 'caption') { if (vo) continue;   /* with a voice the captions follow the words instead */
      top.push({ id: 'title.hookCard', at: b.at, dur: b.dur ?? 3, silent: true, params: { line: b.text, pos: L.capPos, accent: C.brand.accent, size: L.capSize, bg: '#FFFFFF' } }); texts.push({ text: b.text, a: b.at, b: b.at + (b.dur ?? 3) + 0.3, role: 'caption-super' }); events.push(b.at); }
    else if (b.do === 'recap') { const p = { title: C.text.recapTitle, items: C.text.recap, pos: L.recapPos, accent: C.brand.accent, stagger: b.stagger ?? 0.5, size: C.aspect === '9:16' ? 0.85 : 1 }; top.push({ id: 'title.recapCard', at: b.at, dur: b.dur ?? 5, params: p });
      texts.push({ text: C.text.recap.join('. '), a: b.at, b: b.at + (b.dur ?? 5), role: 'recap' }); events.push(b.at, ...C.text.recap.map((_, i) => b.at + 0.35 + i * (b.stagger ?? 0.5))); }
    else if (b.do === 'takeaway') { top.push({ id: 'title.takeaway', at: b.at, dur: r3(T - b.at - 0.3), params: { kicker: C.text.takeawayKicker, line: C.text.takeaway, accent: C.brand.accent, ink: C.brand.ink, size: L.takeawaySize } });
      texts.push({ text: C.text.takeaway, a: b.at, b: T, role: 'takeaway' }); events.push(b.at); }
  }
  /* sections from the beats: each section runs from its first beat to the next section's first beat */
  const order = ['question', 'wrongmodel', 'reframe', 'proof', 'sowhat'], starts = order.map((s) => [s, Math.min(...beats.filter((b) => b.sec === s).map((b) => b.at))]).filter(([, t]) => Number.isFinite(t));
  const sections = starts.map(([name, a], i) => ({ name, t: [r3(a), r3(i + 1 < starts.length ? starts[i + 1][1] : T)] }));
  const shots = sections.map((s) => ({ id: s.name, sec: s.name, start: s.t[0], dur: r3(s.t[1] - s.t[0]), move: 'diagram camera', ...(s.name === 'sowhat' ? { hold: true } : {}) }));
  const cap = captionsOf(words, C); for (const x of cap.lint) warnings.push('captions: ' + x);
  const tk = beats.find((b) => b.do === 'takeaway'), quiet = [{ t: [r3(Math.max(T - 8.5, tk ? tk.at + 1.6 : T - 2.2)), r3(T)], kind: 'hold', why: 'the takeaway holds on the end card after its words land' }];
  const scene = { W: A.W, H: A.H, fps, seconds: T, bg: C.brand.paper, platform: A.safe, slots: [], gfx: items, gfxTop: top, captions: cap.captions, speaking: {} };
  return finish({ template: 'explainer-diagram', C, A, fps, T, words, scene, items, top, sections, shots, claims: C.claims, texts, events, quiet, warnings, tag, extra: { pattern: 'explainer', layers: C.layers } });
}
/* the template's own checks (make.mjs runs them before anything is built): every diagram parses, every beat names a known diagram and node */
export function explainerProblems(C) {
  const out = [], specs = {};
  for (const [k, s] of Object.entries(C.diagrams || {})) { const g = parseGraph(s); specs[k] = g; for (const p of g.problems) out.push(`diagrams.${k}: ${p}`); }
  for (const [i, b] of (C.beats || []).entries()) { if (b.diagram && !specs[b.diagram]) out.push(`beats[${i}]: diagram "${b.diagram}" is not in CONFIG.diagrams`);
    const g = specs[b.diagram]; if (g) for (const id of [].concat(b.node || [], Array.isArray(b.ids) ? b.ids : [])) if (!g.nodes.some((n) => n.id === id)) out.push(`beats[${i}]: node "${id}" is not in diagram ${b.diagram}`);
    if (b.do === 'zoom' && !specs[b.into]) out.push(`beats[${i}]: zoom into "${b.into}", which CONFIG.diagrams does not define`);
    if (b.t == null && !b.word) out.push(`beats[${i}]: needs a time t (or a voice word)`); }
  for (const [k, v] of Object.entries(C.text || {})) for (const line of [].concat(v)) if (/\d/.test(line) && !(C.claims || []).some((c) => c.text === line && c.source)) out.push(`text.${k}: "${line}" shows a digit with no sourced claim`);
  return out;
}
