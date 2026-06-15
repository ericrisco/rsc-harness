---
name: continuous-learning
description: "Use when something went wrong, got corrected, surprised you, or otherwise taught the workspace something and you want it to stick — a retro or postmortem after an incident or sprint, the same agent mistake corrected 2+ times, a wrong assumption that just surfaced, a resolved bug worth never repeating, or scattered notes-to-self that need a durable home. Triggers: 'run a retro', 'capture this lesson', 'write this down so we don't repeat it', 'you keep doing X — make it stop for good', 'harvest the corrections and notes-to-self into wherever they belong', 'guarda esta lección para que no vuelva a pasar', 'apúntalo para no repetir el error'. NOT capturing a forward design choice with alternatives (that is decision-records)."
tags: [learning, retro, postmortem, feedback-loop, knowledge, meta]
recommends: [decision-records, author-skill, debug, harness, knowledge-ops]
origin: risco
---

# Continuous learning — the feedback loop of the harness

This is the engine that makes the system get better every time it is wrong. When something broke, got corrected, surprised you, or simply taught the workspace something, your job is to **catch that lesson and route it back into the durable apparatus so the same mistake cannot recur**.

One premise is load-bearing: **a lesson that lives only in chat is gone at the next compaction.** Verbal reflection only changes future behaviour when it is persisted to memory the agent actually reads next time (this is the Reflexion mechanism — self-reflection written to durable memory, not held in the conversation). In this harness, "memory" is a concrete set of surfaces: a `SKILL.md` body, `02-DOCS/wiki/harness/decisions.md`, `02-DOCS/wiki/harness/user-profile.md`, a root `CLAUDE.md` rule, or a `verify.sh` check. **Chat is not memory.** A lesson is "captured" only when it has landed in one of those.

You sit between three siblings. `harness` self-improves the *wiki*. `decision-records` captures *forward* choices (we will do X, here is why). You capture *backward* lessons — what we now know that we didn't, and the cheapest durable place to keep it from biting again. You do not own the craft of editing skills (that is `author-skill`) and you do not diagnose bugs in the moment (that is `debug`); you run *after* debug resolves and harvest the root cause.

## Read the user profile first

Before you narrate anything, read `02-DOCS/wiki/harness/user-profile.md` for the **accompaniment dial**, same convention as every harness skill:

- **L0** — capture the lesson silently, land the durable write, move on. No play-by-play.
- **L1–L2** — state the root cause and the home in a line or two.
- **L3** — walk the root-cause reasoning out loud and confirm the durable home with the user before writing.

The dial governs narration only. The capture loop runs at every level — the difference is how much you say while doing it.

## When to use

- A retro / postmortem: "what did we learn from this incident or this sprint".
- A recurring correction — the user has fixed the same agent mistake 2+ times ("you keep doing X — stop").
- A surprise: an assumption was wrong, a command failed in a non-obvious way, a provider behaved unexpectedly, an eval missed a real bug.
- After `debug` resolves: distil the non-obvious root cause into a durable note before it evaporates.
- A periodic sweep: harvest scattered corrections / TODOs / notes-to-self into their right durable homes.

## When NOT to use

- **A forward decision with alternatives** (we chose X over Y, here is why) → `../decision-records/SKILL.md`. A choice is not a lesson from a mistake.
- **Authoring/editing a skill's body, description, or evals** as the task → `../author-skill/SKILL.md`. You *decide* a lesson belongs in skill Z and hand the edit over; you do not own SKILL.md craft.
- **Diagnosing the bug right now** → `../debug/SKILL.md`. You come after.
- **Generic doc/wiki consolidation or inbox sweep** → `../harness/SKILL.md` 02-DOCS engine. You produce the occasional wiki article *via* that protocol; your trigger is "we learned something the hard way", not "organise these docs".
- **Scheduling a recurring task** → `loop` / `schedule` harness CLI. You may *recommend* a cadence; you are not a scheduler.
- **Curating reference knowledge / "what do I know about X"** → `../knowledge-ops/SKILL.md`. That is reference knowledge; you handle experiential, mistake-derived knowledge.

| Situation | Owner | Why |
|---|---|---|
| "We chose Postgres over Mongo, here's the why + the rejected options" | `decision-records` | forward choice with alternatives |
| "The migration failed because Postgres rejects NULL on the PK — never assume that again" | `continuous-learning` | backward lesson from a mistake |
| "Find the bug causing the 500" | `debug` | in-the-moment diagnosis |
| "Now that debug found it, make sure we never ship that pattern again" | `continuous-learning` | post-resolution capture |
| "Write the SKILL.md and evals for pr-describe" | `author-skill` | skill craft |
| "This lesson means the deploy skill needs a new guardrail" | `continuous-learning` → hands edit to `author-skill` | decides home, delegates craft |

## The capture loop

Five steps. Run them in order; do not stop before step 5.

1. **Harvest** — pull the lesson out of chat *now*, while it is still in context. *Why:* the next compaction deletes it for free.
2. **Root-cause, blameless** — name the *system* gap: a missing rule, a wrong assumption, an under-specified skill, an absent guardrail. Never "the agent is careless" or "the user keeps forgetting". *Why:* blame indicts a person and the loop stops running; blameless framing focuses on contributing causes and keeps the retro honest (Google SRE / Atlassian blameless postmortem practice).
3. **Route to a durable home** — pick the *cheapest surface that will fire next time* (table below). Prefer the **preventative** write that kills the whole class of failure over a one-off note that just records it. *Why:* good postmortems split mitigative-vs-preventative action items, and the preventative one is what stops recurrence.
4. **Write it** — land the entry in that surface in the lesson format below. If the home is a skill body, a description, or an eval, **delegate the edit to `author-skill`** — you decide the home, it does the craft.
5. **Verify it fires** — prove the lesson is live (see "Verify it fires next time"). *Why:* learning loops do not fail at the retro, they fail *after* it — at action-tracking and trend analysis (incident.io / Rootly 2025 SRE best-practice consensus). If you cannot point to where it fires, you have not captured it.

## Routing decision table

The single most important artifact in this skill. Pick the row, write to that exact home, hand off to that writer.

| Lesson type | Durable home (exact path) | Who writes it |
|---|---|---|
| About the user (prefers X, hates Y, works this way) | `02-DOCS/wiki/harness/user-profile.md` | this skill |
| A rule we keep breaking | root `CLAUDE.md` rule, or the relevant `SKILL.md` body | `author-skill` for the skill body; this skill for `CLAUDE.md` |
| A pattern to ban | a `verify.sh` banlist/check on the owning skill | `author-skill` |
| A missed-trigger insight (skill fired wrong / didn't fire) | a `should_not_trigger` (or `should_trigger`) eval case | `author-skill` |
| A surprising fact / how a provider actually behaves | wiki article via the harness ingest protocol | `harness` |
| A forward choice that surfaced mid-retro | punt to `decisions.md` | `decision-records` |
| A one-off, low-stakes note | `02-DOCS/wiki/harness/decisions.md` append, or a topic note | this skill |

Full catalogue with hand-off recipes and a worked end-to-end example is in `references/lesson-routing.md`. The body table is enough for routine cases; read the reference when the home or the hand-off is unobvious.

## The "2+ recurrences ⇒ structural fix" rule

First sighting of a lesson: a note is fine. **Second sighting of the same class: stop noting and build a guardrail** — a `CLAUDE.md` rule, a `verify.sh` check, or a `should_not_trigger` eval. A third note proves the second note did nothing.

*Why:* this is exactly where learning loops die. Teams nail the postmortem and then fumble trend analysis — the recurring class never gets a structural fix, so it keeps recurring. The recurrence is the signal that prose has failed; answer it with a check, not another apology.

## Lesson entry format

Copy-pasteable and **situation-tagged**, so it retrieves on the trigger that matters — not as a vague blob nobody can act on (experiential memory works when entries are actionable and situation-tagged, not when they are similarity soup):

```md
## <date> — <short lesson title>
- **Situation:** <when this fires / the trigger phrasing>
- **We believed:** <the wrong assumption>
- **Actually:** <what is true>
- **Durable home:** <path + surface that now holds it>
- **Fires next time via:** <rule / eval / verify.sh / index entry in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer)>
```

The last two lines are not optional. An entry with no durable home and no "fires next time" is a chat message with a date on it.

## Verify it fires next time

This is the rigor of this process skill, and it stands in for a `verify.sh` (this skill emits no checkable artifact of its own — see below). **Acceptance: you can point to a concrete place where the lesson now changes behaviour:**

- a rule the agent reads on its next pass (`CLAUDE.md` or a skill body), or
- an eval case (`should_not_trigger` / `should_trigger`) that would have caught the miss, or
- a `verify.sh` check on the owning skill that fails on the banned pattern, or
- a `02-DOCS/wiki/index.md` entry (the Knowledge map; root `CLAUDE.md` keeps only a short pointer) pointing at the new wiki article.

If you cannot name one of those, the lesson is not captured — keep going. Prefer a surface a human can review (a rule, an eval, a profile line) over an opaque store: a single agent reflecting alone can talk itself into a local optimum, so the durable write should be legible enough for a human to sanity-check.

**This skill has no `scripts/verify.sh`.** Its output is a *routing decision plus a durable write into another surface*. The check that the lesson fires lives in *that target surface* — a `verify.sh` on the deploy skill, a `should_not_trigger` eval, a `CLAUDE.md` rule — not here. Its rigor is the capability eval, same as `decision-records`, `author-skill`, and `harness`.

## Periodic retro sweep

To harvest scattered corrections and notes-to-self on a cadence, do not reimplement a scheduler — recommend the `loop` / `schedule` harness CLI to run the sweep weekly. For pulling raw notes through `02-DOCS/inbox/` into the wiki, route the consolidation itself through `../harness/SKILL.md`; you only own the lessons that came from a mistake, not the general filing.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Lesson captured only in chat | lost at the next compaction | write it to a durable surface from the table |
| "The agent/user is bad at X" | blame indicts a person; the loop stops running | name the *system* gap (missing rule, wrong assumption) |
| Note added but it never fires | prose nobody reads next time is not a capture | attach a rule / eval / check, then verify it fires |
| Re-noting the same class a 3rd time | the 2nd note already proved prose failed | build a guardrail on the 2nd sighting |
| Hand-editing the SKILL.md yourself | you do not own skill craft | hand the edit to `author-skill` |
| Capturing a forward choice here | that is a decision, not a lesson | route to `decision-records` |
| A vague vector-blob note | won't retrieve, can't be acted on | situation-tag it in the entry format |
| Starting to diagnose the bug | that is `debug`'s job | come here *after* it resolves, with the root cause |

## Cross-references

- `../decision-records/SKILL.md` — forward choices with alternatives.
- `../author-skill/SKILL.md` — the writer for any lesson whose home is a skill body, description, or eval.
- `../debug/SKILL.md` — in-the-moment diagnosis; you run after it.
- `../harness/SKILL.md` — the wiki ingest/sweep engine and the durable surfaces you route into.
- `../knowledge-ops/SKILL.md` — reference knowledge, as opposed to mistake-derived experiential knowledge.
