# Signature & Craft — manufacturing the distinctive idea, then the finish that sells it

A page that obeys every constraint in this skill and still feels generic is the default failure mode.
Constraints get you to *competent*. They do not get you to *premium*. The difference is a **visual
concept** — one defensible idea the whole surface commits to — plus the **craft moves** that make the
rendered artifact read as authored rather than assembled. This reference is the method for both. Use it
whenever the output has to be genuinely good, not merely compliant.

## Why compliant output still scores ~7.7

The checklist tells you the page *ships*. It cannot tell you the page is *good*, because every defect it
catches is an absence (no missing `<h1>`, no `transition: all`, contrast passes). Premium is a presence:
a point of view. The common shortfalls that keep correct work at "competent" are predictable — fix these
and the output moves up a band:

| Symptom of generic output | Root cause | The move |
| --- | --- | --- |
| "Looks like a nice template" | No visual concept; defaults filled every slot | Commit to ONE signature idea (below) |
| Tonally flat — everything medium-sized | No scale contrast; safe type ramp | Force a dominant element 3–5× the body (below) |
| Sections blur into one stripe | No rhythm; identical `py`, identical card grids | Vary section format + background + density (below) |
| Hero is a centered headline + gradient | The default the model reaches for under-specified | Show the product doing the job; earn the layout |
| Correct but forgettable color | Brand hue used like everyone's brand hue | One owned accent move, applied with restraint |
| Everything is rounded cards on white | One container idiom repeated | Mix surface treatments; let some content breathe edge-to-edge |

## Step 1 — Choose a visual concept (do this before any markup)

A visual concept is a single sentence the entire page can be checked against. It is NOT a color or a font;
it is an organizing idea that dictates layout, type, color, motion, and imagery together. Write it down,
then make every section answer to it.

> Concept = `[adjective of feeling]` + `[structural metaphor]` for `[audience doing job]`.
> e.g. "Quiet, instrument-panel precision for ops engineers who live in this all day."
> e.g. "Confident editorial broadsheet for a brand that wants to feel like a publication, not an app."
> e.g. "Tactile, mechanical-keyboard heft for a dev tool that should feel engineered."

Pick the concept from the DIRECTION BRIEF + brand study + research exemplars — never from your prior. If
you cannot say in one sentence what makes this surface different from the median SaaS page, you have not
chosen a concept yet, and the output will default to generic.

**Name the default and its opposite before you pick.** Write down the page this category always ships,
then its predictable inverse (the dark neon dev tool → the cream editorial dev tool). Picking the inverse is
still a rut. Draw candidates from the audience's own world (the publications they read, the places they
work, the artifacts and graphic traditions of their trade), not from the product name's literal metaphor.
A working product does not have to look like the tools its users operate.

## Step 1b — When the brief is open, offer directions, not skins

In Create or Replace with no direction settled, turn the strongest material into **two or three complete
directions**. Each one states: its thesis, its palette and type, the first viewport, the path a visitor
takes, its signature interaction, how it reaches the other screens, and an honest risk. Compare them on
audience fit and product clarity, not novelty. A runner-up may tighten the winner's discipline (its grid,
its density, its palette commitment); it does not donate decorative motifs. One world owns the result.

Get the user's choice before committing a new identity; an explicit "you choose" counts. A familiar,
category-standard direction is legitimate when chosen: execute it fully instead of smuggling quirks into
it. After two rejected rounds, stop generating and ask which quality is missing. Showing the options as
images or live variants is `../../variant-explorer/SKILL.md`'s job; the target that follows is
`visual-target.md`.

Adapted from [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus (Apache-2.0); wording ours.

## Step 2 — Manufacture the signature element (the "ONE idea")

Every premium page has one element you would describe first to a friend. The brief asks for it; this is how
to actually generate it instead of defaulting to a gradient. Pick **exactly one** primary signature (a
second, quieter echo is fine; three competing signatures is noise). Choose from this vocabulary, biased by
the concept and domain:

- **A hero that demonstrates, not describes** — the product mid-task: a real terminal session, a live
  chart updating, an actual diff, a populated dashboard. The single highest-leverage move for dev tools and
  SaaS; it passes the 5s test by *showing* the value instead of claiming it.
- **An owned type moment** — one oversized display setting (a 96–160px headline, a tight-tracked all-caps
  eyebrow, a serif/grotesk pairing with real contrast) that no template ships by default.
- **A structural signature** — an unexpected but legible layout: a horizontal-scroll feature rail, an
  asymmetric split hero, a numbered editorial index, a sticky side-rail that tracks the section.
- **A material signature** — a consistent, restrained physical treatment: hairline grid lines, a single
  grain/noise pass, a duotone photographic style, a precise mono-spaced data aesthetic.
- **A motion signature** — one purposeful move that recurs (a scroll-driven reveal cadence, a hover that
  uncovers state) — only if it earns its INP/CLS budget.
- **A data/proof signature** — a real number rendered as the visual centerpiece (a live metric, a benchmark
  bar, a before/after). Strongest when the proof IS the product's claim.

Rule: the signature must be *true to the product*. A fintech dashboard's signature is precision and density;
a creative tool's is expression. A signature borrowed from the wrong domain reads as costume. Cite which
research exemplar inspired the move (e.g. "feature rail per linear.app/changelog") so it is grounded, not
invented.

## Step 3 — Force scale contrast (the fastest fix for "flat")

Generic pages are tonally flat: the headline, the section titles, and the body are all within ~1.5× of each
other, so nothing dominates and the eye has nowhere to land. Premium pages have a **dramatic range**.

- Establish a clear **hero dominant**: the largest single element on the page (a headline or product visual)
  should be **3–5× the body size**, not 2×. Commit to it.
- Then **demote ruthlessly**: eyebrows, labels, and metadata go *smaller and quieter* (13–14px, muted,
  tracked) than you instinctively want. Contrast is created by the small things being genuinely small.
- One **focal point per viewport**. If two things compete for "biggest", neither wins — shrink one.
- Apply the same logic to weight (one heavy display weight against a regular body), and to color (the 10%
  accent appears once or twice per viewport, never spread thin).

If a section feels flat, the fix is almost always *more* contrast, not more elements.

## Step 4 — Give the page rhythm (sections must not blur)

A landing page that is ten identical white sections with `py-24` and a 3-up card grid reads as one long
stripe. Authored pages have a **beat**: the eye is paced. Vary, section to section, at least one of:

- **Format** — full-bleed vs. contained; centered vs. asymmetric; grid vs. single statement; media-left vs.
  media-right (alternate, don't repeat one side).
- **Background** — alternate base / subtly tinted / inverted (a dark section between two light ones is a
  classic rhythm device and creates a natural CTA anchor).
- **Density** — a breathing, near-empty statement section after a dense feature grid resets the eye.
- **Container idiom** — don't make *everything* a bordered card on white. Let a hero visual run edge-to-edge;
  let one statement sit in open space with no container at all.

Spacing rhythm is load-bearing here: section padding should step on the scale (e.g. 64 → 96px), and the
*gap between sections* should be visibly larger than the gap *within* a section, so groups read as groups.
A flat `py` on every section is the tell of generated output.

## Step 5 — The craft finish (compounding micro-decisions)

These are in the SKILL's "Premium details" table; apply them as a deliberate pass, not by accident:

- Concentric radius (`outer = inner + padding`); never same-radius nesting.
- Layered transparent OKLCH shadows; hairline `fg/10` borders for separation, shadow only for true float.
- `text-wrap: balance` on headings, `pretty` on body; `tabular-nums` on any changing number/price.
- Optical alignment: trust the eye over the math for icon centering and cap-height padding.
- Restraint: glass on floating surfaces only; gradient as seasoning on one surface; one accent, used rarely.

## Step 6 — Self-critique before you claim done (the senior-designer pass)

Before shipping, interrogate your own output with the questions a senior designer would ask in a crit. Answer
them honestly in your own head (or out loud to the user); if any answer is weak, iterate before delivering.

1. **What is the one idea here?** If you cannot name it in a sentence, there is no concept — go to Step 1.
2. **Would this place on Awwwards / Godly, or just pass review?** If "just pass", it is at ~7; name the
   single most generic element and replace it.
3. **What's the most generic thing on this page right now?** (Usually: the hero, the gradient, the 3-up card
   grid, or the stock-feeling copy.) Fix that one thing first — it has the highest leverage.
4. **Where does the eye land first, and is that the thing that should win?** If not, fix scale contrast.
5. **If I deleted the logo, would anyone know whose product this is?** If not, the concept/signature is too
   timid.
6. **Does every section earn its place, or is one there out of habit?** Cut the weakest section entirely;
   removal is a design decision.
7. **Is the copy carrying a specific, verifiable claim, or vibes?** Swap one vague benefit for a concrete,
   quantified one.

The point of the pass is not to pass it — it is to make at least one concrete change as a result. A surface
that survives this crit unchanged on the first try usually means the crit was not honest.

## Worked example — generic → signature (dev-tool hero)

**Generic (≈7, competent):** centered `<h1>` "Ship faster with our developer platform", subhead, two buttons,
purple→blue gradient blob behind it, 3-up feature cards below, all sections `py-24` on white.

**Signature (≈9, premium):**
- *Concept:* "Engineered precision — this tool should feel like instrumentation."
- *Signature element:* the hero IS a live, syntax-highlighted terminal session running the actual command,
  output streaming — the product demonstrates the value (Step 2, "demonstrate not describe").
- *Scale contrast:* a tight-tracked 13px mono eyebrow ("v2.4 — now with preview environments"), a 72px
  display headline with one concrete claim ("Spin up a preview in 4s"), demoted everywhere else (Step 3).
- *Rhythm:* light hero → dark proof section with a real benchmark bar → light asymmetric feature split
  (media alternating sides) → dark final CTA (Step 4).
- *Finish:* hairline grid lines as the material signature, mono `tabular-nums` on the benchmark, concentric
  radius on the terminal chrome, one accent used only on the active prompt and the primary CTA (Step 5).
- *Crit result:* "the live terminal" is the one idea; logo-removed it still reads as this product; eye lands
  on the streaming output, which is the value (Step 6 passed honestly).

Same constraints, same tokens, same stack — the difference is concept + signature + contrast + rhythm +
honest crit. That is the gap between 7.7 and premium.
