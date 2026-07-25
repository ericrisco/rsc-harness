---
name: init
description: "Use when starting from nothing or pointing rsc at an existing project — the front door. Gauges technical level and the accompaniment dial first (non-technical by default), discovers what the user wants to build or govern (any stack, or a non-code harness: company/ops, research, knowledge, content), writes the profile to 02-DOCS, and installs the skills discovery justified. NOT the scaffolder (that is `harness`), NOT a stack skill."
tags: [init, bootstrap, start, new, setup]
recommends: [harness]
profiles: [minimal, core, full]
origin: risco
---

# init — the rsc-skills Front Door

*The very first thing you run. It meets the user where they are — assuming non-technical until told
otherwise — figures out what they actually want, installs the right skills, and hands off to
`harness` to build the workspace.*

Think of `init` as the receptionist: it learns who you are and what you need, writes that down where
every other skill can read it, and walks you to the right room. The boundary is fixed: **`init`
writes only the user-profile and decisions log under `02-DOCS/wiki/harness/`, plus the `CLAUDE.md`
Knowledge-map link.** Every other `01-TOOLS/` + `02-DOCS/` scaffold belongs to `harness`.

It is **domain-agnostic**. The thing being built or governed may be software on any stack, or a
non-code harness — running a company, an ops desk, a research program, a knowledge base, a content
operation. No code required; the same structure governs it. Never assume "project" means "code".

## First contact: two values, set before anything else

The whole harness behaves differently depending on these two. Nothing — no discovery, no
recommendation — happens before the profile exists and `CLAUDE.md` links it.

**Step 1 — Gauge technical level.** Literally the first thing you say, before any discovery, framed
so nobody feels small. Ask once, in their language:

> "Antes de nada, para hablarte como te resulte más cómodo: ¿te manejas con código y términos
> técnicos, o prefieres que te lo explique todo en cristiano? No hay respuesta mala — solo me ayuda
> a no aburrirte ni perderte."

> "First, so I talk to you the right way: are you comfortable with code and technical terms, or
> would you rather I explain everything in plain language? There's no wrong answer — it just helps
> me not bore you or lose you."

Record `technical_level: non-technical | mixed | technical`. Until they say otherwise, assume
non-technical: plain language, analogies over acronyms.

**Step 2 — Set the accompaniment dial.** Present it and let them pick; describe the options, do not
just list letters.

| Level | What they get |
| --- | --- |
| L0 — cavernícola | Results, almost no explanation. One line of output; no questions beyond hard blockers. |
| L1 — breve | One line of *why* per step; questions only when genuinely ambiguous. |
| L2 — explica decisiones | Each relevant decision justified; asks before each significant one. |
| L3 — acompañamiento total | Explains everything, reasons out loud, asks a lot. Ideal for learning while building. |

Non-technical and silent → default **L3**. Technical and silent → **L1**. `technical_level` is an
orthogonal modifier: even at L0 a non-technical user gets plain phrasing; even at L3 a technical one
skips the 101s. Every rsc skill reads these two values and obeys them — L0 means *do it and stop
talking*. Full rules and file formats → `references/accompaniment-and-profile.md`.

**Step 3 — Persist immediately.** Before discovery, before any recommendation:

- `02-DOCS/wiki/harness/user-profile.md` — the living profile (levels, goals, context, constraints).
- `02-DOCS/wiki/harness/decisions.md` — append-only. Entries are never edited or deleted.
- Root `CLAUDE.md` → a **short** `## Knowledge map` pointer: those two read-first entries plus a
  "full index → `02-DOCS/wiki/index.md`" line. Keep it tiny; it loads on every turn, and every other
  index entry belongs in the wiki index. Create `CLAUDE.md` if absent, additive only — never delete
  user content.

Greenfield? Create just `02-DOCS/wiki/harness/` to hold those two files. That plus the link is
everything `init` writes.

**Step 4 — Propose the developer model.** rsc installs a `developer` subagent (the implementation
worker) for every assistant supporting file-based agents. It runs at the **balanced** tier by
default — Sonnet on Anthropic tools, the provider's mid model elsewhere — and never the cheapest
`light` model, which is too weak to build with. Offer once, calibrated to the dial:

> *"La implementación la hará un sub-agente `developer`. ¿Qué modelo? **balanced / Sonnet** (rápido y
> económico — recomendado) o **heavy / Opus** (máxima calidad, más caro)."*

Record to `.rsc/developer.json` and re-run install/sync so the agent files adopt it. Skipped (e.g.
at L0) → `balanced`, which install also writes by default.

**Opt-out.** A fresh session auto-starts `init` while `user-profile.md` is absent. If the user does
not want a harness in this repo, write an empty `.rsc/.no-harness` — that silences the auto-start
permanently, even before a profile exists. Completing first contact silences it too. Commit the
marker so the decision is shared by the team.

## Significant decisions: requirements first, then exactly three options

For **any** significant decision — deploy target, database, framework, hosting, which CRM, where
documents live — never decide silently and never dump ten options.

1. **Gather the requirements that actually drive the choice.** For a deploy target: expected users,
   concurrency, budget, data residency, the team's comfort operating servers, scaling needs. Match
   the number of questions to the dial.
2. **Present exactly three options** with honest trade-offs: what each is good at, what it costs,
   what it demands of them.
3. **Recommend one**, matched to their answers and their level, and say why in language they follow.
4. **Log it** to `decisions.md` once they pick.

Canonical deploy example — Hetzner VPS + Coolify (cheapest, total control, you self-manage), Vercel
(zero-ops, scales itself, expensive at scale), and a third matched to the case (Fly.io, Railway, or
a managed cloud when compliance demands it). Requirements checklists per decision type and the
worked example → `references/recommend-skills.md`.

## The flow

```text
PROFILE → DISCOVER → INSTALL → GROUND → HANDOFF
```

### Phase 1 — PROFILE

Steps 1-3 above. Do not proceed until `user-profile.md` exists and `CLAUDE.md` links it. The
framing of every later question depends on it, which is why it cannot wait until after discovery.

### Phase 2 — DISCOVER

Establish **the state of the ground** and **what they want**.

Detect greenfield vs brownfield; don't ask blindly. **Brownfield** if the workspace has subproject
manifests (`package.json`, `pyproject.toml`, `pubspec.yaml`, `go.mod`, `Cargo.toml`), source files,
legacy `XX-*` folders, or an existing `01-TOOLS/` / `02-DOCS/`. Detect the stack the way `harness`
SCAN does — a read-only walk ignoring `node_modules/`, `.venv/`, `.next/`, `.git/`, `dist/`,
`build/`, `__pycache__/`, `.dart_tool/`. Summarize what you found and confirm it. **Greenfield** if
the workspace is empty or holds only stray notes: interview from zero.

Then the domain. Software (backend, frontend, mobile, agents) or a non-code harness (company/ops,
research, knowledge, content)? Capture goals, audience, constraints, and any tools already in play.
Record to `02-DOCS/wiki/harness/` as you go. Questionnaires for both cases →
`references/discovery.md`. Ask in batches sized to the dial; never dump every question at once.

### Phase 3 — INSTALL

Map what you learned to skills. **You have a terminal — install them yourself** after a one-word
confirm: `npx @ericrisco/rsc add <ids>`. Only if you genuinely cannot run a shell, hand the exact
command over for another tab. Never install without the confirm; it changes their environment.

| Need | Skills |
| --- | --- |
| Always | `harness` — the control plane that scaffolds and governs the workspace |
| Software backend | `fastapi` / `go`, `postgresdb` |
| Software frontend | `nextjs` / `flutter`, `design` |
| Marketing / landing / decks / teaching | `marketing`, `presentations`, `course-storytelling` |
| AI agents | `building-agents` |
| Shipping, security, wiring external tools | `secure-coding`, `deployment` |

Show the shortlist with a one-line *why* per skill in their language, confirm, install. Recommend
only what discovery justified — no "you'll probably want agents too".

Then flag activation, matched to their IDE: *"Listo, instaladas. Para que se activen, abre una
pestaña/sesión nueva de Claude Code (o recarga Cursor/Codex/Gemini) en esta carpeta — las skills se
cargan al arrancar la sesión."* Full skill map and sample printouts → `references/recommend-skills.md`.

### Phase 4 — GROUND

Four checks once the skills are in. The SessionStart hook nudges each of these too; doing them here
means the user starts clean.

1. **Version control.** No `.git/` → offer `git init`; the SDD chain and the ship guard assume it.
   Declined → write `.rsc/.no-git` so neither you nor the hook asks again, and log the decision.
2. **Context7 (live library docs).** For software, offer to wire it once:
   `claude mcp add --transport http context7 https://mcp.context7.com/mcp`. It gives version-correct
   docs instead of guessing from memory. Declined → `.rsc/.no-context7`.
3. **Skill audit.** Run `npx @ericrisco/rsc audit`. It inventories what is installed here and on the
   machine and flags overlap or skills with no footprint, so the project starts with the right set
   rather than a pile. Summarize at their level.
4. **Tell them about the danger guard.** A `technical_level` of `non-technical` or `mixed` (and the
   state before any profile exists) turns on a `PreToolUse` guard that blocks irreversible commands —
   `rm -rf`, `git push --force`, `git reset --hard`, `DROP`/`TRUNCATE`, `DELETE`/`UPDATE` with no
   `WHERE`, `dd` to a device, `curl | bash` — and asks for a safer alternative. A fully `technical`
   user is never guarded. It turns off only if the user explicitly asks: `.rsc/.no-danger-guard`.
   Mention it when you set a non-technical level, so a later block is not a surprise.

### Phase 5 — HANDOFF

`init` stops here. It has set the profile, recorded the discovery, and installed the skills.

> "Tu perfil y lo que hemos hablado ya están guardados. Ahora ejecuta `harness` y monto el esqueleto
> del proyecto (`01-TOOLS/` + `02-DOCS/`) leyendo todo lo que acabamos de decidir."

Do not scaffold while you are here, however tempting — `harness` reads this same profile and owns
that job.

## Project grounding

`init`'s record is the profile plus the append-only decisions log, both written in Phase 1 and
updated throughout, and both kept in the short `## Knowledge map` pointer because they are the
read-first entries. `scripts/verify.sh` checks the profile and the link exist (read-only; warns,
never fails).

## See Also

- `harness` — the scaffolder this hands off to; builds `01-TOOLS/` + `02-DOCS/` from the profile.
- `deployment` — invoked when the deploy decision above is actually made.
- `secure-coding` — recommended whenever software is being shipped.
- Stack skills (`fastapi`, `go`, `nextjs`, `flutter`, `building-agents`…) are recommended at runtime
  by Phase 3 from discovery, never hardwired here.
- References: `references/accompaniment-and-profile.md`, `references/discovery.md`,
  `references/recommend-skills.md`.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente,
terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. Nunca termines
en seco. Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`.
