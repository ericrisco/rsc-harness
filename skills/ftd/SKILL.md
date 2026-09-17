---
name: ftd
description: "Use for ordinary authorised change — the default lane once the decisor has ruled out a question and not selected the chain. Keeps one feature document per feature in 02-DOCS holding intent, scope, checklist, evidence and next step, checks tasks off only against observed proof, and branches when the work writes code. NOT the ten-phase chain (that is `sdd`), NOT the classification itself (that is the decisor in `suggest`), NOT a request for information, which writes nothing."
tags: [ftd, lane, default, feature-document, evidence]
recommends: [worktrees, debug, verify]
profiles: [minimal, core, full]
origin: risco
---

# FTD — Fast-Track Development

The lane ordinary work takes. Not a lighter methodology: the **same** discipline about evidence with
none of the coordination the ten-phase chain exists to buy. One document instead of five, written
because the work might be interrupted, not because somebody has to approve it first.

You are here because the decisor in `../suggest/SKILL.md` ruled that this turn authorises a change
and did not select `../sdd/SKILL.md`. If it is still a question, you are in the wrong place: go back
and answer it.

## Why this lane exists

The constitution's seventh principle has said it from the start: *«la fricción es proporcional al
riesgo. Silencio para lo trivial, ceremonia solo donde el fallo es caro. Un sistema que molesta en el
80% inofensivo acaba apagado, y apagado no protege el 20% que importa.»*

The harness spent a long time contradicting it — every request that sounded like building went
through ten phases. This lane is that principle finally implemented, not a new idea.

## The feature document

One per feature, in the workspace wiki under `02-DOCS/wiki/ftd/<slug>.md`. **Never inside the code
repository**: whoever clones it should get code, not somebody else's notes in progress.

It is written **before the first change**, not after, and it holds exactly this:

```markdown
# <feature>

## Intent          — what changes, and why it is worth doing
## Scope           — what is in, and what is explicitly not
## Checklist       — one line per task, each with what would prove it done
## Evidence        — the observed output per completed task
## Next            — the single next step, so an interruption costs nothing
```

No decision journal, no phase records, no approvals. If a decision was meaningful, one line of
rationale goes next to the task it belongs to.

**The checkbox is not the proof.** A task is checked off when its stated check has been *observed* —
the test output, the command's result, the page rendering. A task whose check was skipped, failed or
could not run is recorded as such, honestly. The tenth principle applies here exactly as it does in
the chain: a result asserted without evidence is treated as not done.

## Isolation

If the work writes code, it runs on a branch — never on the default branch, so `origin` and the local
tree stay clean. **No worktree**: this lane is short enough that setting one up and tearing it down
costs more than it protects. Work that only touches documentation, the wiki or configuration needs no
branch at all.

`../worktrees/SKILL.md` owns the isolation mechanics if you need them. Once the branch lands, the
cleanup is automatic and you do not run anything.

## Growing out of the lane

A feature that turns out to need the chain is **promoted, not restarted**: the feature document
becomes the input to `../specify/SKILL.md`, and no completed work is discarded. Promotion happens for
the same reason the chain is ever entered — durable artifacts would remove a substantial ambiguity —
and never because the work turned out to be big.

## Anti-patterns → STOP

| If you're about to… | Reality / Fix |
| --- | --- |
| Skip the document because the change is small | The document is what survives an interruption. Write it, keep it short. |
| Check a task off because you believe it works | Observed proof or it is not done (P10). Record the check you could not run. |
| Write the document into the code repository | It belongs in `02-DOCS`. A clone should get code, not notes. |
| Open a worktree "to be safe" | That is the chain's ceremony arriving through the back door (P7). |
| Escalate to the chain because the change is large | Size never selects it. Only unresolved ambiguity that artifacts would settle. |
| Produce a spec, plan or task artifact here | Those are the chain's. This lane has one document. |

## See Also

- `../suggest/SKILL.md` — the decisor that routed here, and the other two lanes.
- `../sdd/SKILL.md` — the ten-phase chain, for when artifacts genuinely earn their cost.
- `../verify/SKILL.md` — the evidence gate, when this lane's checks need the full battery.
- `../debug/SKILL.md` — a failure to reproduce before fixing; comes back here afterwards.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente,
terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. Nunca termines
en seco. Protocolo completo: skill `orient`.
