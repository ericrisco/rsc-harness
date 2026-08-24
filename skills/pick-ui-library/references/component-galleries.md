# Reference — where to go looking for component ideas

> Last verified: **2026-08-24** — all three returned HTTP 200 on that date.

**Go and look.** When you need a component idea and your own prior is the median of every AI template
ever scraped, these are the places to browse instead of inventing from memory. Open them, see what
exists, come back with something specific.

## Where to go, and for what

### [Aceternity UI](https://ui.aceternity.com/components) — effects for a surface that must stop the scroll

Go here for **motion and atmosphere on a marketing surface**, not for primitives. What's there:

- **Backgrounds:** Aurora, Beams, Vortex, Sparkles, gradient fields
- **Cards:** 3D tilt, hover reveal, card stack, spotlight
- **Text:** typewriter, flip, encrypted/scramble, generate-in, canvas text
- **Scroll:** sticky scroll, container scroll, hero parallax
- **Navigation:** floating navbar, floating dock, sidebar, notch, tabs
- **Buttons:** magnetic, moving border, hover gradient
- **Data as spectacle:** globe, timeline, world map, before/after compare
- **Whole sections:** hero, pricing, testimonials, CTA, feature blocks

Best used when you can name the feeling you want and need to see how someone already built it.

### [21st.dev](https://21st.dev/community/components) — breadth, ranked by what people actually use

A community registry rather than a curated library, so it's the widest net of the three. Marketing
blocks *and* real UI — buttons, cards, forms, modals, inputs, tables — plus Shaders and ASCII art.
Sortable by popular and newest, with view counts.

Go here when you don't know what you're looking for yet and want to see the range. Read the code of
anything you like: community means unvetted, and popularity is not review.

### [React Bits](https://reactbits.dev/get-started/index) — animated interactions, deeply customizable

~46k stars. Animations, 3D, CSS effects, built to be tuned rather than dropped in.

Go here when Aceternity's version of an effect is close but you need to control it.

## Two things to carry with you

**Ideas travel; code stays there.** Take the technique, the ratio, the interaction — then build it in
the project's own tokens. Never vendor a gallery's source into this catalog: rsc ships publicly (P9),
and React Bits' licence (MIT + Commons Clause) forbids redistributing its components outright. In the
user's own project, installing any of the three is fine.

**Identity outranks the gallery.** Check `02-DOCS/wiki/brand/` for what this project refuses before
pulling an idea. A lot of what these galleries do best — aurora and gradient-mesh backgrounds,
glassmorphism, neon, blobs, decorative 3D — is also on the AI-tell list in
`../../design/references/ai-tells.md`, and some brand studies veto it by name. And run the frequency gate
from `../../animate/SKILL.md`: a spotlight card earns its place on a hero someone sees once, and never on
a table they open forty times a day.

## Not a substitute for the primitives

A dialog still comes from `base-ui`, a toast from Sonner, a command palette from cmdk. Focus trapping,
dismissal and accessibility are solved; an animated card does not replace a solved primitive. Use
`SKILL.md`'s list for the task, and this file for the look.
