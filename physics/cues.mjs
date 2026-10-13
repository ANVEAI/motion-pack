#!/usr/bin/env node
/* physics/cues.mjs: turn a baked table's contact events into motion-pack mixer cues, so every impact you see is also heard.
   usage: node cues.mjs <table.json> [--fps 30] [--map map.json] [--min-gap 3] [--max 40] > cues.json
   Output: {"cues": [{"id", "frame", "tier", "gain_db", "pan", "note"}]}. Paste the cues into a music/mixer.py cue sheet.
   `frame` is the VISUAL frame of the contact, and the mixer puts the anchor sample on frame + 1 (the pack's sync rule).
   Default map: a body whose kind or id contains "card" or "paper" plays snd.paper.flip; a "box", "book" or "block" plays snd.foley.book_thud;
   anything else plays snd.hit.thud. Loudness follows the impact speed (gain 0 dB at >= 3 m/s, down to -18 dB).
   Repeats of the same body within --min-gap frames are dropped. --max keeps hero contacts (lower tier) first, then the loudest. */
import fs from 'node:fs';
import { createTablePlayer } from './table-player.js';

const argv = process.argv.slice(2), flag = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
if (!argv[0] || argv[0].startsWith('--')) { console.error('usage: node cues.mjs <table.json> [--fps 30] [--map map.json] [--min-gap 3] [--max 40]'); process.exit(64); }
const table = JSON.parse(fs.readFileSync(argv[0], 'utf8')), P = createTablePlayer(table);
const FPS = +flag('fps', 30), GAP = +flag('min-gap', 3), MAX = +flag('max', 40);
const MAP = flag('map') ? JSON.parse(fs.readFileSync(flag('map'), 'utf8'))
  : [{ match: ['card', 'paper', 'sheet'], id: 'snd.paper.flip', tier: 3 }, { match: ['box', 'book', 'block'], id: 'snd.foley.book_thud', tier: 2 }, { match: [''], id: 'snd.hit.thud', tier: 3 }];
const kindOf = new Map(table.meta.bodies.map((b) => [b.id, `${b.kind || ''} ${b.id}`.toLowerCase()]));
const pick = (body) => MAP.find((m) => m.match.some((k) => (kindOf.get(body) || String(body).toLowerCase()).includes(k)));
const lastFrame = new Map(), out = [];
for (const [step, a, b, speed] of P.events) {
  const body = kindOf.has(a) ? a : b;                 // the moving body (statics are not in meta.bodies)
  const frame = Math.round(step * P.step * FPS), prev = lastFrame.get(body);
  if (prev !== undefined && frame - prev < GAP) continue;
  lastFrame.set(body, frame);
  const m = pick(body), gain = Math.max(-18, Math.min(0, 20 * Math.log10(Math.max(1e-3, speed) / 3)));
  out.push({ id: m.id, frame, tier: m.tier ?? 3, gain_db: +gain.toFixed(1), pan: 0, note: `${body} contact ${speed.toFixed(2)} m/s` });
}
out.sort((x, y) => x.tier - y.tier || y.gain_db - x.gain_db);   // hero (lower tier) contacts first, then the loudest
const cues = out.slice(0, MAX).sort((x, y) => x.frame - y.frame);
console.log(JSON.stringify({ fps: FPS, source: argv[0], cues }, null, 1));
if (out.length > MAX) console.error(`kept the ${MAX} loudest of ${out.length} contacts (--max)`);
