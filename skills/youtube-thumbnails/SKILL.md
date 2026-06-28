---
name: youtube-thumbnails
description: "Use when designing or fixing a YouTube thumbnail, making variants for a thumbnail A/B test, or figuring out which thumbnail style wins on a channel. Triggers: 'design a thumbnail', 'make 3 thumbnail variants to A/B test', 'set up Test & Compare on this upload', 'why is my CTR low', the non-obvious 'CTR is fine but the test keeps picking the boring thumbnail' (the watch-time-share trap), 'which thumbnail style actually wins on my channel', and Catalan/Spanish 'fes la miniatura del vídeo' / 'diseña la portada del vídeo'. NOT pairing the title with the thumbnail as one click-promise (that is youtube-packaging), NOT channel positioning or niche (youtube-strategy), NOT setting a thumbnail through the Data API (youtube-api)."
tags: [youtube, thumbnails, ctr, ab-testing, design]
recommends: [youtube-packaging, youtube-strategy, ab-testing, design]
profiles: []
origin: risco
---

# YouTube thumbnails

Design thumbnails that survive the mobile feed, test them so the winner is a
*lesson* and not a coin flip, and write every outcome back to the channel's wiki
so the next thumbnail is evidence-led. A thumbnail you cannot learn from is half
wasted.

## The loop

This skill runs a closed loop, not a one-off design pass:

1. **Design** 2-3 candidate concepts that differ on exactly ONE testable axis.
2. **Test** them in YouTube Studio "Test & Compare".
3. **Log** the outcome to `02-DOCS/wiki/youtube/thumbnail-experiments.md`.
4. **Learn**: mine the log into `thumbnail-patterns.md` (what wins on THIS
   channel) and let that pick the next concept.

The reason for the discipline: Test & Compare hands you a winner, never a reason.
One varied axis per round is what turns a winner into a transferable rule.

## Hard constraints

These are objective and machine-checkable. `scripts/verify.sh` enforces the image
ones; the rest are your job. Source facts: socialrails.com / thumbnailtest.com
specs, accessed 2026-06-02.

| Constraint | Value | Why |
|---|---|---|
| Resolution | 1280x720 px | YouTube's recommended size; anything smaller upscales soft |
| Aspect ratio | 16:9 | The only ratio that fills the player and feed cleanly |
| Min width | 640 px | Below this YouTube may reject the upload |
| File size | under 2 MB | Hard cap for standard video (10 MB only for podcast thumbnails) |
| Format | JPG or PNG | Also accepts GIF/BMP, but ship JPG/PNG |
| Legibility | reads at 320x180 | Most discovery is the mobile feed at ~that scale — the "squint test" |
| Safe zone | clear bottom-right | The duration stamp overlays that corner — no critical text/face/logo there |

The squint test: shrink the image to 320x180 (or step back two meters from the
screen). If the subject and any text are not instantly readable, it fails — design
for the feed, not for the editor canvas. See
`references/composition-and-specs.md` for the contrast math and export workflow.

## Composition rules

Each rule, one reason. Concrete beats abstract.

- **One dominant focal point.** The eye must land in under a second; a thumbnail
  with two competing subjects reads as none at 320x180.
- **A face with one strong emotion** when the video allows it. Faces with clear
  emotion lift CTR roughly 20-30%, and custom thumbnails run ~60-70% higher CTR
  than auto-generated frames. One emotion, not a neutral stare.
- **Subject ~30% brighter or darker than its background.** Separation is what
  makes the subject pop in a scroll; a subject the same luminance as the bg
  vanishes. Add a subtle outline or glow if the background is busy.
- **2-3 bold colors, complementary.** More than three and the image turns to mud
  at feed scale. Target a text/background contrast ratio of about 4.5:1 (a
  usability heuristic, not a YouTube rule).
- **Kill motion blur and clutter.** Anything that softens or crowds the frame dies
  first when the image shrinks.

## Text rules

- **3-4 words maximum, maximum weight.** Heavy bold sans, large enough to read at
  320x180. If it needs a second line of small type, cut it.
- **Never in the bottom-right.** That is the duration-stamp safe zone.
- **The thumbnail text must NOT just repeat the title.** They are two surfaces of
  one promise, so make them add up instead of echo.

Bad -> Good (text that wastes the surface):

```text
Bad   title: "I built a PC in 24 hours"   thumb text: "BUILT A PC IN 24H"
Good  title: "I built a PC in 24 hours"   thumb text: "$200 BUDGET?!"
```

The Bad version spends both surfaces on the same words. The Good version lets the
thumbnail carry the stakes the title leaves implicit. The *full* title<->thumbnail
promise pairing — which surface owns which half of the hook — belongs to
[youtube-packaging](../youtube-packaging/SKILL.md). Here, just don't duplicate.

## Variant design for the A/B test

This is where the flow branches, so decide deliberately.

**Vary exactly ONE axis per variant set.** Change face vs object AND text AND
color at once and a winning variant teaches you nothing — you cannot attribute the
lift. Pick one axis from the menu and hold everything else constant.

| Axis | Variant A | Variant B | What a win tells you |
|---|---|---|---|
| Subject | human face | the object/result | does your audience click people or things |
| Expression | shock | calm/confident | which emotion this niche rewards |
| Text | text present | no text | whether words help or clutter here |
| Color | warm dominant | cool dominant | the channel's palette pull |
| Layout | subject left | subject right | reading-order fit |
| Zoom | tight crop | wide context | intimacy vs setting |

Two variants is enough to isolate one axis cleanly; use the third slot only when a
third level of the SAME axis is genuinely informative.

## Test & Compare procedure

YouTube's native A/B tool (broad rollout 2025). In Studio: open the video ->
Thumbnail -> "Test & Compare" -> add variants.

- **Up to 3 thumbnails** (and/or titles) per video.
- **Winner is chosen by watch-time share, NOT raw CTR.** This is the trap that
  breaks intuition: a punchy over-promising thumbnail can win the click and still
  *lose* the test because the viewers it lured bounce, dragging watch time down.
- **Runs up to ~2 weeks**, then YouTube auto-promotes the winner.
- Let it reach significance — don't call it after two days of noise.

The over-promise trap is the seam to [youtube-packaging](../youtube-packaging/SKILL.md):
if your tests keep crowning the "boring" variant, the flashy one is writing a check
the video doesn't cash. That is a promise problem, not an image problem.

## The feedback loop (wiki)

Every test result goes to the channel wiki. Exact path:
`02-DOCS/wiki/youtube/`. `02-DOCS/wiki/` is an **OKF v0.1** bundle: both files
below carry file-level frontmatter with a non-empty `type` (`thumbnail-experiment`)
plus the OKF surface (`title`, `description`, `tags`, `timestamp`) shared with the
api/strategy/packaging siblings, and cross-references use standard markdown links,
never `[[wikilinks]]`.

**Log file** — `thumbnail-experiments.md`, frontmatter at the top then one row per
test (append-only, ISO 8601 dates, past rows immutable):

```text
| date | video | variants | axis tested | winner | CTR | watch-time share | note |
```

**Derived file** — `thumbnail-patterns.md`, frontmatter at the top then a running
table of what wins on THIS channel (e.g. "faces beat objects 4/5 tests", "no-text
wins on tutorials"). You update this after each logged test.

**Next-concept rule:** the next thumbnail keeps the winning level of every axis
already settled by the log, and tests the next unsettled axis. You only re-test a
settled axis when the channel's content or audience visibly shifts.

**Caveat:** on a small channel a single test is noise. Treat a pattern as real only
after it holds across ~3+ tests or a clear, repeated margin. Full schema, filled
example rows, and the pattern-mining heuristic live in
`references/experiment-log-format.md`.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Tiny or thin text | Illegible at 320x180 feed scale | 3-4 words, heavy bold, squint-tested |
| 5+ colors | Muddies into noise when shrunk | 2-3 complementary bold colors |
| Clipart / stock faces | No emotion, no trust, reads as spam | Real face, one strong emotion |
| Thumb text == title text | Wastes both surfaces of the promise | Thumb adds the stake the title omits |
| Varying 3 axes per test | Winner is uninterpretable | One axis per variant set |
| Trusting one test on a small channel | That's noise, not signal | Wait for ~3+ tests / repeated margin |
| Designing in the full editor only | Looks great at 1280, dies in the feed | Check the 320x180 squint view |
| Subject/logo in bottom-right | Duration stamp covers it | Keep that corner clear |
| Chasing CTR while watch time tanks | Test & Compare scores watch-time share | Fix the over-promise (see youtube-packaging) |

## Pre-publish checklist

- [ ] Exactly 1280x720, 16:9, under 2MB, JPG or PNG (run `scripts/verify.sh`)
- [ ] Passes the 320x180 squint test
- [ ] Bottom-right corner clear of text/face/logo
- [ ] Single dominant focal point; subject ~30% contrast vs background
- [ ] 3-4 words max, heavy weight; text not duplicating the title
- [ ] 2-3 colors only
- [ ] Variant set differs on exactly ONE named axis
- [ ] Test & Compare configured (<=3 variants, watch-time-share, ~2-week window)
- [ ] Log row staged for `02-DOCS/wiki/youtube/thumbnail-experiments.md`

## See also

- [youtube-packaging](../youtube-packaging/SKILL.md) — the title<->thumbnail promise pair and hook framing.
- [youtube-strategy](../youtube-strategy/SKILL.md) — channel positioning, niche, cadence.
- [ab-testing](../ab-testing/SKILL.md) — rigorous experiment design on non-YouTube surfaces.
- [design](../design/SKILL.md) — general visual systems and composition theory.
