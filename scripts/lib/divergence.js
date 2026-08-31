import { readManifest } from './manifest-file.js';
import { readState } from './state.js';
import { targetPaths } from '../../targets/index.js';
import { existsSync } from 'node:fs';

// What the team declared versus what is on this machine.
//
// The everyday case is not cloning — it is a teammate changing the harness and everyone
// else running `git pull`. The clone is day one; divergence is every other day. Nothing
// used to notice, so two people drifted apart in silence.
//
// Three buckets, because the three need different answers, and collapsing them is how a
// report starts nagging someone about their own work:
//   missing    — declared catalog skill, not installed here. Aligning installs it.
//   ownMissing — declared team skill, absent from the repo. Aligning says so and writes
//                nothing: it comes from the repo, not from us.
//   extra      — installed BY RSC, no longer declared.
// A hand-written skill that nobody declared is in none of them. Not declaring is a valid
// way to keep things of your own, not an oversight to correct.
export function divergence({ cwd = process.cwd(), target, home } = {}) {
  const empty = { missing: [], extra: [], ownMissing: [] };
  const manifest = readManifest(cwd);
  if (!manifest) return empty;

  const paths = targetPaths(target, home, cwd);
  const installed = new Set(Object.keys(readState(paths.stateFile).skills || {}));

  return {
    missing: (manifest.skills || []).filter((id) => !installed.has(id)),
    extra: [...installed].filter((id) => !(manifest.skills || []).includes(id)),
    ownMissing: (manifest.ownSkills || []).filter((name) => !existsSync(paths.skillDir(name))),
  };
}
