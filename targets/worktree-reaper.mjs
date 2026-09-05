#!/usr/bin/env node
// rsc worktree reaper — the deterministic half of "the cleanup is the default".
//
// The catalog told agents, in prose, to remove a worktree once its work had landed. Prose is not an
// executor: `ship` carried the procedure in a paragraph under "park/discard", the block that runs on
// a direct merge never mentioned it, and nothing at all fired when the merge happened in the forge.
// So worktrees accumulated, and a list where live work and landed work look identical is a list
// nobody can act on — least of all the non-technical profile the harness claims to serve.
//
// This module owns the one judgement that must never be made by feel: *can this be removed without
// asking?* Three questions decide it, and every one of them fails towards keeping the directory:
//
//   provenance  — did rsc create it? (derived from the content, never from a registry: P3)
//   integration — does the branch still carry anything the trunk does not have?
//   contents    — is there anything inside that was never in git and cannot be regenerated?
//
// Imported by `.rsc/session-start.mjs` (the sweep) and by `scripts/rsc.js` (`rsc worktrees`), so the
// rule exists once and both entry points cannot drift apart. Same shape as `sello.mjs`.
import { existsSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, basename, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

// git reports worktree paths with every symlink resolved; callers hand us whatever they were given.
// On macOS that alone is enough to make every comparison here fail, because /tmp and /var are
// symlinks — and a path comparison that silently never matches would turn this whole module into a
// no-op that looks healthy. Compare real paths on both sides, always.
function real(p) {
  try { return realpathSync.native(resolve(p)); } catch { return resolve(p); }
}

export const OPT_OUT = '.no-worktree-cleanup';

// Content that lives outside git and is nevertheless disposable, as a table the test reads rather
// than conditionals it cannot see. Without this carve-out the default would never be automatic:
// virtually every worktree has dependencies installed inside it, and asking every single time is how
// a safeguard gets switched off (P7). The list ages — an ecosystem missing from it sends the
// worktree down the confirmation path, which is noise, not loss.
export const REGENERABLE = [
  'node_modules', 'bower_components', 'jspm_packages', '.pnpm-store', '.yarn',
  'venv', '.venv', 'env', '.tox', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  'dist', 'build', 'out', 'target', 'bin', 'obj', '.next', '.nuxt', '.svelte-kit', '.astro',
  '.turbo', '.parcel-cache', '.cache', '.gradle', '.dart_tool', 'Pods', 'vendor',
  'coverage', '.coverage', '.nyc_output', '.DS_Store', 'Thumbs.db',
];

// Trunk candidates, most authoritative first. The remote tip beats a local branch that may be stale.
const TRUNKS = ['origin/main', 'main', 'origin/master', 'master'];

// Branch shapes `worktrees` imposes on the isolation it creates.
const RSC_BRANCH = /^(?:feat|feature)\//;

function git(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  // `raw` matters for porcelain output: its leading space is a status code, not padding, and
  // trimming it shifted every path by one character — so the message naming the file about to be
  // lost named a file that does not exist. A refusal has to be true to be actionable (P6).
  return { ok: r.status === 0, out: (r.stdout || '').trim(), raw: r.stdout || '', err: (r.stderr || '').trim() };
}

/**
 * The MAIN working tree for wherever we are standing.
 *
 * You cannot remove the directory you are inside, and closing a branch from the worktree you built it
 * in is the most common way this is reached — so without this the common case is exactly the one that
 * never gets cleaned. `--show-toplevel` is the wrong question here: inside a linked worktree it
 * answers with that worktree. The common git dir is the only thing that points home.
 */
export function resolveMainRoot(cwd = process.cwd()) {
  const probe = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (probe.ok && probe.out) return real(dirname(probe.out));
  const legacy = git(cwd, ['rev-parse', '--git-common-dir']);
  if (legacy.ok && legacy.out) return real(dirname(resolve(cwd, legacy.out)));
  return real(cwd);
}

/** The cleanup is on unless this project turned it off. Same shape as the other guards' switches. */
export function isCleanupEnabled(root) {
  return !existsSync(join(root, '.rsc', OPT_OUT));
}

/** The first trunk ref that actually exists, or null when there is nothing to compare against. */
export function resolveTrunk(root) {
  return TRUNKS.find((ref) => git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).ok) || null;
}

/** Every working tree git knows about. The first entry is always the main one. */
export function listWorktrees(root) {
  const { ok, out } = git(root, ['worktree', 'list', '--porcelain']);
  if (!ok) return [];
  const trees = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      cur = { path: real(line.slice('worktree '.length)), branch: null, head: null, isMain: trees.length === 0 };
      trees.push(cur);
    } else if (!cur) continue;
    else if (line.startsWith('HEAD ')) cur.head = line.slice('HEAD '.length);
    else if (line.startsWith('branch ')) cur.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
  }
  return trees;
}

/**
 * Whose worktree is this? Derived, because a list of "worktrees rsc created" is the parallel
 * accounting P3 forbids — and a stale one would authorise deleting something it no longer describes.
 *
 * Two independent signals, and the conjunction is what counts as certainty. Deriving gets it wrong in
 * both directions and only one of them is benign: ours, renamed by hand, is never cleaned (it
 * accumulates, nothing is lost), while one the user made by hand that happens to match the
 * convention would be indistinguishable from ours. So one signal alone is `ambiguous`, not `rsc`.
 */
export function provenanceOf(root, wt) {
  const p = wt.path;
  const home = real(root);
  const inside = (dir) => p === dir || p.startsWith(dir + sep);
  const location = inside(join(home, '.worktrees'))
    || inside(join(home, 'worktrees'))
    || (dirname(p) === dirname(home) && basename(p).startsWith(`${basename(home)}-`));
  const branch = Boolean(wt.branch && RSC_BRANCH.test(wt.branch));
  if (location && branch) return 'rsc';
  if (location || branch) return 'ambiguous';
  return 'foreign';
}

/**
 * Does the branch still carry anything the trunk does not have?
 *
 * Reachability alone answers "no" for every pull request the forge squashed or rebased — the most
 * common way work lands anywhere — because those rewrite the commit identities. So the question is
 * asked about content, which is what the contract actually says: if merging this branch into the
 * trunk would not change the trunk's tree, the branch adds nothing.
 *
 * Cheapest first, and anything that cannot be answered is answered as "still carries work".
 */
export function integrationOf(root, wt, trunk) {
  const head = wt.head || (wt.branch ? git(root, ['rev-parse', wt.branch]).out : null);
  if (!head) return 'unknown';
  if (git(root, ['merge-base', '--is-ancestor', head, trunk]).ok) return 'integrated';

  const merged = git(root, ['merge-tree', '--write-tree', trunk, head]);
  // A conflict exits non-zero with a tree on stdout; an unsupported flag (git < 2.38) exits non-zero
  // with usage on stderr and nothing usable. Neither is integration, but only the second is ignorance.
  if (!merged.ok && !merged.out) return 'unknown';
  const trunkTree = git(root, ['rev-parse', `${trunk}^{tree}`]);
  if (!merged.ok || !trunkTree.ok) return 'not-integrated';
  return merged.out.split('\n')[0].trim() === trunkTree.out ? 'integrated' : 'not-integrated';
}

/**
 * What is inside that git would not miss? Split into what git calls dirty (tracked changes) and what
 * git cannot see at all — untracked and *ignored* files.
 *
 * The second half is the one that matters and the one every "is it clean?" check forgets: a worktree
 * with nothing pending can still hold the only copy of an .env, a local database or a page of notes,
 * and removing the directory takes them with it. `--ignored` is the only way to be told they exist.
 */
export function contentOutsideHistory(wtPath) {
  const { ok, raw } = git(wtPath, ['status', '--porcelain', '-z', '-uall', '--ignored=matching']);
  const dirty = [];
  const outside = [];
  if (!ok) return { dirty, outside, readable: false };
  for (const entry of raw.split('\0')) {
    if (entry.length < 4) continue;
    const code = entry.slice(0, 2);
    const path = entry.slice(3);
    if (code === '??' || code === '!!') {
      if (!isRegenerable(path)) outside.push(path);
    } else dirty.push(path);
  }
  return { dirty, outside, readable: true };
}

function isRegenerable(path) {
  const parts = path.split('/').filter(Boolean);
  return REGENERABLE.includes(parts[0]) || REGENERABLE.includes(parts[parts.length - 1]);
}

/**
 * Every worktree with a verdict: `safe` (remove without asking), `ask` (confirm first, and the
 * reasons say why), `skip` (not ours, or still carrying work — never offered).
 *
 * Returns nothing at all when the cleanup is off or the trunk cannot be resolved: with no trunk there
 * is no way to tell landed work from live work, and guessing is the one thing this must not do.
 */
export function classifyWorktrees(root) {
  if (!isCleanupEnabled(root)) return [];
  const trunk = resolveTrunk(root);
  if (!trunk) return [];

  return listWorktrees(root)
    .filter((wt) => !wt.isMain && wt.path !== real(root))
    .map((wt) => {
      const base = { path: wt.path, branch: wt.branch, verdict: 'skip', reasons: [], details: {} };

      // A submodule is not a worktree of this repository, and it only looks like one.
      if (git(wt.path, ['rev-parse', '--show-superproject-working-tree']).out) {
        return { ...base, reasons: ['submodule'] };
      }

      const provenance = provenanceOf(root, wt);
      if (provenance === 'foreign') return { ...base, reasons: ['foreign'] };

      const integration = integrationOf(root, wt, trunk);
      if (integration !== 'integrated') return { ...base, reasons: [integration] };

      const { dirty, outside, readable } = contentOutsideHistory(wt.path);
      if (!readable) return { ...base, reasons: ['unreadable'] };

      const reasons = [];
      if (dirty.length) reasons.push('dirty');
      if (outside.length) reasons.push('content-outside-history');
      if (provenance === 'ambiguous') reasons.push('provenance-ambiguous');

      return {
        ...base,
        verdict: reasons.length ? 'ask' : 'safe',
        reasons,
        details: { dirty, outside },
      };
    });
}

/**
 * Remove one worktree, and its branch only when git will do it the safe way.
 *
 * The branch rule is the recovery net for the one judgement here that is inferred rather than proven:
 * a squash-merged branch is equivalent by content and not by identity, so `branch -d` refuses it. We
 * do not override that refusal. The directory goes, the branch stays, and while the branch exists the
 * commits are recoverable even if the equivalence was judged wrong. Never `-D`.
 *
 * `--force` on the worktree removal is not a relaxation: our own gate above is strictly stronger than
 * git's, because git's refusal ignores ignored files and ours does not. By this point the contents
 * have already been classified as either nothing, or regenerable, or explicitly confirmed.
 */
export function reapWorktree(root, targetPath, { confirmed = false } = {}) {
  const target = real(targetPath);
  if (!isCleanupEnabled(root)) {
    return { removed: false, reason: `cleanup is off for this project (.rsc/${OPT_OUT}); remove it by hand with \`git worktree remove\`` };
  }
  if (target === real(root)) {
    return { removed: false, reason: 'that is the main working tree, not a worktree to remove' };
  }

  const candidate = classifyWorktrees(root).find((c) => c.path === target);
  if (!candidate) {
    return { removed: false, reason: `${target} is not a worktree of this repository, or the trunk could not be resolved` };
  }
  if (candidate.verdict === 'skip') {
    return { removed: false, reason: refusal(candidate) };
  }
  if (candidate.verdict === 'ask' && !confirmed) {
    return { removed: false, reason: refusal(candidate) };
  }

  const removal = git(root, ['worktree', 'remove', '--force', target]);
  if (!removal.ok) {
    return { removed: false, reason: `git refused to remove it: ${removal.err || removal.out}` };
  }

  const branchDeleted = candidate.branch ? git(root, ['branch', '-d', candidate.branch]).ok : false;
  git(root, ['worktree', 'prune']);

  return {
    removed: true,
    path: target,
    branch: candidate.branch,
    branchDeleted,
    branchKept: Boolean(candidate.branch) && !branchDeleted,
  };
}

/** Every refusal carries the way out, because the person receiving it may not be able to deduce one (P6). */
export function refusal(candidate) {
  const d = candidate.details || {};
  switch (candidate.reasons[0]) {
    case 'foreign':
      return 'not created by rsc — it is not ours to delete. Remove it yourself with `git worktree remove` if you want it gone.';
    case 'not-integrated':
      return `\`${candidate.branch}\` still carries work that is not in the trunk. Land it (\`ship\`) or discard it deliberately first.`;
    case 'unknown':
      return `could not tell whether \`${candidate.branch}\` is integrated (old git, or no comparable trunk). Check with \`git log --oneline <trunk>..${candidate.branch}\` and remove it by hand if you are satisfied.`;
    case 'submodule':
      return 'that is a submodule, not a worktree.';
    case 'unreadable':
      return 'git could not report the state of that directory; nothing was touched.';
    case 'dirty':
      return `uncommitted changes inside: ${d.dirty.join(', ')}. Commit, stash or discard them first.`;
    case 'content-outside-history':
      return `holds files that are in no commit and would be lost: ${d.outside.join(', ')}. Move or copy them out first.`;
    case 'provenance-ambiguous':
      return `only half of the rsc convention matches (${candidate.branch} at ${candidate.path}), so it may be yours rather than ours. Confirm before it is removed.`;
    default:
      return 'nothing was removed.';
  }
}

/** One line per candidate, for the session-start sweep and the CLI. */
export function describe(candidate) {
  const where = candidate.path;
  if (candidate.verdict === 'safe') return `  safe  ${where} (${candidate.branch}) — landed and empty of anything unsaved`;
  return `  ask   ${where} (${candidate.branch}) — ${refusal(candidate)}`;
}

// CLI: `node worktree-reaper.mjs <root> [reap [path]]`. `scripts/rsc.js` is the public entry point;
// this exists so the materialized copy in .rsc/ is runnable on its own.
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const root = resolve(process.argv[2] || process.cwd());
  const candidates = classifyWorktrees(root).filter((c) => c.verdict !== 'skip');
  if (process.argv[3] === 'reap') {
    const one = process.argv[4];
    const targets = one ? [resolve(one)] : candidates.filter((c) => c.verdict === 'safe').map((c) => c.path);
    for (const t of targets) {
      const out = reapWorktree(root, t, { confirmed: Boolean(one) });
      process.stdout.write(out.removed
        ? `removed ${t}${out.branchKept ? ` (branch ${out.branch} kept — git will not delete it safely)` : ''}\n`
        : `kept ${t} — ${out.reason}\n`);
    }
  } else if (!candidates.length) {
    process.stdout.write('no worktrees to clean up.\n');
  } else {
    process.stdout.write(candidates.map(describe).join('\n') + '\n');
  }
}
