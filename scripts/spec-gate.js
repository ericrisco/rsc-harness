#!/usr/bin/env node
// Runs the `specify` exit gate over written specs. Report-only: it never edits a spec.
//
// Not wired into `prepublishOnly`, and that is deliberate: specs live under 02-DOCS, which is never
// tracked (principle 9), so a publish gate depending on them would fail in any clean clone. This is
// the phase's own instrument, and the author's.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, resolve, relative } from 'node:path';
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
function spawnSyncGit(cwd, args) {
  try { return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
}

function gitProbe(root) {
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  let main;
  let top;
  try {
    git(['rev-parse', '--git-dir']);
    // The repository, not the directory we happened to be handed: `children()` looks for sibling
    // repos under this one, and asking a specs/ subdirectory for its children finds nothing.
    top = git(['rev-parse', '--show-toplevel']) || root;
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
    // Two ways a pull request lands, and only one of them was recognised. The squash subject carries
    // `(#N)`; a plain merge writes `Merge pull request #N from …` and matched nothing, so half the
    // ways of landing were invisible even when the right repository was being asked.
    // Two literal searches rather than one regex: `--fixed-strings` is what keeps the parens from
    // being read as a group, and swapping it for an alternation would put that back.
    hasPr: (n) => {
      for (const needle of [`(#${n})`, `Merge pull request #${n} `]) {
        try {
          if (git(['log', main, '--grep', needle, '--fixed-strings', '-1', '--format=%H']) !== '') return true;
        } catch { /* try the other form */ }
      }
      return false;
    },
    hasTag: (v) => { try { return git(['tag', '-l', `v${v}`]) !== ''; } catch { return false; } },
    root: top,
  };
}

const commonDir = (dir) => {
  const r = spawnSyncGit(dir, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  return r || dir;
};
const sameRepo = (a, b) => commonDir(a) === commonDir(b);

const isRepo = (dir) => { try { return statSync(join(dir, '.git')).isDirectory() || statSync(join(dir, '.git')).isFile(); } catch { return false; } };

/**
 * Which repository is this spec's `status:` talking about?
 *
 * It used to be "the one holding the file", which is right only when docs and code live together.
 * Where they deliberately do not — this workspace's own CLAUDE.md requires the children's working
 * docs to live in the container — every true claim came back false, and a gate that flags everything
 * distinguishes nothing.
 *
 * The subject is pinned ONCE per spec and every claim is then judged against it. Letting each claim
 * find whichever repository happens to confirm it would read better and destroy the function: an
 * unconfirmed claim would simply find no confirmer, and nothing would ever be reported stale again.
 */
function resolveSubject(specPath, claims) {
  const answers = (root) => {
    const p = gitProbe(root);
    if (!p) return null;
    return claims.some((c) => (c.kind === 'sha' && p.hasCommit(c.value))
      || (c.kind === 'version' && p.hasTag(c.value))
      || (c.kind === 'pr' && p.hasPr(c.value))) ? p : null;
  };

  // The declaration is AUTHORITATIVE. Softening it to "wins when it can answer" fixed a wrong config
  // and opened something worse: with sibling repos, a claim that is false where the spec belongs and
  // true next door is handed to the neighbour, confirmed, and printed nowhere. A silent false negative
  // is worse than the noisy false positive it replaced, and choosing the judge by who agrees with the
  // claim is not a way to find out whether the claim is true. A wrong `project.root` is a wrong datum;
  // fix the datum.
  const declared = declaredRoot(specPath);
  if (declared && isRepo(declared)) return { probe: gitProbe(declared), from: 'config' };

  const here = gitProbe(dirname(specPath));
  const home = here && here.root;

  if (home) {
    const kids = children(home).map((dir) => ({ dir, probe: answers(dir) })).filter((k) => k.probe);
    // Two histories cannot both be the subject. Saying so is an answer; picking the first one that
    // sorted alphabetically is a coin toss wearing a verdict's clothes.
    if (kids.length > 1) {
      return { probe: null, note: `several repositories here could answer it (${kids.map((k) => basename(k.dir)).join(', ')}) — say which one in project.root` };
    }
    if (kids.length === 1) return { probe: kids[0].probe, from: 'derived' };
    // Nobody answered. Fall through to the floor rather than guessing: with no declaration and no
    // recogniser, the spec's own repository is the only honest default.
  }
  // The floor is the old behaviour: a spec that lives beside its own code must keep the detection it
  // already had, or fixing the split layout would downgrade every caught lie to "could not check".
  const floor = declared && isRepo(declared) ? gitProbe(declared) : here;
  return { probe: floor, from: declared ? 'config' : 'spec repo' };
}

/** `project.root` from the nearest SDD config, resolved against the directory that holds 02-DOCS. */
function declaredRoot(specPath) {
  let dir = resolve(dirname(specPath));
  for (let i = 0; i < 24; i += 1) {
    const cfg = join(dir, '02-DOCS', 'wiki', 'sdd', 'config.yaml');
    if (existsSync(cfg)) {
      try {
        const block = /^project:[ \t]*\r?\n((?:[ \t]+.*\r?\n?)*)/m.exec(readFileSync(cfg, 'utf8'));
        const m = block && /^[ \t]+root:[ \t]*(.+?)[ \t]*$/m.exec(block[1]);
        // Relative to the directory that owns 02-DOCS, not to the config file and not to the cwd:
        // the only reading where `.` keeps meaning what it means today and the answer does not change
        // with where the gate was invoked from.
        if (m) return resolve(dir, m[1].replace(/^['"]|['"]$/g, ''));
      } catch { /* unreadable config → derive instead */ }
      return null;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** Git repositories directly inside `root` — far enough to find a child, near enough to still be this project. */
function children(root) {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => join(root, e.name))
      .filter(isRepo)
      // A linked worktree has a `.git` file and the same history, so without this a repo and its own
      // worktree look like two candidates that both answer — an ambiguity invented out of one repo.
      .filter((dir, i, all) => all.findIndex((d) => sameRepo(d, dir)) === i);
  } catch { return []; }
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
  const subjects = new Map();
  const announced = new Set();
  const subjectFor = (path, claims) => {
    const dir = dirname(path);
    // Keyed by directory alone. It used to include the claims, which meant a fresh resolution per
    // spec — the opposite of what its own comment claimed, and measured at 0.8s → 10.3s over a
    // 36-spec corpus, because every miss re-walks the children and re-runs git. A corpus shares a
    // subject; that is the whole premise.
    const key = dir;
    if (!subjects.has(key)) subjects.set(key, resolveSubject(path, claims));
    return subjects.get(key);
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
    const claims = statusClaims(statusOf(text));
    const subject = claims.length ? subjectFor(path, claims) : { probe: null };
    // A subject nobody declared was inferred from the claims themselves, which is a guess. Say it
    // once per run: silent inference is how a coincidence passes for a verdict.
    if (subject.from === 'derived' && subject.probe && !announced.has(subject.probe.root)) {
      announced.add(subject.probe.root);
      console.log(`      note: subject derived (not declared) — asking ${subject.probe.root}; set project.root to settle it`);
    }
    const probe = subject.probe;
    anyProbe = anyProbe || Boolean(probe);
    for (const v of checkClaims(claims, probe)) {
      if (v.verdict === 'holds') continue;
      if (v.verdict === 'stale') drifted += 1;
      // Every non-green line names where it looked, so the reader can go and check by hand (P6).
      const rel = probe ? relative(process.cwd(), probe.root) : '';
      const where = probe ? ` [asked ${!rel || rel.startsWith('..') ? probe.root : rel}]` : '';
      const reason = !probe && subject.note ? subject.note : v.reason;
      console.log(`      status ${v.verdict.toUpperCase()}: ${v.raw} — ${reason}${where}`);
    }
  }

  // A green here is narrower than the rule it enforces, so it says so every run rather than
  // letting the reader assume the gate covered more than it did.
  console.log(`\n${targets.length - failed}/${targets.length} pass, ${drifted} status claim(s) contradicted by the repo${anyProbe ? '' : ' (no repository to ask)'}. Not checked by this gate:`);
  for (const u of specCompleteness('').unchecked) console.log(`  - ${u}`);
  if (failed) process.exit(1);
}

main();
