import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONSTITUTION_PATH, constitutionIsDraft, ensureConstitutionDraft, renderConstitutionDraft,
} from '../scripts/lib/constitution-draft.js';
import { HARNESS_FLOOR_CONSTITUTION, missingHarnessFloor } from '../scripts/lib/onboarding-apply.js';

const fresh = () => mkdtempSync(join(tmpdir(), 'rsc-constitution-draft-'));
const plan = (extra = {}) => ({
  record: { projectKind: 'software', softwareScope: 'complex', workflow: 'branches', goal: 'Ship it', targets: ['claude'] },
  evidence: { stacks: ['go'], signals: ['manifest:go.mod'] },
  floorPaths: ['01-TOOLS/_TEMPLATE/', '02-DOCS/wiki/harness/', CONSTITUTION_PATH],
  ...extra,
});

test('the draft is the floor path the plan asks for, and the floor accepts it', () => {
  assert.equal(CONSTITUTION_PATH, HARNESS_FLOOR_CONSTITUTION);
  const cwd = fresh();
  assert.equal(ensureConstitutionDraft(cwd, plan()).created, true);
  assert.deepEqual(missingHarnessFloor(cwd, { floorPaths: [CONSTITUTION_PATH] }), []);
  assert.equal(constitutionIsDraft(cwd), true);
});

test('no SDD floor, no draft', () => {
  const cwd = fresh();
  assert.equal(ensureConstitutionDraft(cwd, plan({ floorPaths: ['02-DOCS/wiki/harness/'] })).created, false);
  assert.deepEqual(readdirSync(cwd), []);
});

test('a dangling symlink where the constitution goes counts as present and is not followed', () => {
  const cwd = fresh();
  const outside = join(fresh(), 'escaped.md');
  mkdirSync(join(cwd, '02-DOCS/wiki/sdd'), { recursive: true });
  symlinkSync(outside, join(cwd, CONSTITUTION_PATH));
  assert.equal(ensureConstitutionDraft(cwd, plan()).created, false);
  assert.equal(existsSync(outside), false, 'nothing written through the link');
});

test('a symlinked sdd directory is refused, never written through', () => {
  const cwd = fresh();
  const outside = fresh();
  mkdirSync(join(cwd, '02-DOCS/wiki'), { recursive: true });
  symlinkSync(outside, join(cwd, '02-DOCS/wiki/sdd'));
  assert.throws(() => ensureConstitutionDraft(cwd, plan()), /RSC_ROOT_AMBIGUOUS/);
  assert.deepEqual(readdirSync(outside), []);
});

test('the user goal stays on one line in the draft', () => {
  const text = renderConstitutionDraft(plan({ record: { ...plan().record, goal: 'a\n## 9. Injected principle\nb' } }));
  assert.doesNotMatch(text, /^## 9\./m);
  assert.match(text, /^- Goal: a ## 9\. Injected principle b$/m);
});

test('only frontmatter status: draft makes a constitution a draft', () => {
  const cwd = fresh();
  mkdirSync(join(cwd, '02-DOCS/wiki/sdd'), { recursive: true });
  writeFileSync(join(cwd, CONSTITUTION_PATH), '# Ratified\n\nstatus: draft\n');
  assert.equal(constitutionIsDraft(cwd), false, 'a body line is not frontmatter');
  writeFileSync(join(cwd, CONSTITUTION_PATH), '---\ntype: constitution\nstatus: draft\n---\n# x\n');
  assert.equal(constitutionIsDraft(cwd), true);
  writeFileSync(join(cwd, CONSTITUTION_PATH), '---\ntype: constitution\nversion: v1.0.0\n---\n# x\n');
  assert.equal(constitutionIsDraft(cwd), false);
});
