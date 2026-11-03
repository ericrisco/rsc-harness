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
  asdd: [/decision queue/i, /rsc risk/, /review ledger/, /human approv/i],
  specify: [/What the user can do/, /What result they get/, /What it must respect/, /How it proves it/],
  clarify: [/gap checklist/i, /changes what gets built/, /suposición tomada/, /decision queue/i],
  tasks: [/risk forecast/i, /rsc risk/],
  implement: [/rsc risk/, /review ledger round/, /decision queue/i, /not run/i, /traceab/i],
  review: [/closing review/i, /REVIEW\.md/, /review ledger/, /review escapes/],
  verify: [/not run/i, /rollback/i],
  ship: [/How to revert/, /human approval/i, /rsc risk/],
  constitution: [/REVIEW\.md/],
  ftd: [/rsc risk/, /`asdd`/],
};

for (const [id, markers] of Object.entries(MARKERS)) {
  test(`${id} describes its part of ASDD`, () => {
    const body = skill(id);
    for (const m of markers) assert.match(body, m, `${id} lacks ${m}`);
  });
}
