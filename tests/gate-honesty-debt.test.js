import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The four debts gate-honesty (1.0.12) declared and did not pay. See
// 02-DOCS/wiki/sdd/specs/gate-honesty-debt.md.
//
// WHAT THIS GUARDS, AND WHAT IT DOES NOT — same honesty as gate-honesty.test.js.
//
// Most of this file checks that rules are still PRESENT in the skills that own them, not that an
// agent obeys them. It is a drift guard, not behavioural verification.
//
// TWO assertions here ARE structural facts rather than spellings, and they are the ones that
// matter most, because they protect third-party repos rather than our prose:
//   * `gap()` must not touch the failure variable in either verify.sh — a GAP reports, it never
//     starts failing a repo that passes today.
//   * neither GAP summary block may exit.
// The live proof that those hold end-to-end (exit 0 with a GAP present, exit 1 when a real check
// fails alongside a GAP) was run against toy projects and is recorded in
// 02-DOCS/wiki/sdd/verifications/gate-honesty-debt-2026-08-17.md with the commands. It is not
// re-run here: it needs pytest/ruff/go installed, and a test that silently skips when a tool is
// missing is the exact fail-open this whole spec is about.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const skill = (id) => readFileSync(join(ROOT, 'skills', id, 'SKILL.md'), 'utf8');
// Prose assertions run against whitespace-collapsed text. Skill bodies are hard-wrapped, so a
// sentence matched with single spaces fails the moment the wrap lands mid-phrase — four assertions
// here did exactly that on the first run, none of them because the rule was missing. Structural
// assertions (headings, script bodies, YAML) deliberately keep the raw text.
const prose = (id) => skill(id).replace(/\s+/g, ' ');
const script = (id) => readFileSync(join(ROOT, 'skills', id, 'scripts/verify.sh'), 'utf8');
const cases = (id) => readFileSync(join(ROOT, 'skills', id, 'evals/cases.yaml'), 'utf8');

// The capability block only — an item asserted anywhere in the file would also match a
// should_trigger prompt, which is not where behaviour is graded.
const capabilityBlock = (id) => {
  const text = cases(id);
  const i = text.search(/^capability:\s*$/m);
  assert.ok(i !== -1, `${id}: no capability block in cases.yaml`);
  return text.slice(i);
};

const COVERAGE_SCRIPTS = ['fastapi', 'go'];
const TESTING = ['testing-py', 'testing-web', 'testing-go'];
const TOUCHED_SKILLS = [...TESTING, 'verify', 'specify', 'review', 'implement'];

// ------------------------------------------------ A: a coverage layer declares if it can fail

test('A — both coverage scripts report a GAP state distinct from PASS/SKIP/FAIL', () => {
  for (const id of COVERAGE_SCRIPTS) {
    const s = script(id);
    assert.match(s, /^\s*gap\(\)/m, `${id}/verify.sh: no gap() helper`);
    assert.match(s, /\bgaps?=0/i, `${id}/verify.sh: no gap counter initialised`);
    assert.match(s, /cannot fail|not gated/i, `${id}/verify.sh: GAP must say why the layer cannot fail`);
  }
});

test('A — INVARIANT: gap() never touches the failure variable', () => {
  // The load-bearing assertion of this file. If a GAP ever set the failure flag, every repo with
  // no coverage threshold would start failing a script that passed yesterday — a silent break of
  // third-party environments, which is precisely what the spec forbade.
  for (const id of COVERAGE_SCRIPTS) {
    const body = script(id).match(/^\s*gap\(\)\s*\{[^}]*\}/m);
    assert.ok(body, `${id}/verify.sh: could not isolate the gap() body`);
    assert.doesNotMatch(
      body[0],
      /FAILED=|failed=|exit\b/,
      `${id}/verify.sh: gap() must not set the failure counter or exit`,
    );
  }
});

test('A — INVARIANT: the GAP summary block does not exit', () => {
  for (const id of COVERAGE_SCRIPTS) {
    const s = script(id);
    // The block guarded by the gap counter, up to the next `fi`.
    const block = s.match(/if \[ "\$(GAPS|gaps)" -(ne|gt) 0 \];? then[\s\S]*?\nfi/);
    assert.ok(block, `${id}/verify.sh: no summary block guarded by the gap counter`);
    assert.doesNotMatch(block[0], /\bexit\b/, `${id}/verify.sh: the GAP summary must not exit`);
  }
});

test('A — the fastapi gate detects an absent coverage threshold, and fails closed doing so', () => {
  const s = script('fastapi');
  assert.match(s, /coverage_threshold_configured/, 'fastapi: no threshold detection');
  assert.match(s, /cov-fail-under\|fail_under|fail_under/, 'fastapi: must look for both flag spellings');
  // A broken scan must not buy a pass — the grep-rc rule from the negative-control layer.
  assert.match(
    s,
    /-ge 2|treating it as absent/,
    'fastapi: a scan that breaks must err toward reporting a gap, not toward a pass',
  );
});

test('A — the go gate states coverage is a report, not a gate', () => {
  const s = script('go');
  assert.match(s, /no threshold|takes no threshold/i, 'go: must say -cover takes no threshold');
  assert.match(s, /REPORT, NOT A GATE|report, not a gate|reported, not gated/i, 'go: must say it plainly');
});

test('A — neither script still claims "all checks passed" while a GAP exists', () => {
  for (const id of COVERAGE_SCRIPTS) {
    assert.match(
      script(id),
      /could fail, passed/,
      `${id}/verify.sh: the success line must be narrowed to checks that could fail`,
    );
  }
});

// ------------------------------------------------------- B: GAP maps to SUSTITUIDA in verify

test('B — verify maps a GAP onto SUSTITUIDA rather than inventing a fourth label', () => {
  const body = prose('verify');
  assert.match(body, /GAP/, 'verify: must name the GAP state');
  assert.match(
    body,
    /do not invent a fourth label/i,
    'verify: must forbid a fourth label, or the taxonomy grows on contact',
  );
  assert.match(
    body,
    /report in place of a gate/i,
    'verify: must explain the mapping — what ran was a report, not a gate',
  );
  assert.match(
    body,
    /unverified criterion.*fails the verdict|fails the verdict/i,
    'verify: a GAP must block the verdict, or the script-side report is decorative (P2)',
  );
});

test('B — verify prefers changed-line coverage over the global percentage', () => {
  const body = prose('verify');
  assert.match(body, /diff-cover/, 'verify: must name the tool that gates changed lines');
  assert.match(
    body,
    /rounding error|barely moves/i,
    'verify: must explain why a global floor passes an untested change',
  );
  assert.match(
    body,
    /guidance, not something the generated/i,
    'verify: must be explicit this is guidance, not wired into the scripts',
  );
});

// -------------------------------------------- C: review's refuters get four inputs, blind first

test('C — review enumerates exactly four inputs for the refuters', () => {
  const body = prose('review');
  assert.match(body, /four inputs/i, 'review: the input set must be named as closed');
  for (const marker of [/task contract/i, /approved spec/i, /exact source state/i, /entry point/i]) {
    assert.match(body, marker, `review: missing input ${marker}`);
  }
  // Without the approved scope changes, a legitimate revision reads as a spec gap.
  assert.match(
    body,
    /scope change a human explicitly approved/i,
    'review: the contract must include approved scope changes, or false positives follow',
  );
});

test('C — review says what the refuters are NOT given', () => {
  const body = prose('review');
  assert.match(body, /do not get|not given/i, 'review: the withheld set must be explicit');
  assert.match(body, /draft verdict/i, 'review: the draft verdict must be withheld');
  assert.match(
    body,
    /needs your justification to stand, it is not proven/i,
    'review: must give the reason the withholding matters',
  );
});

test('C — review requires blind-first recording, append-only afterwards', () => {
  const body = prose('review');
  assert.match(body, /[Bb]lind first|blind-first/, 'review: blind-first must be required');
  assert.match(body, /append-only/i, 'review: the blind record must not be rewritable');
  assert.match(
    body,
    /confirming your framing/i,
    'review: must say what is lost without it — fresh context spent confirming us',
  );
});

test('C — review makes the attack list a deliverable and names the spec-vs-contract class', () => {
  const body = prose('review');
  assert.match(body, /attack list is the deliverable/i, 'review: attack list must be a deliverable');
  assert.match(
    body,
    /indistinguishable from not having looked/i,
    'review: must say why "nothing found" alone is worthless',
  );
  assert.match(body, /Contract vs spec/i, 'review: must name the contract-vs-spec finding class');
  assert.match(
    body,
    /describes \*?inaccurately\*?|describes it inaccurately|describes .* inaccurately/i,
    'review: an approved exclusion is fine; an inaccurately described one is a finding',
  );
});

// ------------------------------------------------------- D: implement forbids manufacturing green

test('D — implement forbids the four ways of manufacturing green', () => {
  const body = prose('implement');
  assert.match(body, /[Nn]ever weaken a test/, 'implement: must forbid weakening a test');
  assert.match(
    body,
    /same step to reach green|in the same step/i,
    'implement: must forbid editing test and implementation in one step',
  );
  assert.match(body, /[Nn]ever mock the unit under test/, 'implement: must forbid mocking the unit under test');
  assert.match(body, /[Nn]ever chase the coverage number/, 'implement: must forbid coverage-chasing');
});

test('D — each prohibition carries its reason, not just the ban', () => {
  const body = prose('implement');
  assert.match(body, /spec conversation/i, 'implement: a wrong-looking test is a spec conversation');
  assert.match(
    body,
    /redefine correctness/i,
    'implement: must say why simultaneous edits are dangerous',
  );
  assert.match(body, /boundaries you don't own|Mock\s+boundaries/i, 'implement: must say what MAY be mocked');
  assert.match(body, /mutation testing exists/i, 'implement: must connect coverage-gaming to mutation');
});

// -------------------------------------- E: the rules are gradeable behaviour in the eval scenarios

test('E — the mutation rule is a gradeable behaviour in all three testing skills', () => {
  for (const id of TESTING) {
    const block = capabilityBlock(id);
    assert.match(block, /mutation/i, `${id}: capability scenario does not grade mutation`);
    // Graded as behaviour ("does not present coverage as proof"), not as a keyword mention.
    assert.match(
      block,
      /[Dd]oes not present/,
      `${id}: the item must grade a behaviour, not a mention`,
    );
    assert.match(block, /equivalent|inflate/i, `${id}: must grade the survivor/runner nuance`);
  }
});

test('E — verify grades all four of the 1.0.12 rules plus the GAP', () => {
  const block = capabilityBlock('verify');
  assert.match(block, /GAP/, 'verify eval: must grade the GAP state');
  assert.match(block, /known-bad input/i, 'verify eval: must grade the negative-control demand');
  assert.match(block, /NO-APLICA/, 'verify eval: must grade the three-way split');
  assert.match(block, /source state/i, 'verify eval: must grade the source-state binding');
  assert.match(block, /dismissed finding/i, 'verify eval: must grade dismissal evidence');
});

test('E — specify grades asking for approval again after an answer', () => {
  const block = capabilityBlock('specify');
  assert.match(block, /asks for approval AGAIN|approval AGAIN/i, 'specify eval: must grade re-asking');
  assert.match(block, /recommended option/i, 'specify eval: must cover the recommended-option case');
  assert.match(block, /autopilot/i, 'specify eval: must grade recording autopilot as autopilot');
});

// ----------------------------------------------------------------- constitution invariants

test('P5 — no touched skill body exceeds the 400-line ceiling', () => {
  for (const id of TOUCHED_SKILLS) {
    const lines = skill(id).split('\n').length;
    assert.ok(lines <= 400, `${id}: ${lines} lines exceeds the 400-line ceiling (P5)`);
  }
});

test('P3 — no skill body pins an ordinal of the P2 appearance counter', () => {
  const ordinal =
    /\b(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+(appearance|occurrence)\b/i;
  for (const id of TOUCHED_SKILLS) {
    assert.doesNotMatch(skill(id), ordinal, `${id}: must not pin an ordinal of the P2 counter`);
  }
});
