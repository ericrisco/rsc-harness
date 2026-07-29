---
name: presentations
description: "Use when building, theming, or exporting a presentation deck — pitch, sales, keynote, board/QBR, leave-behind one-pager — from slide structure to a token-based theme to PDF or editable PPTX (Marp, Slidev, python-pptx). NOT the words (that is `marketing`), NOT the visual tokens (that is `design`), NOT the investor story arc (that is `pitch-deck`)."
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

Also out of scope: a web-native, scroll/animation-heavy **landing page** (that is
`../design/SKILL.md` + `../nextjs/SKILL.md`); a **video / motion explainer** as the deliverable — this
skill uses motion only as restrained slide transitions and builds, never as the medium; and the live
financial *model* behind an investor deck — this skill renders the slides and cites the model as the
source of truth.

## Brand grounding (gate — clears before the first headline)

**Never produce deck copy or a deck narrative without a complete brand study.** A deck is the brand on
stage: generic slides read as "another AI deck" the moment they hit the projector, and the only cure is
grounding every headline, claim, and tone choice in a real, persisted brand profile. This is the same
gate `marketing` and `design` enforce — decks share the study, they do not fork it.

1. **Locate the brand study.** Read the project's root `CLAUDE.md` for a `## Brand & voice` section linking into `02-DOCS/wiki/brand/` (the `harness` Karpathy-wiki convention: compiled brand articles under `02-DOCS/wiki/brand/`, raw inputs the user pastes under `02-DOCS/raw/brand/`). No `CLAUDE.md`, no link, or a link that points nowhere = ABSENT.
2. **Check completeness** against the checklist in `references/brand-grounding.md` — it extends the shared brand checklist with **deck-specific** dimensions: deck purpose, audience & setting, length, presenter-vs-leave-behind, and must-include slides. Any empty dimension = INCOMPLETE.
3. **If ABSENT or INCOMPLETE, STOP and interview the user** — one focused batch at a time, never all questions at once. Voice samples are mandatory; never fabricate a voice. Then persist: write/update the brand study under `02-DOCS/wiki/brand/` (raw inputs verbatim under `02-DOCS/raw/brand/`), and add/update the `## Brand & voice` link in root `CLAUDE.md`. Exact format → `references/brand-grounding.md`.
4. **Only once the study is complete, proceed** — and cite which articles drove the deck (e.g. "narrative grounded in `02-DOCS/wiki/brand/value-proposition.md`, voice in `voice.md`").

Single exception: if the user explicitly says "skip it, rough draft", you may produce a clearly-labelled
`DRAFT (ungrounded — not brand-checked)` and still recommend running the gate before it ships.

## Design the message before the pixels

A deck is a *communication* artifact, so the design that matters most is the message design. Everything
below descends from **audience-centered design** — every choice serves the audience's understanding, not
the presenter's comfort.

**Plan the message (six questions).** Lock these before storyboarding: (1) who *specifically* is the
audience and what do they already know; (2) the ONE main message they remember a week later; (3) the 3–5
supporting points that carry it; (4) the evidence proving each; (5) the single call-to-action; (6) what is
essential vs. expandable under time pressure. These feed the deck arc directly: message = thesis, points =
beats, CTA = closing ask (→ `references/storytelling-and-decks.md`).

**Assertion-evidence is the slide unit.** Each slide = one assertion (a complete claim, written as the
title) + the visual evidence that proves it — never a topic label over a bullet list. *"User engagement rose
43% after the redesign"* + a chart, not *"Engagement"* + three bullets. The body proves the headline; it
never repeats it.

**One concept per slide.** Working memory is small and the audience is also listening to you. If a slide
needs two breaths to explain, it's two slides. Reveal sequential parts progressively — build order *is* the
explanation — rather than dumping everything at once.

**Spoken vs. shown — never both.** The slide and your mouth are two channels; redundancy wastes both. *Show*
the assertion, the visual, the number, the next step; *say* the elaboration, the context, the interpretation,
the story. Reading slides verbatim is the fastest way to lose a room.

Full frameworks — the planning questions, the spoken/shown table, the **1–5 evaluation rubric**
(audience-centered / visual clarity / cognitive load / accessibility), the implementation checklist, and the
communication anti-patterns — live in `references/slide-design.md`. Score any draft against the rubric (≥ 4
on each axis) before shipping.

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

- **Benefit-led, climbing feature → benefit → proof**, stopping at the rung the audience cares about. Specificity (a number, a mechanism, a receipt) beats adjectives — "2× faster" not "blazing fast".
- **Two text densities, chosen deliberately:** *presenter* slides carry a headline + one visual + 0–3 support points, with the argument in the speaker notes / your mouth; *leave-behind* slides are self-contained because no one is narrating. Never ship a wall-of-text presenter slide.
- **Voice from the brand study.** Headlines obey the do/don't word lists and tone samples. Ban-list words ("revolutionary", "seamless", "game-changer", "supercharge") are defects.

## Visual system for slides (with `design`)

The deck's pixels are the brand's design system projected at 3 metres. Defer the *system* to
`../design/SKILL.md`; this skill enforces the deck-specific constraints (full depth →
`references/slide-design.md`):

- **Layout grid** built for 16:9: a 12-column grid, generous margins, one focal point per slide, consistent safe-area so nothing clips on a projector.
- **Type scale for projection**, not laptop reading distance: display/headline/body/caption steps, body ≥ 24pt (≥ 28–32pt for talks), ~6 words/line and ~6 lines/slide as a ceiling, contrast ≥ 4.5:1. Never drop below the legibility floor to cram text — split the slide instead. If it doesn't read at 3 metres, it doesn't ship.
- **Color from tokens, allocated for a room:** dark themes read better in dark rooms / on big screens, light themes for printed handouts and bright rooms. High contrast always; never rely on color alone to encode meaning.
- **Data viz that makes one point:** one chart = one takeaway named in the headline; remove gridlines/clutter; label directly; pre-attentive emphasis (one highlighted bar/line) over rainbow palettes; never a 3-D pie. Every number traces to a source — mark gaps `[[NEEDS PROOF]]`, never fabricate one to fill a chart.
- **Imagery** full-bleed and intentional (with a legibility scrim behind text), not stocky decoration; respect resolution so it doesn't pixelate on a 4K projector.
- **Motion with restraint:** one transition family, ≤ 300ms, builds that reveal one idea at a time; reduced-motion honored in HTML pipelines. Animation explains sequence/state change, never just fills time.

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

Run before claiming done — each line is a defect if unchecked. `scripts/verify.sh` automates the
mechanical subset.

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

## Project grounding (02-DOCS)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) Karpathy wiki), read
`02-DOCS/wiki/stack/presentations.md` first and stay consistent with it; create or refresh it when
missing or stale, and index it in `02-DOCS/wiki/index.md`. It records this project's real choices: the
chosen pipeline (Marp / Slidev / python-pptx) and why, the theme file path and how it maps the design
tokens, the standard deck arc(s), export commands and the canonical output, the presenter-vs-leave-behind
convention, and font-embedding / asset-location notes.

The deck theme is downstream of the design tokens: always reconcile that article with
`02-DOCS/wiki/stack/design.md` so the deck and the product share one palette and type system.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Unlike the brand study, deck
conventions are *recorded, not gated* — never block the task on this.
