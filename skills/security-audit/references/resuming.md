# Resuming

An audit can be cut off by context exhaustion, a crash, a closed terminal or a budget pause. The files on disk are the state; this is how to pick up exactly where it stopped instead of starting over.

## The ledger on disk is the state

Conversation memory is not state. What survives is the audit directory:

- `ledger.json`: run settings, budget spent, every unit's status, the candidate queue;
- `findings.json`: decided records;
- `architecture.md`: the recon summary;
- `evidence/` and `evidence/manifest.json`: promoted artifacts.

Anything not written there did not happen.

## Write progress after every unit

The coordinator writes `ledger.json` at each of these moments, never later:

- after seeding units and before the first wave;
- when a unit becomes `in_progress` (before launching its agent);
- when each single hunter or verifier result is consolidated, not at the end of the wave;
- after each promotion (`manifest.json`) and each budget change;
- when `findings.json` changes.

Write atomically: write a temporary file in the same directory (mode `0600`), flush it, then rename it over the old one. A crash mid-write then leaves either the old ledger or the new one, never half of each. Keep the previous version as `ledger.prev.json` for one step.

## On resume

1. **Find the run.** The newest `02-DOCS/security/audit-*/` whose `findings.json` → `run.status` is not `complete`, or whose `ledger.json` has units not yet final. Confirm with the owner only if two candidates exist.
2. **Check the files.** Parse `ledger.json`; if it fails, use `ledger.prev.json`. Confirm the directory is still gitignored and owner-only ([auditor safety](auditor-safety.md#the-audit-directory)).
3. **Check the source.** Recompute the target fingerprint and compare it with `run.source` ([isolated execution](isolated-execution.md#the-source-copy-must-stay-untouched)). If the owner changed code since, units whose paths changed go back to `pending` and `confirmed` records with a changed location are queued for re-verification. Record the new fingerprint.
4. **Reset interrupted work.**
   - Units `in_progress` go back to `pending` and are re-run. Their partial output is **discarded**: delete that agent's scratch, ignore any half-written result, add nothing to `attempts[]`. Increment an `interruptions` counter on the unit.
   - Candidates `verifying` go back to `awaiting_verification`, with a new verifier.
   - A unit interrupted twice is assigned to a narrower scope (split by starting path) rather than retried as is.
5. **Keep decided work.**
   - `done`, `blocked` and `not_reviewed` units stay as they are.
   - `confirmed` and `rejected` records in `findings.json` are kept unchanged (unless step 3 flagged their source).
   - `needs_validation` records are re-verified **only if new evidence exists**: the owner answered the missing fact, isolation became available, the relevant source changed, or platform read access was granted. Otherwise they stay as they are.
6. **Restore the budget.** `run.budget.spent` carries over; interrupted invocations count as spent. Re-reserve critics and verification before the next wave.
7. **Continue from the earliest unfinished phase**: pending recon roles, then pending hunting units (next wave), then the post-wave or final-clean critic if it had not returned, then the verification queue, then the second verification, then validation and rendering.

## Never restart from zero

Re-running recon or re-hunting `done` units after an interruption wastes the budget and produces duplicate candidates under new ids. Only the owner can ask for a fresh run; it then gets a new audit directory, and the interrupted one becomes a prior run ([coverage ledger → prior runs](coverage-ledger.md#prior-runs-are-additive)).

## Ending a session early

If the session must end before the run does (context is running out, the owner stops it), close cleanly:

1. Let in-flight agents finish if possible; otherwise leave their units `in_progress` (resume will reset them).
2. Write `findings.json` with `run.status: "partial"` and `partial_reason: "interrupted: resume pending"`, and `coverage.units[]` consolidated from the ledger (units still `pending` or `in_progress` appear there as `not_reviewed` with reason `interrupted`; `ledger.json` keeps their true state for resume).
3. Run `scripts/validate-findings.mjs <audit-dir>`.
4. Tell the owner the directory and the next step: resume the audit.
