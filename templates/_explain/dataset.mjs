/* motion-pack / templates/_explain/dataset.mjs: a sourced dataset for a data story (node). Lane explainer, 2026-10-16.
     loadDataset(dir, spec)  spec = { file: 'data/x.csv' | 'data/x.json' | null, rows: [...] | null, source, method, unit, demo, url, licence }
                             -> { id, columns, rows: [{ col: value }], source, method, unit, demo, url, file, problems }
       CSV: the first line is the header; quoted fields ("a, b"), doubled quotes and CRLF work; a column whose every non-empty cell is a number becomes numbers.
       JSON: an array of row objects, or { source, method, unit, demo, rows | data } (the spec's own source / method win over the file's, so a project can override them).
     parseCSV(text) -> { columns, rows }
     aggregate(ds, column, how) how = 'sum' | 'mean' | 'max' | 'min' | 'last' | 'first' | a row index
   Never fetches anything: the data is a file in your project. A public-domain or CC0 table is downloaded by you, with its URL and checksum in the dataset's `url` / `method`. */
import fs from 'node:fs'; import path from 'node:path';
export function parseCSV(text) {
  const rows = [], s = String(text ?? '').replace(/^\ufeff/, ''); let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; } else cur += ch; }
  row.push(cur); if (row.some((c) => c.trim() !== '')) rows.push(row);
  if (!rows.length) return { columns: [], rows: [] };
  const columns = rows[0].map((c) => c.trim()), body = rows.slice(1).map((r) => Object.fromEntries(columns.map((c, j) => [c, (r[j] ?? '').trim()])));
  for (const c of columns) { const cells = body.map((r) => r[c]).filter((v) => v !== ''); if (cells.length && cells.every((v) => /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(v))) for (const r of body) r[c] = r[c] === '' ? null : +r[c]; }
  return { columns, rows: body };
}
export function loadDataset(dir, spec = {}, id = 'data') {
  let meta = {}, table = { columns: [], rows: [] }; const problems = [];
  if (spec.file) { const f = path.isAbsolute(spec.file) ? spec.file : path.resolve(dir, spec.file);
    if (!fs.existsSync(f)) problems.push(`file not found: ${f}`);
    else if (/\.csv$/i.test(f)) table = parseCSV(fs.readFileSync(f, 'utf8'));
    else { const j = JSON.parse(fs.readFileSync(f, 'utf8')), rows = Array.isArray(j) ? j : j.rows || j.data || []; meta = Array.isArray(j) ? {} : j; table = { columns: [...new Set(rows.flatMap((r) => Object.keys(r)))], rows }; } }
  else if (Array.isArray(spec.rows)) table = { columns: [...new Set(spec.rows.flatMap((r) => Object.keys(r)))], rows: spec.rows };
  else problems.push('no file and no rows');
  const pick = (k) => (spec[k] != null && String(spec[k]).trim() !== '' ? spec[k] : meta[k] ?? null);
  return { id, columns: table.columns, rows: table.rows, source: pick('source'), method: pick('method'), unit: pick('unit'), demo: pick('demo') !== false, url: pick('url'), licence: pick('licence') ?? pick('license'), file: spec.file || null, problems };
}
export const col = (ds, c) => ds.rows.map((r) => r[c]);
export function aggregate(ds, c, how = 'sum') {
  const v = col(ds, c).map(Number).filter(Number.isFinite); if (!v.length) return NaN;
  if (typeof how === 'number') return +ds.rows[Math.max(0, Math.min(ds.rows.length - 1, how))][c];
  return { sum: () => v.reduce((a, b) => a + b, 0), mean: () => v.reduce((a, b) => a + b, 0) / v.length, max: () => Math.max(...v), min: () => Math.min(...v), last: () => v.at(-1), first: () => v[0] }[how]?.() ?? NaN;
}
