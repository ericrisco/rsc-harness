import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RETIRED_SKILLS } from '../scripts/lib/retired-skills.js';

// ASDD's prose half: each phase skill carries its part of the method. Presence, not behaviour —
// the behaviour of the deterministic pieces is pinned in asdd-loop.test.js and asdd-spec-gate.test.js.
// Spec: 02-DOCS/wiki/sdd/specs/asdd-v4.md (criteria 1, 2, 9).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const skill = (id) => readFileSync(join(ROOT, 'skills', id, 'SKILL.md'), 'utf8');

test('asdd replaces sdd, and an old harness reads sdd as asdd', () => {
  assert.ok(existsSync(join(ROOT, 'skills', 'asdd', 'SKILL.md')));
  assert.ok(!existsSync(join(ROOT, 'skills', 'sdd')));
  assert.equal(RETIRED_SKILLS.sdd, 'asdd');
  assert.match(skill('asdd'), /^name: asdd$/m);
});

test('no skill still points at the retired dispatcher', () => {
  for (const id of readdirSync(join(ROOT, 'skills'))) {
    const p = join(ROOT, 'skills', id, 'SKILL.md');
    if (id === 'asdd' || !existsSync(p)) continue; // asdd names its predecessor on purpose
    assert.doesNotMatch(readFileSync(p, 'utf8'), /\.\.\/sdd\/|`sdd`/, `${id} still names the sdd skill`);
  }
});

const MARKERS = {
  asdd: [/decision queue/i, /rsc risk/, /review ledger/, /human approv/i, /review-after/, /execution_mode: automatic/, /no remote/i],
  specify: [/What the user can do/, /What result they get/, /What it must respect/, /How it proves it/],
  clarify: [/gap checklist/i, /changes what gets built/, /suposición tomada/, /decision queue/i, /review-after/],
  tasks: [/risk forecast/i, /rsc risk/],
  implement: [/rsc risk/, /review ledger round/, /review ledger panel/, /decision queue/i, /not run/i, /traceab/i],
  review: [/closing review/i, /REVIEW\.md/, /review ledger/, /review escapes/, /review ledger panel/, /"failure_scenario"/, /parked/],
  verify: [/not run/i, /rollback/i],
  ship: [/How to revert/, /human approval/i, /rsc risk/, /blocking/, /no remote/i],
  constitution: [/REVIEW\.md/],
  ftd: [/rsc risk/, /`asdd`/],
};

for (const [id, markers] of Object.entries(MARKERS)) {
  test(`${id} describes its part of ASDD`, () => {
    const body = skill(id);
    for (const m of markers) assert.match(body, m, `${id} lacks ${m}`);
  });
}

// Both shapes the 4.0.0 skills used: a checklist item and an instruction. Checked against the old text.
const WRITES_ROOT_CLAUDE = [
  /root `?CLAUDE\.md`?\s*`?##\s*Knowledge map`?\s*(pointer )?(has|gets|row)/i,
  /(add|write|append|update)[^.\n]{0,60}root `?CLAUDE\.md`?[^.\n]{0,40}(Knowledge map|row|index)/i,
];

test('no ASDD phase asks to edit the root CLAUDE.md (it is tier 2; the index is 02-DOCS/wiki/index.md)', () => {
  // Instructions wrap across lines; read each file as one line so a wrapped one is still seen.
  const flat = (t) => t.replace(/\s*\n\s*/g, ' ');
  const files = ['asdd', 'constitution', 'specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement', 'verify', 'review', 'ship', 'debug']
    .flatMap((id) => [[`${id}`, skill(id)], [`${id}/evals`, existsSync(join(ROOT, 'skills', id, 'evals', 'cases.yaml')) ? readFileSync(join(ROOT, 'skills', id, 'evals', 'cases.yaml'), 'utf8') : '']]);
  files.push(['plan-template', readFileSync(join(ROOT, 'skills', 'plan', 'references', 'plan-template.md'), 'utf8')]);
  for (const [name, text] of files) {
    for (const re of WRITES_ROOT_CLAUDE) assert.doesNotMatch(flat(text), re, `${name} still writes the root CLAUDE.md`);
    assert.doesNotMatch(flat(text), /index(ed|es)? (it )?in the root CLAUDE\.md/i, `${name} still expects the root CLAUDE.md index`);
  }
});

test('no skill sends the user to an npm script that only exists inside the rsc package', () => {
  for (const id of readdirSync(join(ROOT, 'skills'))) {
    const p = join(ROOT, 'skills', id, 'SKILL.md');
    if (existsSync(p)) assert.doesNotMatch(readFileSync(p, 'utf8'), /npm run spec:gate/, id);
  }
});
