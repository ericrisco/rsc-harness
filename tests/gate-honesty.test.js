import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Four rules imported from the old-coder skill after the ago-2026 investigation, each closing a
// class of claim the harness could not check. See 02-DOCS/wiki/sdd/specs/gate-honesty.md.
//
// WHAT THIS GUARDS, AND WHAT IT DOES NOT — read this before trusting its green.
//
// This file checks that the four rules are still PRESENT in the skills that own them. It does NOT
// check that an agent obeys them. It is, by its own subject matter, "a gate that fails closed
// perfectly while guarding a spelling rather than a behavior" — the exact limit the negative-control
// rule in verify/SKILL.md tells you to state where you state the pass. So: green here means the
// rules have not silently eroded out of the catalog, which is the drift this repo has been bitten
// by repeatedly (constitution P2). It is not behavioral verification of the rules themselves; that
// needs real runs of `verify` and `specify` and is recorded as pending, not done.
//
// Markers are deliberately two-or-three independent signals per rule rather than one exact
// sentence, so rewording the prose does not break the test while deleting the rule does.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const skill = (id) => readFileSync(join(ROOT, 'skills', id, 'SKILL.md'), 'utf8');
// Prose assertions run against whitespace-collapsed text: skill bodies are hard-wrapped, so a
// sentence matched with single spaces breaks the moment the wrap lands mid-phrase.
const prose = (id) => skill(id).replace(/\s+/g, ' ');

const TESTING_SKILLS = ['testing-py', 'testing-web', 'testing-go'];
const TOUCHED = [...TESTING_SKILLS, 'verify', 'specify'];

// ------------------------------------------------------------ rule A: mutation is a real layer

test('A — the three testing skills document mutation as its own layer', () => {
  for (const id of TESTING_SKILLS) {
    const body = skill(id);
    assert.match(body, /^## Mutation:/m, `${id}: no mutation section`);
    // The load-bearing argument: coverage measures execution, mutation measures detection.
    assert.match(
      body,
      /which code ran/i,
      `${id}: mutation section must contrast coverage (what ran) with detection`,
    );
    assert.match(body, /\bnotice(d)?\b/i, `${id}: must say whether a test would NOTICE the bug`);
  }
});

test('A — each ecosystem names its real command, or says it has none', () => {
  assert.match(skill('testing-py'), /mutmut run/, 'testing-py must name mutmut');
  assert.match(skill('testing-web'), /stryker run/, 'testing-web must name Stryker');
  // Go has no dependable tool; the skill must say so rather than inventing one.
  assert.match(
    skill('testing-go'),
    /no mature mutation tool/i,
    'testing-go must state that no mature tool exists',
  );
});

test('A — a survivor may be equivalent, and is never killed with a fake assertion', () => {
  for (const id of TESTING_SKILLS) {
    const body = skill(id);
    assert.match(body, /equivalent/i, `${id}: must allow for semantically equivalent survivors`);
    assert.match(
      body,
      /non-behaviour|non-behavior/i,
      `${id}: must forbid killing a survivor with an assertion about non-behaviour`,
    );
  }
});

test('A — scoped to changed code and scaled to risk, never a default toll', () => {
  for (const id of TESTING_SKILLS) {
    assert.match(skill(id), /risk/i, `${id}: mutation must be calibrated by risk (P7)`);
  }
  assert.match(skill('testing-web'), /mutate/, 'testing-web must show scoping via `mutate`');
});

test('A — a hand-rolled runner must prove it executed every mutant', () => {
  // The sharp edge: a runner that can report a kill it never ran only ever INFLATES the score, so
  // the defect can never surface as a red run. py (bytecode cache) and go (manual procedure) are
  // the two places a hand-rolled runner is actually plausible.
  for (const id of ['testing-py', 'testing-go']) {
    const body = skill(id);
    assert.match(body, /inflate/i, `${id}: must say the defect can only inflate the score`);
    assert.match(
      body,
      /never (show up as|surface as) a red|never surface as a red/i,
      `${id}: must say why that means no failing run will reveal it`,
    );
  }
  assert.match(
    skill('testing-py'),
    /PYTHONDONTWRITEBYTECODE|__pycache__/,
    'testing-py must name the bytecode-cache mechanism',
  );
});

// ------------------------------------------------- rule B: a home-grown gate proves it can fail

test('B — verify requires a home-grown gate to be watched failing', () => {
  const body = skill('verify');
  // Anchor on the HEADING, not the phrase. A bare /prove it can fail/ also matches the one-line
  // reminder in the anti-patterns table, so it survived a mutant that gutted this whole section —
  // found by the negative control in 02-DOCS/wiki/sdd/verifications/gate-honesty-2026-08-17.md.
  // The heading gained "— and that it can pass" on 2026-08-18; anchored on the phrase within a
  // heading line rather than at end-of-line, so extending the title does not break the pin.
  assert.match(
    body,
    /^#+ .*prove it can fail.*$/im,
    'verify: the rule needs its own section, not just an anti-pattern row',
  );
  assert.match(body, /fail-open/i, 'verify: must name the fail-open failure mode');
  assert.match(
    body,
    /known-bad/i,
    'verify: must require a known-bad input, not just "test the gate"',
  );
});

test('B — the rule now requires BOTH controls: can-fail and can-pass', () => {
  // The missing symmetric half, added 2026-08-18 after the integrity gate over-blocked twice on its
  // first real use. Twelve mutants had proven it could fail; none asked whether it could pass, so the
  // defect shipped. Rule stated at 02-DOCS/wiki/sdd/verifications/eval-run2-2026-08-18.md.
  const body = prose('verify');
  assert.match(
    body,
    /known-GOOD input/i,
    'verify: a gate must also be watched passing on a known-good input',
  );
  assert.match(
    body,
    /[Bb]oth directions or neither/,
    'verify: half-testing a gate leaves the half that fires on every run untested',
  );
  assert.match(
    body,
    /[Oo]ver-blocking is not the safe side/,
    'verify: must say why over-blocking is not caution',
  );
  // The concrete failure shape, so the rule is actionable rather than a slogan.
  assert.match(
    body,
    /is not "the write targets that location"/,
    'verify: must name the text-vs-structure trap that caused it',
  );
  assert.match(body, /prefer matching \*\*structure\*\*|matching structure/i, 'verify: must prescribe structure over text');
});

test('B — third-party tools are exempt, and the exemption is explicit', () => {
  const body = skill('verify');
  assert.match(body, /exempt/i, 'verify: third-party tools must be exempted explicitly');
  assert.match(
    body,
    /pytest.*mypy|mypy.*pytest/s,
    'verify: name the earned-behavior tools so the scope is unambiguous',
  );
});

test('B — the rule carries its own limit, in the same section', () => {
  const body = skill('verify');
  // Without this the rule promises coverage of the constraint and delivers one case.
  assert.match(
    body,
    /guard a spelling rather than a behavior|guarding a spelling/i,
    'verify: must state that a gate can fail closed and still guard a spelling',
  );
  assert.match(
    body,
    /does \*\*not\*\* prove|does not prove/i,
    'verify: must state what one negative control does NOT buy',
  );
});

test('B — a must-find-nothing grep has three outcomes, not two', () => {
  const body = skill('verify');
  assert.match(body, /three outcomes/i, 'verify: the grep case must be spelled out');
  assert.match(body, /\|\| true/, 'verify: must forbid `|| true`');
  assert.match(body, /2>\/dev\/null/, 'verify: must forbid swallowing stderr');
});

test('B — our own verify.sh SKIP is declared as the known fail-open', () => {
  const body = skill('verify');
  assert.match(
    body,
    /SKIP a missing tool instead of failing|known fail-open/i,
    'verify: the stack verify.sh SKIP must be named as a known fail-open, not left implied',
  );
});

// ------------------------------------------------------- rule C: an answer is not an approval

test('C — specify separates answering a question from approving the spec', () => {
  const body = skill('specify');
  assert.match(
    body,
    /answer to a question is not an approval/i,
    'specify: the rule itself must be present',
  );
  assert.match(
    body,
    /no longer exists/i,
    'specify: must say a pre-question approval approves a document that no longer exists',
  );
  assert.match(body, /two exchanges/i, 'specify: must give the two-exchange sequence');
});

test('C — the recommended-option trap is named', () => {
  const body = skill('specify');
  assert.match(
    body,
    /recommended-option/i,
    'specify: must name the recommended-option shape as the easy failure',
  );
  assert.match(
    body,
    /consent \*?looks\*? implied|looks implied/i,
    'specify: must say why it fools the reader — consent looks implied',
  );
});

test('C — silence and an unrelated go-ahead are not approval either', () => {
  const body = skill('specify');
  assert.match(body, /silence/i, 'specify: silence must be excluded explicitly');
  assert.match(
    body,
    /cannot quote the words/i,
    'specify: must give the quotable-words test for whether approval exists',
  );
});

test('C — autopilot stays valid but is recorded as autopilot', () => {
  const body = skill('specify');
  assert.match(body, /[Aa]utopilot is still valid/, 'specify: autopilot must not be broken by this');
  assert.match(
    body,
    /not item by item/i,
    'specify: autopilot must be recorded as such, not as item-by-item approval',
  );
});

// ------------------------------- rule D: the record says what it measured, and what it did not

test('D — the verification record binds to a source state', () => {
  const body = skill('verify');
  // Anchor on the FIELD in the template, not a mention of it. A bare /source_state:/ also matches
  // the prose that explains the field, so it survived a mutant that removed the field from the
  // template and left the prose talking about it — the "guards a spelling, not the thing" failure
  // this very rule warns about, caught by its own negative control.
  assert.match(
    body,
    /^source_state: \S+/m,
    'verify: the record template must carry an actual source_state field',
  );
  assert.match(body, /dirty/i, 'verify: must record whether the tree was dirty');
  assert.match(
    body,
    /A date does not identify code|not decoration/i,
    'verify: must say why a date alone is insufficient',
  );
});

test('D — layers that did not run are split three ways', () => {
  const body = skill('verify');
  for (const label of ['NO-APLICA', 'HERRAMIENTA-AUSENTE', 'SUSTITUIDA']) {
    assert.match(body, new RegExp(label), `verify: missing the ${label} state`);
  }
  // SUSTITUIDA is the dangerous one: it must never be written as a pass.
  assert.match(
    body,
    /never write this as a pass|never as a pass/i,
    'verify: SUSTITUIDA must be forbidden from reading as a pass',
  );
  assert.match(
    body,
    /cannot detect/i,
    'verify: a substitute must state what it cannot detect',
  );
});

test('D — dismissed findings carry evidence, one line each', () => {
  const body = skill('verify');
  assert.match(body, /Hallazgos descartados/, 'verify: the record needs a dismissals section');
  assert.match(
    body,
    /indistinguishable from/i,
    'verify: must say why a bare dismissal is worthless',
  );
});

test('D — all numbers come from one fresh run after the last edit', () => {
  assert.match(
    skill('verify'),
    /one fresh run/i,
    'verify: must require a single fresh run after the last edit',
  );
});

// ------------------------------------------------------------------- constitution invariants

test('P5 — no touched skill body exceeds the 400-line ceiling', () => {
  for (const id of TOUCHED) {
    const lines = skill(id).split('\n').length;
    assert.ok(lines <= 400, `${id}: ${lines} lines exceeds the 400-line ceiling (P5)`);
  }
});

test('P3 — the P2 appearance count lives only in puertas-y-mecanismos, never in a skill body', () => {
  // Two specs once contradicted each other because each pinned an ordinal in its own prose. The
  // counter lives in one table; nothing else may state an nth appearance.
  const ordinal =
    /\b(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+(appearance|occurrence)\b/i;
  for (const id of TOUCHED) {
    assert.doesNotMatch(skill(id), ordinal, `${id}: must not pin an ordinal of the P2 counter`);
  }
});

test('the four rules live in skills that actually ship in the package', () => {
  // A rule in a skill nobody installs is a rule nobody gets. Guards a path typo, nothing deeper.
  const shipped = new Set(readdirSync(join(ROOT, 'skills')));
  for (const id of TOUCHED) {
    assert.ok(shipped.has(id), `${id}: not present in skills/`);
  }
});
