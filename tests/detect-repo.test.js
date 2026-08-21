import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectRepo, detectRepoProfile } from '../scripts/detect-repo.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'rsc-')); }

test('detects nextjs from package.json', () => {
  const d = tmp();
  writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { next: '15' } }));
  assert.ok(detectRepo(d).includes('nextjs'));
});

test('detects go from go.mod', () => {
  const d = tmp();
  writeFileSync(join(d, 'go.mod'), 'module x');
  assert.ok(detectRepo(d).includes('go'));
});

test('empty repo returns []', () => {
  assert.deepEqual(detectRepo(tmp()), []);
});

test('detectRepoProfile reports node package manager, scripts, runners and verify commands', () => {
  const d = tmp();
  writeFileSync(join(d, 'package.json'), JSON.stringify({
    scripts: {
      test: 'vitest run',
      lint: 'eslint .',
      typecheck: 'tsc --noEmit',
      build: 'next build'
    },
    dependencies: { next: '15', react: '19' },
    devDependencies: { vitest: '^2.0.0', '@playwright/test': '^1.0.0' }
  }, null, 2));
  writeFileSync(join(d, 'pnpm-lock.yaml'), '');

  const profile = detectRepoProfile(d);

  assert.deepEqual(profile.packageManagers, ['pnpm']);
  assert.ok(profile.stacks.includes('nextjs'));
  assert.ok(profile.testRunners.includes('vitest'));
  assert.ok(profile.testRunners.includes('playwright'));
  assert.equal(profile.scripts.test, 'vitest run');
  assert.deepEqual(profile.commands.verify, ['pnpm run lint', 'pnpm run typecheck', 'pnpm run test', 'pnpm run build']);
  assert.equal(profile.strictTdd, true);
});

test('detectRepoProfile reports python and go test capabilities', () => {
  const d = tmp();
  writeFileSync(join(d, 'pyproject.toml'), '[tool.pytest.ini_options]\nasyncio_mode = "auto"\n');
  writeFileSync(join(d, 'go.mod'), 'module x\n');

  const profile = detectRepoProfile(d);

  assert.ok(profile.stacks.includes('fastapi'));
  assert.ok(profile.stacks.includes('go'));
  assert.ok(profile.testRunners.includes('pytest'));
  assert.ok(profile.testRunners.includes('go test'));
  assert.ok(profile.commands.apply.includes('pytest'));
  assert.ok(profile.commands.verify.includes('go test ./...'));
});

test('detectRepoProfile detects monorepo workspaces', () => {
  const d = tmp();
  mkdirSync(join(d, 'packages'), { recursive: true });
  writeFileSync(join(d, 'package.json'), JSON.stringify({ workspaces: ['packages/*'] }));

  const profile = detectRepoProfile(d);

  assert.equal(profile.monorepo, true);
  assert.ok(profile.signals.includes('package.json#workspaces'));
});

// --- frontend detection beyond React ---------------------------------------
// Before motion-craft-skills, `detectRepo` equated "frontend" with React or Next: a Vue, Svelte,
// Astro, Angular or Solid repo got no design skill at all, even though the catalog ships a skill
// for each of those frameworks. The umbrella is meant to be installed in every frontend repo, so
// the detection has to actually know what a frontend repo is.
// Spec: 02-DOCS/wiki/sdd/specs/motion-craft-skills.md
const FRONTEND_FRAMEWORKS = [
  { dep: 'next', stack: 'nextjs' },
  { dep: 'react', stack: 'nextjs' },
  { dep: 'vue', stack: 'vue-nuxt' },
  { dep: 'nuxt', stack: 'vue-nuxt' },
  { dep: 'svelte', stack: 'svelte' },
  { dep: 'astro', stack: 'astro' },
  { dep: '@angular/core', stack: 'angular' },
  { dep: 'solid-js', stack: 'solid-js' },
];

for (const { dep, stack } of FRONTEND_FRAMEWORKS) {
  test(`a ${dep} repo is recognised as frontend: gets design, design-eng and ${stack}`, () => {
    const d = tmp();
    writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { [dep]: '1' } }));
    const found = detectRepo(d);
    assert.ok(found.includes('design-eng'), `${dep} repo did not get the frontend umbrella: ${found.join(', ')}`);
    assert.ok(found.includes('design'), `${dep} repo did not get design: ${found.join(', ')}`);
    assert.ok(found.includes(stack), `${dep} repo did not get ${stack}: ${found.join(', ')}`);
  });
}

test('a flutter repo gets the design skills too — it has a UI, just not a web one', () => {
  const d = tmp();
  writeFileSync(join(d, 'pubspec.yaml'), 'name: app');
  const found = detectRepo(d);
  assert.ok(found.includes('flutter'));
  assert.ok(found.includes('design'));
});

test('a backend-only repo gets NO frontend umbrella', () => {
  // The other half of the gate. An umbrella recommended everywhere is noise, and noise is how a
  // recommendation gets ignored (P7).
  const d = tmp();
  writeFileSync(join(d, 'go.mod'), 'module x');
  writeFileSync(join(d, 'requirements.txt'), 'fastapi\n');
  const found = detectRepo(d);
  assert.ok(!found.includes('design-eng'), `a backend repo was handed the umbrella: ${found.join(', ')}`);
  assert.ok(!found.includes('design'), `a backend repo was handed design: ${found.join(', ')}`);
});

test('a package.json with no frontend dependency at all gets no umbrella', () => {
  const d = tmp();
  writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { express: '5', pg: '8' } }));
  const found = detectRepo(d);
  assert.ok(!found.includes('design-eng'), `an express API was handed the umbrella: ${found.join(', ')}`);
});
