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

import { existsSync, readFileSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const PACKAGE = '@ericrisco/rsc';
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i;

/**
 * The `.no-*` switches that are the TEAM's decision, and therefore the only ones a manifest may
 * speak about. Canonical copy: `targets/opt-outs.js`, which carries the reasoning.
 *
 * Duplicated on purpose and not by oversight. This file is COMMITTED into user repos and runs with
 * the package possibly not installed, so it cannot import anything — the same constraint that makes
 * `sello.mjs` a materialized sibling. A test holds the two copies equal, because duplication that
 * nothing checks is just drift with a head start.
 */
export const PROJECT_OPT_OUTS = [
  'audit', 'claudemd-check', 'danger-guard', 'feature-gate', 'gitmoji', 'ship-guard', 'worktree-cleanup',
];

/**
 * Validated at the parse boundary AND again here, on purpose.
 *
 * These functions are exported and they are the ones that build the sentence a person is told to run
 * EXACTLY. A single validation point is only as good as every caller reaching it, and the caller that
 * skips it is the one nobody remembers writing. Checking again where the string is used costs one
 * regex and removes the possibility entirely.
 */
const safeVersion = (v) => (typeof v === 'string' && SEMVER.test(v) ? v : null);

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
  // Ids, and only ids. `skills: [{id:"orient"}]` is valid JSON and used to throw inside `join()` —
  // before the delegate ran, so a mounted and perfectly healthy harness lost its whole always-on layer
  // over a manifest someone hand-edited. This file is COMMITTED into user repos, which means old
  // copies of it live on forever in projects nobody will update; it has to be maximally suspicious of
  // the only input it gets.
  // An allowlist, not a type check. `.rsc.json` travels through `git pull`, so its contents are
  // written by anyone who can open a pull request — and this feature now copies them into the text
  // the model reads. A newline closes rsc's own `=====` frame and opens a forged one; a `;` turns the
  // command we tell someone to run EXACTLY into two commands; a `..` walks out of the project and
  // turns the divergence notice into an oracle for what exists on the reviewer's disk.
  //
  // None of that is what a skill id is. A skill id is a short lowercase name, so that is all that is
  // accepted, and anything else is simply not there.
  const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
  const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && ID.test(x)) : []);
  const skills = ids(parsed.skills);
  const own = ids(parsed.ownSkills);
  // A manifest with nothing declared is not a clone waiting to be equipped; there is nothing to offer.
  if (!skills.length && !own.length) return { state: 'absent' };
  return {
    state: 'declared',
    skills,
    own,
    // Same reasoning, and it matters more here: this string is pasted into the command we tell a
    // person to run *exactly*. A version, or nothing — "no version pinned" is a true and harmless
    // thing to say, and it is what an unusable value becomes.
    catalogVersion: SEMVER.test(String(parsed.catalogVersion ?? '')) ? parsed.catalogVersion : null,
    targets: Array.isArray(parsed.targets) ? parsed.targets : [],
    // Same allowlist, same reason, and it bites harder here: these names are pasted into the
    // notice a model reads. A switch is a plain lowercase name or it is not a switch — and only
    // the ones the team is allowed to decide for everybody get through at all.
    optOuts: ids(parsed.optOuts).filter((n) => PROJECT_OPT_OUTS.includes(n)).sort(),
    tier: ['balanced', 'heavy'].includes(parsed.tier) ? parsed.tier : null,
  };
}

/**
 * Is what is installed still what the project declares?
 *
 * `.rsc/skills/<id>` is the canonical home of a skill's content on every assistant — the per-target
 * directories (`.claude/skills/`, `.codex/rsc/`, …) are links into it — so one rule answers this for
 * all seventeen without teaching this file a single target's layout.
 *
 * Only what is DECLARED AND MISSING is reported. Not the reverse: an extra directory could equally be
 * a skill someone wrote by hand, and this repo has already broken a person's own work once by
 * assuming otherwise. When it cannot be told apart, it is left alone.
 */
export function evaluateHarness(root, manifest) {
  if (manifest.state !== 'declared') {
    return { verdict: 'unknown', missing: [], ownMissing: [], optOutsMissing: [], tierDiffers: null };
  }
  // Catalog skills: `.rsc/skills/<id>` is where their content lands, and it is the same on all
  // seventeen assistants — the per-target directories are links into it.
  const fromCatalog = (id) => existsSync(join(root, '.rsc', 'skills', id));
  // Own skills are a different thing in a different place, and conflating them is how a healthy
  // project ends up nagged every session about work that is already correct. `.rsc/skills/` is filled
  // by copying FROM THE CATALOG, and an own skill is by definition not in the catalog, so it can never
  // appear there — looking for it there reports it missing forever, and the `sync` we would prescribe
  // could never fix it. They live where their assistant keeps skills, which is what this repo's own
  // `divergence()` already checks.
  const OWN_DIRS = [
    ['.claude', 'skills'], ['.codex', 'rsc'], ['.cursor', 'rules'], ['.windsurf', 'rules'],
    ['.clinerules'], ['.roo', 'rules'], ['.continue', 'rules'], ['.junie'], ['.kiro', 'steering'],
    ['.antigravity'], ['.opencode'], ['.rsc', 'skills'],
  ];
  const fromTeam = (name) => OWN_DIRS.some((dir) => existsSync(join(root, ...dir, name)));
  const missing = manifest.skills.filter((id) => !fromCatalog(id));
  const ownMissing = manifest.own.filter((name) => !fromTeam(name));
  // A gate the team disarmed that is still armed here. Declared-and-missing only, exactly as for
  // skills above: a marker this machine has and the manifest does not could be a decision somebody
  // is still making, and this file does not tell people what to think about their own work.
  const optOutsMissing = manifest.optOuts.filter((n) => !existsSync(join(root, '.rsc', `.no-${n}`)));
  const tierDiffers = manifest.tier && manifest.tier !== localTier(root) ? manifest.tier : null;
  if (!missing.length && !ownMissing.length && !optOutsMissing.length && !tierDiffers) {
    return { verdict: 'current', missing: [], ownMissing: [], optOutsMissing: [], tierDiffers: null };
  }
  return { verdict: 'behind', missing, ownMissing, optOutsMissing, tierDiffers };
}

/** The tier this machine actually runs at — `balanced` is the documented default, not a guess. */
function localTier(root) {
  try {
    return JSON.parse(readFileSync(join(root, '.rsc', 'developer.json'), 'utf8')).tier === 'heavy'
      ? 'heavy' : 'balanced';
  } catch { return 'balanced'; }
}

/**
 * What to say when the harness works but no longer matches what the team decided — the other half of
 * the feature: building a clone and bringing a stale one up to date are the same transaction, and
 * both converge on the MANIFEST, never on the newest release.
 *
 * The own skills are named separately and deliberately kept out of the sentence that follows the
 * command: rsc does not install them, their version is the commit, and listing them next to a thing
 * that installs would be a promise nothing keeps.
 */
export function composeDivergence(manifest, evaluation) {
  const version = safeVersion(manifest.catalogVersion);
  const command = version ? `npx ${PACKAGE}@${version} sync` : `npx ${PACKAGE} sync`;
  let text =
    '===== rsc =====\n' +
    'This project declares a harness that no longer matches what is built here — someone changed\n' +
    'it and git brought the change; nothing is broken.\n';
  if (evaluation.missing.length) {
    text += `MISSING, declared in .rsc.json: ${evaluation.missing.join(', ')}.\n`;
  }
  // Named as the convention they are, never as the file that implements them: "the team disarmed
  // the commit-message check" is something a person can agree or disagree with; ".no-gitmoji is
  // absent" is a fact about a directory they have never opened.
  if (evaluation.optOutsMissing?.length) {
    text += `DISARMED BY THE TEAM, still armed here: ${evaluation.optOutsMissing.join(', ')}.\n`;
  }
  if (evaluation.tierDiffers) {
    text += `DECLARED developer tier: ${evaluation.tierDiffers} — this machine runs the default.\n`;
  }
  // Before the command, never after: anything sitting under the action reads as part of what the
  // action installs, and these are the one thing rsc will not install. Their version is the commit.
  if (evaluation.ownMissing.length) {
    text +=
      `ALSO DECLARED, written by the team: ${evaluation.ownMissing.join(', ')} — these arrive through\n` +
      'git, not through any command, and rsc never installs or overwrites them.\n';
  }
  return (
    text +
    'ACTION: mention it in one line and carry on with what the user asked. To converge, run:\n' +
    `  ${command}\n` +
    '===============\n'
  );
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
  const version = safeVersion(manifest.catalogVersion);
  const pin = version ? `${PACKAGE}@${version}` : `${PACKAGE} (no version pinned)`;
  const command = version ? `npx ${PACKAGE}@${version} sync` : `npx ${PACKAGE} sync`;
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
      'either way — this must not hold up what they asked for. If there is nobody to ask (CI, an\n' +
      'unattended run), do NOT install: say it is missing and carry on. On a yes, run EXACTLY:\n' +
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
 * The three arguments this file owns are dropped in the same move, together with our own path, so the delegate sees exactly the argv the
 * wiring used to hand it directly — anything less and every hook would need to learn about us.
 */
async function delegate(target, ownArgc) {
  // `realpathSync` and not `target` as given: the delegate may run its own identity check, and
  // `gitmoji-guard` does exactly that. Its `import.meta.url` comes back from the loader with
  // symlinks resolved, so handing it the raw path makes its main block silently not run — the guard
  // loads, denies nothing, and reports success. Same trap as `sameFile` below, one level down.
  // One resolved value for both: argv[1] and the import specifier must agree, or a delegate that
  // checks its own identity loads and then does nothing — which under `--preserve-symlinks` is
  // exactly what happened.
  const resolved = realpathSync(target);
  process.argv.splice(1, ownArgc + 1, resolved);
  await import(pathToFileURL(resolved).href);
}

/**
 * @param {string} target the real hook script the wiring would have called
 * @param {string} root the project root, as the client resolved it
 * @param {boolean} announce whether this hook is the one allowed to speak (SessionStart only)
 */
/**
 * The protections a missing harness takes away, named by the thing a person is about to do rather
 * than by the guard that is gone — "you are about to commit and the commit checks are not here" is
 * actionable; "ship-guard is not installed" is not.
 *
 * RECOGNISING one of these is judgement and is declared NON-BINDING (P2): the list is deliberately
 * short and will miss things, and missing one costs a reminder, never a failure. What IS binding,
 * and what the tests hold, is everything around it — that it reminds at most once, that it never
 * denies a tool call, and that it stays silent for ordinary work.
 */
const PROTECTED = [
  // `git -C <path> commit` is not an edge case: it is the form this workspace's own CLAUDE.md
  // mandates, so without it the reminder would essentially never fire where it was written.
  { re: /\bgit\s+(-C\s+\S+\s+)?(commit|cz)\b/, what: 'commit' },
  { re: /\bgit\s+(-C\s+\S+\s+)?push\b/, what: 'push' },
  { re: /\bgit\s+(-C\s+\S+\s+)?merge\b/, what: 'merge' },
  { re: /\bgit\s+(-C\s+\S+\s+)?(switch|checkout)\s+(main|master)\b/, what: 'switch to the trunk' },
  { re: /\bnpm\s+publish\b/, what: 'publish' },
  { re: /\brm\s+-rf\b/, what: 'delete files irreversibly' },
];

/**
 * "Have we already reminded them in this project?" — kept in the OS temp directory, keyed by the
 * project path, and NEVER inside the project. The user's tree stays untouched until they consent,
 * which is the whole point of the first offer (spec AC#2); a note to ourselves about how many times
 * we have spoken is not their file to carry.
 */
function alreadyReminded(root) {
  // Keyed on the RESOLVED path: the same project reached through a symlinked alias is the same
  // project, and keying on the raw string warned twice.
  let key = root;
  try {
    key = realpathSync(root);
  } catch { /* unresolvable is still a usable key */ }
  // A per-user directory at 0700, not a bare name in a world-writable one. On Linux and in CI
  // containers `os.tmpdir()` is `/tmp` at 1777: the sticky bit stops anyone deleting our file, but
  // nothing stops them CREATING it first — and a planted empty file silences the one risk reminder
  // this design promises, while a planted DANGLING symlink turns our write into a file created at a
  // path they chose, owned by the person we were trying to help.
  const dir = join(tmpdir(), `rsc-${process.getuid ? process.getuid() : 'u'}`);
  const mark = join(dir, `offer-${createHash('sha256').update(key).digest('hex').slice(0, 16)}`);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch { /* fall through: the write below is what actually decides */ }
  try {
    // `wx` is the whole fix: create-or-fail, and it refuses to follow a symlink. Success means WE
    // made it and this is the first reminder. Failure means it already existed — planted or genuine,
    // and either way the honest reading is "do not speak again".
    writeFileSync(mark, '', { flag: 'wx' });
    return false;
  } catch {
    return true;
  }
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** The second and last offer: only when they are about to do the thing the absent harness guarded. */
function remindOnProtectedAction(root) {
  let command = '';
  try {
    const payload = JSON.parse(readStdin() || '{}');
    command = String(payload?.tool_input?.command ?? '');
  } catch { return; }
  const hit = PROTECTED.find(({ re }) => re.test(command));
  if (!hit) return;
  // Read BEFORE claiming the one reminder this project gets: a run with nothing to say must not spend
  // it. Otherwise a project whose manifest arrives later by `git pull` has already used up its budget
  // on a session where it could not have said anything.
  const manifest = readManifest(root);
  if (manifest.state !== 'declared') return;
  if (alreadyReminded(root)) return;
  const version = safeVersion(manifest.catalogVersion);
  const pin = version ? `@${version}` : '';
  // The envelope, not bare stdout. A `PreToolUse` hook's plain stdout is transcript-only, so the one
  // message this path is allowed to send would have gone to a place nobody looks. Every sibling guard
  // in this repo already wraps its output this way. And no `permissionDecision`: informing someone is
  // not denying them, and nothing here may ever cost a person their tool call.
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext:
        `rsc: you are about to ${hit.what}, and this project's checks for that are not built on ` +
        'this machine. Nothing is blocked, and this is the last time it will be mentioned. ' +
        `To build them: npx ${PACKAGE}${pin} sync`,
    },
  }));
}

/**
 * @param {string} target the real hook script the wiring would have called
 * @param {string} root the project root, as the client resolved it
 * @param {'announce'|'quiet'|'guard'} mode which hook this is, and therefore what it may say
 */
export async function bootstrap(target, root, mode, ownArgc = 3) {
  const mounted = existsSync(target);

  // Declining is a decision, and it is respected whole: no opening offer, no divergence note, and no
  // risk reminder either. Ignoring the offer is a different thing entirely — that leaves the door open.
  const declined = existsSync(join(root, '.rsc', '.no-harness'));

  if (mounted) {
    // The harness works. It may still be out of date, and a manifest that arrived by `git pull` is
    // exactly the case that used to pass in silence — half the feature missing. Say it, then get out
    // of the way: being behind is not a reason to stop working.
    if (mode === 'announce' && !declined) {
      const manifest = readManifest(root);
      const evaluation = evaluateHarness(root, manifest);
      if (evaluation.verdict === 'behind') process.stdout.write(composeDivergence(manifest, evaluation));
    }
    return delegate(target, ownArgc);
  }

  if (declined) return;
  if (mode === 'guard') return remindOnProtectedAction(root);
  // Only one hook per session opens with the offer, so the person is told once and not seven times —
  // settled by WHICH hook this is, with no marker in their tree (spec AC#2).
  if (mode !== 'announce') return;
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
 * printed nothing, and EVERY hook becomes a silent no-op. Including the danger guard.
 *
 * It would even look correct: "zero bytes in the healthy case" is satisfied, for entirely the wrong
 * reason, while `doctor` keeps reporting every hook as properly wired.
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
    await bootstrap(target, root ?? process.cwd(), mode);
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND') {
      process.stderr.write(`rsc: hook failed and was ignored — ${err?.message ?? err}\n`);
    }
  }
}
