---
name: shortform-packaging
description: "Use when a vertical short (TikTok/Reels/YouTube Shorts) is shot or scripted and you need the upload-form copy and cover that win the feed: the hook line, the first-frame on-screen text, the search-led caption, a tight 3-5 hashtag set, and the cover frame; it learns from what performed via the 02-DOCS log. Triggers: 'write the hook and caption for this Reel', 'pick the cover frame and its text', 'what hashtags for this TikTok', the non-obvious 'is 20 hashtags too many' and 'my shorts get views but nobody shares them, fix the packaging', 'rewrite the caption to rank in TikTok search', 'log how the last 5 shorts performed and apply it', plus Spanish/Catalan 'escríbeme el gancho y el pie de foto para este Reel' / 'ningú comparteix els meus vídeos, arregla'm el packaging i dona'm els hashtags'. NOT inventing the idea (that is shortform-ideation), NOT scripting or directing the cuts (that is video-shorts), NOT executing the edit (that is shortform-editing), NOT scheduling the post (that is social-publisher)."
tags: [shortform, packaging, tiktok, reels, shorts, caption, hashtags, hook, cover, retention, social-copy]
recommends: [video-shorts, shortform-ideation, shortform-strategy, shortform-editing, social-publisher, brand-voice, tiktok-api, instagram-api]
profiles: []
origin: risco
---

# Short-form packaging

You write the words and choose the frame that wrap a finished or scripted vertical
short so it survives the feed. The clip already exists — your job is the upload-form
copy and the cover that decide whether a scroller stops, finishes, and sends it to a
friend. You are not the idea, not the script, not the edit, not the schedule. A great
clip dies on a weak package; a tested package multiplies a fine clip.

You optimize against measured retention and shares pulled from the account's own
`02-DOCS` log — not a hunch, not the latest "viral hook" thread.

## What you produce

Five artifacts plus one feedback entry, every single time:

1. **A hook line** — the spoken/written opener, 4-7 words, that has to survive second 3.
2. **A first-frame on-screen text set** — the burned-in line a sound-off scroller reads
   before any audio decision; 2-3 variants to test, each ≤7 words.
3. **A caption** — search-led, front-loaded, keyword-first sentence.
4. **A hashtag set** — 3-5 topic-signal tags, never a discovery dump.
5. **A cover frame + overlay** — which frame becomes the grid/Shorts-shelf billboard,
   plus its 3-6 word overlay.
6. **A `02-DOCS` feedback entry** — what shipped, the metric that moved, what won.

**Precondition (do not skip).** The video must be shot or scripted, and the idea/angle
must be decided. If there is no script, route to `video-shorts`. If there is no settled
idea, route to `shortform-ideation`. Do not invent either here — packaging an undecided
short means guessing the hook, the keyword, and the audience all at once.

## Rule zero: package for the seed test and the send

Every choice below serves exactly two outcomes. Hold them in mind:

- **The seed test is the whole game.** TikTok and Shorts push each upload to a small
  seed audience first; weak intro retention plus high swipe-away kills distribution
  before it spreads. Intro retention (made it past 3s) of **70%+** is the bar, and the
  first ~3 seconds carry most of the swing in whether a clip is finished at all. So hook
  + first-frame text + cover are the highest-leverage copy on the whole post.
- **Sends and saves are the currency, weighted above likes.** Instagram's stated Reels
  ranking factors are watch time, likes-per-reach, and **sends-per-reach (DM shares)**;
  Mosseri has repeatedly said sends and saves signal more intent than likes, so treat
  them as outweighing likes. Package for "I have to send this to someone," not for vanity
  likes.

## Ground first

Before you write a word, read the account. Skipping this produces generic copy in a
stranger's voice that contradicts what already won.

1. Read `02-DOCS/wiki/shortform/` for the **brand voice** and prior packages.
2. Read the **performance feedback log** — which hooks, covers, and hashtags already
   lifted intro retention and sends. Carry the winner's shape forward.
3. Pull the decided **idea/angle** from `shortform-ideation` output if it exists.
4. **No script or no settled angle? Route OUT** (see Handoffs). Never invent here.

Persist the package under `02-DOCS/wiki/shortform/` and raw test results under
`02-DOCS/raw/shortform/`. The `shortform/` wiki tree is an **OKF v0.1 bundle** shared
with the `tiktok-api` and `shortform-strategy` siblings: each persisted package `.md`
leads with YAML frontmatter carrying a non-empty `type: shortform-package` (plus the
recommended `title`/`tags`/`timestamp`), and any cross-references use standard markdown
links, never `[[wikilinks]]`. The raw feedback log under `02-DOCS/raw/shortform/` is
`raw/`, not `wiki/` — no frontmatter required. The full frontmatter + pattern depth
lives in [references/package-templates.md](references/package-templates.md).

## The two-second decision

A scroller meets your short in one of two states, and you design for both:

- **From the feed/FYP:** frame 1 plays muted. ~60% watch sound-off, so the **first-frame
  on-screen text carries the hook** — it is read before any audio decision is made.
- **From a profile grid or Shorts shelf:** they see the **cover frame** first, cropped
  and silent.

So three artifacts must say the *same promise* in the same words: the spoken hook, the
first-frame on-screen text (its silent twin), and the cover overlay. Co-design them;
never let them drift apart.

## Hook line + on-screen text

The 3 seconds that decide distribution. Rules, each with its reason:

- **4-7 words.** Longer and the muted scroller swipes before finishing the read.
- **Lead with the promise or the tension, not the setup.** The payoff or the stakes go
  first; context can wait for the caption.
- **On-screen text is the silent twin of the spoken hook** — restate the hook as burned-in
  text so the sound-off majority gets it. Keep it inside the safe zones (clear of the
  top status bar and the bottom UI: caption, buttons, profile tap target).
- **Emit a SET of 2-3 variants, never one.** You ship a hypothesis to measure on the
  seed audience, not a guess to defend.

| Bad | Good | Why |
|---|---|---|
| "Hey guys, so today I wanted to talk about..." | "I deleted my to-do app. Here's why." | Promise up front; survives second 3. |
| "Watch till the end!" | "The last step is the one nobody does." | Open loop with a concrete stake, not a beg. |
| On-screen: *(none — relies on audio)* | On-screen: "3 apps that replaced Notion" | Carries the hook for the muted 60%. |
| Hook says X, on-screen text says Y | Hook and on-screen text say the same 5 words | Twin promise, no drift. |

Full pattern library (open loop · number · contrarian · stakes · POV · before/after)
with Bad→Good rewrites is in
[references/package-templates.md](references/package-templates.md).

## The caption

The caption is now a **search-ranking field**, not a throwaway line. Mosseri lists
captions as a Reels ranking factor; TikTok and Instagram Search read caption language
like page copy. Rules:

- **Lead the first sentence with the actual keyword phrase a viewer would search** —
  not a teaser, not a question. A keyword-led first line is what surfaces the clip in
  in-app search and the "related" rail; a teaser line surfaces nowhere.
- **Only the first ~100-150 chars show before "more."** Put the keyword, the value, and
  any code/link there. The rest may never be seen.
- **Sweet spot ~150-300 chars** for context plus engagement; go to 500+ only for a
  deliberately educational/SEO post. Hard limits (TikTok 4,000, Reels 2,200) are
  irrelevant — the first line does the work.
- **End on a save/send-worthy payoff and one soft CTA.** "Send this to the friend who
  needs it" beats "like and follow."

Pick the caption shape from the ask:

| If the goal is... | Caption shape |
|---|---|
| Rank in in-app search (evergreen, how-to) | Keyword phrase first → value → soft CTA. Lean to 200-400 chars. |
| Engagement on a timely/entertaining clip | Punchy payoff line + send prompt. Keep ~150 chars. |

| Bad | Good |
|---|---|
| "wait for it 👀 you won't believe this" | "3 Notion templates that replaced my to-do app (free links below)" |
| "new video!! check it out 🔥🔥" | "How to batch a week of shorts in one afternoon — the exact workflow" |

## Hashtags

The rules changed; the old 30-tag dump is now a liability.

- **3-5 hashtags. Never more.** Instagram now **hard-caps posts/Reels at 5** (Mosseri,
  rolling into 2026) and states hashtags "categorize content for the algorithm" — they
  do not boost reach. TikTok best practice is also **3-5** (CapCut, ByteDance's own
  editor); 10+ signals spam and gives the algorithm mixed signals.
- **Topic-signal, not discovery.** Pick specific tags that label what the video *is*,
  not broad reach-bait like `#fyp #viral #foryou`.
- **Tune per platform.** Same clip, but match each platform's search audience — a tag
  that ranks on TikTok may be noise on Reels.

```text
Bad:   #fyp #foryou #viral #trending #productivity #notion #app #tech #life #2026 ... (22 more)
Good:  #notiontemplates #productivitytips #notionsetup
```

## Cover frame

The cover is the grid/search/shelf billboard — it sells the replay and the profile
visit, and it is **not** what plays in-feed. Choose and spec it:

- **Pick a high-motion, high-contrast, or peak-emotion frame** — a face mid-expression
  or the visual payoff. Avoid a flat, mid-sentence frame.
- **Respect the crops.** A Reels cover shows full 9:16 (1080×1920) in the Reels tab, but
  the **profile grid crops it to 3:4 (1080×1440)** — Instagram removed the top and bottom
  ~240px of the 1080×1920 frame when it moved the grid to 3:4 in 2025 (postfa.st "Instagram
  Reels Size", Buffer 2026). The feed crops differently again (4:5, 1080×1350). The one
  region that survives *every* crop is the **1:1 centre square (1080×1080)** — so keep all
  cover text inside that centre square and you are safe on the grid, the feed, and the tab.
- **Add 3-6 words of overlay** — the **same words as the hook**, high contrast.

Cover checklist:

- [ ] Frame has motion/contrast/face or shows the payoff (not a flat mid-frame)
- [ ] Overlay is 3-6 words and matches the hook line
- [ ] Overlay text sits inside the 1:1 centre square (the only region that survives the 3:4 grid crop, the 4:5 feed crop, and the 9:16 tab)
- [ ] Text clears the top status bar and bottom UI

## The learning loop (02-DOCS)

This is the core that makes the skill compound. **Read winners before writing; append a
result after shipping.** Key the log on the metrics that move distribution — NOT likes:

```yaml
- shipped: "2026-06-02 / faceless productivity TikTok"
  hook: "I deleted my to-do app. Here's why."
  on_screen_text: "3 apps that replaced Notion"
  cover_overlay: "I deleted my to-do app"
  hashtags: ["#notiontemplates", "#productivitytips", "#notionsetup"]
  intro_retention: 0.74   # made it past 3s — bar is 0.70
  sends_per_reach: 0.018  # DM shares, the share-economy currency
  saves: 312              # weighted above likes (intent signal)
  won: "number-led on-screen text beat the question variant on intro retention"
```

The filled schema and a per-platform tuned example are in
[references/package-templates.md](references/package-templates.md). When you write the
next package, open the log first and mirror the shape that won.

## Test in sets, ship across the trio

Specs are shared — 9:16, 1080×1920, MP4 H.264/AAC — so one package repurposes across
TikTok, Reels, and Shorts. But tune the caption keywords and hashtags per platform's
search audience, and treat the 1:1 safe square as most critical on Instagram. Ship 2-3
hook + on-screen-text + cover variants, read which lifted intro retention and sends, log
it, repeat.

## Handoffs

Route out the moment the ask leaves the upload-form copy and cover. The tell: if it is
one of the five artifacts above, it is here; otherwise it is a sibling.

| Request | Route to |
|---|---|
| Invent the idea / topic / angle for the short | `shortform-ideation` |
| Account-level plan: niche, cadence, which platforms, growth | `shortform-strategy` |
| Write the spoken script / beat sheet, direct the cuts | [video-shorts](../video-shorts/SKILL.md) |
| Execute the edit — caption burn-in, B-roll, sound sync | `shortform-editing` |
| Schedule / cross-post the finished short | [social-publisher](../social-publisher/SKILL.md) |
| Upload programmatically via the platform Graph/API | `tiktok-api` / `instagram-api` |
| Title/description/tags for a long-form YouTube video | [youtube-packaging](../youtube-packaging/SKILL.md) |
| Define the durable brand tone reused across all content | [brand-voice](../brand-voice/SKILL.md) |

Sharp line vs `video-shorts`: that sibling owns the *internal* on-screen text of every
beat as part of the narrative. You own the *packaging* layer — the single first-frame
hook overlay, the caption, the hashtags, and the cover — and you treat the script's
existence as a precondition.

## Anti-patterns

| Anti-pattern | Do instead |
|---|---|
| Caption opens with a teaser ("wait for it 👀") | Lead the first sentence with the searched keyword phrase. |
| Shipping one hook instead of a set | Emit 2-3 hook + on-screen-text variants to test on the seed. |
| Dumping 15-30 hashtags | 3-5 specific topic tags; IG hard-caps at 5, TikTok best is 3-5. |
| Like-bait CTA ("smash that like") | A save/send payoff — sends and saves outweigh likes. |
| Cover text outside the 1:1 centre square | Keep overlay inside the centre square — the band that survives the 3:4 grid, 4:5 feed, and 9:16 tab crops — clear of UI. |
| On-screen text that doesn't match the hook | Make on-screen text the silent twin — same words. |
| Writing blind, ignoring the 02-DOCS log | Read prior winners first; carry the winning shape forward. |
| Packaging before a script/idea exists | Route to `video-shorts` / `shortform-ideation` first. |
| Same caption copy-pasted to every platform | Tune keywords and hashtags per platform's search audience. |
| Logging likes as the success metric | Log intro retention, sends-per-reach, and saves. |

## Verify

`scripts/verify.sh <package-file>` is a read-only, network-free lint over one package
draft: hook set has ≥2 variants; on-screen text exists and is ≤7 words per line; the
caption's first sentence is ≤~150 chars and does not open with a banned teaser; the
hashtag count is 3-5; a cover frame + overlay is present; and a `02-DOCS` feedback block
exists with `intro_retention`, `sends_per_reach`, and `saves`. A clean or empty file
exits 0 — never a false failure. See `evals/README.md` for how the cases are run.
