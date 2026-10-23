# What the meter cannot see

The inspector proves a page is not broken. Blind jurors then chose between pages that all passed it,
and they chose on the things below (rsc benchmark, October 2026: every loss came from one of
them). Run each check on the screenshots, never on the code.

## 1. Every picture belongs to this client

For each picture, cover its caption and ask: would a visitor say it shows this client's product,
place, material, process, or customer at the moment of use? Sharing a category word fails: a tax
office on tax software, any kiln on this workshop's page, night streets of the city on a designer's
portfolio.

Search in this order, and stop at the first that has honest pictures:

1. the client's own;
2. the same thing from the same place (La Bisbal pottery for a La Bisbal workshop);
3. the same product or craft, anywhere;
4. never the category's buildings, generic scenery or people at laptops.

**Software:** its own interface counts toward the floor of four (cropped fragments of the product
working, marked `data-ui`, at least 300×200 px each). Pictures still matter: give it **two or more of
the object the product replaces or works on**, found in the archives (the paper account book a
bookkeeping app replaces, the printed form it fills in, the logbook a fleet tool retires). That object
passes the question above; the tax office does not. A software page with no picture at all reads flat.

## 2. The product leads

- **Physical goods:** the goods are the largest picture on the first screen, and every product
  listed has its own picture and its price.
- **Software:** the product working is in the first screen, with real-looking data.
- **Portfolio:** the work fills the page; the city, the studio and the person come after it.
- **Services and places:** the thing the visitor will get or walk into, not the category's mood.

## 3. Text reads the first time

- No headline or statement over a busy photograph. Text sits on a flat field, or on the quiet part of
  a picture with a scrim behind it.
- Hairline display faces only at 64 px and up, and never over a picture.
- Read every glyph in the screenshots: clipped, broken or fallback letters fail.
- No truncated label ("Oliana 10 …") and no two labels touching, at any width.

## 4. No empty fields

A large block of colour or a wide stage carries something: the product, a picture, a figure, the
live thing. A field that holds only a short line and air reads as unfinished, and jurors call it
"empty". One deliberate rest per page, as the run says; never a hero.

## 5. App screens are recomposed for the phone

On a phone, a working screen is a new composition, not the desktop squeezed: a timeline becomes one
list per row (crew, job, room) with its times as text, a wide table becomes cards or a two-column
list, and the most urgent item comes first. A chart that only works at desktop width is replaced on
the phone, never shrunk.

## 6. Drawn things are finished

Whatever is drawn in code instead of photographed (tiles, stills, objects, maps) is drawn with an
illustrator's care: real proportions, variation, texture, the palette's real colours. A flat
rectangle standing in for a product is a placeholder, and jurors read it as one.

## Two first screens

Variance between runs decides as much as method. Before building past the hero, build the first
screen of the **two** strongest dealt directions (`draw.mjs --direction <id>` for each, into separate
folders), inspect both at 1440 and 390, and put the four screenshots side by side. Keep the one that
passes the checks above more clearly and makes the subject more obvious in five seconds. Write
one line on why, then build the whole page from it.
