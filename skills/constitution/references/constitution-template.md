# Constitution template

Render this into `02-DOCS/wiki/sdd/constitution.md`. Keep it to 1-2 screens. Every principle is one numbered, testable statement; link the `02-DOCS/wiki/stack/*` article or the script that enforces it rather than pasting the mechanic. Strike-and-replace on amendment — never silently edit a ratified principle.

---

```markdown
---
type: constitution
title: <Project> — Constitution
description: The non-negotiable principles every rsc-sdd phase obeys.
tags: [sdd, constitution]
timestamp: YYYY-MM-DDTHH:MM:SSZ
topic: sdd
version: v1.0.0
---

# <Project> — Constitution

> Version: v1.0.0 · Ratified: YYYY-MM-DD · Last amended: YYYY-MM-DD
> The non-negotiable principles every rsc-sdd phase obeys. Stack mechanics live in
> `02-DOCS/wiki/stack/*`; this file ratifies the principle and links the detail.

## 1. Stack canon

1. Primary language(s) and runtime: <e.g. TypeScript on Node 22, Python 3.12>. Pinned in
   `<manifest>`. Detail: `02-DOCS/wiki/stack/<x>.md`.
2. Frameworks fixed: <e.g. Next.js App Router, FastAPI>. Changing one is a MAJOR amendment.
3. Package manager: <e.g. pnpm / uv>. One lockfile, committed.

## 2. Quality bar

4. Code is formatted and lint-clean on every commit (<formatter/linter>, zero warnings).
   Enforced by `<pre-commit / CI step>` — detail in `02-DOCS/wiki/stack/<x>.md`.
5. Types are <strict / checked>; the type checker passes with no errors before merge.
6. Tests gate the merge: <TDD red→green→refactor>; line coverage ≥ <N>% on changed code.
   Test tooling: `02-DOCS/wiki/stack/<x>.md`.

## 3. Conventions

7. Naming & structure: <directory layout, module boundaries, file naming>.
8. API & errors: <error shape, status codes, response envelope> where applicable.
9. Commit messages: <format, e.g. Conventional Commits>.

## 4. Branching & shipping

10. Work happens on a branch off `<default>`; merge via PR. Direct pushes to `<default>` are
    not allowed.
11. **Git authorship is the human's.** No `Co-Authored-By` an AI, no "generated with" footer.
    Enforced at the `ship` phase.

## 5. Security & privacy floor

12. No secret is ever committed. Secrets load from `01-TOOLS/<provider>/.env` (gitignored).
    Baseline: `secure-coding`.
13. <authn/z baseline, data residency, dependency policy> as applicable.

## 6. UX / accessibility floor (if there is a UI)

14. Minimum accessibility bar: <e.g. WCAG 2.2 AA, keyboard-navigable, visible focus>.
    Detail: `02-DOCS/wiki/stack/design.md`.

## 7. Performance budgets (where they matter)

15. <named budget, e.g. LCP ≤ 2.5s on the marketing site; p95 API latency ≤ 300ms>.

## 8. Knowledge & decisions

16. Every significant decision is appended to `02-DOCS/wiki/sdd/decisions.md` (date, options,
    why). The constitution is the highest-order decision record.

## Definition of Done (the merge bar `verify` runs against)

A change ships only when ALL hold:

- [ ] Formatter + linter clean (principle 4).
- [ ] Type checker passes (principle 5).
- [ ] Tests pass; coverage floor met on changed code (principle 6).
- [ ] Conventions followed (principles 7-9).
- [ ] On a branch, merged via PR, authored by the human (principles 10-11).
- [ ] No secret committed; security baseline met (principles 12-13).
- [ ] Accessibility / performance budgets met where they apply (principles 14-15).
- [ ] Significant decisions logged (principle 16).

## Amendment log (append-only)

| Date | Version | Change | Why |
|------|---------|--------|-----|
| YYYY-MM-DD | v1.0.0 | Ratified initial constitution. | Project kickoff. |
```

---

## Rendering notes

- **Drop sections that don't apply.** No UI → drop §6. No hard perf budget → drop §7. Do not pad.
- **Renumber on amendment carefully.** Prefer striking a principle (`~~10. …~~ (superseded by 17)`) and appending the new one over renumbering, so existing citations ("principle 10") stay valid.
- **Version bump rules:** MAJOR = remove/reverse a principle; MINOR = add/tighten; PATCH = wording only.
- **Link, don't paste.** Any concrete config (lint rules, pytest ini, Tailwind tokens) stays in `02-DOCS/wiki/stack/*`; the principle points to it.
- **One screen test.** If the rendered file scrolls past ~2 screens, you are documenting, not legislating — move detail to the wiki.
