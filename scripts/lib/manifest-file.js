import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// `.rsc.json` — the team's decision about this project's harness, committed.
//
// It exists because nothing else could travel. The per-target state lives inside the
// assistant's own directory, which is machine wiring; `syncInstalled()` reads it, so a
// clone finds zero skills and does nothing. The declaration had to move to the root.
//
// It is a DECLARATION, never an inventory: ids and names only, no paths and no file
// lists. Two reasons. Paths differ by platform (some machines symlink, others copy), so
// committing them reproduces in the manifest the very conflict this removes from the
// skill directories. And a committed file gets merge conflicts by nature — one entry per
// line, stable key order, so resolving one means reading it, not understanding a format.
export const MANIFEST = '.rsc.json';
export const manifestPath = (cwd = process.cwd()) => join(cwd, MANIFEST);

const KEYS = ['version', 'targets', 'skills', 'agents', 'ownSkills', 'catalogVersion', 'tier', 'optOuts', 'memory', 'onboarding'];

export function readManifest(cwd = process.cwd()) {
  const file = manifestPath(cwd);
  if (!existsSync(file)) return null;
  let raw;
  // An unreadable manifest is NOT the same as an absent one. Absent means "not adopted
  // yet" and is normal; corrupt means the file that governs this project cannot be
  // trusted, and silently treating it as absent would then overwrite it on the next
  // install. Say it and stop.
  try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch {
    throw new Error(`${MANIFEST} exists but is not readable JSON — fix or delete it; rsc will not overwrite it`);
  }
  return {
    version: raw.version ?? 1,
    targets: raw.targets || [],
    skills: raw.skills || [],
    agents: raw.agents || [],
    ownSkills: raw.ownSkills || [],
    catalogVersion: raw.catalogVersion ?? null,
    tier: raw.tier ?? null,
    optOuts: raw.optOuts || [],
    memory: raw.memory ?? undefined,
    onboarding: raw.onboarding ?? undefined,
  };
}

// Stable output: fixed key order, arrays one entry per line, order as given. Rewriting an
// unchanged manifest must produce identical bytes, or every install shows up as a diff.
export function writeManifest(cwd, manifest) {
  const out = {};
  for (const k of KEYS) if (manifest[k] !== undefined) out[k] = manifest[k];
  out.version ??= 1;
  out.agents ??= [];
  const ordered = {};
  for (const k of KEYS) if (out[k] !== undefined) ordered[k] = out[k];
  const file = manifestPath(cwd);
  writeFileSync(file, JSON.stringify(ordered, null, 2) + '\n');
  return file;
}
