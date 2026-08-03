// eval-lint.test.js — tests for the linter itself.
//
// `route_to names a real skill` was listed in the rubric as a deterministic gate and
// checked by nothing for the catalog's whole life, so evals accumulated routes to
// skills that were never authored. Fixing the linter without testing the linter would
// just move the decoration one level up, so these tests run the real script against
// fixture catalogs and assert it FAILS when it should.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const LINT = join(REPO, 'scripts', 'eval-lint.sh');

// A fixture catalog: scripts/eval-lint.sh next to a skills/ tree, so the script's
// own repo-root resolution (parent of scripts/) points at the fixture.
function fixture(skills) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-lint-'));
  mkdirSync(join(root, 'scripts'), { recursive: true });
  copyFileSync(LINT, join(root, 'scripts', 'eval-lint.sh'));
  for (const [id, cases] of Object.entries(skills)) {
    mkdirSync(join(root, 'skills', id, 'evals'), { recursive: true });
    writeFileSync(join(root, 'skills', id, 'SKILL.md'), `---\nname: ${id}\n---\n`);
    writeFileSync(join(root, 'skills', id, 'evals', 'cases.yaml'), cases);
  }
  return root;
}

// Enough entries to clear the count minimums, so route_to is the only variable.
const cases = (routeTo) => `should_trigger:
${'  - prompt: "t"\n    why: "w"\n'.repeat(5)}should_not_trigger:
  - prompt: "n"
    route_to: ${routeTo}
    why: "w"
${'  - prompt: "n"\n    route_to: "none"\n    why: "w"\n'.repeat(3)}capability:
  - scenario: "s"
    must_include:
      - "x"
`;

const run = (root) => spawnSync('bash', [join(root, 'scripts', 'eval-lint.sh')], { encoding: 'utf8' });

test('eval-lint: a route_to naming a skill that does not exist FAILS the build', () => {
  const root = fixture({ alpha: cases('"ghost-skill"'), beta: cases('"none"') });
  const r = run(root);
  assert.equal(r.status, 1, 'a stale route must fail, or the gate is decorative');
  assert.match(r.stdout, /alpha\s+FAIL: route_to does not resolve: ghost-skill/);
  assert.match(r.stdout, /RESULT: FAIL/);
});

test('eval-lint: a route_to naming a real sibling PASSES', () => {
  const root = fixture({ alpha: cases('"beta"'), beta: cases('"alpha"') });
  const r = run(root);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /0 failure/);
});

test('eval-lint: "none" and "external:<name>" are accepted, bare "external:" is not', () => {
  const ok = run(fixture({ alpha: cases('"none"'), beta: cases('"external:claude-api"') }));
  assert.equal(ok.status, 0, ok.stdout);
  const bad = run(fixture({ alpha: cases('"external:"'), beta: cases('"none"') }));
  assert.equal(bad.status, 1, 'an empty external name is not a route');
  assert.match(bad.stdout, /external.*no name/);
});

test('eval-lint: every target in a multi-value route_to is checked', () => {
  // A list, and a string holding several targets — a checker that only looked at the
  // first would let the rest rot.
  const list = run(fixture({ alpha: cases('["beta", "ghost-skill"]'), beta: cases('"none"') }));
  assert.equal(list.status, 1, 'a list must be fully checked');
  assert.match(list.stdout, /ghost-skill/);
  const inline = run(fixture({ alpha: cases('"beta or ghost-two"'), beta: cases('"none"') }));
  assert.equal(inline.status, 1, 'an inline alternation must be fully checked');
  assert.match(inline.stdout, /ghost-two/);
});

test('eval-lint: the real catalog resolves every route_to', () => {
  // The catalog is the artifact users get; this is the regression guard for the
  // three stale routes this change found.
  const r = spawnSync('bash', [LINT], { encoding: 'utf8', cwd: REPO });
  assert.equal(r.status, 0, r.stdout.split('\n').filter((l) => l.includes('FAIL')).join('\n'));
  assert.match(r.stdout, /route_to must resolve/, 'the run states the rule it enforces');
});
