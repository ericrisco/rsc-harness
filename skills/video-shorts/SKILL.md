---
name: video-shorts
description: "Use when scripting or directing the edit of a single vertical short that has to hold attention from the first frame — turning a topic, a clip or a long video into a shot-by-shot script and an edit decision sheet, fixing a hook that dies in second three, generating hook variants to test, and planning cuts and on-screen text. NOT scheduling or cross-platform cadence (that is `social-publisher`), NOT running the editorial calendar (that is `content-engine`), NOT defining the durable brand tone (that is `brand-voice`)."
tags: [short-form-video, reels, shorts, tiktok, video-script, hook, retention, captions, vertical-video, editing]
recommends: [social-publisher, content-engine, brand-voice, podcast, ads]
origin: risco
---

# Video Shorts — The Script and the Cut for One Vertical Video

*You are the scriptwriter and edit director for a single 9:16 short.* You hold attention for 15–60 seconds and then hand off. You do not pick the posting time, you do not run the calendar, you do not invent the brand voice, and you do not render pixels. You produce two coupled documents and the rigor lives in their structure, not in encoding.

## What you produce

Two artifacts, every time, in one `.md`:

1. **A timecoded script** — a beat sheet (hook → body → payoff → loop/CTA) where every beat carries the spoken/VO line *and* the burned-in on-screen text *and* the visual.
2. **An edit decision sheet (EDS)** — cut rhythm, B-roll/visual-change markers, caption styling, safe-zone layout, the chosen hook frame, and the loop seam, so an editor (a human or a CapCut/OpusClip-style tool) assembles it without guessing.

**The one governing rule: write for the sound-off viewer.** Most social video is watched muted — the primary Verizon Media / Publicis Media study (online survey, 5,616 U.S. adults 18–54, April 2019) found 69% watch video with the sound off in public and that 80% are more likely to finish a video when captions are present. The on-screen text is not a subtitle of the audio — it is a first-class narrative layer that must carry the video alone. If your short only works with sound on, it is broken. *Why: a muted viewer who reads nothing scrolls in under a second.*

You output a script + EDS the user hands to a creator or pastes into an editor. The deliverable is the plan, not the rendered file.

## Decide first

Pick a length from the *content type*, not from how much you have to say. The retention sweet spot is **15–30s, where shorts often clear high completion**; past ~45s drop-off is steep (vendor-reported industry figures, e.g. OpusClip ideal-length data, 2026 — directional, not peer-reviewed).

| Content type | Target length | Why |
|---|---|---|
| Tip / hack / single insight | 15–20s | One idea, one payoff; longer dilutes it |
| Tutorial / how-to | 25–40s | Needs steps, still must escalate |
| Story / before-after | 30–45s | Tension needs room, but cap the burn |
| Anything > 45s | must justify itself | Every extra second has to earn its retention |

YouTube Shorts allows up to 3 min (180s, since 15 Oct 2024) and Reels/TikTok go longer still, but length-allowed is not length-wanted — the algorithm rewards completion, and completion lives in the short band.

**Route out before you start writing:**

- Posting cadence, best-time slots, cross-platform limits → `../social-publisher/SKILL.md`.
- Which short to commission, the editorial calendar → `../content-engine/SKILL.md`.
- The durable brand tone you should write *in* → `../brand-voice/SKILL.md`.
- Paid creative variants / ROAS / ad-account structure → `../ads/SKILL.md`.
- A talking audio-first episode (not a vertical clip) → `../podcast/SKILL.md`.

## The structure

Four blocks, with a timecode budget. Worked for a **30-second** short:

| Block | Window (30s) | Job |
|---|---|---|
| **Hook** | 0:00–0:03 | Survive second 3. Promise, don't describe. |
| **Body / escalation** | 0:03–0:24 | Deliver, escalating; visual change every 3–5s |
| **Payoff** | 0:24–0:28 | The resolution the hook promised (last 15–25%) |
| **Loop / CTA** | 0:28–0:30 | Seam back to frame 1, or one-action CTA |

**Visual change every 3–5s after the hook.** A new shot, B-roll, text card, zoom, or reframe — anything that resets the eye. *Why: a static frame past ~4s reads as "this is over" and the viewer leaves; a visual change signals "there's more."*

**Open the loop early, close it late.** State a question or stake in the hook ("the third one is the mistake everyone makes") and withhold the resolution until the payoff. Numbered points ("3 things…") work because each number is a built-in progress bar that pulls the viewer to the next.

## The hook

As vendor-reported industry figures (OpusClip / housesparrowfilms, 2026; directional, not from a primary study), roughly half of the viewers who drop do so in the first 3 seconds, intro retention past 3s should land around 70%+, and shorts holding above ~65% at 3s see several times more impressions. Treat the exact percentages as orders of magnitude, not precise data — but the direction is unambiguous: the hook is the whole game.

**Six hook patterns** — pick by intent:

| Pattern | When to use |
|---|---|
| Promise / result | You have a concrete outcome ("how I cut my edit time in half") |
| Question | The viewer has felt the pain ("why do your Reels die at second 3?") |
| Pattern interrupt | You need to break the scroll ("stop posting at 9am") |
| Contrarian claim | You can defend a take against consensus ("captions are not optional") |
| In medias res | You can open mid-action / mid-result ("…and that's the cut that doubled it") |
| Stakes / tension | There's a cost to not knowing ("this mistake tanks your reach") |

**On-screen hook text: 4–7 words, high contrast, inside the safe zone.** It must be readable muted in under a second. Longer than 7 words and the muted viewer can't finish it before deciding to leave.

**Bad → Good rewrites:**

| Bad | Why it dies | Good |
|---|---|---|
| "Hey guys, today I want to talk about editing." | Describes, no promise, burns 3s on throat-clearing | "Your edit is losing viewers at second 3." |
| "Let me tell you a story about my first Reel." | Slow-burn intro, payoff invisible | "My first Reel got 11 views. Here's the fix." |
| "In this video we'll cover five tips." | Generic, no stake, no curiosity gap | "Tip 3 is the one nobody does." |
| "So basically captions are kind of important." | Hedged, mute-unreadable, no contrast | "Most people watch on mute. No captions, no views." |

**Reflex: cut your first five seconds.** First drafts almost always bury the hook behind a greeting. Delete the setup and start on the strongest line. When asked for variants, give 5 hooks across *different* patterns — not five rewrites of one.

For the full hook library by content type and a worked long-video → short extraction, see `references/hook-and-script-patterns.md`.

## The script artifact

A timecoded table. Every row has on-screen text — no exceptions (sound-off rule).

```markdown
## Script — "Stop posting at 9am" (28s, 9:16)

| Time | VO / spoken | On-screen text | Visual / B-roll |
|------|-------------|----------------|-----------------|
| 0:00–0:03 | "Stop posting at 9am." | STOP POSTING AT 9AM | Hard cut to face, fast zoom-in |
| 0:03–0:09 | "Your audience isn't awake — they're commuting at 8." | 9am = your worst slot | Phone clock 9:00 → swipe to 8:00 |
| 0:09–0:16 | "The data says evenings beat mornings for this niche." | Evenings win | B-roll: graph line rising |
| 0:16–0:23 | "Test 6pm for a week and watch the reach." | Try 6pm for 7 days | Screen-record of scheduler set to 18:00 |
| 0:23–0:26 | "Then come back and tell me I was wrong." | I'll wait. | Back to face, raised eyebrow |
| 0:26–0:28 | "Stop posting at 9am." | STOP POSTING AT 9AM | Match-cut to opening frame (loop seam) |
```

Note the last row repeats the hook line and frame: that is the loop, not an outro. Keep VO lines short and spoken-natural; the on-screen text is tighter (4–7 words) and never a verbatim dump of the VO.

## The edit decision sheet

The EDS turns the script into cut instructions. Tie each marker to a script row.

- **Cut cadence: one cut every 2–4 seconds.** High-performing shorts average that; put **micro-cuts (0.4–1.2s)** in the first 2–3 shots to "wake" the scroller. Keep dead-air pauses **under ~250ms** — silence past a quarter-second reads as buffering and viewers leave (vendor-reported editing guidance, OpusClip / driveeditor, 2026).
- **Visual-change markers** — annotate each script row with its change (cut / B-roll / text card / zoom / reframe) so no row sits static past 5s.
- **Hook frame** — name the exact opening frame (the most arresting still). It is the thumbnail-in-motion; if it's boring, nothing after it matters.
- **Loop seam** — specify how the last frame blends into the first (match cut, same framing, same audio bar). **The loop is the CTA**: even a ~10% replay rate is weighted heavily by the algorithm, and a clean seam manufactures replays. No traditional "thanks for watching" outro.
- **Caption track** — styling lives in the next section; the EDS just flags "captions: burned-in, style X, on for the whole runtime."

```markdown
## EDS — "Stop posting at 9am"
- Hook frame: face mid-sentence, eyes to lens, 0:00 (most arresting still)
- Cuts: micro-cuts 0:00–0:03 (3 cuts), then 1 cut / ~3s thereafter
- Dead air: trim every gap > 250ms
- B-roll: clock (0:03), rising graph (0:09), scheduler screen-rec (0:16)
- Captions: burned-in, all 28s, style below, safe-zone bottom margin respected
- Loop seam: 0:26 match-cut to 0:00 frame; same VO line bridges the seam
- CTA: implicit (the loop). No outro card.
```

## Captions & safe zones

Captioned videos retain better — the primary Verizon Media / Publicis Media study (n=5,616, April 2019) found 80% of viewers more likely to finish a video with captions; vendors report an additional ~15–25% retention lift (OpusClip / Verbit, 2026, vendor figures). Treat captions as design, not an afterthought.

- **Large, high-contrast, with a solid stroke or box** — readable on a bright phone outdoors.
- **4–7 words per line, ≥2s on screen.** Faster than that and the muted viewer can't read it.
- **On for the entire runtime.** No "captions only on the hook."
- **Inside safe zones.** Keep all text and the CTA out of the platform UI margins (top, bottom, and right rail eat your text). Exact pixel margins per platform are in `references/specs-and-safe-zones.md`.
- **Don't bury the hook under a trend audio's caption.** If you ride a trending sound, your own on-screen hook still owns the top third in second one.

## Repurpose one master

All three platforms share **9:16 @ 1080×1920, MP4 (H.264 video + AAC audio), 30 or 60 fps** (vidIQ / Sprout Social specs, 2026). One master export repurposes across Reels, Shorts, and TikTok — to surface on the Shorts shelf, just keep it vertical/square and under the 3-min ceiling.

Handing off to a tool (CapCut's 2026 AI Suite for one-click auto-edit + hundreds of TTS voices + multilingual captions + AI avatars, OpusClip/Reap/Vizard for long-video clipping, Submagic for caption styling): **paste the script + EDS as the brief.** The tool executes cuts and captions fast, but it does not invent your hook or your loop seam — those are yours. Algorithms now demote obvious low-effort AI clips, so the structure you bring is exactly what separates the short from filler. Per-platform specs, the export checklist, and current tool capabilities live in `references/specs-and-safe-zones.md`.

## Anti-patterns

| Bad | Why it kills retention | Good |
|---|---|---|
| Slow-burn intro / greeting before the point | ~half of droppers leave in the first 3s; you spent them on "hey guys" | Open on the strongest line; cut the first 5s |
| No burned-in captions | most viewers watch muted; a silent screen has no narrative | Captions all runtime, 4–7 words/line, high contrast |
| Traditional "thanks for watching" outro | Ends the video instead of replaying it | Loop seam: last frame match-cuts to the first |
| One static talking-head shot for 30s | No visual change reads as "it's over" past ~4s | A cut / B-roll / text card every 3–5s |
| Hook that *describes* the topic | Description has no promise or stake, so no reason to stay | Promise an outcome or open a curiosity gap |
| >45s with no escalation | Flat energy collapses completion past the sweet spot | Cut to 15–30s, or escalate every beat |
| TTS narrating a wall of on-screen text | Mismatched layers, nothing to read fast, AI-clip smell | Tight VO + separate 4–7-word caption layer |
| Trend audio buries your own hook | The borrowed caption owns second one, not your promise | Your hook owns the top third in the first frame |

## Verify & references

- Lint a produced script with `bash scripts/verify.sh path/to/script.md` — it checks a 0:00 hook beat exists, every beat has on-screen text (sound-off), the runtime sits in a sane short band, and a loop/CTA beat closes it. It is read-only and exits 0 on a clean script.
- `references/specs-and-safe-zones.md` — per-platform spec table, safe-zone pixel margins, export/repurposing checklist, dated tool snapshot.
- `references/hook-and-script-patterns.md` — full hook library by content type, beat-sheet + EDS templates, worked long-video → short extraction.
