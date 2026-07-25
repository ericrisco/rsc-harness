#!/usr/bin/env node
// rsc UserPromptSubmit payload (claude). Re-injects the SDD new-feature gate as the
// MOST-RECENT instruction on every user turn. The SessionStart hook already injects the
// full gate (the `suggest` body) once per session, but in a long session — or one with
// many installed skills whose descriptions crowd the context — that single injection can
// lose salience and a strongly-matched stack/builder skill can pull the model straight to
// code. This keeps the precedence rule in front of the model every turn, so the gate is
// independent of skill count and session length. Stdout is added to context for
// UserPromptSubmit, so a plain print is enough (no JSON needed).
//
// Invoked as `node userprompt-gate.mjs <projectRoot>` (not bash) so it runs on Windows too.
//   argv[2] = absolute project root
// Fail-open (never blocks a turn). Opt out per project with .rsc/.no-feature-gate.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { claimOnce, readHookInput, SDD_GATE_TEXT } from './hook-once.mjs';

const root = process.argv[2] || process.cwd();

// Opt-out: a project that does not want the always-on gate drops this marker file.
if (existsSync(join(root, '.rsc', '.no-feature-gate'))) process.exit(0);

// rsc wired in both user and project scope runs this once per scope, so the gate lands twice on
// every turn. `prompt_id` is unique per turn and identical across scopes, which makes the dedup
// exact — no time heuristic needed. Older Claude Code has no prompt_id: fall back to the prompt
// text, and if there is nothing to key on at all, emit (a duplicated gate beats a missing one).
const hook = readHookInput();
const turnKey = hook.prompt_id || (hook.prompt ? `p${hook.prompt.length}:${hook.prompt.slice(0, 64)}` : null);
if (hook.session_id && turnKey && !claimOnce(`up:${hook.session_id}:${turnKey}`)) process.exit(0);

process.stdout.write(SDD_GATE_TEXT);
