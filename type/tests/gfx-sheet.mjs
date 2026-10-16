/* usage: node type/tests/gfx-sheet.mjs   -> type/demo/out/gfx-<family>.png contact sheets (one tile per gfx id at a hero time) + a smoke test:
   every registered gfx / layout id renders non-empty at its hero time, renders EMPTY before its start, is identical when rendered twice at the
   same t (seek-safe), and the page logs no errors. Also writes type/demo/out/gfx-hero.json (id -> hero t) for the manifest. exit 1 on failure. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { open, ROOT, pageErrors } from '../../layers/tests/harness.mjs';
const HERO = { 'title.countdown321': 1.1, 'title.slate': 0.75, 'caption.oneWordSlam': 1.1, 'social.chatBubbles': 3.4, 'chart.race': 3.2, 'map.route': 2.6, 'reaction.burst': 1.4, 'fx.emotion.heartBurst': 0.6,
  'social.followButton': 1.0, 'counter.priceSlash': 1.2, 'fx.impact.smear': 0.05, 'fx.impact.star': 0.12, 'fx.impact.dustPoof': 0.35, 'fx.impact.speedLines': 0.3, 'lowerThird.newsBar': 1.2, 'callout.pinLeader': 1.0, 'device.laptop': 1.6, 'device.phone': 1.05,
  'ui.agentActivity': 1.75, 'ui.promptBar': 1.95, 'ui.checklist': 1.75, 'ui.nodeGraph': 2.9, 'ui.scanOverlay': 1.1, 'ui.isometricTilt': 1.4, 'ui.stateMorph': 6.1,
  'ui.liveTranscript': 4.9, 'ui.wordRegenerate': 3.1, 'ui.receiptCompare': 2.9, 'ui.failoverRoute': 2.75, 'ui.fileChip': 1.5, 'ui.pageFlythrough': 2.3, 'ui.tabPillNav': 2.1, 'ui.windowWall': 2.6, 'ui.optionPicker': 2.2,
  'type.wordWheel': 1.9, 'type.inlineMedia': 2.4, 'type.letterAssemble': 0.9, 'type.glyphMorphCursor': 2.9, 'type.marquee': 1.0, 'type.bleedWord': 1.0, 'layout.scatterCollage': 2.6, 'layout.mosaicBurst': 1.6, 'layout.logoWall': 1.6, 'layout.orbitRing': 2.0, 'callout.connectorLabel': 2.0,
  'caption.subtitleSpeedGag': 1.6, 'lowerThird.docSuper': 0.8,
  'type.accentSwap': 1.6, 'type.wordSplitMedia': 1.2, 'type.imageFill': 1.4, 'type.strikeOut': 1.9, 'type.glowWord': 1.4, 'type.ledDigits': 1.0, 'callout.selectionBox': 1.25, 'counter.scoreIterate': 2.0,
  'counter.stepPill': 2.4, 'caption.speakerTag': 0.9, 'title.timeCard': 0.7, 'layout.paletteColumns': 1.2, 'layout.logoConstruction': 1.5, 'layout.mockupInContext': 1.5, 'layout.typeSpecimen': 1.4, 'layout.backdropSwap': 0.6, 'layout.lineup': 1.6,
  'chart.scatterFrontier': 4.0, 'ui.branchTrace': 4.6, 'ui.dataTable': 3.0, 'caption.sceneBubble': 3.2, 'ui.costTicker': 2.2, 'type.paramReadout': 1.3, 'lowerThird.personalTag': 1.2, 'ui.promptBar.attach': 0.85,
  'title.partnerLockup': 1.5, 'layout.iconMergeLockup': 1.75, 'type.asciiMosaic': 2.9, 'type.textOnPath': 1.4, 'type.flankWords': 1.0, 'type.electricOutline': 1.2, 'type.behindSubject': 1.0,
  'chart.hoverTooltip': 3.6, 'ui.dockLaunch': 2.6, 'title.verbCard': 1.2, 'ui.connectRows': 3.7, 'layout.degradingDiagram': 4.5, 'type.commandPill': 2.0,
  'caption.soundOnPill': 1.0, 'ui.stateChip': 2.0 };
/* round-3 parts get their own two sheets (gfx-r3type, gfx-r3layout); round 4+5: proof parts get gfx-r45ui, lockup/glyph/matte parts get gfx-r45type */
const R45 = new Set(['chart.scatterFrontier', 'ui.branchTrace', 'ui.dataTable', 'caption.sceneBubble', 'ui.costTicker', 'type.paramReadout', 'lowerThird.personalTag', 'ui.promptBar.attach']);
const R45T = new Set(['title.partnerLockup', 'layout.iconMergeLockup', 'type.asciiMosaic', 'type.textOnPath', 'type.flankWords', 'type.electricOutline', 'type.behindSubject']);
/* round 6 (r6.js): one sheet, gfx-r6 */
const R6 = new Set(['chart.hoverTooltip', 'ui.dockLaunch', 'title.verbCard', 'ui.connectRows', 'layout.degradingDiagram', 'type.commandPill']);
const R3T = new Set(['type.accentSwap', 'type.wordSplitMedia', 'type.imageFill', 'type.strikeOut', 'type.glowWord', 'type.ledDigits', 'callout.selectionBox', 'counter.scoreIterate', 'counter.stepPill', 'caption.speakerTag', 'title.timeCard']),
  R3L = new Set(['layout.paletteColumns', 'layout.logoConstruction', 'layout.mockupInContext', 'layout.typeSpecimen', 'layout.backdropSwap', 'layout.lineup']);
const LIGHT = new Set(['callout.spotlight', 'layout.pip', 'ui.agentActivity', 'ui.promptBar', 'ui.checklist', 'ui.nodeGraph', 'ui.isometricTilt', 'ui.stateMorph', 'ui.wordRegenerate', 'ui.receiptCompare', 'ui.fileChip', 'ui.tabPillNav', 'ui.windowWall', 'ui.optionPicker', 'ui.branchTrace', 'ui.promptBar.attach']), PAPER = new Set(['type.wordWheel', 'type.inlineMedia', 'type.glyphMorphCursor', 'type.bleedWord', 'layout.scatterCollage', 'layout.mosaicBurst', 'layout.logoWall', 'layout.orbitRing', 'callout.connectorLabel',
  'type.accentSwap', 'type.wordSplitMedia', 'type.imageFill', 'type.strikeOut', 'callout.selectionBox', 'counter.scoreIterate', 'counter.stepPill', 'layout.paletteColumns', 'layout.typeSpecimen', 'layout.lineup', 'title.partnerLockup', 'layout.iconMergeLockup', 'type.flankWords', 'type.textOnPath']);
const PARAMS = { 'sticker.place': [{ name: 'fire' }, { name: 'faceLaugh', motion: 'wiggle' }], 'reaction.place': [{ name: 'love' }], 'layout.splitScreen': [{ mode: 'vertical' }, { mode: 'diagonal' }, { mode: '3up' }, { mode: 'grid' }],
  'ui.agentActivity': [{ card: { box: [0.54, 0.24, 0.38, 0.52], title: 'Sources', source: 'illustrative data', points: [[0.3, 0.42], [0.55, 0.3], [0.7, 0.58], [0.42, 0.66]], counters: [{ label: 'notes read', to: 128 }, { label: 'suppliers', to: 9 }] } }],
  'ui.isometricTilt': [{}, { inner: { id: 'ui.checklist', params: {} } }], 'ui.optionPicker': [{}, { mode: 'chips' }], 'ui.pageFlythrough': [{}, { bg: '#E9E6F2' }],
  'layout.cornerPin': [{ w: 1920, h: 1080, corners: [[560, 230], [1390, 300], [1350, 830], [520, 760]] }],
  'type.ledDigits': [{}, { text: 'LIVE', cell: 'square', lit: '#FF3B30' }], 'type.strikeOut': [{}, { items: [{ mark: 0 }, { mark: 2 }, { mark: 5 }], layout: 'row', style: 'x', size: 80 }],
  'callout.selectionBox': [{}, { bezier: true, texts: [[0.6, 'take minutes']] }], 'counter.scoreIterate': [{}, { theme: 'dark' }],
  'layout.mockupInContext': [{}, { scene: 'stage', inner: { id: 'type.glowWord', params: { text: 'Keynote' } } }, { scene: 'crt', inner: { id: 'type.ledDigits', params: { text: '42' } } }],
  'layout.lineup': [{}, { shape: 'bottle' }],
  'ui.branchTrace': [{}, { run: [] }], 'ui.dataTable': [{}, { bars: { row: 0, title: 'Calls handled per week' } }], 'ui.costTicker': [{}, { mode: 'zero' }], 'caption.sceneBubble': [{}, { ai: true, speaker: 'Assistant' }],
  'title.partnerLockup': [{}, { divider: 'rule', marks: ['tri', 'pill'], balance: 'height', style: 'rule' }], 'type.flankWords': [{ drawSubject: true }], 'type.asciiMosaic': [{}, { image: 'orb', mode: 'ramp' }], 'type.textOnPath': [{ showPath: true }, { mode: 'reveal', path: 'wave', showPath: true }], 'type.electricOutline': [{}, { text: 'NEW', size: 220, at: [0.5, 0.5], cell: 'word' }], 'type.behindSubject': [{}, { mode: 'marquee', text: 'NEW NAME', theme: 'marquee' }],
  'chart.hoverTooltip': [{}, { target: 'line', tag: 'line', chart: { label: 'Illustrative weekly series' } }], 'ui.dockLaunch': [{}, { tag: 'expanded', clickAt: 1.6 }], 'title.verbCard': [{}, { tag: 'settled', settleAt: 0.3 }],
  'layout.degradingDiagram': [{}, { tag: 'value', beats: [{ at: 0, layout: 'row4', mood: 'tidy', links: 'line', marks: [1, 1, -1, 1], caption: 'Every part checked' }] }] };
const fam = (id) => (/^(diagram\.|process\.|chart\.story|chart\.sourceFooter|callout\.datum|map\.hexTile|counter\.hero|layout\.scrolly|title\.takeaway)/.test(id) ? 'explain' : R6.has(id) ? 'r6' : R45T.has(id) ? 'r45type' : R45.has(id) ? 'r45ui' : R3T.has(id) ? 'r3type' : R3L.has(id) ? 'r3layout' : id.startsWith('type.') ? 'kinetic' : /^layout\.(scatterCollage|mosaicBurst|logoWall|orbitRing)$|^callout\.connectorLabel$/.test(id) ? 'collage' : id.startsWith('lowerThird') ? 'lowerthirds' : id.startsWith('counter') || id.startsWith('title') ? 'counters-titles' : id.startsWith('callout') ? 'callouts' : id.startsWith('fx.') ? 'emotion-impact' : id.startsWith('social') || id.startsWith('device') ? 'social-device' : id.startsWith('caption') ? 'captions' : id.startsWith('chart') || id.startsWith('map') ? 'charts-map' : id.startsWith('layout') ? 'layouts' : /^ui\.(liveTranscript|wordRegenerate|receiptCompare|failoverRoute|fileChip|pageFlythrough|tabPillNav|windowWall|optionPicker)$/.test(id) ? 'ui-r3' : id.startsWith('ui.') ? 'ui' : 'stickers');
const h = await open('/type/demo/gfx.html'); await h.page.setViewport({ width: 1920, height: 1080 });
const ids = await h.page.evaluate('window.GFX_IDS'), shotLayouts = await h.page.evaluate('window.SHOT_LAYOUTS'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-gfx-')), groups = {}, hero = {}; let fail = 0;
for (const id of ids) for (const params of PARAMS[id] || [{}]) {
  const t = HERO[id] ?? 1.0, light = PAPER.has(id) ? 'paper' : LIGHT.has(id);
  const on = await h.page.evaluate((i, tt, p, l) => window.show(i, tt, p, 1920, 1080, { light: l }), id, t, params, light);
  const a = await h.page.evaluate(() => document.getElementById('ov').innerHTML + document.getElementById('shots').innerHTML);
  await h.page.evaluate((i, tt, p, l) => window.show(i, tt, p, 1920, 1080, { light: l }), id, t, params, light); const b = await h.page.evaluate(() => document.getElementById('ov').innerHTML + document.getElementById('shots').innerHTML);
  if (!on) { console.log('FAIL empty at hero time', id); fail++; } if (a !== b) { console.log('FAIL not seek-stable', id); fail++; }
  if (!shotLayouts.includes(id)) { const pre = await h.page.evaluate((i, p) => window.show(i, -0.5, p, 1920, 1080, {}), id, params); if (pre) { console.log('FAIL visible before start', id); fail++; } await h.page.evaluate((i, tt, p, l) => window.show(i, tt, p, 1920, 1080, { light: l }), id, t, params, light); }
  const f = path.join(dir, `${Object.keys(hero).length}-${Math.random().toString(36).slice(2, 6)}.png`); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  (groups[fam(id)] ||= []).push([id + (params.name || params.mode ? ' ' + (params.name || params.mode) : params.inner ? ' + ' + params.inner.id : params.scene ? ' ' + params.scene : params.shape ? ' ' + params.shape : params.style ? ' ' + params.style : params.theme ? ' ' + params.theme : params.tag ? ' ' + params.tag : params.texts ? ' resize' : params.cell ? ' ' + params.cell : params.card ? ' + card' : params.bg ? ' + bg' : params.run ? ' run ' + (params.run.length ? 'fail' : 'pass') : params.bars ? ' + bars' : params.ai ? ' ai voice' : ''), f]); hero[id] = t;
}
const nSt = await h.page.evaluate('window.stickerSheet()'); await h.page.screenshot({ path: path.join(ROOT, 'type/demo/out/gfx-sticker-grid.png'), clip: { x: 0, y: 0, width: 1920, height: 1080 } }); console.log('sticker grid', nSt, 'stickers -> type/demo/out/gfx-sticker-grid.png');
const errs = pageErrors(h.errors); if (errs.length) { console.log('page errors:', errs.slice(0, 5)); fail++; } await h.close();
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
