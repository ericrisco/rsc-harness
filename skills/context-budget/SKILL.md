---
name: context-budget
description: "Use when a long-horizon task is filling the context window and you must decide what to keep, offload, drop, or hand off to a fresh window — when to compact, what the summary must preserve, and whether to isolate a read-heavy subtask in a subagent. NOT dollar spend or caps (that is cost-tracking), NOT finding context via embeddings (that is rag)."
tags: ["context-window", "token-budget", "compaction", "context-rot", "long-running-agents", "handoff", "subagents"]
recommends: ["cost-tracking", "rag", "parallel", "building-agents", "harness"]
origin: risco
---

# Context budget

The context window is RAM, not a hard drive. Full ≠ free: a window stuffed to 95% does not just cost more money, it *reasons worse*. Model performance degrades as input tokens grow — even well inside the stated limit, every token added depletes a finite attention budget (Chroma "Context Rot" research, accessed 2026-06-02). Your job on a long task is to keep the *live* window lean and externalise everything else, so the work can run for hours across many fresh windows without losing the thread.

> **The one rule:** if you can reconstruct a thing from a file or from git, it does not belong resident in the window. Keep load-bearing-right-now; evict the rest. The cost of forgetting is one re-read; the cost of hoarding is silent quality rot on every turn that follows.

Neighbours, so you don't do their job here: pricing tokens, spend ledgers and hard `$` caps are `../cost-tracking/SKILL.md` — same words ("token budget"), different unit, dollars vs. attention. Finding the *right* context via embeddings/chunking is `../rag/SKILL.md`; RAG is *how you find* context, this is *how much* you let live and *when to evict*. Prompt text, few-shot and output format are `../prompt-engineering/SKILL.md`; the agent loop, tool schemas and provider adapters are `../building-agents/SKILL.md`; partition-then-gather fan-out of independent work is `../parallel/SKILL.md` (this skill *uses* subagents as a context-isolation tactic but does not own that discipline); the 01-TOOLS / 02-DOCS control plane is `../harness/SKILL.md`.

## Read the gauge first

Before you do anything, estimate utilisation: live input tokens ÷ the model's window limit. You cannot manage a budget you are not watching.

- **Compact early — around ~60% utilisation, not 80–95%.** Most people only act when quality already broke at 80–95%; by then the rot already happened. Treat 60% as the line where you start reducing, not panicking (practitioner guidance on Claude Code `/compact`, accessed 2026-06-02).
- **Trust the symptoms as an *earlier* trigger than the number.** You can feel rot before the gauge confirms it:
  - You re-read a file you already read this session.
  - You restate the plan or a decision you already made.
  - You contradict an earlier choice.
  - Tool results from ten turns ago are still sitting verbatim in the window.

Any one of those is a signal to act now, regardless of the percentage.

## The four moves

Every context-engineering action is one of four moves (context-engineering surveys, accessed 2026-06-02). Pick by *what is eating the window*.

**1. Offload** — summarise a tool output or large read; store the full thing in a file or reference, keep only the distilled fact + a path. *Why: raw bytes you might need later don't have to be resident now.*

```text
Bad:  <pastes the entire 4,000-line config file into the window to "have it">
Good: read it, keep the 30 relevant lines, leave a note:
      "full config at src/app/config.ts:1-4012; the load-bearing keys are X, Y, Z (lines 88-120)"
```

**2. Reduce** — compact or summarise stale history so the window carries the *conclusions*, not the journey. *Why: the dead-end exploration that got you to a decision is not the decision.*

```text
Bad:  carry 2,000 lines of trial-and-error debugging transcript forward unchanged.
Good: compact to "tried A (failed: race condition), B (failed: types); C works — see commit a1b2c3d."
```

**3. Retrieve** — fetch a fact at runtime instead of pre-loading it. *Why: most of what you might need, you won't; pull it when you actually need it.* This is RAG's job — see `../rag/SKILL.md`.

```text
Bad:  load all 40 design-doc sections up front in case one is relevant.
Good: keep an index; fetch section 7 the moment the task touches auth.
```

**4. Isolate** — hand a read-heavy or independent subtask to a subagent with its own fresh window; take back only the answer. *Why: a big read in a child window never pollutes the parent's.* Subagents are the single most effective anti-rot pattern (Anthropic context-engineering guidance, accessed 2026-06-02).

```text
Bad:  read 12 files into the main window to answer "which module owns retries?"
Good: spawn a subagent to scan them; it returns "retries live in lib/http/retry.ts:44" — that one line lands in the parent.
```

## Decision table: the window is filling — what do I do?

| What is eating the window | Move | Concrete action |
|---|---|---|
| Bloated tool output / a giant pasted file or log | **Offload** | Distil to the load-bearing lines, write the full thing to a file, keep a `path:line` note. |
| Stale early history, dead-end exploration | **Reduce** | `/compact` now (you're at ~60%, not 95%) with preserve instructions; keep decisions, drop the journey. |
| A fact you need is simply not in the window | **Retrieve** | Fetch it on demand via `../rag/SKILL.md`; don't pre-load "just in case". |
| A read-heavy or independent subtask | **Isolate** | Spawn a subagent (fresh window) via `../parallel/SKILL.md`; take back only the answer, never the transcript. |
| The whole task won't fit any single window | **Hand off** | Write a progress file (below) so a fresh window resumes in one read. |

## Compaction, concretely

**Manual (`/compact`).** Do it early and tell it what to keep. A bare `/compact` will happily drop the file paths and decisions you needed.

```text
/compact keep: the migration plan, every file path touched, the three decisions
(use Drizzle, keep the legacy table read-only, cut over Friday), and the open TODOs.
drop: the exploratory diffs and the debugging transcript.
```

**Server-side (beta).** The API can compact for you: beta header `compact-2026-01-12`, edit type `compact_20260112`, default trigger at `input_tokens` = **150,000** (min 50,000), `pause_after_compaction` defaults `false`. The API drops all blocks before the compaction block and continues from the `<summary>` — and you must append the *whole* response (including the compaction block) to subsequent requests (Claude API "Compaction" docs, accessed 2026-06-02). The exact contract and the append rule are version-specific and rot fastest, so they live in `references/handoff-and-compaction.md` — read it before you wire this up.

**A good summary preserves** decisions, file paths, open TODOs, and gotchas/constraints. **A good summary drops** raw logs, dead-end exploration, and redundant restatements. If the summary can't resume the task, it failed.

## Surviving a fresh window (handoff discipline)

When the task is bigger than one window, the win is making a *fresh* window resume the work in a single read. The long-running harness pattern (Anthropic, "Effective harnesses for long-running agents", published 2025-11-26, accessed 2026-06-02) is: an initializer session sets up the work, then each coding session works **one unit at a time** and leaves a structured update — a progress log (e.g. `claude-progress.txt`) plus git history plus a structured feature list — so the next window reconstructs state without you re-explaining it.

Write the handoff *before* you run out of room, not after quality already cratered. The template (Goal / Done / In-progress / Next / Gotchas / Key paths) and a good-vs-bad summary checklist are in `references/handoff-and-compaction.md`.

## Budget allocation heuristic

A starting split for a production agent's window — a **heuristic, not a law** (context-engineering production guidance, accessed 2026-06-02). Tune to your task; the point is to leave headroom and trigger reduction well before 100%.

| Slice | Rough share |
|---|---|
| System / instructions | ~10–15% |
| Tool definitions & results | ~15–20% |
| Knowledge / RAG injections | ~30–40% |
| Working headroom (kept clear) | the rest — defend it |

## Anti-patterns

| Anti-pattern | Why it rots | Do instead |
|---|---|---|
| Read the whole repo into context "to be safe" | Thousands of irrelevant tokens degrade every later turn | Read the files the task touches; leave path notes for the rest |
| Compact only at 95% when things break | The rot already happened; you're summarising damaged reasoning | Compact at ~60%, before quality drops |
| Let tool results pile up verbatim | Stale outputs from 10 turns ago still taxing attention | Offload to a file, keep the distilled fact + path |
| Re-explain the plan every turn | Burns the same tokens repeatedly and invites drift | State it once; keep it in the progress file, reference it |
| Paste a subagent's full transcript back into the parent | Defeats the entire point of isolation — the child's bloat lands in the parent | Take back only the answer/artifact, never the transcript |
| Treat the window as infinite because the model "has 1M" | Context rot scales with tokens regardless of the limit | Budget against attention, not the advertised ceiling |
| Carry dead-end exploration forward | The journey isn't the decision; it's pure noise | Reduce to the conclusion + the commit that proves it |
