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

// withFileTypes, NOT statSync — this matches scripts/drift-check.js:167, the precedent the plan cited
// as exact and then diverged from. statSync FOLLOWS symlinks, so a symlink under the wiki let the walk
// read outside the declared zone (reporting the logical path, hiding the escape), a dangling symlink
// crashed the whole report with ENOENT, and a symlink cycle crashed it with ELOOP. dirent.isDirectory()
// does none of that: a symlink is neither a file nor a directory here, so it is skipped.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  if (e.isDirectory()) return walk(p);
  if (e.isFile() && p.endsWith('.md')) return [p];
  return []; // symlinks, sockets, anything else: not our business, and not a crash
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

  // AC7 says an unreadable document is a candidate with its reason, never a silent skip. The first
  // version read "unreadable" as "frontmatter unparseable" only, so a chmod-000 file or a dangling
  // symlink threw out of readFileSync and took the WHOLE report with it — worse than a silent skip.
  const unreadable = [];
  const docs = files.map((p) => {
    const rel = relative(WIKI, p);
    let text;
    try {
      text = readFileSync(p, 'utf8');
    } catch (e) {
      unreadable.push({
        path: relative(REPO, p), line: 1, cls: 'fuera-de-sitio', uncertain: true,
        signal: `no se pudo leer el fichero (${e.code || e.message})`,
        expected: 'un documento legible', found: e.code || 'error de lectura',
      });
      return null;
    }
    return {
      path: relative(REPO, p),
      rel,
      dir: dirname(rel) === '.' ? '' : dirname(rel),
      text,
      // Only artifacts the chain consumes are expected in the Knowledge map; an article is not.
      indexable: rel.startsWith('sdd/specs/') || rel.startsWith('sdd/verifications/'),
    };
  }).filter(Boolean);

  // Project artifacts outside the wiki: skill ids and script basenames. The library cannot read the
  // repo (it is pure by design), so the caller that can, does.
  const extraSlugs = [];
  for (const [dir, strip] of [['skills', null], ['scripts', /\.(js|mjs|sh)$/], ['scripts/lib', /\.(js|mjs)$/]]) {
    try {
      for (const e of readdirSync(join(REPO, dir), { withFileTypes: true })) {
        if (strip && e.isFile()) extraSlugs.push(e.name.replace(strip, ''));
        else if (!strip && e.isDirectory()) extraSlugs.push(e.name);
      }
    } catch { /* a missing directory is not an error here */ }
  }

  const report = diagnose({ docs, indexText, refExists, extraSlugs });
  // Unreadable files are candidates too, and they sort first: a document nobody can open is the one
  // whose staleness nobody can check.
  if (unreadable.length) report.candidates = [...unreadable, ...report.candidates];
  if (asJson) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

  const byClass = (c) => report.candidates.filter((x) => x.cls === c);
  console.log(`# knowledge-doctor — ${report.scanned} documentos\n`);
  if (!report.candidates.length) {
    console.log('Sin candidatos. Nada que triar.\n');
  } else {
    console.log(`${report.candidates.length} candidato(s), ordenados por coste de equivocarse:\n`);
    // Filenames are interpolated into markdown, and a filename may contain newlines and backticks. A
    // crafted name rendered a structurally valid FORGED candidate while the tally below still read 0 —
    // and the consumer of this report (knowledge-ops) archives and overwrites files. Neutralise the
    // three characters that can break out of the line.
    const safe = (s) => String(s).replace(/[\r\n]+/g, '⏎').replace(/`/g, "'");
    for (const c of report.candidates) {
      console.log(`- **${c.cls}** · \`${safe(c.path)}:${c.line}\`${c.uncertain ? ' · _incierto_' : ''}`);
      console.log(`  - señal: ${safe(c.signal)}`);
      console.log(`  - esperado: ${safe(c.expected)} · encontrado: ${safe(c.found)}`);
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
