/* TEMPLATE saas-launch: the SaaS launch film (launch-playbook L3, product UI film), 45 / 60 / 75 s, 16:9 master + a 9:16 RE-LAYOUT (own boxes per aspect, scenes.mjs LY).
   hook (the pain on frame 0, already moving) -> problem (three beats on the bar: copy, chase, repeat) -> product reveal (mark, name, the promise) -> UI tour (ONE window, a cursor journey:
   open, describe it in a sentence, the steps build, read the rule, drag to adjust, test) -> feature trio (one line + UI each) -> works with (neutral glyphs) -> payoff (the hook's inbox,
   before / after) -> proof (one number with its source in frame) -> pricing / availability -> end card (mark, CTA, URL, held). Hard cuts on the beats of the bed; every other transition
   carries its reason. Every screen is an HTML placeholder of the FICTIONAL "Acme Flow" labelled "placeholder UI · demo data" until CONFIG.media gives your screenshot or recording.
   Edit the CONFIG block only:  node make.mjs [--set length=45] [--set aspect=9:16] [--set brand.name=...]   then render (make.mjs prints the command).
   HONESTY: a digit in CONFIG.text fails the build (put numbers in CONFIG.claims with a source); the proof counter prints its claim's source; prices and dashboard figures print "placeholder data". */
import { aspectOf, scenesToPlan, digitsInCopy } from '../_shared/saas/plan-kit.mjs';
import { launchScenes } from './scenes.mjs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  length: 60,                      // 45 | 60 | 75 (scenes.mjs BUDGETS: a section missing from a budget is cut)
  aspect: '16:9',                  // '16:9' | '9:16' (a re-layout; 9:16 builds its own project in tall/)
  platform: null,                  // null = x.video for 16:9, reels.organic for 9:16 (templates/_shared/plan.mjs PLATFORMS: safe zones, brand-cue deadline)
  fps: 30,
  brand: { name: 'Acme Flow', accent: '#3B5BFD', ink: '#14131A', paper: '#F5F4F0', logo: null, url: 'flow.example', cta: 'Start free', font: { display: 'Manrope', text: 'Manrope' } },   // FICTIONAL demo brand; logo: an absolute path to your mark (PNG / SVG), null = a lettermark
  text: {                          // ALL on-screen copy. *word* = the accent colour. No digits here (numbers live in claims, with a source)
    hook: 'Requests land *everywhere*.',
    hookToasts: [['New request', 'Refund for a double charge', 'mail'], ['New message', 'Cannot log in after reset', 'search'], ['New form', 'Export button does nothing', 'doc'], ['New request', 'Invoice needs a new address', 'mail'], ['New message', 'Seats for the new team', 'user']],
    copy: 'Copy. *Paste.*', copyChip: 'Refund for a double charge', chase: 'Then *chase*.', chaseLabel: 'Still nobody owns it', repeat: 'Every. Single. *Day.*',
    line: 'Requests that route *themselves*.',
    tour: ['Start a flow.', '*Describe* it in a sentence.', 'It *builds* the steps.', 'Rules you can *read*.', 'Drag to *adjust*.', '*Test* it before it ships.'],
    prompt: 'Send each new request to the team that owns it', askTitle: 'Ask Acme Flow', apply: 'Apply flow',
    answer: ['Done. Here is your flow:', '• Read each request as it lands', '• Pick the owning team from its topic', '• Post it to that team', '• Tell the customer who has it'],
    branchLabel: 'Rules in plain words', dragLabel: 'Drag to reorder',
    runToasts: [['Request routed', 'Refund → Billing', 'branch'], ['Request routed', 'Login issue → Access', 'branch'], ['Customer told', 'Billing has it', 'mail']],
    features: ['One shortcut, *anywhere*.', 'Every run, on *record*.', 'Your numbers, *live*.'], shortcutLabel: 'Open the palette', commandQuery: 'route',
    commandItems: [{ label: 'Route new requests', icon: 'branch', hint: 'Flow' }, { label: 'Create a flow', icon: 'bolt', hint: 'New' }, { label: 'Search runs', icon: 'search', hint: 'Runs' }, { label: 'Invite a teammate', icon: 'user', hint: 'Team' }, { label: 'Route by topic', icon: 'branch', hint: 'Rule' }],
    runsLabel: 'Who routed what, and why', dashTitle: 'Overview',
    works: 'Works with the tools you *already* use.', payoff: 'Inbox, *handled*.', before: 'Before', after: 'With Acme Flow',
    proof: 'Routed in the private *beta*.', proofNote: 'placeholder number · replace it with your measured one',
    pricing: 'Free to *start*.', planBadge: 'Featured',
    fine: 'Acme Flow is fictional · placeholder UI · demo data',
  },
  media: {                         // every footage / screenshot slot is nullable: null = the labelled HTML placeholder screen
    hook: { src: null, label: '' }, tour: { src: null, start: 0, w: 1920, h: 1080, label: '' }, runs: { src: null, label: '' }, payoffBefore: { src: null }, payoffAfter: { src: null },
  },
  claims: [{ text: 'Requests routed in the private beta: 12,400', source: 'placeholder data, replace with your measured number and where it comes from' }],
  proof: { value: 12400, label: 'requests routed', claim: 0 },   // the counter reads claims[proof.claim].source and prints it under the number
  pricing: { source: 'placeholder data', plans: [{ name: 'Starter', price: '$0', per: '/ month', blurb: 'For trying it out', features: ['Up to three flows', 'Email support'], cta: 'Start free' },
    { name: 'Team', price: '$10', per: '/ seat / month', blurb: 'For a whole team', features: ['Unlimited flows', 'Shared inbox', 'Run history'], cta: 'Start trial', featured: true },
    { name: 'Business', price: '$24', per: '/ seat / month', blurb: 'For many teams', features: ['Everything in Team', 'Roles and audit log', 'Priority support'], cta: 'Talk to us' }] },
  dashSource: 'placeholder data',
  shortcut: ['⌘', 'K'],
  integrations: ['mail', 'chat', 'calendar', 'db', 'doc', 'sheet', 'cloud', 'bell', 'code', 'card'],   // neutral glyph names (type/gfx/ui-saas2.js GLYPHS): categories, never real marks
  transitions: {                   // boundary 'from>to' -> [id, REASON]; a boundary not listed is a hard cut on the beat
    'hook>copy': ['transitions/smash', 'EMOTION: the pain, then its first symptom'],
    'repeat>reveal': ['transitions/whip', 'ENERGY: the loop breaks into the reveal'],
    'reveal>tour': ['transitions/zoom-through', 'REVEAL: through the name into the product'],
    'tour>feat1': ['transitions/push', 'STORY: the tour hands over to the features'], 'feat1>feat2': ['transitions/push', 'STORY: the next feature'], 'feat2>feat3': ['transitions/push', 'STORY: the next feature'], 'feat1>feat3': ['transitions/push', 'STORY: the next feature'],
    'works>payoff': ['transitions/blur-cross', 'PLACE: back to the inbox of the hook'], 'proof>pricing': ['transitions/push', 'STORY: from proof to the offer'],
  },
  music: 'music/bed_corporate_bright_loop8', bpm: 120, musicGainDb: 0, ceilingDb: -2.5, fadeInMs: 30,   // bright launch bed (E major, 120 BPM: a beat is 15 frames, every scene is a whole number of beats)
  sfx: { head: 'sfx/whoosh/swish_xs', riser: 'sfx/riser/noise_1bar', reveal: 'sfx/hit/soft', letters: 'sfx/sparkle/letter_assemble', brandSlam: 'sfx/hit/brand_field_slam', logo: 'sfx/logo/hybrid' },   // bundle saas_ui + saas_launch
  tail: { liftS: 2.2, fadeS: 1.2, bedDb: -40 },   // end card: the bed holds liftS after the card lands, then fades to bedDb (a planned quiet hold)
  layers: [{ kind: 'grain', params: { stock: 'upload-safe' } }],
};
/* ============================================================================== */

/* the shared project file (templates/_shared/project.schema.json, lane 6) -> this CONFIG */
export const PROJECT_MAP = {
  'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta',
  'brand.font.display': 'brand.font.display', 'brand.font.text': 'brand.font.text',
  'text.headline': 'text.hook', 'text.subhead': 'text.line', 'text.features': 'text.features', 'text.proof': 'text.proof', 'text.cta': 'brand.cta', 'text.fine': 'text.fine',
  'media.screen': 'media.tour', 'media.screen2': 'media.runs', 'media.hero': 'media.hook', 'media.before': 'media.payoffBefore', 'media.after': 'media.payoffAfter',
  'claims': 'claims', 'music': 'music', 'aspects': 'aspect', 'length': 'length',
};

export function buildPlan(C) {
  const A = aspectOf(C), B = C.brand, bad = digitsInCopy(C.text);
  if (bad.length) throw new Error('saas-launch honesty: ' + bad.join(' | '));
  const list = launchScenes(C, A, B);
  for (const s of list) for (const h of s.heads || []) (s.cues ||= []).push({ t: h.at ?? 0, id: C.sfx.head, why: 'headline rises', overBedDb: -9 });
  const claims = [...C.claims, ...C.pricing.plans.map((p) => ({ text: `${p.name} plan: ${p.price} ${p.per || ''}`.trim(), source: C.pricing.source })),
    { text: 'Dashboard and runs figures (1,284 routed and the others)', source: C.dashSource + ': the demo dashboard and the placeholder runs screen' }];
  const plan = scenesToPlan(list, C, A, { template: 'saas-launch', claims, paceRule: { aslMax: 5.5, longMax: 18.5 } });
  const rv = plan.scenes.find((s) => s.id === 'reveal'); if (rv) plan.cues.push({ t: rv.start, id: C.sfx.riser, why: 'riser ends on the reveal (its anchor is its end)' });
  plan.cues.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  const end = plan.scenes.at(-1), F = C.fps, lift = Math.round((end.start + C.tail.liftS) * F), fade = Math.round(C.tail.fadeS * F);
  plan.bedAutomation = [{ frame: 0, gain_db: 0 }, { frame: lift, gain_db: 0 }, { frame: lift + fade, gain_db: C.tail.bedDb }];
  plan.audio = { mode: 'music', quiet: [{ t: [+((lift + fade) / F).toFixed(4), plan.seconds], kind: 'hold', why: 'end card on a quiet hold after the sonic logo' }] };
  plan.brandCueAt = rv ? rv.start : null; plan.honesty = 'fictional product (Acme Flow); placeholder HTML screens labelled in frame; every figure is a claim with a placeholder source';
  return plan;
}
