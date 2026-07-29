---
name: technical-writing
description: "Use when writing or fixing user-facing technical docs — a README, a getting-started tutorial, a how-to guide, or API/CLI/config reference — especially when a page tries to teach, explain and enumerate at once, a tutorial branches, a reference is padded with opinions, a README reads like a sales pitch, samples are stale, or weasel words have crept in. NOT an SEO blog article (that is `article-writing`), NOT the content calendar or pipeline (that is `content-engine`)."
tags: [documentation, technical-writing, diataxis, readme, docs-as-code, developer-docs]
recommends: [article-writing, content-engine, course-storytelling, translation-l10n, brand-voice, accessibility]
origin: risco
---

# Technical writing

You write the document a person reads to *use* a product or codebase: a README, a tutorial, a how-to, API/CLI/config reference. Not marketing prose, not an SEO article, not a course. The craft is mostly one decision made early and held: **what kind of doc does this reader actually need**, then writing that one kind in its correct shape.

The backbone is Diátaxis — four documentation modes, each serving a distinct need (diataxis.fr). The sentence-level rules come from the Google developer documentation style guide (developers.google.com/style). The shipping discipline is docs-as-code: docs live with the code and lint in CI.

## First move: classify the doc

Before you write a line, name the reader's need and pick exactly one mode. Mixing modes in one page is the single biggest reason docs fail readers — the learner gets buried in parameters, the expert wades through a beginner tutorial to find one flag.

| Reader is… | They want… | Mode | Shape |
|---|---|---|---|
| Learning, new, hands need holding | To *acquire skill* by doing | **Tutorial** | Linear, runnable, guaranteed to work |
| Competent, has a specific goal | To *get a task done* now | **How-to** | Goal-titled, ordered steps, no teaching |
| Working, needs a fact | To *look something up* | **Reference** | Dry, complete, mirrors the product |
| Curious, wants the "why" | To *understand* | **Explanation** | Discursive, trade-offs, no steps |

**Rule: one page, one mode.** Why: a tutorial answers "how do I start?", reference answers "what are the flags?" — a reader arrives with one question, and a page serving two answers neither well.

If a page already mixes modes, do not patch it — split it. See `references/diataxis-modes.md` for a worked split of one bad page into four.

## Tutorial

A lesson a beginner runs end to end and succeeds. You are the instructor; their success is *your* responsibility, not theirs.

- Title it for the learner's gain: "Build your first X", not "X configuration".
- State prerequisites and exact versions up top before step 1.
- Number every step. Each step produces a visible result the reader can check against.
- It must run start-to-finish on a clean machine. Test it on one.
- **No branching.** No "if you prefer Y…", no "depending on your setup". One path.
- **No explanation of why.** A learner doing 12 new things cannot also absorb design rationale. Link the "why" to an explanation page.

Bad → Good opening:

```md
<!-- Bad: assumes context, branches, explains -->
Depending on your package manager, install the SDK (we use a monorepo
because it scales better). Configure your environment as needed.

<!-- Good: one path, concrete, checkable -->
## Build your first report

You need Python 3.12+ and a free API key from example.com/keys.

1. Install the SDK:
   ```bash
   pip install acme-sdk==4.2.0
   ```
2. Save your key:
   ```bash
   export ACME_KEY="your-key-here"
   ```
   Run `echo $ACME_KEY` — you should see your key printed back.
```

## How-to

A recipe for someone who already knows the product and has a real goal right now.

- Title it as the goal: **"How to rotate an API key"**, not "API keys".
- Assume competence. Do not re-teach concepts; link to reference/explanation instead.
- Ordered steps, but the reader may adapt — state the goal so they can.
- Address one real-world task. "How to configure logging" is reference; "How to ship logs to Datadog" is a how-to.
- No tutorial hand-holding, no narrative.

Bad → Good:

```md
<!-- Bad: teaches, no clear goal in the title -->
## Logging
Logging is important. A logger has levels: DEBUG, INFO… Here is how
levels work, and then some setup.

<!-- Good: goal title, competent reader, straight to it -->
## How to send logs to Datadog
1. Set `LOG_SINK=datadog` and `DD_API_KEY` in the environment.
2. Restart the worker: `acme worker restart`.
3. Confirm delivery in Datadog → Logs within ~1 min.
```

## Reference

The technical facts, structured to mirror the product. The reader is not reading top to bottom — they are scanning for one entry.

- Dry, complete, consistent. Same structure for every entry.
- Structure follows the code: one section per command, endpoint, or config key.
- Use tables for parameters, flags, return values, and errors.
- **No opinions, no recommendations, no "you should".** Reference states what *is*. Move "which one to pick" to a how-to or explanation.
- Document every parameter, including defaults and required/optional.

```md
### `GET /reports/{id}`

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | path | string (uuid) | yes | Report identifier. |
| `fields` | query | string | no | Comma-separated fields to return. Default: all. |

**Responses**

| Status | Meaning |
|---|---|
| `200` | Report returned. |
| `404` | No report with that `id`. |
| `429` | Rate limit exceeded; retry after `Retry-After` seconds. |
```

## Explanation

Background and the "why" — context, design decisions, trade-offs, alternatives considered.

- Discursive prose, free to make connections and admit nuance.
- **Never numbered steps.** If you are writing "1. … 2. …", it is a tutorial or how-to, not an explanation.
- Free to hold an opinion and explain the reasoning — this is the *only* mode where opinion belongs.
- Title with "About…", "Why…", or a concept name. Read at leisure, not while doing.

## README recipe

The one doc everyone gets wrong by turning it into a pitch. A README lives in the top-level directory, orients a *new* reader, and at minimum says what the thing is, what it is for, and links to fuller docs (Google docguide).

Skeleton, in order: **what + why (two lines) → install → one minimal runnable example → link to deeper docs → status/license.**

Bad → Good opening lines:

```md
<!-- Bad: a sales page -->
# Acme SDK 🚀
The most powerful, blazing-fast, developer-friendly toolkit to
effortlessly supercharge your data workflows!

<!-- Good: what it is, what it's for, in two lines -->
# Acme SDK
A Python client for the Acme reporting API. Fetch, filter, and export
reports without writing HTTP by hand.

## Install
```bash
pip install acme-sdk==4.2.0
```
```

## Sentence-level rules

Apply these to every mode. Each ships clearer prose at no cost.

| Rule | Why | Bad → Good |
|---|---|---|
| Second person, imperative steps | The reader is *doing* this | "The user should run…" → "Run…" |
| Active voice | Names who acts | "The file is created by the script" → "The script creates the file" |
| Present tense | Docs describe how it works now | "This will return a list" → "This returns a list" |
| Define before use | No forward references | Spell out a term the first time, then use it |
| One idea per sentence | Scannable, translatable | Split the 40-word sentence into two |
| Cut "in order to" | It is always just "to" | "in order to deploy" → "to deploy" |
| Ban weasel/AI-tell words | They lie about difficulty and add nothing | "simply run X" → "run X" |

Banned words: **simply, just, easy, effortless, seamless, robust, powerful, leverage, utilize, in order to, blazing-fast, supercharge**. If a step is "simple", the reader either already knows it (delete the word) or does not (the word mocks them). Full banlist with replacements is in `references/diataxis-modes.md`.

## Code examples

- Minimal: the fewest lines that work. Cut every line not required to run.
- Runnable and **tested** — copy-paste it onto a clean machine and confirm. Untested samples rot and misinform.
- Language-tag every fence (`bash`, `python`, `json`, `yaml`, `ini`).
- Show expected output so the reader knows they succeeded.
- No `...` standing in for required lines. Elide only genuinely irrelevant detail, and say so.

```python
# Good: minimal, runnable, shows what comes back
from acme import Client

client = Client(api_key="your-key")
report = client.reports.get("3f9a-...")
print(report.title)
# -> "Q2 revenue"
```

## Docs-as-code

Treat docs like code, or they go stale and mislead.

- **Change docs in the same PR as the code they describe.** Dead docs are worse than no docs — they actively misinform and slow developers (Google docguide best practices).
- Lint prose in CI. **Vale** is the de-facto open-source prose linter: config in `.vale.ini` at the repo root, custom rules in a styles dir, run as a **blocking check** on every PR touching Markdown. Common rules ban "simply/just/easy" and enforce "sign in" over "log in". Used in production by GitLab, Datadog, and ING.
- Test samples and check links in CI (writethedocs.org). A broken `pip install` line in a tutorial breaks every reader.

A starter `.vale.ini`, a custom banned-terms style, and a GitHub Actions blocking job are in `references/vale-starter.md`.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| One page teaches + explains + lists params | Serves no reader well; all three are diluted | Split by mode (classify table above) |
| Tutorial that branches ("if you prefer…") | Beginner cannot judge the choice; loses the path | One guaranteed path; defer choices to a how-to |
| How-to that teaches concepts | Wastes the competent reader's time | Link to reference/explanation; just give steps |
| Reference with opinions ("we recommend…") | Pollutes a lookup with judgement | Move recommendations to how-to/explanation |
| README as a sales page | New reader still does not know what it *is* | What/why in two lines, then install + example |
| Untested or `...`-gapped code samples | They rot; reader copies a broken command | Test on a clean machine; show expected output |
| Weasel words (simply, just, seamless) | Lie about difficulty, add zero information | Delete the word; the imperative stands alone |
| Wall of text, no headings or steps | Unscannable; reader cannot find their answer | Short sentences, one idea each, real headings |

## Before you ship

- [ ] Page is exactly **one** Diátaxis mode (tutorial / how-to / reference / explanation).
- [ ] Prerequisites and versions are stated before step 1 (tutorial/how-to).
- [ ] Every code sample runs on a clean machine and shows expected output.
- [ ] No `...` hides a line the reader needs.
- [ ] Banlist is clean (`scripts/verify.sh path/to/doc.md`).
- [ ] All links resolve.
- [ ] README says what it is + what it's for + links to deeper docs.
- [ ] Doc changed in the same PR as the code it documents.

## References

- `references/diataxis-modes.md` — per-mode templates, a worked split of one mixed page into four, and the full weasel-word/AI-tell banlist with replacements.
- `references/vale-starter.md` — starter `.vale.ini`, a custom banned-terms Vale style, and a GitHub Actions job running Vale as a blocking check.

## Siblings

- SEO blog post / long-form article with schema and FAQ → `../article-writing/SKILL.md`.
- Editorial calendar, pillars, content pipeline → `../content-engine/SKILL.md`.
- Teaching a syllabus over time with narrative → `../course-storytelling/SKILL.md`.
- Brand tone and voice rules → `../brand-voice/SKILL.md`.
- Making docs and samples accessible → `../accessibility/SKILL.md`.
- Localizing finished docs into another language → translation-l10n.
