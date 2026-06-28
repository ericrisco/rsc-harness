# Package templates & pattern library

Depth offloaded from `SKILL.md`. Use this when you need the full package file format,
the hook/on-screen-text pattern library, the cover-frame safe-area in pixels, or the
filled `02-DOCS` feedback-log schema.

## The package file format

Emit one markdown file per short under `02-DOCS/wiki/shortform/`. The `shortform/`
wiki tree is an **OKF v0.1 bundle** shared with the `tiktok-api` and
`shortform-strategy` siblings, so the file leads with YAML frontmatter (a non-empty
`type` is the only OKF hard requirement; `title`/`tags`/`timestamp` are the recommended
surface). The labeled body below is unchanged — `scripts/verify.sh` lints exactly these
labels (English or ES/CA, one per line, content following) and ignores the frontmatter:

```text
---
type: shortform-package
title: faceless productivity TikTok — package
tags: [shortform, packaging, tiktok]
timestamp: 2026-06-02T12:00:00Z
platform: tiktok
---
Hook:
  - I deleted my to-do app. Here's why.
  - The app that runs my whole week (it's free)

On-screen text:
  - 3 apps that replaced Notion
  - I deleted my to-do app

Caption:
  3 Notion templates that replaced my to-do app — the full setup, free links below.
  Send this to the friend drowning in tabs.

Hashtags:
  #notiontemplates #productivitytips #notionsetup

Cover:
  frame: 00:07 (peak — laptop closing, face mid-grin)
  overlay: I deleted my to-do app

Feedback:
  intro_retention: 0.74
  sends_per_reach: 0.018
  saves: 312
```

### TikTok (search-led) vs Reels (send-led) — same clip, tuned

```text
# TikTok — lean into in-app search
Caption: How to batch a week of shorts in one afternoon — exact workflow inside.
Hashtags: #contentbatching #shortformvideo #creatorworkflow

# Reels — lean into the DM send
Caption: This is how I never run out of shorts. Send it to your co-founder.
Hashtags: #reelstips #contentcreator #solopreneur
```

Caption keywords and hashtags differ per platform's search audience; the hook,
on-screen text, and cover frame stay identical (shared 9:16 / 1080×1920 spec).

## Hook + on-screen-text pattern library

Each is 4-7 words, promise/tension first, and the on-screen text is the silent twin.

| Pattern | Bad | Good |
|---|---|---|
| Open loop | "Let me explain something" | "Nobody does step 3 — and it's the one that matters" |
| Number | "Some tips for you" | "5 shorts in one afternoon" |
| Contrarian | "Posting daily is good" | "Stop posting daily. Do this instead." |
| Stakes | "A mistake to avoid" | "This caption mistake kills your reach" |
| POV | "Here is my routine" | "POV: you finally batched a week of content" |
| Before/after | "It got better over time" | "0 to 10k saves with one caption change" |

Rule: whichever you pick, the **on-screen first-frame text restates it in the same words**
for the sound-off ~60%, inside the safe zones (clear of top status bar and bottom UI).

## Cover-frame selection & safe area (in pixels)

The cover is the grid/shelf billboard, not the in-feed frame. The same 1080×1920 source
frame is cropped three different ways depending on where it surfaces:

- **Reels tab / Shorts shelf:** shows the full **9:16 frame, 1080×1920** — no crop.
- **Profile grid:** crops to **3:4, 1080×1440**. Instagram moved the grid from 1:1 to 3:4
  in 2025, lopping the **top ~240px and bottom ~240px** off the 1920-tall frame
  (the surviving band is roughly **y=240 to y=1680**). Sources: postfa.st "Instagram Reels
  Size", Buffer 2026.
- **Main feed:** crops to **4:5, 1080×1350** (a different, taller centre band again).

You cannot author one band that pleases all three crops separately — so author for the
**intersection**: the **1:1 centre square, 1080×1080** (vertical centre, roughly
**y=420 to y=1500**) sits inside every one of the three crops above. Keep all overlay
text in that square and it survives the grid, the feed, and the tab. Then also clear the
platform UI overlays (bottom ~250px: caption, action buttons, audio tag; top ~120px:
status bar). Practical safe band for overlay text: centred, between y≈600 and y≈1350.

Checklist:

- [ ] Frame shows motion / high contrast / a face mid-expression / the payoff
- [ ] Overlay is 3-6 words, same words as the hook line
- [ ] Overlay sits inside the 1:1 centre square (the intersection that survives the 3:4 grid, 4:5 feed, and 9:16 tab crops)
- [ ] Text clears top ~120px and bottom ~250px UI bands

## 02-DOCS feedback-log schema

Append one entry per shipped short under `02-DOCS/raw/shortform/`. Key on distribution
metrics, never likes. Read the log before writing the next package and mirror the
winning shape.

```yaml
- shipped: "2026-06-02 / faceless productivity TikTok"
  platform: tiktok
  hook: "I deleted my to-do app. Here's why."
  on_screen_text: "3 apps that replaced Notion"
  caption_lede: "3 Notion templates that replaced my to-do app"
  cover_overlay: "I deleted my to-do app"
  hashtags: ["#notiontemplates", "#productivitytips", "#notionsetup"]
  intro_retention: 0.74    # past-3s rate; bar is 0.70
  sends_per_reach: 0.018   # DM shares — the share-economy currency
  saves: 312               # weighted above likes (stronger intent signal)
  variant_tested: "number-led vs question on-screen text"
  won: "number-led lifted intro_retention 0.74 vs 0.61; carry forward"
```

Fields the next package reads first: `won`, `intro_retention`, `sends_per_reach`. If the
last winner was a number-led hook, start the next set there and test against it.
