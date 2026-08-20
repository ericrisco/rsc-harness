# AI tells — the ones only a reader can catch

The mechanical tells are **not here**. `scripts/verify.sh` carries a registry of them and
flags them with file and line, so re-teaching them as prose would be paying twice for the
same rule. This file holds only what a `grep` cannot decide: presences you have to *look* at
the page to see.

Part of this corpus is adapted from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)
(MIT), whose lists came out of real production tests. The split into checkable-vs-judged, the
thresholds, and the wording are ours.

Every item below is a **default**, overridable by a brief that explicitly asks for it. What
makes them tells is that they show up *unasked*, as the model's idea of "looking designed".

## Fabricated substance

- **A product UI built out of divs.** A fake task list, fake terminal or fake dashboard
  assembled from styled rectangles is the single most reliable signature of generated work.
  Use a real screenshot, a real component, a generated image, or show nothing.
- **Hand-rolled decorative SVG.** Abstract squiggles and blobs authored inline to fill space.
  Icons come from a maintained set; decoration comes from a real asset or not at all.
- **The Jane Doe cast.** "John Doe", "Sarah Chan", egg avatars, `99.99%`, `50%`, round
  thousands, and startup-slop brand names ("Acme", "Nexus", "SmartFlow"). Real work has
  specific, slightly awkward names and messy numbers (`47.2%`, not `50%`).
- **Testimonials nobody said.** A quote with no attributable person, or five quotes with the
  same cadence, reads as filler. One real quote beats three invented ones.

## Decoration wearing the costume of information

- **Atmospheric locale strips.** A city, a timezone, a temperature in the nav or footer. Only
  earns its place for a genuinely distributed studio, a travel brand, or a physical venue.
- **Status dots with no status.** A coloured dot before nav items, list rows or badges. Keep
  it only where it reports real state, and then only once per section.
- **Invented photo credits.** `Field study no. 12 · Ines Caetano` under a stock image.
  Credit a real photographer or write a functional caption.
- **Pills laid over images.** Tags floated on top of a photo. Either the image speaks alone,
  or the caption sits below it, outside the frame.
- **Decoration strips under the hero.** `BRAND. MOTION. SPATIAL.` in small mono caps. Only
  legitimate when those words are real navigation or real status.

## Labels that say nothing

- **Poetic section labels.** "Field notes", "From the field", "On our desks", "Currently on
  the bench". Use the functional name ("Testimonials", "Latest writing") or no label.
- **Generic step labels.** "Stage 1 / Stage 2", "Phase 01 / 02". The step content *is* the
  label: "Install", "Configure", "Ship".
- **Mock-humble asides** and micro-meta sentences under a heading ("The list will stay short
  on purpose"). Eyebrow, headline, body. Nothing else.
- **"Quietly trusted by".** Say "Used at", "Customers include", or let the logos speak.

## Composition habits

- **Three identical feature cards.** The default feature row. Reach for a two-column zig-zag,
  an asymmetric grid, or a horizontal rail instead — and do not run the same split three
  sections in a row.
- **The corner floater.** A giant left-aligned headline with a small explainer paragraph
  floating in the section's top-right, aligned to nothing. Stack it, or build a real
  two-column header.
- **Rotated vertical text** and crosshair grid lines drawn only to look designed. Both are
  agency-portfolio clichés unless they organise real content.
- **A bento with empty cells.** N items means N cells, and at least two cells need real
  visual variation — otherwise it is a white card grid with extra steps.

## The second default (repetition)

Obeying every rule produces correct pages that all look the same. Before fixing type and
palette, read the project's recorded design decisions and either reuse them deliberately or
say why you are departing. Two specific defaults to distrust: reaching for the same display
serif again, and answering every premium-consumer brief with the beige/brass/oxblood family.

## Surface treatments to distrust by default

Outer glows and neon; pure `#000000` (use an off-black); oversaturated accents that refuse to
sit with the neutrals; gradient fills on large headings; custom cursors (outdated, hostile to
accessibility and to performance); glass on every surface rather than on floating ones.
