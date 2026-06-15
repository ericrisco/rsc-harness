---
name: review
description: "Use when giving OR receiving an adversarial code review in the rsc SDD chain — after implement/verify and before ship. Triggers: 'review this PR', 'review my diff', 'revisa este código', 'critique this change', 'be my reviewer', 'tear this apart', 'what's wrong with this code', plus the receiving side: 'the reviewer said X', 'address this review comment', 'they want me to change Y', 'do I have to do what the review says', 'PR feedback', 'someone left comments on my PR'. Covers the full loop: producing a rigorous, evidence-backed review keyed to the spec/plan/constitution under 02-DOCS/wiki/sdd/, AND processing incoming feedback with technical rigor — verify each finding against the code before agreeing, push back on the wrong ones, fix the real ones. NOT running lint/type/test gates (that's the verify phase) and NOT merging/closing the branch (that's ship). No performative agreement; points to ship when the diff survives review."
tags: [sdd, review, code-review]
recommends: [ship]
profiles: [core, full]
origin: risco
---

# Review — adversarial code review, both directions

Review is the **penultimate gate** of the rsc SDD chain: `constitution → specify → clarify → plan → tasks → analyze → implement → verify → **review** → ship`. By the time a diff reaches review, the `verify` phase has already proven that lint, types, tests and the stack `verify.sh` are green. Review answers a different question: **is the green diff actually correct, well-scoped, and faithful to the spec — or did it pass for the wrong reasons?**

This skill owns **two roles that share one discipline**:

- **Giving** a review — read a diff adversarially, find the real defects, rank them by impact, ship the verdict as evidence not opinion.
- **Receiving** a review — take incoming feedback (human or machine), verify each point against the code *before* acting, fix the real findings, and push back — with proof — on the wrong ones.

The discipline is the same in both directions: **claims are backed by evidence, never by deference.** A reviewer who waves through a bug to be agreeable, and an author who edits working code because a comment *sounded* authoritative, are making the same mistake. This skill exists to kill both.

## Read these first

1. `02-DOCS/wiki/harness/user-profile.md` — the **accompaniment dial** (L0..L3). It sets how much you narrate, not how rigorous you are. Rigor is fixed; verbosity is dialled. See "Accompaniment dial" below.
2. `02-DOCS/wiki/sdd/specs/<slug>.md` and `02-DOCS/wiki/sdd/plans/<slug>.md` — what the diff was *supposed* to do. A review with no spec is a review of vibes.
3. `02-DOCS/wiki/sdd/constitution.md` — the project's non-negotiables (stack canon, quality bars, conventions). Constitution violations are findings even when the code "works".

If there is no spec/plan (someone jumped straight to code), say so and review against the constitution + the diff's own stated intent. Don't pretend a spec exists.

## When to use / When NOT to use

Use when:

- A diff, branch, or PR is ready and you want it torn apart before it ships.
- You are the author and a review landed — comments from a teammate, a bot, or another agent — and you need to decide what to actually change.
- A "review comment" feels wrong, vague, or technically questionable and you're tempted to just comply.

Do NOT use when (route elsewhere):

- You need lint / type-check / test / audit to run and go green → that's the **verify** phase, run before review.
- The diff has survived review and you want to PR / merge / close the branch → that's the **ship** phase (and ship enforces Eric-only git authorship).
- It's specifically a *security* threat-model / OWASP pass → `../secure-coding/SKILL.md` (review folds in its findings, but the deep pass is owned there).
- The "review" is really framework-level "is this idiomatic React/FastAPI/Go" — pull the relevant stack skill (`../nextjs/SKILL.md`, `../fastapi/SKILL.md`, `../go/SKILL.md`, `../postgresdb/SKILL.md`, `../flutter/SKILL.md`) for the idiom, then judge against it here.

## The one rule

> **Every finding and every rebuttal carries evidence. No agreement without verification, no objection without a defect.**

Everything below is in service of that rule.

## Confidence filtering

A review's value is its signal-to-noise. Every finding you report costs the author triage time, so report only what you can stand behind:

- **>80% sure, or it doesn't ship.** If you're not >80% confident a finding is a real defect, either trace it until you are, or downgrade it to `[question]` and ask. Plausible-looking ≠ verified.
- **Zero findings is an acceptable verdict.** A clean diff gets `APPROVE`, not a manufactured nit. Padding a report to look thorough is the opposite of thorough.
- **Common false positives to skip:** patterns guarded two functions up; "unsafe" calls on values that are provably constant/internal; missing checks the framework already enforces; style the linter owns; defects behind a flag that's off everywhere (note as `nit`, not blocker); test-only or generated code held to prod standards.
- **No severity inflation.** A `should-fix` dressed as a `blocker` burns the same trust as a missed bug. Rank by actual blast radius and reachability — if everything is a blocker, nothing is.

## Executable review

This skill is the **discipline**; the **`rsc-review` bundle is its automated counterpart**. When you want the doctrine above run for you over a real diff:

- **`/code-review [pr]`** — fans the diff out to the per-language reviewer fleet (`code-reviewer`, `web-reviewer`, `python-reviewer`, `go-reviewer`, `sql-reviewer`, `flutter-reviewer`) in parallel and aggregates one ranked verdict.
- **`/security-scan`** — two-layer security pass: automated scanners plus the `security-reviewer` agent, merged into one exploitability-ranked report.

Those commands and agents enforce the same evidence bar and the same confidence filtering described here — they are this skill, executed.

---

## GIVING a review

A good review is not a list of everything you'd have done differently. It is a ranked set of **defects that matter**, each one reproducible from the diff itself.

### The pass order

Run these passes in order; each is cheap and catches a different class of defect. Stop padding the report once a pass is clean — a clean pass is a finding too ("auth path: checked ownership scoping, correct").

| Pass | The question | Typical defects |
| --- | --- | --- |
| **1. Spec fidelity** | Does the diff do what the spec/plan said — no more, no less? | Missing acceptance criteria; scope creep; a TODO masquerading as done |
| **2. Correctness** | Is it right on the boundaries, not just the happy path? | Off-by-one, null/empty/zero, error paths swallowed, race, wrong operator |
| **3. Contracts & data** | Do the interfaces and data shapes hold? | Breaking API change, nullable mismatch, migration that loses data, N+1 |
| **4. Security boundary** | Any untrusted input reaching a sink? | Injection, authz gap (authenticated ≠ authorized), secret in diff, SSRF |
| **5. Tests as evidence** | Do the tests actually exercise the change, or just pass? | Asserts on mocks, no failing case, happy-path-only, deleted assertions |
| **6. Constitution & fit** | Does it honor the project's canon and read like the codebase? | Banned pattern, wrong layer, duplicated logic, dead code left behind |

Passes 1–5 are correctness/safety — those produce **blocking** findings. Pass 6 is fit — usually **non-blocking** unless it violates a stated constitution rule.

### Severity — rank or it's noise

Tag every finding. An unranked review forces the author to triage your opinions; a ranked one tells them exactly what blocks the merge.

- **`blocker`** — ships a bug, a vuln, data loss, or breaks the spec. Merge does not happen until resolved.
- **`should-fix`** — real defect, narrow blast radius; fix now or file a tracked follow-up the author agrees to.
- **`nit`** — style/preference with no correctness impact. Explicitly labelled, never blocking, the author may decline freely.

If everything is a blocker, nothing is. If everything is a nit, you didn't review.

### Finding format

Each finding is a quoted location, the defect, the evidence, and a concrete fix. No "consider maybe looking at error handling here."

```text
[blocker] auth: authenticated user can read any document
  where:  api/documents.py:42  return db.get(Document, doc_id)
  why:    doc_id comes from the path; no owner check. Any logged-in
          user enumerates every document by id.
  repro:  GET /documents/<other_users_id> with a valid session → 200 + body.
  fix:    scope the query — WHERE id == doc_id AND owner_id == current_user.id;
          return 404 (not 403) on miss to avoid leaking existence.
```

A finding without a `repro` or a mechanism is a *suspicion*. Label it `[question]` and ask, don't assert it as a defect.

### Verify before you flag

The reviewer is held to the same evidence bar as the author. Before writing a `blocker`:

- **Read the surrounding code**, not just the diff hunk. The check you think is missing may live two functions up.
- **Trace the value**, don't pattern-match. "This looks like SQL injection" is not a finding; "this f-string interpolates `request.args['q']` straight into `execute()`" is.
- **Confirm the path is reachable.** A defect behind a flag that's off in every environment is a `nit`, not a `blocker` — say so.

A reviewer who cries blocker on a non-bug burns the same trust as an author who ships one.

### The verdict

End every review you give with one of three, and nothing mushy in between:

- **`APPROVE`** — no blockers, no unresolved should-fix. Say it plainly and **point to ship**.
- **`APPROVE WITH NITS`** — mergeable; the nits are the author's call.
- **`CHANGES REQUESTED`** — one or more blockers/should-fix. List exactly what unblocks it.

---

## RECEIVING a review

This is the half everyone skips. Feedback arrives and the reflex is to either comply with all of it (looks cooperative, ships bugs) or dismiss the annoying parts (looks confident, ships bugs). Both skip the only step that matters: **checking whether the finding is true.**

### Process every comment through this gate

For each incoming finding, before touching a line of code:

```text
1. RESTATE   — what is the reviewer actually claiming is wrong? (in one sentence)
2. VERIFY    — go to the code. Is the claim true? Trace it. Can you reproduce it?
3. CLASSIFY  — true defect / partially-true / false / unclear
4. ACT       —
     true        → fix it, and add the test that would have caught it
     partial     → fix the real part, reply on the rest with evidence
     false       → DON'T change the code. Reply with the proof it's already handled
     unclear     → ask one specific question; don't guess and don't pre-emptively edit
```

The expensive failure is step 2 skipped. Editing working code because a comment *sounded* right introduces bugs the original author (you) already prevented.

### Pushback is a feature, not rudeness

Disagreeing with a wrong finding — **with evidence** — is doing the job, not being difficult. The reply is not "you're wrong"; it's the trace:

```text
> Reviewer: this can NPE if `user` is null.
Verified: `user` is non-null here — it's the return of `require_auth()` on
line 12, which raises 401 before this line on a null session. Added a test
(test_get_doc_unauthenticated) that asserts the 401 so this stays true.
Leaving the code as-is.
```

That reply *strengthens* the diff (it added a regression test) while declining the change. That's the bar.

### Performative agreement is the failure mode

The tells, and what to do instead:

| Tell | Reality | Do instead |
| --- | --- | --- |
| "Good catch!" then editing without checking | You don't yet know if it's a catch | Verify first; *then* "good catch" or "checked — already handled" |
| Rewriting a whole function to satisfy a nit | Scope creep dressed as responsiveness | Make the minimal change the nit asks for, or decline it as a nit |
| Silently making the change the bot suggested | Bots flag plausible-looking non-bugs constantly | Trace it like any other finding; reply with the verdict |
| "You're probably right" with no trace | Probably-right is not verified | There is no probably. Reproduce it or refute it |

### Author's verdict

When you've processed the review, summarize for the reviewer (and the decisions log): findings accepted + fixed (with the commit/test), findings declined + why (with evidence), findings deferred + tracked. Then the diff is ready to re-review or, if clean, to ship.

---

## Model tier — `heavy` (opt-in routing)

This phase's default model tier is **`heavy`** — adversarial diff reading is where the strongest model pays off most. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Accompaniment dial (L0..L3)

Read the level from `02-DOCS/wiki/harness/user-profile.md`. **It changes the narration, never the rigor** — every level runs the same passes and the same evidence bar.

- **L0** — verdict + the blocker list, terse. `CHANGES REQUESTED: 1 blocker (auth, documents.py:42), 1 nit. Fix the auth scope and re-run verify.`
- **L1** — each finding gets its one-line *why*.
- **L2** — full finding format (where/why/repro/fix); explain why each blocker blocks.
- **L3** — the above plus teaching: name the defect class (IDOR, N+1, TOCTOU), why the boundary matters, and how to not reintroduce it. For non-technical authors, translate the impact ("any logged-in person could read everyone else's documents").

When no profile exists, default to L2 and proceed — don't stall a review to ask for a dial setting.

## Anti-patterns → STOP

| Rationalization | Reality |
| --- | --- |
| "It passed verify, so it's correct" | Green gates prove it runs and tests pass, not that the logic is right. Review is the logic gate. |
| "I'll list everything I'd do differently" | A review is ranked defects, not your preferences. Tag nits as nits or drop them. |
| "This pattern usually means a bug" | Usually isn't a finding. Trace this instance or label it `[question]`. |
| "The reviewer is senior, they're probably right" | Seniority isn't evidence. Verify the claim against the code like any other. |
| "Just apply all the comments, it's faster" | Applying a false finding ships a regression. Each comment goes through the gate. |
| "Pushing back will look defensive" | Pushing back *with a trace* strengthens the diff. Silent compliance hides bugs. |
| "I'll approve it, the issues are minor" | If they're truly minor, label them nits and approve. If they block, don't approve. No mushy middle. |
| "No spec, so I'll just eyeball it" | Say there's no spec and review against the constitution + stated intent. Don't fake a baseline. |

## Where this writes

Review is mostly a conversation, but two artifacts persist into the harness wiki so the knowledge model grows:

- **Accepted/declined findings** of consequence → append to `02-DOCS/wiki/sdd/decisions.md` (e.g. "declined NPE finding on documents.py:42 — guarded by require_auth; added regression test"). This is the same append-only log `implement` writes to.
- If a finding reveals a **missing constitution rule** (a defect class the project keeps hitting), propose adding it to `02-DOCS/wiki/sdd/constitution.md` so the next review catches it earlier.

Index both in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer) under the `sdd/` topic — the harness owns that map; this skill just keeps its rows honest.

## Next in the chain

When the diff carries an **APPROVE** / **APPROVE WITH NITS** verdict and every blocker is resolved, hand off to **ship** — close the branch via PR / merge / cleanup, with **git authorship as Eric, never Claude**. If the review came back **CHANGES REQUESTED**, the loop goes back to **implement** (fix), then **verify** (re-prove green), then back here for re-review. Don't ship a diff that hasn't earned its verdict.
