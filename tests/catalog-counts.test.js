import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMAINS } from '../scripts/lib/domains.js';

// Every "N skills" in the published material is a claim about the catalog, and until this file
// existed nothing checked any of them: the README, the site and llms.txt all said 264 while the
// catalog held 278, and the number had been wrong through fourteen releases. The count lives in
// exactly one place (the manifest, built from the skill directories on disk) and the docs must
// agree with it. P3: the content is the ledger, so read the ledger.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).counts.skills;

const DOCS = [
  'README.md',
  'site/llms.txt',
  'site/index.html',
  'site/es/index.html',
  'site/cover.html',
  'site/cover-anatomy.html',
];

// The stat blocks put the number and its label in separate elements, so tags come out first.
const text = (file) => readFileSync(join(ROOT, file), 'utf8').replace(/<[^>]+>/g, '');

test('every "N skills" claim in the published docs matches the manifest', () => {
  const wrong = [];
  for (const file of DOCS) {
    const body = text(file);
    for (const m of body.matchAll(/(\d{2,4})\s*(?:quality-gated\s+)?skills/gi)) {
      if (Number(m[1]) !== SKILLS) wrong.push(`${file}: "${m[0].trim()}" (catalog has ${SKILLS})`);
    }
    // The shields.io badge carries the count inside the URL, past the label.
    for (const m of body.matchAll(/badge\/skills-(\d+)-/g)) {
      if (Number(m[1]) !== SKILLS) wrong.push(`${file}: badge says ${m[1]} (catalog has ${SKILLS})`);
    }
  }
  assert.deepEqual(wrong, [], `stale skill counts:\n  ${wrong.join('\n  ')}`);
});

test('every "N domains" claim matches the domain map', () => {
  const wrong = [];
  for (const file of DOCS) {
    for (const m of text(file).matchAll(/(\d{1,3})\s*(?:domains|dominios)/gi)) {
      if (Number(m[1]) !== DOMAINS.length) wrong.push(`${file}: "${m[0].trim()}" (there are ${DOMAINS.length})`);
    }
  }
  assert.deepEqual(wrong, [], `stale domain counts:\n  ${wrong.join('\n  ')}`);
});

// NOT checked here, on purpose: composed sentences where the number is not next to its noun
// ("installed 8 of 281 — the other 273 stay" in the cover art), and the rendered PNGs generated
// from those pages. Both need a human eye; naming them beats pretending the gate covers them.
