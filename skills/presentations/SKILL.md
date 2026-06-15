---
name: presentations
description: "Use when building a presentation deck — a pitch deck, sales deck, product/keynote talk, investor deck, board/QBR review, or a leave-behind one-pager — and you need a stunning, on-brand result exported to PDF and/or an editable PPTX. Covers two production pipelines: design-led Markdown decks (Marp/Slidev themed from the project's design tokens, exported to PDF + PPTX) and native editable PowerPoint via python-pptx (masters, layouts, native charts, tables, speaker notes). Grounds copy in the brand study and visuals in the design tokens; defers the WORDS to `marketing` and the visual system to `design`. Triggers: 'make a deck', 'build a pitch/sales/investor deck', 'slides for my talk', 'turn this doc into slides', 'export to PowerPoint/PPTX', 'Marp', 'Slidev', 'python-pptx', 'keynote deck', 'one-pager'. NOT a video skill (motion is used with restraint, not as the medium)."
tags: [presentations, pptx, slides, deck]
recommends: [marketing]
origin: risco
---

# Presentations — Stunning, On-Brand Decks (PDF + PPTX)

> Two first-class pipelines, one decision. Design-led Markdown decks (Marp/Slidev) for a deck that
> *flipa* and exports clean to PDF **and** PPTX, or native editable PowerPoint via `python-pptx`
> when the user must hand off a `.pptx` people will edit in PowerPoint/Keynote/Google Slides.
> The deck owns *structure, visual system, and export*. The **words** are `marketing`'s job; the
> **visual tokens** are `design`'s. This skill orchestrates all three into a finished deck.

## When to use / When NOT to use

**Use when:**

- Building any deck: pitch, sales, product launch, keynote/conference talk, investor raise, board/QBR review, training/workshop, internal all-hands.
- Turning an existing doc, memo, or notes into a slide-by-slide deck.
- Producing a leave-behind one-pager or executive summary alongside a deck.
- Exporting a deck to PDF (vector, fonts embedded, 16:9) or to an editable `.pptx`.
- Re-skinning / restructuring an existing deck to be on-brand and less generic.

**Do NOT use when (delegate or decline):**

- Writing the deck's *copy* in isolation (headlines, value prop, narrative voice) → that is `../marketing/SKILL.md`. This skill *consumes* that copy and lays it out.
- Choosing the brand's *visual tokens* (OKLCH palette, type pairing, spacing scale, motion personality) → that is `../design/SKILL.md`. This skill *consumes* those tokens into a slide theme.
- A web-native, scroll/animation-heavy **landing page** (not a deck) → `../design/SKILL.md` + `../nextjs/SKILL.md`.
- A **video / motion explainer** as the deliverable (Manim/Remotion, talking-head, animated short) → that is a video job. This skill uses motion only as restrained slide transitions/builds, never as the medium.
- A live financial *model* / spreadsheet (the numbers engine behind an investor deck) → that is an investor-materials/modeling job; this skill renders the *slides* and cites the model as the source of truth.

## Brand grounding (read this first)

**Hard rule: never produce deck copy or a deck narrative without a complete brand study.** A deck is the
brand on stage — generic slides read as "another AI deck" the moment they hit the projector, and the cure
is grounding every headline, claim, and tone choice in a real, persisted brand profile. This is the same
hard gate the `marketing` and `design` skills enforce; decks share the study, they do not fork it.

Run this gate before writing a single slide headline:

1. **Locate the brand study.** Read the project's root `CLAUDE.md` for a `## Brand & voice` section linking into `02-DOCS/wiki/brand/` (the `harness` Karpathy-wiki convention: compiled brand articles under `02-DOCS/wiki/brand/`, raw inputs the user pastes under `02-DOCS/raw/brand/`). If `CLAUDE.md` is absent, the link is missing, or it points nowhere, treat the study as ABSENT.
2. **Check completeness** against the checklist in `references/brand-grounding.md` (it extends the shared brand checklist with **deck-specific** dimensions: deck purpose, audience & setting, length, presenter-vs-leave-behind, and must-include slides). Any empty dimension = INCOMPLETE.
3. **If ABSENT or INCOMPLETE, STOP and interview the user** — one focused batch at a time (never dump all questions at once). Voice samples are mandatory; never fabricate a voice. Then persist: write/update the brand study under `02-DOCS/wiki/brand/` (raw inputs verbatim under `02-DOCS/raw/brand/`), and add/update the `## Brand & voice` link in root `CLAUDE.md`. Exact format → `references/brand-grounding.md`.
4. **Only once the study is complete, proceed** — and cite which articles drove the deck (e.g. "narrative grounded in `02-DOCS/wiki/brand/value-proposition.md`, voice in `voice.md`").

If the user explicitly says "skip it, rough draft", you may produce a clearly-labelled `DRAFT (ungrounded — not brand-checked)` and still recommend running the gate before it ships. That is the only exception, and it must be labelled.

## The non-negotiables

These are constraints, not preferences. Violating any one is a defect.

1. **Brand study first, then narrative, then layout, then export.** No deck before the grounding gate passes. Cite the articles you used.
2. **One idea per slide.** A slide that needs two breaths to explain is two slides. If you can't title it with one assertion, it isn't one slide.
3. **The headline IS the slide.** Write assertion headlines ("Churn fell 40% after onboarding v2"), not topic labels ("Churn"). The audience reads the headline; the body proves it.
4. **Legible from the back of the room.** Body text ≥ 24pt (≥ 28–32pt for talks); ~6 words/line, ~6 lines/slide as a ceiling, not a target. Contrast ≥ 4.5:1. If it doesn't read at 3 metres, it doesn't ship.
5. **16:9, fonts embedded, exports verified.** PDF is vector with fonts embedded; PPTX opens clean in PowerPoint/Keynote/Google Slides. Run `scripts/verify.sh` before claiming done.
6. **Tokens, not magic numbers.** Colors, type scale, and spacing come from the project's `design` tokens (OKLCH → the deck theme), never hand-picked hex per slide.
7. **Motion with restraint.** One transition family, fast (≤ 300ms), builds reveal *meaning* (one bullet at a time), not decoration. Honor reduced-motion in HTML pipelines. A deck is not a video.
8. **No invented numbers.** Every metric on a slide traces to a source (the model, analytics, a citation). Mark gaps `[[NEEDS PROOF]]`; never fabricate to fill a chart.

## Design first (assertion-evidence + cognitive load)

Before a pipeline, a theme, or a single pixel: a deck is a *communication* artifact, and the design that
matters most is the message design. The one principle everything below descends from is **audience-centered
design** — every choice serves the audience's understanding, not the presenter's comfort.

**Plan the message (six questions).** Lock these before storyboarding: (1) who *specifically* is the
audience and what do they already know; (2) the ONE main message they remember a week later; (3) the 3–5
supporting points that carry it; (4) the evidence proving each; (5) the single call-to-action; (6) what is
essential vs. expandable under time pressure. These feed straight into the deck arc — message = thesis,
points = beats, CTA = closing ask (→ `references/storytelling-and-decks.md`).

**Assertion-evidence is the slide unit.** Each slide = one assertion (a complete claim, written as the
title) + the visual evidence that proves it — never a topic label over a bullet list. *"User engagement rose
43% after the redesign"* + a chart, not *"Engagement"* + three bullets. This is non-negotiable #3 made
concrete: the body proves the headline, it does not repeat it.

**Manage cognitive load: one concept per slide.** Working memory is small and the audience is also listening
to you. If a slide needs two breaths to explain, it's two slides. Reveal sequential parts progressively
(build order *is* the explanation) rather than dumping everything at once.

**Spoken vs. shown — never both.** The slide and your mouth are two channels; redundancy wastes both. Show
the assertion, the visual, the number, the next step; *say* the elaboration, the context, the
interpretation, the story. Reading slides verbatim is the fastest way to lose a room.

Full frameworks — the planning questions, the spoken/shown table, the **1–5 evaluation rubric**
(audience-centered / visual clarity / cognitive load / accessibility), the implementation checklist, and the
communication anti-patterns — live in `references/slide-design.md`. Score any draft against the rubric (≥ 4
on each axis) before shipping; the Deck QA gate below points back to it.

## Which pipeline? (decide before building)

Pick once, up front — switching mid-build is expensive.

| Question | → Markdown deck (Marp/Slidev) | → Native PPTX (python-pptx) |
| --- | --- | --- |
| Primary deliverable | A **stunning** deck; PDF is the hero, PPTX a bonus | An **editable `.pptx`** people will open and change |
| Who edits after handoff | You / engineering, in Markdown + Git | Non-technical stakeholders, in PowerPoint/Keynote/Slides |
| Visual ceiling | High — full CSS/HTML, web fonts, CSS grid, gradients, SVG | PowerPoint's box model; native charts/tables/SmartArt-lite |
| Theming source | Design tokens → CSS theme (OKLCH, type scale, spacing) | Design tokens → `.pptx` theme (sRGB colors, theme fonts) |
| Data viz | SVG / chart libs / images, full control | **Native, editable** PowerPoint charts (live in the file) |
| Diffable / reviewable in Git | Yes (Markdown) | No (binary) |
| Speaker notes | Yes (`<!-- notes -->` / `notes:`) | Yes (native notes pane) |
| Version control of changes | Excellent | Poor (binary blobs) |

**Default to the Markdown pipeline** for anything where "stunning" matters and the user is fine getting a
PDF (+ image-based PPTX). **Choose python-pptx** the moment the user says "I need to edit it in
PowerPoint", "the client edits the slides", "live charts", or "corporate template `.potx`". When unsure,
ask one question: *"After I hand it over, will someone edit the slides in PowerPoint/Keynote, or is a
polished PDF enough?"* You can also build in Markdown and additionally export a `--pptx` for handoff —
just warn that Marp/Slidev PPTX slides are **images, not editable text** (a key gotcha, see exports).

Deep recipes for each → `references/markdown-decks.md` and `references/pptx-python.md`.

## Workflow

1. **Ground in the brand study** (gate above). Pull voice, positioning, proof, audience.
2. **Pick the deck arc** for the purpose (pitch / sales / product / keynote / investor / QBR) from `references/storytelling-and-decks.md`. Lock the one-sentence thesis the whole deck proves.
3. **Write the slide-by-slide skeleton** — one assertion headline per slide + the proof it carries. This is a `marketing` collaboration: headlines are copy. Get the skeleton approved before designing pixels.
4. **Pick the pipeline** (table above).
5. **Build the theme from design tokens** — map the project's OKLCH palette, type scale, and spacing into a Marp/Slidev CSS theme or a python-pptx theme. (→ `references/slide-design.md`, `references/markdown-decks.md`, `references/pptx-python.md`)
6. **Lay out the slides** against the visual system: grid, type scale for projection, data-viz best practices, imagery, contrast, restrained motion. (→ `references/slide-design.md`)
7. **Produce presenter + leave-behind variants** if needed: presenter version is sparse (headline + visual, talk track in notes); leave-behind is self-explanatory (more on-slide text, appendix). (→ `references/storytelling-and-decks.md`)
8. **Export** to PDF (vector, fonts embedded, 16:9) and/or editable PPTX; handle font-embedding and file-size gotchas. (→ `references/markdown-decks.md`, `references/pptx-python.md`)
9. **Verify** with `scripts/verify.sh` (lint deck sources, dry export, import check) and the QA gate below.
10. **Record deck conventions** in `02-DOCS/wiki/stack/presentations.md` (Project grounding, below).

## Worked example — storyboard → theme → export (Markdown pipeline)

One end-to-end pass, brand study already complete. Read this once and you rarely need to round-trip the
references for a standard Markdown deck.

**1. Storyboard the spine** (assertion headlines only — read top-to-bottom, they ARE the pitch; →
`references/storytelling-and-decks.md`). Thesis: *"Onboarding v2 is why we can raise now."*

```text
1 Onboarding v2 cut churn 40%          (title)
2 One in three users never finished setup   (problem — make it ache)
3 We rebuilt the first run as one screen      (solution, one visual)
4 Activation rose 28pts in six weeks          (proof — chart, one series)
5 TAM is $12B, growing 24%/yr                 (market, stated assumptions)
6 The ask: $2M to make this the default path  (CTA — one ask)
```

**2. Theme from design tokens.** Pull OKLCH palette + type scale from `02-DOCS/wiki/stack/design.md` into a
Marp CSS theme (full theme → `references/markdown-decks.md`). The load-bearing move is mapping tokens to
variables *once*, never hand-picking hex per slide:

```css
/* @theme brand — generated from 02-DOCS/wiki/stack/design.md */
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700&family=Inter:wght@400;600&display=swap');
:root { --brand: oklch(0.62 0.19 264); --ink: oklch(0.18 0.03 264);
        --surface: oklch(0.98 0.005 264); --accent: oklch(0.74 0.17 52); }
section { background: var(--surface); color: var(--ink); font-family: Inter, sans-serif; font-size: 26px; }
h1 { font-family: Fraunces, serif; font-size: 44px; } strong { color: var(--accent); }
```

Write the spine into `deck.md` with `marp: true`, `theme: brand`, `size: 16:9`, talk track in `<!-- notes -->`.

**3. Export to PDF + PPTX** and verify fonts embed (gotchas → `references/markdown-decks.md`):

```bash
npx @marp-team/marp-cli@latest deck.md --theme ./theme.css --pdf --pdf-outlines --pdf-notes
npx @marp-team/marp-cli@latest deck.md --theme ./theme.css --pptx     # image-per-slide; NOT editable text
pdffonts deck.pdf            # every font must read 'emb yes'
./scripts/verify.sh          # lint + dry export + QA checklist
```

If the client will *edit* the slides, this is the wrong pipeline — rebuild with python-pptx (→
`references/pptx-python.md`), whose `build_deck.py` emits the same six slides as native editable shapes/charts.

## Tooling & current versions (verified 2026-06)

- **Marp** — `@marp-team/marp-cli`. Run pinned: `npx @marp-team/marp-cli@latest deck.md --pdf`. Exports HTML / PDF / PPTX / PNG / JPEG. Needs a Chromium-family browser (Chrome/Edge) or Firefox for PDF/PPTX/image export (v4 added Firefox via WebDriver BiDi as a fallback; Chrome/Edge are preferred and give the most faithful PDF). `--pptx` is image-per-slide; `--pptx-editable` is **experimental** and needs LibreOffice (`soffice`). `--notes` / a `.txt` output exports speaker notes. Node 18+. (→ `references/markdown-decks.md`)
- **Slidev** — `@slidev/cli` (Vue-based). Scaffold `npm init slidev@latest`; dev `slidev`; export `slidev export` (PDF default; `--format pptx|png`). Export needs `playwright-chromium` installed in the project (`npx playwright install chromium` or `npm i -D playwright-chromium`). PPTX is image-per-slide; notes carry over per slide. Best for code-heavy / developer talks (live code, Monaco, Mermaid, Vue components). (→ `references/markdown-decks.md`)
- **python-pptx** — `pip install python-pptx` (current major `1.x`, e.g. `1.0.x`). Pure Python, **no** Office/LibreOffice needed to write `.pptx`. Creates masters/layouts, text, tables, **native editable charts**, images, speaker notes. Cannot render to PDF itself — convert via LibreOffice `soffice --headless --convert-to pdf` or open in Office. (→ `references/pptx-python.md`)
- **decktape / Playwright** — fallback HTML→PDF for any web deck (reveal.js, custom HTML) when Marp/Slidev export isn't available. (→ `references/markdown-decks.md`)

Always pin/verify the version in the target project before generating (`marp --version`, `npx slidev --version`, `python -c "import pptx; print(pptx.__version__)"`). Tooling moves; re-check rather than trusting memory.

## Slide copy (with `marketing`)

The deck's words are conversion copy on a stage. Defer the *craft* to `../marketing/SKILL.md`; this skill
enforces the deck-specific shape:

- **Assertion headline per slide.** Not "Market", but "TAM is $12B and growing 24%/yr". The headline carries the point; the body is evidence.
- **Benefit-led, climbing feature → benefit → proof**, stopping at the rung the audience cares about. Specificity (a number, a mechanism, a receipt) beats adjectives — "2× faster" not "blazing fast".
- **Minimal text.** Presenter decks: a headline + one visual + 0–3 support points; the argument lives in the speaker notes / your mouth. Leave-behinds may carry more, because no one's narrating.
- **Two variants when both are needed:** *presenter* (sparse, you narrate) vs *leave-behind* (self-contained, sent as PDF). Same narrative, different text density — never ship a wall-of-text presenter slide.
- **Voice from the brand study.** Headlines obey the do/don't word lists and tone samples. Ban-list words ("revolutionary", "seamless", "game-changer", "supercharge") are defects.

## Visual system for slides (with `design`)

The deck's pixels are the brand's design system projected at 3 metres. Defer the *system* to
`../design/SKILL.md`; this skill enforces the deck-specific constraints (full depth →
`references/slide-design.md`):

- **Layout grid** built for 16:9: a 12-column grid, generous margins, one focal point per slide, consistent safe-area so nothing clips on a projector.
- **Type scale for projection**, not for a laptop reading distance: display/headline/body/caption steps, body ≥ 24pt, line length ~6 words, never below the legibility floor to cram text.
- **Color from tokens, allocated for a room:** dark deck themes read better in dark rooms / on big screens; light themes for printed handouts and bright rooms. High contrast always; never rely on color alone to encode meaning.
- **Data viz that makes one point:** one chart = one takeaway named in the headline; remove gridlines/clutter; label directly; pre-attentive emphasis (one highlighted bar/line) over rainbow palettes; never a 3-D pie.
- **Imagery** full-bleed and intentional (with a legibility scrim behind text), not stocky decoration; respect resolution so it doesn't pixelate on a 4K projector.
- **Motion with restraint:** one transition family, builds that reveal one idea at a time, ≤ 300ms; reduced-motion honored in HTML pipelines. Animation explains sequence/state change, never just fills time.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
| --- | --- | --- |
| Topic-label headlines ("Market", "Team") | Forces the audience to find the point | Assertion headline that states the point |
| Wall of bullets / paragraphs on a slide | Audience reads instead of listening; nothing lands | One idea, ≤ ~6 lines; move detail to notes/appendix |
| Reading the slides verbatim | The slide and the talk become redundant | Slide = the visual; you = the narration; notes = the script |
| Tiny text to fit more | Unreadable from the back; signals filler | Split into more slides; raise the floor, not lower it |
| Hand-picked hex per slide | Drifts off-brand, inconsistent | Map design tokens once into the theme |
| Rainbow charts, 3-D pies, dual axes | Decoration over meaning; misleads | One highlighted series; direct labels; honest axes |
| Generic stock photos + purple gradient | Reads as "AI deck"; no identity | Brand imagery + token palette + a real type pairing |
| Every-element animation, slow transitions | Noise; tanks pacing; nausea | One fast transition family; builds that reveal meaning |
| Exporting PPTX from Marp/Slidev and calling it "editable" | Slides are flattened images, not text | Use python-pptx when editability is required |
| Fonts not embedded in the PDF | Renders with fallback fonts on other machines | Embed fonts; verify (see exports gotchas) |
| Invented metrics to fill a chart | Destroys credibility in the room | Cite the source; mark gaps `[[NEEDS PROOF]]` |

## Quick reference

```bash
# --- Markdown: Marp (PDF is the hero; PPTX = images) ---
npx @marp-team/marp-cli@latest deck.md --theme ./theme.css --pdf            # vector PDF, fonts embedded
npx @marp-team/marp-cli@latest deck.md --theme ./theme.css --pdf --pdf-outlines --pdf-notes
npx @marp-team/marp-cli@latest deck.md --pptx                               # image-per-slide PPTX
npx @marp-team/marp-cli@latest deck.md --pptx --pptx-editable               # experimental, needs soffice
npx @marp-team/marp-cli@latest deck.md --notes notes.txt                    # speaker notes only

# --- Markdown: Slidev (code-heavy talks) ---
npm init slidev@latest                                                      # scaffold
npx slidev                                                                  # dev server (localhost:3030)
npx playwright install chromium                                             # one-time, for export
npx slidev export                                                           # PDF (default)
npx slidev export --format pptx                                             # image-per-slide PPTX

# --- Native editable PPTX (python-pptx) ---
pip install python-pptx
python build_deck.py                                                        # your generator (see ref)
soffice --headless --convert-to pdf deck.pptx                               # PPTX -> PDF via LibreOffice

# --- Fallback: any HTML deck -> PDF ---
npx decktape reveal http://localhost:8000 deck.pdf

# --- Verify before shipping ---
./scripts/verify.sh            # warn-by-default; lint sources + dry export + import check
./scripts/verify.sh --strict   # gate CI (warnings become failures)
```

## Deck QA gate

Run before claiming done. `scripts/verify.sh` automates the mechanical subset.

- [ ] Brand study located, complete, and cited (which articles grounded the deck).
- [ ] One idea per slide; every slide titled with an assertion headline, not a topic label.
- [ ] Body text ≥ 24pt (≥ 28–32pt for a talk); ≤ ~6 words/line, ≤ ~6 lines/slide; contrast ≥ 4.5:1.
- [ ] Colors / type / spacing come from design tokens, not hand-picked per slide.
- [ ] Deck follows a deliberate arc with a single thesis; opens with a hook, closes with the ask/CTA.
- [ ] Every number traces to a source; gaps marked `[[NEEDS PROOF]]`, none invented.
- [ ] Charts each make one point, named in the headline; no 3-D/rainbow/dual-axis clutter.
- [ ] Motion is one restrained family (≤ 300ms); reduced-motion honored (HTML); builds reveal meaning.
- [ ] Presenter vs leave-behind variant chosen deliberately; presenter notes hold the talk track.
- [ ] 16:9; PDF is vector with fonts embedded; PPTX opens clean in PowerPoint/Keynote/Slides.
- [ ] PPTX editability matches the promise (python-pptx if "editable", not flattened Marp/Slidev images).
- [ ] File size sane (compressed images, subsetted fonts); ban-list words absent from copy.
- [ ] Scored ≥ 4/5 on each axis of the design rubric — audience-centered, visual clarity, cognitive load, accessibility (→ `references/slide-design.md`, "Diagnostic rubric").

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the
[`harness`](../harness/SKILL.md) Karpathy wiki), record this project's deck
conventions there and index them from the root `CLAUDE.md`, so the next agent inherits them instead of
re-deriving them.

1. **Find the article** `02-DOCS/wiki/stack/presentations.md`, indexed in `02-DOCS/wiki/index.md` (the Knowledge map index; root `CLAUDE.md` points to it).
2. **If missing or stale**, create/update it with this project's real choices — the chosen pipeline (Marp / Slidev / python-pptx) and why; the theme file path and how it maps the design tokens (`02-DOCS/wiki/stack/design.md`); the standard deck arc(s); export commands and the canonical output (PDF / PPTX); presenter-vs-leave-behind convention; font-embedding and asset-location notes — then index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it).
3. **Read it first on every use** and stay consistent; when a convention changes, update the article (bump its `Updated` date) in the same change.

The deck theme is downstream of the design tokens: always reconcile `02-DOCS/wiki/stack/presentations.md`
with `02-DOCS/wiki/stack/design.md` so the deck and the product share one palette and type system.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Like the other technical
conventions and unlike the brand study, deck conventions are *recorded, not gated* — never block the task
on this.

## See Also

- `../marketing/SKILL.md` — **the copy**: headlines, value prop, benefit-led claims, the deck's voice. This skill consumes that copy and lays it out.
- `../design/SKILL.md` — **the visuals**: OKLCH tokens, type pairing, spacing, motion personality. This skill maps those tokens into the slide theme and reads `02-DOCS/wiki/stack/design.md`.
- `../nextjs/SKILL.md` — when a "deck" is actually a web-native landing/microsite, the build belongs there.
- `../harness/SKILL.md` — the `02-DOCS` Karpathy-wiki convention the brand study and deck conventions persist into.
- References: `references/storytelling-and-decks.md` (arcs + slide-by-slide skeletons), `references/markdown-decks.md` (Marp + Slidev theming & export), `references/pptx-python.md` (python-pptx recipes), `references/slide-design.md` (visual system + data viz + motion), `references/brand-grounding.md` (checklist + question script).
