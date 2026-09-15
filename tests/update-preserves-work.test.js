import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildOnboardingPlan, scanProject } from '../scripts/lib/onboarding.js';

// Two field reports from the same user, on the same day, both about updating a harness that was
// already working. Neither is exotic: one is what happens to anyone who ever ran `rsc add`, the
// other is what happens to anyone on Windows.

const RECORD = {
  technicalLevel: 'mixed',
  accompaniment: 'L2',
  projectKind: 'software',
  softwareScope: 'small',
  goal: 'a marketing site',
  targets: ['claude'],
};

/** The skills a plan would end up installing — they live in `decisions`, not in a flat list. */
const plannedSkills = (plan) => plan.decisions
  .filter((d) => d.kind === 'skill' && d.state === 'selected')
  .map((d) => d.id);

function project({ declared = [], extraDirs = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-update-'));
  writeFileSync(join(root, 'package.json'), '{"name":"web"}\n');
  if (declared.length) {
    writeFileSync(join(root, '.rsc.json'), JSON.stringify({
      version: 1, targets: ['claude'], skills: declared, ownSkills: [], catalogVersion: '1.3.6',
    }, null, 2));
  }
  for (const d of extraDirs) mkdirSync(join(root, d), { recursive: true });
  return root;
}

// ── 1. Updating deletes the skills the user added ────────────────────────────────────────────────
//
// Reported as "la actualización volvió a borrar seis skills" — SEO/GEO, Astro, landing copy, brand
// identity, press kit, articles. Those are catalog skills the user had added with `rsc add`, and
// "volvió a" is the tell: it is not a one-off, it happens on every update.
//
// The set of skills is recomputed from the profile and the detected stacks alone, and never united
// with what `.rsc.json` already declares — then everything in the state that is not in that fresh set
// is deleted from disk. So an update means: recompute from scratch, delete what the user chose.
//
// The manifest is where the team's decision lives. Ignoring it is how a tool deletes someone's work
// while reporting success.

const ADDED = ['seo-geo', 'astro', 'landing-copy', 'brand-identity', 'press-kit', 'article-writing'];

test('an update keeps the skills the user added with `rsc add`', () => {
  const root = project({ declared: ['orient', 'suggest', ...ADDED] });
  const plan = buildOnboardingPlan({ ...RECORD }, scanProject(root));
  const skills = plannedSkills(plan);
  const kept = ADDED.filter((id) => skills.includes(id));
  assert.deepEqual(
    kept.sort(),
    [...ADDED].sort(),
    `an update dropped ${ADDED.filter((id) => !skills.includes(id)).join(', ')} — these are on disk and declared in .rsc.json, and the next step deletes whatever the plan leaves out`,
  );
});

test('a declared skill that is not in the catalog is not invented into the plan', () => {
  const root = project({ declared: ['orient', 'this-skill-does-not-exist'] });
  const plan = buildOnboardingPlan({ ...RECORD }, scanProject(root));
  assert.ok(
    !plannedSkills(plan).includes('this-skill-does-not-exist'),
    'preserving what the manifest declares must not become trusting it blindly — an unknown id has nothing to install',
  );
});

test('a project with no manifest is unaffected — a first install still decides for itself', () => {
  const root = project();
  const plan = buildOnboardingPlan({ ...RECORD }, scanProject(root));
  const skills = plannedSkills(plan);
  assert.ok(skills.length > 0, 'the profile still drives a fresh install');
  assert.ok(!skills.includes('seo-geo'), 'and nothing is carried in from a manifest that is not there');
});

// ── 2. A folder the OS will not let us read kills the whole install ──────────────────────────────
//
// Reported from a real Windows box: updating the harness in the home folder dies walking
// `Temp\WinSAT`, a directory Windows protects. Same failure on 1.3.2 and 1.3.6, so it has never
// worked there.
//
// The scan calls `readdirSync` bare. One EPERM and the entire onboarding is over — for a directory
// whose contents could not matter less to what this project is.
//
// The safe form already exists three files away, in `detect-repo.js`: `try { readdirSync(d) } catch
// { return [] }`. It was written once and not reused, which is the ordinary way a codebase ends up
// with one robust path and one fragile one.

test('a directory the OS refuses to read is skipped, not fatal', () => {
  const root = project({ extraDirs: ['src', 'protected'] });
  writeFileSync(join(root, 'src', 'index.js'), 'export const a = 1;\n');
  const locked = join(root, 'protected');
  chmodSync(locked, 0o000); // the POSIX stand-in for Windows' Temp\WinSAT

  try {
    const evidence = scanProject(root);
    assert.ok(evidence, 'the scan must survive a directory it cannot open');
    assert.ok(evidence.sourceFileCount >= 1, 'and must still see the files it CAN read');
  } finally {
    chmodSync(locked, 0o755);
    rmSync(root, { recursive: true, force: true });
  }
});
