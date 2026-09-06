import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkOrCopy } from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export function writeSkill(id, fromDir, toPath) {
  // Migrate away from the legacy nested layout (.claude/skills/rsc/<id>) that
  // Claude Code never discovered — it only reads .claude/skills/<name>/SKILL.md.
  // toPath is now .claude/skills/<id>; drop the stale rsc/ sibling if present.
  const legacy = join(dirname(toPath), 'rsc');
  if (existsSync(legacy)) rmSync(legacy, { recursive: true, force: true });
  return linkOrCopy(fromDir, toPath);
}

// A hook entry, stringified with its path separators normalized to `/`.
//
// This exists because of a Windows bug that cost real users 4× the context budget. `join()` yields
// `.rsc\session-start.mjs` on Windows, `JSON.stringify` escapes that to `.rsc\\session-start.mjs`,
// and all seven dedup filters below searched for a forward-slash needle (`.rsc/session-start.`).
// The needle never matched, so every `install` / `add` / `sync` APPENDED a hook instead of replacing
// it: a real Windows box reported every hook present four times, which means the `suggest` always-on
// body was injected 4× per session start and all six guards ran 4× per command.
//
// Worse, and unreported: `unwireHook` uses the same needles, so on Windows `uninstall` and `purge`
// removed NONE of the hooks they claim to remove — a cleanup that silently cleans nothing.
//
// ONE replacement, and only the JSON-escaped form. `JSON.stringify` escapes every backslash as
// `\\`, so a separator always arrives doubled and a LONE backslash in the JSON text is never a
// separator — it is some other escape (`\"`, `\n`, `\uXXXX`). Collapsing those too would mangle
// them for no gain, which is why the second `.replace(/\\/g, '/')` this started with is gone: a
// mutation pass showed nothing depended on it.
//
// Normalizing the HAYSTACK (never the needle) keeps every call site readable as a plain POSIX path,
// and keeps a user's own `C:\...\my-own-hook.mjs` from ever looking like an rsc hook.
// `scripts/doctor.js` already handled both forms; this is that knowledge, shared.
export function hookWiringOf(entry) {
  return JSON.stringify(entry).replace(/\\\\/g, '/');
}

// Inverse of wireHook: drop every rsc-wired hook entry (any command pointing at a
// .rsc/ script — session-start, worklog-checkpoint, ship-guard, danger-guard, … —
// plus the legacy cat-form) from settings.json, across all events. User hooks and
// other settings are preserved. Empty event arrays (and an empty hooks object) are
// pruned so we don't leave noise behind.
export function unwireHook(paths) {
  const file = paths.hookTarget;
  if (!existsSync(file)) return [];
  let settings;
  try { settings = JSON.parse(readFileSync(file, 'utf8')); } catch { return []; }
  if (!settings.hooks) return [];
  for (const event of Object.keys(settings.hooks)) {
    settings.hooks[event] = (settings.hooks[event] || []).filter((e) => {
      const s = hookWiringOf(e);
      return !s.includes('.rsc/') && !s.includes('skills/rsc/suggest');
    });
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return [file];
}

// SessionStart runs a project-local session-start.mjs via `node`: it prints
// suggest's always-on body, an onboarding banner when the workspace has no harness
// profile yet, and an auto-ingest nudge when the inbox has un-ingested material. We
// invoke with `node` (not bash) so the hook runs on Windows too. We materialize the
// script next to the shared base and point the hook at it. Any prior rsc SessionStart
// entry (the old `cat …/suggest/SKILL.md` form, or a previous `.sh`/`.mjs` script
// form) is dropped before we add the current one — idempotent, migrating legacy and
// bash-era hooks in place. Other (non-rsc) SessionStart hooks are preserved.
// Commands name the project through ${CLAUDE_PROJECT_DIR}, never through the absolute
// path of the folder it happened to be installed in. Baking that path in is what made a
// harness unshareable: a committed settings.json was broken in every other checkout, and
// even renaming your own folder broke it. The variable is resolved by the client at run
// time, so the same bytes work on every machine — which is the precondition for the
// manifest being worth committing at all.
const P = '${CLAUDE_PROJECT_DIR}';
const at = (...seg) => `${P}/${seg.join('/')}`;

export function wireHook(paths, sourceMd, policy = {}) {
  const scriptDest = join(paths.projectRoot, '.rsc', 'session-start.mjs');
  mkdirSync(dirname(scriptDest), { recursive: true });
  // Shared by session-start + userprompt-gate. Hooks are materialized file by file, so a module
  // they import must be copied as their SIBLING — a subdirectory import would break once copied.
  copyFileSync(join(HERE, 'hook-once.mjs'), join(paths.projectRoot, '.rsc', 'hook-once.mjs'));
  // Same reason: session-start imports the reaper for the landed-worktree sweep, so it travels as a
  // sibling too. Missing it does not break startup — the sweep is wrapped — it just goes silent.
  copyFileSync(join(HERE, 'worktree-reaper.mjs'), join(paths.projectRoot, '.rsc', 'worktree-reaper.mjs'));
  copyFileSync(join(HERE, 'session-start.mjs'), scriptDest);

  let suggestRel = at(relative(paths.projectRoot, paths.skillDir('suggest')).split(sep).join('/'), 'SKILL.md');
  const operationsSuggest = join(paths.projectRoot, '.rsc', 'suggest-always-on.md');
  if (policy.codeHooks === false) {
    writeFileSync(operationsSuggest, '# rsc-suggest — always-on operations layer\n\nRead `02-DOCS/wiki/harness/user-profile.md` before acting. Use `orient` to keep the user situated and `suggest` to offer a missing skill only when the current task needs it. Close with the configured orientation block.\n');
    suggestRel = at('.rsc', 'suggest-always-on.md');
  } else if (existsSync(operationsSuggest)) rmSync(operationsSuggest, { force: true });
  const cmd = `node "${at('.rsc', 'session-start.mjs')}" "${suggestRel}" "${P}"`;

  const file = paths.hookTarget;
  const settings = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  settings.hooks ||= {};
  settings.hooks.SessionStart ||= [];
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter((e) => {
    const s = hookWiringOf(e);
    // drop legacy cat-form and any prior session-start script (.sh from the bash era, or .mjs)
    return !s.includes('skills/rsc/suggest') && !s.includes('.rsc/session-start.');
  });
  settings.hooks.SessionStart.push({ hooks: [{ type: 'command', command: cmd }] });

  // Worklog checkpoint: PreCompact + SessionEnd run a project-local
  // worklog-checkpoint.mjs via `node` that reminds the agent to capture what we did
  // this session into 02-DOCS/raw/worklog/ (the work-driven on-ramp). Silent when
  // the workspace has no harness wiki. Registered idempotently on both events, with
  // any prior rsc worklog-checkpoint entry (.sh or .mjs) dropped first.
  const wlDest = join(paths.projectRoot, '.rsc', 'worklog-checkpoint.mjs');
  const written = [paths.hookTarget, scriptDest, wlDest];
  copyFileSync(join(HERE, 'worklog-checkpoint.mjs'), wlDest);
  const wlCmd = `node "${at('.rsc', 'worklog-checkpoint.mjs')}" "${P}"`;
  for (const event of ['PreCompact', 'SessionEnd']) {
    settings.hooks[event] ||= [];
    settings.hooks[event] = settings.hooks[event].filter(
      (e) => !hookWiringOf(e).includes('.rsc/worklog-checkpoint.'),
    );
    settings.hooks[event].push({ hooks: [{ type: 'command', command: wlCmd }] });
  }

  if (policy.codeHooks !== false) {
  // Ship guard: a PreToolUse(Bash) hook that DENIES switching to / merging the trunk
  // while the current feature branch has uncommitted or unpushed work — forcing the
  // commit → push → PR close (the `ship` skill). Materialized + node-run (Windows-safe),
  // registered idempotently, fail-open, opt-out via .rsc/.no-ship-guard. Other
  // (non-rsc) PreToolUse hooks are preserved.
  const sgDest = join(paths.projectRoot, '.rsc', 'ship-guard.mjs');
  copyFileSync(join(HERE, 'ship-guard.mjs'), sgDest);
  // sello.mjs is ship-guard's sibling import (hooks are materialized file-by-file,
  // so the deterministic sello core must land next to the guard that loads it).
  copyFileSync(join(HERE, 'sello.mjs'), join(paths.projectRoot, '.rsc', 'sello.mjs'));
  const sgCmd = `node "${at('.rsc', 'ship-guard.mjs')}" "${P}"`;
  settings.hooks.PreToolUse ||= [];
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
    (e) => !hookWiringOf(e).includes('.rsc/ship-guard.'),
  );
  settings.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: sgCmd }] });

  // Danger guard: a PreToolUse(Bash) hook that DENIES irreversible foot-gun commands
  // (rm -rf, git push --force, DROP/TRUNCATE, DELETE/UPDATE without WHERE, dd to /dev,
  // curl|bash, …) when the user-profile says the user is NON-technical (default-safe
  // when no profile exists yet; never guards a fully `technical` user). Materialized +
  // node-run (Windows-safe), idempotent, fail-open, opt-out via .rsc/.no-danger-guard.
  const dgDest = join(paths.projectRoot, '.rsc', 'danger-guard.mjs');
  copyFileSync(join(HERE, 'danger-guard.mjs'), dgDest);
  const dgCmd = `node "${at('.rsc', 'danger-guard.mjs')}" "${P}"`;
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
    (e) => !hookWiringOf(e).includes('.rsc/danger-guard.'),
  );
  settings.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: dgCmd }] });

  // Gitmoji guard: a PreToolUse(Bash) hook that DENIES a `git commit` whose message
  // carries no gitmoji (gitmoji.dev) in front of the Conventional Commits header. The
  // convention lives in `git-workflow`; prose asks, this hook decides — at the one
  // deterministic moment the message exists. Only fires when the message is inline and
  // readable (-m / heredoc); editor commits, -F files and --amend --no-edit are allowed.
  // Materialized + node-run (Windows-safe), idempotent, fail-open, opt-out via
  // .rsc/.no-gitmoji.
  const gmDest = join(paths.projectRoot, '.rsc', 'gitmoji-guard.mjs');
  copyFileSync(join(HERE, 'gitmoji-guard.mjs'), gmDest);
  const gmCmd = `node "${at('.rsc', 'gitmoji-guard.mjs')}" "${P}"`;
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
    (e) => !hookWiringOf(e).includes('.rsc/gitmoji-guard.'),
  );
  settings.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: gmCmd }] });

  // New-feature gate: a UserPromptSubmit hook that re-injects the SDD new-feature gate as
  // the most-recent instruction on every user turn. SessionStart injects the full gate (the
  // `suggest` body) once; this keeps the precedence rule salient regardless of how many
  // skills are installed or how long the session runs (otherwise a strongly-matched stack
  // skill can pull the model to code despite the gate being in context). UserPromptSubmit
  // stdout is added to context, so a plain print suffices. Materialized + node-run
  // (Windows-safe), idempotent, fail-open, opt-out via .rsc/.no-feature-gate. Other
  // (non-rsc) UserPromptSubmit hooks are preserved.
  const fgDest = join(paths.projectRoot, '.rsc', 'userprompt-gate.mjs');
  copyFileSync(join(HERE, 'userprompt-gate.mjs'), fgDest);
  const fgCmd = `node "${at('.rsc', 'userprompt-gate.mjs')}" "${P}"`;
  settings.hooks.UserPromptSubmit ||= [];
  settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
    (e) => !hookWiringOf(e).includes('.rsc/userprompt-gate.'),
  );
  settings.hooks.UserPromptSubmit.push({ hooks: [{ type: 'command', command: fgCmd }] });
  written.push(sgDest, dgDest, gmDest, fgDest, join(paths.projectRoot, '.rsc', 'sello.mjs'));
  } else {
    for (const event of ['PreToolUse', 'UserPromptSubmit']) {
      if (!settings.hooks[event]) continue;
      settings.hooks[event] = settings.hooks[event].filter((entry) => {
        const body = hookWiringOf(entry);
        return !body.includes('.rsc/ship-guard.') && !body.includes('.rsc/danger-guard.') &&
          !body.includes('.rsc/gitmoji-guard.') && !body.includes('.rsc/userprompt-gate.');
      });
      if (!settings.hooks[event].length) delete settings.hooks[event];
    }
    for (const name of ['ship-guard.mjs', 'danger-guard.mjs', 'gitmoji-guard.mjs', 'userprompt-gate.mjs', 'sello.mjs']) {
      rmSync(join(paths.projectRoot, '.rsc', name), { force: true });
    }
    written.push(operationsSuggest);
  }

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return written;
}
