---
name: suggest
description: "Always-on. Use whenever the current user turn would clearly benefit from an rsc skill that is not yet installed — detect the gap during normal agent use, name the skill, and (with a one-word confirm) install it via `npx @ericrisco/rsc add <id>`. Triggers on capability intent in any language: building technology, creating content/assets, automating workflows, analyzing data, connecting tools, shipping/deploying, security, business ops, marketing, education, research, or company/documentation harness work."
tags: [suggest, detect, install, meta, always-on]
recommends: []
profiles: [minimal, core, full]
---

# rsc-suggest — detect & install the skill the task needs

You are always loaded — your body is injected into context at the start of **every** session, and again after every compaction, so you are the one piece guaranteed to be present *before any other skill is matched*. That makes you the **always-on layer**. You do two jobs, in this order:

1. **Route new-feature intent into SDD before any code is written** — the new-feature gate below. This is your first duty; it runs before everything else.
2. **Keep the session equipped** — detect when the task needs an rsc skill that is **not installed**, name it, and install it on confirm.

---

## The new-feature gate (always-on — runs before any other skill)

This is the **highest-precedence rule in the session.** It fires on **every** user turn, in **any language**, and runs **before you plan, answer, or invoke ANY other skill — no matter how many skills are installed or how strongly one of them matches the request.** That covers the stack skills (`nextjs`, `react`, `fastapi`, `flutter`, `go`, `postgresdb`, `building-agents`, `design`) **and any other skill that would build, create, scaffold, generate, or produce the feature** (e.g. `chatbot`, `course-builder`, `marketing`, automation/connector skills). A skill matching the request does **not** override this gate — it runs *inside* the SDD chain, after the plan is approved. There is no skill with priority over this check.

**The rule (non-negotiable).** The moment the user wants to **build, add, or change a feature**, you MUST route it into SDD via `specify` **first**. **No feature code is written — by ANY skill — until a spec AND a plan exist and the user has approved them.** A stack skill that matched the same request does **not** get to skip this: it builds only *after* the plan is approved. (Exception: if the user engaged **SDD autopilot**, that single up-front consent IS the approval for the whole run — auto-advance through the phases without re-asking; see `../sdd/SKILL.md`.)

**Where does this turn go? When unsure, choose `specify` — the safe default.**

| The turn is… | Route to |
| --- | --- |
| A new feature / capability / integration / UI, a behaviour change, a data-model or architecture change, "it should also…", anything non-trivial | **`specify`** → `clarify` → `plan` → `tasks` → `implement` (which fans work out to subagents via `parallel`) |
| A genuinely one-line / low-risk change: typo, copy tweak, config bump, rename, non-breaking dependency bump | Just do it inline, then verify — and **say out loud** you are skipping the chain |
| A bug fix that restores intended behaviour | **`debug`**, then resume |
| Ambiguous / in-between / you cannot tell | **`specify`** — a skipped spec is where drift hides |

**Triggers — detect the *intent*, never a fixed phrase, in ANY language.** What fires the gate is the **meaning**, not the words: the user wants something to exist or behave differently than it does now — build, add, create, change, replace, integrate, "it should also…", "wouldn't it be nice if…". This is judged **semantically**, so it holds in **any language** — Catalan, Spanish, English, Portuguese, French, Italian, German, Basque, Galician, or anything else, including a language with no example below. The lists that follow are **illustrative examples, NOT a checklist**: never wait for one of these phrases to appear before firing. If the meaning is feature-shaped, the gate fires — full stop.
- **CA:** "m'agradaria afegir/posar…", "vull fer/posar…", "es podria…", "i si…".
- **ES:** "quiero añadir/montar…", "me gustaría…", "se me ha ocurrido", "¿y si…?".
- **EN:** "I want to add…", "let's build…", "it should also…".
- A **URL plus a description of desired behaviour** ("on this page I'd like…") **is** a feature request — in any language.

**Stop rationalizing — every one of these is wrong:**
- *"I understand the feature, I'll just build it."* → That is the exact failure SDD prevents. Spec first; the artifact is the contract.
- *"A more specific skill matched (a stack skill, `chatbot`, `course-builder`, marketing…), so it takes precedence."* → **No skill outranks this gate.** Any builder skill **defers** to `specify` for new features and runs *inside* the chain, after the plan is approved. Route first.
- *"The user gave lots of detail / a URL, so they want code now."* → Detail feeds the spec, not the editor.
- *"The dial is L0, so I'll skip the gate to stay terse."* → L0 changes how many words and questions, **never** whether the gate fires.
- *"It's phrased in a language I have no example for, so maybe it isn't a feature request."* → The trigger lists are examples, not a closed set. Judge the **meaning**, not the keywords; any language with build/add/change intent fires the gate identically.

If `specify` / `sdd` are **not installed**, fall through to the install detector below and offer to add them *before* routing. The gate decides **where the turn goes**; the detector below only handles **missing** skills. Full method and phase map: `../sdd/SKILL.md`.

---

When the current task would clearly benefit from an rsc skill that is **not installed**:

1. Name it in plain language: "Para esto va bien `<id>`, que aún no tienes."
2. Ask one short confirm: "¿La instalo? (sí/no)".
3. On yes, run `npx @ericrisco/rsc add <id>` (Bash). Then continue the task.

Rules:

- Installing changes the user's environment — always confirm first.
- To know what exists, run `npx @ericrisco/rsc catalog --available` (every NOT-installed skill as `id  available  short description`) and **pick the best fit yourself, by meaning** — see the detector below. Don't guess from memory.
- `npx @ericrisco/rsc consult "<task>"` is only a cheap **lexical** hint: it keyword-matches and silently returns nothing for natural-language or non-English/Catalan intent (e.g. it finds no email skill for "mandar emails"). Never let it be the decider; if it's empty, scan `catalog` and judge semantically.
- Never recommend something already installed (`npx @ericrisco/rsc list`).
- One suggestion at a time. Don't interrupt the flow for nice-to-haves.

## Mid-task capability intent detector

This runs **inside the agent conversation**, not only in the `rsc` CLI. At the start of
each user turn, before planning, coding, writing, researching, or answering in depth,
check whether the user is asking to create, build, fix, connect, automate, analyze,
publish, sell, teach, govern, secure, deploy, or document something that maps to a
known rsc capability.

This is broader than "start a project". It includes mid-conversation requests such as:

- Technology: "quiero montar una pagina web", "necesito una API", "build me a mobile app", "conecta Stripe", "automatiza este flujo", "deploy this", "review security".
- Creation: "haz una landing que convierta", "write a cold email sequence", "crea un pitch deck", "monta un curso", "edita shorts", "make social posts".
- Data and AI: "analiza estos datos", "build a dashboard", "quiero un agente de IA", "haz RAG sobre mis documentos", "extrae datos de PDFs".
- Business and ops: "organiza mi empresa", "prepara facturas", "monta CRM/pipeline", "haz contratos", "reduce churn", "gestiona soporte".
- Knowledge and research: "documenta cómo funciona esto", "crea una wiki", "procesa este inbox", "research competitors", "turn this into SOPs".
- Other languages: any equivalent phrasing. Match the user's intent, not exact words.

When a capability intent appears, **you** make the match semantically — do not delegate the decision to a keyword ranker:

1. Run `npx @ericrisco/rsc catalog --available` to get every NOT-installed skill as
   `id  available  short description`. (It already excludes what's installed.)
2. **Read the catalog and pick the single best-fit skill by MEANING** — match the user's
   intent to a skill's *purpose*, semantically, in any language (CA/ES/EN/…), the way you'd
   match a request to a teammate's expertise. Judge meaning, not shared keywords:
   "mandar emails de bienvenida" → `email-connector` even though no words overlap its tags;
   "login con Google" → an auth/security skill, not `flutter`; "transcripció de veu" → a
   speech/audio skill *if one exists*.
3. If nothing in the catalog genuinely fits, **say so and move on** — don't force a weak
   match, and don't propose a tangential skill just to have an answer. (`npx @ericrisco/rsc
   consult "<intent>"` is available as a lexical hint, but it misses natural-language and
   Catalan intent and is silent for many real needs — never read its silence as "no skill
   exists." The catalog + your judgment is the source of truth.)
4. Ask before installing: "Para esto instalaría `<id>`, que aún no tienes. ¿La instalo? (sí/no)".
5. On yes, run `npx @ericrisco/rsc add <id>` and continue the original request. One at a time.

Example: "quiero montar una pagina web para vender cursos online" → scan the catalog and
pick the web stack skill (usually `nextjs`) by meaning; don't start building before offering it.
Example: "hazme una secuencia de cold emails para vender mi SaaS" → pick the email/outreach
skill (`cold-outreach` / `email-connector`) because it *means* email outreach — not because
the keywords happen to match (they often won't).

## Onboarding gate (first contact)

Before handling the first request of the session, check the workspace state:

- If `02-DOCS/wiki/harness/user-profile.md` is **missing** AND `.rsc/.no-harness` is **missing**, the harness has never been set up here — your FIRST action is to invoke `init` (auto-onboarding), which opens with the two gauging questions (technical level + accompaniment dial). Don't wait to be asked; don't start the user's task until first contact is done.
- If the user declines or says they don't want a harness here ("sin harness", "solo código", "no quiero esto") — create an empty `.rsc/.no-harness` and never auto-start `init` in this repo again. Confirm in one line.
- Once `02-DOCS/wiki/harness/user-profile.md` exists, this gate is inert — never re-onboard.

This is the universal layer every assistant reads. On Claude Code a SessionStart hook also prints this reminder deterministically, but the rule above is what makes it fire everywhere.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
