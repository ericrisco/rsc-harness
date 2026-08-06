# rsc conventions — wiring a skill into the catalog

A skill is not done when `SKILL.md` reads well. It is done when it is *in the
catalog* — frontmatter valid, indexed in the manifest, discoverable by the
`npx @ericrisco/rsc` recommender, and reachable where the agent will find it. This reference
is the rsc plumbing.

## The layout (single source of truth)

```text
skills/<id>/                    ← canonical source of truth; edit here, only here
  SKILL.md
  references/*.md
  evals/cases.yaml
  evals/README.md
  scripts/verify.sh             ← only if the skill has a checkable artifact

manifest.json                   ← GENERATED catalog (build-manifest.js); never hand-edit
schema/frontmatter.schema.json  ← ajv schema every SKILL.md frontmatter must satisfy
scripts/build-manifest.js       ← skills/*/SKILL.md → manifest.json (+ --check / --validate)
scripts/eval-lint.sh            ← gates evals/cases.yaml minimums
```

Rule: **`skills/<id>/` is the only place you edit.** There are no generated skill
copies in the repo any more — the `rsc-universal` CLI copies skills into the
target IDE at install time. `manifest.json` is generated; editing it by hand is a
defect because the next `npm run manifest` overwrites it.

## Frontmatter — the catalog contract

Every `SKILL.md` frontmatter MUST satisfy `schema/frontmatter.schema.json`:

```yaml
---
name: my-skill                  # lowercase-kebab, matches the directory id
description: Use when ...        # third-person, situation + NOT boundary, ~350 chars
tags: [keyword, keyword]         # what the consult advisor searches over (≥1)
recommends: [sibling-skill]      # what the system offers to install next (real ids)
profiles: [core, full]           # optional: named-profile membership
---
```

- `tags` drive the FTS recommender — pick the words a user would actually type.
- `recommends` must reference **real skill ids**; `build-manifest.js --validate`
  fails on a dangling id.
- `profiles` is optional. `minimal` = the floor (`orient`, `suggest`, `bro`, `harness`, `init`);
  `core` = the SDD workflow; `full` = everything. Most stack skills set `[full]`
  or omit it (they are installed on demand, not by profile).

## Invocation

There are no bundles and no `/<bundle>:<id>` namespacing. Most targets install a
skill under their own rsc folder (e.g. `.codex/rsc/<id>/`), reached from that
assistant's instructions file. **Claude is the exception:** Claude Code only
discovers project skills one level under `.claude/skills/`, so rsc skills install
**flat** at `.claude/skills/<id>/SKILL.md` (a nested `.claude/skills/rsc/<id>/`
is never discovered). A skill is invoked by its `name`. The `suggest` detector is
always installed (the floor) and proposes installing any skill a task needs via
`npx @ericrisco/rsc add <id>`.

## Wiring steps for a new skill

1. **Create `skills/<id>/SKILL.md`** with valid frontmatter including `tags` and
   `recommends` (and `profiles` if it belongs to one).
2. **Add reciprocal `recommends`** where it makes sense — if `nextjs` should
   suggest your new skill, add the id to `nextjs`'s `recommends`.
3. **Regenerate the manifest:** `npm run manifest`.
4. **Validate:** `npm run validate` (ajv frontmatter + recommends integrity) and
   `npm run manifest:check` (manifest is not stale, counts match).
5. **Run the eval gate:** `bash scripts/eval-lint.sh` — must PASS for the new skill.
6. **Add an outcome label** in `scripts/lib/recommend.js` if the skill is a
   user-facing outcome (so the plain-language wizard shows a human label, not the
   bare id). Internal workflow skills don't need one.
7. **Update the README catalog** (and the harness `claude-md-template.md`
   Knowledge-map rows) if the skill introduces a new topic users should discover.

```bash
# the gates, from repo root
npm run validate        # frontmatter + recommends integrity
npm run manifest:check  # manifest is current and count-accurate
npm test                # unit + integration
bash scripts/eval-lint.sh
```

## The Knowledge map

The root `CLAUDE.md` carries a `## Knowledge map` section that indexes the 02-DOCS wiki topics — it is what every other skill reads before working in its area (the `harness` convention). When a skill produces durable artifacts, they live under `02-DOCS/wiki/<topic>/` and get a Knowledge-map row. For SDD-related artifacts the topic is `02-DOCS/wiki/sdd/`. `author-skill` writes there only when a design note is worth keeping; the executable record is always the skill's own `evals/`.

## verify.sh — only for checkable artifacts

A `scripts/verify.sh` belongs in a skill that emits something a script can *check*: code (lint/type/test), config (schema), copy (a ban-list grep). It should be read-only by default and warn rather than fail unless asked to gate. **Process skills** — judged on the behavior/safety rails they install, like the SDD-phase skills and `author-skill` itself — have no artifact to grep, so they ship **no** `verify.sh`; their rigor is the `capability` eval. Adding a hollow `verify.sh` to a process skill is cargo-culting, not rigor.

## The originality rule (hard)

The rsc catalog is its own ecosystem, not a re-skin. When mining ideas from other skill libraries, take the *idea* and re-express it in the rsc voice. Never reproduce another ecosystem's signature artifacts or phrasing: no borrowed urgency blocks ("1% chance…"), no copied rationalization-table wording, no `*-reviewer-prompt.md` file convention, no verbatim flowchart text. Git authorship on rsc commits is Eric, never the assistant. If a draft reads like it came from somewhere else, rewrite it.
