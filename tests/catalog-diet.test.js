import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { descriptionWeight, DESCRIPTION_CEILING_CHARS } from '../scripts/build-manifest.js';

// Invariants for the catalog's context weight. See 02-DOCS/wiki/sdd/specs/catalog-diet.md.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(ROOT, 'skills');

test('published package carries no compiled Python bytecode', () => {
  // package.json `files` is a whitelist, and it overrides .gitignore: __pycache__ shipped to every
  // user despite being gitignored. Assert the tarball, not the config, so the fix cannot regress
  // via some other exclusion mechanism.
  const res = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(res.status, 0, `npm pack failed: ${res.stderr}`);
  const files = JSON.parse(res.stdout)[0].files.map((f) => f.path);
  const junk = files.filter((p) => p.includes('__pycache__') || p.endsWith('.pyc'));
  assert.deepEqual(junk, [], `bytecode in the published tarball: ${junk.join(', ')}`);
});

test('every references/ file is reachable from the body that owns it', () => {
  // Progressive disclosure only pays off if the body points at the file. An unlinked reference is
  // never loaded from its own skill, so it is dead weight in the package.
  const orphans = [];
  for (const id of readdirSync(SKILLS)) {
    const refs = join(SKILLS, id, 'references');
    const skillMd = join(SKILLS, id, 'SKILL.md');
    if (!existsSync(refs) || !existsSync(skillMd)) continue;
    const body = readFileSync(skillMd, 'utf8');
    for (const f of readdirSync(refs, { recursive: true, withFileTypes: true })) {
      if (!f.isFile()) continue;
      const rel = relative(join(SKILLS, id), join(f.parentPath ?? f.path, f.name));
      if (!body.includes(rel) && !body.includes(f.name)) orphans.push(`${id}:${rel}`);
    }
  }
  assert.deepEqual(orphans, [], `unlinked references: ${orphans.join(', ')}`);
});

test('description weight is measured, and the hard limit still holds', () => {
  const w = descriptionWeight();
  assert.equal(w.count, readdirSync(SKILLS).length, 'every skill measured');
  assert.ok(w.total > 0 && w.mean > 0, 'reports a real figure');
  // The soft ceiling is advisory while the catalog migrates; the schema limit is what must hold.
  const overHardLimit = w.over.filter((r) => r.chars > 1024);
  assert.deepEqual(overHardLimit, [], `descriptions past the 1024-char hard limit: ${overHardLimit.map((r) => r.id).join(', ')}`);
  assert.ok(DESCRIPTION_CEILING_CHARS < 1024, 'the advisory ceiling sits below the hard limit');
});

test('the rubric rewards the smallest body that routes, not a line quota', () => {
  const rubric = readFileSync(join(ROOT, 'scripts/skill-rubric.md'), 'utf8');
  assert.doesNotMatch(rubric, /120[–-]400 lines/, 'the 120-line floor is gone');
  assert.match(rubric, /ceiling, not a target/i, 'size is expressed as a ceiling');
  assert.match(rubric, /Length is a cost, never a credit/i, 'reviewers told not to reward volume');
  assert.doesNotMatch(rubric, /Spanish\/Catalan phrasing/, 'no per-language trigger-list quota');
  assert.match(rubric, /discriminative power/i, 'descriptions judged on discrimination');
});
