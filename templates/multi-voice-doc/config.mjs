/* TEMPLATE multi-voice-doc: the documentary launch film (storyboard shape L, success-patterns round 4/5; 107-185 s when real, a 29 s placeholder demo here):
   1 voices cold open: 4-6 faces in 0.5-1.3 s cuts, each mid-sentence, audio leads every cut (J)    cuts/story/voicesColdOpen (cutgen.py voices-open)
   2 the lead's thesis line, name super at about 5-6 s
   3 three chapters: a speaker (name super + ONE personal detail) + B-roll + one flat 2D insert each (network -> one dot, documents -> a wall, blocks slide)
   4 proof (a customer line + a proof card: any digit needs a source)   5 availability card   6 the lead closes   7 a quiet hold on the end card (bed -30 dB)
   VO-led cutting: the voices are the continuity. Speaker changes sit in the breath between lines (never inside a word); B-roll and inserts cut inside
   sentences on purpose (round 4/5: 61-89% of a VO documentary's cuts fall under a voice). The bed is ducked 12 dB under the voice by music/mixer.py (cue sheet vo.duck_db).
   INPUT: clips.json [{id, src, words, name, role, tag, lead?}]: YOUR interview clips (MP4) + word timings in each clip's own time (whisper).
   Never stage people or testimonials: until a src is set, a clip renders as a labelled card ("your interview clip here") over a guide signal
   (shaped noise at the word timings, not a voice). */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { PLATFORMS, SIZES } from '../_shared/plan.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  clips: 'clips.json',                                   // your footage + transcripts (see the header); src: null = labelled placeholder card
  platform: 'x.video', fps: 30,                           // 16:9 master; re-layout (not crop) for 9:16
  open: { maxOpenS: 6, jMs: 130 },                       // cuts/story/voicesColdOpen: the montage stops before 6 s; audio leads each cut by 130 ms
  thesis: { more: [] },                                  // extra lead sentence indices after the cold open's first full line (e.g. [1])
  breathS: 0.5,                                          // VO pause between segments; the speaker cut lands in the middle of it. A segment may set its own breathS:
                                                         // 1.1 s or more is a 'music beat' (the bed comes back up, ears can measure the duck against it)
  chapters: [
    { clip: 'a', sentences: [1], breathS: 1.1, insert: { kind: 'network', at: 1.3, dur: 1.2, line: 'many notes, one place' }, broll: { label: 'hands sorting paper notes', src: null, mediaStart: 0, at: 2.5, dur: 0.8 } },
    { clip: 'b', sentences: [1], insert: { kind: 'tiles', at: 1.3, dur: 1.2, line: 'everything you kept' }, broll: { label: 'a desk at night', src: null, mediaStart: 0, at: 2.5, dur: 0.8 } },
    { clip: 'c', sentences: [1], insert: { kind: 'blocks', at: 1.3, dur: 1.2, line: 'step by step' }, broll: { label: 'the product on a laptop', src: null, mediaStart: 0, at: 2.5, dur: 0.8 } },
  ],
  proof: { clip: 'p', sentences: [0], breathS: 1.1, card: { at: 1.3, dur: 1.5, text: 'Fewer repeat questions', source: 'placeholder: put the measured figure and its source here' } },
  availability: { line: 'Available today', sub: 'example.com', at: 0, dur: 1.4 },   // at: seconds after the cut into the close; the lead is back on screen for the last line
  close: { clip: 'lead', sentences: [2] },
  tail: { holdS: 3.6, liftS: 1.8, bedDb: -30, fadeMs: 600, wordmark: 'Orbit', url: 'example.com' },   // end card: the bed stays up liftS (the sting lands), then a quiet hold at bedDb (round 4/5: 3-9 s, explainers end quiet)
  /* name supers: an existing lowerThird.* part. CONFIG: swap in lowerThird.personalTag (avatar chip + one personal detail) once it lands in type/gfx. */
  supers: { part: 'lowerThird.docSuper', pos: 'bl', delayS: 0.25, durS: 2.4, edgeF: 10, params: { size: 64, roleSize: 26, scrim: 0.35 } },   // edgeF = the part's inF + outF frames (docSuper 4 + 6): a gfx dur is its hold, so make.mjs subtracts them; set the new part's when you swap it
  music: 'music/bed_lofi_warm_loop8', musicGainDb: 0, duckDb: 12,   // VO documentaries: the mixer sets the bed under the voice and ducks it duckDb (pack minimum 9; 12 leaves margin for ears' measurement)
  ceilingDb: -2.0, placeholderVoice: 'guide',            // 'guide' (shaped noise at the word timings, clearly not speech) | 'none'
  layers: [{ kind: 'vignette', params: { amount: 0.06 } }, { kind: 'grain', params: { stock: 'digital-soft' } }],
  sfx: { super: 'sfx/tx/cut_tick', insert: { network: 'sfx/sparkle/letter_assemble', tiles: 'sfx/paper/card_riffle', blocks: 'sfx/paper/rustle' }, card: 'sfx/ui/pop', availability: 'sfx/ui/slide', end: 'sfx/logo/two_note' },   // one sound per kind of insert (a repeated id grates)
};
/* ============================================================================== */

const endsSentence = (w) => /[.?!…]['")\]]*$/.test(w.w.trim());
export function sentences(W) { const out = []; let cur = []; W.forEach((w, k) => { cur.push(w); if (k === W.length - 1 || endsSentence(w)) { out.push(cur); cur = []; } }); return out; }
const inside = (t, W) => W.find((w) => w.s + 1e-9 < t && t < w.e - 1e-9);
/* source in/out around words i..k, padded (30 / 50 ms) but never into a neighbouring word (same rule as cuts/story45.py _audio_edges) */
function edges(W, a, b) { const i = W.indexOf(a), k = W.indexOf(b), pe = i > 0 ? W[i - 1].e : -1e9, ns = k + 1 < W.length ? W[k + 1].s : 1e9;
  return [Math.max(a.s - 0.03, (pe + a.s) / 2, 0), Math.min(b.e + 0.05, (b.e + ns) / 2)]; }

export function buildPlan(C) {
  const fps = C.fps, P = PLATFORMS[C.platform], clipsPath = path.resolve(HERE, C.clips), py = process.env.PYTHON || 'python3';
  const doc = JSON.parse(fs.readFileSync(clipsPath, 'utf8')), clips = Object.fromEntries(doc.clips.map((c) => [c.id, c])), sec = (f) => +(f / fps).toFixed(4);
  /* 1 the cold open: the story shape's own generator (deterministic), so the template and cutgen never disagree */
  const open = JSON.parse(execFileSync(py, [path.join(HERE, '..', '..', 'cuts', 'cutgen.py'), 'voices-open', '--clips', clipsPath, '--fps', String(fps),
    '--max-open', String(C.open.maxOpenS), '--j-ms', String(C.open.jMs)], { encoding: 'utf8' }));
  const audio = open.audio.map((a) => ({ ...a, role: a.lead ? 'thesis' : 'face' })), base = open.shots.map((s) => ({ clip: s.clip, start: s.start, end: s.end, role: s.role, mediaStart: s.media_start }));
  const supers = open.supers.map((s) => ({ clip: s.clip, at: s.at, dur: Math.round(C.supers.durS * fps), name: s.name, role: s.role, tag: s.tag }));
  const named = new Set(supers.map((s) => s.clip)), breath = Math.round(C.breathS * fps), overlays = [], cues = [], claims = [], warnings = [...open.warnings];
  let pos = audio.at(-1).end;
  /* 2-6 VO segments: whole sentences of one clip, laid end to end with a breath; the picture cut sits mid-breath */
  const segment = (role, clipId, idx, extra = {}, gapS) => {
    const c = clips[clipId]; if (!c) throw new Error('unknown clip ' + clipId); const S = sentences(c.words);
    const a = S[idx[0]], b = S[idx.at(-1)]; if (!a || !b) throw new Error(`clip ${clipId} has no sentence ${idx}`);
    let [i, o] = edges(c.words, a[0], b.at(-1)), n = Math.round((o - i) * fps); if (inside(i + n / fps, c.words)) n -= 1;
    const br = gapS != null ? Math.round(gapS * fps) : breath, start = pos + br, cut = pos + Math.floor(br / 2);
    base.at(-1).end = cut;
    const seg = { clip: clipId, src: c.src, start, end: start + n, src_in: +i.toFixed(4), src_out: +(i + n / fps).toFixed(4), text: idx.map((k) => S[k].map((w) => w.w).join(' ')).join(' '), role };
    audio.push(seg); base.push({ clip: clipId, start: cut, end: start + n, role, mediaStart: +Math.max(0, i - (start - cut) / fps).toFixed(4), ...extra });
    if (c.name && !named.has(clipId)) { named.add(clipId); supers.push({ clip: clipId, at: start + Math.round(C.supers.delayS * fps), dur: Math.round(C.supers.durS * fps), name: c.name, role: c.role || '', tag: c.tag || '' }); }
    pos = start + n; return seg;
  };
  for (const k of C.thesis.more) segment('thesis', open.audio.at(-1).clip, [k]);
  C.chapters.forEach((ch, j) => {
    const s = segment('chapter', ch.clip, ch.sentences, { chapter: j + 1 }, ch.breathS), at = (x) => s.start + Math.round(x * fps);
    if (ch.insert) { overlays.push({ kind: 'insert', insert: ch.insert.kind, line: ch.insert.line, start: at(ch.insert.at), end: Math.min(s.end, at(ch.insert.at + ch.insert.dur)), chapter: j + 1 });
      cues.push({ id: C.sfx.insert[ch.insert.kind] || C.sfx.insert.default || 'sfx/paper/rustle', t: sec(at(ch.insert.at)), why: `chapter ${j + 1}: flat 2D insert (${ch.insert.kind})` }); }
    if (ch.broll) overlays.push({ kind: 'broll', label: ch.broll.label, src: ch.broll.src, mediaStart: ch.broll.mediaStart || 0, start: at(ch.broll.at), end: Math.min(s.end, at(ch.broll.at + ch.broll.dur)), chapter: j + 1 });
  });
  if (C.proof) { const s = segment('proof', C.proof.clip, C.proof.sentences, {}, C.proof.breathS), cd = C.proof.card;
    if (cd) { overlays.push({ kind: 'card', text: cd.text, source: cd.source, start: s.start + Math.round(cd.at * fps), end: Math.min(s.end + breath, s.start + Math.round((cd.at + cd.dur) * fps)) }); claims.push({ text: cd.text, source: cd.source });
      cues.push({ id: C.sfx.card, t: sec(s.start + Math.round(cd.at * fps)), why: 'proof card' }); } }
  const cl = segment('close', C.close.clip, C.close.sentences, {}, C.close.breathS), av = C.availability;
  if (av) { const c0 = base.at(-1).start + Math.round(av.at * fps); overlays.push({ kind: 'availability', line: av.line, sub: av.sub, start: c0, end: c0 + Math.round(av.dur * fps) });
    cues.push({ id: C.sfx.availability, t: sec(c0), why: 'availability card' }); }
  /* 7 the quiet hold */
  const tail0 = pos + (C.tail.breathS != null ? Math.round(C.tail.breathS * fps) : breath), n = tail0 + Math.round(C.tail.holdS * fps);
  base.at(-1).end = tail0; base.push({ clip: null, start: tail0, end: n, role: 'end', hold: true });
  cues.push({ id: C.sfx.end, t: sec(tail0), why: 'end card on the quiet hold' });
  supers.forEach((s) => cues.push({ id: C.sfx.super, t: sec(s.at), why: 'name super ' + s.name }));
  const lift = Math.round((C.tail.liftS || 0) * fps), bedAutomation = [{ frame: 0, gain_db: 0 }, { frame: tail0 + lift, gain_db: 0 }, { frame: tail0 + lift + Math.round(C.tail.fadeMs / 1000 * fps), gain_db: C.tail.bedDb }];
  /* no slivers: an overlay that ends < 0.5 s before the next cut or overlay runs on to it (the VO carries the join) */
  const bounds = [...base.slice(1).map((b) => b.start), ...overlays.map((o) => o.start), n].sort((a, b) => a - b);
  for (const o of overlays) { const nx = bounds.find((b) => b > o.start && b >= o.end); if (nx !== undefined && nx - o.end < Math.round(0.5 * fps)) o.end = nx; }
  /* the picture timeline (top-most layer per frame) for lint, ears and the shot list; speaker cuts checked against the VO words */
  const marks = [...new Set([0, n, ...base.flatMap((b) => [b.start, b.end]), ...overlays.flatMap((o) => [o.start, o.end])])].sort((a, b) => a - b), shots = [];
  for (let k = 0; k + 1 < marks.length; k++) { const a = marks[k], b = marks[k + 1], o = [...overlays].reverse().find((x) => x.start <= a && a < x.end), bs = base.find((x) => x.start <= a && a < x.end);
    const id = o ? `${o.kind}${o.chapter ? o.chapter : ''}` : bs ? (bs.clip ? `${bs.role}-${bs.clip}` : 'end') : 'gap';
    if (shots.length && shots.at(-1).id === id && Math.abs(shots.at(-1).f1 - a) < 1) { shots.at(-1).f1 = b; continue; } shots.push({ id, f0: a, f1: b, hold: bs && bs.hold }); }
  /* a super only rides its own speaker's shot: clipped where an insert, B-roll or the next speaker cuts in */
  for (const sp of supers) { const sh = shots.find((x) => x.f0 <= sp.at && sp.at < x.f1); if (sh && sp.at + sp.dur > sh.f1) sp.dur = sh.f1 - sp.at;
    if (sp.dur < Math.round(1.0 * fps)) warnings.push(`the super for ${sp.name} reads for only ${sec(sp.dur)} s: give the speaker a longer run before the insert`); }
  const transcript = audio.flatMap((s) => (clips[s.clip].words || []).filter((w) => w.s >= s.src_in - 1e-6 && w.e <= s.src_out + 1e-6).map((w) => ({ w: w.w, s: +(sec(s.start) + w.s - s.src_in).toFixed(3), e: +(sec(s.start) + w.e - s.src_in).toFixed(3), clip: s.clip })));
  const speakerCuts = base.slice(open.shots.length).map((b) => b.start), voCheck = speakerCuts.filter((f) => inside(f / fps, transcript)).map((f) => 'speaker cut at frame ' + f + ' falls inside a word');
  return { template: 'multi-voice-doc', fps, seconds: sec(n), clips: C.clips, size: SIZES[P.aspect], safe: P.safe, music: C.music, musicGainDb: C.musicGainDb, ceilingDb: C.ceilingDb, duckDb: C.duckDb, vo: 'vo.wav', bedAutomation,
    open: { seconds: open.open_s, faces: open.faces }, audio, base, overlays, supers, transcript, placeholders: audio.filter((a) => !a.src).length + overlays.filter((o) => o.kind === 'broll' && !o.src).length,
    shots: shots.map((s) => ({ id: s.id, start: sec(s.f0), dur: sec(s.f1 - s.f0), ...(s.hold ? { hold: true } : {}), tx: 'transitions/cut' })), cues: cues.sort((a, b) => a.t - b.t), claims,
    lint_vo: voCheck, warnings, paceRule: { aslMax: 4.5, longMax: 6 } };
}
