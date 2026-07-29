---
name: shortform-editing
description: "Use when you have raw 9:16 footage and need it cut into a post-ready vertical short — dead air removed, fast jump cuts, karaoke word-by-word burned-in captions from a transcript, cuts and zooms snapped to the music beat, safe-area placement so captions clear the platform UI, and a platform-correct MP4 export. NOT writing the script, hook, beats or caption text (that is `video-shorts`), NOT building a Remotion React composition codebase (that is `remotion-video`), NOT deciding when or where to post (that is `social-publisher`)."
tags: [video-editing, shortform, captions, ffmpeg, whisper, beat-sync, vertical-video]
recommends: [video-shorts, remotion-video, shortform-packaging, social-publisher, podcast]
origin: risco
---

# Shortform Editing — Cut the Footage Into a Posted-Ready Short

*You are the edit-bay technician.* Someone hands you real footage — a talking-head take, a screen recording, a voiceover, some B-roll — and you turn it into a vertical short that is ready to post: silences gone, cuts fast, captions burned in word-by-word, motion snapped to the beat, exported to spec. You encode pixels and timing. You do not write the words or pick the hook.

The rigor is a **checkable file**: a `1080x1920` H.264 MP4 with burned captions that `ffprobe` confirms, plus the intermediate artifacts (a cut list, an `.ass`/`.srt`, a beat grid). If you cannot `ffprobe` the result and see the specs, you are not done.

## Scope: three skills touch "a vertical video" — know your lane

| The ask | Goes to | Artifact |
|---|---|---|
| Write the script, hook, beats, on-screen caption *text*, edit decision sheet | `../video-shorts/SKILL.md` | a `.md` script |
| Cut/caption/export real footage, tool-agnostic | **here** | edited `.mp4` + caption/cut files |
| Build a Remotion React composition project (`<TransitionSeries>`, headless render) | `../remotion-video/SKILL.md` | a `.tsx` project |

One-line router: **footage in → cut, captioned, exported → this skill.** Words or a plan → `video-shorts`. A React codebase → `remotion-video`. You are the only one of the three that is tool-portable.

## Pick your route first

Do not start cutting before you have chosen the tool. The choice is about who runs it and whether it must reproduce.

| Situation | Route | Why |
|---|---|---|
| Reproducible / batch / CI / "do this to 40 clips" | **ffmpeg + WhisperX** | scriptable, deterministic, no GUI — same input, same output |
| The repo is already a Remotion project | **`@remotion/captions`** | reuse the existing composition graph; don't shell out |
| A human is polishing one video by hand | **CapCut click-path** | fastest for a single hands-on pass with auto-captions + auto beat markers |

The rest of this skill is the **ffmpeg + WhisperX pipeline** (the reproducible path), with the Remotion and CapCut routes called out where they diverge. Long command blocks live in `references/ffmpeg-pipeline.md`; the caption detail lives in `references/captions.md`.

## The reproducible pipeline, in order

This is the spine. Run it top to bottom; each step feeds the next.

**1. Extract a clean mono 16 kHz audio track for transcription.**

```bash
ffmpeg -i in.mp4 -vn -ac 1 -ar 16000 a.wav
```

*Why mono 16 kHz: that is what Whisper models expect; feeding stereo 48 kHz wastes time and changes nothing about accuracy.*

**2. Transcribe with word-level timestamps.** Segment timestamps are not enough — word-by-word captions need per-word timing.

```bash
whisperx a.wav --model large-v3 --output_format json --highlight_words True
```

WhisperX (v3.8.5) runs faster-whisper plus wav2vec2 forced alignment, giving word timing accurate to **under 100 ms** — the floor for karaoke highlight. faster-whisper alone with `word_timestamps=True` works (~10% overhead) but drifts more on word boundaries. *Why forced alignment: Whisper's native word stamps are interpolated and jitter; forced alignment pins each word to the audio.* See `references/captions.md` for the install and the JSON shape.

**3. Detect silence, then cut video AND audio together.** This is the step people get wrong.

```bash
# Pass 1: find the silent ranges (speech threshold)
ffmpeg -i in.mp4 -af silencedetect=noise=-25dB:d=0.3 -f null - 2> silence.log
```

`silenceremove` alone is an **audio-only filter and desyncs the video** — never use it as a one-shot. Parse the `silence_start` / `silence_end` lines from `silence.log`, invert them into keep-ranges, and build a `select` + `aselect` filter (or a trim+concat graph) that drops the same ranges from both streams. Thresholds: speech `noise=-25dB:d=0.3`; music beds `noise=-40dB:d=1`. The filter-generation snippet is in `references/ffmpeg-pipeline.md`.

**4. Build the beat grid** (only if you are cutting to music).

```bash
python -c "import librosa; y,sr=librosa.load('music.wav'); \
_,b=librosa.beat.beat_track(y=y,sr=sr,units='time'); print(*b,sep='\n')" > beats.txt
```

`beats.txt` is a list of beat times in seconds. CapCut drops these markers on the waveform automatically; librosa (or aubio) gives you the same grid in a script.

**5. Snap cut points and zoom keyframes to the nearest beat.** Round each cut time to its closest value in `beats.txt`. A zoom-punch on the beat reads as energy; see Beat sync below for when NOT to.

**6. Burn the karaoke `.ass` captions.**

```bash
ffmpeg -i tightened.mp4 -vf "ass=captions.ass" -c:a copy captioned.mp4
```

The `.ass` carries the per-word `\k` timing built from step 2's word timestamps and the safe-zone margins. Generation detail and the template are in Karaoke captions below.

**7. Export the platform master** (see Export specs).

## Karaoke captions

Word-by-word captions are the signature look. Build them from the word timestamps, not from segment timestamps.

- **Timing.** Each word's on-screen highlight comes from its forced-alignment start/end. In `.ass`, the `\k<centiseconds>` tag advances the karaoke fill per word. Word-by-word from *segment* timing jitters and lands the highlight on the wrong word — always use the per-word stamps from step 2.
- **Legibility for sound-off.** Big bold sans, heavy outline/stroke, optional drop shadow. People watch muted: if it is not readable at a glance on a phone, it failed. Keep it to **≤ 2 lines / ~6 words** on screen at once.
- **Safe zone — the non-obvious one.** Place captions in the **vertical middle band**, not the bottom. Platform UI (right-rail icons, bottom caption/CTA/profile) covers the bottom ~15–20% and the right edge. Keep captions and key text inside the central ~80% of the `1080x1920` frame. Captions burned at the bottom get hidden behind the TikTok buttons — this is the #1 "my captions are broken" cause.

Minimal `.ass` style block (full template in `references/captions.md`):

```text
[V4+ Styles]
Style: Karaoke,Montserrat,64,&H00FFFFFF,&H0000FFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,5,2,5,80,80,640,1
```

`MarginV` (the trailing `640`) lifts the line into the middle band; the heavy `Outline` (`5`) keeps it readable on any background.

**Remotion route:** if you are inside a Remotion project, use `@remotion/captions` — `createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds })` pages the tokens. Low (200–500 ms) = word-by-word pop; high (1200–2000 ms) = phrase pages. Page `durationMs` was added in v4.0.261. **CapCut route:** Text → Auto captions → Generate, then restyle.

## Beat sync

A beat grid (step 4) is a list of seconds. Snap your cut points and zoom keyframes to the nearest beat so motion lands on the music.

- **Bad → Good.** Cutting mid-word to land a cut exactly on a beat reads as a mistake → nudge the cut to the nearest beat that also respects the speech boundary. Honor the words first, the beat second.
- **When NOT to beat-cut.** A talking-head explainer where the words carry the value: clarity beats rhythm. Beat-cutting a person mid-sentence chops their delivery. Reserve beat sync for B-roll montages, transitions, and music-led segments.
- **Transitions stay cheap and fast.** Hard cut is the default. Whip-pan or zoom-punch only on a beat. Avoid 1-second crossfades in a 30-second short — they kill the pace; a short lives on fast hard cuts.

## Export specs

The universal vertical master — one file that plays cleanly across all three platforms:

```bash
ffmpeg -i captioned.mp4 \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart out.mp4
```

`yuv420p` (broad playback), `+faststart` (web streaming starts before full download), AAC-LC 48 kHz. Use 30 fps; bump to **60 fps for high-motion** Shorts.

| Platform | Video bitrate | Notes |
|---|---|---|
| TikTok | ~2,000–4,000 kbps | lightest of the three |
| Instagram Reels | ~3,500–4,500 kbps | |
| YouTube Shorts (1080p) | ~8,000–15,000 kbps | up to ~53,000 for 4K/60 |

A single `1080x1920` H.264 MP4 @30 fps under **~250 MB** is safe everywhere. Verify before you ship:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,codec_name,avg_frame_rate out.mp4
```

Expect `width=1080 height=1920 codec_name=h264`. The full per-platform encode flags and `ffprobe` assertions are in `references/ffmpeg-pipeline.md`.

## Anti-patterns

| Bad | Why it breaks | Good |
|---|---|---|
| `silenceremove` as a one-shot filter | It is audio-only; the video keeps playing → audio/video desync | `silencedetect` → invert ranges → `select`+`aselect` cut both streams |
| Word captions from segment timestamps | Highlight jitters and lands on the wrong word | Forced-alignment per-word stamps (WhisperX / `word_timestamps`) |
| Captions burned in the bottom 15–20% | Platform UI (buttons, CTA, profile) covers them | Place in the vertical middle band, central ~80% |
| One export reused for every platform | Over/under the bitrate target somewhere | Per-platform bitrate, or the safe universal master |
| 1-second crossfades in a 30s short | Kills the pace; reads slow | Hard cuts; whip/zoom only on a beat |
| Beat-cutting a talking-head mid-sentence | Chops the delivery; clarity lost | Beat-sync B-roll/montage only; honor speech boundaries |
| Re-running the encode to "check the specs" | Wastes minutes; the file already exists | `ffprobe` the output; verify, don't re-render |
| Writing the caption copy or the hook here | That is the script, not the cut | Route to `../video-shorts/SKILL.md`; you only burn it in |
| `ffmpeg` overwriting the source in place | One bad flag and the original is gone | Always write to a new file; keep `in.mp4` untouched |

## Verify & references

- `bash scripts/verify.sh <output.mp4>` — runs `ffprobe` and asserts `width=1080`, `height=1920` (9:16), video codec `h264`, audio codec `aac`, fps in `{30, 60}`, and that a sibling `.srt`/`.ass` caption file exists and is non-empty. With no `ffprobe` it falls back to a path/extension check. Read-only; exits 0 on an empty/clean target so it never false-fails. The "does it feel on-beat" judgment is not mechanical — that lives in the capability eval.
- `references/ffmpeg-pipeline.md` — the full silence-detect → keep-range inversion → `select`/`aselect` filter generation that cuts video+audio together, the concat/trim approach, per-platform encode flags, `ffprobe` assertions, and desync/audio-drift/faststart troubleshooting.
- `references/captions.md` — WhisperX install + run, the word-timestamp JSON shape, the full `.ass` karaoke template with safe-zone margins, the Remotion `createTikTokStyleCaptions()` snippet with `combineTokensWithinMilliseconds` guidance, and the faster-whisper vs WhisperX tradeoff.
