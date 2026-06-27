# The description recipe

The description is the only line the router reads on every turn to decide whether to load the skill. It is a *retrieval problem*, not a marketing problem. Write it to be matched, not admired.

## The shape

```text
"Use when <SITUATION / SYMPTOM> — <verb phrase>, <verb phrase>, <verb phrase>.
 Triggers: '<phrase>', '<frase en español>', '<non-obvious phrase>', ….
 [Optional one clause naming what it KNOWS / owns.]
 NOT <out-of-scope thing> (that is `sibling`) and NOT <other> (that is `sibling`)."
```

Four moves, in order:

1. **Lead with the situation.** The first clause is a `Use when …` that names *when in the user's day* this fires — the moment, the symptom, the pain. The router matches situations better than nouns. "Use when a skill mis-triggers" beats "skill quality tool".
2. **List concrete verb phrases.** Right after the lead, name the 3–6 things the skill actually does, as verbs ("writing a description", "splitting the body", "repairing cases.yaml"). These are dense match surface.
3. **Add a `Triggers:` phrase list.** Real phrasings a user types — quoted. Include:
   - at least one **non-obvious** phrasing (a symptom, not the skill's name): e.g. "my skill never triggers".
   - at least one **non-English** phrasing (rsc users write Spanish/Catalan): e.g. "escribe una skill".
   - the slash-command form if relevant.
4. **Close with the boundary.** One or two `NOT … (that is `sibling`)` clauses. This is not optional decoration — negative space is what stops the skill from hijacking adjacent turns. Name the *real* sibling that owns the excluded job.

## The hard constraints

- **≤ 1024 characters.** Count them. Over budget = trim verb phrases and trigger duplicates first, never the boundary.
- **Valid single-line quoted YAML.** The description is one physical line wrapped in double quotes. No raw newlines inside the value. Avoid characters that break YAML in double quotes; if you need an apostrophe inside, it is fine (single quotes are literal inside double-quoted YAML). Never put an unescaped `"` inside.
- **Third person, present tense.** The agent reads *about* the skill. "Use when…", "Triggers on…", "Knows…". Never "I", never "you should".
- **State triggers and boundary — never the workflow.** The description says *when* to fire and *what it is not*. It must **not** summarize the procedure the body owns (the steps, the phase count, "does X then Y then Z"). This is not a style nit — it changes behavior. A description that pre-summarizes the steps becomes a *substitute* for reading the body: the agent acts on the summary and skips the real instructions. (Observed in the wild: a skill whose description said it runs *two* reviews made the agent run only *one*, because the summary was treated as the spec; deleting the workflow summary made the agent read the body and do both.) The verb phrases in move #2 name *capabilities* ("repairing cases.yaml"), not an ordered recipe ("first lint, then split, then validate"). If your description tells the reader how the skill works step by step, cut it down to triggers + boundary.

## Budget tactics when you blow 1024

In priority order, cut:

1. Duplicate triggers that match the same situation ("write a skill" + "create a skill" — keep one).
2. Verb phrases already implied by a trigger phrase.
3. The optional "Knows…" clause.
4. Shorten the boundary to one `NOT` clause naming the single most-confused sibling.

Never cut: the `Use when` lead, at least 3 distinct triggers, one non-English trigger, one `NOT` boundary.

## Worked before → after

**Before** (first person, no triggers, no boundary — 71 chars, would route badly):

```yaml
description: "I help you write and improve skills so they work well."
```

Problems: first person; no `Use when`; zero concrete phrasings for the router; no boundary, so it competes with `building-agents`, `specify`, and `init` on every "make a thing" turn.

**After** (third person, situation + verbs + phrasings + boundary, valid YAML, well under 1024):

```yaml
description: "Use when authoring a NEW skill or editing an existing one — writing a trigger-rich description, splitting a long body into references/, repairing evals/cases.yaml, or fixing a skill that never fires. Triggers: 'write a skill', 'escribe una skill', 'my skill never triggers', 'the description is too broad', 'audit this skill'. NOT building a product feature (that is `specify`) and NOT designing an agent loop (that is `building-agents`)."
```

## Quick test

Before committing a description, ask:

- Could the router tell from this line alone *when* to fire it? (situation present)
- Are there phrasings a real user would type, in their language? (triggers present)
- Does it say what it is **not**, naming the sibling? (boundary present)
- Does it describe *when/what-not*, and **never** the step-by-step procedure? (no workflow summary — if a reader could skip the body and act on the description alone, it leaks the workflow)
- Does it parse as YAML and fit 1024? (run the check)

If any answer is no, it is not done.

## Verify the YAML and length

```bash
python3 - "$PWD/skills/<id>/SKILL.md" <<'PY'
import sys, yaml
p = sys.argv[1]
text = open(p).read()
fm = text.split('---', 2)[1]
meta = yaml.safe_load(fm)
d = meta["description"]
assert meta.get("origin") == "risco", "missing origin: risco"
print("name:", meta["name"])
print("description chars:", len(d))
assert len(d) <= 1024, "description over 1024"
print("OK — parses, origin present, <=1024")
PY
```
