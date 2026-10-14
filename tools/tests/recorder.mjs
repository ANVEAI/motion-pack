/* a recording Canvas2D context for node (no browser): every call and property set is logged as text, so a draw can be compared, hashed and counted.
   `budget` (calls) makes a runaway draw stop early with an error instead of building an unbounded log: the fuzz and cross-process gates use it. Shared by tools/tests/*.mjs. */
export function recorder(budget = Infinity) {
  const log = []; let n = 0;
  const tick = () => { if (++n > budget) throw new Error(`canvas call budget exceeded (${budget})`); };
  const g = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient'
      ? (...a) => { tick(); log.push(String(k) + a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v)))); return { addColorStop: (s, c) => { tick(); log.push(`stop${s}${c}`); } }; }
      : (...a) => { tick(); log.push(String(k) + a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join(',')); return { width: 0 }; })),
    set: (o, k, v) => { tick(); log.push(`${String(k)}=${typeof v === 'object' ? 'obj' : v}`); o[k] = v; return true; } });
  return { g, log, calls: () => n, canvas: () => ({ getContext: () => g, style: {}, dataset: {} }) };
}
