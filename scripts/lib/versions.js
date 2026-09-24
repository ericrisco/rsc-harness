import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Which rsc is running, and which rsc this project was last built with. Two different numbers, and
// the gap between them is where a published fix fails to arrive: hooks are materialized as copies
// under `.rsc/`, so a release changes nothing in a project until someone syncs it. Nobody could see
// that gap before — there was no `--version`, and bug reports arrived without one.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CLI_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

/** `.rsc/.version` is written at install and at every sync — the version this project's hooks came from. */
export function installedVersion(root) {
  try { return readFileSync(join(root, '.rsc', '.version'), 'utf8').trim() || null; } catch { return null; }
}

export function isNewer(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

export function versionReport(root) {
  const installed = installedVersion(root);
  return { cli: CLI_VERSION, installed, behind: Boolean(installed && isNewer(CLI_VERSION, installed)) };
}
