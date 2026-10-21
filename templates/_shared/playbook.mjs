/* motion-pack / templates/_shared/playbook.mjs: a template follows its format's sound shape (the playbook defaults `mp plan` wrote into project.json "playbook").
     applyPlaybook(plan, pb) -> plan (the same object, changed in place; PURE: no clock, no random, no I/O)
   cues.mjs runs it on every genre template's plan right after buildPlan, before the lint gate, so the mix (audio.py -> music/mixer.py) and the checks read the result.
   With no "playbook" block in the project nothing changes, byte for byte (every committed out/plan.json stays current).

   pb (all optional; seconds, or fractions of the runtime):
     quiet_open  {s, db} | false         the first s seconds sit db under the body: bed automation at db, a planned audio.quiet kind open, cues in it kept as quiet ticks;
                                         false: sound from frame 0 (a template's own planned open is removed and a frame-0 sound added when it has none)
     bass_entry_pct, bass_entry_beat     the bass enters on the template's shot of that beat (or turn / reveal / drop), else at the fraction: the bed sits 5 dB down from the
                                         quiet open to there, then steps up with a sub hit (sfx/hit/sub_drop)
     name_silence {s, db, beat, at_pct}  silence under the name: the bed dips to db (-50) for s seconds on the template's name / reveal / title shot (else at_pct), its cues dropped
     tail, tail_db                       quiet-hold or decay: the bed falls to tail_db over the last shot, with a planned audio.quiet kind hold
     end_hold_s                          the end card holds (shots[-1].hold); a template too short for it is recorded, not stretched
     first_sound_frame_max               without a quiet open, a sound lands on frames 0..N (a soft swish when the template has none)
   Every change is listed in plan.playbook.applied, so a reviewer (and mp lint) can see what the format put in. */

const NAME_RX = /^(name|reveal|title|logo|lockup|brand|wordmark)/, BASS_RX = /^(turn|reveal|drop|pivot|product)/;
const r3 = (x) => +(+x).toFixed(3);
function label(s) {   // the section label of a shot, as tools/structure_check.py reads it
  if (typeof s.sec === 'string' && s.sec) return s.sec.toLowerCase();
  if (typeof s.beat === 'string' && s.beat) return s.beat.toLowerCase();
  let id = String(s.id || 'shot').toLowerCase().replace(/[-_][a-z0-9]{1,2}$/, ''); const m = /^([a-z][a-z_-]{2,}?)\d+[a-z]?$/.exec(id); return m ? m[1] : id;
}
/* piecewise-linear dB curves [{frame, gain_db}] -> one curve: the lower (more attenuated) of the two at every breakpoint of either */
export function mergeAutomation(a, b) {
  if (!a || !a.length) return b || []; if (!b || !b.length) return a;
  const at = (pts, f) => { const p = [...pts].sort((x, y) => x.frame - y.frame); if (f <= p[0].frame) return p[0].gain_db; if (f >= p.at(-1).frame) return p.at(-1).gain_db;
    for (let i = 1; i < p.length; i++) if (f <= p[i].frame) { const u = (f - p[i - 1].frame) / Math.max(1e-9, p[i].frame - p[i - 1].frame); return p[i - 1].gain_db + u * (p[i].gain_db - p[i - 1].gain_db); } return p.at(-1).gain_db; };
  const fs = [...new Set([...a, ...b].map((p) => +p.frame))].sort((x, y) => x - y);
  return fs.map((f) => ({ frame: r3(f), gain_db: r3(Math.min(at(a, f), at(b, f))) }));
}

export function applyPlaybook(plan, pb) {
  if (!pb || typeof pb !== 'object') return plan;
  const fps = plan.fps || 30, T = plan.seconds, shots = plan.shots || [], F = (t) => r3(t * fps), applied = [], removed = [];
  plan.audio = plan.audio && typeof plan.audio === 'object' ? plan.audio : { mode: 'music' }; plan.audio.quiet = [...(plan.audio.quiet || [])];
  plan.cues = [...(plan.cues || [])];
  const find = (beat, rx) => shots.find((s) => beat && label(s) === beat) || shots.find((s) => rx.test(label(s)));
  const curves = [], one = 1 / fps;   // each effect is its own dB curve; they are merged by taking the lower at every breakpoint (mergeAutomation)
  /* quiet open (false: the format wants sound from frame 0, so a template's own planned open is taken out) */
  let q1 = 0;
  if (pb.quiet_open === false && plan.audio.quiet.some((x) => x.kind === 'open')) {
    const q = Math.max(...plan.audio.quiet.filter((x) => x.kind === 'open').map((x) => x.t[1]));
    plan.audio.quiet = plan.audio.quiet.filter((x) => x.kind !== 'open');
    if (plan.bedAutomation && plan.bedAutomation.length) plan.bedAutomation = [{ frame: 0, gain_db: 0 }, ...plan.bedAutomation.filter((p) => p.frame >= F(q + 0.6))];   // the bed's own open dip (and its ramp) goes too
    applied.push("the template's quiet open taken out (its bed dip too): the format wants sound from frame 0");
  }
  const ownOpen = plan.audio.quiet.find((x) => x.kind === 'open' && x.t[0] <= 0.05);
  if (ownOpen && !(pb.quiet_open && pb.quiet_open.s > 0)) q1 = ownOpen.t[1];   // the template's own planned open counts as the open
  if (pb.quiet_open && pb.quiet_open.s > 0) {
    const db = pb.quiet_open.db ?? -9; q1 = Math.min(pb.quiet_open.s, T / 4);
    plan.audio.quiet.push({ t: [0, r3(q1)], kind: 'open', db, why: `playbook ${pb.format || ''}: open ${-db} dB under the body` });
    curves.push([{ frame: 0, gain_db: db }, { frame: F(Math.max(one, q1 - 0.25)), gain_db: db }, { frame: F(q1), gain_db: 0 }]);
    let n = 0; for (const c of plan.cues) if (c.t < q1 - 1e-6 && !c.loopTo) { c.overBedDb = Math.min(c.overBedDb ?? db - 3, db - 3); n++; }   // ticks under the dipped bed, so the open measures at its depth
    plan.audio.first_hit_s = r3(q1); applied.push(`quiet open 0-${r3(q1)} s at ${db} dB (${n} cue${n === 1 ? '' : 's'} kept as quiet ticks)`);
  }
  /* bass entry */
  let bassShot = null, tb = null;
  if (pb.bass_entry_pct != null || pb.bass_entry_beat) {
    bassShot = find(pb.bass_entry_beat, BASS_RX); tb = bassShot && bassShot.start > q1 ? bassShot.start : Math.max(q1, (pb.bass_entry_pct ?? 0.3) * T);
    if (tb > q1 + 0.2) curves.push([{ frame: F(q1), gain_db: -5 }, { frame: F(tb - 2 * one), gain_db: -5 }, { frame: F(tb), gain_db: 0 }]);
    plan.cues.push({ t: r3(tb), id: 'sfx/hit/sub_drop', why: 'playbook: the bass enters' }); plan.audio.bass_entry_s = r3(tb);
    applied.push(`bass enters at ${r3(tb)} s${bassShot ? ` (the ${label(bassShot)} shot)` : ''}, a sub hit on it`);
  }
  /* silence under the name (when the name and the bass land on the same shot, the silence is the vacuum just before it: the name lands with the bass) */
  if (pb.name_silence && pb.name_silence.s > 0) {
    /* the name lands on the template's name-like shot (name / reveal / title / logo / lockup) or its end card, whichever starts nearest the format's at_pct */
    const want = (pb.name_silence.at_pct ?? 0.85) * T, cands = shots.filter((x) => (pb.name_silence.beat && label(x) === pb.name_silence.beat) || NAME_RX.test(label(x)) || x === shots.at(-1));
    const s = cands.length ? cands.reduce((m, x) => (Math.abs(x.start - want) < Math.abs(m.start - want) ? x : m)) : null;
    const db = pb.name_silence.db ?? -50, at = s ? s.start : want, before = tb != null && Math.abs(at - tb) < 0.05;
    const a = before ? Math.max(q1, at - pb.name_silence.s) : at, b = before ? at - one : Math.min(T - 0.2, at + pb.name_silence.s);
    curves.push([{ frame: F(Math.max(0, a - 0.04)), gain_db: 0 }, { frame: F(a), gain_db: db }, { frame: F(b), gain_db: db }, { frame: F(Math.min(T, b + (before ? one : 0.1))), gain_db: 0 }]);
    plan.cues = plan.cues.filter((c) => { const inside = c.t >= a - 1e-6 && c.t < b - 1e-6 && c.id !== 'sfx/hit/sub_drop'; if (inside) removed.push(c.id); return !inside; });
    plan.audio.quiet.push({ t: [r3(a), r3(b)], kind: 'gap', role: 'name', why: `playbook: ${r3(b - a)} s of silence ${before ? 'before the name lands on the bass' : 'under the name'}` });
    applied.push(`silence ${before ? 'before' : 'under'} the name ${r3(a)}-${r3(b)} s at ${db} dB${s ? ` (the ${label(s)} shot)` : ''}${removed.length ? `, ${removed.length} cue(s) dropped` : ''}`);
  }
  /* tail */
  const last = shots.at(-1);
  if (last && (pb.tail === 'decay' || pb.tail === 'quiet-hold')) {
    const db = pb.tail_db ?? (pb.tail === 'decay' ? -26 : -30), a = Math.max(last.start, T - 4);
    curves.push([{ frame: F(a), gain_db: 0 }, { frame: F(Math.max(a + one, T - 0.3)), gain_db: db }]);
    if (!plan.audio.quiet.some((x) => x.kind === 'hold' && x.t[1] >= T - 0.05)) plan.audio.quiet.push({ t: [r3(a), r3(T)], kind: 'hold', why: `playbook: the end card on a ${pb.tail === 'decay' ? 'decaying' : 'quiet'} hold` });
    plan.audio.tail = pb.tail; applied.push(`${pb.tail} tail from ${r3(a)} s to ${db} dB`);
  }
  /* first sound by frame N (no quiet open) */
  if (!q1 && pb.first_sound_frame_max != null && !plan.cues.some((c) => c.t <= pb.first_sound_frame_max / fps + 1e-6)) {
    plan.cues.push({ t: 0, id: 'sfx/whoosh/swish_xs', why: 'playbook: a sound on frame 0' }); applied.push('a soft swish on frame 0 (first sound by frame ' + pb.first_sound_frame_max + ')');
  }
  /* end-card hold */
  if (last && pb.end_hold_s) { last.hold = true; applied.push(last.dur + 1e-6 >= pb.end_hold_s ? `end card holds ${r3(last.dur)} s (>= ${pb.end_hold_s})` : `end card holds ${r3(last.dur)} s, under the format's ${pb.end_hold_s} s: the template's last shot is shorter`); }
  if (curves.length) plan.bedAutomation = curves.reduce((acc, c) => mergeAutomation(acc, c), plan.bedAutomation && plan.bedAutomation.length ? plan.bedAutomation : [{ frame: 0, gain_db: 0 }]);
  plan.cues.sort((x, y) => x.t - y.t);
  plan.playbook = { ...(plan.playbook || {}), format: pb.format || null, ...(pb.style ? { style: pb.style } : {}), source: 'project.playbook', applied, cuesDropped: removed };   // style: mp lint runs that style's checks on the render
  return plan;
}
