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

  **The hybrid case, which is common:** a table titled something like *"Anti-patterns /
  rationalizations — STOP"*, with an *Excuse → Reality* framing. Do not delete it and do not leave
  it as-is. **Keep every row, re-column it to `Anti-pattern | Do instead`, and drop the STOP /
  excuse framing.** The rows are the value; the borrowed urgency wrapper is what dimension 7
  forbids. Handling this the same way everywhere is what keeps the catalog consistent — deleting it
  in one skill and keeping it in the next is worse than either choice applied uniformly.
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
removed **and why**, and — just as important — what you deliberately **kept** and why.

**Authorship is Eric, never Claude.** No `Co-Authored-By` for any AI, no "Generated with Claude Code"
footer, nothing attributing the work to a tool — in the commit *or* the PR body. This is the hard
rule the `ship` skill enforces (`skills/ship/SKILL.md`), and it applies to this migration like
everything else in the repo. Verify before pushing:

```bash
git log -1 --format='%b' | grep -iE 'co-authored-by.*(claude|anthropic|ai)|generated with|claude code' \
  && echo "AUTHORSHIP VIOLATION — strip it" || echo "authorship clean"
```

Then `git push -u origin skill/<id>` and `gh pr create`. The PR body carries before/after description
chars, before/after body bytes, what went, what stayed, and the eval-lint result — and no AI
attribution line.

## Judgment

If the skill already meets the rubric, **say so and change only the description.** A small honest
diff beats a large invented one. Several skills in the pilot needed 5-line diffs; that is a good
outcome, not a failed pass. Never pad, and never cut substance to hit a number.

---

# For the orchestrator

Everything above is for the agent doing one skill. This half is for whoever is driving the fleet.

## Resuming, from nothing

There is no state file to keep in sync, on purpose. **The remote branches are the ledger:**

```bash
# what is done
git ls-remote --heads origin 'refs/heads/skill/*'
# what is left = skills/ minus those, minus what is already merged to main
```

So a cold session resumes with: *read this brief, compute the skills with no `skill/*` branch, launch
one agent per skill in its own worktree.* Nothing from any previous conversation is required.

## Order: by profile, not alphabetically

A skill's `description` is in context for everyone who installs it, so migrate by blast radius:

1. `minimal` profile — in every rsc install.
2. `core` profile — the default install (the SDD chain plus the control plane).
3. High-install stack skills — `nextjs`, `react`, `fastapi`, `postgresdb`, `design`, `typescript`,
   `python`, `go`, `flutter`, `secure-coding`, `deployment`.
4. Everything else.

If a run is cut short, this ordering means the part that was finished is the part that everyone pays for.

## Sharp edges (each one cost a real mistake)

- **`manifest.json` is derived.** Agents must never touch it — hundreds of parallel edits collide on
  the same lines. Regenerate once, centrally, with `npm run manifest` after merging.
- **A fresh worktree has no `node_modules`** (it is gitignored, so it is not checked out). `npm test`
  and `npm run validate` cannot run there. `scripts/eval-lint.sh` can — it uses python3.
- **Result-envelope blocks are asymmetric.** `specify`, `tasks`, `implement`, `verify`, `ship`,
  `parallel` and `sdd` have one; `plan`, `analyze`, `clarify`, `constitution`, `review` and `debug`
  do not. Tell each agent which case it is in, or it will helpfully invent one.
- **`author-skill` is special.** It teaches how to write skills, so it documented the *old*
  conventions. There, rewriting the guidance IS the migration — and the change has to reach its
  `references/` and `evals/`, which graded produced skills against the old rubric.
- **Short ids break greps.** `go`, `rag`, `php` match half of `eval-lint`'s output. Give those agents
  an anchored pattern (`grep -E '^go +'`).
- **Compound bash commands are denied whole.** The `ship-guard` hook rejects the entire call if any
  part matches `git checkout main`, so a chained `commit && push && checkout main` runs *nothing*.
  Split them.
- **The id `parallel` is unusable in a git command.** A sandbox guard aimed at GNU `parallel` matches
  the substring, so `git checkout -b skill/parallel` is refused. That skill's branch has to be
  created from the pushed commit with `gh api` instead. Any future id containing a blocked tool name
  will behave the same way.

## Content problems found while migrating — do NOT fix them in a format pass

Agents surfaced these and correctly left them alone. They need their own change:

- `sdd` claims every phase ends with a parseable envelope; six phases have none (see above).
- **`evals/cases.yaml` files carry stale claims about what the catalog contains, in both
  directions.** Three agents hit this independently: `course-storytelling` routes a negative to
  `deep-research`, which does not exist; `flutter` routes its Compose/SwiftUI negatives to `"none"`
  on the grounds those skills are "not in this catalog", though `compose-multiplatform` and
  `swift-ios` now are; `postgresdb` said the same of ORM traps, stale since `prisma-orm` and
  `drizzle-orm` shipped. This drifts every time the catalog grows.

  The root cause is that `eval-lint` does not actually verify a `route_to` names a real skill,
  even though the rubric lists exactly that as a deterministic gate — so the gate is decorative.
  (The 1024-char description limit had the same problem; that one is now enforced in
  `schema/frontmatter.schema.json`.) Fixing the linter is worth more than fixing the instances:
  it converts a recurring drift into a build error.
- `clarify`'s body calls itself "the fourth phase" while the chain it prints puts it third.
- `cold-outreach` never names `linkedin-outreach` in its route table, though the reverse link exists.
- `data-policy` says "walk five columns" and then lists six.

## Return value

```json
{"skill":"<id>","pr":"<url|null>","descBefore":0,"descAfter":0,"bytesBefore":0,"bytesAfter":0,
 "evalLint":"PASS|FAIL","removed":["…"],"kept":["…"],"notes":"anything the orchestrator must know"}
```
