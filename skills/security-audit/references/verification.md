# Verification

How a candidate becomes a finding: a fresh agent tries to refute it, the survivor gets a verdict and (if confirmed) a severity no higher than what was shown, and a second fresh agent checks the final record before anything is reported. Applies to every profile.

## Who verifies

- **A fresh agent per candidate.** It did not hunt this candidate and has seen no other verifier's conclusion. Its job is to prove the candidate wrong.
- **A different model when possible.** If the harness lets you choose the model per agent, give the verifier a different model from the hunter's. Shared blind spots are the main way false findings survive. If the choice is not available, note it in the run summary; do not skip verification.
- **What it receives**, and nothing more: the candidate; the checks and evidence paths of its linked units; the parts of `architecture.md` needed to read the path; the verification rules of the relevant [class](classes/README.md) sections, verbatim; the [isolated execution](isolated-execution.md) rules; the [auditor safety](auditor-safety.md) rule; any prior record with the same id; and the record shapes for the three verdicts.
- **Its own space**: a new agent id and `<audit-dir>/scratch/<agent-id>/`. It writes nowhere else. It may read the hunter's promoted evidence, but must re-read every cited source location itself and re-run any decisive check it can run safely.

Carried prior findings (same source) go through exactly this path, even though hunters were told to skip them.

## The verifier's task

1. Check every location: the file exists, the lines are positive and real, and they say what the candidate claims. The first location must be a real entry reachable by the stated lower-trust principal; the last must be the claimed sink or effect.
2. Rebuild the strongest controls on the path that source shows: validation, identity, authorization, normalization, lifecycle, framework defaults, containment. A control the candidate missed refutes it.
3. If the architecture note names a comparable product, say whether it shares the pattern. That is calibration; it is never a reason to reject.
4. For a proposed `confirmed`: independently reproduce the minimum observed result under isolation when possible. Check input, interface shape, conditions, and the dummy principal and resource affected. Do not infer a bigger result and do not go past it.
5. Check that likelihood, impact, severity and the proposed fix match exactly what the evidence shows.
6. For a proposed `needs_validation`: is the missing fact truly outside what source and an isolated check can show? If source refutes the trace, reject. If the fact is still decisive, keep the verdict and make the validation steps exact and harmless.
7. Keep the id unless this is genuinely a different root cause.

Return one JSON object only: `{"decision": "confirmed|needs_validation|rejected", "record": {…}}`, where `record` matches that verdict's shape in `findings.json`. The verifier's corrected wording replaces the hunter's.

Malformed or prose-wrapped output is discarded, never repaired. Re-run with another fresh verifier if the budget allows; otherwise the candidate stays `awaiting_verification` and the run is `partial`.

## The three verdicts

| Verdict | Means | Must have | Must not have |
|---|---|---|---|
| `confirmed` | The boundary failure was shown: source trace plus an observed result from an isolated check (or, for platform surface, from read-only configuration) | `principal`, `boundary`, `impact` stating the observed result, `locations[]`, `evidence[]` including the observed output, `severity`, `fix.proposal` | `missing_evidence`, `rejection_reason` |
| `needs_validation` | The code points to a precise boundary break, but one fact that neither the source nor an isolated run can show is still missing | `principal`, `boundary`, the concrete result that would follow, `locations[]`, `evidence[]`, `missing_evidence` naming **the exact fact** and a harmless way to get it (an isolated test to write, or what the owner should look at in a console or config) | `severity`, a fix presented as required |
| `rejected` | Source, isolated behaviour, a visible control, no meaningful impact, or an impossible precondition refutes it | `locations[]`, `evidence[]`, `rejection_reason` | `severity`, `missing_evidence` |

Rules that hold across verdicts:

- `needs_validation` is not a low-confidence `confirmed` and not a parking place for ideas. "Might be exploitable depending on configuration" fails; "exploitable if the `uploads` bucket is public; check Storage → Policies for `uploads` in the project console" passes.
- A verifier may promote `needs_validation` to `confirmed` only after establishing the whole path and an observed result itself. It demotes `confirmed` to `needs_validation` when one deployment or runtime fact stays unknown.
- `rejected` records stay in `findings.json` so the next run does not re-raise the same unsupported claim without new evidence.

### Principal, boundary, observed result

No candidate is confirmed without all three:

- **Principal**: who, with what starting capability (anonymous visitor; authenticated user of tenant A; CI job from a fork).
- **Boundary**: which control, at which location, should have stopped it.
- **Concrete observed result**: what actually happened in the isolated check or what the read-only configuration shows (tenant B's dummy invoice returned; the parser wrote outside its directory; the bucket policy grants `public read`). Not "could lead to".

Self-impact, intended same-principal authority, and a generic crash with no boundary crossed are not findings.

### Defense-in-depth gaps are notes

A missing header, an unpinned dependency with no reachable path, an absent rate limit where nothing shows harm, a second check that would be nice behind a first one that holds: these go to the report's hardening notes with `path:line`. They do not become findings, get no severity, and are not verified as findings.

## Severity

Only `confirmed` gets severity. It is set from the **demonstrated** result and conditions, and the overall level never exceeds demonstrated impact. When the concrete damage can't be named, the real level sits below your instinct.

| Level | Anchor |
|---|---|
| `critical` | Anonymous actor gets code execution, the whole data store, or takeover of any account |
| `high` | An explicit security control is fully defeated with real consequences: authentication bypass, read or write across tenants, stored script that runs for other users, code execution needing an account, a shared service that anyone can take down remotely without an account |
| `medium` | A real boundary violation, but limited blast radius, unusual preconditions, or effects confined to a narrow set of resources |
| `low` | Non-secret internals disclosed, an effect needing sustained effort for little gain, or a confirmed weakness that matters only as one link in a bigger chain |

**High or medium?** Was an explicit control beaten *completely*, on an action that matters (high), or merely *weakened* (medium)?

## Writing `findings.json`

After all candidates are decided (or the run stops), the coordinator writes every record to `findings.json`, sorted by id, using the contract in SKILL.md. Each linked unit in `coverage.units[]` lists the ids it produced. Then run `node scripts/validate-findings.mjs <audit-dir>` and fix every error. Passing proves structure, file and line existence, evidence placement and absence of visible secrets; it does not prove truth.

## Second verification of final records

A second fresh agent (not the hunter, not the first verifier) checks each final `confirmed` and `needs_validation` record, in parallel. It works from the record, not the hunter's prose. In `quick` the first verifier does this job too, so each candidate gets one independent reviewer; every other profile keeps two. A `confirmed` record is never reported without at least one independent check.

For `confirmed`, it checks:

1. every location: path, lines, what the code does there;
2. the real entry interface and the exact input shape;
3. every condition, parser or policy step, visible preventing layer, and the observed result;
4. the affected principal or resource and the demonstrated impact;
5. likelihood, impact and severity, with severity not above impact;
6. the fix: does it enforce the invariant, or only move the trust somewhere else?

For `needs_validation`, it checks:

1. the trace is real and supports only the claim made;
2. the missing fact is decisive and cannot already be answered by source or an isolated check;
3. a boundary and a concrete possible result are named, not a generic worry;
4. the validation step is exact and harmless (an isolated test, or something the owner looks at); never audit traffic to a live system;
5. the id matches prior and current records for the same root cause.

It returns `{"decision": "verified", "id": "…"}` or `{"decision": "replace", "reason": "…", "record": {…}}`.

**Material replacements need a third agent.** If the replacement raises the verdict (anything to `confirmed`), or changes root cause, trace, input, observed result, impact or severity, a new agent that took no part so far re-checks the source, reproduces any decisive result under isolation, and returns `verified` or another replacement. Repeat until stable. If budget or independence runs out, remove the disputed record from `findings.json`, leave its candidate `awaiting_verification`, and mark the run `partial` with that reason. Wording fixes and line corrections that change neither meaning nor evidence are applied directly.

If a final verifier spots a separate root cause, it gets a new id and goes through candidate verification first.

After every applied replacement, re-run the validator. The run may be `complete` only when every candidate has an independent final decision and every retained record passed this second check. Do not skip `needs_validation` records here: a wrong one sends the owner chasing a false premise.

## Fix evidence: fail, then pass

The audit proposes fixes; it changes target code only when the owner approves a specific fix ([auditor safety](auditor-safety.md#who-approves-what)), on a branch, never on the default branch.

- `fix.proposal`: the invariant, the narrowest change at the last trusted decision point, and the regression test that proves it. Prefer concrete repository-relative changes over generic hardening advice.
- `fix.status`: `proposed` until the owner answers; then `approved`, `declined` or `manual` (only the user can do it); `applied` once changed and re-checked; `rolled_back` if the change broke something and was undone. The loop is in [fixing](fixing.md).
- `fix.rollback`: how to undo it (revert the commit, the flag to flip back, the migration down step).
- `fix.recheck`: **required when a fix is applied.** A regression test that **fails on the unfixed code and passes on the fixed code**, both runs under isolation:
  - `command`: the exact test command;
  - `result`: both outcomes and the two commits, e.g. `fails at <base-sha> (expected 403, got 200); passes at <fix-sha>`;
  - `artifact`: the promoted output of both runs in `evidence/`.

A test that only passes after the fix, with no recorded failure before it, proves nothing; the finding's fix stays `proposed`. A recheck also re-runs the finding's original isolated check and records that the observed result no longer occurs.

## After verification

Only records that passed the second check feed the report. `scripts/render-report.mjs <audit-dir> [--lang es|en]` builds `report.html` from `findings.json`; prose never changes a verdict, a severity, a missing fact or an impact. A clean run may have zero confirmed findings. Say so, state the remaining coverage and validation limits, and do not invent low-severity findings to fill the page.
