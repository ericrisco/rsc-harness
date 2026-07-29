---
name: code-review
description: "Use to judge a concrete diff, branch, or GitHub PR on its own merits with no rsc-SDD spec/plan chain to key off — the spec-less giving pass behind /code-review: only findings you can defend, one verdict, read-only unless --comment or --fix. NOT the SDD gate keyed to 02-DOCS/wiki/sdd/ that also processes incoming review comments (that is `review`)."
tags: [code-review, pr-review, quality, correctness]
recommends: [review, secure-coding, verify]
origin: risco
---

# Code review — standalone, spec-less diff judgment

You are reviewing a concrete change — a `git diff`, a branch, a GitHub PR, a pasted patch — on its own merits. No rsc-SDD spec/plan/constitution chain is required and you should not pretend one exists. This is the doctrine behind the executable `/code-review` slash command: same evidence bar, written as a discipline you run by hand. If the user is mid-SDD and wants to process *incoming* comments against `02-DOCS/wiki/sdd/`, that is `../review/SKILL.md`; a naked diff or an inbound third-party PR is this skill.

**The north star is signal-to-noise.** Report only findings you would stake your name on. A clean diff is `APPROVE`, not a manufactured nit. High-false-positive review gets tuned out by humans in about two weeks; the bar to aim for is the logic-error review where under 1% of findings come back marked wrong. Padding does not make you look thorough — it trains the reader to ignore you.

## Get the change and its intent first

Three inputs, in this order: **the diff**, **its stated purpose**, and **the touched surface** (the files around the hunks, not just the hunks).

```bash
# A GitHub PR
gh pr diff 1432
gh pr view 1432 --json title,body,files,additions,deletions

# A local branch against the trunk
git diff main...HEAD
git diff --stat main...HEAD   # see blast radius before reading

# A pasted patch — read it as given
```

A review with no notion of intent is a review of vibes. If no purpose is stated, **infer it from the diff and say what you assumed** ("Assuming this is meant to add idempotency to the webhook handler…") so the reader can correct a wrong premise — a silent wrong premise produces a confidently wrong review. Then read the *whole* changed file, not just the green/red lines: the structural failure of standalone review is judging a hunk without its context and shipping generic pattern-matched suggestions.

## The pass order

Run these in order. Passes 1–5 are correctness/safety and are blocking-eligible; pass 6 is cleanup and is usually `[should-fix]` or `[nit]`. **A clean pass is a reportable result** ("contracts: nothing changed shape, no finding"), not a pass you silently skip.

| # | Pass | The question | Typical defects |
|---|------|--------------|-----------------|
| 1 | Intent fidelity | Does it do what it claims? | Wrong behaviour, missing case from the stated goal, scope creep |
| 2 | Correctness & boundaries | Right on the edges? | Off-by-one, null/empty/unicode, overflow, timezone, concurrency, swallowed errors |
| 3 | Contracts & data | Do callers/data still hold? | Broken API shape, migration without backfill, nullable made non-null, enum drift |
| 4 | Security boundary | Untrusted input → dangerous sink? | Unsanitized input to query/shell/template, authz gap, secret in code/log |
| 5 | Tests as evidence | Do the tests prove the change? | Tests assert nothing, test the mock, miss the new branch, were deleted to go green |
| 6 | Reuse / simplification / efficiency | Could existing code do this? | Reimplemented helper, copy-paste divergence, N+1, needless allocation in a hot loop |

Pass 4 is a **boundary** pass — trace untrusted input to its sink and flag the reachable ones. For a real STRIDE/OWASP threat model with exploitability ranking and vulnerable→fixed diffs, hand off to `../secure-coding/SKILL.md`.

Adjacent jobs, delegated by name: running the lint/type/test gates until they are green is `../verify/SKILL.md` (this skill judges whether green is *correct*); root-causing one confirmed failure is `../debug/SKILL.md`; cross-checking spec/plan/tasks *before* code exists is `../analyze/SKILL.md`.

## Confidence floor and the false-positive skip-list

**The 80% rule:** if you are not at least ~80% sure a finding is real, you have two moves — trace the code until you *are* sure, or downgrade it to `[question]`. Never ship a guess dressed as a defect.

Skip these common false positives outright (or demote to `[question]`/`[nit]`):

- **Guarded upstream** — the "missing" check happens in the caller you can see; trace before you flag.
- **Framework-enforced** — the framework already does it (e.g. an ORM that parameterizes, a router that validates).
- **Behind an off-everywhere flag** — real but unreachable in any deployed config → `[nit]`, not blocking.
- **Test-only / generated code held to the prod bar** — don't demand prod-grade error handling in a fixture or a generated client.
- **Style the linter owns** — quotes, import order, line length. If a tool enforces it, don't spend a finding on it.

**No severity inflation.** Rank by `blast radius × reachability`, not by how clever the catch was. A typo in a log string is a nit even if it took effort to spot.

## Severity and finding format

- `[blocking]` — wrong/unsafe; merging causes a real defect. Must be fixed.
- `[should-fix]` — a real problem with bounded blast radius; fix it or consciously accept it.
- `[nit]` — minor; the reader may ignore it without consequence.
- `[question]` — you suspect an issue but cannot prove reachability; asking, not asserting.

Every finding carries **where / why / repro / fix**:

```text
[should-fix] api/orders.py:88 — duplicated total logic
  where:  `subtotal = sum(i.price * i.qty for i in items)` re-implements
          `cart.compute_subtotal()` (cart/totals.py:14), which also applies
          per-item discounts this copy silently drops.
  why:    discounted items now bill at full price on this path only;
          the two implementations will drift on the next discount change.
  repro:  order containing any item with `discount_pct > 0` → charged the
          undiscounted amount; covered by no test.
  fix:    call `cart.compute_subtotal(items)` instead of inlining the sum.
```

**Rule: no repro or stated mechanism → it is a `[question]`, not a blocker.** "This could overflow" with no path is a question; "n*1000 with n up to 3M exceeds int32 at orders.py:51" is a finding.

## Verify before you flag

Read the surrounding code, trace the *value*, confirm the path is reachable.

- **Bad:** "Looks like SQL injection." (pattern-match)
- **Good:** "`search()` interpolates `req.query.q` straight into `db.execute(\`… WHERE name='${q}'\`)` at search.ts:22; `q` is unvalidated user input → injection." (traced)

If you cannot trace it to a concrete value and a reachable sink, you do not yet have a finding.

## The verdict

End every review with exactly one, plainly — no mushy middle:

- **APPROVE** — no blockers, no should-fix. Point the user to `../ship/SKILL.md` to merge.
- **APPROVE WITH NITS** — mergeable; nits listed but none gate the merge.
- **CHANGES REQUESTED** — at least one `[blocking]`. List precisely what unblocks it, so the author knows when they are done.

## Effort dial

Mirror the slash command's effort level: **low/medium** → fewer, high-confidence findings (raise the confidence floor, focus on passes 1–4). **high/max** → broader coverage; uncertain findings are allowed but must be labelled `[question]`, never inflated into blockers. This is *coverage vs precision*, not the harness accompaniment dial — it changes what you look at, not how much you narrate.

## Emitting comments and applying fixes

**Read-only by default.** You produce findings + a verdict and stop there. Two opt-in modes:

- `--comment` → post the findings as an inline-anchored review on the PR.
- `--fix` → apply the agreed findings to the working tree.

```bash
# Summary review (the verdict)
gh pr review 1432 --request-changes -b "CHANGES REQUESTED — see inline. Blocker: orders.py:88 …"
gh pr review 1432 --approve -b "APPROVE — correctness and contracts clean."
```

Inline line-anchored comments go through the GitHub REST API — see `references/pr-workflow.md` for the JSON shape, fork-PR handling, and large-diff strategy. If `--fix` puts you on the default branch, **branch first**; commit or push **only when the user asks**; git authorship is **Eric** (no Claude co-author or generated footer).

## Anti-patterns

| Failure mode | Reality |
|---|---|
| "It compiles and the tests pass, so it's correct." | Tests prove green, not correct. Pass 5 asks whether the tests actually exercise the new branch — green for the wrong reason is a finding. |
| Listing everything you would have done differently. | That is noise. Report defects and reuse wins you can defend; preference is not a finding. |
| "It's just a dependency bump, skim it." | Bumps carry supply-chain and transitive risk and behaviour changes. Check the changelog/lockfile diff, not just the version string. |
| Applying every nit "to be safe" under `--fix`. | Each unrequested edit is scope creep and a regression surface. Apply the agreed findings only. |
