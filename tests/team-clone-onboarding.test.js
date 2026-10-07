import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Team simulation D6 (G3). The profile is personal and kept out of commits, so a teammate's clone of
// an onboarded project never has one — and SessionStart told the agent, in EVERY session, «Fresh setup
// … invoke `init` now … before the task». A teammate who opened the project to fix a bug was walked
// through first-install onboarding of a project that was onboarded long ago, every single time.
const HERE = dirname(fileURLToPath(import.meta.url));
const SESSION_START = join(HERE, '..', 'targets', 'session-start.mjs');
const SUGGEST = join(HERE, '..', 'skills', 'suggest', 'SKILL.md');

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function run(root) {
  return spawnSync('node', [SESSION_START, join(root, 'nope.md'), root], { encoding: 'utf8', env: { ...process.env, RSC_NO_UPDATE_CHECK: '1' } }).stdout;
}
const ONBOARDED = { version: 1, targets: ['claude'], skills: ['init'], onboarding: { acceptedPlanId: 'abc', plan: { record: { technicalLevel: 'technical' } } } };

function teammateClone() {
  const root = mkdtempSync(join(tmpdir(), 'rsc-clone-ob-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'T'); git(root, 'config', 'user.email', 't@x');
  writeFileSync(join(root, '.rsc.json'), JSON.stringify(ONBOARDED));
  writeFileSync(join(root, '.gitignore'), '.rsc/\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'harness');
  return root;
}

test('a teammate clone gets a one-line, non-blocking offer instead of first-install onboarding', () => {
  const out = run(teammateClone());
  assert.doesNotMatch(out, /Fresh setup/);
  assert.doesNotMatch(out, /before the task/);
  assert.match(out, /once, in one line/);
  assert.match(out, /technical terms or analogies/);
  assert.match(out, /continue with their task/);
});

test('the offer is made once per clone, then stays quiet', () => {
  const root = teammateClone();
  assert.match(run(root), /once, in one line/);
  assert.ok(existsSync(join(root, '.rsc', '.profile-offered')), 'a local marker records the offer');
  assert.doesNotMatch(run(root), /rsc onboarding|once, in one line/);
  assert.equal(git(root, 'status', '--porcelain'), '', 'the marker is local state, never a change to commit');
});

test('a true first install still gets the blocking first contact', () => {
  const fresh = mkdtempSync(join(tmpdir(), 'rsc-fresh-ob-'));
  assert.match(run(fresh), /Fresh setup[\s\S]*invoke `init` now/);
  // .rsc.json on disk but never committed and never onboarded: still a first install.
  const installed = mkdtempSync(join(tmpdir(), 'rsc-fresh-ob2-'));
  git(installed, 'init', '-q');
  writeFileSync(join(installed, '.rsc.json'), JSON.stringify({ version: 1, skills: ['init'] }));
  assert.match(run(installed), /Fresh setup/);
  // Onboarded but not committed (the person mid-install deleted the profile): not a clone either.
  const local = mkdtempSync(join(tmpdir(), 'rsc-fresh-ob3-'));
  git(local, 'init', '-q');
  writeFileSync(join(local, '.rsc.json'), JSON.stringify(ONBOARDED));
  assert.match(run(local), /Fresh setup/);
});

test('suggest §4 First contact tells the clone case apart, so the always-on rule does not re-block it', () => {
  const body = readFileSync(SUGGEST, 'utf8');
  const section = body.slice(body.indexOf('## 4. First contact'), body.indexOf('## Explain without assuming'));
  assert.match(section, /clone/i);
  assert.match(section, /\.rsc\/\.profile-offered/);
  assert.match(section, /continue\s+with\s+(the|their)\s+task/i);
});
