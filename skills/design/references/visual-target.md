# Visual target — image first, build it 1:1, then prove it on the render

*A direction written in prose is still a mood, and a builder fills every gap in a mood with its
prior. A target you can look at turns "premium and calm" into boxes, sizes and colours someone can
check against the render.*

The image-first path comes from Uizze's `ui-taste` (Apache-2.0); the compare loop and the evidence
rules adapt [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus (Apache-2.0). The text
is ours.

## 1. Pick the path

| Situation | Target |
| --- | --- |
| The user supplied or already approved an image | **That one.** Open it: a filename, a description or OCR is not seeing it. Do not regenerate it or reopen the direction. |
| Create, Replace or Extend, and an image tool is already connected and permitted | Generate the screen before any UI code (section 2). |
| Polish whose change is visual | A screenshot of the incumbent plus an explicit change list. Generate a constrained proposal only if a new visual is really needed. |
| Audit, one-line fix, backend work | No target. Use the running product as evidence. |
| No tool and no image | Say so, build from the brief and the system, and never claim a 1:1 match. |

Image tools in this catalog: `../../ai-media/SKILL.md`, `../../fal/SKILL.md`,
`../../replicate-images/SKILL.md`. **Never set up, install or pay for a provider just to have a
target**; that is the user's decision, not a step of this one.

## 2. Make the target, then inspect it before trusting it

Ask for **the real screen, straight-on, at the intended viewport**: not a poster, not a tilted device
mockup, not a hero shot. Put in the prompt:

- the screen's job, its primary action, the real product name, copy and controls;
- the chosen direction: hierarchy, layout, density, known fonts and usable assets;
- the viewport and the state being shown;
- for Polish or Extend, the existing system and exactly what may change.

Never put credentials, secrets or private customer data into a generation prompt. Label
illustrative data as illustrative. **Do not invent customers, prices, metrics or capabilities to make
the picture convincing**; an image cannot authorise a feature, a price or a data change.

Then look at it, whole and in detail crops, and fix what is wrong before building from it:
unreadable or false labels, a missing primary action, broken hierarchy, controls that cannot work,
text too small or too low-contrast to ship. Save **one** target and record its location and its
**actual** pixel dimensions, not the size you requested. Keep it stable while you build; a material
change to it is named and agreed, never swapped in quietly to make a mismatch disappear.

When the user wants to choose between directions, show them as images at the same viewport,
fidelity and aspect, with the real name and copy, and with genuinely different compositions, not
one template in three palettes. That selection is `../../variant-explorer/SKILL.md`'s.

## 3. Build it 1:1, as real interface

**The target is a spatial contract, not a mood board and not an asset.**

- Match the original viewport first: regions, proportions, alignment, type size and weight, line
  wrapping, colour, spacing, borders, shadows, icon geometry, image crops.
- Build semantic text and working controls on the project's own components. Never ship the image,
  or a crop of it, as the interface; absolute positioning is for real overlays, not for pinning
  things where the picture had them.
- Separate artwork from interface. Photographs and illustrations come from real files whose source
  and licence you can name; a generated picture of an asset is not the asset. A polygon mask is
  not a cutout of a person or product: use a real alpha matte or drop the effect.
- Name every missing font or asset and the substitute used. A substitution is reported, never
  passed off as a match.
- Product truth outranks the picture: routes, data, auth, backend contracts, accessibility. Where the
  target conflicts with them, keep the departure as narrow as possible and say where it is.
- Once the original size matches, adapt the structure for the other widths: decide what stacks,
  collapses, scrolls or stays fixed, and keep the first viewport's hierarchy instead of pushing the
  subject below the fold. One still frame proves nothing about responsiveness or interaction.

## 4. Render, compare, correct

- Run the real thing. Capture the intended screen, state and scroll position **after fonts, images
  and entrance motion settle**, at the target's dimensions. Playwright (`../../e2e-testing/SKILL.md`)
  or whatever preview the host offers.
- Put target and render side by side or overlaid, full view and detail crops. Fix **layout and
  proportions first**, then type, spacing, colour, assets and crops. Re-capture after each batch.
- For Polish, also compare the untouched regions against the "before" screenshot.
- For motion, compare the agreed key states, then watch entry, exit, interruption and reduced
  motion in motion: a matched still cannot verify a transition.
- **A blank, half-loaded, wrong-screen or wrong-size capture is invalid evidence**, not a fail and
  not a pass. Re-take it before judging the build. A later visual edit invalidates the captures it
  touched.
- Batch fixes, re-inspect, stop. After a pass that resolves nothing, report the gap and let the user
  decide scope; do not loop. A structure that is wrong is rebuilt, not hidden under spacing tweaks.

## 5. Report only what was seen

The hand-off names: the target and its actual dimensions, the sizes and states compared, the
capture environment and comparison method, the controls and accessibility checks actually
exercised, the remaining mismatches, and any missing assets or tools.

**A 1:1 claim needs a real target and an inspected render at the same size with no unresolved
visible mismatch in the claimed scope.** A target alone, a code read, a green build, a scan or a
thumbnail is not that evidence. Without a render, the visual match is *unverified*: say so, and still
report the implementation work that was done.
