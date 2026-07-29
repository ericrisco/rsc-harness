---
name: podcast
description: "Use when planning, recording, editing or publishing one podcast episode end to end — the run-of-show and guest brief, recording settings, the loudness master, the Podcasting 2.0 sidecars for chapters and transcripts, the RSS item, and timestamped SEO show notes. Covers audio that is quiet on one platform and loud on another, feeds rejected for bad artwork, and chapters that will not appear in the app. NOT clipping the episode into social posts (that is `social-publisher`), NOT cutting the vertical short (that is `video-shorts`)."
tags: [podcast, audio, rss, show-notes, podcasting-2.0]
recommends: [social-publisher, video-shorts, newsletter, brand-voice, content-engine]
origin: risco
---

# Podcast — One Episode, Plan to Published

*You own the production craft and the distribution surface of a single audio episode: the run-of-show, the recording settings, the loudness target, the chapters and transcript sidecars, the RSS `<item>`, and the show-notes page that ranks. You do not invent the show's voice, plan the content calendar, or cut the clips — you take one episode from idea to a feed entry an app can ingest.*

An episode moves through four phases: **plan → record → edit & master → publish** (plus the show-notes page that ships with publish). Every load-bearing number below is sourced and dated (accessed 2026-06-02). Use the current numbers; do not guess from memory.

## The flow — find the phase, do that phase

Read the ask, drop it into one phase, execute that phase, and stop at its hand-off. Do not redo earlier phases the user already has.

| The ask sounds like | Phase | You produce |
| --- | --- | --- |
| format, run-of-show, guest brief, questions, cold-open | 1 Plan | an episode outline + question list |
| double-ender, sample rate, multitrack, "how do I record remotely" | 2 Record | a recording-settings checklist |
| "how loud", LUFS, true peak, mono vs stereo, export format | 3 Edit & master | a mastering target sheet + export plan |
| RSS item, enclosure, chapters, transcript, artwork, submit to Apple | 4 Publish | a valid `<item>` + `chapters.json` + `transcript.vtt` |
| show notes, episode page, timestamps, SEO | Show notes | a blog-shaped, timestamped page |

## Phase 1 — Plan

Pick the format first; it sets everything downstream.

| Format | Use when | Why |
| --- | --- | --- |
| Solo | you own the expertise and want tight control | no scheduling, fastest to ship, easiest to master (mono) |
| Interview | the value is a guest's knowledge | borrowed audience + authority; needs a guest brief |
| Co-host | a recurring two-voice dynamic | chemistry carries it; needs two locals |
| Narrative | story-driven, scripted, sound-designed | highest production cost; script before you record |

**Run-of-show.** Write a timed segment table before recording so the edit has a spine. Target minutes for a ~40-min interview:

| Segment | Target | Purpose |
| --- | --- | --- |
| Cold-open | 0:30 | best 30s of tape, pulled forward to hook |
| Intro | 1:00 | show ID + episode promise + guest one-liner |
| Segment(s) | 30:00 | the body — 2-4 themed blocks, not one shapeless chat |
| CTA | 0:30 | one ask (subscribe / a specific link), never three |
| Outro | 1:00 | recap + where to go next + sign-off |

**Guest brief** (send before the record): episode topic + angle, 4-6 question themes (not the verbatim list — keep some spontaneity), tech check (headphones + a quiet room + the recording link), the time/timezone, and how their name and links should appear. A guest who knows the themes gives sharper tape.

**Question design.** Open-ended, single-barrel, no yes/no. One idea per question.

```text
Bad   "Did you find fundraising hard, and what would you change?"  (double-barreled yes/no)
Good  "Walk me through the moment fundraising got hardest."         (open, single, invites a story)
```

## Phase 2 — Record

**Record locals, never the call.** A remote double-ender records each participant *locally* — Riverside/Descript capture every speaker on their own machine at 48 kHz uncompressed WAV, one track per speaker, cloud-backed in real time, so quality is independent of the connection. The Zoom/Meet mixdown is compressed, single-track, and drops out with the bandwidth. (Riverside double-ender; Buzzsprout remote-recording guide 2026 — accessed 2026-06-02.)

```text
Bad   Hit "record" in Zoom and edit the resulting compressed stereo mixdown.
Good  Double-ender: each speaker's local 48 kHz WAV on its own track, cloud-backed,
      assembled into a multitrack you edit downstream.
```

Recording checklist:

- [ ] **Remote** → double-ender (Riverside/Descript). **In-person** → multitrack recorder/interface, one mic per speaker.
- [ ] **48 kHz, uncompressed WAV**, separate track per speaker — never a pre-mixed single track.
- [ ] **Local + cloud backup** running before you start talking.
- [ ] **Track to ~-18 dBFS peaks**, leaving headroom — do not record hot toward 0 dBFS; clipped tracks are unrecoverable and you fix loudness at the master, not the mic.
- [ ] Headphones on every speaker (kills echo/bleed); record 10s of room tone for noise cleanup.

## Phase 3 — Edit & master

**Edit order.** Assemble → content edit (cut tangents, fix flow) → cleanup (noise reduction, level the tracks against each other) → master last. Master on the finished mix, never mid-edit.

**Master once to -16 LUFS integrated, stereo, true peak -1 dBTP.** This is the single safe target. Apple Podcasts recommends -16 LUFS integrated; Spotify normalizes podcasts to -14 LUFS and turns *down* anything louder on playback — so you do not master a separate file per platform. The -1 dBTP ceiling prevents inter-sample clipping after MP3 encoding. (SONE "Podcast Loudness Standards 2026"; Descript "Podcast Loudness Standard"; Podnews LUFS FAQ — accessed 2026-06-02.)

| Destination | Integrated LUFS | True peak | Channels | Note |
| --- | --- | --- | --- | --- |
| Apple Podcasts | -16 | -1 dBTP | stereo | the reference target |
| Spotify | normalizes to -14 | -1 dBTP | stereo | louder uploads are turned down; do not over-master for it |
| Mono voice (solo) | -19 (≈ -16 stereo) | -1 dBTP | mono | mono is ~half the file size for a single voice |
| YouTube (if you also post audio video) | ~-14 | -1 dBTP | stereo | normalized like Spotify |

The mono equivalent of -16 LUFS stereo is **-19 LUFS** — relevant only when you publish a single-voice episode as mono. (SONE / Podnews — accessed 2026-06-02.)

**Export.** Keep the **WAV master** as your archive. Encode the distribution file to **MP3** (commonly 128 kbps stereo / 96 kbps mono for voice) — that MP3 is what the RSS `<enclosure>` points at. Note its byte length and MIME type; you need both for the `<item>`.

## Phase 4 — Publish

The deliverable is a valid RSS episode `<item>` plus its sidecars. A complete annotated `<item>`, the full iTunes/RSS channel tag list, and the Podcasting 2.0 tag set with every attribute live in `references/rss-and-namespace.md` — load it before hand-writing a feed.

**The `<item>` must carry** (Apple's required set + the enclosure):

- `<title>` and `<itunes:title>`, `<description>` (the show notes), `<pubDate>` (RFC-822).
- `<enclosure url="…" length="…BYTES" type="audio/mpeg"/>` — the MP3 URL, its size in **bytes**, and the MIME type. A wrong `length` breaks the player's scrubber.
- `<guid isPermaLink="false">` — a stable unique ID that never changes after publish; changing it duplicates the episode in every app.
- `<itunes:duration>` (seconds or HH:MM:SS) and `<itunes:image href="…"/>`.

**Artwork constraints (feeds are rejected otherwise):** cover art must be a **square JPG or PNG, RGB color space, minimum 1400×1400 px and maximum 3000×3000 px**. (RSS.com hosting guide 2026 — accessed 2026-06-02.)

**Podcasting 2.0 sidecars** (wire them in the `<item>`; full shapes in the reference):

- `chapters.json` → `<podcast:chapters url="…" type="application/json+chapters"/>`. The JSON has `version` + a `chapters[]` array; each chapter has a numeric `startTime` (seconds) and `title`, and startTimes are **monotonically non-decreasing**. The hosted file can be edited after publish.
- `transcript.vtt` / `.srt` → `<podcast:transcript url="…" type="text/vtt"/>`. The **`type` attribute is required** (`text/vtt`, `application/srt`, or `application/json`); you may add multiple `podcast:transcript` tags for multiple formats. Creator-supplied transcripts beat Apple's auto-generated ones. (Podcasting 2.0 namespace docs — accessed 2026-06-02.)
- `<podcast:person>` for host and guest (role + image href).

**Apple auto-generates transcripts (since 2024-03) and chapters (iOS 26.2), but auto-chapters only fire when the creator supplied none** — your manual `podcast:chapters` always wins, so supply them when timestamps matter. (Apple Newsroom 2024-03; Castopod/TechBuzz iOS 26.2 coverage — accessed 2026-06-02.)

**Submission reality.** A feed needs **at least one published episode** before you can submit it — Apple requires it and Spotify for Creators hides RSS distribution until the first episode ships. Apple review can take **up to 72 hours**; most hosts publish new episodes within hours. (VNYL RSS guide; RSS.com; Spotify for Creators — accessed 2026-06-02.)

## Show notes

Top-ranking show notes are **blog-shaped, ~1,500+ words**, not a one-paragraph blurb. Timestamps are both a UX and an SEO signal. (Sweetfish "Show Notes Template"; Increv "SEO show notes 2025" — accessed 2026-06-02.)

Template:

```text
H1            target keyword as the episode title
Summary       2-3 sentences, keyword-bearing, what the listener gets
Chapters      timestamped list (00:00 Intro / 04:12 …) mirroring chapters.json
Takeaways     3-5 bullets — the episode's claims, skimmable
Guest         short bio + links (site, social)
Resources     every tool/book/link mentioned
CTA           one ask (subscribe / a specific URL)
```

**Title craft** — specific and outcome-bearing beats sequential:

```text
Bad   "Episode 12"
Good  "Episode 12: How Marta scaled a solo SaaS to $40k MRR without ads"
```

Embed `PodcastEpisode` JSON-LD on the page (name, datePublished, duration as ISO-8601 `PT35M`, `associatedMedia` → the MP3, `partOfSeries` → the show) so the episode is eligible for rich results — see `references/rss-and-namespace.md` for the block.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
| --- | --- | --- |
| Mastering a separate file per platform | Spotify turns down anything over -14 anyway; you just add work and risk inconsistency | Master once to -16 LUFS stereo / -1 dBTP |
| Editing the recorded Zoom/Meet mixdown | Compressed, single-track, drops out with bandwidth; unrecoverable | Double-ender local 48 kHz WAV, one track per speaker |
| Tracking hot toward 0 dBFS | Clipped peaks are permanent; loudness is a master-stage fix, not a mic-gain fix | Track to ~-18 dBFS peaks, set loudness at the master |
| `<podcast:transcript>` without a `type` | Apps cannot parse it; the tag is ignored | Always include `type=` (`text/vtt`, `application/srt`, `application/json`) |
| Wrong/blank `<enclosure length>` | Breaks the player scrubber and progress | Use the MP3's exact size in bytes |
| Changing `<guid>` after publish | Apps treat it as a brand-new episode — duplicates the feed | Set a stable guid once; never change it |
| 1024×1024 or non-square cover art | Below the 1400 px floor / non-square → feed rejected | Square JPG/PNG, RGB, 1400-3000 px |
| Show notes as a one-paragraph summary | No keywords, no timestamps → no ranking, no UX value | Blog-shaped ~1,500 words with timestamped chapters + takeaways |
| Relying on Apple auto-chapters when timing matters | Auto-chapters only fire when you supplied none, and you lose control of titles | Ship a manual `chapters.json` via `podcast:chapters` |

## Hand-offs

- Clip the episode into posts for X/LinkedIn/IG and schedule them → `../social-publisher/SKILL.md`.
- Cut the vertical/short video of a moment → `../video-shorts/SKILL.md`.
- Write the email that announces the episode to the list → `../newsletter/SKILL.md`.
- Define the show's tone/persona the episode should sound like → `../brand-voice/SKILL.md`.
- Decide *which* episodes exist and the cadence across the catalog → `../content-engine/SKILL.md`.

## References

- `references/rss-and-namespace.md` — required + recommended iTunes/RSS channel and item tags, a full annotated `<item>` example, the Podcasting 2.0 tag set with attributes (`transcript`, `chapters`, `person`, `funding`, `season`, `episode`), a sample `chapters.json`, a `transcript.vtt` snippet, and the `PodcastEpisode` JSON-LD block.

After you emit a `chapters.json`, a feed/`<item>`, or a `transcript.vtt`, run `scripts/verify.sh <dir-or-file>` to lint the shape (parse, monotonic startTimes, required enclosure attributes, transcript `type`, artwork size).
