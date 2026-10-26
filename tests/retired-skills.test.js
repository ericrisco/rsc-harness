import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, rmSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { RETIRED_SKILLS, replaceRetired } from '../scripts/lib/retired-skills.js';
import { identifyPlan } from '../scripts/lib/onboarding.js';
import { verifyOnboarding } from '../scripts/lib/onboarding-apply.js';
import { DEFAULT_SKILL_FLOOR } from '../scripts/lib/default-skill-floor.js';
import { targetPaths } from '../targets/index.js';
import { readManifest as readCloneManifest } from '../targets/clone-bootstrap.mjs';

// eli5 and show-me folded into `orient` (it explains, at the register `technical_level` asks for);
// bro folded into `unslop` (it rewrites text for other people). Harnesses built before that still
// name the three in `.rsc.json`, in their onboarding receipt (hash-checked, never rewritten) and in
// their per-target state. Every reader of a declared list has to read them as their successors, or
// an upgrade breaks: sync would try to copy a skill the catalog no longer ships, and verification
// would call the old receipt drift.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'rsc.js');
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });
const RETIRED = ['bro', 'eli5', 'show-me', 'design-loop', 'design-dna', 'motion-craft', 'ui-engineering'];

test('replaceRetired maps each retired id to its successor, dedupes, keeps the rest', () => {
  assert.deepEqual(RETIRED_SKILLS, {
    eli5: 'orient', 'show-me': 'orient', bro: 'unslop',
    'design-loop': 'design', 'design-dna': 'design', 'motion-craft': 'design',
    'ui-engineering': 'ux',
  });
  assert.deepEqual(replaceRetired(['design-loop', 'design', 'motion-craft', 'design-dna']), ['design']);
  assert.ok(Object.isFrozen(RETIRED_SKILLS));
  assert.deepEqual(replaceRetired(['bro', 'fastapi', 'eli5', 'orient', 'show-me', 'unslop']), ['unslop', 'fastapi', 'orient']);
  assert.deepEqual(replaceRetired(['fastapi', 'plan']), ['fastapi', 'plan']);
  assert.deepEqual(replaceRetired([]), []);
  assert.deepEqual(replaceRetired(undefined), []);
});

test('the default floor carries unslop, not bro', () => {
  assert.ok(DEFAULT_SKILL_FLOOR.includes('unslop'));
  for (const id of RETIRED) assert.ok(!DEFAULT_SKILL_FLOOR.includes(id), `${id} is retired`);
});

test('the retired skills are gone from the catalog', () => {
  for (const id of RETIRED) assert.ok(!existsSync(join(ROOT, 'skills', id)), `skills/${id} must be deleted`);
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  for (const id of RETIRED) assert.ok(!manifest.skills.some((s) => s.id === id), `${id} must not be in manifest.json`);
});

test('the committed clone bootstrap reads retired ids as their successors (it cannot import the map)', () => {
  const d = mkdtempSync(join(tmpdir(), 'rsc-retired-clone-'));
  writeFileSync(join(d, '.rsc.json'), JSON.stringify({ version: 1, targets: ['claude'], skills: ['bro', 'eli5', 'show-me', 'orient', 'plan'] }));
  assert.deepEqual(readCloneManifest(d).skills, ['unslop', 'orient', 'plan']);
  for (const [id, successor] of Object.entries(RETIRED_SKILLS)) {
    writeFileSync(join(d, '.rsc.json'), JSON.stringify({ version: 1, targets: ['claude'], skills: [id, 'plan'] }));
    assert.deepEqual(readCloneManifest(d).skills, replaceRetired([id, 'plan']), `inline copy agrees on ${id} → ${successor}`);
  }
});

// ── fixtures: a harness with the shape an older version left behind ──────────────────────────

const ARGS = ['onboard', '--target', 'claude', '--technical-level', 'technical', '--accompaniment', 'L1',
  '--project-kind', 'software', '--software-scope', 'complex', '--workflow', 'main', '--goal', 'Una API de facturación'];
function built(targets = 'claude') {
  // Real path: the CLI records absolute paths from process.cwd(), which resolves /var → /private/var
  // on macOS, and the fixture must write state in the same spelling the CLI does.
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-retired-')));
  execFileSync('git', ['init', '-q'], { cwd });
  const args = ARGS.map((a) => (a === 'claude' ? targets : a));
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(run(cwd, args).stdout)?.[1];
  assert.ok(planId, 'fixture: a plan');
  const out = run(cwd, [...args, '--accept-plan', planId]);
  assert.match(out.stdout, /RSC_ONBOARDING_(READY|INCOMPLETE)/, out.stdout + out.stderr);
  return cwd;
}

function digestPath(path) {
  if (!existsSync(path)) return 'missing';
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return createHash('sha256').update(`link:${readlinkSync(path)}`).digest('hex');
  if (stat.isDirectory()) {
    const rows = readdirSync(path).sort().map((name) => `${name}:${digestPath(join(path, name))}`);
    return createHash('sha256').update(`dir:${rows.join('|')}`).digest('hex');
  }
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// Writes into a freshly built harness exactly what 2.0.20 left: the three skills materialised in
// `.rsc/skills/` and linked from `.claude/skills/`, owned in the state file, declared in `.rsc.json`
// and inside the accepted plan — whose id is recomputed, because a receipt is only a receipt if it
// still matches what was accepted.
function ageToOldShape(cwd, targets = ['claude']) {
  const versions = JSON.parse(readFileSync(join(cwd, '.rsc', '.base-versions.json'), 'utf8'));
  for (const id of RETIRED) {
    const base = join(cwd, '.rsc', 'skills', id);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'SKILL.md'), `---\nname: ${id}\ndescription: Use when an old harness had ${id}.\n---\n\n# ${id}\n`);
    versions[id] = versions.orient;
  }
  for (const target of targets) {
    const paths = targetPaths(target, undefined, cwd);
    const state = JSON.parse(readFileSync(paths.stateFile, 'utf8'));
    for (const id of RETIRED) {
      symlinkSync(`../../.rsc/skills/${id}`, paths.skillDir(id));
      state.skills[id] = { files: [paths.skillDir(id)], base: join(cwd, '.rsc', 'skills', id) };
    }
    writeFileSync(paths.stateFile, JSON.stringify(state, null, 2));
  }
  writeFileSync(join(cwd, '.rsc', '.base-versions.json'), JSON.stringify(versions, null, 2));

  const manifestPath = join(cwd, '.rsc.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const receipt = manifest.onboarding;
  const oldId = receipt.acceptedPlanId;
  const plan = receipt.plan;
  plan.policy.skills = [...new Set([...plan.policy.skills, ...RETIRED])].sort();
  const rel = (abs) => abs.slice(cwd.length + 1);
  const added = RETIRED.flatMap((id) => [`.rsc/skills/${id}`, ...targets.map((t) => rel(targetPaths(t, undefined, cwd).skillDir(id)))]);
  plan.governedPaths = [...new Set([...plan.governedPaths, ...added])].sort();
  plan.record.accompaniment = 'L1';
  const newId = identifyPlan(plan);
  receipt.acceptedPlanId = newId;
  manifest.skills = [...new Set([...manifest.skills, ...RETIRED])].sort();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const name of ['installation-plan.md', 'decisions.md']) {
    const file = join(cwd, '02-DOCS', 'wiki', 'harness', name);
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll(oldId, newId));
  }
  const profile = join(cwd, '02-DOCS', 'wiki', 'harness', 'user-profile.md');
  writeFileSync(profile, readFileSync(profile, 'utf8').replace(/^technical_level: .*$/m, (line) => `${line}\naccompaniment_level: L1`));
  // Sealed as the old version would have sealed them: every governed artifact as it now stands.
  for (const path of plan.governedPaths.filter((p) => p !== '.rsc.json' && p !== '.rsc/backups/')) {
    receipt.artifactDigests[path] = digestPath(join(cwd, path.replace(/\/$/, '')));
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

// Any sync rewrites the per-target state ledger and, here, the base-version ledger — measured on a
// harness that never had a retired skill: a plain same-version `sync` already reports the first. That
// is how verification treats every sync, not something the retirement introduced, so it is the one
// difference tolerated below; nothing about skills, governed paths or the profile may appear.
const SYNC_NOISE = /^governed content differs at (\.claude\/skills\/\.rsc-state\.json|\.rsc\/\.base-versions\.json)$/;

test('upgrade: sync on an old harness that names bro, eli5 and show-me lands on the successors, healthy and without drift', { timeout: 300000 }, () => {
  const cwd = built();
  ageToOldShape(cwd);
  const paths = targetPaths('claude', undefined, cwd);
  // The fixture really is the old shape.
  assert.ok(existsSync(join(paths.skillDir('bro'), 'SKILL.md')), 'fixture: bro on disk');
  const before = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  assert.equal(identifyPlan(before.onboarding.plan), before.onboarding.acceptedPlanId, 'fixture: receipt intact');
  assert.ok(before.onboarding.plan.policy.skills.includes('bro'), 'fixture: receipt names bro');
  assert.deepEqual(verifyOnboarding(cwd, before.onboarding.plan, before.onboarding.acceptedPlanId)
    .filter((d) => !/installed skills differ/.test(d)), [], 'fixture: sealed coherently (only the not-yet-synced state differs)');

  const sync = run(cwd, ['sync', '--target', 'claude']);
  assert.equal(sync.status, 0, sync.stderr);

  for (const id of RETIRED) {
    assert.ok(!existsSync(paths.skillDir(id)), `${id} link removed`);
    assert.ok(!existsSync(join(cwd, '.rsc', 'skills', id)), `${id} base removed`);
  }
  const state = JSON.parse(readFileSync(paths.stateFile, 'utf8'));
  for (const id of RETIRED) assert.ok(!(id in state.skills), `${id} gone from state`);
  for (const id of ['unslop', 'orient']) {
    assert.ok(id in state.skills, `${id} in state`);
    assert.ok(existsSync(join(paths.skillDir(id), 'SKILL.md')), `${id} on disk`);
  }
  const after = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  for (const id of RETIRED) assert.ok(!after.skills.includes(id), `${id} gone from the living list`);
  assert.deepEqual(after.onboarding, before.onboarding, 'the receipt is never rewritten');

  const drift = verifyOnboarding(cwd, after.onboarding.plan, after.onboarding.acceptedPlanId);
  assert.deepEqual(drift.filter((d) => !SYNC_NOISE.test(d)), []);

  const doctor = run(cwd, ['doctor', '--target', 'claude', '--json']);
  const report = JSON.parse(doctor.stdout);
  assert.deepEqual(report.missing, []);
  assert.equal(report.healthy, true, JSON.stringify({ h: report.hookWired, a: report.missingAgents, c: report.missingCommands }));
  assert.equal(doctor.status, 0);
  assert.ok(!report.contextBudget.findings.some((f) => f.id === 'manifest-divergence' || f.id === 'floor-missing'),
    JSON.stringify(report.contextBudget.findings.map((f) => f.summary)));
});

test('sync never deletes a same-named directory rsc does not own', { timeout: 300000 }, () => {
  const cwd = built();
  const paths = targetPaths('claude', undefined, cwd);
  mkdirSync(paths.skillDir('bro'), { recursive: true });
  writeFileSync(join(paths.skillDir('bro'), 'SKILL.md'), '# my own bro\n');
  const sync = run(cwd, ['sync', '--target', 'claude']);
  assert.equal(sync.status, 0, sync.stderr);
  assert.equal(readFileSync(join(paths.skillDir('bro'), 'SKILL.md'), 'utf8'), '# my own bro\n');
});

test('rsc add bro says it was retired, installs unslop, and exits 0', { timeout: 300000 }, () => {
  const cwd = built();
  const paths = targetPaths('claude', undefined, cwd);
  const out = run(cwd, ['add', 'bro', '--target', 'claude']);
  assert.equal(out.status, 0, out.stderr);
  assert.doesNotMatch(out.stderr, /unknown skill/);
  assert.match(out.stdout, /bro .*retired.*unslop/i);
  assert.ok(existsSync(join(paths.skillDir('unslop'), 'SKILL.md')));
  assert.ok(!existsSync(paths.skillDir('bro')));
  const eli5 = run(cwd, ['add', 'eli5', '--target', 'claude']);
  assert.equal(eli5.status, 0, eli5.stderr);
  assert.match(eli5.stdout, /eli5 .*retired.*orient/i);
});

// ── review findings on the retirement ──────────────────────────────────────────────────────────

test('re-onboarding that drops an assistant still holding a retired skill reaches READY (no recovery loop)', { timeout: 300000 }, () => {
  const cwd = built('claude,codex');
  ageToOldShape(cwd, ['claude', 'codex']);
  const args = ARGS; // claude only: codex is dropped, so its old install is removed
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(run(cwd, args).stdout)?.[1];
  assert.ok(planId);
  const out = run(cwd, [...args, '--accept-plan', planId]);
  assert.doesNotMatch(out.stdout + out.stderr, /RSC_PREVIOUS_INSTALL_INCOMPATIBLE|RSC_ONBOARDING_INCOMPLETE:/, out.stderr);
  assert.match(out.stdout, /RSC_ONBOARDING_(READY|INCOMPLETE) /);
  assert.ok(!existsSync(join(cwd, '.codex', 'rsc', 'bro')), 'the dropped assistant\'s retired link is gone');
});

test('the upgrade sync is undoable: restoring its backup brings the retired skills back whole', { timeout: 300000 }, () => {
  const cwd = built();
  ageToOldShape(cwd);
  assert.equal(run(cwd, ['sync', '--target', 'claude']).status, 0);
  assert.ok(!existsSync(join(cwd, '.rsc', 'skills', 'bro')), 'fixture: sync pruned bro');
  const restore = run(cwd, ['restore', 'latest']);
  assert.equal(restore.status, 0, restore.stderr);
  const paths = targetPaths('claude', undefined, cwd);
  for (const id of RETIRED) {
    assert.ok(existsSync(join(paths.skillDir(id), 'SKILL.md')), `${id} link and base restored`);
  }
  const doctor = run(cwd, ['doctor', '--target', 'claude', '--json']);
  assert.deepEqual(JSON.parse(doctor.stdout).missing, []);
});

test('syncing one assistant keeps a retired base another assistant still records', { timeout: 300000 }, () => {
  const cwd = built('claude,codex');
  ageToOldShape(cwd, ['claude', 'codex']);
  assert.equal(run(cwd, ['sync', '--target', 'claude']).status, 0);
  assert.ok(!existsSync(targetPaths('claude', undefined, cwd).skillDir('bro')), 'claude pruned its link');
  assert.ok(existsSync(join(cwd, '.codex', 'rsc', 'bro', 'SKILL.md')), 'codex link still resolves');
  const doctor = JSON.parse(run(cwd, ['doctor', '--target', 'codex', '--json']).stdout);
  assert.deepEqual(doctor.missing, []);
  assert.equal(run(cwd, ['sync', '--target', 'codex']).status, 0);
  assert.ok(!existsSync(join(cwd, '.rsc', 'skills', 'bro')), 'the last holder lets the base go');
  assert.ok(!existsSync(join(cwd, '.codex', 'rsc', 'bro')));
});

test('rsc uninstall bro on an old, un-synced harness removes it', { timeout: 300000 }, () => {
  const cwd = built();
  ageToOldShape(cwd);
  const out = run(cwd, ['uninstall', 'bro', '--target', 'claude']);
  assert.equal(out.status, 0, out.stderr);
  assert.doesNotMatch(out.stderr, /unknown skill/);
  assert.ok(!existsSync(targetPaths('claude', undefined, cwd).skillDir('bro')));
  const state = JSON.parse(readFileSync(targetPaths('claude', undefined, cwd).stateFile, 'utf8'));
  assert.ok(!('bro' in state.skills));
});

test('doctor does not call an assistant healthy over a dangling retired link', { timeout: 300000 }, () => {
  const cwd = built('claude,codex');
  ageToOldShape(cwd, ['claude', 'codex']);
  rmSync(join(cwd, '.rsc', 'skills', 'bro'), { recursive: true, force: true });
  const out = run(cwd, ['doctor', '--target', 'codex', '--json']);
  const report = JSON.parse(out.stdout);
  assert.ok(report.missing.some((m) => m.id === 'bro'), JSON.stringify(report.missing));
  assert.equal(report.healthy, false);
  assert.equal(out.status, 1);
});
