import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillsForProfile } from '../scripts/lib/manifest.js';
import { buildTextCorpus, cosine } from '../scripts/lib/text-rank.js';

// The base install is the one set every rsc user pays for on every turn, whether or not a skill
// fires (P5). Two things about it were declared and unchecked until this file existed: WHICH skills
// it contains, and that the menu label and the README say the same thing the manifest says. A
// hand-kept enumeration in a label is parallel accounting (P3) and it lies quietly.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const rscCli = readFileSync(join(ROOT, 'scripts/rsc.js'), 'utf8');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

// The set, spelled out once. Changing the base install means changing this line ON PURPOSE.
const BASE = ['bro', 'eli5', 'harness', 'init', 'orient', 'show-me', 'suggest', 'unslop'];

test('the base install is exactly the declared set', () => {
  assert.deepEqual(skillsForProfile(manifest, 'minimal').sort(), [...BASE].sort());
});

test('the permanent floor stays inside the base install', async () => {
  const { DEFAULT_SKILL_FLOOR } = await import('../scripts/lib/default-skill-floor.js');
  // The floor is what gets installed no matter what the user picked. A floor skill outside the
  // base set would mean "Base install" quietly installs something the base set does not name.
  for (const id of DEFAULT_SKILL_FLOOR) assert.ok(BASE.includes(id), `floor skill outside base: ${id}`);
});

test('the wizard label is read from the profile, not enumerated by hand', () => {
  const line = rscCli.split('\n').find((l) => l.includes("key: 'base'"));
  assert.ok(line, "the wizard still offers a 'base' choice");
  assert.match(line, /baseIds\.length/, 'the label counts the real profile');
  // MUTANT: re-hardcoding the roster in the label is the regression this guards.
  for (const id of BASE) {
    assert.doesNotMatch(line, new RegExp(`\\b${id}\\b`), `label hardcodes ${id} instead of reading the profile`);
  }
});

test('the README names every base skill on its minimal-profile line', () => {
  const line = readme.split('\n').find((l) => l.includes('--profile minimal'));
  assert.ok(line, 'the README still documents the minimal profile');
  const missing = BASE.filter((id) => !line.includes(id));
  assert.deepEqual(missing, [], `README minimal line is missing: ${missing.join(', ')}`);
});

test('no two base skills compete for the same request', () => {
  // The catalog at large tolerates description overlap up to 0.74 (linkedin-carousels ↔
  // linkedin-content). The base set does not get that slack: two owners for one request, in the
  // set every user has installed, is a routing coin flip paid on every turn. Highest pair today:
  // harness ↔ init at 0.30.
  const CEILING = 0.5;
  const corpus = buildTextCorpus(manifest.skills);
  const offenders = [];
  for (let i = 0; i < BASE.length; i += 1) {
    for (let j = i + 1; j < BASE.length; j += 1) {
      const score = cosine(corpus.vectors.get(BASE[i]), corpus.vectors.get(BASE[j]));
      if (score >= CEILING) offenders.push(`${BASE[i]} ↔ ${BASE[j]} (${score.toFixed(2)})`);
    }
  }
  assert.deepEqual(offenders, [], `base-install description collisions: ${offenders.join(', ')}`);
});

test('the boundary between the two writing skills is declared on both sides', () => {
  // A one-sided boundary is not a boundary: whichever description the ranker happens to like wins.
  const bro = readFileSync(join(ROOT, 'skills/bro/SKILL.md'), 'utf8');
  const unslop = readFileSync(join(ROOT, 'skills/unslop/SKILL.md'), 'utf8');
  assert.match(bro, /`unslop`/, 'bro points at unslop');
  assert.match(unslop, /`bro`/, 'unslop points at bro');
  const broCases = readFileSync(join(ROOT, 'skills/bro/evals/cases.yaml'), 'utf8');
  const unslopCases = readFileSync(join(ROOT, 'skills/unslop/evals/cases.yaml'), 'utf8');
  assert.match(broCases, /route_to: "unslop"/, 'bro has a negative that routes to unslop');
  assert.match(unslopCases, /route_to: "bro"/, 'unslop has a negative that routes to bro');
});
