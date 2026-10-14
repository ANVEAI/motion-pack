/* usage: node type/tests/gfx-sheet.mjs   -> type/demo/out/gfx-<family>.png contact sheets (one tile per gfx id at a hero time) + a smoke test:
   every registered gfx / layout id renders non-empty at its hero time, renders EMPTY before its start, is identical when rendered twice at the
   same t (seek-safe), and the page logs no errors. Also writes type/demo/out/gfx-hero.json (id -> hero t) for the manifest. exit 1 on failure. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { open, ROOT } from '../../layers/tests/harness.mjs';
const HERO = { 'title.countdown321': 1.1, 'title.slate': 0.75, 'caption.oneWordSlam': 1.1, 'social.chatBubbles': 3.4, 'chart.race': 3.2, 'map.route': 2.6, 'reaction.burst': 1.4, 'fx.emotion.heartBurst': 0.6,
  'social.followButton': 1.0, 'counter.priceSlash': 1.2, 'fx.impact.smear': 0.05, 'fx.impact.star': 0.12, 'fx.impact.dustPoof': 0.35, 'fx.impact.speedLines': 0.3, 'lowerThird.newsBar': 1.2, 'callout.pinLeader': 1.0, 'device.laptop': 1.6, 'device.phone': 1.05, 'caption.subtitleSpeedGag': 1.6, 'lowerThird.docSuper': 0.8 };
const LIGHT = new Set(['callout.spotlight', 'layout.pip']);
const PARAMS = { 'sticker.place': [{ name: 'fire' }, { name: 'faceLaugh', motion: 'wiggle' }], 'reaction.place': [{ name: 'love' }], 'layout.splitScreen': [{ mode: 'vertical' }, { mode: 'diagonal' }, { mode: '3up' }, { mode: 'grid' }],
  'layout.cornerPin': [{ w: 1920, h: 1080, corners: [[560, 230], [1390, 300], [1350, 830], [520, 760]] }] };
const fam = (id) => (id.startsWith('lowerThird') ? 'lowerthirds' : id.startsWith('counter') || id.startsWith('title') ? 'counters-titles' : id.startsWith('callout') ? 'callouts' : id.startsWith('fx.') ? 'emotion-impact' : id.startsWith('social') || id.startsWith('device') ? 'social-device' : id.startsWith('caption') ? 'captions' : id.startsWith('chart') || id.startsWith('map') ? 'charts-map' : id.startsWith('layout') ? 'layouts' : 'stickers');
const h = await open('/type/demo/gfx.html'); await h.page.setViewport({ width: 1920, height: 1080 });
const ids = await h.page.evaluate('window.GFX_IDS'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-gfx-')), groups = {}, hero = {}; let fail = 0;
for (const id of ids) for (const params of PARAMS[id] || [{}]) {
  const t = HERO[id] ?? 1.0, light = LIGHT.has(id);
  const on = await h.page.evaluate((i, tt, p, l) => window.show(i, tt, p, 1920, 1080, { light: l }), id, t, params, light);
  const a = await h.page.evaluate(() => document.getElementById('ov').innerHTML + document.getElementById('shots').innerHTML);
  await h.page.evaluate((i, tt, p, l) => window.show(i, tt, p, 1920, 1080, { light: l }), id, t, params, light); const b = await h.page.evaluate(() => document.getElementById('ov').innerHTML + document.getElementById('shots').innerHTML);
  if (!on) { console.log('FAIL empty at hero time', id); fail++; } if (a !== b) { console.log('FAIL not seek-stable', id); fail++; }
  if (!id.startsWith('layout')) { const pre = await h.page.evaluate((i, p) => window.show(i, -0.5, p, 1920, 1080, {}), id, params); if (pre) { console.log('FAIL visible before start', id); fail++; } await h.page.evaluate((i, tt, p, l) => window.show(i, tt, p, 1920, 1080, { light: l }), id, t, params, light); }
  const f = path.join(dir, `${Object.keys(hero).length}-${Math.random().toString(36).slice(2, 6)}.png`); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  (groups[fam(id)] ||= []).push([id + (params.name || params.mode ? ' ' + (params.name || params.mode) : ''), f]); hero[id] = t;
}
const nSt = await h.page.evaluate('window.stickerSheet()'); await h.page.screenshot({ path: path.join(ROOT, 'type/demo/out/gfx-sticker-grid.png'), clip: { x: 0, y: 0, width: 1920, height: 1080 } }); console.log('sticker grid', nSt, 'stickers -> type/demo/out/gfx-sticker-grid.png');
const errs = h.errors.filter((e) => !/favicon|404/.test(e)); if (errs.length) { console.log('page errors:', errs.slice(0, 5)); fail++; } await h.close();
const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 3; tw = 640; th = 360; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 300, y + 18), fill=(0, 0, 0)); d.text((x + 5, y + 3), n, fill=(255, 255, 255))
S.save(sys.argv[1]); print('sheet', sys.argv[1], S.size)`;
for (const [g, files] of Object.entries(groups)) console.log(execFileSync('python3', ['-I', '-c', py, path.join(ROOT, `type/demo/out/gfx-${g}.png`), JSON.stringify(files)]).toString().trim());
fs.writeFileSync(path.join(ROOT, 'type/demo/out/gfx-hero.json'), JSON.stringify(hero, null, 1) + '\n');
console.log(fail ? `FAIL ${fail}` : `gfx: ${ids.length} ids rendered, seek-stable, hidden before start`); process.exit(fail ? 1 : 0);
