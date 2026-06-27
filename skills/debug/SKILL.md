---
name: debug
description: "Use when something is broken and the impulse is to start patching — a bug, a failing or flaky test, a crash, an exception, a wrong result, a regression, or behavior nobody can explain — and you want the root cause found BEFORE any fix is proposed. The on-demand rsc-sdd diagnosis discipline, callable from inside implement (or any phase) the moment a check fails for a reason you don't understand. Triggers: 'debug this', 'why is this failing', 'this test is flaky', 'find the root cause', 'it works locally but not in CI', 'this used to work', 'track down this bug', 'the fix didn't stick', 'figure out why', 'NullPointer/segfault/500 out of nowhere', 'intermittent failure'. Fixes the ONE confirmed cause, then hands back. NOT writing a planned feature (that is `implement`), NOT the lint/test gate (that is `verify`), NOT adversarial diff reading (that is `review`). Honors the harness accompaniment dial."
tags: [debug, bug, troubleshoot]
recommends: []
profiles: [core, full]
origin: risco
---

# debug — find the cause before you touch the fix

`debug` is the on-demand diagnosis discipline of the rsc-sdd chain. Something is broken — a test
went red, a crash landed, a result is wrong, a regression appeared — and the strongest pull in the
room is to change code until the symptom disappears. That pull is the enemy. A symptom that vanishes
under a guessed edit usually moved; it rarely died. This skill replaces guess-and-patch with a
short, evidence-driven loop that ends only when **one confirmed cause** has been named, fixed, and
proven gone.

The one rule everything else serves: **no fix before a reproduced, isolated, confirmed cause.** If
you cannot make the bug happen on demand, you cannot know you fixed it — you can only know the
symptom stopped showing, which is not the same thing.

This is a process skill. It does not own the test runner, the debugger, or the profiler — the
**stack skills do** (`../fastapi/SKILL.md`, `../go/SKILL.md`, `../nextjs/SKILL.md`,
`../flutter/SKILL.md`; data-layer issues `../postgresdb/SKILL.md`; security-shaped failures
`../secure-coding/SKILL.md`). `debug` owns the *method*; it pulls the *mechanics* from whichever
stack the failure lives in.

## When to use / when not to

Use when:

- A test fails (or flakes) for a reason you don't fully understand, mid-`implement` or after.
- A crash, exception, 500, segfault, or wrong output appears and nobody can yet say why.
- A regression shows up ("this used to work") and you need the commit/change that caused it.
- A fix was applied and the symptom came back, or a "fix" didn't actually stick.
- The behavior differs between environments ("works locally, fails in CI").

Do NOT use when:

- You're writing a *planned* feature task and its expected failing test — that's `implement`'s
  red→green→refactor; no mystery yet.
- You're running the lint/type/test gate to confirm "done" — that's `verify` (it *reports* failures
  and hands them here; it doesn't diagnose).
- You're reading a clean diff adversarially for smells a test can't catch — that's `review`.
- The "bug" is actually an unclear requirement or contradictory spec — that's `clarify`/`analyze`,
  not a code defect.

## Model tier — `heavy` (opt-in routing)

This phase's default model tier is **`heavy`** — root-cause diagnosis is deep reasoning. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Read the room first (accompaniment dial)

Before diagnosing, read `02-DOCS/wiki/harness/user-profile.md` for the technical + accompaniment
level and match it. The *method* never changes with the dial — the volume does.

| Level | While diagnosing you show… | Questions you ask |
| --- | --- | --- |
| **L0** terse | the confirmed cause and the one-line fix, once found | none unless you need a missing repro detail |
| **L1** brief | the cause + one line of *why* it produced this symptom | only what you can't observe yourself (e.g. exact error text) |
| **L2** decisions | each step's finding (repro, the half that isolated it, the cause) | confirm before a fix that changes behavior beyond the bug |
| **L3** full | narrate the whole loop, teach the binary-search reasoning aloud | ask to contextualize the environment, recent changes, expectations |

No profile yet → assume non-technical, narrate the reasoning plainly, and never apply a
behavior-changing fix without a quick confirm.

## The loop — five steps, in order

```text
REPRODUCE   → make the bug happen on demand. A reliable repro (or a quantified flake rate) is the
              entry ticket. No repro → you are not debugging yet, you are guessing. Capture the
              exact command, input, env, and the verbatim error/stack.
ISOLATE     → binary-search the cause. Halve the surface each step — git bisect across commits,
              comment/branch to split code paths, remove inputs until the minimal failing case
              remains. Change ONE variable at a time; note what each change does to the symptom.
HYPOTHESIZE → from the isolated evidence, state ONE falsifiable cause: "X happens because Y, and if
              so, changing Z will flip the result." A hypothesis you can't disprove isn't one.
FIX         → make the smallest change that addresses the *cause* (not the symptom). First, encode
              the bug as a failing test (it should now go red for the real reason) — then fix until
              it's green. Treat the test as the proof the cause was real.
VERIFY      → re-run the repro: symptom gone. Re-run the new test: green. Re-run the surrounding
              suite: still green (no new red). For a flake, run it enough times to show the rate
              dropped to zero. Only now is it fixed.
```

Never skip a step and never reorder. **Reproduce before isolate** — you can't bisect a bug you can't
trigger. **Hypothesize before fix** — an edit with no stated cause is a guess wearing a commit
message. **Verify before "fixed"** — the word *fixed* is a claim about the repro no longer firing
and the test being green, nothing less.

### Reproduce — the entry ticket

A bug you cannot reproduce is not a bug you can fix; it's a rumor. Pin it down:

- The **exact** invocation (command, request, UI steps), the input that triggers it, the environment
  (OS, versions, env vars, branch/commit), and the **verbatim** error + stack trace — not a
  paraphrase.
- For a **flake**, reproduction means a *rate*: run it N times, record `k/N` failures. "Intermittent"
  is a measurement to take, not a property to accept. A flake almost always means shared state, order
  dependence, a real race, time/timezone, or network — name which.
- If you genuinely cannot reproduce, that is the finding. Say so, gather more signal (logs, a failing
  CI run, the user's exact steps), and do not apply a speculative fix to a bug you can't trigger.

### Isolate — binary-search the surface

The cause is somewhere in a large space; cut it in half, repeatedly, with evidence.

- **Across history:** `git bisect` between a known-good and known-bad commit to land on the exact
  change that introduced it. Let the repro be the bisect's good/bad oracle.
- **Across code:** disable/short-circuit half the suspect path; see which half keeps the symptom.
- **Across inputs/data:** shrink the failing input to the minimal case that still fails.
- **One variable per step.** Two changes at once and you've learned nothing about either. Write down
  what each step did to the symptom — the trail *is* the diagnosis.

Delegate the stack-specific tooling (debugger, race detector, profiler, query plan) to the stack
skill below; `debug` decides *what* to halve, the stack skill provides the instrument.

### Hypothesize → Fix the cause, not the symptom

State the cause as a sentence you could be wrong about, then act on it:

- Fix the **cause**, not the symptom. A `try/except` that swallows the error, a retry that hides a
  race, a `sleep` that papers over an ordering bug, a bumped timeout — these relocate the symptom and
  leave the cause armed. If your fix doesn't reference the cause you named, it's a patch on a guess.
- **Encode the bug as a test first.** The failing test that reproduces the bug is your regression
  guard; watch it go red for the real reason, then make it green. A fix with no test means the next
  change can resurrect the bug silently.
- Keep the change **minimal**. Resist "while I'm here" refactors — they confound the verification and
  bury the one line that mattered.

### Verify — the symptom and the test, both

The fix is unproven until the original repro no longer fires **and** the new test is green **and**
the surrounding suite stayed green. For a flake, re-run enough times to show the failure rate is
zero, not merely lower. Then hand the *whole-gate* re-run (lint/type/full suite/audit) to `verify` —
that gate, not this skill, is what licenses the word "done".

## Delegating the stack tooling (don't reinvent the instruments)

`debug` owns the loop; the stack skill owns the debugger, the flake mechanics, and the profiler.

| Stack / layer | Where the instruments live | What you pull |
| --- | --- | --- |
| FastAPI / async Python | `../fastapi/references/testing.md` | `pytest -x --lf`, `pdb`/`breakpoint()`, async task/race traps, transactional-rollback fixtures to kill state bleed |
| Go services | `../go/references/testing.md` | `go test -race`, `-run`/`-count=1` to force a flake, `delve`, `pprof`, `errors.Is/As` unwrapping |
| Next.js / React | `../nextjs/references/testing.md` | Vitest `--no-isolate`/`.only`, Playwright trace viewer, RSC vs client boundary errors, hydration mismatches |
| Flutter / Dart | `../flutter/references/testing.md` | `flutter test --plain-name`, widget pump/settle timing, DevTools, golden diffs |
| Postgres / data layer | `../postgresdb/SKILL.md` | `EXPLAIN ANALYZE`, isolation-level/locking races, constraint violations, migration-order bugs |
| Security-shaped failure | `../secure-coding/SKILL.md` | auth/authz edge cases, injection, secret/leak paths surfacing as "weird" failures |

If the failure spans two stacks (a Next.js call into a FastAPI endpoint), reproduce at the boundary
first — isolate which side actually fails before you open either stack's debugger.

## Log the diagnosis (the 02-DOCS trail)

When the cause is non-obvious — a race, an order dependency, an environment-only failure, a
regression a reviewer would otherwise have to rediscover — append a short entry to
`02-DOCS/wiki/sdd/decisions.md` (append-only; create it if absent and add a row to the root
`CLAUDE.md` `## Knowledge map` under the `sdd/` topic). One entry:

```text
## YYYY-MM-DD — bug: <symptom in five words>  (feature: <slug>)
Repro      — the exact command/input that triggered it
Cause      — the ONE confirmed root cause (not the symptom)
Fix        — the minimal change + the regression test that guards it
Why missed — what let it through, so the class of bug doesn't recur
```

Skip the trivial ones (a typo'd variable). Log the cause a future debugger would pay to know.

## Anti-patterns → STOP

| Rationalization | Reality |
| --- | --- |
| "I see the likely line — let me just change it and see." | That's guess-and-patch. Reproduce first; a fix to an untriggered bug proves nothing. |
| "It's intermittent, you can't really reproduce it." | "Intermittent" is a rate to measure (k/N), not an excuse. Flakes have causes: state, order, races, time. |
| "Wrapping it in try/except makes the error go away." | You hid the symptom and left the cause armed. Fix the cause, not the crash site. |
| "Adding a sleep/retry/bigger timeout fixes the flake." | It relocates the race. Name the shared state or ordering bug; fix that. |
| "I'll fix it now and add a test later if there's time." | The bug-reproducing test IS the fix's proof. No red-for-the-right-reason test = unproven fix. |
| "I changed three things and now it works." | You can't say which mattered or why. One variable per isolate step; revert the rest. |
| "The repro's gone, ship it." | Gone how? Re-run the repro AND the new test AND the suite. Symptom-absent ≠ cause-dead. |
| "It works on my machine, so it's fixed." | Environment IS a variable. Reproduce where it actually fails (CI, prod-like) before claiming done. |
| "This bug is obvious, skip the loop." | Obvious causes are the ones that turn out to be a second bug masking the first. Run the loop. |

## Red flags — stop and re-route

- **You're editing code and you can't yet reproduce the bug** → stop; you're guessing. Get a repro
  (or a measured flake rate) first.
- **The "bug" is a spec contradiction or unclear requirement**, not a defect → route to
  `clarify` / `analyze`; debugging won't fix an ambiguity.
- **The fix grows past the cause** (you're refactoring "while you're here") → split it out; keep the
  fix minimal and verifiable. Improvements go through `implement`.
- **You're tempted to disable, `skip`, or delete the failing test to make the suite green** → that's
  the bug winning. Never ship around a red test; diagnose it.
- **You "fixed" it but can't point to the cause you named** → you patched a symptom. Resume at
  HYPOTHESIZE.
- **The cause violates the constitution** (e.g. it only "works" by breaking a quality bar) → surface
  it; don't smuggle a violation in under the banner of a bugfix.

## Checklist (copy per bug)

```text
- [ ] REPRODUCE: exact command/input/env + verbatim error captured; repro reliable (or flake rate k/N measured)
- [ ] ISOLATE: surface halved with evidence (bisect / code split / minimal input); ONE variable per step
- [ ] HYPOTHESIZE: one falsifiable cause stated ("X because Y; changing Z flips it")
- [ ] FIX: bug encoded as a failing test (red for the RIGHT reason); smallest change to the CAUSE
- [ ] VERIFY: repro no longer fires; new test green; surrounding suite still green; flake rate → 0
- [ ] Non-obvious cause logged to 02-DOCS/wiki/sdd/decisions.md
- [ ] Handed the whole-gate re-run back to verify; resumed implement where the failure interrupted it
```

## What this skill is NOT

- **Not the feature builder.** Once the cause is fixed and verified, planned work resumes in
  `implement` (its red→green→refactor for the *next* task, not this bug).
- **Not the quality gate.** The lint/type/full-suite/audit run that licenses "done" is `verify`'s
  job; `debug` proves the one bug dead and hands the gate back.
- **Not a refactor pass.** Keep the fix minimal; broader cleanups are `implement`/`review` territory,
  not smuggled into a bugfix.

## Where you are in the chain

`debug` is **on-demand**, callable from any phase — most often pulled in mid-`implement` when a test
fails for a reason you don't understand, or by `verify` when its gate reports a failure it won't
diagnose. It is not a fixed step in the line `constitution → specify → clarify → plan → tasks →
analyze → implement → verify → review → ship`.

**Next:** when the one confirmed cause is fixed and proven gone, hand back. Return to `implement` to
resume the interrupted task, or to `verify` to re-run the full gate and let evidence — not the relief
of a quiet terminal — declare the work done.
