---
name: skill-scout
description: "Use when a specialized skill probably exists but is not loaded, when a task feels harder than it should because generic reasoning is doing a domain skill's job, or when auditing a workspace's skill coverage for holes. Names the absent skill and emits an install command, or routes onward when none exists. NOT routing among skills you already have (that is `suggest`), NOT writing the skill when none exists (that is `author-skill`)."
tags: [skill-discovery, capability-gap, meta, recommendations, coverage-audit]
recommends: [suggest, author-skill, context-budget, continuous-learning, knowledge-ops]
origin: risco
---

# skill-scout — find the skill you don't have

You are the **gap detector** for the skills catalog. Before a task starts — or in the middle of one that is dragging — you answer exactly one question: *is there a skill that should be handling this, and is it loaded?* You do **not** do the work. You name what to load, then get out of the way.

Every run ends in one of three verdicts:

- **INSTALLED-elsewhere** — the skill exists in the catalog and on disk somewhere (user scope, another project, a plugin) but is not active *here*. → emit a scope-fix / install command.
- **MISSING** — the skill exists in the catalog but is not installed at all. → emit an install command and a one-line why.
- **NONEXISTENT** — no catalog skill fits the task. → route to `../author-skill/SKILL.md`. Stop. Do not improvise a half-skill.

Why this matters: skills load by **progressive disclosure**. At session start Claude reads only the YAML frontmatter (`name` + `description`, ~30–50 tokens each) and pulls the body in only when a task matches. A skill that is absent — or present with a description too vague to fire — is invisible to the router. That invisibility is the gap you exist to surface.

## The decision (this is where the flow branches)

| Task signal | Verdict | Action |
| --- | --- | --- |
| Clear catalog match, not in the active set | MISSING | Emit the install command + one-line why. Then continue the task with it loaded. |
| Clear match, exists at user scope but not in this project (or vice versa) | INSTALLED-elsewhere | Emit the scope-fix (copy to the missing scope) + why. |
| 2–3 plausible candidates, none dominant | AMBIGUOUS | Name the top 2 with a one-line distinction; ask which fits. Do not guess. |
| Present skill already covers this task | NO GAP | Say so and hand to `../suggest/SKILL.md` (routing among present skills) — that is its job, not yours. |
| An installed **agent** already does this work | AGENT-COVERS | Name it, use it (delegate), propose nothing. Agents are listed by `npx @ericrisco/rsc capabilities`; they are invisible to the catalog, so a scan that skips them proposes duplicates. |
| Catalog match present but its description is too vague to ever fire | WEAK-DESCRIPTION | Treat as a gap; route to `../author-skill/SKILL.md` to fix the frontmatter. |
| No catalog id fits at all | NONEXISTENT | Route to `../author-skill/SKILL.md`. Do not fabricate an id. |

The branch you must never collapse: **MISSING vs NONEXISTENT.** Confusing them either sends the user to write a skill that already exists, or has them wait for an install command for a skill that was never authored.

## The automation gap — the trigger that fires *after* the work

Everything above is preventive: you scan *before* generic reasoning does a specialist's job. There is a second moment, and it is the opposite one — **the work is already done and delivered**, and only then you notice its shape:

> The last thing you did by hand was a **procedure**: several mostly-deterministic steps, a recognizable result, repeatable by someone else from a description, and plausibly needed again.

Then, in this order and never skipping ahead:

1. **Deliver first.** This never delays, conditions or replaces the work asked for. Raising it beforehand turns a simple request into a conversation about harness architecture.
2. **Enumerate what exists** — `npx @ericrisco/rsc capabilities` gives installed skills, catalog skills and **agent files** in one pass. Read it; do not recall it. If the command cannot run, **propose nothing** and say the check did not happen: never propose creating on a check that did not occur.
3. **Something covers it** → use it (install with the usual one-word confirm if it is catalog-only), and **propose nothing**. Proposing to build what already exists is the worst outcome available here — it costs attention and it spends the credibility of every later suggestion.
4. **Nothing covers it** → one sentence at the end of the work: the procedure you saw, and whether it fits as a skill or an agent. Then stop; the user decides. Their "no" ends it for this procedure for the rest of the session.
5. **Record it either way** — `npx @ericrisco/rsc capabilities gap-log --procedure "<what YOU observed doing>" --verdict <covered-installed|covered-catalog|covered-agent|proposed-accepted|proposed-declined>`.

**The privacy boundary is yours to hold**, not the command's: `--procedure` carries *your* description of the work you did. Never the user's words. The test: if the line could be reconstructed from what they typed, it does not belong in the log.

**Silence is a correct and common outcome.** A one-off, an exploration, a one-liner, or work that failed is not a procedure — a procedure is extracted from something that worked. There is no switch to turn this off, which is exactly why the bar is high: propose on everything and the feature becomes noise a user cannot escape.

### Skill or agent

Decided by the nature of the work, never its size:

| | Fits a **skill** | Fits an **agent** |
| --- | --- | --- |
| Shape | Knowledge + procedure that must **fire at the right moment**, in the conversation, user present | Work you want to **delegate**: its own context, possibly in parallel, possibly another model |
| Tell | "Whenever X comes up, do it this way" | "Go do X and come back with the result" |
| Build with | `../author-skill/SKILL.md` | `../building-agents/SKILL.md` |

When both fit, name the cheaper one to try and say the other is possible. When it is genuinely ambiguous, ask instead of choosing. On a target with no file-based agents (`capabilities` says so), the agent option does not exist — do not offer it.

## Symptoms that the task should have a skill

Watch for these. Any one is enough to run a scan:

- **Reinventing a known workflow** — you are about to hand-derive steps for something the catalog names (auth flows, webhook verification, RAG retrieval, invoice generation).
- **Generic prose where a domain skill exists** — your answer reads like a Wikipedia summary of a domain we have a dedicated skill for. The skill would carry it; you are carrying it raw.
- **Repeated manual steps** — the user says "I do this lead-gen sequence by hand every week", "cada semana repito esto". A recurring pattern is a skill-shaped hole.
- **The task literally names a catalog domain** — "Stripe webhook", "Postgres migration", "Next.js route handler". If the noun is a catalog id, check whether the skill is loaded before you type another line.
- **A task feels harder than it should** — friction is a signal. Generic reasoning straining against a problem a specialist would walk through is the clearest tell.

## Matching procedure

Run in order. Precision here is the whole job.

1. **Read the catalog ids and their descriptions**, not your memory of them. The `name` + `description` frontmatter is exactly what the router sees; match against the same surface.
2. **Match on situation + symptom, not keyword.** A keyword hit is not a match. The description's `Use when …` clause and `NOT … (that is sibling)` boundary tell you whether the skill actually owns *this* situation.
3. **Score the top 1–3 candidates.** If one clearly dominates, that is your recommendation. If two are close, surface both and ask.
4. **NEVER invent an id outside the known catalog set.** Recommending a skill that does not exist is the single most damaging failure mode — it sends the user chasing a phantom. If nothing in the set fits, the verdict is NONEXISTENT, not "probably there's a `<made-up>` skill".

```text
# Bad — keyword match, wrong situation
Task: "write the launch email for our new pricing tier"
Scout: "→ install `email-deliverability`"   # 'email' keyword hit; that skill is about
                                             # DNS/SPF/inboxing, not copy. Wrong owner.

# Good — situation + symptom match
Task: "write the launch email for our new pricing tier"
Scout: "Situation = marketing copy for a launch. → MISSING: `newsletter` (or `landing-copy`
        if it's a page, not an email). Install one; here's why."
```

## Scope check

A gap is not always "never authored". It is often "present, but not *here*". Claude Code builds its available-skills list from **user scope** (`~/.claude/skills/`), **project scope** (`.claude/skills/`), plugin-provided skills, and built-ins.

- Skill present at **user scope** but this project doesn't see the body firing → it should still be available; if it isn't, check the project hasn't shadowed it.
- Skill committed to **another project's** `.claude/skills/` but absent here → INSTALLED-elsewhere; copy it into this project's scope (version-controlled with the repo) or install at user scope.
- **Pick the scope by reuse breadth:** a general-purpose skill you'll want everywhere → **user scope**; a skill specific to one repo's conventions → **project scope**, committed with the code. Recommending project scope for a general skill is a smell (see anti-patterns).

## Emit the recommendation

State the verdict, the id, a one-line why, and a copy-paste install command. Three forms — pick by what the user has:

```bash
# 1) From a plugin marketplace (skill lives in a published repo)
/plugin marketplace add <user>/<repo>
/plugin install <name>@<marketplace>
```

```bash
# 2) Interactive — browse and pick scope (User = all projects, Project = this repo)
/plugin            # → Discover tab → install → choose User or Project scope
```

```bash
# 3) Direct file drop (you have the SKILL.md already)
mkdir -p .claude/skills/<id>
cp -R <source>/<id>/* .claude/skills/<id>/   # project scope; ~/.claude/skills for user scope
```

One why-line per recommendation, never a paragraph:

> MISSING: `webhooks` — you're about to hand-verify a signature; this skill carries replay-protection and the verify pattern. Install at **project** scope (repo-specific endpoint). `/plugin install webhooks@<marketplace>`

The full menu — marketplace mechanics, the `/plugin` browser flow, user-vs-project semantics, the `curl | tar` pattern — is offloaded → `references/install-commands.md`. Keep this body a decision tool.

## The weak-description trap

A skill can be installed and still be a gap. If its description is vague — no `Use when …`, no concrete triggers, no boundary — the router never pulls it in. It is present but invisible.

Why it bites: the body might be excellent, but progressive disclosure means the body is never read if the description doesn't fire. Treat a weak description as a coverage hole and route to `../author-skill/SKILL.md` to **fix the frontmatter**, not to rewrite the body. Do not "work around" an invisible skill by doing its job manually.

## Optional artifact — record the gap as data

When auditing coverage (not for one-off in-flight checks), append one line per gap to `skill-gaps.jsonl` so holes are auditable over time:

```json
{"task": "verify a Stripe webhook signature", "verdict": "MISSING", "recommended_id": "webhooks", "scope": "project", "reason": "hand-deriving replay protection", "date": "2026-06-02"}
```

One JSON object per line, append-only. `recommended_id` must be a real catalog id (omit it for NONEXISTENT). `scripts/verify.sh` validates exactly this: every line is well-formed JSON and every `recommended_id` is in the known catalog set — the check that catches a hallucinated id before it misleads anyone.

## Anti-patterns / rationalizations → STOP

| Rationalization | Reality / fix |
| --- | --- |
| "There's probably a `<plausible-name>` skill for this" | If it's not in the known catalog set, it does not exist. Verdict is NONEXISTENT → route to author-skill. A fabricated id is the worst failure you can ship. |
| "I'll just do the task; finding the skill is overhead" | You are the procurement step, not the worker. Doing the work yourself defeats the point — name the skill and load it. |
| "A skill is already loaded that covers this, but I'll recommend another anyway" | That's NO GAP. Hand to `../suggest/SKILL.md` (routing among present skills). Recommending over an existing skill is noise. |
| "The word 'email' is in the task, so → email skill" | Keyword ≠ situation. Match on the `Use when …` clause and the symptom, not the noun. |
| "Recommend it at project scope to be safe" | A general-purpose skill at project scope means re-installing it in every repo. Scope by reuse breadth: broad → user scope. |
| "Five skills could touch this, list them all" | One task → at most the top 1–2. Over-recommending buries the one that matters and stalls the task. |
| "The skill's there but never fires, so I'll just do it manually" | That's the weak-description trap. Route to author-skill to fix the description; don't paper over an invisible skill. |

## Hand-offs

- `../suggest/SKILL.md` — routing among the skills you already have. suggest is routing; you are procurement. If the right skill is already present, it's suggest's job, not yours.
- `../author-skill/SKILL.md` — building a new skill when none exists. You own the *exists / missing / nonexistent* decision; the moment the verdict is NONEXISTENT (or WEAK-DESCRIPTION), hand off here.
- `../building-agents/SKILL.md` — designing the agent when the gap is delegated work rather than in-conversation procedure (see *Skill or agent* above).
- `context-budget` — when the loaded set is too heavy for the window. That is token budgeting of what *is* loaded; orthogonal to finding what is *absent*. (Not yet on disk; do not link until it ships.)
- `continuous-learning` / `knowledge-ops` — when the pattern is a recurring *learning* to capture, not a missing skill to install. (Not yet on disk.)
