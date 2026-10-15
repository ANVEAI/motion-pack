#!/usr/bin/env node
/* motion-pack / tools / human / human.mjs: the transcript and edit tools for your own footage (node, no browser). Every command prints JSON or writes the file you name.

   node tools/human/human.mjs words talk.srt [--out words.json] [--speaker NAME]     SRT / VTT -> words.json (word times from VTT <00:01.200> tags, else spread by length: est: true)
   node tools/human/human.mjs fillers words.json [--list tools/human/fillers.txt] [--cut none|hard|all] [--out marked.json]
                                                                                   mark um / uh (hard) and you know / I mean (soft); prints every hit with its time so YOU choose;
                                                                                   --cut hard sets cut: true on the hard ones (autocut then removes them); nothing is cut by default
   node tools/human/human.mjs autocut words.json [--silence 0.5] [--breath 0.12] [--breaths breaths.json] [--cut-fillers hard|all] [--fps 30]
                                                                                   keep ranges + output segments: silences over --silence go, a breath stays
                                                                                   (breaths.json from tools/human/breaths.py is kept whole, else 120 ms of air)
   node tools/human/human.mjs punchins words.json [--ladder 1,1.12,1,1.2] [--min-gap 4]   the alternating framing per jump cut and the punch-ins on emphasis words
   node tools/human/human.mjs broll words.json [--keywords coffee,station] [--coverage 0.45] [--no-auto]   B-roll slots to fill (label + src: null), leading each word by 150 ms
   node tools/human/human.mjs cursor clicks.json [--fps 30] [--end 30] [--out track.json]   estimate a cursor track from click times ([{ t, x, y }] screen fractions)
   node tools/human/human.mjs captions [--pick karaoke] [--aspect 9:16]            the caption style picker: list the looks, or show one with its box and lint
   (autocut / punchins / broll read words.json in SOURCE time; punchins and broll run on the autocut timeline, as the templates do) */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), H = (f) => import(pathToFileURL(path.join(ROOT, 'templates', '_shared', 'human', f)).href);
const core = await H('core.mjs'), edit = await H('edit.mjs'), screen = await H('screen.mjs');
const [cmd, file, ...rest] = process.argv.slice(2), opt = (k, d) => { const i = rest.indexOf('--' + k); return i < 0 ? d : rest[i + 1]; }, flag = (k) => rest.includes('--' + k);
const out = (o) => { const p = opt('out'); const s = JSON.stringify(o, null, 1); if (p) { fs.writeFileSync(p, s + '\n'); console.log(p); } else console.log(s); };
const readWords = (f) => { if (!f || !fs.existsSync(f)) { console.error(`human.mjs ${cmd}: no such file ${f}`); process.exit(2); } const t = fs.readFileSync(f, 'utf8'); return /\.(srt|vtt)$/i.test(f) ? core.normWords(core.subsToWords(t)) : core.normWords(JSON.parse(t)); };
const fps = +(opt('fps', 30));
const cutTimeline = (W) => { const r = core.autocutKeep(W, { silenceMin: +opt('silence', 0.5), breath: +opt('breath', 0.12) }), segs = core.segments(r.keep, fps); return { segs, words: core.remapWords(segs, r.kept) }; };
if (cmd === 'words') { const W = core.subsToWords(fs.readFileSync(file, 'utf8'), { speaker: opt('speaker', null) }); out({ source: path.basename(file), estimated: W.some((w) => w.est), words: W }); }
else if (cmd === 'fillers') { const list = opt('list') ? core.parseFillerList(fs.readFileSync(opt('list'), 'utf8')) : core.FILLERS; const r = core.markFillers(readWords(file), list, { cut: opt('cut', 'none') });
  if (opt('out')) { fs.writeFileSync(opt('out'), JSON.stringify({ words: r.words }, null, 1) + '\n'); } console.log(JSON.stringify({ fillers: r.found.length, hard: r.found.filter((f) => f.cls === 'hard').length, soft: r.found.filter((f) => f.cls === 'soft').length, cut: r.found.filter((f) => f.cut).length, found: r.found }, null, 1)); }
else if (cmd === 'autocut') { const br = opt('breaths') ? JSON.parse(fs.readFileSync(opt('breaths'), 'utf8')).breaths : []; const r = core.autocutKeep(readWords(file), { silenceMin: +opt('silence', 0.5), breath: +opt('breath', 0.12), breaths: br, cutFillers: opt('cut-fillers', false) });
  const segs = core.segments(r.keep, fps); out({ keep: r.keep, cuts: r.cuts, segments: segs, seconds: segs.length ? +(segs.at(-1).f1 / fps).toFixed(4) : 0 }); }
else if (cmd === 'punchins') { const { segs, words } = cutTimeline(readWords(file)); out(edit.punchPlan(segs, words, { ladder: String(opt('ladder', '1,1.12,1,1.2')).split(',').map(Number), minGap: +opt('min-gap', 4) })); }
else if (cmd === 'broll') { const { segs, words } = cutTimeline(readWords(file)); const kw = opt('keywords') ? opt('keywords').split(',').map((w) => ({ word: w.trim() })) : [];
  out(edit.brollSlots(words, { keywords: kw, coverage: +opt('coverage', 0.45), auto: !flag('no-auto'), seconds: segs.length ? segs.at(-1).f1 / fps : 0 })); }
else if (cmd === 'cursor') { const c = JSON.parse(fs.readFileSync(file, 'utf8')); out(screen.cursorFromClicks(c.clicks || c, { fps, end: opt('end') ? +opt('end') : null })); }
else if (cmd === 'captions') { if (!opt('pick')) out(Object.fromEntries(Object.entries(edit.CAPTION_PICKS).map(([k, v]) => [k, v.why]))); else out(edit.pickCaption(opt('pick'), { aspect: opt('aspect', '9:16'), band: opt('band', 'lower') })); }
else { console.error('usage: node tools/human/human.mjs words|fillers|autocut|punchins|broll|cursor|captions <file> [options]  (see the header of this file)'); process.exit(cmd ? 2 : 0); }
