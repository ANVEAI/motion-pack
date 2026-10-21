#!/usr/bin/env node
/* tools/pack_home.mjs + `mp init` + skills/motion-pack/scripts/find-pack.sh: the plugin works from any folder (node + tar, no network, no browser).
   A fake release (a small whole-pack tarball + SHA256SUMS) is built in a temp folder and served through MP_RELEASE_BASE=file://..., so `mp init`
   runs its real download path without touching GitHub. Checks: the resolution order (MOTION_PACK_HOME, this copy, ~/.motion-pack/<version>), a
   verified init, a checksum mismatch and an unlisted tarball refused with nothing unpacked, an archive member outside its folder refused, mp run
   from a temp folder outside the repo through a lone copy of tools/ hands the command to the found pack, and find-pack.sh prints PACK=. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import crypto from 'node:crypto'; import { spawnSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolvePack, init, parseSums, unsafeMembers, packVersion, releaseUrl } from '../pack_home.mjs';

const PACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let bad = 0; const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  | ' + extra}`); if (!ok) bad++; };
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-home-')), V = '9.8.7';
const sh = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...o });

/* a minimal whole pack (templates/, playbook/, tools/mp.mjs) packed as git archive does: one top folder */
function fakeRelease(dir, { extra = null, listed = true, corrupt = false } = {}) {
  const src = path.join(dir, 'src'), top = path.join(src, `motion-pack-v${V}`);
  for (const d of ['templates/ad', 'playbook/formats', 'tools']) fs.mkdirSync(path.join(top, d), { recursive: true });
  fs.writeFileSync(path.join(top, 'tools', 'mp.mjs'), 'console.log("fake pack mp", process.argv.slice(2).join(" "));\n');
  const rel = path.join(dir, 'rel', `v${V}`); fs.mkdirSync(rel, { recursive: true });
  const tgz = path.join(rel, `motion-pack-v${V}.tar.gz`), args = [...(extra ? ['-P'] : []), '-czf', tgz, '-C', src, `motion-pack-v${V}`, ...(extra ? [extra] : [])];   // -P keeps the absolute member
  const r = sh('tar', args); if (r.status !== 0) throw new Error(r.stderr);
  const sum = crypto.createHash('sha256').update(fs.readFileSync(tgz)).digest('hex');
  fs.writeFileSync(path.join(rel, 'SHA256SUMS'), (listed ? `${corrupt ? '0'.repeat(64) : sum}  motion-pack-v${V}.tar.gz\n` : '') + `${'a'.repeat(64)}  motion-pack-sfx-wav-v${V}.zip\n`);
  return { base: pathToFileURL(path.join(dir, 'rel')).href, sum };
}

/* ---- resolution order ---- */
{ const home = path.join(T, 'h0'); fs.mkdirSync(home);
  check('MOTION_PACK_HOME wins when it is a whole pack', resolvePack({ self: PACK, env: { MOTION_PACK_HOME: PACK }, home }).how === 'MOTION_PACK_HOME');
  check('a MOTION_PACK_HOME that is not a pack is reported, never guessed past', resolvePack({ self: PACK, env: { MOTION_PACK_HOME: home }, home }).pack === null);
  check('without it, this copy when it is a whole pack', resolvePack({ self: PACK, env: {}, home }).pack === PACK);
  const lone = path.join(T, 'lone'); fs.mkdirSync(path.join(lone, 'tools'), { recursive: true });
  check('a lone copy with no pack at home asks for mp init', resolvePack({ self: lone, env: {}, home, version: V }).pack === null && resolvePack({ self: lone, env: {}, home, version: V }).want === path.join(home, '.motion-pack', V));
  fs.mkdirSync(path.join(home, '.motion-pack'), { recursive: true }); fs.symlinkSync(PACK, path.join(home, '.motion-pack', V));
  check('then ~/.motion-pack/<version>', resolvePack({ self: lone, env: {}, home, version: V }).pack === path.join(home, '.motion-pack', V)); }

/* ---- helpers ---- */
check('SHA256SUMS parses sha256sum and shasum lines', JSON.stringify(parseSums(`${'b'.repeat(64)}  x.tar.gz\n${'c'.repeat(64)} *dir/y.zip\nnot a line`)) === JSON.stringify({ 'x.tar.gz': 'b'.repeat(64), 'y.zip': 'c'.repeat(64) }));
check('members outside the folder are caught', unsafeMembers(['a/b', '/etc/passwd', 'a/../../x', 'ok/..x']).join() === '/etc/passwd,a/../../x');
check('the release URL is the tagged GitHub asset unless MP_RELEASE_BASE is set', releaseUrl('0.6.0', 'SHA256SUMS', 'ANVEAI/motion-pack', '') === 'https://github.com/ANVEAI/motion-pack/releases/download/v0.6.0/SHA256SUMS');
check('the plugin version is the version mp init fetches by default', /^\d+\.\d+\.\d+$/.test(packVersion(PACK) || '') && fs.readFileSync(path.join(PACK, 'skills', 'motion-pack', 'scripts', 'find-pack.sh'), 'utf8').includes(`VERSION=${packVersion(PACK)}`));

/* ---- init through a fake fetch: verified, mismatch, unlisted, unsafe ---- */
{ const d = path.join(T, 'ok'), home = path.join(T, 'h1'); fs.mkdirSync(home, { recursive: true }); const { base, sum } = fakeRelease(d), urls = [];
  const get = async (u) => { urls.push(u); return fs.readFileSync(fileURLToPath(u)); };
  const r = await init({ version: V, home, fetch: async (u) => get(u.replace(/^https:\/\/github\.com\/ANVEAI\/motion-pack\/releases\/download/, base)), log: () => {} });
  const meta = JSON.parse(fs.readFileSync(path.join(home, '.motion-pack', V, '.motion-pack-home.json'), 'utf8'));
  check('init downloads the tagged tarball and SHA256SUMS, verifies and unpacks into ~/.motion-pack/<version>', r.downloaded && r.sha256 === sum && meta.sha256 === sum && fs.existsSync(path.join(home, '.motion-pack', V, 'tools', 'mp.mjs')) && urls.length === 2 && urls.some((u) => u.endsWith(`/v${V}/motion-pack-v${V}.tar.gz`)), JSON.stringify(urls));
  check('init leaves no temp folder behind', fs.readdirSync(path.join(home, '.motion-pack')).filter((x) => x.startsWith('.init-')).length === 0);
  const again = await init({ version: V, home, fetch: async () => { throw new Error('no second download'); }, log: () => {} });
  check('a second init reuses the verified pack (no download)', again.downloaded === false); }
for (const [label, opt, rx] of [['a checksum mismatch', { corrupt: true }, /checksum mismatch/], ['a tarball SHA256SUMS does not list', { listed: false }, /lists no/]]) {
  const d = path.join(T, label.replace(/\W+/g, '-')), home = path.join(T, 'h-' + label.replace(/\W+/g, '-')); fs.mkdirSync(home, { recursive: true }); const { base } = fakeRelease(d, opt);
  let err = null; try { await init({ version: V, home, fetch: async (u) => fs.readFileSync(fileURLToPath(u.replace(/^https:\/\/github\.com\/ANVEAI\/motion-pack\/releases\/download/, base))), log: () => {} }); } catch (e) { err = e; }
  check(`init refuses ${label} and unpacks nothing`, err && rx.test(err.message) && !fs.existsSync(path.join(home, '.motion-pack', V)), err ? err.message : 'no error'); }
{ const d = path.join(T, 'unsafe'), home = path.join(T, 'h-unsafe'); fs.mkdirSync(home, { recursive: true }); const outside = path.join(T, 'outside.txt'); fs.writeFileSync(outside, 'x');
  const { base } = fakeRelease(d, { extra: outside });
  let err = null; try { await init({ version: V, home, fetch: async (u) => fs.readFileSync(fileURLToPath(u.replace(/^https:\/\/github\.com\/ANVEAI\/motion-pack\/releases\/download/, base))), log: () => {} }); } catch (e) { err = e; }
  check('init refuses an archive with an absolute member', err && /outside its folder/.test(err.message) && !fs.existsSync(path.join(home, '.motion-pack', V)), err ? err.message : 'no error'); }

/* ---- mp from a temp folder outside the repo ---- */
{ const work = path.join(T, 'work'), home = path.join(T, 'h2'), lone = path.join(T, 'lone2'); fs.mkdirSync(work); fs.mkdirSync(home);
  fs.mkdirSync(path.join(lone, 'tools'), { recursive: true }); fs.mkdirSync(path.join(lone, '.claude-plugin'));
  for (const f of ['mp.mjs', 'pack_home.mjs']) fs.copyFileSync(path.join(PACK, 'tools', f), path.join(lone, 'tools', f));
  fs.writeFileSync(path.join(lone, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: V }));
  const env = { ...process.env, HOME: home }; delete env.MOTION_PACK_HOME;
  let r = sh('node', [path.join(lone, 'tools', 'mp.mjs'), 'formats'], { cwd: work, env });
  check('a lone mp with no pack says to run mp init (exit 2)', r.status === 2 && /mp init/.test(r.stderr), r.stderr);
  const { base } = fakeRelease(path.join(T, 'cli'));
  r = sh('node', [path.join(lone, 'tools', 'mp.mjs'), 'init'], { cwd: work, env: { ...env, MP_RELEASE_BASE: base } });
  check('mp init (the CLI) fetches the release through MP_RELEASE_BASE and prints PACK=', r.status === 0 && r.stdout.includes(`PACK=${path.join(home, '.motion-pack', V)}`), r.stdout + r.stderr);
  r = sh('node', [path.join(lone, 'tools', 'mp.mjs'), 'formats', '--json'], { cwd: work, env });
  check('then mp from the temp folder hands the command to ~/.motion-pack/<version>', r.status === 0 && r.stdout.includes('fake pack mp formats --json'), r.stdout + r.stderr);
  r = sh('node', [path.join(PACK, 'tools', 'mp.mjs'), 'styles'], { cwd: work, env: { ...env, MOTION_PACK_HOME: PACK } });
  check('the real pack runs from a temp folder outside the repo (mp styles via MOTION_PACK_HOME)', r.status === 0 && /blueprint/.test(r.stdout), r.stderr);
  /* find-pack.sh from a skill copy outside any clone */
  const skill = path.join(T, 'plugin', 'skills', 'motion-pack', 'scripts'); fs.mkdirSync(skill, { recursive: true });
  fs.copyFileSync(path.join(PACK, 'skills', 'motion-pack', 'scripts', 'find-pack.sh'), path.join(skill, 'find-pack.sh'));
  fs.mkdirSync(path.join(T, 'plugin', '.claude-plugin')); fs.writeFileSync(path.join(T, 'plugin', '.claude-plugin', 'plugin.json'), `{\n  "version": "${V}"\n}\n`);
  r = sh('sh', [path.join(skill, 'find-pack.sh')], { cwd: work, env });
  check('find-pack.sh outside a clone finds ~/.motion-pack/<version>', r.status === 0 && r.stdout.trim() === `PACK=${path.join(home, '.motion-pack', V)}`, r.stdout + r.stderr);
  r = sh('sh', [path.join(skill, 'find-pack.sh')], { cwd: work, env: { ...env, MOTION_PACK_HOME: PACK } });
  check('find-pack.sh takes MOTION_PACK_HOME first', r.status === 0 && r.stdout.trim() === `PACK=${fs.realpathSync(PACK)}`, r.stdout + r.stderr);
  r = sh('sh', [path.join(skill, 'find-pack.sh')], { cwd: work, env: { ...env, HOME: path.join(T, 'h-empty') } });
  check('find-pack.sh with no pack and no mp to run says what to do (exit 2)', r.status === 2 && /node|clone/.test(r.stderr), r.stderr); }

fs.rmSync(T, { recursive: true, force: true });
console.log(bad ? `\n${bad} FAILED` : '\nall pack-home checks passed');
process.exit(bad ? 1 : 0);
