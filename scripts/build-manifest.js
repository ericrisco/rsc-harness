import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { parseFrontmatter } from './lib/frontmatter.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(ROOT, 'skills');

function skillDirs() {
  return readdirSync(SKILLS).filter((d) => {
    try {
      return statSync(join(SKILLS, d)).isDirectory() && statSync(join(SKILLS, d, 'SKILL.md')).isFile();
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
    const errs = validateFrontmatter();
    if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
    console.log('frontmatter OK');
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
