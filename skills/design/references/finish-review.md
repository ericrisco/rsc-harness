# The fresh review

Adapted from impeccable's finish reviewer by Paul Bakaus (Apache-2.0); rewritten and shortened.

The builder believes its own page. The review runs **outside** the build: a fresh subagent with no
history of this conversation, so it does not inherit the builder's framing or optimism. Without
subagents, step fully out of the build and run the same checks yourself, and say in the report that
the review was not independent.

## The packet

Hand it only this:

- the original request and the user's answers;
- the screenshots from `.taste-skill/inspect/` at every width (the reviewer has no browser);
- the last `inspect.mjs` result;
- the direction sheet (`draw.mjs --show`), the idea sentence and the live thing;
- the paths of `../engine/RUN.md` (house rules) and `../engine/references/critique.md`.

## The checks, in order

0. **Evidence.** Every width captured, no blank or half-loaded screenshot, content where the
   filename says. If one fails, the answer is `recapture` and nothing else.
1. **First screen.** Within five seconds: what is this, why does it matter, what do I do?
2. **The idea.** Is the idea sentence visible on the page, in every section, and does it fail the
   competitor test (would it work for the nearest competitor)?
3. **The direction.** Was the dealt direction built, or did the build drift back to the layout the
   model would have made anyway?
4. **Substance.** Real pictures, full content, no screen that is mostly empty ground.
5. **Truth.** No invented customers, quotes, numbers or logos. Sample content marked.
6. **Floor.** The house rules in `../engine/RUN.md`, plus what screenshots show and code hides:
   states (hover, focus, loading, empty, error), themed selection and focus rings, text that fits.

## The four words

The first line of the answer is exactly one of these. The word follows from the checks:

- `recapture`: the evidence failed, not the page. Capture again, then a full review.
- `rebuild`: the focal element or the direction itself is wrong. Re-derive it; patches will not do.
- `fix`: an ordered list of material fixes, at most eight, most important first.
- `ship`: nothing material remains.

Then: `fixes` (when `fix`) and `keep`, one line naming what must not be diluted while fixing.
Apply the fixes in one batch, run the gate again, and send the new screenshots back for a verdict
on each fix: resolved, partial or unresolved. Two rounds at most. A partial or unresolved fix
never becomes `ship`. Report the reviewer's word as it was given.
