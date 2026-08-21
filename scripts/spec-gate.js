#!/usr/bin/env node
// Runs the `specify` exit gate over written specs. Report-only: it never edits a spec.
//
// Not wired into `prepublishOnly`, and that is deliberate: specs live under 02-DOCS, which is never
// tracked (principle 9), so a publish gate depending on them would fail in any clean clone. This is
// the phase's own instrument, and the author's.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { specCompleteness } from './lib/spec-gate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = join(ROOT, '02-DOCS', 'wiki', 'sdd', 'specs');

function defaultTargets() {
  try {
    return readdirSync(DEFAULT_DIR)
      .filter((f) => f.endsWith('.md') && !f.endsWith('.plan.md'))
      .map((f) => join(DEFAULT_DIR, f));
  } catch {
    return [];
  }
}

function main() {
  const args = process.argv.slice(2);
  const targets = args.length ? args : defaultTargets();
  if (!targets.length) {
    console.log('no specs found — pass a path, or write one to 02-DOCS/wiki/sdd/specs/');
    return;
  }

  let failed = 0;
  for (const path of targets) {
    const r = specCompleteness(readFileSync(path, 'utf8'));
    const name = basename(path);
    if (r.ok) {
      const typed = r.openPoints.length - r.untyped.length;
      console.log(`PASS  ${name} — ${r.openPoints.length} open point(s), ${typed} typed`);
      if (r.untyped.length) {
        console.log(`      untyped (treated as open questions): ${r.untyped.length}`);
      }
    } else {
      failed += 1;
      console.log(`FAIL  ${name}`);
      if (r.missing.length) console.log(`      missing section(s): ${r.missing.join(', ')}`);
      if (r.empty.length) console.log(`      section(s) with no content: ${r.empty.join(', ')}`);
    }
  }

  // A green here is narrower than the rule it enforces, so it says so every run rather than
  // letting the reader assume the gate covered more than it did.
  console.log(`\n${targets.length - failed}/${targets.length} pass. Not checked by this gate:`);
  for (const u of specCompleteness('').unchecked) console.log(`  - ${u}`);
  if (failed) process.exit(1);
}

main();
