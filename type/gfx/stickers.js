/* motion-pack / type / gfx / stickers.js: 44 OWNED vector stickers (drawn for this pack, 100 x 100 box, ink outline style) + 8 seek-safe motions,
   and a reaction glyph system: reaction ids (laugh, love, wow, ...) render our placeholder faces until a LICENSED emoji set is plugged in with
   setGlyphSource(fn). Apple Color Emoji is not licensed for our videos; candidate sets must be checked (licence + ORIGIN.txt) before import.
   gfx ids: 'sticker.place' with params { name, motion, at:[x,y], size }; 'reaction.place' with { name, ... } (same motions). */
import { E, clamp, seg, TAU, INK, f2, text, hashf } from './core.js';

const O = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const face = (fill, inner) => `<circle cx="50" cy="50" r="44" fill="${fill}" ${O}/>${inner}`;
const eye = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`;
const arc = (d, w = 4, fill = 'none') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const heartD = (cx, cy, s) => `M${cx} ${cy + s * 0.38} C${cx - s * 0.62} ${cy - s * 0.04} ${cx - s * 0.36} ${cy - s * 0.52} ${cx} ${cy - s * 0.2} C${cx + s * 0.36} ${cy - s * 0.52} ${cx + s * 0.62} ${cy - s * 0.04} ${cx} ${cy + s * 0.38} Z`;
const starP = (cx, cy, ro, ri, n) => Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? ri : ro, a = -Math.PI / 2 + (i * Math.PI) / n; return `${f2(cx + r * Math.cos(a))},${f2(cy + r * Math.sin(a))}`; }).join(' ');
const badge = (label, fill, tc = '#fff') => `<rect x="6" y="28" width="88" height="44" rx="12" fill="${fill}" ${O}/>` + text(label, 50, 60, { size: label.length > 3 ? 24 : 30, weight: 800, fill: tc, anchor: 'middle' });
const Y = '#FFCF3A';

export const FACES = {
  smile: () => face(Y, eye(36, 42) + eye(64, 42) + arc('M32 60 Q50 76 68 60')),
  laugh: () => face(Y, arc('M30 42 Q36 34 42 42') + arc('M58 42 Q64 34 70 42') + `<path d="M28 56 H72 Q70 80 50 80 Q30 80 28 56 Z" fill="#7A1F2B" ${O}/><path d="M36 70 Q50 64 64 70 Q58 79 50 79 Q42 79 36 70Z" fill="#FF7A8A"/>`),
  love: () => face(Y, `<path d="${heartD(35, 44, 22)}" fill="#FF3B6B" ${O}/><path d="${heartD(65, 44, 22)}" fill="#FF3B6B" ${O}/>` + arc('M34 64 Q50 78 66 64')),
  wow: () => face(Y, eye(36, 40, 6) + eye(64, 40, 6) + `<ellipse cx="50" cy="66" rx="9" ry="12" fill="#7A1F2B" ${O}/>` + arc('M28 28 Q36 22 44 28', 3) + arc('M56 28 Q64 22 72 28', 3)),
  sad: () => face(Y, eye(36, 44) + eye(64, 44) + arc('M34 70 Q50 58 66 70') + `<path d="M70 50 q4 8 0 12 q-4 -4 0 -12z" fill="#7FD3FF" ${O}/>`),
  angry: () => face('#FF7043', arc('M28 34 L44 40', 5) + arc('M72 34 L56 40', 5) + eye(37, 48) + eye(63, 48) + arc('M34 70 Q50 60 66 70')),
  cool: () => face(Y, `<path d="M20 38 H80 V44 Q78 56 64 56 Q54 56 52 46 H48 Q46 56 36 56 Q22 56 20 44 Z" fill="${INK}"/>` + arc('M36 66 Q52 76 66 62')),
  think: () => face(Y, eye(38, 42) + eye(64, 40) + arc('M30 32 L44 30', 3) + arc('M40 68 H62') + `<path d="M58 70 q14 -2 16 10 q-10 8 -20 0z" fill="#F5B82E" ${O}/>`),
  wink: () => face(Y, eye(36, 42) + arc('M56 42 Q64 36 72 42') + arc('M32 60 Q50 76 68 60') + `<path d="M58 66 q6 10 0 14 q-6 -2 0 -14z" fill="#FF7A8A" ${O}/>`),
  cry: () => face(Y, arc('M28 44 Q36 38 44 44') + arc('M56 44 Q64 38 72 44') + `<path d="M28 48 V90" stroke="#5AB8FF" stroke-width="8" stroke-linecap="round"/><path d="M72 48 V90" stroke="#5AB8FF" stroke-width="8" stroke-linecap="round"/>` + `<ellipse cx="50" cy="68" rx="12" ry="8" fill="#7A1F2B" ${O}/>`),
  party: () => face(Y, eye(36, 46) + eye(64, 46) + arc('M32 62 Q50 78 68 62') + `<path d="M30 14 L50 -8 L56 22 Z" fill="#FF4F7B" ${O} transform="rotate(-12 50 10)"/><circle cx="18" cy="24" r="4" fill="#2BD9A0"/><circle cx="84" cy="20" r="4" fill="#5AB0FF"/>`),
  sleepy: () => face(Y, arc('M28 46 Q36 50 44 46') + arc('M56 46 Q64 50 72 46') + arc('M42 68 Q50 64 58 68') + text('z', 82, 24, { size: 22, weight: 800, fill: INK })),
};
export const OBJECTS = {
  heart: () => `<path d="${heartD(50, 52, 82)}" fill="#FF3B6B" ${O}/><ellipse cx="34" cy="38" rx="6" ry="9" fill="#fff" opacity="0.7"/>`,
  fire: () => `<path d="M50 6 C58 24 80 34 80 60 C80 80 66 94 50 94 C34 94 20 80 20 62 C20 48 30 40 36 30 C38 42 44 46 46 44 C44 30 44 18 50 6 Z" fill="#FF6A1A" ${O}/><path d="M50 50 C56 60 66 64 64 76 C62 86 56 90 50 90 C42 90 36 84 36 76 C36 68 44 64 50 50 Z" fill="#FFD23A"/>`,
  star: () => `<polygon points="${starP(50, 52, 46, 20, 5)}" fill="${Y}" ${O}/>`,
  thumbsUp: () => `<path d="M10 44 H30 V90 H10 Z" fill="#5AB0FF" ${O}/><path d="M36 90 V46 L52 8 C62 8 68 18 64 30 L60 42 H86 C93 42 97 49 95 55 L89 82 C87 88 83 90 77 90 Z" fill="${Y}" ${O}/>`,
  hundred: () => text('100', 50, 62, { size: 40, weight: 800, fill: '#E3122E', anchor: 'middle', extra: 'font-style="italic"' }) + arc('M14 72 Q50 80 86 70', 5).replace(INK, '#E3122E') + arc('M18 82 Q50 90 82 80', 5).replace(INK, '#E3122E'),
  check: () => `<circle cx="50" cy="50" r="44" fill="#14B86A" ${O}/>` + `<path d="M28 52 L44 68 L74 34" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
  cross: () => `<circle cx="50" cy="50" r="44" fill="#E3122E" ${O}/><path d="M32 32 L68 68 M68 32 L32 68" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`,
  crown: () => `<path d="M12 74 L18 30 L36 52 L50 22 L64 52 L82 30 L88 74 Z" fill="${Y}" ${O}/><rect x="12" y="74" width="76" height="12" rx="3" fill="#F5A623" ${O}/>`,
  rocket: () => `<path d="M50 6 C70 20 72 50 64 72 H36 C28 50 30 20 50 6 Z" fill="#E9ECF5" ${O}/><circle cx="50" cy="38" r="9" fill="#5AB0FF" ${O}/><path d="M36 60 L20 76 L36 74 Z M64 60 L80 76 L64 74 Z" fill="#E3122E" ${O}/><path d="M42 74 Q50 98 58 74 Z" fill="#FF8A1A" ${O}/>`,
  bolt: () => `<path d="M58 4 L22 54 H46 L38 96 L80 40 H54 L58 4 Z" fill="${Y}" ${O}/>`,
  sparkle: () => `<path d="M50 4 C54 34 66 46 96 50 C66 54 54 66 50 96 C46 66 34 54 4 50 C34 46 46 34 50 4 Z" fill="#FFF2A8" ${O}/>`,
  trophy: () => `<path d="M28 12 H72 V40 C72 56 62 64 50 64 C38 64 28 56 28 40 Z" fill="${Y}" ${O}/><path d="M28 20 H14 Q12 42 30 46 M72 20 H86 Q88 42 70 46" fill="none" ${O}/><rect x="44" y="64" width="12" height="14" fill="#F5A623" ${O}/><rect x="30" y="78" width="40" height="12" rx="3" fill="#8B5A2B" ${O}/>`,
  gift: () => `<rect x="12" y="40" width="76" height="50" rx="4" fill="#FF4F7B" ${O}/><rect x="8" y="28" width="84" height="16" rx="4" fill="#FF6E93" ${O}/><path d="M50 28 V90" stroke="${Y}" stroke-width="10"/><path d="M50 28 C34 4 18 18 34 28 M50 28 C66 4 82 18 66 28" fill="none" ${O}/>`,
  moneyBag: () => `<path d="M38 18 H62 L56 30 C78 40 88 60 82 76 C78 88 64 92 50 92 C36 92 22 88 18 76 C12 60 22 40 44 30 Z" fill="#C9A25B" ${O}/>` + text('₹', 50, 74, { size: 36, weight: 800, fill: INK, anchor: 'middle' }),
  coin: () => `<circle cx="50" cy="50" r="42" fill="${Y}" ${O}/><circle cx="50" cy="50" r="30" fill="none" stroke="#C98A00" stroke-width="4"/>` + text('₹', 50, 63, { size: 36, weight: 800, fill: '#8A5A00', anchor: 'middle' }),
  bell: () => `<path d="M50 10 C70 10 76 28 76 46 V64 L86 76 H14 L24 64 V46 C24 28 30 10 50 10 Z" fill="${Y}" ${O}/><circle cx="50" cy="84" r="8" fill="#F5A623" ${O}/>`,
  pin: () => `<path d="M50 94 C36 70 18 58 18 38 C18 20 32 8 50 8 C68 8 82 20 82 38 C82 58 64 70 50 94 Z" fill="#E3122E" ${O}/><circle cx="50" cy="38" r="12" fill="#fff" ${O}/>`,
  eyes: () => `<ellipse cx="32" cy="50" rx="20" ry="28" fill="#fff" ${O}/><ellipse cx="68" cy="50" rx="20" ry="28" fill="#fff" ${O}/>` + eye(38, 54, 9) + eye(74, 54, 9),
  chat: () => `<path d="M10 14 H90 V66 H46 L24 88 V66 H10 Z" fill="#5AB0FF" ${O}/>` + eye(32, 40, 5) + eye(50, 40, 5) + eye(68, 40, 5),
  bulb: () => `<circle cx="50" cy="40" r="30" fill="#FFE45C" ${O}/><rect x="36" y="66" width="28" height="22" rx="4" fill="#9BA3AF" ${O}/><ellipse cx="38" cy="30" rx="6" ry="10" fill="#fff" opacity="0.8"/>`,
  clock: () => `<circle cx="50" cy="50" r="42" fill="#fff" ${O}/><path d="M50 22 V50 L68 60" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
  calendar: () => `<rect x="12" y="18" width="76" height="70" rx="8" fill="#fff" ${O}/><path d="M12 38 H88" stroke="${INK}" stroke-width="4"/><rect x="12" y="18" width="76" height="20" rx="8" fill="#E3122E" ${O}/>` + text('13', 50, 76, { size: 32, weight: 800, fill: INK, anchor: 'middle' }),
  lock: () => `<path d="M30 44 V32 C30 18 38 10 50 10 C62 10 70 18 70 32 V44" fill="none" stroke="${INK}" stroke-width="8"/><rect x="18" y="44" width="64" height="46" rx="8" fill="${Y}" ${O}/><circle cx="50" cy="64" r="6" fill="${INK}"/>`,
  shield: () => `<path d="M50 6 L86 18 V46 C86 70 70 86 50 94 C30 86 14 70 14 46 V18 Z" fill="#4A18ED" ${O}/><path d="M34 50 L46 62 L68 38" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  chartUp: () => `<rect x="8" y="8" width="84" height="84" rx="12" fill="#fff" ${O}/><path d="M18 74 L38 54 L52 64 L80 30" fill="none" stroke="#14B86A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M64 30 H80 V46" fill="none" stroke="#14B86A" stroke-width="8" stroke-linecap="round"/>`,
  megaphone: () => `<path d="M14 40 H34 L78 16 V84 L34 60 H14 Z" fill="#FF4F7B" ${O}/><path d="M26 60 L32 86 H44 L40 60" fill="#FF6E93" ${O}/>`,
  camera: () => `<rect x="8" y="28" width="84" height="58" rx="10" fill="#2A2A33" ${O}/><rect x="32" y="18" width="36" height="14" rx="4" fill="#2A2A33" ${O}/><circle cx="50" cy="57" r="18" fill="#5AB0FF" ${O}/>`,
  mic: () => `<rect x="34" y="8" width="32" height="52" rx="16" fill="#9BA3AF" ${O}/><path d="M22 46 C22 66 36 74 50 74 C64 74 78 66 78 46" fill="none" ${O}/><path d="M50 74 V90 M34 92 H66" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  musicNote: () => `<path d="M40 74 V18 L84 8 V62" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/><ellipse cx="30" cy="76" rx="14" ry="11" fill="#4A18ED" ${O}/><ellipse cx="74" cy="64" rx="14" ry="11" fill="#4A18ED" ${O}/>`,
  sun: () => Array.from({ length: 8 }, (_, i) => `<path d="M50 50 L${f2(50 + 46 * Math.cos(i * TAU / 8))} ${f2(50 + 46 * Math.sin(i * TAU / 8))}" stroke="#F5A623" stroke-width="8" stroke-linecap="round"/>`).join('') + `<circle cx="50" cy="50" r="26" fill="${Y}" ${O}/>`,
  cloud: () => `<path d="M24 76 C10 76 8 56 22 54 C20 36 42 30 50 42 C56 28 82 32 78 52 C92 54 92 76 76 76 Z" fill="#fff" ${O}/>`,
  rainDrop: () => `<path d="M50 6 C62 30 80 46 80 64 C80 82 66 94 50 94 C34 94 20 82 20 64 C20 46 38 30 50 6 Z" fill="#5AB8FF" ${O}/><ellipse cx="38" cy="62" rx="6" ry="12" fill="#fff" opacity="0.7"/>`,
  rainbow: () => ['#E3122E', '#FF8A1A', Y, '#14B86A', '#5AB0FF', '#4A18ED'].map((c, i) => `<path d="M${10 + i * 6} 80 A${40 - i * 6} ${40 - i * 6} 0 0 1 ${90 - i * 6} 80" fill="none" stroke="${c}" stroke-width="6"/>`).join(''),
  diya: () => `<path d="M10 62 Q50 96 90 62 Q70 56 50 58 Q30 56 10 62 Z" fill="#D2691E" ${O}/><path d="M50 56 C40 44 44 30 50 14 C56 30 60 44 50 56 Z" fill="#FFB020" ${O}/><path d="M50 52 C46 46 47 38 50 30 C53 38 54 46 50 52 Z" fill="#FFF2A8"/>`,
  rangoli: () => Array.from({ length: 8 }, (_, i) => `<ellipse cx="50" cy="24" rx="10" ry="20" fill="${['#FF4F7B', '#FFC83D', '#2BD9A0', '#5AB0FF'][i % 4]}" ${O} transform="rotate(${i * 45} 50 50)"/>`).join('') + `<circle cx="50" cy="50" r="12" fill="#4A18ED" ${O}/>`,
  kite: () => `<path d="M50 6 L84 44 L50 82 L16 44 Z" fill="#FF4F7B" ${O}/><path d="M50 6 V82 M16 44 H84" stroke="${INK}" stroke-width="3"/><path d="M50 82 Q40 90 50 96 Q60 90 50 82" fill="none" stroke="${INK}" stroke-width="3"/>`,
  chai: () => `<path d="M18 30 H74 L68 86 H24 Z" fill="#fff" ${O}/><path d="M22 40 H70 L68 56 H24 Z" fill="#C68B59"/><path d="M74 42 C90 42 90 66 72 66" fill="none" ${O}/><path d="M38 22 Q34 12 40 6 M54 22 Q50 12 56 6" fill="none" stroke="#9BA3AF" stroke-width="4" stroke-linecap="round"/>`,
  sale: () => badge('SALE', '#E3122E'), new: () => badge('NEW', '#4A18ED'), live: () => badge('LIVE', '#E3122E'), free: () => badge('FREE', '#14B86A'),
  arrowUp: () => `<path d="M50 8 L86 48 H64 V92 H36 V48 H14 Z" fill="#14B86A" ${O}/>`,
  question: () => `<circle cx="50" cy="50" r="44" fill="#5AB0FF" ${O}/>` + text('?', 50, 68, { size: 52, weight: 800, fill: '#fff', anchor: 'middle' }),
  exclaim: () => `<circle cx="50" cy="50" r="44" fill="#FFC83D" ${O}/>` + text('!', 50, 68, { size: 52, weight: 800, fill: INK, anchor: 'middle' }),
};
export const STICKERS = { ...OBJECTS };
for (const [k, v] of Object.entries(FACES)) STICKERS['face' + k[0].toUpperCase() + k.slice(1)] = v;
export const STICKER_NAMES = Object.keys(STICKERS);

/* reactions: semantic ids -> glyph. Default = our placeholder faces / objects. setGlyphSource(fn(name) -> svg markup in a 100 box | null) plugs a licensed set. */
export const REACTIONS = { laugh: 'faceLaugh', love: 'faceLove', wow: 'faceWow', sad: 'faceSad', angry: 'faceAngry', cool: 'faceCool', think: 'faceThink', wink: 'faceWink', cry: 'faceCry', party: 'faceParty', sleepy: 'faceSleepy', smile: 'faceSmile',
  fire: 'fire', heart: 'heart', clap: 'thumbsUp', hundred: 'hundred', eyes: 'eyes', rocket: 'rocket', check: 'check', idea: 'bulb', money: 'moneyBag', crown: 'crown' };
let glyphSource = null;
export const setGlyphSource = (fn) => { glyphSource = typeof fn === 'function' ? fn : null; };
export const glyph = (name) => (glyphSource && glyphSource(name)) || (STICKERS[REACTIONS[name] || name] || STICKERS.question)();

/* motions: (u = local seconds, k = entrance 0..1, seed) -> { dx, dy (box units), rot (deg), s, o } */
export const MOTIONS = {
  popBounce: (u) => ({ s: E.pop(clamp(u / 0.3)) * (1 + 0.04 * Math.exp(-u * 3) * Math.sin(u * 14)), rot: 0, dx: 0, dy: 0, o: 1 }),
  wiggle: (u) => ({ s: E.pop(clamp(u / 0.25)), rot: 9 * Math.sin(u * TAU * 2.2), dx: 0, dy: 0, o: 1 }),
  float: (u, sd) => ({ s: E.pop(clamp(u / 0.3)), rot: 3 * Math.sin(u * 1.7 + sd), dx: 4 * Math.sin(u * 0.9 + sd), dy: 8 * Math.sin(u * 1.4 + sd), o: 1 }),
  shake: (u) => ({ s: E.pop(clamp(u / 0.2)), rot: 6 * Math.sin(u * 60) * Math.exp(-u * 2.5), dx: 6 * Math.sin(u * 73) * Math.exp(-u * 2.5), dy: 0, o: 1 }),
  orbit: (u, sd) => ({ s: E.pop(clamp(u / 0.3)), rot: 0, dx: 60 * Math.cos(u * 2.4 + sd), dy: 22 * Math.sin(u * 2.4 + sd), o: 1 }),
  spin: (u) => ({ s: E.pop(clamp(u / 0.3)), rot: u * 240, dx: 0, dy: 0, o: 1 }),
  pulse: (u) => ({ s: E.pop(clamp(u / 0.25)) * (1 + 0.08 * Math.sin(u * TAU * 2)), rot: 0, dx: 0, dy: 0, o: 1 }),
  rise: (u) => ({ s: E.pop(clamp(u / 0.25)), rot: 8 * Math.sin(u * 3), dx: 18 * Math.sin(u * 2.5), dy: -320 * u, o: 1 - seg(u, 0.9, 1.6) }),
};
const place = (L, p, c, inner) => { const m = (MOTIONS[p.motion] || MOTIONS.popBounce)(L.u, p.seed || 1), sz = 180 * c.s * p.size, x = p.at[0] * c.W + m.dx * sz / 100, y = p.at[1] * c.H + m.dy * sz / 100;
  return `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(m.rot + (p.rot || 0))}) scale(${f2(Math.max(0.0001, m.s * sz / 100))}) translate(-50 -50)" opacity="${f2(m.o * (1 - L.out))}">${inner}</g>`; };
export const STICKER_GFX = {
  'sticker.place': { tags: ['sticker', 'emoji', 'reaction', 'owned-vector', 'reels'], dur: 2, inF: 9, outF: 6, d: { name: 'fire', motion: 'popBounce', at: [0.7, 0.3], size: 1, rot: -6, seed: 1 }, svg: (L, p, c) => place(L, p, c, (STICKERS[p.name] || STICKERS.question)()) },
  'reaction.place': { tags: ['reaction', 'emoji', 'placeholder-glyph', 'reels', 'comment'], dur: 2, inF: 9, outF: 6, d: { name: 'laugh', motion: 'popBounce', at: [0.3, 0.3], size: 1, rot: 0, seed: 1 }, svg: (L, p, c) => place(L, p, c, glyph(p.name)) },
  'reaction.burst': { tags: ['reaction', 'burst', 'live', 'hearts', 'stream'], dur: 2.5, inF: 1, outF: 8, d: { names: ['heart', 'fire', 'laugh', 'wow', 'clap'], count: 14, at: [0.85, 0.85], size: 0.45, seed: 9 },
    svg(L, p, c) { let g = ''; for (let i = 0; i < p.count; i++) { const t0 = i * 0.14, u = L.u - t0; if (u < 0) continue; const nm = p.names[Math.floor(hashf(p.seed, i) * p.names.length)], x = p.at[0] + (hashf(p.seed, i, 2) - 0.5) * 0.08 + 0.02 * Math.sin(u * 4 + i);
      g += place({ u, out: seg(u, 1.2, 1.8) }, { motion: 'rise', at: [x, p.at[1]], size: p.size * (0.8 + 0.4 * hashf(p.seed, i, 3)), seed: i }, c, glyph(nm)); } return `<g opacity="${f2(1 - L.out)}">${g}</g>`; } },
};
