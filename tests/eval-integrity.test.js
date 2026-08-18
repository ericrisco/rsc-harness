import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  classifyAgent, findViolations, checkIntegrity, readAgents, ROLE_MARKERS, PROTECTED_PATHS,
} from '../scripts/lib/eval-integrity.js';
import { behavioralGate, scoreFromRaw, formatScorecard } from '../scripts/lib/behavior-score.js';

// skill-behavior-eval promised to run each scenario "with and without the skill" and nothing enforced
// the "without". First real run (2026-08-18): the `verify` baseline read skills/verify/SKILL.md 7×
// AND skills/verify/evals/cases.yaml 4× — the rubric it was graded against — then produced the word
// "SUSTITUIDA", which exists nowhere but that skill. Four of six baselines were clean, which is worse
// than all of them being dirty: the contamination is opportunistic, so identical runs yield different
// lifts and nothing says so. This is the mechanism P2 demands, plus the test of the mechanism.
// Spec: 02-DOCS/wiki/sdd/specs/eval-integrity.md
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = readFileSync(join(ROOT, 'scripts/skill-behavior-eval.workflow.js'), 'utf8');

const agent = (name, role, text) => ({ name, role, text });

// ------------------------------------------------------------------ role classification

test('classifyAgent separates the four arms, grader before treatment', () => {
  // Order matters: a grader transcript quotes the skill body, so a naive check calls it a treatment.
  assert.equal(classifyAgent(`... ${ROLE_MARKERS.grader} ... ${ROLE_MARKERS.treatment} ...`), 'grader');
  assert.equal(classifyAgent(`x ${ROLE_MARKERS.treatment} y`), 'treatment');
  assert.equal(classifyAgent(`x ${ROLE_MARKERS.loader} y`), 'loader');
  assert.equal(classifyAgent('Complete this task fully and concretely.'), 'baseline');
  assert.equal(classifyAgent(''), 'baseline');
  assert.equal(classifyAgent(null), 'baseline');
});

test('the classifier stays tied to the prompts the workflow actually emits', () => {
  // Without this, rewording a prompt silently retires the classifier: every baseline would be
  // misread as something else and every run would start reporting "clean". A fail-open by drift.
  for (const [role, marker] of Object.entries(ROLE_MARKERS)) {
    assert.ok(
      WORKFLOW.includes(marker),
      `marker for ${role} ("${marker}") no longer appears in skill-behavior-eval.workflow.js`,
    );
  }
});

// ------------------------------------------------------------------ violation detection

test('a clean run has no violations', () => {
  const r = findViolations({
    skillId: 'demo',
    agents: [
      agent('a', 'baseline', 'wrote a test file under .rsc/eval-sandbox/demo/baseline-0/'),
      agent('b', 'treatment', 'followed the injected skill'),
    ],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.violations, []);
});

test('a baseline that read the skill is a violation, with a count', () => {
  const r = findViolations({
    skillId: 'demo',
    agents: [agent('base', 'baseline', 'cat skills/demo/SKILL.md ... skills/demo/SKILL.md again')],
  });
  assert.equal(r.ok, false);
  const v = r.violations.find((x) => x.kind === 'baseline-read-skill');
  assert.ok(v, 'expected baseline-read-skill');
  assert.equal(v.count, 2, 'the count is what makes it auditable by hand');
});

test('a baseline that read the RUBRIC is reported separately — it is the answer key', () => {
  const r = findViolations({
    skillId: 'demo',
    agents: [agent('base', 'baseline', 'opened skills/demo/evals/cases.yaml')],
  });
  assert.ok(r.violations.some((x) => x.kind === 'baseline-read-rubric'));
});

test('the TREATMENT reading the skill is not a violation — it is supposed to have it', () => {
  const r = findViolations({
    skillId: 'demo',
    agents: [agent('t', 'treatment', 'skills/demo/SKILL.md skills/demo/evals/cases.yaml')],
  });
  assert.equal(r.ok, true, 'only the control arm is judged on reads');
});

test('the LOADER reading both files is not a violation — that is its job', () => {
  const r = findViolations({
    skillId: 'demo',
    agents: [agent('l', 'loader', 'skills/demo/SKILL.md and skills/demo/evals/cases.yaml')],
  });
  assert.equal(r.ok, true);
});

test('writing into 02-DOCS/wiki is a violation for either arm', () => {
  for (const role of ['baseline', 'treatment']) {
    const r = findViolations({
      skillId: 'demo',
      agents: [agent('x', role, 'Write to 02-DOCS/wiki/sdd/specs/thing.md')],
    });
    assert.ok(
      r.violations.some((x) => x.kind === 'wrote-protected-path'),
      `${role}: expected wrote-protected-path`,
    );
  }
});

test('MENTIONING a protected path without a write verb is not a violation', () => {
  // The grader quotes repo paths constantly; if a mention counted, every run would block and the
  // gate would be useless noise within a week.
  const r = findViolations({
    skillId: 'demo',
    agents: [agent('x', 'baseline', 'the record would normally live in 02-DOCS/wiki/sdd/ somewhere')],
  });
  assert.equal(r.ok, true);
});

test('findViolations refuses to run without a skillId', () => {
  assert.throws(() => findViolations({ agents: [] }), /skillId is required/);
});

// ------------------------------------------------------------------ fail-closed reading

test('checkIntegrity BLOCKS when the transcripts dir is missing', () => {
  const r = checkIntegrity({ skillId: 'demo', transcriptsDir: join(tmpdir(), 'definitely-not-here-xyz') });
  assert.equal(r.blocked, true);
  assert.match(r.reason, /not verifiable/);
});

test('checkIntegrity BLOCKS when no dir is given at all', () => {
  const r = checkIntegrity({ skillId: 'demo' });
  assert.equal(r.blocked, true, '"we could not look" must never render as "we looked and it was fine"');
});

test('checkIntegrity BLOCKS when there is no baseline transcript', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ei-nobase-'));
  writeFileSync(join(dir, 'agent-1.jsonl'), `has ${ROLE_MARKERS.treatment} only`);
  const r = checkIntegrity({ skillId: 'demo', transcriptsDir: dir });
  assert.equal(r.blocked, true);
  assert.match(r.reason, /no baseline transcript/);
});

test('checkIntegrity passes a genuinely clean directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ei-clean-'));
  writeFileSync(join(dir, 'agent-1.jsonl'), 'plain baseline work in .rsc/eval-sandbox/demo/baseline-0/');
  writeFileSync(join(dir, 'agent-2.jsonl'), `treatment ${ROLE_MARKERS.treatment}`);
  const r = checkIntegrity({ skillId: 'demo', transcriptsDir: dir });
  assert.equal(r.ok, true);
  assert.equal(r.blocked, false);
  assert.equal(r.counts.baseline, 1);
});

test('readAgents throws rather than returning empty on a bad path', () => {
  assert.throws(() => readAgents(join(tmpdir(), 'nope-not-real-dir')));
  assert.throws(() => readAgents(''), /required/);
});

// ------------------------------------------------------------------ the third verdict

test('behavioralGate without integrity behaves exactly as before (back-compat)', () => {
  const g = behavioralGate({ absoluteScore: 9, lift: 2, n: 1, dropped: 0 });
  assert.equal(g.pass, true);
  assert.equal(g.blocked, undefined, 'absent integrity must not invent a blocked field');
});

test('violated integrity BLOCKS, and blocked is not the same as failed', () => {
  const g = behavioralGate(
    { absoluteScore: 9.9, lift: 5, n: 1, dropped: 0 },
    { ok: false, reason: 'contaminated', violations: [{ kind: 'baseline-read-skill', agent: 'a', pattern: 'p', count: 3 }] },
  );
  assert.equal(g.pass, false);
  assert.equal(g.blocked, true, 'a passing-looking score must still block');
  assert.match(g.mustFix[0], /baseline-read-skill/);
});

test('a BLOCKED scorecard withholds the absolute and the lift', () => {
  // Printing them next to a block invites reading them anyway, and they are not measurements.
  const scored = scoreFromRaw(
    { skillId: 'demo', scenarios: [] },
    { ok: false, reason: 'contaminated', violations: [{ kind: 'baseline-read-skill', agent: 'a', pattern: 'skills/demo/SKILL.md', count: 3 }] },
  );
  const card = formatScorecard(scored);
  assert.match(card, /BLOCKED/);
  assert.doesNotMatch(card, /absolute/, 'the absolute must not appear on a blocked card');
  assert.doesNotMatch(card, /lift/, 'the lift must not appear on a blocked card');
  assert.match(card, /not a measurement/);
});

test('an unchecked run says so on the verdict line', () => {
  const card = formatScorecard(scoreFromRaw({
    skillId: 'demo',
    scenarios: [{ index: 0, xIsTreatment: true, gradeX: { mustInclude: [{ satisfied: true }], quality: { completeness: 9, actionability: 9, correctness: 9, grounding: 9 } }, gradeY: { mustInclude: [{ satisfied: false }], quality: { completeness: 5, actionability: 5, correctness: 5, grounding: 5 } } }],
  }));
  assert.match(card, /integrity NOT CHECKED/, 'silence must not read as clean');
});

// ------------------------------------------------------------------ the workflow's own guards

test('the workflow gives each arm a distinct write zone', () => {
  assert.match(WORKFLOW, /eval-sandbox/, 'no sandbox path in the prompts');
  assert.match(WORKFLOW, /sandbox\(index, 'baseline'\)/);
  assert.match(WORKFLOW, /sandbox\(index, 'treatment'\)/);
  // Under .rsc/ so an eval write cannot dirty the tracked tree.
  assert.match(WORKFLOW, /\.rsc\/eval-sandbox/);
});

test('the workflow tells the baseline not to read the skill, and why', () => {
  assert.match(WORKFLOW, /Do NOT read anything under skills\//);
  assert.match(WORKFLOW, /there is no control/, 'a prohibition without its reason gets rationalised away');
  assert.match(WORKFLOW, /Do NOT read any evals\/cases\.yaml/);
});

test('the workflow declares the repository read-only for both arms', () => {
  const hits = WORKFLOW.match(/READ-ONLY/g) || [];
  assert.ok(hits.length >= 2, `expected both arms to be told the repo is read-only, found ${hits.length}`);
  assert.equal(PROTECTED_PATHS[0], '02-DOCS/wiki/');
});
