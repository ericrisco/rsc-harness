// hook-once.mjs — cross-scope single-shot guard for rsc hooks.
//
// rsc can be wired in more than one scope at once (user-level ~/.claude/settings.json AND
// project-level .claude/settings.json). Each scope runs its OWN copy of the hook scripts, so
// the same always-on body and the same SDD gate get injected twice — once per scope. wireHook()
// is idempotent within a settings file but blind to the other one, so the duplication cannot be
// solved at install time; it has to be solved at injection time.
//
// The marker therefore CANNOT live in `.rsc/` — each scope has its own root, which is the whole
// problem. It lives in a per-user directory under the OS temp dir, which both scopes can see.
//
// Claude Code gives every hook the same `session_id` for both scopes, and the same `prompt_id`
// within one turn (docs: code.claude.com/docs/en/hooks). That is the dedup key.
//
// Fail-open is the rule throughout: if anything about this mechanism misbehaves, the hook prints.
// A duplicated block costs context; a swallowed always-on layer costs the session its behaviour.
import { mkdirSync, writeFileSync, statSync, readdirSync, unlinkSync, utimesSync, readFileSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';

const PRUNE_AFTER_MS = 24 * 3600 * 1000;

// Per-user so two accounts on one machine never share (or suppress) each other's markers.
// RSC_HOOK_MARKER_DIR overrides it so tests get an isolated directory per case.
export function markerDir() {
  if (process.env.RSC_HOOK_MARKER_DIR) {
    const dir = process.env.RSC_HOOK_MARKER_DIR;
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }
  let uid = 'anon';
  try { uid = String(userInfo().uid ?? userInfo().username ?? 'anon'); } catch { /* keep anon */ }
  const dir = join(tmpdir(), `rsc-hooks-${uid}`);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

// Keys are built from hook payload values, so they can contain anything. Flatten to a safe
// filename — a key must never be able to point outside the marker directory.
function safeName(key) {
  return String(key).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

// Drop markers from previous days so the directory cannot grow without bound. Best-effort.
function prune(dir, now) {
  try {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      try {
        if (now - statSync(p).mtimeMs > PRUNE_AFTER_MS) unlinkSync(p);
      } catch { /* raced with another hook — fine */ }
    }
  } catch { /* unreadable dir — fine */ }
}

/**
 * Claim the right to emit `key` once.
 *
 * @returns true if this process should print, false if another scope already did.
 *
 * `windowMs` bounds how long a claim lasts. Two scopes fire within milliseconds of each other,
 * while two genuine repeats of the same event (two compactions in one session, which reuse
 * session_id AND source) are minutes apart — so an expired marker means "new event", not
 * "duplicate". This window is the one heuristic in the design, and only SessionStart needs it:
 * UserPromptSubmit keys on prompt_id, which is already unique per turn.
 */
export function claimOnce(key, { dir = markerDir(), windowMs = 30_000, now = Date.now() } = {}) {
  try {
    const file = join(dir, safeName(key));
    try {
      // Atomic create: whichever scope gets here first is the one that prints.
      writeFileSync(file, String(now), { flag: 'wx' });
      prune(dir, now);
      return true;
    } catch {
      // Marker exists. Fresh → someone else already emitted this exact event.
      const age = now - statSync(file).mtimeMs;
      if (age <= windowMs) return false;
      // Stale → this is a new occurrence of the same key. Re-arm and print.
      const stamp = new Date(now);
      utimesSync(file, stamp, stamp);
      return true;
    }
  } catch {
    return true; // fail-open
  }
}

// The SDD gate text lives here, not inline in userprompt-gate.mjs, so it has exactly one
// definition: the hook emits it and `rsc doctor` measures it from the same constant. Anything
// that reports a byte count for text it does not own drifts the moment the text changes.
export const SDD_GATE_TEXT = `===== rsc SDD new-feature gate (highest precedence) =====
Before acting on this turn: if the user wants to BUILD, ADD, or CHANGE a feature — in
ANY language, judged by intent, not by keywords — you MUST route it through SDD via
\`specify\` FIRST. No feature code is written by ANY skill (stack skills included —
nextjs/react/fastapi/flutter/go/postgresdb/building-agents/design — and any builder skill
such as chatbot/course-builder/marketing) until a spec AND a plan exist and the user has
approved them. No skill outranks this gate.
- Unclear / in-between? -> \`specify\` (the safe default; a skipped spec is where drift hides).
- One-line / low-risk change, or a bug fix restoring intended behaviour? -> skip the chain,
  do it, and say so out loud.
Full gate + decision table live in the always-on \`suggest\` body; method in \`sdd\`.
=========================================================
`;

/**
 * Parse the hook payload Claude Code writes to stdin.
 * Pass `raw` explicitly in tests; in a hook, call with no argument to read fd 0.
 * Any problem (no stdin, closed fd, malformed JSON) degrades to {} — callers then fail open.
 */
export function readHookInput(raw) {
  try {
    const text = raw === undefined ? readFileSync(0, 'utf8') : raw;
    if (!text || !text.trim()) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
