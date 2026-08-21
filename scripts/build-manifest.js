import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { parseFrontmatter } from './lib/frontmatter.js';
import { fenceBalance } from './lib/skill-lint.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(ROOT, 'skills');

function skillDirs(base = SKILLS) {
  return readdirSync(base).filter((d) => {
    try {
      return statSync(join(base, d)).isDirectory() && statSync(join(base, d, 'SKILL.md')).isFile();
    } catch {
      return false;
    }
  });
}

export function buildManifest() {
  const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const ids = skillDirs();
  const known = new Set(ids);
  const skills = ids.map((id) => {
    const fm = parseFrontmatter(readFileSync(join(SKILLS, id, 'SKILL.md'), 'utf8'));
    return {
      id,
      description: fm.description,
      tags: fm.tags || [],
      recommends: (fm.recommends || []).filter((r) => known.has(r)),
      profiles: fm.profiles || [],
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
  return { version, counts: { skills: skills.length }, skills };
}

export function validateFrontmatter() {
  const ajv = new Ajv({ allErrors: true });
  const schema = JSON.parse(readFileSync(join(ROOT, 'schema/frontmatter.schema.json'), 'utf8'));
  const validate = ajv.compile(schema);
  const ids = skillDirs();
  const errors = [];
  for (const id of ids) {
    const fm = parseFrontmatter(readFileSync(join(SKILLS, id, 'SKILL.md'), 'utf8'));
    if (!validate(fm)) errors.push(`${id}: ${ajv.errorsText(validate.errors)}`);
  }
  return errors;
}

// A skill body whose code-block delimiters do not pair renders half its content as one code block,
// and every other gate stays green while it happens. Deterministic defect, deterministic check —
// and it lives here so `prepublishOnly` can never ship one.
export function validateBodies(base = SKILLS) {
  const errors = [];
  for (const id of skillDirs(base)) {
    const r = fenceBalance(readFileSync(join(base, id, 'SKILL.md'), 'utf8'));
    if (!r.balanced) {
      errors.push(`${id}: unbalanced code-block delimiter opened at line ${r.opened} (${r.fences} found)`);
    }
  }
  return errors;
}

// A skill's `description` is in context on every turn it is installed, invoked or not, so the
// catalog's total description weight is the one number that scales with the catalog itself.
// The hard failure stays at the schema limit; this reports the soft ceiling the rubric asks for,
// because turning 257 skills red the day the rubric changed would help nobody.
export const DESCRIPTION_CEILING_CHARS = 350;

export function descriptionWeight() {
  const rows = skillDirs().map((id) => {
    const fm = parseFrontmatter(readFileSync(join(SKILLS, id, 'SKILL.md'), 'utf8'));
    return { id, chars: (fm.description || '').length };
  });
  const total = rows.reduce((s, r) => s + r.chars, 0);
  const over = rows.filter((r) => r.chars > DESCRIPTION_CEILING_CHARS).sort((a, b) => b.chars - a.chars);
  return { total, count: rows.length, mean: Math.round(total / (rows.length || 1)), over };
}

function main() {
  const arg = process.argv[2];
  const out = join(ROOT, 'manifest.json');
  if (arg === '--validate') {
    const errs = [...validateFrontmatter(), ...validateBodies()];
    if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
    console.log('frontmatter OK');
    console.log('skill bodies OK (code-block delimiters balanced)');
    const w = descriptionWeight();
    console.log(
      `description weight: ${(w.total / 1024).toFixed(1)} KB across ${w.count} skills `
      + `(mean ${w.mean} chars) · ${w.over.length} over the ${DESCRIPTION_CEILING_CHARS}-char ceiling`,
    );
    if (w.over.length) {
      console.log(`  heaviest: ${w.over.slice(0, 5).map((r) => `${r.id} (${r.chars})`).join(', ')}`);
    }
    return;
  }
  const manifest = buildManifest();
  const json = JSON.stringify(manifest, null, 2) + '\n';
  if (arg === '--check') {
    let current = '';
    try { current = readFileSync(out, 'utf8'); } catch { /* missing */ }
    if (current !== json) { console.error('manifest.json is stale — run `npm run manifest`'); process.exit(1); }
    console.log(`manifest OK (${manifest.counts.skills} skills)`);
    return;
  }
  writeFileSync(out, json);
  console.log(`wrote manifest.json (${manifest.counts.skills} skills)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
