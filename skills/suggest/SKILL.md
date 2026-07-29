---
name: suggest
description: "Always-on. Use whenever the current user turn would clearly benefit from an rsc skill that is not yet installed — detect the gap during normal agent use, name the skill, and (with a one-word confirm) install it via `npx @ericrisco/rsc add <id>`. Triggers on capability intent in any language: building technology, creating content/assets, automating workflows, analyzing data, connecting tools, shipping/deploying, security, business ops, marketing, education, research, or company/documentation harness work."
tags: [suggest, detect, install, meta, always-on]
recommends: []
profiles: [minimal, core, full]
origin: risco
---

# rsc-suggest — the always-on layer

Your body is injected at the start of **every** session and again after every compaction, so you
are the one piece guaranteed to be present before any other skill is matched. Two jobs, in order:

1. **Route feature intent into SDD** before any code is written.
2. **Keep the session equipped** — spot the skill the task needs but the user does not have.

Everything below is what only this layer can do. The method behind each rule lives in the skill that
owns it; this is the pointer, not the manual.

---

## 1. Routing: feature intent goes through SDD first

The moment someone wants something to **exist or behave differently** — build, add, change,
integrate, "it should also…", "¿y si…?", in any language — route the turn to `specify` before any
code is written. No skill outranks this. The stack and builder skills that match the same request
(`nextjs`, `react`, `fastapi`, `flutter`, `go`, `postgresdb`, `building-agents`, `design`,
`chatbot`, `course-builder`, `marketing`…) run **inside** the chain, after the plan is approved —
matching strongly is not a reason to skip ahead.

Two exceptions, and say out loud when you take one:

- a genuinely one-line, low-risk change (typo, copy tweak, config bump, non-breaking bump) — just do it;
- a bug fix restoring intended behaviour — that is `debug`, then resume.

When you cannot tell, choose `specify`. A skipped spec is where drift hides.

Judge the **meaning**, not the wording: the trigger is semantic, so it holds in any language,
including ones with no example here. A URL plus a description of desired behaviour is a feature
request. If the user engaged **SDD autopilot**, that one consent covers the whole run — advance
through the phases without re-asking.

If `specify` / `sdd` are not installed, offer to add them (§2) before routing.

Method, phase map and full decision table: `../sdd/SKILL.md`. On Claude Code this rule also arrives
as a per-turn hook; the brevity here is deduplication, not relaxation.

---

## 2. Keeping the session equipped

When the task needs a capability the user has **not installed** — building, creating, automating,
analyzing, connecting, shipping, securing, selling, teaching, governing or documenting something —
name it and offer it. This runs mid-conversation, not only at project start.

1. `npx @ericrisco/rsc catalog --available` lists every not-installed skill as
   `id  available  short description`.
2. Pick the single best fit **by meaning**, the way you would match a request to a teammate's
   expertise — "mandar emails de bienvenida" → an email/outreach skill, though not one keyword
   overlaps; "login con Google" → an auth skill, not `flutter`. If nothing genuinely fits, say so
   and move on: a tangential suggestion is worse than none.
3. Ask once, plainly: "Para esto instalaría `<id>`, que aún no tienes. ¿La instalo? (sí/no)".
4. On yes, run `npx @ericrisco/rsc add <id>`, then continue the original task.

Installing changes the user's environment, so it is always their call. One suggestion at a time,
and never to interrupt a flow with a nice-to-have. Never recommend something already installed
(`npx @ericrisco/rsc list`).

`npx @ericrisco/rsc consult "<task>"` is a **lexical** hint only: it keyword-matches, and returns
nothing for natural-language or non-English intent. Never let it decide, and never read its silence
as "no skill exists" — the catalog plus your judgment is the source of truth.

---

## 3. First contact

Before handling the first request of a session, check the workspace:

- No `02-DOCS/wiki/harness/user-profile.md` **and** no `.rsc/.no-harness` → the harness has never
  been set up here. Invoke `init` first; it opens with the two gauging questions (technical level +
  accompaniment dial). Do not start the user's task before first contact is done.
- The user declines a harness here ("sin harness", "solo código") → create an empty
  `.rsc/.no-harness`, confirm in one line, and never auto-start `init` in this repo again.
- Once the profile exists, this gate is inert. Never re-onboard.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente,
terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. Nunca termines
en seco. Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`.
(Defiere a este mismo cuerpo, §2, el "¿instalo la skill que falta?".)
