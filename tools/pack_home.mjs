/* motion-pack / tools / pack_home.mjs: where the pack lives when the skill or `mp` runs outside a clone, and `mp init`, which puts it there.
     resolvePack({ self, env, home, version }) -> { pack, how } | { pack: null, how, want }
       1. MOTION_PACK_HOME (a folder that holds a whole pack: templates/, playbook/, tools/mp.mjs)
       2. self: the pack this mp.mjs sits in, when it is a whole pack (a clone, or an unpacked release)
       3. ~/.motion-pack/<version> (what `mp init` makes)
       else { pack: null, want: ~/.motion-pack/<version> }: run `mp init`
     init({ version, home, repo, fetch, log }) downloads the tagged release tarball (motion-pack-v<version>.tar.gz) and SHA256SUMS from the
       GitHub release, checks the tarball's sha256 against SHA256SUMS, refuses an archive with an absolute or `..` member, unpacks it next to the
       target and renames it into ~/.motion-pack/<version> only when everything passed. `fetch(url) -> Promise<Buffer>` is injectable (the tests
       pass a fake; nothing in the tests touches the network).
   Pure helpers, no clock in the paths; init writes only under `home`. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import crypto from 'node:crypto'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';

export const REPO = 'ANVEAI/motion-pack';
const HERE = path.dirname(fileURLToPath(import.meta.url));
/* the version this copy of the pack is: .claude-plugin/plugin.json */
export function packVersion(root = path.resolve(HERE, '..')) {
  try { return JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8')).version; } catch { return null; }
}
export const isPack = (d) => !!d && ['templates', 'playbook', path.join('tools', 'mp.mjs')].every((p) => fs.existsSync(path.join(d, p)));
export const homeDir = (home = os.homedir(), version) => path.join(home, '.motion-pack', version);

export function resolvePack({ self = path.resolve(HERE, '..'), env = process.env, home = os.homedir(), version = packVersion(self) } = {}) {
  if (env.MOTION_PACK_HOME) {
    const d = path.resolve(env.MOTION_PACK_HOME.replace(/^~(?=$|\/)/, home));
    if (isPack(d)) return { pack: d, how: 'MOTION_PACK_HOME' };
    return { pack: null, how: `MOTION_PACK_HOME=${d} is not a pack (no templates/, playbook/ or tools/mp.mjs)`, want: d };
  }
  if (isPack(self)) return { pack: self, how: 'this copy' };
  const h = version ? homeDir(home, version) : null;
  if (h && isPack(h)) return { pack: h, how: `~/.motion-pack/${version}` };
  return { pack: null, how: 'no pack found', want: h };
}

export const tarballName = (version) => `motion-pack-v${version}.tar.gz`;
/* MP_RELEASE_BASE replaces https://github.com/<repo>/releases/download (a mirror, or a file:// folder the tests build: no network in tests) */
export const releaseUrl = (version, file, repo = REPO, base = process.env.MP_RELEASE_BASE) => `${(base || `https://github.com/${repo}/releases/download`).replace(/\/$/, '')}/v${version}/${file}`;

/* SHA256SUMS lines: "<64 hex>  <file>" (sha256sum / shasum -a 256 output) -> { file: hex } */
export function parseSums(text) {
  const out = {};
  for (const line of String(text).split('\n')) { const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(line.trim()); if (m) out[path.basename(m[2])] = m[1].toLowerCase(); }
  return out;
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function defaultFetch(url) {
  if (url.startsWith('file://')) return fs.readFileSync(fileURLToPath(url));
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/* the members of a .tar.gz: every one must be relative and stay inside the folder (no absolute path, no `..`) */
export function tarMembers(file) {
  const r = spawnSync('tar', ['-tzf', file], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`not a readable .tar.gz: ${(r.stderr || '').trim().slice(0, 200)}`);
  return r.stdout.split('\n').filter(Boolean);
}
export function unsafeMembers(members) { return members.filter((m) => path.isAbsolute(m) || m.split(/[\\/]/).includes('..')); }

export async function init({ version, home = os.homedir(), repo = REPO, fetch: get = defaultFetch, log = console.log, force = false } = {}) {
  if (!version || !/^\d+\.\d+\.\d+([-.][0-9A-Za-z.]+)?$/.test(version)) throw new Error(`a release version like 0.6.0 is needed (got ${JSON.stringify(version)})`);
  const target = homeDir(home, version);
  if (isPack(target) && !force) { log(`mp init: ${target} already holds motion-pack ${version}`); return { pack: target, downloaded: false }; }
  if (fs.existsSync(target) && fs.readdirSync(target).length && !force) throw new Error(`${target} exists and is not a whole pack: move it aside (or pass --force), then run mp init again`);
  const base = path.join(home, '.motion-pack'); fs.mkdirSync(base, { recursive: true });
  const name = tarballName(version);
  log(`mp init: downloading ${releaseUrl(version, name, repo)} and SHA256SUMS`);
  const [tgz, sums] = await Promise.all([get(releaseUrl(version, name, repo)), get(releaseUrl(version, 'SHA256SUMS', repo))]);
  const want = parseSums(sums.toString('utf8'))[name];
  if (!want) throw new Error(`SHA256SUMS of v${version} lists no ${name}: refusing an unverified download`);
  const got = sha256(tgz);
  if (got !== want) throw new Error(`checksum mismatch for ${name}: SHA256SUMS says ${want}, the download is ${got}; nothing was unpacked`);
  const work = fs.mkdtempSync(path.join(base, `.init-${version}-`)), file = path.join(work, name);
  fs.writeFileSync(file, tgz);
  const members = tarMembers(file), bad = unsafeMembers(members);
  if (bad.length) throw new Error(`${name} has members outside its folder (${bad.slice(0, 3).join(', ')}): refused`);
  const out = path.join(work, 'x'); fs.mkdirSync(out);
  const x = spawnSync('tar', ['-xzf', file, '-C', out, '--no-same-owner'], { encoding: 'utf8' });
  if (x.status !== 0) throw new Error(`could not unpack ${name}: ${(x.stderr || '').trim().slice(0, 200)}`);
  const tops = fs.readdirSync(out), root = tops.length === 1 && fs.statSync(path.join(out, tops[0])).isDirectory() ? path.join(out, tops[0]) : out;   // the tarball holds one top folder (git archive --prefix)
  if (!isPack(root)) throw new Error(`${name} does not hold a whole pack (templates/, playbook/, tools/mp.mjs)`);
  fs.writeFileSync(path.join(root, '.motion-pack-home.json'), JSON.stringify({ version, source: releaseUrl(version, name, repo), sha256: got }, null, 1) + '\n');
  if (fs.existsSync(target)) fs.renameSync(target, path.join(base, `.replaced-${version}-${path.basename(work)}`));   // --force keeps the old folder aside, never deletes it
  fs.renameSync(root, target);
  fs.rmSync(work, { recursive: true, force: true });   // the download and the empty unpack folder (our own temp folder only)
  log(`mp init: motion-pack ${version} verified (sha256 ${got.slice(0, 12)}...) and unpacked into ${target}`);
  return { pack: target, downloaded: true, sha256: got };
}
