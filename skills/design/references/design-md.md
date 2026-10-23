# DESIGN.md: the record of the system

Adapted from impeccable's `document` by Paul Bakaus (Apache-2.0), which follows the open
`design.md` format. Rewritten and shortened.

The point: the next edit, the next session and the next tool keep the look instead of drifting back
to the model's default. Write it **after** the build, from what was actually built and measured,
never before. A rulebook written ahead of the build gets defended against reality.

## Where and when

- `DESIGN.md` at the project root, committed with the code.
- Written when a surface creates or replaces the visual system. Extending an existing surface reads
  it and does not rewrite it.
- If `02-DOCS/wiki/brand/` exists, `DESIGN.md` uses the brand's colours and faces and names that
  file as its source.

## Shape

YAML front matter holds the tokens; the body explains them.

```markdown
---
name: <product>
description: <one line: the idea sentence>
colors:
  ground: "#…"
  ink: "#…"
  accent: "#…"
  field: "#…"
typography:
  display: { fontFamily: "…", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 0.95 }
  text: { fontFamily: "…", fontSize: "18px", lineHeight: 1.5 }
rounded: { button: "0px", media: "0px" }
spacing: { margin: "24px", section: "200px" }
direction: { id: "<dealt id>", seed: <n> }
---

## Overview        the idea, the mode, the direction and why it was chosen
## Colors          roles and proportions (one ground, one ink, one accent, fields)
## Typography      the scale actually used, tracking, measure
## Layout          grid, outer margins, section rhythm, the phone composition
## Imagery         sources, crops, treatment, where credits live
## Motion          the signature move and the entrance recipe
## Components      buttons, navigation, the live thing, footer
## Do's and Don'ts the house rules this project relies on, plus any `--allow` and its reason
```

Values come from the built CSS and the inspector's measurements, not from memory.
