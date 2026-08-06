---
name: decision-challenge
description: "Use when a high-impact plan, migration or architecture claim needs a bounded adversarial challenge before commitment. Isolates claims from persuasion, attacks assumptions, reconciles doubts with evidence and emits proceed/hold/stop. NOT a finished-diff review (`review`/`code-review`), NOT SDD artifact consistency (`analyze`)."
tags: [adversarial-review, decision-quality, assumptions, risk, preflight]
recommends: [analyze, review, code-review, decision-records, security-scan]
profiles: [core, full]
origin: risco
---

# decision-challenge — doubt with a stopping rule

Use this immediately before a consequential commitment: an irreversible migration, a production-auth change, a costly architecture bet, a launch exception, or a plan whose confidence is higher than its evidence. The purpose is to find the decision-changing doubt, not to perform scepticism forever.

This skill is read-only unless the user also asks to change the artifact. It emits a challenge record and a verdict. Finished code review stays with `../review/SKILL.md` or `../code-review/SKILL.md`; consistency across constitution/spec/plan/tasks stays with `../analyze/SKILL.md`.

## One bounded cycle

```text
MATERIALIZE → ISOLATE → ATTACK → TEST → RECONCILE → VERDICT
```

### 1. MATERIALIZE the decision

Do not challenge a cloud of conversation. Write the concrete packet:

- decision or claim being made;
- artifact and exact revision it applies to;
- constraints and invariants that must hold;
- evidence the author relies on;
- known unknowns;
- cost of a false positive (unnecessary stop) and false negative (unsafe proceed).

If the decision cannot be stated in one sentence, split it into claims. “The migration is safe” is not atomic; lock duration, dependency completeness, rollback time and consumer compatibility are separate claims.

### 2. ISOLATE claim from persuasion

Create a compact challenge packet containing the artifact, contract, constraints and evidence — not the author’s confidence, status, prestige or preferred conclusion. This reduces anchoring.

A genuinely fresh pass is useful when the platform and user authorize one: another agent/model/context can receive only the packet. It is optional, never automatic, and never an excuse to leak data or broaden tool authority. When independent execution is unavailable, make the isolation explicit and challenge locally.

### 3. ATTACK each material claim

For each claim, ask:

- What observation would make it false?
- Which dependency or consumer is missing from the inventory?
- Is the evidence direct, current and representative, or an analogy?
- What timing, ordering, concurrency or partial-failure path is assumed away?
- What privilege, data-quality or human handoff must work perfectly?
- If rollback is promised, has restoration time and data reconciliation been proved?
- Can the decision be made reversible or staged before accepting this risk?

Prefer one sharp counterexample over ten generic cautions. Rate doubts as blocker, material, or minor by consequence and likelihood; severity is not a count of how uncomfortable the question sounds.

### 4. TEST instead of debating

Turn the strongest doubts into evidence requests: dependency query, row count, dry run, restore rehearsal, shadow traffic, contract test, load profile, permission audit, failure injection or consumer confirmation. Run safe read-only checks that are in scope. Do not mutate production or recruit external systems merely to settle the argument.

### 5. RECONCILE claim by claim

Every doubt ends in one state:

- **verified** — direct evidence supports the claim;
- **refuted** — evidence contradicts it;
- **mitigated** — the plan changed so the original doubt no longer applies;
- **uncertain** — evidence is missing and consequence remains;
- **accepted risk** — an authorized owner explicitly accepts a bounded residual risk.

Record evidence, owner and next action. “Discussed” and “probably fine” are not states.

### 6. VERDICT

- **PROCEED** — no blocker survives; material uncertainties have owners and safe bounds.
- **HOLD** — a decision-critical uncertainty can be resolved without abandoning the approach.
- **STOP / REDESIGN** — a claim is refuted or the remaining downside is outside the stated tolerance.

Name what would change a HOLD or STOP verdict. A verdict without an unlock condition teaches nothing.

## Stopping rule

Run at most two cycles. A second cycle is allowed only after new evidence or a changed artifact. Stop earlier when a full pass produces no new blocker/material doubt. Rephrased uncertainty is not new evidence. If the decision remains uncertain after two cycles, keep the uncertainty in the verdict; do not manufacture confidence through repetition.

## Challenge record

```markdown
# Decision challenge — <decision> — <revision/date>

## Contract and stakes
Decision · invariants · false-positive cost · false-negative cost.

## Claims
| Claim | Evidence before | Doubt | Test/evidence | State | Owner |

## Surviving risk
Blockers · material uncertainty · accepted residual risk.

## Verdict
PROCEED / HOLD / STOP — reason — unlock condition.
```

## Anti-patterns

| Smell | Correction |
|---|---|
| Every reversible choice receives a panel | Reserve the skill for consequence, uncertainty or irreversibility. |
| The author’s explanation counts as independent evidence | Isolate claims and require an observation outside the persuasion. |
| Another model/agent is mandatory | Use fresh context only when authority, tooling and data boundaries allow it. |
| Executive pressure relabels a blocker as accepted risk | Require an accountable owner with authority over the consequence. |
| Domain controls are recreated generically | Route security to `security-scan` and AI quality experiments to `agent-eval`. |

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el “¿instalo la skill que falta?”.)
