---
name: author-skill
description: "Use when authoring a NEW rsc skill or editing an existing one — scoping it to one job, writing the description that decides whether it ever loads, splitting the body into references/, writing its evals, auditing it against the rubric. NOT building a product feature (that is `specify`) and NOT designing an agent loop (that is `building-agents`)."
tags: [skill, authoring, meta]
recommends: []
origin: risco
---

# author-skill — write skills that trigger and teach

This is the **meta skill**: it authors and edits the other skills in the rsc catalog. A skill is two things bolted together — a **description that fires at the right moment**, and a **body that makes the agent better once it fires**. Most skills fail on the first. Treat them as two separate engineering problems with two separate quality bars.

Where the SDD chain (`specify` → `plan` → … → `ship`) builds *product*, `author-skill` builds *the tools that build product*. Use it whenever a skill is born or edited.

**Not this skill — delegate:** a product feature specced or planned → `../specify/SKILL.md`, `../plan/SKILL.md`. An autonomous agent or tool-calling loop → `../building-agents/SKILL.md`. Generic project docs or a wiki article → the `../harness/SKILL.md` 02-DOCS engine. Bootstrapping a workspace or profiling the user → `../init/SKILL.md`.

Read `02-DOCS/wiki/harness/user-profile.md` and work at the accompaniment dial it records; `../init/SKILL.md` owns that dial and sets it. With no profile, default to non-technical framing and ask for the technical level and the dial before going deep — skill authoring is itself a technical act, so many users want more narration here than they do elsewhere.

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

The **frontmatter** decides *if* the skill loads. The **body** decides *how good* the agent is once it does.

## The description — the single highest-leverage line

The description sits in context on **every turn the skill is installed**, invoked or not. The body is only paid for when the skill fires; the description is paid for always. So length here is a cost, never a credit. A vague description is a skill that never fires; an over-broad one hijacks unrelated turns. Get this right before anything else.

Rules, all enforced:

1. **Third person, present tense.** "Use when authoring a new skill…" — never "I help you…" or "You should…". The agent is reading *about* the skill.
2. **Discriminative, not exhaustive.** Lead with a `Use when …` clause naming the *situation*, then only the capabilities that separate this skill from its neighbours. Do **not** append a `Triggers: '…', '…'` phrase list: the model matches on meaning, so a keyword bank in three languages buys nothing and is charged on every turn. The test is *discrimination, not coverage* — could a reader pick this skill over its nearest sibling from this line alone?
3. **Draw the boundary.** End with a `NOT <x> (that is <sibling>)` clause, naming a sibling that actually exists under `skills/`. Negative space prevents hijacking as much as positive matching causes firing.
4. **Aim ≤ 350 characters; 1024 is the schema-enforced hard limit.** One physical line, wrapped in double quotes, internal quotes escaped or avoided. If it does not parse, the skill does not load.
5. **`origin: risco`** on its own line. This marks it as ours.

```yaml
# Good — situation, the few capabilities that discriminate, a real boundary
description: "Use when X happens or the user shows symptom Y — doing A, fixing B, choosing C. NOT Z (that is `sibling`)."

# Bad — first person, no situation, no boundary; competes with every sibling on every turn
description: "I help you write great skills and make them work."
```

The full recipe, the budget tactics, and a worked before/after → `references/description-recipe.md`.

## Progressive disclosure — the body is an index, not an encyclopedia

The body is loaded in full whenever the skill fires, so every line competes for the agent's attention. Write **the smallest body that still routes correctly**: 400 lines is a ceiling, not a target, and there is no floor — a skill that does its job in 60 lines beats the same skill padded to 200. Push anything long, reference-like, or rarely-needed into `references/<topic>.md` and link it inline at the point of use ("full table → `references/foo.md`").

Decide where a paragraph lives:

| Put it in the body when… | Move it to references/ when… |
| --- | --- |
| The agent needs it on *every* run | It is needed only in a specific branch |
| It is a rule, a gate, or a decision point | It is a long table, a catalog, or a template |
| It is short and load-bearing | It is reference detail that would bloat the body |
| Cutting it would change behavior | It is an example that illustrates but does not instruct |

Every file under `references/` must be linked from the body. An unlinked reference is never loaded, so it is dead weight in the package — link it or delete it.

## The hybrid structure — when each piece earns its place

- **SKILL.md** — always. Frontmatter + focused body.
- **references/** — only when the body genuinely needs offloaded depth. Do not create an empty `references/` to look complete; a single-file skill is fine.
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
2. **Draft the description.** Per the rules above. This first, because writing it forces the scope clear. → `references/description-recipe.md`.
3. **Outline the body.** Method, rules, decision points. Mark what becomes a reference.
4. **Write the body** in the rsc voice (see below). Tag every code/example fence with a language. Add a checklist or decision table *only where the flow actually branches* — not as decoration. Add a short anti-patterns table.
5. **Extract references** for anything long or branch-specific, and link each one inline.
6. **Write the evals** — `cases.yaml` then `README.md`. → `references/eval-authoring.md`.
7. **Wire it into the rsc plumbing** (`tags`, `recommends`, `npm run manifest`, and indexing any artifact in `02-DOCS/wiki/index.md` — the Knowledge map; root `CLAUDE.md` keeps only a short pointer). → `references/rsc-conventions.md`.
8. **Self-audit against the rubric** (below). Fix every miss or justify it.

## The rsc voice

Match the catalog, do not invent a new register:

- Direct, second-person-to-the-agent instruction ("Read the profile first", "Cut any section with no job").
- A rule gets stated where it applies, with a one-line *why* that makes it obviously absolute — not a lecture, and not a shouted NON-NEGOTIABLE.
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
| **Discipline** — the agent knows the rule but skips it under pressure (time, sunk cost, "just this once") | **The rule stated at the step it governs, with its why** — plus one row in the anti-patterns table | A rule in an appendix is skimmed; a rule in context is followed. "Do not ship a failing test — a red test merged is a lie in the suite", written at the ship step. Do not build a separate rationalization bank restating rules already in the flow; it is paid for on every load and read as decoration. |
| **Wrong-shaped output** — tone, verbosity, format, structure come out wrong | **Positive recipe / contract** (show the target shape) | A prohibition ("don't be verbose", "no marketing fluff") makes it *more* likely — the model fixates on the banned shape. Give the shape to hit instead: "Reply in ≤3 sentences, lead with the verdict." Demonstrate, don't forbid. |
| **Omitted element** — the agent forgets a required piece | **Required structural slot** (a checklist item or a template field it must fill) | You can't prohibit an absence. Make the slot mandatory so its emptiness is visible — a `Done-of-done` checkbox, a template section, a result-envelope field. |
| **Conditional behavior** — right action depends on the situation | **Predicate-keyed conditional** ("When X → do Y; otherwise Z") | A flat rule fires in the wrong context. Key the behavior to its trigger so the agent branches correctly instead of over- or under-applying. |

So: an anti-patterns table earns its place when it names concrete **failure modes** the flow above
does not already state. A table that re-lists rules from the body is pure cost — delete it and move
each rule to its step. And when you catch yourself writing "don't make it X" about the *shape* of an
output, rewrite it as the shape to hit.

## The best-practice rubric (audit before shipping)

A skill ships only when every box is checked or a miss is consciously justified.

- [ ] **Frontmatter parses** as YAML; `name` matches the directory `<id>`; `origin: risco` present.
- [ ] **Description** third-person, `Use when…` lead, an explicit `NOT … (that is sibling)` boundary naming a real sibling, ≤ 350 chars target / ≤ 1024 hard limit — judged on discrimination against the nearest sibling, not coverage.
- [ ] **One job.** The body never drifts into a second skill's territory; it delegates instead.
- [ ] **Body ≤ 400 lines** — a ceiling, not a target, with no floor. Long/branch-specific material lives in `references/`.
- [ ] **Every `references/` file linked** inline from the body; none orphaned.
- [ ] **Every fence language-tagged**; no placeholder/TODO prose; examples concrete.
- [ ] **Checklist/decision table only where a flow branches**; an **anti-patterns table** present, naming failure modes rather than restating rules.
- [ ] **Accompaniment dial honored** — reads the profile, adapts verbosity.
- [ ] **Artifacts under `02-DOCS/wiki/`** and indexed in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer), if the skill produces any.
- [ ] **Concrete tooling delegated** to the stack skills rather than reinvented.
- [ ] **evals present** — `cases.yaml` (≥5 `should_trigger` incl. non-obvious, ≥4 `should_not_trigger` each with a real-sibling `route_to`, ≥1 `capability` with a `must_include` rubric) + an honest `README.md`. `scripts/eval-lint.sh` passes — but it only checks presence and the counts (≥5/≥4/≥1) and that those keys are lists; the `route_to`-points-at-a-real-sibling, non-obvious phrasings, and `must_include` quality are yours to verify here, not the linter's.
- [ ] **verify.sh** present iff the skill has a checkable artifact; process skills rely on evals.
- [ ] **Every `must_include` item discriminates** — answerable by the scenario's task, plausibly caused by the skill and plausibly missed without it. An item *both* arms fail measures nothing and lowers the absolute; it has turned a real PASS into a FAIL here. → `references/eval-authoring.md`.
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

## Anti-patterns

| Failure mode | Reality / fix |
| --- | --- |
| Description written last, once the body is done | The description is *why the body ever runs*, and drafting it first forces the scope clear. Write it first, to bar. |
| Description padded for coverage — more phrasings, more languages, more verbs | It is in context on every turn, invoked or not. Prune until it discriminates against the nearest sibling and stops. |
| One skill covering specify + plan + implement | Multi-job skills trigger fuzzily and teach poorly. One skill, one job — split it. |
| Body grown past ~400 lines "because the topic is rich" | The agent skims what it cannot hold. Extract a reference and link it inline. |
| A `references/` folder added to look thorough, or a reference nothing links to | An unlinked reference is never loaded — dead weight in the package. Link it at point of use or delete it. |
| Evals skipped: "I'll just test it by hand once" | Unverifiable = does not ship. Write `cases.yaml`, near-misses with `route_to` included. |
| `verify.sh` added to a process skill for rigor | A process skill has no artifact to grep. Its rigor is the capability eval. |
| `../foo/SKILL.md` linked to something not in this repo | A dead link is a defect. Verify the directory exists under `skills/`. |
| Another catalog mirrored wholesale ("it's basically superpowers' writing-skills") | Mine the idea, write it in the rsc voice. Copied artifacts or phrasing are a defect. |

## Project grounding (02-DOCS + CLAUDE.md)

When authoring produces a durable design note (a skill's scope decision, a description rationale worth keeping), persist it under `02-DOCS/wiki/sdd/` and index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer), per the `../harness/SKILL.md` convention — never a stray file at the repo root. The skill's own `evals/` is the executable record of intent; the wiki note is the human-readable why.
