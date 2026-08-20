#!/usr/bin/env node
// rsc Gitmoji guard (claude). Wired by targets/claude.js onto PreToolUse (matcher Bash)
// as `node ...` so it runs on every platform including Windows.
//   argv[2] = absolute project root   stdin = PreToolUse hook JSON
//
// Enforces one convention at the only deterministic moment it can be enforced: the
// commit is being written. Every commit message this harness produces carries a
// gitmoji (https://gitmoji.dev) — the intention of the change, visible in one glyph
// in `git log --oneline`, on top of the Conventional Commits grammar that already
// drives the semver bump. Prose in a skill asks; this hook decides.
//
// Accepted shapes (both are gitmoji-valid; the first is what `git-workflow` prescribes):
//   ✨ feat(api): add cursor paging
//   feat(api): ✨ add cursor paging
//
// Design (constitution P1/P2/P6/P7): deterministic, local-only, precise — it fires only
// on a `git commit` that carries its message inline, where the message can actually be
// read. Anything it cannot read with certainty (editor commit, -F file, --amend
// --no-edit, an unparseable command) is ALLOWED: a guard that guesses is a guard that
// gets turned off. Every deny names its recovery. Opt out with .rsc/.no-gitmoji.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The official gitmoji set (gitmoji.dev/api/gitmojis), as data: [emoji, code, semver, meaning].
// A table, not a chain of ifs — so a test can iterate it and the reference doc can be
// checked against it instead of drifting apart in prose.
export const GITMOJIS = [
  ['🎨', ':art:', null, "Improve structure / format of the code."],
  ['⚡️', ':zap:', 'patch', "Improve performance."],
  ['🔥', ':fire:', null, "Remove code or files."],
  ['🐛', ':bug:', 'patch', "Fix a bug."],
  ['🚑️', ':ambulance:', 'patch', "Critical hotfix."],
  ['✨', ':sparkles:', 'minor', "Introduce new features."],
  ['📝', ':memo:', null, "Add or update documentation."],
  ['🚀', ':rocket:', null, "Deploy stuff."],
  ['💄', ':lipstick:', 'patch', "Add or update the UI and style files."],
  ['🎉', ':tada:', null, "Begin a project."],
  ['✅', ':white_check_mark:', null, "Add, update, or pass tests."],
  ['🔒️', ':lock:', 'patch', "Fix security or privacy issues."],
  ['🔐', ':closed_lock_with_key:', null, "Add or update secrets."],
  ['🔖', ':bookmark:', null, "Release / Version tags."],
  ['🚨', ':rotating_light:', null, "Fix compiler / linter warnings."],
  ['🚧', ':construction:', null, "Work in progress."],
  ['💚', ':green_heart:', null, "Fix CI Build."],
  ['⬇️', ':arrow_down:', 'patch', "Downgrade dependencies."],
  ['⬆️', ':arrow_up:', 'patch', "Upgrade dependencies."],
  ['📌', ':pushpin:', 'patch', "Pin dependencies to specific versions."],
  ['👷', ':construction_worker:', null, "Add or update CI build system."],
  ['📈', ':chart_with_upwards_trend:', 'patch', "Add or update analytics or track code."],
  ['♻️', ':recycle:', null, "Refactor code."],
  ['➕', ':heavy_plus_sign:', 'patch', "Add a dependency."],
  ['➖', ':heavy_minus_sign:', 'patch', "Remove a dependency."],
  ['🔧', ':wrench:', 'patch', "Add or update configuration files."],
  ['🔨', ':hammer:', null, "Add or update development scripts."],
  ['🌐', ':globe_with_meridians:', 'patch', "Internationalization and localization."],
  ['✏️', ':pencil2:', 'patch', "Fix typos."],
  ['💩', ':poop:', null, "Write bad code that needs to be improved."],
  ['⏪️', ':rewind:', 'patch', "Revert changes."],
  ['🔀', ':twisted_rightwards_arrows:', null, "Merge branches."],
  ['📦️', ':package:', 'patch', "Add or update compiled files or packages."],
  ['👽️', ':alien:', 'patch', "Update code due to external API changes."],
  ['🚚', ':truck:', null, "Move or rename resources (e.g.: files, paths, routes)."],
  ['📄', ':page_facing_up:', null, "Add or update license."],
  ['💥', ':boom:', 'major', "Introduce breaking changes."],
  ['🍱', ':bento:', 'patch', "Add or update assets."],
  ['♿️', ':wheelchair:', 'patch', "Improve accessibility."],
  ['💡', ':bulb:', null, "Add or update comments in source code."],
  ['🍻', ':beers:', null, "Write code drunkenly."],
  ['💬', ':speech_balloon:', 'patch', "Add or update text and literals."],
  ['🗃️', ':card_file_box:', 'patch', "Perform database related changes."],
  ['🔊', ':loud_sound:', null, "Add or update logs."],
  ['🔇', ':mute:', null, "Remove logs."],
  ['👥', ':busts_in_silhouette:', null, "Add or update contributor(s)."],
  ['🚸', ':children_crossing:', 'patch', "Improve user experience / usability."],
  ['🏗️', ':building_construction:', null, "Make architectural changes."],
  ['📱', ':iphone:', 'patch', "Work on responsive design."],
  ['🤡', ':clown_face:', null, "Mock things."],
  ['🥚', ':egg:', 'patch', "Add or update an easter egg."],
  ['🙈', ':see_no_evil:', null, "Add or update a .gitignore file."],
  ['📸', ':camera_flash:', null, "Add or update snapshots."],
  ['⚗️', ':alembic:', 'patch', "Perform experiments."],
  ['🔍️', ':mag:', 'patch', "Improve SEO."],
  ['🏷️', ':label:', 'patch', "Add or update types."],
  ['🌱', ':seedling:', null, "Add or update seed files."],
  ['🚩', ':triangular_flag_on_post:', 'patch', "Add, update, or remove feature flags."],
  ['🥅', ':goal_net:', 'patch', "Catch errors."],
  ['💫', ':dizzy:', 'patch', "Add or update animations and transitions."],
  ['🗑️', ':wastebasket:', 'patch', "Deprecate code that needs to be cleaned up."],
  ['🛂', ':passport_control:', 'patch', "Work on code related to authorization, roles and permissions."],
  ['🩹', ':adhesive_bandage:', 'patch', "Simple fix for a non-critical issue."],
  ['🧐', ':monocle_face:', null, "Data exploration/inspection."],
  ['⚰️', ':coffin:', null, "Remove dead code."],
  ['🧪', ':test_tube:', null, "Add a failing test."],
  ['👔', ':necktie:', 'patch', "Add or update business logic."],
  ['🩺', ':stethoscope:', null, "Add or update healthcheck."],
  ['🧱', ':bricks:', null, "Infrastructure related changes."],
  ['🧑‍💻', ':technologist:', null, "Improve developer experience."],
  ['💸', ':money_with_wings:', null, "Add sponsorships or money related infrastructure."],
  ['🧵', ':thread:', null, "Add or update code related to multithreading or concurrency."],
  ['🦺', ':safety_vest:', null, "Add or update code related to validation."],
  ['✈️', ':airplane:', null, "Improve offline support."],
  ['🦖', ':t-rex:', null, "Code that adds backwards compatibility."],];

// Some official gitmojis carry U+FE0F (⚡️, 🔒️, 🗑️ …). A human typing the bare
// code point means the same emoji, so compare with the variation selector stripped —
// otherwise the guard would reject a correct commit over an invisible byte.
const bare = (s) => s.replace(/️/g, '');
export const EMOJI_SET = new Set(GITMOJIS.map(([e]) => bare(e)));
export const CODE_SET = new Set(GITMOJIS.map(([, c]) => c));

// git's own functional prefixes: these messages are consumed by `rebase --autosquash`,
// not read by humans, and the final message is the target commit's. Nothing to enforce.
const GIT_MAGIC = /^(fixup|squash|amend)!/;
// A Conventional Commits header, optionally present before the emoji.
const CONVENTIONAL = /^[a-zA-Z]+(\([^)\n]*\))?!?:\s*/;

// Does this subject line open with a gitmoji — either before the conventional prefix
// or immediately after it? An emoji buried mid-sentence is not an intention marker.
export function hasGitmoji(message) {
  const subject = String(message ?? '').split(/\r?\n/, 1)[0].trim();
  if (!subject) return false;
  if (GIT_MAGIC.test(subject)) return true;
  const candidates = [subject, subject.replace(CONVENTIONAL, '')];
  for (const c of candidates) {
    const head = bare(c);
    for (const e of EMOJI_SET) if (head.startsWith(e)) return true;
    const code = head.match(/^:[a-z0-9_+-]+:/);
    if (code && CODE_SET.has(code[0])) return true;
  }
  return false;
}

// ---- reading the message out of a shell command --------------------------------
// Shell is not parseable in a regex and we do not pretend otherwise: this recognizes
// the forms an agent or a human actually types, and returns null ("cannot tell") for
// everything else so the caller allows it.

const COMMIT = /\bgit\b(?:\s+-{1,2}\S+(?:\s+\S+)?)*\s+commit\b/;
const NO_MESSAGE_TO_READ = /(?:^|\s)(?:-F|--file|--template|-C\s+\S*HEAD|--reuse-message|--reedit-message)\b/;
const AMEND_NO_EDIT = /--no-edit\b/;
const HAS_INLINE_M = /(?:^|\s)(?:-[a-zA-Z]*m|--message)(?:=|\s|$)/;
// `git` must be the command being RUN, not text inside someone else's argument —
// otherwise `echo "git commit -m x"` or `grep "git commit -m"` gets denied, and a guard
// that blocks the discussion of commits is exactly the kind that gets switched off.
const RUNS_GIT = /^\s*(?:sudo\s+)?(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*git\b/;

const SEPARATORS = /&&|\|\||[;\n]/;

// Is this segment a `git commit` that carries its message inline and readably?
function readableCommit(segment) {
  return RUNS_GIT.test(segment)
    && COMMIT.test(segment)
    && HAS_INLINE_M.test(segment)
    && !NO_MESSAGE_TO_READ.test(segment)
    && !AMEND_NO_EDIT.test(segment);
}

// `-m "$(cat <<'EOF' … EOF)"` — the multi-line form. The heredoc body IS the message,
// and it may contain && or ; so it must be lifted out before any splitting.
function heredocBody(command) {
  const m = command.match(/<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\r?\n([\s\S]*?)\r?\n[ \t]*\1\b/);
  return m ? m[2] : null;
}

// -m/--message value, quoted or bare.
function inlineMessage(segment) {
  const m = segment.match(/(?:^|\s)(?:-[a-zA-Z]*m|--message)(?:=|\s+)("([^"]*)"|'([^']*)'|([^\s'"][^\s]*))/);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

// Every commit message this command would write, or null when nothing is checkable.
export function commitMessages(command) {
  const cmd = String(command ?? '');
  if (!COMMIT.test(cmd)) return [];

  // The heredoc form must be handled before any splitting: its body is the message and
  // may legitimately contain && or ;. The command that owns it is whatever runs just
  // before the `<<`.
  const hIdx = cmd.search(/<<-?\s*['"]?[A-Za-z_]/);
  if (hIdx !== -1) {
    const owner = cmd.slice(0, hIdx).split(SEPARATORS).pop() || '';
    if (!readableCommit(owner)) return [];
    const body = heredocBody(cmd);
    if (body === null) return [];
    const first = body.split(/\r?\n/).find((l) => l.trim() !== '');
    return first === undefined ? [] : [first];
  }

  const out = [];
  for (const segment of cmd.split(SEPARATORS)) {
    if (!readableCommit(segment)) continue;
    const msg = inlineMessage(segment);
    if (msg === null) continue;                       // editor commit — cannot read it here
    if (/^\$/.test(msg.trim())) continue;             // a variable/substitution, not a literal
    out.push(msg);
  }
  return out;
}

// ---- the deny message (P6: the recovery lives inside the refusal) ---------------

export const SUGGESTIONS = [
  ['feat', '✨'], ['fix', '🐛'], ['docs', '📝'], ['refactor', '♻️'], ['test', '✅'],
  ['perf', '⚡️'], ['chore', '🔧'], ['ci', '👷'], ['style', '🎨'], ['revert', '⏪️'],
];

export function denyMessage(message) {
  const subject = String(message ?? '').split(/\r?\n/, 1)[0].trim();
  const type = subject.match(/^([a-zA-Z]+)(\([^)\n]*\))?!?:/)?.[1]?.toLowerCase();
  const hit = SUGGESTIONS.find(([t]) => t === type);
  const rewrite = hit
    ? `${hit[1]} ${subject}`
    : `${SUGGESTIONS.find(([t]) => t === 'chore')[1]} ${subject || '<type>(<scope>): <subject>'}`;
  return [
    `This commit message has no gitmoji: "${subject}".`,
    'Every commit in this project opens with a gitmoji (gitmoji.dev) before the Conventional Commits header — the intention of the change, readable in one glyph in `git log --oneline`.',
    `Recover: re-run the commit with the emoji in front — \`${rewrite}\` — picking the gitmoji that matches the intention (✨ feature · 🐛 fix · 📝 docs · ♻️ refactor · ✅ tests · ⚡️ perf · 🔧 config · 👷 CI · 💥 breaking · 🔖 release). The full table is in the \`git-workflow\` skill (references/gitmoji.md). To turn this guard off for this project, create .rsc/.no-gitmoji.`,
  ].join('\n');
}

// ---- hook entrypoint -----------------------------------------------------------
// Skipped when imported by a test (P2: the mechanism is testable without a subprocess).
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] || process.cwd();
  const allow = () => process.exit(0);

  if (existsSync(join(root, '.rsc', '.no-gitmoji'))) allow();

  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { allow(); }
  if ((input.tool_name || input.toolName) !== 'Bash') allow();
  const command = input.tool_input?.command || input.toolInput?.command || '';
  if (typeof command !== 'string' || !command) allow();

  let offender = null;
  try {
    offender = commitMessages(command).find((m) => !hasGitmoji(m)) ?? null;
  } catch { allow(); } // any parsing surprise → allow (fail open, by design)
  if (offender === null) allow();

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: denyMessage(offender),
    },
  }));
  process.exit(0);
}
