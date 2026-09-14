#!/usr/bin/env node
// The one piece of the harness that travels in git.
//
// `project-manifest` settled what gets committed: the manifest (what the team decided) travels, the
// wiring travels, and `.rsc/` does not — its contents are machine-shaped, symlinks on one OS and
// real copies on another, and committing either shape breaks the other. That boundary is right and
// this file does not move it.
//
// What it left behind is the hole this file fills: the committed wiring points into the directory
// that does not travel, so the first session in a clone runs seven hooks against seven files that
// are not there. The person does not get a warning, they get the module loader's stack trace — and
// three of the seven are shell guards, so they get it again on every shell call. `project-manifest`
// already promised the opposite ("quien clona se entera de que tiene que reconstruir sin que nadie
// se lo diga"); this is the promise being kept.
//
// So the wiring points HERE instead, and this file is committed. Two jobs, in this order:
//
//   1. The harness is mounted  → delegate to the real script and say NOTHING of our own. The healthy
//      case is almost everyone, every session, and it must cost zero bytes of context (P5 — this
//      repo's own scar is 207 KB paid per turn). One existsSync is not paid in tokens; a line of
//      output is.
//   2. The harness is not mounted → say what is wrong as a symptom, name what would be installed,
//      and get out of the way. Never block the turn, never write anything first.
//
// It never throws. A bootstrap that can crash is the bug it exists to remove.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const PACKAGE = '@ericrisco/rsc';

/**
 * What the project declares, as a value — never as an exception.
 * A corrupt manifest is a state we report, not a crash we propagate (spec AC#20).
 */
export function readManifest(root) {
  const path = join(root, '.rsc.json');
  if (!existsSync(path)) return { state: 'absent' };
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    return { state: 'unreadable', reason: err?.code ?? 'unreadable' };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: 'unreadable', reason: 'not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { state: 'unreadable', reason: 'not an object' };
  }
  const skills = Array.isArray(parsed.skills) ? parsed.skills : [];
  const own = Array.isArray(parsed.ownSkills) ? parsed.ownSkills : [];
  // A manifest with nothing declared is not a clone waiting to be equipped; there is nothing to offer.
  if (!skills.length && !own.length) return { state: 'absent' };
  return {
    state: 'declared',
    skills,
    own,
    catalogVersion: typeof parsed.catalogVersion === 'string' ? parsed.catalogVersion : null,
    targets: Array.isArray(parsed.targets) ? parsed.targets : [],
  };
}

/**
 * The text a person sees, built from the manifest alone.
 * Pure: it decides nothing about disk and writes nothing, so it can be tested without one.
 */
export function composeOffer(manifest) {
  if (manifest.state === 'absent') return { offers: false, text: '' };
  if (manifest.state === 'unreadable') {
    return {
      offers: false,
      text:
        '===== rsc =====\n' +
        `This project declares a harness, but its manifest cannot be read (${manifest.reason}).\n` +
        'Nothing has been installed and nothing was changed. Someone on the team needs to fix\n' +
        '.rsc.json before the harness can be rebuilt here.\n' +
        '===============\n',
    };
  }
  // The version is named, never guessed: what gets installed is what the team pinned, and a person
  // accepting an install on a repo they just cloned is entitled to read the exact thing first
  // (spec AC#21). No pin is itself a fact worth showing, not a blank to fill in.
  //
  // And it has to be IN THE COMMAND, not only in the prose above it. `npx @ericrisco/rsc sync`
  // resolves to the latest published package, so an offer phrased that way hands a clone whatever
  // shipped since — the exact divergence the pin exists to prevent, introduced by the feature meant
  // to honour it. Pinned, the command is reproducible three months from now (spec AC#6).
  const pin = manifest.catalogVersion ? `${PACKAGE}@${manifest.catalogVersion}` : `${PACKAGE} (no version pinned)`;
  const command = manifest.catalogVersion ? `npx ${PACKAGE}@${manifest.catalogVersion} sync` : `npx ${PACKAGE} sync`;
  const count = manifest.skills.length;
  const own = manifest.own.length ? `, plus ${manifest.own.length} written by the team (never overwritten)` : '';
  return {
    offers: true,
    text:
      '===== rsc =====\n' +
      'This project declares a harness that is not built on this machine, so the assistant\n' +
      "cannot see any of the project's skills right now. Nothing is broken and nothing was\n" +
      'changed — the harness simply does not travel through git, by design.\n' +
      '\n' +
      `WOULD INSTALL: ${pin} — ${count} skill(s) as pinned in .rsc.json${own}.\n` +
      'It writes .rsc/ and the skill entries; it never touches anything written by hand.\n' +
      '\n' +
      'ACTION: ask the user whether to build it, in one line, and continue with their request\n' +
      'either way — this must not hold up what they asked for. On a yes, run EXACTLY:\n' +
      `  ${command}\n` +
      '(the version is the one this project pinned. Do not substitute `@latest`: a release nobody\n' +
      ' on this team adopted is not an upgrade, it is two people quietly drifting apart.)\n' +
      "On a no, create .rsc/.no-harness so this is not offered again on this machine.\n" +
      '===============\n',
  };
}

/**
 * Delegate to the real hook script, preserving what it believes about how it was invoked.
 * `gitmoji-guard` only runs its main block when `process.argv[1]` is its own path, so the splice is
 * load-bearing, not tidiness: without it the guard loads and silently does nothing. The four
 * three arguments this file owns are dropped in the same move, together with our own path, so the delegate sees exactly the argv the
 * wiring used to hand it directly — anything less and every hook would need to learn about us.
 */
async function delegate(target, ownArgc) {
  // `realpathSync` and not `target` as given: the delegate may run its own identity check, and
  // `gitmoji-guard` does exactly that. Its `import.meta.url` comes back from the loader with
  // symlinks resolved, so handing it the raw path makes its main block silently not run — the guard
  // loads, denies nothing, and reports success. Same trap as `sameFile` below, one level down.
  process.argv.splice(1, ownArgc + 1, realpathSync(target));
  await import(pathToFileURL(target).href);
}

/**
 * @param {string} target the real hook script the wiring would have called
 * @param {string} root the project root, as the client resolved it
 * @param {boolean} announce whether this hook is the one allowed to speak (SessionStart only)
 */
export async function bootstrap(target, root, announce, ownArgc = 3) {
  if (existsSync(target)) return delegate(target, ownArgc);
  // Not mounted. Only one hook per session may speak, so the person is told once and not seven
  // times — and that is settled by WHICH hook this is, with no marker file, because writing a
  // marker before anyone consented is exactly what must not happen (spec AC#2).
  if (!announce) return;
  // Declining is a decision, and it is respected whole: no opening offer, and no risk reminder later
  // either. Ignoring the offer is a different thing entirely — that leaves the door open. The marker
  // is the one the three existing opt-outs already use, so a person who knows one knows all of them.
  if (existsSync(join(root, '.rsc', '.no-harness'))) return;
  const { text } = composeOffer(readManifest(root));
  if (text) process.stdout.write(text);
}

/**
 * "Was this file run directly?" — and the answer must survive a symlink.
 *
 * The idiomatic `import.meta.url === pathToFileURL(process.argv[1]).href` is wrong here, and wrong
 * in the most expensive way: `import.meta.url` is what the ESM loader resolved (symlinks RESOLVED),
 * while `process.argv[1]` is the raw string the client passed (symlinks INTACT). One symlinked
 * component anywhere in the project path — `/tmp` and `/var` on macOS, or the ordinary
 * `~/code -> /Volumes/external/code` — and they differ, this block never runs, node exits 0 having
 * printed nothing, and ALL SEVEN hooks become silent no-ops. Including the danger guard.
 *
 * It would even look correct: "zero bytes in the healthy case" is satisfied, for entirely the wrong
 * reason, while `doctor` keeps reporting every hook as properly wired. Before the wiring came
 * through this file, six of the seven had no identity check at all and were immune; routing them
 * all through one check is what makes getting it right load-bearing.
 */
function sameFile(a, b) {
  if (!a || !b) return false;
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return a === b;
  }
}

// Argument order is ours, then the delegate's untouched: <mode> <root> <target> [the real args…].
if (sameFile(fileURLToPath(import.meta.url), process.argv[1])) {
  const [mode, root, target] = process.argv.slice(2);
  // Fail open on the exit code, always: the harness is a convenience and never costs someone their
  // turn. But failing open is not the same as failing SILENT. A blanket catch here would swallow a
  // genuine crash inside any of the six delegated scripts, and a guard that crashed would become
  // indistinguishable from a guard that allowed — which is how a safety guard stops being one
  // without anybody finding out. So: absence is expected and stays quiet; anything else says so on
  // stderr and still exits 0.
  try {
    await bootstrap(target, root ?? process.cwd(), mode === 'announce');
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND') {
      process.stderr.write(`rsc: hook failed and was ignored — ${err?.message ?? err}\n`);
    }
  }
}
