# skill-migration-brief — how to move one skill to the Claude-5-era rubric

This is the working brief for the catalog-wide migration. One agent, one skill, one worktree, one
branch, one PR. `scripts/skill-rubric.md` is the spec; this is how to apply it to an existing skill.

## Why this exists

Anthropic's *The new rules of context engineering for Claude 5 generation models* (Jul 2026) reports
that >80% of Claude Code's system prompt was removed with no measurable eval loss, and names the
patterns that stopped paying: **repeating yourself across layers**, **over-constraining with rules
where judgment suffices**, and **enumerating examples where an expressive interface would do**.

Applied here: a skill's `description` is in context on **every turn it is installed**, invoked or
not. Across 257 skills that was 207 KB. The body is loaded when the skill fires. Both are paid for
by every user, so length is a cost, never a credit.

## The pass

1. `git checkout -b skill/<id>`
2. Read `scripts/skill-rubric.md`, then `skills/<id>/SKILL.md`.

### The description

Shape: **what it does · when to use it · an explicit `NOT <x> (that is \`sibling\`)` boundary.**

- Delete any `Triggers: '…', '…'` phrase list. The model matches by meaning; keyword lists in three
  languages are pure per-turn cost, and the body usually instructs semantic matching right next to
  them — a self-contradiction.
- Name a **real** sibling in the boundary. Verify it exists under `skills/`.
- Target ≤350 chars. Hard limit 1024 (schema-enforced). Third person, opens with "Use when/to".
- The test is **discrimination, not coverage**: could a reader choose this skill over its nearest
  sibling from the description alone?

### The body

The goal is the smallest body that still routes correctly. 400 lines is a ceiling; there is no floor.

**Remove:**

- Rule banks that restate the flow — "Iron rules (non-negotiable)", "Rationalizations — STOP".
  A rule worth keeping moves next to the step it governs, and says *why* it is absolute instead of
  shouting NON-NEGOTIABLE. A rule in an appendix is skimmed; a rule in context is followed.
- Re-teaching of what another skill owns. The accompaniment dial belongs to `init`; the SDD method
  belongs to `sdd`. Read the profile and point; do not restate, or the two drift apart.
- "When to use" sections that restate the description, and trailing reference indexes whose links
  already appear inline at point of use.

**Keep — these are not padding:**

- The **anti-patterns table**. The rubric requires one, and it is a different animal from a
  rationalization table: it names concrete failure modes, not rules already stated above it.
- Decision tables where the flow genuinely branches.
- Tables specific to *this* skill's phase (e.g. what to show at each checkpoint) — that is not the
  generic dial.
- Worked bad/good pairs that teach judgment by demonstration.
- Result-envelope blocks, chain position, and output contracts where they already exist. Do **not**
  add one that was never there: that is a content change, not a format change.

**Invariant:** every file under `skills/<id>/references/` must be linked from the body. An unlinked
reference is never loaded, so it is dead weight in the package. Folding a tail index into inline
mentions is fine — the link just has to survive. `scripts/`, `evals/` and `assets/` need no link.

**Preserve substance exactly.** This is a context-engineering pass, not a content rewrite. Do not
change recommendations, versions, commands, figures, or add claims.

## Verify

Your worktree has **no `node_modules`**, so:

- Run: `bash scripts/eval-lint.sh 2>&1 | grep -i '^<id>'` → must report PASS.
- Check the description length and that every `references/` file is linked.
- Do **not** run `npm test` or `npm run validate` — they need dependencies you do not have. The
  orchestrator runs them once, globally, after merge.
- Do **not** edit `manifest.json`. It is derived, and parallel edits from hundreds of agents would
  all conflict on the same lines. The orchestrator regenerates it once at the end.

## Ship

Commit only `skills/<id>/`. Subject `refactor(<id>): <what you actually did>`. The body says what you
removed **and why**, and — just as important — what you deliberately **kept** and why. Close with:

```text
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

Then `git push -u origin skill/<id>` and `gh pr create`. The PR body carries before/after description
chars, before/after body bytes, what went, what stayed, and the eval-lint result. Close it with:

```text
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Judgment

If the skill already meets the rubric, **say so and change only the description.** A small honest
diff beats a large invented one. Several skills in the pilot needed 5-line diffs; that is a good
outcome, not a failed pass. Never pad, and never cut substance to hit a number.

## Return value

```json
{"skill":"<id>","pr":"<url|null>","descBefore":0,"descAfter":0,"bytesBefore":0,"bytesAfter":0,
 "evalLint":"PASS|FAIL","removed":["…"],"kept":["…"],"notes":"anything the orchestrator must know"}
```
