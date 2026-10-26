# Visual craft for applications

An application earns trust by being calm and legible. Beauty in a product is mostly restraint and
consistency. These are the levers, in the order they matter.

## 1. Hierarchy

- Decide the one thing that matters most on each screen. It gets the most size, weight or contrast.
- Three levels of emphasis are enough: primary (the thing), secondary (its context), tertiary (detail
  and metadata). Anything beyond three levels is usually noise.
- Use size, weight and position first. Use colour to confirm hierarchy, not to create it alone.
- Whitespace groups things. Put space between groups before adding a border or a box.

## 2. Type

- One typeface family for the interface. A second family only when there is a clear role for it, such
  as a distinct display face on marketing-like hero screens inside the app.
- A small type scale: about five sizes. Body in the 14–16px range; dense data may use 13px; nothing a
  person must read goes below 12px.
- Line height around 1.4–1.6 for body text and tighter for headings.
- Numbers in tables use tabular figures so columns align.
- Headings follow the document structure: one main heading per screen, in order.

## 3. Space

- One spacing scale in 4px or 8px steps. Every margin and padding comes from it.
- Related items sit closer than unrelated ones. Check that the spacing shows the grouping.
- Consistent gutters and page margins across screens. Shifting margins make an app feel unfinished.

## 4. Colour

- Neutrals do most of the work: backgrounds, surfaces, borders, text in several greys.
- One accent colour for the primary action and the current selection. If everything is accented, nothing
  is.
- Semantic colours are reserved for state: success, warning, danger, info. Do not use red as decoration.
- Text contrast at least 4.5:1; large text and component boundaries at least 3:1. Check the accent on
  both light and dark surfaces.
- Never rely on colour alone. Status pairs colour with a label or an icon.
- Define colours as tokens (background, surface, text, muted text, accent, danger) and use the tokens,
  not hex values, in components. Dark mode then becomes a token swap, not a redesign.

## 5. Dark mode

- Dark is a separate palette, not an inversion. Surfaces step up in lightness, not just darken.
- Reduce saturation of accent colours on dark surfaces so they do not glow.
- Re-check contrast on every semantic colour and every chart.
- Respect the system setting by default, and let the person override it.

## 6. Density

- Match density to the job. A monitoring table can be compact. Onboarding and forms need air.
- Density is a setting people can change when the product serves both kinds of user.
- Touch targets stay large even in dense layouts: at least 24×24 CSS px, and 44px where the device is
  touch-first.

## 7. Icons and imagery

- Icons carry a label when the action is unfamiliar or consequential. An icon alone is for universally
  known actions only (close, search, more).
- One icon set, one stroke weight, one size per context.
- Illustrations and images serve empty states, onboarding and error pages. They do not decorate working
  screens.
- Charts follow the same palette rules, and each one has a text summary or an accessible table.

## 8. Motion

- Motion explains a change: where something came from, what was added, what was removed.
- Keep most transitions between 150 and 300ms. Honour the reduced-motion setting by removing movement
  and keeping state changes.
- Never animate something the person is trying to read.

## 9. The tells of generated interfaces

These make an app look made without intent. Avoid them unless the brand calls for them:

- Purple-to-blue gradients and glowing shadows as the default style.
- Glass blur panels on everything.
- Emoji standing in for icons, and an icon on every heading and list item.
- A card around every element, nested cards, and every section padded identically.
- Marketing hero sections inside a working app.
- Sample data that is too clean: names all the same length, round numbers, no empty or error cases.
- Buttons that all carry equal weight.
- Grey-on-grey text described as "minimal".
- Hover-only affordances with no touch or keyboard equivalent.

## 10. The test

Look at the screen in grayscale, then with the text hidden, then at half size. The hierarchy should
still read: a primary thing, its context, its detail. If it does not, fix the structure before adding
any polish.
