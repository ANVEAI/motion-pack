/* motion-pack / templates/_explain/honesty.mjs: the honesty gates of the explainer templates (node, pure). Lane explainer, 2026-10-16.
   A data story is only as good as its numbers, so the build REFUSES (make.mjs exits 2 before anything is staged; buildPlan throws HonestyError) when:
     - a dataset has no `source`, or a blank / filler / generic one ("internal data", "n/a": plan.mjs sourceOk), or no `method`, or a method that only repeats the source;
     - a chart has no unit (`unit` or `yLabel`): a number without a unit is not a measurement;
     - a bar or area chart asks for a baseline other than zero (`yMin`): length and area encode magnitude, so they start at zero, always;
     - a line or scatter axis is truncated (`yMin` above zero) without a `truncated` label that says so (the part also draws an axis break; the label is the author's words);
     - a chart, callout, map or hero number points at a dataset, column or row that does not exist, or a value that is not a number;
     - `footer: false` on any chart (the source footer is on every chart frame; there is no switch to hide it).
   Checks the FORM of the evidence, not its truth: a made-up source sentence still passes. The README says so. */
import { sourceOk, normSource } from '../_shared/plan.mjs';
export class HonestyError extends Error { constructor(problems) { super(`honesty gate: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n  - ${problems.join('\n  - ')}`); this.problems = problems; this.code = 2; } }
const blank = (s) => s == null || !String(s).trim();
export function datasetProblems(id, d) {
  const out = []; if (!d) return [`data.${id}: no such dataset`];
  if (blank(d.source)) out.push(`data.${id}: no source. Say where the numbers come from (a publisher + title, a URL, a document), or label it fictional demo data and say so in the source.`);
  else if (!sourceOk(d.source)) out.push(`data.${id}: the source "${d.source}" says nothing (generic or filler). Name the document, measurement or URL.`);
  if (blank(d.method)) out.push(`data.${id}: no method. Say how the numbers were made (what was counted, over what period, how it was rounded).`);
  else if (!sourceOk(d.method) || normSource(d.method) === normSource(d.source)) out.push(`data.${id}: the method "${d.method}" says nothing new (generic, filler or the source again).`);
  for (const p of d.problems || []) out.push(`data.${id}: ${p}`);
  return out;
}
export function chartProblems(key, ch, ds) {
  const out = [], kind = ch.kind || 'bar';
  if (!['bar', 'line', 'area', 'scatter'].includes(kind)) out.push(`${key}: kind "${kind}" is not one of bar, line, area, scatter`);
  if (blank(ch.unit) && blank(ch.yLabel)) out.push(`${key}: no unit. Give \`unit\` (mm, %, loans) or a \`yLabel\` that names it.`);
  if (ch.footer === false) out.push(`${key}: footer: false. The source footer stays on every chart frame.`);
  const yMin = ch.yMin == null || ch.yMin === '' ? null : +ch.yMin;
  if ((kind === 'bar' || kind === 'area') && yMin != null && yMin !== 0) out.push(`${key}: a ${kind} chart starts at zero (yMin ${ch.yMin} refused): a ${kind === 'bar' ? 'bar length' : 'filled area'} that starts elsewhere exaggerates the difference.`);
  if ((kind === 'line' || kind === 'scatter') && yMin != null && yMin > 0 && blank(ch.truncated)) out.push(`${key}: the y axis starts at ${yMin}, not zero, and has no \`truncated\` label. Say it in frame ("Axis starts at ${yMin}") or start at zero.`);
  if (ch.data != null) { const d = ds[ch.data]; if (!d) out.push(`${key}: dataset "${ch.data}" does not exist`); else {
    for (const col of [].concat(ch.x || [], ch.y || [])) if (!d.columns.includes(col)) out.push(`${key}: column "${col}" is not in dataset ${ch.data} (${d.columns.join(', ')})`);
    for (const col of [].concat(ch.y || [])) if (d.columns.includes(col) && d.rows.some((r) => !Number.isFinite(+r[col]) && r[col] !== null && r[col] !== '')) out.push(`${key}: column "${col}" of ${ch.data} has a value that is not a number`); } }
  return out;
}
/* the data-story gate over the whole CONFIG: datasets first, then every block that shows a number */
export function storyProblems(C, ds) {
  const out = []; for (const id of Object.keys(C.data || {})) out.push(...datasetProblems(id, ds[id]));
  for (const [i, b] of (C.beats || []).entries()) { const key = `beats[${i}] (${b.kind})`;
    if (b.kind === 'chart' || b.kind === 'scrolly') out.push(...chartProblems(key + '.chart', b.chart || {}, ds));
    if (b.kind === 'map') { const d = ds[b.data]; if (!d) out.push(`${key}: dataset "${b.data}" does not exist`); else for (const col of [b.id || 'id', b.value || 'value']) if (!d.columns.includes(col)) out.push(`${key}: column "${col}" is not in dataset ${b.data}`); if (blank(b.unit) && blank(b.legendTitle)) out.push(`${key}: no unit for the map values (unit or legendTitle)`); }
    if (b.kind === 'hero') { const d = ds[b.data]; if (!d) out.push(`${key}: dataset "${b.data}" does not exist`); else if (!d.columns.includes(b.column)) out.push(`${key}: column "${b.column}" is not in dataset ${b.data}`); }
    for (const [j, cl] of (b.callouts || []).entries()) if (!Array.isArray(cl.datum)) out.push(`${key}.callouts[${j}]: a callout needs a datum [row index, series index]`); }
  return out;
}
