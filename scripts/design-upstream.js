#!/usr/bin/env node
// design-upstream.js — is the `design` engine behind the projects it comes from?
//
// `skills/design/engine/` is taste-skill shipped unmodified, and three of its references adapt
// impeccable's text. Both upstreams ship weekly. Nothing reminded anyone, so the previous design
// skill drifted into the state that got it rebuilt (spec design-from-scratch). This is the reminder.
//
//   node scripts/design-upstream.js              report: silent and exit 0 when current,
//                                                one line per upstream that moved and exit 1
//   node scripts/design-upstream.js --sync DIR   copy a REVIEWED taste-skill checkout over engine/
//
// It never downloads code to apply it. Bringing a new version in is a person reading the diff and
// running --sync on a checkout they cloned themselves (a public skill is untrusted input).
import { readFileSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ENGINE = join(ROOT, 'skills', 'design', 'engine');
const RUNTIME = ['scripts', 'library', 'assets', 'references'];

export function readUpstream(engine = ENGINE) {
  return JSON.parse(readFileSync(join(engine, 'UPSTREAM.json'), 'utf8'));
}

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'rsc-design-upstream' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/** One entry per upstream that moved; an empty list means the engine is current. */
export async function checkUpstream({ upstream = readUpstream(), fetchImpl = fetch } = {}) {
  const moved = [];
  const t = upstream['taste-skill'];
  const commits = await getJson(fetchImpl, `https://api.github.com/repos/${t.repo}/commits?path=${t.path}&per_page=1`);
  const latest = commits[0]?.sha;
  // Different ids do not mean newer: the shipped commit is often a merge that already contains the
  // latest commit on the path. Only a latest commit AHEAD of what shipped is news.
  const ahead = latest && latest !== t.commit
    && ['ahead', 'diverged'].includes((await getJson(fetchImpl, `https://api.github.com/repos/${t.repo}/compare/${t.commit}...${latest}`)).status);
  if (ahead) {
    moved.push({ id: 'taste-skill', shipped: t.commit.slice(0, 7), latest: latest.slice(0, 7), url: `https://github.com/${t.repo}/compare/${t.commit}...${latest}` });
  }
  const i = upstream.impeccable;
  const releases = await getJson(fetchImpl, `https://api.github.com/repos/${i.repo}/releases?per_page=30`);
  const skill = releases.find((r) => typeof r.tag_name === 'string' && r.tag_name.startsWith('skill-v'));
  if (skill && skill.tag_name !== i.version) {
    moved.push({ id: 'impeccable', shipped: i.version, latest: skill.tag_name, url: `https://github.com/${i.repo}/releases/tag/${skill.tag_name}` });
  }
  return moved;
}

/** Copy a reviewed taste-skill checkout over engine/, and record which commit it was. */
export function syncTaste(checkout, engine = ENGINE) {
  const src = join(checkout, 'skills', 'taste-skill');
  if (!existsSync(join(src, 'SKILL.md'))) throw new Error(`${checkout} is not a taste-skill checkout (no skills/taste-skill/SKILL.md)`);
  for (const dir of RUNTIME) {
    rmSync(join(engine, dir), { recursive: true, force: true });
    if (existsSync(join(src, dir))) cpSync(join(src, dir), join(engine, dir), { recursive: true });
  }
  cpSync(join(checkout, 'LICENSE'), join(engine, 'LICENSE'));
  // RUN.md is the upstream SKILL.md without its front matter, so it is never discovered as a skill.
  writeFileSync(join(engine, 'RUN.md'), readFileSync(join(src, 'SKILL.md'), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, ''));
  const upstream = readUpstream(engine);
  // The last commit that touched the skill folder; checkUpstream asks GitHub whether anything newer
  // on that path is ahead of it.
  upstream['taste-skill'].commit = execFileSync('git', ['-C', checkout, 'log', '-1', '--format=%H', '--', 'skills/taste-skill'], { encoding: 'utf8' }).trim();
  const changelog = join(checkout, 'CHANGELOG.md');
  const version = existsSync(changelog) && /^## (\d+\.\d+\.\d+)/m.exec(readFileSync(changelog, 'utf8'));
  if (version) upstream['taste-skill'].version = version[1];
  writeFileSync(join(engine, 'UPSTREAM.json'), `${JSON.stringify(upstream, null, 2)}\n`);
  return upstream['taste-skill'];
}

async function main() {
  const at = process.argv.indexOf('--sync');
  if (at !== -1) {
    const synced = syncTaste(process.argv[at + 1]);
    console.log(`engine synced to taste-skill ${synced.version} (${synced.commit.slice(0, 7)}). Run the tests and read the diff before committing.`);
    return;
  }
  const moved = await checkUpstream();
  for (const m of moved) console.log(`${m.id}: shipped ${m.shipped}, upstream ${m.latest} → ${m.url}`);
  if (moved.length) {
    console.log('Review the change, clone it yourself, then: node scripts/design-upstream.js --sync <taste-skill checkout>');
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exitCode = 2; });
