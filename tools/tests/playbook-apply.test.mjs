/* templates/_shared/playbook.mjs: a template follows its format's sound shape (the project.json "playbook" block mp plan writes). Node only, no browser (CI runs this):
     node tools/tests/playbook-apply.test.mjs
   No block: the plan is untouched (same JSON). With the block, through the template's OWN path (project.mjs resolve -> buildPlan -> applyPlaybook -> the lint gate), for
   saas-launch (launch-film at 35 s), proof-film (proof-clip, the 'clip' cut) and explainer-diagram (explainer): the quiet open is planned and the bed sits at its depth with the cues
   in it kept quiet; the bass enters on the template's reveal (sub hit, the bed 5 dB down before it); the silence under the name lands on the end card near the format's
   at_pct with its cues dropped; the tail decays to its dB; every change is listed in plan.playbook.applied; the result is pure (same JSON twice) and passes the lint gate;
   mergeAutomation keeps the lower curve at every breakpoint. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { applyPlaybook, mergeAutomation } = await imp('templates/_shared/playbook.mjs'), P = await imp('templates/_shared/project.mjs'), { lintPlan } = await imp('templates/_shared/compose.mjs');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info ? '  | ' + info : ''}`); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-pb-apply-'));
async function build(tpl, project) {
  const f = path.join(tmp, tpl + '.json'); fs.writeFileSync(f, JSON.stringify(project));
  const dir = path.join(ROOT, 'templates', tpl), { C } = await P.resolve(dir, { project: f, aspect: '16:9', sets: [] }), { buildPlan } = await import(pathToFileURL(path.join(dir, 'config.mjs')).href);
  return () => applyPlaybook(buildPlan(structuredClone(C)), project.playbook);
}
const gain = (pts, f) => { const p = [...pts].sort((a, b) => a.frame - b.frame); if (f <= p[0].frame) return p[0].gain_db; if (f >= p.at(-1).frame) return p.at(-1).gain_db; for (let i = 1; i < p.length; i++) if (f <= p[i].frame) return p[i - 1].gain_db + (f - p[i - 1].frame) / (p[i].frame - p[i - 1].frame) * (p[i].gain_db - p[i - 1].gain_db); };

/* no block: untouched */
{ const { CONFIG, buildPlan } = await imp('templates/saas-launch/config.mjs'), a = buildPlan(structuredClone(CONFIG)), b = applyPlaybook(buildPlan(structuredClone(CONFIG)), undefined);
  check('no playbook block: the plan is untouched', JSON.stringify(a) === JSON.stringify(b)); }

/* launch-film on saas-launch at 35 s */
const LF = { format: 'launch-film', length: 35, quiet_open: { s: 1.5, db: -9 }, bass_entry_pct: 0.25, bass_entry_beat: 'turn', name_silence: { s: 1.25, db: -50, beat: 'name', at_pct: 0.85 }, tail: 'decay', tail_db: -25, end_hold_s: 1.8, first_sound_frame_max: 3 };
{ const mk = await build('saas-launch', { version: 1, template: 'saas-launch', aspects: ['16:9'], length: 35, playbook: LF }), p = mk(), p2 = mk(), A = p.audio, fps = p.fps;
  check('launch-film/saas-launch: the template builds the format length (35 s)', p.seconds === 35, String(p.seconds));
  check('... pure (same JSON twice) and through the lint gate', JSON.stringify(p) === JSON.stringify(p2) && !lintPlan(p, false).length);
  const open = A.quiet.find((q) => q.kind === 'open'), name = A.quiet.find((q) => q.role === 'name'), end = p.shots.at(-1), rev = p.shots.find((s) => s.id === 'reveal');
  check('... quiet open planned 0-1.5 s at -9 dB, the bed there at -9 dB', open && open.t[1] === 1.5 && open.db === -9 && gain(p.bedAutomation, 15) === -9);
  check('... cues inside the quiet open kept as quiet ticks (overBedDb <= -6)', p.cues.filter((c) => c.t < 1.5).every((c) => c.overBedDb <= -6) && p.cues.some((c) => c.t < 1.5));
  check('... bass enters on the reveal (24% of the runtime) with a sub hit; the bed 5 dB down before it', A.bass_entry_s === rev.start && p.cues.some((c) => c.id === 'sfx/hit/sub_drop' && c.t === rev.start) && gain(p.bedAutomation, Math.round(5 * fps)) === -5 && gain(p.bedAutomation, Math.round(rev.start * fps) + 1) === 0, `${A.bass_entry_s}`);
  check('... the bass lands inside the format window 23-35%', A.bass_entry_s / p.seconds >= 0.23 && A.bass_entry_s / p.seconds <= 0.35, String(A.bass_entry_s / p.seconds));
  check('... silence under the name on the end card (85-89%), -50 dB, its cues dropped', name && name.t[0] === end.start && name.t[0] / p.seconds >= 0.85 && name.t[0] / p.seconds <= 0.891 && gain(p.bedAutomation, Math.round((end.start + 0.6) * fps)) === -50 && !p.cues.some((c) => c.t >= name.t[0] && c.t < name.t[1]), JSON.stringify(name));
  check('... decay tail: the bed at or under -25 dB by the last 0.3 s, a planned hold to the end', gain(p.bedAutomation, Math.round((p.seconds - 0.2) * fps)) <= -25 && A.quiet.some((q) => q.kind === 'hold' && q.t[1] >= p.seconds - 0.05));
  check('... every change listed in plan.playbook.applied', p.playbook.format === 'launch-film' && p.playbook.applied.length === 5, p.playbook.applied.join(' | ')); }

/* proof-clip on proof-film: the clip cut */
{ const mk = await build('proof-film', { version: 1, template: 'proof-film', aspects: ['16:9'], length: 15, playbook: { format: 'proof-clip', length: 16.5, quiet_open: false, tail: 'slam', end_hold_s: 1.8, first_sound_frame_max: 3 } }), p = mk();
  check('proof-clip/proof-film: length 15 builds the clip cut (13-20 s: claim, builder, numbers, end)', p.seconds >= 13 && p.seconds <= 20 && p.shots.map((s) => s.id).join() === 'claim,builder,numbers,end', `${p.seconds} ${p.shots.map((s) => s.id)}`);
  check('... quiet_open false: the template\'s own quiet open is taken out and a sound lands on frame 0', !p.audio.quiet.some((q) => q.kind === 'open') && p.cues.some((c) => c.t <= 0.1) && !lintPlan(p, false).length, JSON.stringify(p.audio.quiet)); }
{ const mk = await build('proof-film', { version: 1, template: 'proof-film', aspects: ['16:9'], length: 15, playbook: { format: 'x', first_sound_frame_max: 3 } }), p = mk();
  check('... with no quiet_open given, the template\'s own planned open counts (no frame-0 swish added)', p.audio.quiet.some((q) => q.kind === 'open') && !p.cues.some((c) => c.why === 'playbook: a sound on frame 0')); }

/* explainer on explainer-diagram */
{ const mk = await build('explainer-diagram', { version: 1, template: 'explainer-diagram', aspects: ['16:9'], playbook: { format: 'explainer', length: 60, quiet_open: { s: 1.5, db: -9 }, tail: 'quiet-hold', tail_db: -30, end_hold_s: 2, first_sound_frame_max: 3 } }), p = mk();
  check('explainer/explainer-diagram: quiet open and a quiet-hold tail planned, bed down at both ends', p.audio.quiet.some((q) => q.kind === 'open') && p.audio.tail === 'quiet-hold' && gain(p.bedAutomation, 10) === -9 && gain(p.bedAutomation, Math.round((p.seconds - 0.1) * 30)) <= -30);
  check('... no bass or name effects when the format has none', p.audio.bass_entry_s == null && !p.audio.quiet.some((q) => q.role === 'name') && !lintPlan(p, false).length); }

/* mergeAutomation */
{ const m = mergeAutomation([{ frame: 0, gain_db: 0 }, { frame: 100, gain_db: -40 }], [{ frame: 50, gain_db: -50 }, { frame: 60, gain_db: 0 }]);
  check('mergeAutomation keeps the lower curve at every breakpoint', gain(m, 50) === -50 && gain(m, 0) === -50 && gain(m, 100) === -40 && gain(m, 60) === -24, JSON.stringify(m)); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
