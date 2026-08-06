---
name: simplify-code
description: "Use when correct working code is unnecessarily hard to read, change or verify and needs behaviour-preserving simplification in a bounded scope. Characterizes the observable contract, removes accidental complexity one concept at a time and proves equivalence. NOT fixing a failure (`debug`), NOT read-only diff judgment (`review`/`code-review`)."
tags: [code-simplification, refactoring, readability, complexity, behavior-preservation]
recommends: [code-review, review, verify, debug, performance]
profiles: [core, full]
origin: risco
---

# simplify-code — fewer moving parts, same contract

Use this when the code already works and the desired change is easier reasoning, not new behaviour. The output is a smaller or clearer implementation plus proof that callers cannot tell the difference.

Default scope is the files or symbols the user named, or the recently changed slice. Expanding into adjacent cleanup requires a concrete dependency and must be stated. Never “clean the whole repository” as a side effect.

## The equivalence loop

```text
BOUND → CHARACTERIZE → BASELINE → REDUCE → VERIFY → EXPLAIN
```

### 1. BOUND the work

Record:

- target files/symbols and why they are difficult;
- callers and public interfaces that must remain stable;
- generated/vendor code and project-marked protected regions to leave alone;
- performance, ordering, compatibility or serialization constraints;
- unrelated dirty-worktree changes that belong to someone else.

Respect protected regions through repository instructions and explicit comments. Do not hide them by rewriting files on disk, swapping placeholders in and out, or relying on a cleanup hook to restore them later.

### 2. CHARACTERIZE the observable contract

Tests are necessary but may be incomplete. Write down what must remain the same:

- return values and data shapes;
- thrown/rejected error types, messages when contractual, and timing;
- ordering, deduplication and mutation behaviour;
- I/O, logs, analytics and other side effects;
- async/concurrency semantics;
- hot-path allocations or latency when performance is part of the contract.

If the behaviour cannot be stated or observed, add characterization tests before refactoring. When the current behaviour is a bug, stop and route to `../debug/SKILL.md`; simplification must not smuggle in a fix.

### 3. BASELINE current evidence

Run the narrow tests first and preserve their output. Then run type/lint/build checks appropriate to the slice. For a performance-sensitive path, capture a representative benchmark under named conditions. A baseline proves what “same” means and prevents a cleaner-looking regression.

### 4. REDUCE one source of accidental complexity

Prefer changes with a visible reasoning payoff:

- remove dead branches, duplicate calculations or needless state;
- replace nested control flow with guard clauses when ordering stays identical;
- extract a name for a real concept, not every three lines;
- collapse pass-through wrappers that enforce no policy;
- replace clever compact expressions with direct ones;
- make data flow single-directional and ownership explicit;
- reuse an existing local abstraction when it is simpler than both copies.

Change one concept at a time and inspect the diff. Complexity moved into a new helper, generic abstraction or dependency is not removed. Lines of code are supporting evidence, never the target.

Do not redesign a public API, rename unrelated symbols, update formatting across untouched files, add features, change error policy, or create a speculative framework “for future reuse.”

### 5. VERIFY after every coherent step

Run the focused characterization tests, then the relevant repository gate. Compare benchmark conditions when applicable; keep a performance claim only when the difference exceeds normal run-to-run noise. Review the diff specifically for contract drift and accidental scope growth.

If a step is neutral or worse for understandability, revert **that step only** using a targeted edit. Never use `git reset --hard`, overwrite the working tree, or discard unrelated user changes. Do not commit automatically.

### 6. EXPLAIN the gain

Report:

- scope simplified;
- complexity removed, not merely relocated;
- observable contract preserved;
- tests/checks/benchmark run and results;
- anything intentionally left complex and the invariant that justifies it.

“Cleaner” is too vague. Prefer: “removed three mutable states and one duplicate parse; preserved error type/message, insertion order and one-read I/O semantics; 18 focused tests plus full typecheck pass.”

## Stop rule

Stop when another edit would trade one defensible style for another without lowering the number of states, branches, concepts or proof obligations. Readability has diminishing returns. A bounded, verified improvement is done even if neighbouring legacy code remains ugly.

## Anti-patterns

| Smell | Correction |
|---|---|
| A failing behaviour is “cleaned up” | Diagnose with `debug`; simplification must not smuggle in a fix. |
| A read-only review starts editing | Keep verdict work in `review`/`code-review`. |
| A speed hunch justifies a refactor | `performance` measures first; preserve a benchmark when speed is contractual. |
| An odd public behaviour is silently normalized | Preserve it until a behaviour change is explicitly authorized. |
| Cleanup commits, pushes, resets or deploys on its own | These are separate authorized operations; use targeted edits only. |

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el “¿instalo la skill que falta?”.)
