---
name: source-grounded-development
description: "Use when implementation or review depends on current version-specific framework, SDK, protocol or platform behaviour and memory is unsafe. Detects exact local versions, verifies primary sources, tests applicability and marks unknowns. NOT a standalone cited memo (`research-ops`), NOT diagnosis of a reproduced failure (`debug`)."
tags: [official-docs, primary-sources, version-detection, implementation, verification]
recommends: [research-ops, decision-records, debug, technical-writing]
profiles: [core, full]
origin: risco
---

# source-grounded-development — make current facts part of the change

Use this when correctness depends on what a framework, SDK, API, standard or hosted platform **does now for the exact version in this repository**. The deliverable is still code, a review or an implementation decision; sources are the evidence behind it, not a separate essay.

This is narrower than `../research-ops/SKILL.md`: research-ops answers an open question with a cited memo. Here, the question exists because a concrete change cannot safely proceed from memory.

## The loop

```text
DETECT → QUESTION → SOURCE → APPLY → PROVE → REPORT
```

### 1. DETECT the actual version and environment

Read the repository before the web:

- lockfiles and manifests, not only a README;
- runtime and compiler configuration;
- generated client/server versions;
- deployment target and enabled compatibility flags;
- existing wrapper code that may override documented defaults.

Record an evidence line such as: `Next 16.2.1 from pnpm-lock.yaml; Node 24 from .nvmrc; App Router; deployed to Vercel.` If versions conflict, stop treating the docs as applicable until the conflict is resolved.

### 2. QUESTION only the claims that can change the implementation

Build a small claim ledger. Each row is one decision-sensitive statement:

```text
claim | exact component/version | evidence needed | source | applicability | status
```

Examples: whether a callback is invoked on retry, the default cookie policy, an API’s idempotency semantics, a deprecated option’s replacement, or a browser feature’s support boundary. Do not cite obvious local code or generic programming facts just to make the list longer.

### 3. SOURCE by authority and freshness

Prefer, in order:

1. the repository and installed type definitions for local truth;
2. official versioned documentation and migration/release notes;
3. specifications, RFCs or provider API references;
4. upstream source or tests when documentation is ambiguous;
5. reputable secondary material only as a lead, never as the final authority for a disputed behaviour.

Use the current page that matches the detected version. A search snippet, an undated blog, a forum answer or remembered API shape is not proof. When two primary sources disagree, show the disagreement and test the behaviour; do not average them into false certainty.

### 4. APPLY the source to this repository

For every useful source, state why it applies here:

- same major/minor version or a documented compatibility range;
- same runtime, router, transport, deployment mode or feature flag;
- no local wrapper/configuration that changes the default;
- publication or update date appropriate to a fast-moving claim.

Then make the smallest implementation decision that the evidence supports. Do not turn examples from docs into architecture by cargo cult. Examples demonstrate an API; the repository still determines ownership, boundaries and error policy.

### 5. PROVE behaviour locally

Documentation tells you intended behaviour. A local test proves the integration:

- add or run a focused contract/regression test;
- compile against installed types;
- exercise a minimal reproduction when defaults or runtime order matter;
- run the stack’s normal verification gate after the focused proof.

If local evidence contradicts the source, preserve the reproduction and investigate version/config drift. Do not silently choose whichever result is more convenient.

### 6. REPORT without polluting the code

End with:

- versions and environment detected;
- material claims verified and their primary links;
- implementation choices those claims changed;
- local evidence run;
- assumptions still **UNVERIFIED**, with the consequence if wrong.

Put source links in the final report, PR description or a durable decision record when the rationale must outlive the task. Do not scatter documentation URLs through source comments unless the code’s invariant genuinely cannot be understood without that external contract.

## Stop conditions

Stop searching when every decision-sensitive claim is verified, contradicted or explicitly marked unverified and the local proof is green. Search breadth is not quality. A fifth article repeating the official reference adds no evidence.

Do not use this skill as a reason to delay reversible work indefinitely. If a primary source is unavailable, name the uncertainty, choose the safest reversible option, add a proof/guard, and state what would trigger revisiting it.

## Anti-patterns

| Smell | Correction |
|---|---|
| A reproduced bug is replaced by a docs tour | `debug` owns diagnosis; use this only for the disputed versioned claim. |
| A broad open question is forced into implementation | Route the cited memo to `research-ops`. |
| A lasting architecture choice disappears into a task summary | Preserve it in `decision-records` with this ledger as evidence. |
| A search result or secondary article is presented as official | Follow it to the primary source or mark the claim unverified. |
| “Latest docs” are read before the lockfile | Detect the local version and mode first; then choose applicable docs. |

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el “¿instalo la skill que falta?”.)
