---
name: init
description: "Use when starting from nothing or pointing rsc at an existing project — the front door. First asks one question — technical terms or analogies (analogies by default) — then discovers what the user wants to build or govern (any stack, or a non-code harness: company/ops, research, knowledge, content), writes the profile to 02-DOCS, and installs the skills discovery justified. NOT the scaffolder (that is `harness`), NOT a stack skill."
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

## First contact: one question, set before anything else

The whole harness talks differently depending on this answer. Nothing — no discovery, no
recommendation — happens before the profile exists and `CLAUDE.md` links it.

**Step 1 — Ask the register.** Literally the first thing you say, before any discovery. Ask once,
in their language:

> "¿Te hablo en lenguaje técnico o con analogías?"

> "Should I talk to you in technical terms or with analogies?"

Record `technical_level: technical` (technical terms used directly) or `non-technical` (plain words
and everyday analogies). `mixed` stays valid in older profiles and reads like `non-technical`. No
clear answer → `non-technical`. There is no second question: every skill speaks in the one voice
`orient` owns (short sentences, one idea each, every answer understandable on its own), and this
value only picks its register. Full rules and file formats → `references/accompaniment-and-profile.md`.

**Step 2 — Persist immediately.** Before discovery, before any recommendation:

- `02-DOCS/wiki/harness/user-profile.md` — the living profile (register, goals, context, constraints).
- `02-DOCS/wiki/harness/decisions.md` — append-only. Entries are never edited or deleted.
- Root `CLAUDE.md` → a **short** `## Knowledge map` pointer: those two read-first entries plus a
  "full index → `02-DOCS/wiki/index.md`" line. Keep it tiny; it loads on every turn, and every other
  index entry belongs in the wiki index. Create `CLAUDE.md` if absent, additive only — never delete
  user content.

Greenfield? Create just `02-DOCS/wiki/harness/` to hold those two files. That plus the link is
everything `init` writes.

**Step 3 — Propose the developer model.** rsc installs a `developer` subagent (the implementation
worker) for every assistant supporting file-based agents. It runs at the **balanced** tier by
default — Sonnet on Anthropic tools, the provider's mid model elsewhere — and never the cheapest
`light` model, which is too weak to build with. Offer once, in one line:

> *"La implementación la hará un sub-agente `developer`. ¿Qué modelo? **balanced / Sonnet** (rápido y
> económico — recomendado) o **heavy / Opus** (máxima calidad, más caro)."*

Record to `.rsc/developer.json` and re-run install/sync so the agent files adopt it. Skipped →
`balanced`, which install also writes by default.

**Opt-out.** A fresh session auto-starts `init` while `user-profile.md` is absent. If the user does
not want a harness in this repo, write an empty `.rsc/.no-harness` — that silences the auto-start
permanently, even before a profile exists. Completing first contact silences it too. Commit the
marker so the decision is shared by the team.

## Significant decisions: requirements first, then exactly three options

For **any** significant decision — deploy target, database, framework, hosting, which CRM, where
documents live — never decide silently and never dump ten options.

1. **Gather the requirements that actually drive the choice.** For a deploy target: expected users,
   concurrency, budget, data residency, the team's comfort operating servers, scaling needs. Ask only
   the ones that change the choice.
2. **Present exactly three options** with honest trade-offs: what each is good at, what it costs,
   what it demands of them.
3. **Recommend one**, matched to their answers, and say why in their register.
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

Steps 1-2 above. Do not proceed until `user-profile.md` exists and `CLAUDE.md` links it. The
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
`references/discovery.md`. Ask in short batches; never dump every question at once.

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
| Shipping, security, wiring external tools | `security-audit`, `deployment` |

Show the shortlist with a one-line *why* per skill in their language, confirm, install. Recommend
only what discovery justified — no "you'll probably want agents too".

Then flag activation, matched to their IDE: *"Listo, instaladas. Para que se activen, abre una
pestaña/sesión nueva de Claude Code (o recarga Cursor/Codex/Gemini) en esta carpeta — las skills se
cargan al arrancar la sesión."* Full skill map and sample printouts → `references/recommend-skills.md`.

### Phase 4 — GROUND

Five checks once the skills are in. The SessionStart hook nudges each of these too; doing them here
means the user starts clean.

1. **Version control.** No `.git/` → offer `git init`; the SDD chain and the ship guard assume it.
   Declined → write `.rsc/.no-git` so neither you nor the hook asks again, and log the decision.
2. **Context7 (live library docs).** For software, offer to wire it once:
   `claude mcp add --transport http context7 https://mcp.context7.com/mcp`. It gives version-correct
   docs instead of guessing from memory. Declined → `.rsc/.no-context7`.
3. **Skill audit.** Run `npx @ericrisco/rsc audit`. It inventories what is installed here and on the
   machine and flags overlap or skills with no footprint, so the project starts with the right set
   rather than a pile. Summarize it in their register.
4. **Tell them about the danger guard.** A `technical_level` of `non-technical` or `mixed` (and the
   state before any profile exists) turns on a `PreToolUse` guard that blocks irreversible commands —
   `rm -rf`, `git push --force`, `git reset --hard`, `DROP`/`TRUNCATE`, `DELETE`/`UPDATE` with no
   `WHERE`, `dd` to a device, `curl | bash` — and asks for a safer alternative. A fully `technical`
   user is never guarded. It turns off only if the user explicitly asks: `.rsc/.no-danger-guard`.
   Mention it when you record `non-technical`, so a later block is not a surprise.
5. **Automatic updates.** Ask once, yes by default:
   > *"Cuando salga una versión nueva de rsc, ¿la instalo sola? Las que cambian mucho (major) te las
   > preguntaré siempre. (sí/no)"*

   > *"When a new rsc version comes out, should I install it on my own? Big ones (major) I will
   > always ask about. (yes/no)"*

   Yes, or no clear answer → do nothing; it is on. No → create `.rsc/.no-auto-update`: every
   release then asks. It is a project switch, recorded in `.rsc.json` on the next sync.

### Phase 5 — HANDOFF

The profile is set, the discovery recorded, the skills installed. What is missing is the workspace
itself, and this is where onboarding used to end with a request: *"now run `harness`"*. Nothing ran
it. Finishing depended on the user reading a line and typing something — and in a chat install that
user has just delegated precisely so they would not have to know what to type.

So **invoke `harness` yourself, now**, as the last step of this phase. Say what you are doing in one
line, then do it:

> "Tu perfil y lo que hemos hablado ya están guardados. Monto ahora el esqueleto del proyecto
> (`01-TOOLS/` + `02-DOCS/`) leyendo todo lo que acabamos de decidir."

`harness` still owns *how* the scaffold is built — you are calling it, not reimplementing it. Do not
hand-roll directories here.

**And if it does not happen, say so.** If `harness` cannot run, or stops half-way, **do not tell the
user rsc is ready**: name what is missing and what will create it. The installer holds the same rule
— it prints `RSC_ONBOARDING_INCOMPLETE` instead of `RSC_ONBOARDING_READY` when the harness floor is
absent — and an agent that contradicts its own installer is worse than either alone. Claiming a
harness that is not there is the one failure the user cannot diagnose, because everything looks
installed and nothing behaves as if it were.

## Project grounding

`init`'s record is the profile plus the append-only decisions log, both written in Phase 1 and
updated throughout, and both kept in the short `## Knowledge map` pointer because they are the
read-first entries. `scripts/verify.sh` checks the profile and the link exist (read-only; warns,
never fails).

## See Also

- `harness` — the scaffolder this hands off to; builds `01-TOOLS/` + `02-DOCS/` from the profile.
- `deployment` — invoked when the deploy decision above is actually made.
- `security-audit` — recommended whenever software is being shipped.
- Stack skills (`fastapi`, `go`, `nextjs`, `flutter`, `building-agents`…) are recommended at runtime
  by Phase 3 from discovery, never hardwired here.
- References: `references/accompaniment-and-profile.md`, `references/discovery.md`,
  `references/recommend-skills.md`.

## Orientación (siempre)

Habla con la voz de `orient`: frases cortas, una idea por frase, y cada respuesta se entiende sola. Registro técnico o con analogías según `technical_level` en `02-DOCS/wiki/harness/user-profile.md`. Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ➡️ siguiente, terminando en pregunta; ✅ y 🧭 cuando hay algo hecho o decidido). **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)