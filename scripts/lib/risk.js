// `rsc risk` — how much review and whose approval a change needs, decided by WHAT it touches.
//
// ASDD reviews inside every task, so the depth of that review cannot be the agent's own call: the
// change sets the tier, never the author (Anthropic, "How the Claude Code team does code review").
// The table is the sello's (targets/sello.mjs), reused as is, and it works with the sello off.
// Spec: 02-DOCS/wiki/sdd/specs/asdd-v4.md.

import { spawnSync } from 'node:child_process';
import { NESTED_WORKTREES, SELLO_STATE_PATHS, classifyRisk, lensesRequired, readEffectiveConfig, trunkRef } from '../../targets/sello.mjs';

function git(root, args) {
  const r = spawnSync('git', ['-C', root, '-c', 'core.quotePath=false', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}
const nul = (out) => (out || '').split('\0').filter(Boolean);

// Every path that differs from the base (committed, staged, unstaged or untracked). The base is the
// merge-base with `--base`, or with the trunk when none is given.
export function changedPaths(root, base = null) {
  const cfg = readEffectiveConfig(root);
  const ref = base || trunkRef(root, cfg);
  if (!ref) return { ok: false, message: 'rsc: no base to compare against. Pass --base <ref> or the paths themselves: npx @ericrisco/rsc risk <path…>' };
  const head = git(root, ['rev-parse', 'HEAD']);
  const mb = head ? (git(root, ['merge-base', 'HEAD', ref]) || '').trim() : '';
  if (!mb) return { ok: false, message: `rsc: cannot find a common ancestor with ${ref}. Pass --base <ref> or the paths themselves: npx @ericrisco/rsc risk <path…>` };
  // --no-renames: a rename reports both paths, so moving a file OUT of a tier-2 place still counts.
  // Nested worktrees are skipped only while UNTRACKED (another checkout sitting in the tree). Once
  // committed, a path under them is part of the change and keeps its tier.
  const untracked = () => nul(git(root, ['ls-files', '--others', '--exclude-standard', '-z'])).filter((n) => !NESTED_WORKTREES.test(n));
  const diff = (from) => new Set([...nul(git(root, ['diff', '--name-only', '--no-renames', '-z', from])), ...untracked()]
    .filter((n) => !SELLO_STATE_PATHS.includes(n)));
  let names = diff(mb);
  let shown = ref;
  // Working straight on the trunk (FTD on an open main), the merge-base IS HEAD, and a change
  // already committed would read as no change at all: tier 0, no reviewer, no escalation. With
  // nothing uncommitted, the last commit is the change being asked about.
  if (!base && mb === head.trim() && !names.size && git(root, ['rev-parse', '--verify', '--quiet', 'HEAD~1']) !== null) {
    names = diff('HEAD~1');
    shown = 'HEAD~1 (on the trunk: the last commit)';
  }
  return { ok: true, base: shown, paths: [...names].sort() };
}

export function assess(paths, cfg = null) {
  const { tier, classes, configError } = classifyRisk(paths, cfg);
  return {
    tier,
    classes: [...new Set(Object.values(classes))].sort(),
    reviewers: lensesRequired(tier, cfg),
    humanApproval: tier >= 2,
    // Tier 2 is ASDD work, whatever lane it started in: the ship guard refuses to push it without a spec.
    escalate: tier >= 2 ? 'asdd' : null,
    paths: classes,
    ...(configError ? { configError } : {}),
  };
}

export function render(r) {
  const top = Object.entries(r.paths).filter(([, c]) => r.tier === 0 || c !== 'docs');
  return [
    `tier ${r.tier}`,
    `classes: ${r.classes.join(', ') || 'none'}`,
    `reviewers: ${r.reviewers}`,
    `human approval: ${r.humanApproval ? 'required' : 'not required'}`,
    ...(r.base ? [`base: ${r.base}`] : []),
    ...(r.escalate ? ['escalate: asdd — tier 2 needs a spec linked to this branch (`branch: <name>` in its frontmatter) that passes `npx @ericrisco/rsc spec gate`; push and PR are refused until it exists. Write it now, before more code.'] : []),
    ...(r.configError ? [`config ignored: ${r.configError}`] : []),
    ...top.slice(0, 20).map(([p, c]) => `  ${c.padEnd(10)} ${p}`),
    ...(top.length > 20 ? [`  … ${top.length - 20} more`] : []),
  ].join('\n');
}
