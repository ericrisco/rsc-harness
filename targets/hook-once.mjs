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
export const SDD_GATE_TEXT = `===== rsc lane decisor (highest precedence) =====
Classify this turn before acting, and name the lane in one line.
- Asks for information — explain, compare, audit, review, propose? -> Answer.
  Write nothing and create no artifact. Change intent unclear -> ask one
  question and stay read-only; ambiguity slows the lane, it never raises it.
- Authorises a change? -> FTD (Fast-Track Development). One feature document,
  tasks checked off only against observed proof, a branch if it writes code.
- SDD, the ten-phase chain, is never entered by the harness alone. Propose it
  only when durable spec/plan/tasks would remove a substantial ambiguity, and
  enter it only on an explicit request or an accepted proposal. Size, file
  count and risk never select it.
Method: \`ftd\` · chain: \`sdd\` · full decisor in the always-on \`suggest\` body.
=================================================
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
