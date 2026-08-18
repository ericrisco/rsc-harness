#!/usr/bin/env node
// knowledge-doctor.js — report what the wiki claims that no longer holds.
//
// Usage: node scripts/knowledge-doctor.js [--json]
//
// Report-only, on demand. NOT in `rsc doctor`, NOT in any hook, NOT in the release gates — decided in
// clarify (2026-08-18): the precision a check needs scales with how intrusive it is, and an asked-for
// report tolerates noise an automatic one does not. Accepted cost, stated here so nobody has to
// rediscover it: drift is not detected on its own. Somebody has to run this.
//
// It NEVER writes. Not a file, not a mkdir. `02-DOCS/` is untracked (P9): there is no undo here.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { diagnose, CLASSES } from './lib/knowledge-doctor.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIKI = join(REPO, '02-DOCS', 'wiki');

const walk = (dir) => readdirSync(dir).flatMap((e) => {
  const p = join(dir, e);
  return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.md') ? [p] : []);
});

// Injected so the pure library never touches git. Cached: the same ref is asked about repeatedly.
const refCache = new Map();
const refExists = (ref) => {
  if (refCache.has(ref)) return refCache.get(ref);
  let ok = false;
  for (const spec of [`${ref}^{commit}`, `refs/tags/${ref}`]) {
    try { execFileSync('git', ['cat-file', '-e', spec], { cwd: REPO, stdio: 'ignore' }); ok = true; break; }
    catch { /* not this kind of ref */ }
  }
  refCache.set(ref, ok);
  return ok;
};

function main() {
  const asJson = process.argv.includes('--json');
  if (!existsSync(WIKI)) {
    // Not a failure: a repo without the harness has nothing to audit.
    console.log('knowledge-doctor: no hay 02-DOCS/wiki/ — nada que auditar.');
    process.exit(0);
  }
  const files = walk(WIKI);
  const indexPath = join(WIKI, 'index.md');
  const indexText = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null;

  const docs = files.map((p) => {
    const rel = relative(WIKI, p);
    return {
      path: relative(REPO, p),
      rel,
      dir: dirname(rel) === '.' ? '' : dirname(rel),
      text: readFileSync(p, 'utf8'),
      // Only artifacts the chain consumes are expected in the Knowledge map; an article is not.
      indexable: rel.startsWith('sdd/specs/') || rel.startsWith('sdd/verifications/'),
    };
  });

  const report = diagnose({ docs, indexText, refExists });
  if (asJson) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

  const byClass = (c) => report.candidates.filter((x) => x.cls === c);
  console.log(`# knowledge-doctor — ${report.scanned} documentos\n`);
  if (!report.candidates.length) {
    console.log('Sin candidatos. Nada que triar.\n');
  } else {
    console.log(`${report.candidates.length} candidato(s), ordenados por coste de equivocarse:\n`);
    for (const c of report.candidates) {
      console.log(`- **${c.cls}** · \`${c.path}:${c.line}\`${c.uncertain ? ' · _incierto_' : ''}`);
      console.log(`  - señal: ${c.signal}`);
      console.log(`  - esperado: ${c.expected} · encontrado: ${c.found}`);
    }
    console.log('');
    for (const [label, cls] of [['se contradice', CLASSES.CONTRADICTS], ['ya no aplica', CLASSES.STALE], ['fuera de sitio', CLASSES.MISPLACED]]) {
      console.log(`- ${label}: ${byClass(cls).length}`);
    }
    console.log('');
  }
  console.log('## Lo que NO se miró\n');
  for (const n of report.notLookedAt) console.log(`- ${n}`);
  console.log('\nEl juicio es de `knowledge-ops` o tuyo: esto estrecha, no cura. No se ha escrito nada.');
  process.exit(0);
}

main();
