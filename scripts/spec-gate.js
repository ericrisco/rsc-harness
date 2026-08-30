#!/usr/bin/env node
// Runs the `specify` exit gate over written specs. Report-only: it never edits a spec.
//
// Not wired into `prepublishOnly`, and that is deliberate: specs live under 02-DOCS, which is never
// tracked (principle 9), so a publish gate depending on them would fail in any clean clone. This is
// the phase's own instrument, and the author's.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { specCompleteness, statusClaims, checkClaims } from './lib/spec-gate.js';

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

// The repository, asked instead of assumed. Returns null when there is nothing to ask — a
// report-only instrument that crashes where it cannot look is worse than one that says so.
function gitProbe(root) {
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  let main;
  try {
    git(['rev-parse', '--git-dir']);
    // Prefer the remote tip — a stale local `main` reports merged work as missing. But CI checks out
    // detached with no `origin/main` and no local `main`, and falling through to "no repository to
    // ask" there means the check silently stops checking exactly where it runs unattended. HEAD is
    // the honest last resort: on CI it IS the branch under test.
    main = ['origin/main', 'main', 'HEAD'].find((ref) => {
      try { git(['rev-parse', '--verify', ref]); return true; } catch { return false; }
    });
    if (!main) throw new Error('no ref to compare against');
  } catch {
    return null;
  }
  return {
    hasCommit: (sha) => { try { git(['cat-file', '-e', `${sha}^{commit}`]); return true; } catch { return false; } },
    isAncestor: (sha) => { try { git(['merge-base', '--is-ancestor', sha, main]); return true; } catch { return false; } },
    // The squash-merge subject carries `(#N)`; --fixed-strings so the parens are not a regex.
    hasPr: (n) => { try { return git(['log', main, '--grep', `(#${n})`, '--fixed-strings', '-1', '--format=%H']) !== ''; } catch { return false; } },
    hasTag: (v) => { try { return git(['tag', '-l', `v${v}`]) !== ''; } catch { return false; } },
  };
}

const statusOf = (text) => (/^status:[ \t]*(.*)$/m.exec(text) || [, ''])[1];

function main() {
  const args = process.argv.slice(2);
  const targets = args.length ? args : defaultTargets();
  if (!targets.length) {
    console.log('no specs found — pass a path, or write one to 02-DOCS/wiki/sdd/specs/');
    return;
  }

  let failed = 0;
  let drifted = 0;
  // One probe per repository, not one for the tool's own. A spec's claims are about the history of
  // the project the spec belongs to — checking them against wherever this script happens to live
  // gives the right answer only by coincidence, and the wrong one the moment the gate is pointed at
  // another checkout.
  const probes = new Map();
  const probeFor = (path) => {
    const dir = dirname(path);
    if (!probes.has(dir)) probes.set(dir, gitProbe(dir));
    return probes.get(dir);
  };
  let anyProbe = false;
  for (const path of targets) {
    const text = readFileSync(path, 'utf8');
    const r = specCompleteness(text);
    const name = basename(path);
    if (r.ok) {
      const typed = r.openPoints.length - r.untyped.length;
      console.log(`PASS  ${name} — ${r.openPoints.length} open point(s), ${typed} typed`);
      if (r.untyped.length) {
        console.log(`      untyped (treated as open questions): ${r.untyped.length}`);
      }
    }
    if (!r.ok) {
      failed += 1;
      console.log(`FAIL  ${name}`);
      if (r.missing.length) console.log(`      missing section(s): ${r.missing.join(', ')}`);
      if (r.empty.length) console.log(`      section(s) with no content: ${r.empty.join(', ')}`);
    }
    // A status that still matches the repository prints nothing: the report grows only where there
    // is something to act on (P5).
    const probe = probeFor(path);
    anyProbe = anyProbe || Boolean(probe);
    for (const v of checkClaims(statusClaims(statusOf(text)), probe)) {
      if (v.verdict === 'holds') continue;
      if (v.verdict === 'stale') drifted += 1;
      console.log(`      status ${v.verdict.toUpperCase()}: ${v.raw} — ${v.reason}`);
    }
  }

  // A green here is narrower than the rule it enforces, so it says so every run rather than
  // letting the reader assume the gate covered more than it did.
  console.log(`\n${targets.length - failed}/${targets.length} pass, ${drifted} status claim(s) contradicted by the repo${anyProbe ? '' : ' (no repository to ask)'}. Not checked by this gate:`);
  for (const u of specCompleteness('').unchecked) console.log(`  - ${u}`);
  if (failed) process.exit(1);
}

main();
