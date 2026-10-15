/* lane human: the personal / tutorial / human-blended kit, node only (no browser, no GPU, no render). run: node templates/_shared/human/human.test.mjs
   1 core: SRT / VTT -> words (speaker tags, VTT word times, estimated spreads), the filler marker (marks, never cuts by itself), the breath-keeping autocut (a detected breath kept whole,
     120 ms of air otherwise, a cut filler's sound never kept, a punchline's beat hold, a quiz hold), frame-exact segments, the verbatim quote gate, --set parsing, PROJECT_MAP targets
   2 screen: the cursor estimated from clicks ARRIVES before each click and sits still on it; zoom keys merge close clicks; the view never shows outside the screen; the PiP hides near its corner
   3 edit: framing alternates on every jump cut; punch-ins keep their minimum gap; B-roll slots never overlap, lead their word, keep coverage under the cap; the active speaker never
     flickers (minimum shot) and follows the voice with the L-cut lag; one lower third per speaker; sticker reactions keep their gap; J / L windows; the caption picker's sizes pass lint at 9:16 and 16:9
   4 plates: every placeholder plate says so in frame; plates and every new gfx part are pure functions of t (same string twice, any order)
   5 templates: every human template builds at BOTH aspects, purely (twice the same JSON), the two aspects are re-layouts (different slot rects, not one crop), every placeholder slot
     is labelled, captions sit inside the safe zone, every cue resolves, PROJECT_MAP targets exist, and the founder-story quote gate refuses a paraphrase */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { reporter } from '../../../layers/tests/harness.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..'), R = reporter('human kit');
const core = await import('./core.mjs'), screen = await import('./screen.mjs'), edit = await import('./edit.mjs'), plates = await import('./plates.mjs');
const { GFX, renderSVG } = await import('../../../type/gfx/index.js');
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;

/* ---------- 1 core ---------- */
const srt = '1\n00:00:01,000 --> 00:00:03,000\nANNA: Hello there my friend\n\n2\n00:00:03,500 --> 00:00:04,500\nLook at line five: um okay.\n';
const sw = core.subsToWords(srt);
R.check('SRT -> words: every word inside its cue, in order, estimated, speaker from an ALL-CAPS prefix that sticks', sw.length === 10 && sw.every((w) => w.est) && sw[0].s === 1 && sw[3].e <= 3 && sw[0].speaker === 'ANNA' && sw.every((w, i) => !i || w.s >= sw[i - 1].e - 1e-9), JSON.stringify(sw.slice(0, 2)));
R.check('SRT: "Look at line five:" is speech, not a speaker name', sw.some((w) => w.w === 'Look') && sw.some((w) => w.w === 'five:'));
const vw = core.subsToWords('WEBVTT\n\n00:01.000 --> 00:03.000\n<v Bob>Hi <00:01.500>you <00:02.000>all');
R.check('VTT: <v> speaker and inline word times are used as given (not estimated)', vw.length === 3 && vw[1].s === 1.5 && vw[2].s === 2 && !vw[0].est && vw.every((w) => w.speaker === 'Bob'));
const W0 = [{ w: 'Hi', s: 0.5, e: 0.8 }, { w: 'um', s: 0.9, e: 1.1 }, { w: 'there.', s: 1.2, e: 1.5, emph: true }, { w: 'You', s: 3.0, e: 3.2 }, { w: 'know,', s: 3.22, e: 3.4 }, { w: 'it', s: 3.45, e: 3.6 }];
const mk = core.markFillers(W0), mk2 = core.markFillers(W0, core.FILLERS, { cut: 'hard' });
R.check('fillers: "um" is hard, "You know" is a soft phrase; marking cuts nothing; --cut hard cuts only the hard one', mk.found.length === 2 && mk.found[0].cls === 'hard' && mk.found[1].text === 'you know' && mk.found[1].cls === 'soft' && !mk.words.some((w) => w.cut) && mk2.words.filter((w) => w.cut).map((w) => w.w).join() === 'um');
R.check('fillers: a user list (hard: / soft: sections, # comments) parses', JSON.stringify(core.parseFillerList('# x\nhard:\nUm\nsoft:\nkind of\n')) === JSON.stringify({ hard: ['um'], soft: ['kind of'] }));
const ac = core.autocutKeep(mk.words, { breaths: [[2.5, 2.8]] });
R.check('autocut: the 1.5 s silence goes, the detected breath before the next word is kept (up to 450 ms before the word)', ac.keep.length === 2 && ac.keep[1][0] <= 2.55 + 1e-9 && ac.keep[1][0] >= 2.48 && ac.cuts[0].breath === 'detected, kept');
R.check('autocut: a punchline (emphasis + sentence end) keeps a 450 ms beat hold before the cut', near(ac.keep[0][1], 1.95, 0.002));
const ac2 = core.autocutKeep(mk.words, {});
R.check('autocut: no breath found -> 120 ms of air before the next word (not the 60 ms pad)', near(ac2.keep[1][0], 2.88, 0.002));
const ac3 = core.autocutKeep(mk2.words, {});
R.check('autocut: a cut filler is removed even inside a phrase, and none of its sound is kept', ac3.keep.some(([a, b]) => b <= 0.9) && ac3.keep.some(([a]) => a >= 1.1 && a < 1.2) && !ac3.keep.some(([a, b]) => a < 1.0 && b > 1.0));
const hold = core.autocutKeep([{ w: 'Question?', s: 0, e: 0.5, hold: 2 }, { w: 'Answer', s: 3, e: 3.4 }], {});
R.check('autocut: a word with hold: s keeps s seconds after it (the quiz pause survives)', hold.keep[0][1] >= 2.5);
const plain = core.autocutKeep([{ w: 'a', s: 0, e: 0.3 }, { w: 'b', s: 1.5, e: 1.8 }], { breath: 0, beatHold: 0 });
R.check('autocut with breath 0 and no holds is the plain plan.mjs rule (unchanged)', JSON.stringify(plain.keep) === JSON.stringify([[0, 0.39], [1.44, 1.89]]));
const segs = core.segments([[0.38, 1.95], [2.48, 3.69]], 30);
R.check('segments: frame-exact and end to end (no drift)', segs[1].f0 === segs[0].f1 && near(segs[0].dur * 30, Math.round(segs[0].dur * 30), 1e-2) && segs[1].start === +(segs[0].f1 / 30).toFixed(4));
const rw = core.remapWords(segs, [{ w: 'x', s: 2.6, e: 2.9 }]);
R.check('remapWords: a word moves onto the output timeline through its segment', near(rw[0].os, segs[1].start + 0.12, 2e-3));
const qw = [{ w: 'It', os: 0, oe: 0.2 }, { w: 'still', os: 0.3, oe: 0.5 }, { w: 'starts', os: 0.6, oe: 0.8 }, { w: 'with', os: 0.9, oe: 1 }, { w: 'listening.', os: 1.1, oe: 1.5 }];
R.check('quote gate: a verbatim run passes (case and punctuation ignored); a paraphrase is refused', core.quoteCheck('it still starts with listening', qw).ok && !core.quoteCheck('it always starts with listening', qw).ok && !core.quoteCheck('', qw).ok);
R.check('atOf: exact word first ("the" never matches "theme"), nth, offset; a missing word throws', core.atOf({ word: 'the' }, [{ w: 'theme', os: 1 }, { w: 'the', os: 2 }]) === 2 && core.atOf({ word: 'x', nth: 1, offset: 0.5 }, [{ w: 'x', os: 1 }, { w: 'x', os: 3 }]) === 3.5 && (() => { try { core.atOf({ word: 'nope' }, []); return false; } catch { return true; } })());
const C1 = core.applySets({ aspect: '16:9', media: { a: { src: 'x' } }, list: [] }, ['--set', 'aspect=9:16', '--set', 'media.a.src=null', '--set', 'list=[1,2]']);
R.check('--set: aspect=9:16 stays text, null / JSON become values; fixSets agrees with what cues.mjs passes', C1.aspect === '9:16' && C1.media.a.src === null && C1.list[1] === 2 && core.fixSets({ a: 'null', b: 'true', c: '9:16' }).a === null);

/* ---------- 2 screen ---------- */
const clicks = [{ t: 2, x: 0.7, y: 0.3 }, { t: 2.8, x: 0.72, y: 0.36 }, { t: 6, x: 0.2, y: 0.8 }], tr = screen.cursorFromClicks(clicks, { end: 8 });
R.check('cursor from clicks: the pointer is ON the target at each click and has settled there before it (no arrival on the click frame)',
  clicks.every((c) => { const p = screen.cursorAt(tr.track, c.t), q = screen.cursorAt(tr.track, c.t - 0.1); return Math.hypot(p[0] - c.x, p[1] - c.y) < 0.004 && Math.hypot(q[0] - c.x, q[1] - c.y) < 0.01; }) && tr.track.filter((q) => q[3]).length === 3 && tr.estimated);
const keys = screen.zoomKeys(clicks);
R.check('zoom keys: clicks 0.8 s apart share one zoom; a far click gets its own; ramps are ordered', keys.length === 2 && keys.every((k) => k.t0 < k.t1 && k.t1 <= k.t2 && k.t2 < k.t3) && near(screen.zoomScale(keys, 2.5), 1.8) && screen.zoomScale(keys, 0) === 1);
let inside = true; for (let t = 0; t < 8; t += 0.1) { const v = screen.zoomView(keys, tr.track, t), m = screen.viewTransform(v, [1920, 1080], [1080, 1000], 'cover'); if (m.visible[0] < -1e-6 || m.visible[1] < -1e-6 || m.visible[2] > 1 + 1e-6 || m.visible[3] > 1 + 1e-6) inside = false; }
R.check('zoom-follow: the visible region never leaves the recording (cover-fit 9:16 panel, every 0.1 s)', inside);
R.check('zoomView is a pure function of t (same answer in any order)', JSON.stringify(screen.zoomView(keys, tr.track, 5.3)) === JSON.stringify((screen.zoomView(keys, tr.track, 1), screen.zoomView(keys, tr.track, 5.3))));
const pipT = screen.cursorFromClicks([{ t: 1, x: 0.88, y: 0.85 }], { end: 3 });
R.check('PiP auto-hide: hidden when the cursor sits on its corner, visible when it is far, and inside a hide window', screen.pipState({ corner: 'br', autoHide: ['cursor'] }, 1.2, { track: pipT.track }).opacity < 0.05 && screen.pipState({ corner: 'br', autoHide: ['cursor'] }, 0, { track: pipT.track }).opacity > 0.95 && screen.pipState({ corner: 'br', hide: [[1, 2]] }, 1.5, {}).opacity === 0);

/* ---------- 3 edit ---------- */
const S6 = core.segments([[0, 1], [1.5, 3], [3.5, 5], [5.5, 7], [7.5, 9], [9.5, 11]], 30), words = core.remapWords(S6, [{ w: 'big', s: 0.6, e: 0.9, emph: true }, { w: 'wow', s: 2, e: 2.3, emph: true }, { w: 'huge', s: 8, e: 8.4, emph: true }]);
const P = edit.punchPlan(S6, words, { ladder: [1, 1.12, 1, 1.2], minGap: 4, firstAt: 0.5 });
R.check('punch-in planner: framing alternates on every jump cut (no two neighbours share a scale)', P.frames.every((f, i) => !i || f.scale !== P.frames[i - 1].scale));
R.check('punch-in planner: punch-ins on emphasis words, at most one per 4 s', P.punches.length === 2 && P.punches[1].t - P.punches[0].t >= 4 && edit.frameAt(P, P.punches[0].t + 0.5) > edit.frameAt(P, P.punches[0].t - 0.01));
const BW = core.remapWords(core.segments([[0, 30]], 30), [{ w: 'coffee', s: 3, e: 3.4 }, { w: 'market', s: 3.8, e: 4.2 }, { w: 'harbour', s: 10, e: 10.5 }, { w: 'the', s: 12, e: 12.1 }, { w: 'mountains', s: 15, e: 15.6 }, { w: 'tomorrow', s: 20, e: 20.6 }]);
const B = edit.brollSlots(BW, { keywords: [{ word: 'coffee' }, { word: 'market' }], coverage: 0.3, seconds: 30 });
R.check('B-roll planner: slots lead their word by 150 ms, never overlap (0.8 s apart), coverage <= the cap, stop words never chosen, src null (you fill them)',
  B.slots[0].at === 2.85 && B.slots.every((s, i) => !i || s.at >= B.slots[i - 1].at + B.slots[i - 1].dur + 0.8 - 1e-6) && B.coverage <= 0.3 + 1e-6 && !B.slots.some((s) => s.word === 'the') && B.slots.every((s) => s.src === null) && !B.slots.some((s) => s.word === 'market'));
const TW = [{ w: 'a', os: 0, oe: 1, speaker: 'H' }, { w: 'b', os: 1.2, oe: 3, speaker: 'G' }, { w: 'c', os: 3.1, oe: 3.5, speaker: 'H' }, { w: 'd', os: 3.6, oe: 6, speaker: 'G' }];
const turns = edit.speakerTurns(TW), cuts = edit.activeCuts(turns, { lagMs: 220, minShot: 1.4 });
R.check('active speaker: the picture follows the voice 220 ms late (L-cut), and a 0.4 s interjection does not flicker the picture', cuts.length === 2 && near(cuts[1].t, 1.42) && cuts.every((c, i) => !i || c.t - cuts[i - 1].t >= 1.4) && edit.activeAt(cuts, 3.3) === 'G');
R.check('active speaker emphasis eases (0..1 over 0.25 s), pure', edit.emphasisAt(cuts, 'G', 1.42) === 0 && edit.emphasisAt(cuts, 'G', 1.8) === 1 && edit.emphasisAt(cuts, 'H', 1.8) === 0);
const lts = edit.speakerLowerThirds(turns, { H: { name: 'Host' }, G: { name: 'Guest' } });
R.check('lower thirds tied to speaker tags: one per speaker, at their first turn', lts.length === 2 && lts[0].params.name === 'Host' && lts[1].at > 1.2 && lts[1].at < 2);
const rx = edit.reactionsFromWords([{ w: 'coffee', os: 1, oe: 1.3 }, { w: 'coffee', os: 2, oe: 2.3 }, { w: 'loud', os: 5, oe: 5.3 }], [{ match: 'coffee', sticker: 'chai' }, { match: 'loud', sticker: 'megaphone' }]);
R.check('sticker reactions: timed to the trigger word, one per 2.5 s', rx.length === 2 && rx[0].params.name === 'chai' && near(rx[0].at, 0.95));
const jl = edit.jlWindows([{ id: 'b', at: 4, dur: 2, nat: true }, { id: 'c', at: 9, dur: 1 }], { jMs: 300, lMs: 450 });
R.check('J / L windows: the insert sound starts 300 ms before its picture and runs 450 ms after; inserts without nat get none', jl.length === 1 && jl[0].audioIn === 3.7 && jl[0].audioOut === 6.45);
const caps = Object.keys(edit.CAPTION_PICKS).flatMap((n) => ['16:9', '9:16'].map((a) => [n, a, edit.pickCaption(n, { aspect: a })]));
const sb = (a) => core.safeBox(a);
R.check('caption picker: every look at both aspects sits inside the safe zone; 9:16 looks used by the templates (karaoke, emphasis, brand) pass the 64-80 px rule',
  caps.every(([, a, p]) => p.box.y0 >= sb(a).y0 - 0.5 && p.box.y1 <= sb(a).y1 + 0.5 && p.box.x0 >= sb(a).x0 - 0.5) && ['karaoke', 'emphasis', 'brand'].every((n) => !edit.pickCaption(n, { aspect: '9:16' }).lint.length), caps.filter(([, , p]) => p.lint.length).map(([n, a]) => n + '@' + a).join(' '));

/* ---------- 4 plates and parts ---------- */
const pl = { speaker: plates.speakerPlate(1, { w: 1080, h: 1920 }), small: plates.speakerPlate(1, { w: 300, h: 300 }), desk: plates.desktopPlate(2, {}), photo: plates.photoPlate(1, {}), broll: plates.brollPlate(1, {}) };
R.check('every placeholder plate says so in frame (speaker, small PiP, desktop, photo, B-roll)', /PLACEHOLDER/.test(pl.speaker) && /placeholder/i.test(pl.small) && /PLACEHOLDER RECORDING/.test(pl.desk) && /fictional app/.test(pl.desk) && /YOUR PHOTO HERE/.test(pl.photo) && /YOUR B-ROLL HERE/.test(pl.broll));
const ev = [{ t: 1, kind: 'type', line: 1, text: 'abcdef', cps: 10 }, { t: 2, kind: 'toggle', on: true }];
R.check('desktop plate replays its events by t (typing progress, toggle), whatever was drawn before', plates.desktopState(ev, 1.3).lines[0] === 'abc' && plates.desktopState(ev, 2.5).dark && !plates.desktopState(ev, 1.5).dark && plates.desktopPlate(1.3, { events: ev }) === (plates.desktopPlate(2.5, { events: ev }), plates.desktopPlate(1.3, { events: ev })));
const ids = Object.keys(GFX).filter((k) => GFX[k].file === 'type/gfx/human.js');
let pure = true; for (const id of ids) for (const [W, H] of [[1920, 1080], [1080, 1920]]) { const a = renderSVG(id, 1.3, { at: 0 }, { W, H }); renderSVG(id, 0.2, { at: 0 }, { W, H }); if (renderSVG(id, 1.3, { at: 0 }, { W, H }) !== a || !a) pure = false; }
R.check(`the ${ids.length} human gfx parts draw at 16:9 and 9:16 and are pure functions of t`, ids.length >= 15 && pure);
R.check('title.hookCard is visible and already moving on frame 0 (the hook rule)', renderSVG('title.hookCard', 0, { at: 0 }, {}) !== '' && renderSVG('title.hookCard', 0, { at: 0 }, {}) !== renderSVG('title.hookCard', 0.2, { at: 0 }, {}));
R.check('ui.cursorTrack draws a click ripple only after a click', /circle/.test(renderSVG('ui.cursorTrack', 0.9, { at: 0 }, {})) && !/circle/.test(renderSVG('ui.cursorTrack', 0.5, { at: 0 }, {})));

/* ---------- 5 templates ---------- */
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id));
const TPL = { tutorial: '16:9', 'vlog-personal': '9:16', 'podcast-clip': '9:16', 'founder-story': '16:9', 'course-lesson': '16:9' };
for (const [name, def] of Object.entries(TPL)) {
  const mod = await import(pathToFileURL(path.join(ROOT, 'templates', name, 'config.mjs')).href), other = def === '16:9' ? '9:16' : '16:9';
  const build = (aspect) => mod.buildPlan(structuredClone({ ...mod.CONFIG, aspect }));
  let a, a2, b, err = ''; try { a = build(def); a2 = build(def); b = build(other); } catch (e) { err = e.message; }
  if (!a) { R.check(`${name}: builds`, false, err); continue; }
  R.check(`${name}: builds at ${def} and ${other}, purely (twice the same JSON)`, JSON.stringify(a) === JSON.stringify(a2) && a.size.join('x') !== b.size.join('x'));
  const rects = (p) => p.scene.slots.map((s) => s.rect.join(',')).join('|');
  R.check(`${name}: ${other} is a re-layout, not a crop (its own slot rects, its own size)`, rects(a) !== rects(b) && b.size[0] === (other === '9:16' ? 1080 : 1920));
  const unl = [a, b].flatMap((p) => p.scene.slots.filter((s) => !s.src && s.kind !== 'slide' && !(JSON.stringify(s.ph || {}) + JSON.stringify(s.phLabel || '')).match(/PLACEHOLDER|YOUR .* HERE/)).map((s) => s.id));
  R.check(`${name}: every placeholder slot is labelled in frame`, !unl.length, unl.join(' '));
  const capOk = (p) => { const z = core.safeBox(p.aspect), bx = p.scene.captions.box; return bx.y0 >= z.y0 - 0.5 && bx.y1 <= z.y1 + 0.5 && bx.x0 >= z.x0 - 0.5 && bx.x1 <= z.x1 + 0.5; };
  R.check(`${name}: captions sit inside the safe zone at both aspects`, capOk(a) && capOk(b));
  const badCue = [...a.cues, ...b.cues].filter((c) => !SFX.has('snd.' + c.id.split('/').slice(1).join('.')));
  R.check(`${name}: every cue resolves to a library sound, and there is at least one`, a.cues.length > 0 && !badCue.length, badCue.map((c) => c.id).join(' '));
  R.check(`${name}: PROJECT_MAP targets are CONFIG paths`, !!mod.PROJECT_MAP && !core.projectMapProblems(mod.CONFIG, mod.PROJECT_MAP).length, core.projectMapProblems(mod.CONFIG, mod.PROJECT_MAP).join(' '));
  R.check(`${name}: CONFIG keeps the editable contract (brand.*, platform, fps, length, aspect, text, media, claims)`, ['brand', 'platform', 'fps', 'length', 'aspect', 'text', 'media', 'claims'].every((k) => k in mod.CONFIG) && ['name', 'accent', 'ink', 'paper', 'logo', 'url', 'cta', 'font'].every((k) => k in mod.CONFIG.brand));
  R.check(`${name}: the voice track and the mix fields are planned (vo stem, a bed ducked >= 9 dB)`, a.voice.segments.length > 0 && a.vo && a.duckDb >= 9 && a.audio.mode === 'vo');
}
const fs1 = await import(pathToFileURL(path.join(ROOT, 'templates/founder-story/config.mjs')).href);
R.check('founder-story: the quote gate refuses a paraphrase (gateProblems names text.quote; buildPlan throws)', fs1.gateProblems({ ...fs1.CONFIG, text: { ...fs1.CONFIG.text, quote: 'it always starts with listening' } }).some((x) => x.startsWith('text.quote')) && !fs1.gateProblems(fs1.CONFIG).length
  && (() => { try { fs1.buildPlan({ ...fs1.CONFIG, text: { ...fs1.CONFIG.text, quote: 'we love our users' } }); return false; } catch { return true; } })());
const tut = (await import(pathToFileURL(path.join(ROOT, 'templates/tutorial/config.mjs')).href));
const tp = tut.buildPlan(structuredClone(tut.CONFIG)), tpr = tut.buildPlan(structuredClone({ ...tut.CONFIG, media: { ...tut.CONFIG.media, screen: { ...tut.CONFIG.media.screen, src: '/abs/rec.mp4' } } }));
R.check('tutorial: our cursor is drawn on the placeholder only (a real recording has its own pointer); the plan says the track is estimated', tp.scene.screenGfx.screen.some((g) => g.id === 'ui.cursorTrack') && !tpr.scene.screenGfx.screen.some((g) => g.id === 'ui.cursorTrack') && tp.cursor.source === 'estimated from click times');
process.exit(R.done() && R.failed ? 1 : 0);
