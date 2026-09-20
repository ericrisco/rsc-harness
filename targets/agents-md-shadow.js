// agents-md-shadow.js — keep the always-on body from arriving twice in Claude Code.
//
// THE DEFECT. rsc delivers its always-on layer through two different surfaces, one per
// assistant family:
//   - Claude Code  → a SessionStart hook (targets/claude.js) that PRINTS suggest's body.
//   - AGENTS.md family (codex, opencode, amp, jules, zed) → the body is written INTO the
//     root AGENTS.md between markers (targets/_md-block.js).
// Wiring both in one project is an ordinary install — this repo's own workspace does it.
// Until Claude Code 2.1.277 the two never met, because Claude Code did not read AGENTS.md.
//
// From 2.1.277 it does: with NO CLAUDE.md in the working directory or above it, Claude Code
// reads the root AGENTS.md as the project instructions. In a dual-wired project that makes
// the same ~7 KB body land twice per session — once printed by the hook, once loaded from
// the file. Anthropic documents the shape of this exact collision and its remedy ("A
// SessionStart hook that prints AGENTS.md: remove it. Once Claude reads AGENTS.md directly,
// the hook adds a second copy to the context").
//
// WHY THIS IS NOT SOLVED BY MAKING THE HOOK STAY SILENT. The hook cannot know whether it is
// talking to a Claude Code that reads AGENTS.md: the SessionStart payload carries session_id,
// cwd, source and sometimes model — there is no version field, and no env var exposes one.
// Staying silent on a guess would, on every client older than 2.1.277, swallow the always-on
// layer completely. hook-once.mjs states the rule this file obeys: "A duplicated block costs
// context; a swallowed always-on layer costs the session its behaviour."
//
// THE FIX, version-free. Claude Code reads AGENTS.md only when no CLAUDE.md exists. So give
// it one. A CLAUDE.md at the project root makes every Claude Code — old or new — take the
// hook as the single source of the always-on body, and leaves AGENTS.md to the assistants it
// was written for. No version sniffing, no guess, same bytes on every client.
//
// The shadow deliberately does NOT `@AGENTS.md`-import: the import would expand the rsc block
// into context and recreate the duplication it exists to prevent.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

// The marker _md-block.js wraps the always-on body in. Its presence in a root AGENTS.md is
// what makes that file a second carrier of the body rather than the user's own prose.
const SUGGEST_MARK = '<!-- rsc-suggest:start -->';

// Identifies a CLAUDE.md as ours. Block-level HTML comments are stripped from Claude Code's
// context before injection, so everything explanatory below costs the user zero tokens.
export const SHADOW_MARK = '<!-- rsc:claude-md-shadow -->';

export const SHADOW_BODY = `${SHADOW_MARK}
# Project instructions

Claude Code reads this file. Every other assistant wired in this project reads \`AGENTS.md\`.

Project instructions for Claude Code go below.

<!--
  Why rsc created this file
  =========================
  rsc's always-on layer reaches Claude Code through its SessionStart hook, and reaches the
  AGENTS.md-family assistants through the root AGENTS.md. From Claude Code 2.1.277, a project
  with no CLAUDE.md is read through AGENTS.md directly — which would deliver that same body a
  second time, every session. The existence of this file is what prevents it.

  Do NOT add "@AGENTS.md" here: the import would expand the always-on block into context and
  bring the duplication back.

  rsc removes this file on uninstall while it is still untouched. Edit it and it is yours —
  rsc then leaves it alone, and it keeps doing its job just as well.
-->
`;

// The three files whose presence stops Claude Code reading AGENTS.md (per its memory docs).
// A user's own CLAUDE.md already does the shadow's job, so we never touch a project that has one.
const CLAUDE_MD_FORMS = ['CLAUDE.md', join('.claude', 'CLAUDE.md'), 'CLAUDE.local.md'];

// Claude Code looks for those files in the working directory AND every directory above it, so a
// CLAUDE.md two levels up already suppresses the AGENTS.md read. Walking up costs a few stats and
// keeps us from planting a file that was never needed.
function claudeMdAboveOrAt(root) {
  let dir = root;
  for (;;) {
    for (const form of CLAUDE_MD_FORMS) if (existsSync(join(dir, form))) return join(dir, form);
    const up = dirname(dir);
    if (up === dir || dir === parse(dir).root) return null;
    dir = up;
  }
}

// Is the Claude Code target wired in this project? Same predicate session-start.mjs and doctor
// use: an rsc command in .claude/settings.json. The backslash normalization is not cosmetic —
// a Windows install stores the path with separators that JSON escapes as pairs, and reading only
// for `.rsc/` answered "not wired" on the exact platform where duplication hurt most.
function claudeWired(root) {
  try {
    return readFileSync(join(root, '.claude', 'settings.json'), 'utf8')
      .replace(/\\\\/g, '/')
      .includes('.rsc/');
  } catch { return false; }
}

// Does the root AGENTS.md carry rsc's always-on block (as opposed to being the user's own prose)?
function agentsMdCarriesBody(root) {
  try { return readFileSync(join(root, 'AGENTS.md'), 'utf8').includes(SUGGEST_MARK); } catch { return false; }
}

/**
 * Write the shadow CLAUDE.md when — and only when — this project is in the configuration that
 * duplicates: Claude Code wired, the root AGENTS.md carrying rsc's block, and no CLAUDE.md of
 * any form at the root or above it.
 *
 * Called from BOTH adapters' wireHook. Installs run one target per call, so whichever of the two
 * is wired second is the one that sees the full picture; calling from both is what makes the fix
 * independent of the order the user picks their assistants in.
 *
 * @returns the path written, or null when nothing was needed. Never throws: a shadow we could not
 * write costs context, and that must not be the thing that fails an install.
 */
export function ensureShadowClaudeMd(projectRoot) {
  try {
    const dest = shadowTarget(projectRoot);
    if (!dest) return null;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, SHADOW_BODY);
    return dest;
  } catch { return null; }
}

/**
 * Where the shadow would go, or null when this project does not need one — the decision without
 * the write, so the installer can declare the file BEFORE it exists. A path this returns but the
 * install plan omits is a file no --dry-run mentions and no `rsc restore` can bring back.
 *
 * @param assumeClaudeWired for a claude install in flight: settings.json names the project as
 * wired only after wireHook writes it, so at plan time the answer has to be assumed, not read.
 */
export function shadowTarget(projectRoot, { assumeClaudeWired = false } = {}) {
  try {
    if (!assumeClaudeWired && !claudeWired(projectRoot)) return null;
    if (!agentsMdCarriesBody(projectRoot)) return null;
    if (claudeMdAboveOrAt(projectRoot)) return null;
    return join(projectRoot, 'CLAUDE.md');
  } catch { return null; }
}

/**
 * Take back exactly what we gave: remove the shadow only while it is byte-identical to what
 * ensureShadowClaudeMd wrote. The moment the user edits it, it is their project instructions —
 * uninstalling rsc must not delete those. Same discipline _md-block.js applies to its block.
 *
 * @returns the path removed, or null.
 */
export function removeShadowClaudeMd(projectRoot) {
  try {
    const dest = join(projectRoot, 'CLAUDE.md');
    if (readFileSync(dest, 'utf8') !== SHADOW_BODY) return null;
    rmSync(dest, { force: true });
    return dest;
  } catch { return null; }
}
