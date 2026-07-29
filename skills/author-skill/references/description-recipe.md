# The description recipe

The description is the only line the router reads on every turn to decide whether to load the skill — and it sits in context on every turn the skill is installed, invoked or not. It is a *retrieval problem*, not a marketing problem. Write it to be matched, not admired, and keep it short: length here is a cost, never a credit.

## The shape

```text
"Use when <SITUATION / SYMPTOM> — <verb phrase>, <verb phrase>, <verb phrase>.
 NOT <out-of-scope thing> (that is `sibling`) [and NOT <other> (that is `sibling`)]."
```

Three moves, in order:

1. **Lead with the situation.** The first clause is a `Use when …` that names *when in the user's day* this fires — the moment, the symptom, the pain. The model matches situations better than nouns. "Use when a skill mis-triggers" beats "skill quality tool".
2. **Name only the discriminating capabilities.** Right after the lead, name the few things the skill does that its neighbours do not, as verbs ("writing a description", "splitting the body", "repairing cases.yaml"). Stop there. Do **not** append a `Triggers: '…', '…'` phrase list: the model matches on meaning, so a keyword bank — especially one repeated in three languages — buys no routing accuracy and is charged on every turn.
3. **Close with the boundary.** One or two `NOT … (that is `sibling`)` clauses. This is not optional decoration — negative space is what stops the skill from hijacking adjacent turns. Name the *real* sibling that owns the excluded job, and verify it exists under `skills/`.

## The test: discrimination, not coverage

Do not ask "does this cover every way someone might phrase it?" — ask **"could a reader pick this skill over its nearest sibling from this line alone?"** Coverage is what tempts you to pad; discrimination is what actually routes. If two versions route the same, the shorter one is better.

## The hard constraints

- **Aim ≤ 350 characters; 1024 is the schema-enforced hard limit.** Over budget = trim verb phrases first, never the boundary.
- **Valid single-line quoted YAML.** The description is one physical line wrapped in double quotes. No raw newlines inside the value. Avoid characters that break YAML in double quotes; if you need an apostrophe inside, it is fine (single quotes are literal inside double-quoted YAML). Never put an unescaped `"` inside.
- **Third person, present tense.** The agent reads *about* the skill. "Use when…", "Triggers on…", "Knows…". Never "I", never "you should".
- **State when it fires and where the boundary is — never the workflow.** The description says *when* to fire and *what it is not*. It must **not** summarize the procedure the body owns (the steps, the phase count, "does X then Y then Z"). This is not a style nit — it changes behavior. A description that pre-summarizes the steps becomes a *substitute* for reading the body: the agent acts on the summary and skips the real instructions. (Observed in the wild: a skill whose description said it runs *two* reviews made the agent run only *one*, because the summary was treated as the spec; deleting the workflow summary made the agent read the body and do both.) The verb phrases in move #2 name *capabilities* ("repairing cases.yaml"), not an ordered recipe ("first lint, then split, then validate"). If your description tells the reader how the skill works step by step, cut it back to situation + boundary.

## Budget tactics when you are over

In priority order, cut:

1. Verb phrases that name a capability the nearest sibling shares — they add no discrimination.
2. Verb phrases already implied by the `Use when` lead.
3. Any "Knows…" / "Understands…" clause.
4. Shorten the boundary to one `NOT` clause naming the single most-confused sibling.

Never cut: the `Use when` lead, or the last `NOT` boundary.

## Worked before → after

**Before** (first person, no situation, no boundary — 71 chars, would route badly):

```yaml
description: "I help you write and improve skills so they work well."
```

Problems: first person; no `Use when`; nothing that says *when* this fires; no boundary, so it competes with `building-agents`, `specify`, and `init` on every "make a thing" turn.

**After** (third person, situation + discriminating verbs + boundary, valid YAML, ~300 chars):

```yaml
description: "Use when authoring a NEW skill or editing an existing one — writing the description that decides whether it loads, splitting a long body into references/, repairing evals/cases.yaml, or fixing a skill that never fires. NOT building a product feature (that is `specify`) and NOT designing an agent loop (that is `building-agents`)."
```

## Quick test

Before committing a description, ask:

- Could the reader tell from this line alone *when* to fire it? (situation present)
- Could the reader pick it over its nearest sibling from this line alone? (discriminates)
- Does it say what it is **not**, naming a sibling that exists? (boundary present)
- Is anything in it there for coverage rather than discrimination? (cut it)
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
