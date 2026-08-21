#!/usr/bin/env node
// drift-check.js — do the paths the harness claims exist actually exist?
//
// The harness writes knowledge about itself in three places and every one of them can name a
// file that has since moved. Measured before this existed: 67 of 688 markdown links in the
// published catalog did not resolve, and two were real wrong-depth bugs shipping to users
// (`data-cleaning` → duckdb, `solid-js` → vercel, both missing a `../`). The private wiki had a
// plan marked "implementada" naming three files that never existed. Nothing checked any of it,
// while the memory instructions already ordered "verify it still exists before recommending it"
// — a binding rule resting on the model remembering. That is the pattern P2 exists to kill.
//
// THE ONE IDEA THAT MAKES THIS VIABLE: **code shows, prose points.** A link inside a fenced
// block or an inline-code span is being *displayed* as syntax; a link in prose is *offered to
// follow*. That distinction is already in the markup, so it needs no markers to author and no
// allowlist to maintain (P3 — the content is the ledger). Applied to the catalog it takes 67
// unresolved links down to 4 real ones, which is the difference between a gate people act on
// and a gate they learn to ignore.
//
// Two modes, because the precision a check needs scales with what it costs to be wrong (P7):
//   catalog   blocking. Prose links only, resolved exactly as a markdown reader would (relative
//             to the document). Precision first: a false positive here fails a build.
//   knowledge report-only. Prose links PLUS paths in inline code, resolved against several
//             plausible bases. Recall first: a human triages, nothing blocks, and the wiki's
//             worst finding lives in backticks — precision-only extraction would miss it.
//
// It never writes. The output is a report; adopting it is a human's job.
import { readdirSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── extraction ────────────────────────────────────────────────────────────────────────────
// Both strippers keep the line count (and stripInlineCode the column offsets) intact, so a
// finding can name the line a human has to open.

// Fenced blocks, line-scanned rather than regexed: an UNTERMINATED fence must swallow the rest
// of the file, which a paired regex silently declines to do — leaving example links in a
// half-open block looking like prose.
export function stripFences(text) {
  const out = [];
  let fence = null;
  for (const line of String(text).split('\n')) {
    const m = line.match(/^([ \t]*)(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (m && m[2][0] === fence.char && m[2].length >= fence.len && m[3].trim() === '') fence = null;
      out.push('');
      continue;
    }
    if (m) {
      fence = { char: m[2][0], len: m[2].length };
      out.push('');
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

// Inline code spans, per line so a span can never eat across a newline. An UNBALANCED backtick
// run is left as prose on purpose: swallowing it would hide a real link, and a false negative
// is the failure mode this whole check exists to prevent.
export function stripInlineCode(text) {
  return String(text)
    .split('\n')
    .map((line) => line.replace(/(`+)(?:(?!\1)[^`])*\1/g, (m) => ' '.repeat(m.length)))
    .join('\n');
}

const FILE_EXT = /\.(md|markdown|ya?ml|json|jsonc|sh|bash|mjs|cjs|js|ts|txt|toml)$/i;
const NOT_A_PATH = /^(https?:|mailto:|tel:|#|\/\/)/i;
const isPathLike = (t) => !NOT_A_PATH.test(t) && (FILE_EXT.test(t) || t.endsWith('/'));

// Inline links only — `[text](target)`. Reference-style links and autolinks are deliberately
// out: `<path>` carries angle brackets and is classified as a placeholder anyway.
const LINK_RE = /\[[^\]]*\]\(\s*([^)\s]+?)\s*\)/g;

export function extractProseLinks(text) {
  const prose = stripInlineCode(stripFences(text));
  const out = [];
  prose.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(LINK_RE)) {
      const target = m[1].replace(/^<|>$/g, '');
      if (isPathLike(target)) out.push({ target, line: i + 1, kind: 'link' });
    }
  });
  return out;
}

// Report mode only: a path asserted inside backticks. Noisier by nature (this is where syntax
// examples live), which is exactly why it never gates a build.
const TOP_DIRS = /^(scripts|targets|skills|tests|bin|site|schema|02-DOCS|\.github|\.rsc)(\/|$)/;
export function extractInlinePaths(text) {
  const noFences = stripFences(text);
  const out = [];
  noFences.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/(`+)((?:(?!\1)[^`])*)\1/g)) {
      const t = m[2].trim();
      if (!t || /\s/.test(t) || NOT_A_PATH.test(t)) continue;
      if (!/\//.test(t)) continue; // a bare filename is a mention, not a location
      if (TOP_DIRS.test(t) || FILE_EXT.test(t)) out.push({ target: t, line: i + 1, kind: 'inline' });
    }
  });
  return out;
}

// ── classification ────────────────────────────────────────────────────────────────────────
// Every rule is syntactic and narrow. Nothing here guesses from file names or wording: a
// classifier that reasons about intent is a classifier that learns to stay quiet, and a quiet
// detector is indistinguishable from no detector.
export const CLASSES = {
  // A shape, not a path: `skills/<ID>/`, `references/*.md`, `{slug}.md`.
  placeholder: (t) => /[<>*{}]/.test(t),
  // The file exists; the line number moves on its own. Anchors are recognised, not chased.
  anchored: (t) => /:\d+$/.test(t) || t.includes('#'),
  // Born at runtime, never in a repo. Note the trailing slash: `.rsc-notes.md` is NOT this.
  runtime: (t) => t.startsWith('~') || /(^|\/)\.rsc\//.test(t),
  // A site route, not a file: `/llms.txt`, `/skills/`. Found by running the report on the real
  // wiki, where six route mentions arrived as "missing files". A genuinely absolute filesystem
  // path in these documents would start with a home or volume directory, and the P9 test in
  // tests/drift-check.test.js already forbids shipping one.
  'web-route': (t) => t.startsWith('/'),
  // The INSTALLED user's project, which the catalog legitimately talks about and does not
  // contain. Segment-exact, so `rawdata/` and `02-DOCSX/` stay real claims.
  'user-project': (t) => /(^|\/)(02-DOCS|raw)\//.test(t),
};

export function classify(target, { mode = 'catalog' } = {}) {
  for (const name of ['placeholder', 'anchored', 'runtime', 'web-route']) {
    if (CLASSES[name](target)) return name;
  }
  // In knowledge mode this repo IS the project, so `02-DOCS/…` is a real claim about real files.
  if (mode === 'catalog' && CLASSES['user-project'](target)) return 'user-project';
  return 'real';
}

// ── resolution ────────────────────────────────────────────────────────────────────────────
// Catalog: the document's own directory, and nothing else — that is what a reader following the
// link does, and being generous here would hide the exact wrong-depth bug this must catch.
// Knowledge: several plausible bases, because the wiki writes shorthand
// (`orient/references/x.md` meaning `skills/orient/references/x.md`) and 20 such references
// would otherwise arrive as false positives.
export function basesFor(docPath, { mode, root }) {
  if (mode === 'catalog') return [dirname(docPath)];
  return [dirname(docPath), root, join(root, '02-DOCS'), join(root, '02-DOCS', 'wiki'), join(root, 'skills')];
}

// `existsSync` asks the filesystem, and on APFS/HFS+ (macOS) and NTFS (Windows) the filesystem
// ignores case. So a link to `AUDIT.md` resolves against a file named `audit.md` and this gate goes
// GREEN on the maintainer's machine while Linux CI — and every installed user — sees a broken link.
// That is P2 in its most expensive form: the gate fails open exactly where the work is done. It
// happened for real (the motion-craft port moved references and one link kept its old casing).
//
// So existence is checked one path segment at a time against the parent's actual directory listing,
// which is byte-exact on every filesystem. The walk starts at `root`, which is real by
// construction; the declared hole is a target that resolves OUTSIDE the repo, where there is no
// listing we can trust — the repo's own path may sit under a differently-cased volume or behind a
// symlink, and a false positive in a blocking gate costs more than a named gap.
// Spec: 02-DOCS/wiki/sdd/specs/drift-check-case.md
function existsExact(absTarget, root, cache) {
  const rel = relative(root, absTarget);
  // Outside the repo (or the root itself): keep the old behaviour, and say so rather than guess.
  if (rel === '' || rel.startsWith('..') || rel.startsWith('/')) return existsSync(absTarget);

  let dir = root;
  for (const segment of rel.split('/')) {
    let entries = cache.get(dir);
    if (entries === undefined) {
      // An unreadable directory is not evidence of drift; fall back rather than accuse.
      try { entries = new Set(readdirSync(dir)); } catch { return existsSync(absTarget); }
      cache.set(dir, entries);
    }
    if (!entries.has(segment)) return false;
    dir = join(dir, segment);
  }
  return true;
}

const resolves = (target, bases, root, cache) =>
  bases.some((b) => existsExact(resolve(b, target), root, cache));

// Knowledge mode only. The authoring standards write per-skill paths generically — "every skill
// carries `evals/cases.yaml`" — which is a claim about a shape shared by 258 directories, not a
// location. Resolving it against any one skill is the honest reading; treating it as drift
// produced five findings that were never wrong.
function resolvesInAnySkill(target, root, cache) {
  if (target.startsWith('.') || target.startsWith('/')) return false;
  const skillsDir = join(root, 'skills');
  if (!existsSync(skillsDir)) return false;
  for (const e of readdirSync(skillsDir, { withFileTypes: true })) {
    if (e.isDirectory() && existsExact(join(skillsDir, e.name, target), root, cache)) return true;
  }
  return false;
}

// ── walking ───────────────────────────────────────────────────────────────────────────────
function markdownFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === 'node_modules' || e.name.startsWith('.git')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) markdownFiles(p, out);
    else if (/\.(md|markdown)$/i.test(e.name)) out.push(p);
  }
  return out;
}

// Claude Code's auto-memory for a project lives under a slug of its absolute path. Derived from
// HOME and the repo path — never a hardcoded user, because this file ships in a public package.
export function memoryDir(root, home = homedir()) {
  return join(home, '.claude', 'projects', String(root).replace(/\//g, '-'), 'memory');
}

// Scan one tree. Returns findings plus the number of claims actually examined — a check that
// silently stops looking would otherwise report "all clear" forever (see the count assertion in
// tests/drift-check.test.js).
export function scanTree(dir, { mode, root = REPO, label = null } = {}) {
  const findings = [];
  let claims = 0;
  let skipped = 0;
  // Directory listings, memoized per scan rather than per module: 824 claims share a few hundred
  // directories, and a cache that outlived the scan would answer from a stale listing.
  const cache = new Map();
  for (const doc of markdownFiles(dir)) {
    const text = readFileSync(doc, 'utf8');
    const raw = mode === 'catalog'
      ? extractProseLinks(text)
      : [...extractProseLinks(text), ...extractInlinePaths(text)];
    const bases = basesFor(doc, { mode, root });
    for (const c of raw) {
      const cls = classify(c.target, { mode });
      if (cls !== 'real') {
        skipped++;
        continue;
      }
      claims++;
      if (mode === 'knowledge' && resolvesInAnySkill(c.target, root, cache)) continue;
      if (!resolves(c.target, bases, root, cache)) {
        findings.push({
          doc: relative(root, doc),
          line: c.line,
          target: c.target,
          kind: c.kind,
          tree: label || basename(dir),
        });
      }
    }
  }
  return { findings, claims, skipped };
}

// ── the two modes ─────────────────────────────────────────────────────────────────────────
export class MissingRoot extends Error {}

// Blocking. A broken link in the catalog is broken product: the user follows a pointer to
// nowhere and cannot tell that from having misunderstood the skill.
export function checkCatalog({ root = REPO } = {}) {
  const dir = join(root, 'skills');
  if (!existsSync(dir)) throw new MissingRoot(`no catalog to check: ${relative(root, dir) || dir} does not exist`);
  return scanTree(dir, { mode: 'catalog', root, label: 'skills' });
}

// Report-only. Inputs are the harness's own artifacts — written by a trusted agent, and for the
// wiki already reviewed. Session transcripts are NOT an input here and must not become one: they
// carry web pages, third-party READMEs and tool output, and anything derived from them would be
// loaded into every later session.
export function checkKnowledge({ root = REPO, home = homedir() } = {}) {
  const trees = [
    { dir: join(root, '02-DOCS', 'wiki'), label: 'wiki' },
    { dir: memoryDir(root, home), label: 'memory' },
  ].filter((t) => existsSync(t.dir));
  if (!trees.length) throw new MissingRoot('no knowledge tree found (02-DOCS/wiki and auto-memory are both absent)');
  const all = { findings: [], claims: 0, skipped: 0, trees: trees.map((t) => t.label) };
  for (const t of trees) {
    const r = scanTree(t.dir, { mode: 'knowledge', root, label: t.label });
    all.findings.push(...r.findings);
    all.claims += r.claims;
    all.skipped += r.skipped;
  }
  return all;
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────
// Every denial carries its own exit (P6). The second half of the recovery matters as much as the
// first: an example link is fixed by putting it in code, and that is not a loophole — it is the
// rule this check is built on, stated where someone hitting the wall will read it.
const RECOVER = [
  'Recover: fix the link so it resolves from the document that contains it,',
  '  or — if it is showing what a link looks like rather than pointing at a file —',
  '  wrap it in backticks or a fenced block. Code shows; prose points.',
].join('\n');

const report = (f) => `  ${f.doc}:${f.line}  →  ${f.target}${f.kind === 'inline' ? '  [inline]' : ''}`;

function main(argv) {
  const wantKnowledge = argv.includes('--knowledge') || argv.includes('--all');
  const wantCatalog = !argv.includes('--knowledge') || argv.includes('--all');
  let failed = false;

  if (wantCatalog) {
    let r;
    try {
      r = checkCatalog({});
    } catch (e) {
      // Distinct exit and message: "could not run" must never be reported as "nothing wrong".
      console.error(`drift-check: ${e.message}`);
      console.error('Recover: run this from the repo root, where skills/ lives.');
      process.exit(2);
    }
    console.log(`drift-check catalog: ${r.claims} prose link claim(s) checked, ${r.skipped} classified as non-claims`);
    if (r.findings.length) {
      console.log(`\nFAIL: ${r.findings.length} link(s) do not resolve:\n${r.findings.map(report).join('\n')}\n`);
      console.log(RECOVER);
      failed = true;
    } else {
      console.log('RESULT: PASS — every prose link in the catalog resolves');
    }
  }

  if (wantKnowledge) {
    try {
      const k = checkKnowledge({});
      console.log(`\ndrift-check knowledge (${k.trees.join(', ')}): ${k.claims} claim(s) checked, ${k.skipped} classified as non-claims`);
      if (k.findings.length) {
        console.log(`${k.findings.length} claim(s) do not resolve — advisory, nothing is blocked:\n${k.findings.map(report).join('\n')}`);
        console.log('\nEach is either drift (fix the document) or a deliberate mention of something absent (leave it).');
      } else {
        console.log('no drift found');
      }
    } catch (e) {
      // Advisory tree missing is normal (02-DOCS is gitignored; a fresh install has no wiki).
      console.log(`\ndrift-check knowledge: skipped — ${e.message}`);
    }
  }

  process.exit(failed ? 1 : 0);
}

// Compared through realpath, not by string: on macOS the temp dir is a symlink, so argv[1] and
// import.meta.url disagree for any script under it and the common
// `import.meta.url === \`file://${process.argv[1]}\`` guard silently declines to run —
// which looks exactly like a clean pass.
function invokedDirectly() {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) main(process.argv.slice(2));
