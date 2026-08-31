import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { targetPaths, installedTargets, detectTarget, unwireHook } from '../../targets/index.js';
import { readState } from './state.js';
import { readManifest } from './manifest-file.js';
import { createBackup } from './backups.js';
import { countHookEntries } from '../doctor.js';
import { applyInstall, recordInManifest, managedPathsForInstall } from '../install-apply.js';

// Fixing a harness that came from an earlier version.
//
// The other two deliveries fix the future and fix nobody: everyone who built a harness on
// 0.1 or 1.0 wakes up the day after with exactly what they had, and does not know it. This
// is the one command for them — no flags, no need to know what is wrong.
//
// EVERY finding is born with its class, and the executor only reads that field. It never
// decides:
//
//   restore — put the harness back to what was ALREADY declared. Nobody decides anything,
//             so it happens on its own, after a recoverable copy.
//   change  — alter something a person or a team chose. Always asked, one by one.
//
// Putting the boundary in the data instead of the executor means it can be tested without
// running anything, and it cannot drift apart between branches.

const finding = (id, cls, summary, action) => ({ id, class: cls, summary, action });

export function diagnose({ cwd = process.cwd(), target, home = homedir(), invoked = false } = {}) {
  const paths = targetPaths(target, home, cwd);
  const state = readState(paths.stateFile);
  const installed = Object.keys(state.skills || {});
  const manifest = readManifest(cwd);
  const out = [];

  // Nothing of ours here at all: say so and touch nothing. Running this in the wrong
  // folder must be harmless.
  if (!installed.length && !manifest && !existsSync(join(cwd, '.rsc'))) return out;

  // The 0.1 layout Claude Code never discovered. writeSkill() sweeps it, but only when
  // that skill is reinstalled — so anyone who never reinstalled still carries it.
  if (existsSync(join(paths.root, 'rsc'))) {
    out.push(finding('nested-layout', 'restore',
      'A .claude/skills/rsc/ directory from the 0.1 layout is still here; no assistant ever read it.',
      'It gets removed. Nothing that works today lives in it.'));
  }

  // Repeated wiring. On Windows the needle never matched, so every install ADDED a hook
  // instead of replacing it: there were real machines running each hook four times.
  const repeated = duplicatedHooks(paths.hookTarget);
  if (repeated.length) {
    out.push(finding('duplicate-hooks', 'restore',
      `${repeated.join(', ')} wired more than once, so those hooks run several times per event.`,
      'The extra copies are removed, leaving one of each.'));
  }

  // A clone: the declaration travelled, the materialised skills did not.
  const dangling = installed.filter((id) => !existsSync(paths.skillDir(id)))
    .concat((manifest?.skills || []).filter((id) => !existsSync(paths.skillDir(id))));
  if (dangling.length) {
    out.push(finding('dangling-links', 'restore',
      `${[...new Set(dangling)].join(', ')} are declared but not on disk — what a fresh clone looks like.`,
      'They get rebuilt from the catalog at the version the manifest pins.'));
  }

  // Writing the manifest records something already true, which sounds like a restoration.
  // But it makes a new committable file appear in someone's root, and that surprises —
  // and surprising people is what started all of this. So: automatic when they typed the
  // command (they already said yes), asked when we are the ones who noticed.
  if (!manifest && installed.length) {
    out.push(finding('no-manifest', invoked ? 'restore' : 'change',
      'This harness predates .rsc.json, so it cannot be shared by git yet.',
      'A manifest is written from what is already installed here.'));
  }

  // Installed somewhere the project does not look like. This is #249: `harness` writes an
  // AGENTS.md, detection read it as codex, and people ended up wired to an assistant they
  // never chose. Moving is a change — it is where the harness lives.
  const others = installedTargets(cwd).filter((t) => t !== target);
  const looksLike = detectTarget(cwd);
  if (!others.length && installed.length && looksLike !== target && !manifest) {
    out.push(finding('wrong-target', 'change',
      `The harness is installed for ${target}, but this project looks like ${looksLike}.`,
      `It moves to ${looksLike}, and the old wiring — including the block in the root file — is removed.`),
    );
    out[out.length - 1].to = looksLike;
  }
  return out;
}

// Remove the old wiring's skills. The list comes from the target's OWN state, which by
// construction holds only what rsc installed — so "we never touch what we did not write"
// is a property of the input here, not a check that could be forgotten or drift.
//
// It was a check, once, sitting on a list that mixed state and manifest ids. A mutant that
// deleted the check killed no test, and chasing that revealed the branch was unreachable
// anyway. A guard that cannot be seen to fail is worse than no guard (principle 2), so it
// became structure instead.
function removeManagedSkills(paths) {
  for (const id of Object.keys(readState(paths.stateFile).skills || {})) {
    rmSync(paths.skillDir(id), { recursive: true, force: true });
  }
  rmSync(paths.stateFile, { force: true });
}

function duplicatedHooks(hookTarget) {
  let settings;
  try { settings = JSON.parse(readFileSync(hookTarget, 'utf8')); } catch { return []; }
  const { perEvent } = countHookEntries(settings);
  const dup = [];
  for (const [event, ids] of Object.entries(perEvent)) {
    for (const [id, n] of Object.entries(ids)) if (n > 1) dup.push(`${event}/${id}`);
  }
  return dup;
}

export async function repair({ cwd = process.cwd(), target, home = homedir(), dryRun = false, invoked = false, accept } = {}) {
  const found = diagnose({ cwd, target, home, invoked });
  const restores = found.filter((f) => f.class === 'restore');
  const changes = found.filter((f) => f.class === 'change');

  // Anything the person has to decide is only applied if they actually said yes. With
  // nobody to ask, it stays pending — and the restorations still get done, because they
  // never depended on that decision.
  const okChanges = [];
  for (const c of changes) if (accept && await accept(c)) okChanges.push(c);
  const todo = [...restores, ...okChanges];
  if (!todo.length || dryRun) {
    return { applied: todo, pending: changes.filter((c) => !okChanges.includes(c)), backup: null };
  }

  const paths = targetPaths(target, home, cwd);
  const ids = [...new Set([...Object.keys(readState(paths.stateFile).skills || {}), ...(readManifest(cwd)?.skills || [])])];
  const backup = createBackup({
    cwd, operation: 'repair', target,
    paths: managedPathsForInstall({ skillIds: ids, target, home, cwd }),
  });

  for (const f of todo) {
    if (f.id === 'nested-layout') rmSync(join(paths.root, 'rsc'), { recursive: true, force: true });
    if (f.id === 'duplicate-hooks') { unwireHook(target, paths); await applyInstall({ skillIds: ids, target, home, cwd, operation: 'repair' }); }
    if (f.id === 'dangling-links') await applyInstall({ skillIds: ids, target, home, cwd, operation: 'repair' });
    if (f.id === 'no-manifest') recordInManifest({ cwd, target, skillIds: ids });
    if (f.id === 'wrong-target') {
      // Install where the project actually points, THEN take the old wiring down — in that
      // order, so a failure halfway leaves a working harness rather than none. Taking the
      // block out of the old file gives it back byte-identical: in #249 that file was the
      // project's hand-written constitution, and it had already been written into once.
      await applyInstall({ skillIds: ids, target: f.to, home, cwd, operation: 'repair' });
      unwireHook(target, paths);
      removeManagedSkills(paths);
      recordInManifest({ cwd, target: f.to, skillIds: ids, dropTarget: target });
    }
  }
  return { applied: todo, pending: changes.filter((c) => !okChanges.includes(c)), backup };
}
