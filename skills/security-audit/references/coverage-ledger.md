# Coverage ledger

The ledger is the audit's only coverage claim and its saved state: one row per unit of work, updated after every unit. It decides what hunters get, what the report may say was reviewed, and where a cut run resumes.

## Why a ledger

A sentence like "auth was reviewed" proves nothing. Neither does an agent count or the architecture note. Coverage exists only where a unit records who reviewed which paths, which checks ran, and what came out. Anything without that record is `not_reviewed`, and the report says so.

No single pass exhausts a target. The ledger makes the gaps visible so the next run can pick them up.

## Units

A unit is one combination of **surface × boundary × area × class**:

| Dimension | Meaning | Canonical reference (example) |
|---|---|---|
| surface | Where lower-trust input enters; `code` or `platform` | `src/router.ts#POST /users/:id`, `platform:supabase#storage.buckets` |
| boundary | The control that must hold | `src/authz.ts#requireOwner` |
| area | Subsystem or package | `packages/api` |
| class | Attack class section | `classes/access-control.md#Object-level authorization` |

Each dimension carries a human label and a stable canonical reference taken from source: a repository path plus the exported name, a route or message name declared in code, the function that enforces a boundary, a package path, the exact heading of a class section. Use the same reference for the same object across runs even if its label changes. Never derive a reference by lower-casing or slugging the label.

**Unit id.** Percent-encode each canonical reference (keep only `A-Z a-z 0-9 - . _ ~`, every other byte becomes uppercase `%HH`), then join surface, boundary, area and class with `::`. In `deep` runs append the lifecycle mode (install, upgrade, migration, rollback, recovery) when it matters. Leave out of the id anything that changes between runs: line numbers, wave, agent, verdict, severity. References must be NFC text with no control or invisible characters and no surrounding spaces.

Sort units by id before every assignment. Two units with the same id are an error; if their other fields differ, it is an identity collision. Stop and fix the references; never merge or overwrite.

Granularity follows the profile: `quick` collapses the area dimension to the fixed reference `profile/quick/all-areas`; `standard` uses one unit per area; `deep` adds lifecycle modes.

## `ledger.json`

Lives in the audit directory next to `findings.json`. The coordinator is its only writer. Shape:

```json
{
  "run": { "id": "...", "profile": "standard", "scope": ["..."],
           "source": { "head": "<commit>", "dirty": false, "tree_hash": "<sha256>" },
           "budget": { "limit": 60, "spent": 0, "reserved": { "critics": 2, "verification": 12 } },
           "wave": 1 },
  "units": [{
    "id": "...", "surface": "code", "area": "packages/api",
    "boundary": "...", "class": "...", "refs": { "surface": "...", "boundary": "...", "area": "...", "class": "..." },
    "starting_paths": ["packages/api/src/users.ts"],
    "class_sections": ["classes/access-control.md#Object-level authorization"],
    "excluded_sections": [{ "section": "...", "reason": "source fact that excludes it" }],
    "prior": "new|same_source_done|changed_source|prior_needs_validation|prior_not_reviewed|prior_blocked|none",
    "priority": 1,
    "status": "pending",
    "owner": null, "attempt": 1, "requeued_shallow": false,
    "reviewed_paths": [], "checks": [], "findings": [], "reason": null,
    "hardening": [], "attempts": []
  }],
  "candidates": [{ "id": "...", "units": ["..."], "state": "awaiting_verification|verifying|decided", "verifier": null }]
}
```

`checks[]` entries: `{ "agent": "...", "reviewed_paths": [...], "invariant": "...", "method": "source|isolated", "result": "...", "artifact": "evidence/<agent>/<file>" | null }`. A source check has `artifact: null`. An isolated check points at a file promoted into `evidence/` under the rules in [isolated execution](isolated-execution.md); scratch paths are never evidence. The unit's `reviewed_paths` is exactly the union of its checks' paths.

## Statuses

| Status | owner | reviewed_paths / checks | findings | reason |
|---|---|---|---|---|
| `pending` | null | empty | empty | null |
| `in_progress` | agent id | empty | empty | null |
| `done` | agent id | both non-empty | candidate ids, or empty if nothing survived | null |
| `blocked` | agent id | both non-empty (partial, owned) | empty | the exact blocker |
| `not_reviewed` | null | empty | empty | why: `out_of_scope`, `budget`, `profile`, `not_applicable` plus a sentence |

Agent ids are lower-case, match `^[a-z0-9][a-z0-9_-]{0,63}$`, and are never a Windows device name (`con`, `prn`, `aux`, `nul`, `com1`–`com9`, `lpt1`–`lpt9`).

A unit becomes `done` only from a hunter's structured result naming the paths it read and the checks it made. Partial evidence never hides inside `not_reviewed`; partial work is `blocked` with its blocker.

When a run ends, the coordinator copies each unit into `findings.json` → `coverage.units[]` as `{id, surface, area, boundary, class, status, reason, findings}`. Any unit still `pending` or `in_progress` at that moment is written as `not_reviewed` with the reason, and the run is `partial`.

### Re-opening a unit

When a critic re-opens a `done` or `blocked` unit, push its current live fields (`attempt`, `status`, `owner`, `reviewed_paths`, `checks`, `findings`, `reason`) plus the critic's source-backed reason into `attempts[]`, unchanged. Increment `attempt`, clear the live fields, set `pending`. The next hunter is a new agent. Never copy an archived attempt's checks or evidence into the live fields.

## Claiming coverage honestly

- **Complete** coverage needs every in-scope unit `done` with evidence, every detected platform `reviewed`, and a clean final critic pass (below). Only then may `run.status` be `complete`. A run with no units and no platforms reviewed nothing and is never complete; `validate-findings.mjs` refuses all of these.
- **Partial** is the honest answer for everything else: a `blocked` or `not_reviewed` unit (its `reason` says why), a platform not reviewed, `quick` profile, scoped run, budget stop, interrupted run not yet resumed, unverified candidates, a mandatory critic that could not run. Set `run.status: "partial"` and a `partial_reason` that names the cause in one line (`quick profile`, `budget exhausted before wave 3`, `scoped to packages/billing`, `4 candidates not verified`).
- The report's coverage section is derived from the ledger counts, never written freehand.
- A unit closed without paths and checks is a critic target, not coverage.

## Critics and extra waves

After every hunter wave, a fresh read-only **post-wave critic** receives `architecture.md`, the full ledger (including class sections per unit), the current candidate ids and states, and the prior-run gap list. It hunts for coverage gaps, not vulnerabilities:

- entry points the ledger never mapped;
- parallel paths to the same effect nobody checked (batch, legacy, retry, admin, import, migration);
- lifecycle modes missing;
- selected class sections with no unit, and exclusions whose reason does not hold;
- units marked `done` without real paths and checks, or with checks that do not test the stated invariant;
- prior `needs_validation`, `not_reviewed` or changed-source items no unit covers.

It returns JSON only:

```json
{ "missing_units": [{ "surface": "...", "boundary": "...", "area": "...", "class": "...",
                      "starting_paths": ["..."], "class_sections": ["..."],
                      "excluded_sections": [{ "section": "...", "reason": "..." }],
                      "reason": "source-backed gap" }],
  "reopen": ["unit id"],
  "resolved_prior": ["finding id"],
  "clean": false }
```

The coordinator drops proposals outside scope or outside the isolation rules, computes ids, deduplicates, re-opens legitimate units as described above, validates, and queues a new wave. `clean` is the critic's opinion; the coordinator's loop decides.

When a post-wave critic yields nothing accepted and no unit is `pending`, a **second, different** fresh critic does a **final clean pass**. Coverage is complete only if that one also yields nothing. If it finds work, run another wave, post-wave critic and final clean pass.

In `quick`, there is one wave and one critic, and no follow-up wave: accepted missing units and re-opens are recorded `not_reviewed` with reason `profile: quick, critic found after the only wave`.

## Profiles and default budgets

Pick the profile from the request; otherwise propose one from target size and stakes. Default: `standard`. The budget counts **agent invocations across all phases** (recon, hunters including shallow re-queues, critics, verifiers). These are defaults, not ceilings: the owner can raise or lower them, and the run records the value used in `ledger.json` → `run.budget.limit` and in the report.

| | `quick` | `standard` | `deep` |
|---|---|---|---|
| Use for | small targets, re-runs, a first look | ordinary audit | high stakes, large or multi-service targets |
| Unit grain | surface × boundary × class (areas collapsed) | per area | per area and lifecycle mode |
| Recon agents | 3 (R1, R2+R4 merged, R3) | 4–5 | up to 8 |
| Hunter waves | exactly 1 | up to 3 | up to 6, until clean |
| Critics | 1 post-wave, no final clean | 1 per wave + 1 final clean | 1 per wave + 1 final clean |
| Verifiers per candidate | 1 (candidate and final checks merged) | 2 (separate fresh agents) | 2, plus an independent second hunter pass on units carried from a same-source prior run |
| **Default budget** | **25** | **70** | **180** |

Profiles change breadth and redundancy. They never lower the evidence bar: the candidate gate, the isolation rules, `needs_validation` discipline, `scripts/validate-findings.mjs`, and independent verification of every `confirmed` finding apply in every profile.

### Spending the budget

1. **Check before recon.** The budget must at least cover baseline recon, the critics the profile requires, and one verifier. If it cannot, launch nothing; ask once for a bigger budget, narrower scope or lighter profile. If the answer does not change, write a `partial` run with reason `budget cannot fund recon and reserves` and report that no pass ran.
2. **Reserve before each wave**: the post-wave critic, the final-clean critic (`standard`/`deep`), and verification (per-candidate verifiers × expected candidates; when unsure, 30% of what remains after critics). Hunters never spend reserved invocations.
3. **Assign by priority** until the wave's allowance is used:
   1. lowest-trust or unauthenticated entry points first;
   2. boundaries guarding the most valuable things (credentials, other tenants' data, code execution, release and signing authority);
   3. prior-run gaps, revalidations and changed source before same-source repeats;
   4. classes that tend to produce confirmed findings for this kind of target before speculative ones;
   5. ties broken by unit id, so runs are repeatable.
   Record the ordering reason in the ledger.
4. **Units the budget cannot reach** become `not_reviewed` with reason `budget`. Critic-proposed units join the same ranked queue; they do not extend the budget.
5. **Too many candidates** for the verification reserve: stop hunting, verify in id order while budget lasts, leave the rest as `awaiting_verification` in `ledger.json` → `candidates[]`. They never enter `findings.json`. Run is `partial` with reason `N candidates not verified`, and the report lists their ids and units.
6. Never exceed an owner-set budget silently. If it binds, say where.

Before wave 1, update the estimate: units seeded, hunters implied, critic and verification reserves, and whether the budget covers the plan. If it clearly does not, propose a tighter scope or lighter profile instead of thinning the evidence.

## Scoped runs

A scoped run covers only part of the target: some paths, one area, one class file, or the diff between two commits. Seed units only for in-scope surfaces. Surfaces discovered outside scope are still recorded, as `not_reviewed` with reason `out_of_scope`, so a later full run turns them into work. Critics report out-of-scope gaps too; they are recorded, not assigned. A scoped run is always `partial` and says what it left out.

## Prior runs are additive

Read every earlier `findings.json` and `ledger.json` for the same target before seeding. Compare relevant current source against each prior record and unit; a commit hash alone does not prove a path unchanged.

| Prior state | This run |
|---|---|
| `confirmed`, source unchanged | Carry the finding with the same id into the candidate queue, link it to a `pending` unit with `prior: same_source_done`, tell hunters to skip only that root cause, and send it through current verification. Its first verifier becomes the unit owner |
| `confirmed`, source changed | New `pending` revalidation unit with `prior: changed_source`. Hunters are **not** told to skip it. It stays confirmed only if current verification re-establishes it |
| `needs_validation` | Current work. Carry the record only after its trace is checked against current source; it keeps its missing fact until new evidence resolves it |
| `not_reviewed`, `blocked`, changed-source units | Current `pending` work, ranked high |
| `done`, source unchanged | Stays visible; may lower priority; a critic decides whether it needs another pass (`deep` always gives it one) |
| `rejected`, unchanged | Suppresses only that exact claim, never the unit. Changed evidence reopens it |
| `quick` or scoped prior run | Contributes its recorded evidence and gaps only, never an implied "the rest was fine" |

When no prior run exists, the report says so.

## Validation

After every update to `ledger.json`, the coordinator checks it against the status table above (unique sorted ids, owner and evidence rules per status, unit paths equal to the union of check paths, every artifact under `evidence/`). An invalid ledger drives no further assignment.

Whenever `findings.json` is written (after each verification batch and before rendering), run `node scripts/validate-findings.mjs <audit-dir>`. It checks that cited files and lines exist, evidence files exist inside the audit directory, units and findings reference each other correctly, and no secret is visible. Fix every error before assigning more work or claiming coverage. A passing validator proves structure and consistency, not that the findings are true.
