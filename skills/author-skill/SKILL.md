---
name: author-skill
description: "Use when authoring a NEW skill or editing an existing one for the rsc catalog — writing or fixing a SKILL.md, crafting a trigger-rich third-person description that fires on the right prompts, deciding what goes in references/ vs the body, writing evals/cases.yaml + evals/README.md, or wiring a skill into the catalog (tags, recommends, manifest). Triggers: 'write a skill', 'author a skill', 'create a new skill', 'escribe una skill', 'haz una skill nueva', 'edit this skill', 'improve this skill', 'my skill never triggers', 'my skill always fires', 'fix the description', 'the frontmatter is invalid', 'write evals for this skill', 'add this skill to the catalog', 'audit this skill against the rubric', 'progressive disclosure', 'SKILL.md too long'. Knows the rsc conventions: hybrid layout, tags/recommends frontmatter, manifest.json, the npx @ericrisco/rsc CLI, the Knowledge map. NOT building runtime features (that is the SDD chain) and NOT general docs."
tags: [skill, authoring, meta]
recommends: []
origin: risco
---

# author-skill — write skills that trigger and teach

This is the **meta skill**: it authors and edits the other skills in the rsc catalog. A skill is two things bolted together — a **description that fires at the right moment**, and a **body that makes the agent better once it fires**. Most skills fail on the first. This skill exists to get both right, to the bar the rsc catalog already holds.

It lives in `rsc-core` next to `init` and `harness`, the same way those govern the workspace. Where the SDD chain (`specify` → `plan` → … → `ship`) builds *product*, `author-skill` builds *the tools that build product*. Use it whenever a skill is born or edited.

## When to use / when NOT to use

Use when:

- Writing a brand-new skill from a one-line intent ("I keep re-explaining how we do X — make it a skill").
- Editing an existing skill: tightening the description, splitting the body into `references/`, adding a checklist or anti-patterns table.
- A skill mis-triggers — never fires when it should, or fires on everything.
- Writing or repairing `evals/cases.yaml` + `evals/README.md`.
- Wiring a finished skill into the catalog — `tags`, `recommends`, and the manifest (the rsc plumbing).
- Auditing a skill against the rubric below before it ships.

Do NOT use when (delegate or decline):

- The user wants to *build a product feature* with a written spec/plan — that is the SDD chain (`../specify/SKILL.md` → `../plan/SKILL.md` → …), not a skill.
- The user wants to design an autonomous agent / tool-calling loop — that is `../building-agents/SKILL.md`.
- The user wants generic project docs or a wiki article — that is the `../harness/SKILL.md` 02-DOCS engine.
- Bootstrapping a workspace or profiling the user — that is `../init/SKILL.md`.

## Read the user profile first (accompaniment dial)

Before writing, read `02-DOCS/wiki/harness/user-profile.md` for the technical level and the accompaniment dial, and **adapt**:

- **L0** — draft the whole skill, show it, move on. Minimal narration.
- **L1** — one line of *why* per major choice (why this trigger, why split that reference).
- **L2** — justify each structural decision as you make it.
- **L3** — explain everything, ask before committing to a name/scope, walk the rubric out loud.

When no profile exists, default to non-technical framing and ask the two gauging questions (technical level + dial) before going deep. Skill authoring is itself a technical act — many users will want L2/L3 here even if they run L0 elsewhere.

## What a skill is (the anatomy)

```text
skills/<id>/
├── SKILL.md              the body: frontmatter (name + description + origin) then the prose
├── references/           progressive-disclosure detail, loaded only when the body points to it
│   └── <topic>.md
├── evals/
│   ├── cases.yaml        trigger + capability test cases
│   └── README.md         how to run the evals, honestly
└── scripts/              optional; verify.sh + helpers for skills with a checkable artifact
    └── verify.sh
```

The **frontmatter** decides *if* the skill loads. The **body** decides *how good* the agent is once it does. Treat them as two separate engineering problems with two separate quality bars.

## The description — the single highest-leverage line

The description is the only part of a skill the agent reads at *every* turn to decide whether to pull the skill in. A vague description is a skill that never fires; an over-broad one is a skill that hijacks unrelated turns. Get this right before anything else.

Rules, all enforced:

1. **Third person, present tense.** "Use when authoring a new skill…" — never "I help you…" or "You should…". The agent is reading *about* the skill.
2. **Trigger-rich.** Lead with a `Use when …` clause naming the *situations* and *symptoms*, then a `Triggers:` list of concrete phrasings — including non-obvious ones and at least one other language the user actually writes in (rsc users mix Spanish/Catalan). The router matches on these.
3. **Draw the boundary.** End with what it is **NOT** and which sibling owns that instead. Negative space prevents hijacking as much as positive triggers cause firing.
4. **≤ 1024 characters, valid single-line quoted YAML.** One physical line, wrapped in double quotes, internal quotes escaped or avoided. If it does not parse, the skill does not load.
5. **`origin: risco`** on its own line. This marks it as ours.

```yaml
# Good — situation + symptoms + phrasings + boundary
description: "Use when X happens or the user shows symptom Y — doing A, fixing B, choosing C. Triggers: 'phrase one', 'frase en español', 'a non-obvious one'. NOT Z (that is `sibling`)."

# Bad — first person, no triggers, no boundary, would never route well
description: "I help you write great skills and make them work."
```

The full description recipe, the character-budget tactics, and a worked before/after → `references/description-recipe.md`.

## Progressive disclosure — the body is an index, not an encyclopedia

The body is loaded in full whenever the skill fires, so every line competes for the agent's attention. Keep the body **~120–400 lines**: the method, the rules, the decision points, and *pointers* to depth. Push anything long, reference-like, or rarely-needed into `references/<topic>.md` and link to it inline ("full table → `references/foo.md`").

Decide where a paragraph lives:

| Put it in the body when… | Move it to references/ when… |
| --- | --- |
| The agent needs it on *every* run | It is needed only in a specific branch |
| It is a rule, a gate, or a decision point | It is a long table, a catalog, or a template |
| It is short and load-bearing | It is reference detail that would bloat the body |
| Cutting it would change behavior | It is an example that illustrates but does not instruct |

If the body creeps past ~400 lines, that is the signal to extract a reference — not to keep scrolling. A skill the agent half-reads is worse than a short one it reads fully.

## The hybrid structure — when each piece earns its place

- **SKILL.md** — always. Frontmatter + focused body.
- **references/** — only when the body genuinely needs offloaded depth. Do not create an empty `references/` to look complete; a 150-line single-file skill is fine.
- **evals/** — always. `cases.yaml` + `README.md`. A skill with no evals is unverifiable and does not ship.
- **scripts/verify.sh** — only when the skill produces a *checkable artifact* (code, config, copy with a ban-list). **Process skills** — those judged on the safety rails they install in the agent's behavior, like the SDD-phase skills or this one — do **not** ship a `verify.sh`; their evals carry a capability scenario instead.

## Orientation footer (required in every new skill)

Every new skill MUST end with the orientation footer so the harness never leaves the user in seco. Append verbatim:

````markdown

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
````

The full protocol lives once in the `orient` skill; the footer only references it.

## The authoring workflow

Run in order. Each step gates the next.

1. **Name & scope.** One skill, one job. Pick a short kebab-case `<id>` that is the job, not the domain. If you can not say the job in one sentence, the scope is wrong — split it. Check no sibling already owns this; if one half-owns it, decide *edit the sibling* vs *new skill* before writing.
2. **Draft the description.** Per the recipe above. This first, because writing it forces the scope clear. → `references/description-recipe.md`.
3. **Outline the body.** Method, rules, decision points. Mark what becomes a reference.
4. **Write the body** in the rsc voice (see below). Tag every code/example fence with a language. Add a copy-able checklist or decision table *only where the flow actually branches* — not as decoration. Add a short anti-patterns table.
5. **Extract references** for anything long or branch-specific.
6. **Write the evals** — `cases.yaml` then `README.md`. → `references/eval-authoring.md`.
7. **Wire it into the rsc plumbing** (`tags`, `recommends`, `npm run manifest`, and indexing any artifact in `02-DOCS/wiki/index.md` — the Knowledge map; root `CLAUDE.md` keeps only a short pointer). → `references/rsc-conventions.md`.
8. **Self-audit against the rubric** (below). Fix every miss or justify it.

## The rsc voice

Match the catalog, do not invent a new register:

- Direct, second-person-to-the-agent instruction ("Read the profile first", "Cut any section with no job").
- Rules stated as non-negotiables with a one-line *why*, not a lecture.
- Concrete over abstract: a number, a path, a Bad→Good pair beats an adjective.
- Original prose. Mine ideas from anywhere; the words are Eric's. Do **not** reproduce another ecosystem's signature artifacts or phrasing — no borrowed "1% chance" urgency blocks, no copied rationalization wording, no `*-reviewer-prompt.md` files, no verbatim flowcharts. The rsc identity is its own.
- Cross-reference siblings by name or `../<sibling>/SKILL.md`, only ones that actually exist.

## Match the form to the failure

Before you write an instruction, name the **failure** it's meant to prevent — then pick the form
that actually fixes *that* failure. The instinct is to write a prohibition ("don't do X") for
everything. That instinct is wrong for most failures, and measurably counter-productive for one
class: **a prohibition aimed at output shape tends to summon the very thing it forbids** (the model
attends to the named token), and can do *worse* than saying nothing at all. Match deliberately:

| The failure is… | Use this form | Why, and example |
| --- | --- | --- |
| **Discipline** — the agent knows the rule but skips it under pressure (time, sunk cost, "just this once") | **Prohibition + rationalization table** (`Anti-patterns → STOP`) | The agent already knows what's right; it needs the excuse pre-refuted at the moment of temptation. This is exactly what the `STOP` tables are for. "I'll skip the failing test to ship" → name the rationalization, kill it. |
| **Wrong-shaped output** — tone, verbosity, format, structure come out wrong | **Positive recipe / contract** (show the target shape) | A prohibition ("don't be verbose", "no marketing fluff") makes it *more* likely — the model fixates on the banned shape. Give the shape to hit instead: "Reply in ≤3 sentences, lead with the verdict." Demonstrate, don't forbid. |
| **Omitted element** — the agent forgets a required piece | **Required structural slot** (a checklist item or a template field it must fill) | You can't prohibit an absence. Make the slot mandatory so its emptiness is visible — a `Done-of-done` checkbox, a template section, a result-envelope field. |
| **Conditional behavior** — right action depends on the situation | **Predicate-keyed conditional** ("When X → do Y; otherwise Z") | A flat rule fires in the wrong context. Key the behavior to its trigger so the agent branches correctly instead of over- or under-applying. |

So: keep the `Anti-patterns → STOP` tables — they're the correct tool for *discipline* failures,
which is most of what the SDD-discipline skills guard. But when you catch yourself writing "don't
make it X" about the *shape* of an output, stop and rewrite it as the shape to hit. Prohibition is
a scalpel for one failure type, not the default for all of them.

## The best-practice rubric (audit before shipping)

A skill ships only when every box is checked or a miss is consciously justified.

- [ ] **Frontmatter parses** as YAML; `name` matches the directory `<id>`; `origin: risco` present.
- [ ] **Description ≤ 1024 chars**, third-person, `Use when…` lead, concrete `Triggers:` (incl. a non-obvious and a non-English phrasing), and a `NOT … (that is sibling)` boundary.
- [ ] **One job.** The body never drifts into a second skill's territory; it delegates instead.
- [ ] **Body 120–400 lines**, focused; long/branch-specific material lives in `references/`.
- [ ] **Progressive disclosure** real — references are pointed to inline, not orphaned.
- [ ] **Every fence language-tagged**; no placeholder/TODO prose; examples concrete.
- [ ] **Checklist/decision table only where a flow branches**; an **anti-patterns table** present.
- [ ] **Accompaniment dial honored** — reads the profile, adapts verbosity.
- [ ] **Artifacts under `02-DOCS/wiki/`** and indexed in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer), if the skill produces any.
- [ ] **Concrete tooling delegated** to the stack skills rather than reinvented.
- [ ] **evals present** — `cases.yaml` (≥5 `should_trigger` incl. non-obvious, ≥4 `should_not_trigger` each with a real-sibling `route_to`, ≥1 `capability` with a `must_include` rubric) + an honest `README.md`. `scripts/eval-lint.sh` passes — but it only checks presence and the counts (≥5/≥4/≥1) and that those keys are lists; the `route_to`-points-at-a-real-sibling, non-obvious phrasings, and `must_include` quality are yours to verify here, not the linter's.
- [ ] **verify.sh** present iff the skill has a checkable artifact; process skills rely on evals.
- [ ] **Sibling links resolve** — every `../x/SKILL.md` points to a skill that exists.
- [ ] **Wired** — `tags` + `recommends` set, `npm run manifest` re-run, and `npm run validate` / `npm run manifest:check` pass (manifest current, no dangling recommends).

Full rubric rationale and the rsc plumbing steps → `references/rsc-conventions.md`.

### Two ship gates: document AND behavior

The rubric above scores the skill as a **document**. That is one of two gates — a skill ships
only when **both** are green:

1. **Static** — the rubric above / `scripts/skill-rubric.md`, weighted score ≥ 8.5.
2. **Behavioral** — `scripts/skill-behavior-rubric.md`: run the skill on its `capability`
   scenarios **with and without** it loaded, blind-grade both outputs, require `absolute ≥ 8.5`
   **and** `lift ≥ +1.0`. Run it:

   ```bash
   # 1) execute + grade — invoke the Workflow tool:
   #      scriptPath: scripts/skill-behavior-eval.workflow.js   args: "<skill-id>"
   #    save the returned object to /tmp/<skill>-raw.json
   # 2) score + gate (exit 0 pass / 1 fail):
   node scripts/skill-behavior-eval.js --score /tmp/<skill>-raw.json
   ```

   A failing `lift` means the body adds nothing a bare agent didn't already do — fix the body,
   don't game the checklist.

## Anti-patterns / rationalizations → STOP

| Rationalization | Reality / fix |
| --- | --- |
| "I'll polish the description later, the body matters more" | The description is *why the body ever runs*. Write it first, to bar. |
| "More triggers = fires more = better" | Over-broad descriptions hijack unrelated turns. Add the `NOT` boundary and prune. |
| "One skill that does specify + plan + implement is convenient" | One skill, one job. A multi-job skill triggers fuzzily and teaches poorly. Split it. |
| "The body is long because the topic is rich" | Past ~400 lines the agent skims. Extract references; keep the body an index. |
| "I'll skip evals, I'll just test it by hand once" | Unverifiable = does not ship. Write `cases.yaml`, including near-misses with `route_to`. |
| "It's basically superpowers' writing-skills, I'll mirror it" | Mine the idea, write it in the rsc voice. Copied artifacts/phrasing are a defect. |
| "I'll add a `references/` folder so it looks thorough" | Empty references are noise. Add depth only where the body points to it. |
| "verify.sh on every skill is more rigorous" | A process skill has no artifact to grep. Its rigor is the capability eval. |
| "Linking `../foo/SKILL.md` is fine even if foo isn't in this repo" | A dead link is a defect. Reference only siblings that exist. |

## Project grounding (02-DOCS + CLAUDE.md)

When authoring produces a durable design note (a skill's scope decision, a description rationale worth keeping), persist it under `02-DOCS/wiki/sdd/` and index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer), per the `../harness/SKILL.md` convention — never a stray file at the repo root. The skill's own `evals/` is the executable record of intent; the wiki note is the human-readable why.

## See Also

- `../harness/SKILL.md` — the 02-DOCS Knowledge-map convention these artifacts live in; the bar this catalog holds.
- `../init/SKILL.md` — the front door that profiles the user and sets the dial this skill reads.
- `../building-agents/SKILL.md` — for autonomous agents/tool-loops, a different craft than authoring a skill.
- `../specify/SKILL.md` — when the user wants a *product feature* specced, not a skill authored.
- References: `references/description-recipe.md`, `references/eval-authoring.md`, `references/rsc-conventions.md`.
