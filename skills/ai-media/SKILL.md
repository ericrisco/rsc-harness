---
name: ai-media
description: "Use when a creative goal must become a finished media file: pick and order generative-media models per modality — AI voiceover, image-to-video clips, score — then glue them with ffmpeg (mux, duck, loudnorm, concat). NOT still-image generation/editing (that is `replicate-images`); NOT code-rendered React compositing (that is `remotion-video`)."
tags: [ai-media, text-to-speech, image-to-video, voiceover, music-generation, ffmpeg, media-pipeline, elevenlabs]
recommends: [replicate-images, fal, replicate, remotion-video, video-shorts]
origin: risco
---

# ai-media

You are the cross-modal director. You decide **which** generative-media model to call per modality, in **what order**, with **what params**, then **assemble** the pieces with ffmpeg into one finished file. You do not own a single provider's API surface and you do not prompt still images — you orchestrate and glue.

## Pipeline shape — decide what the goal needs

Map the goal to modalities and an ordered step list, and **lock that plan before you generate a single asset** — media generation is slow and metered, so a re-roll of a 10 s Veo clip or a 90 s music track costs real money and minutes. Fixing the scene list, aspect ratio, target loudness and model per modality *first* is cheaper than discovering at mux time that your clips are 9:16 and your VO is the wrong sample rate. The "delegate to" column is where the actual call mechanics live — you pick the model and params, those skills run the call.

| Goal | Needs | Ordered steps | Delegate calls to |
|------|-------|---------------|-------------------|
| Narrated explainer | stills + img→video + VO + music | script → per-scene stills → clip per scene → VO → music → conform → concat → mix+duck → loudnorm → MP4 | `replicate-images`, `fal`/`replicate` |
| Product teaser (1 hero) | 1 still + img→video + music | still → clip → music → mix → loudnorm → MP4 | `replicate-images`, `fal`/`replicate` |
| Faceless short | stills + img→video + VO + music + captions | (explainer pipeline) + burn captions | `replicate-images`; `../video-shorts/SKILL.md` for the script |
| Just a voiceover | VO only | script → TTS → loudnorm | — |
| Just a clip from a still | img→video only | still (input) → clip | `fal`/`replicate` |
| Code-rendered explainer | none of the above | render from React/TS | **stop — route to `remotion-video`** |

If the video is *rendered from data/code* (charts, timelines, JSON-driven scenes), this is not your job → `../remotion-video/SKILL.md`. You handle *model-generated + ffmpeg-glued*.

## Modality 1 — Voice (TTS)

ElevenLabs Python SDK. The call is `convert(text, voice_id, model_id, output_format)`; auth via `ELEVENLABS_API_KEY`.

```python
from elevenlabs.client import ElevenLabs

client = ElevenLabs()  # reads ELEVENLABS_API_KEY
audio = client.text_to_speech.convert(
    text="Your narration script here.",
    voice_id="JBFqnCBsd6RMkjVDRZzb",
    model_id="eleven_multilingual_v2",     # final-quality VO
    output_format="mp3_44100_128",          # codec_samplerate_bitrate
)
with open("vo.mp3", "wb") as f:
    for chunk in audio:
        f.write(chunk)
```

Pick the model tier by what the job needs:

| Model | When | Latency | Cost lever |
|-------|------|---------|-----------|
| `eleven_v3` | most expressive, hero final VO — **verify availability first (see caveat)** | higher | most credits/char |
| `eleven_multilingual_v2` | high-quality multilingual VO (default for finals) | medium | medium |
| `eleven_flash_v2_5` | real-time / batch / scale / drafts | ~75 ms | cheapest |

**Do not hardcode `eleven_v3` blind.** It shipped to the API in *alpha* (Aug 2025) and the docs model list now carries it, but the `text_to_speech.convert` API reference still documents the default as `eleven_multilingual_v2` and does not enumerate `eleven_v3` as a guaranteed value. Before you build a final pass on it, confirm it returns from `GET /v1/models` for your key (or just call once and check) — otherwise default to `eleven_multilingual_v2`, which is the safe, always-available hero tier.

`output_format` is `codec_samplerate_bitrate` — e.g. `mp3_44100_128`, `mp3_22050_32`. **Match the VO sample rate to your assembly target**, do not master the VO loud and hope.

Bad → Good:
- **Bad:** generate VO at `mp3_22050_32`, then mux onto a 48 kHz video — ffmpeg silently resamples, you get artifacts and a level mismatch.
- **Good:** generate VO at the rate you will master at (e.g. `mp3_44100_128`), and set final loudness with `loudnorm` in assembly, not by cranking the TTS.

TTS is billed per character/token (~0.5–1 credit/char on the Flash/Turbo lines). ElevenLabs cut *TTS* API pricing up to 55% on 2026-05-07 (e.g. Flash on Creator $0.11→$0.05 / 1k tokens) — that figure is TTS-specific, not the Music cut. **Pricing staling fast: these are point-in-time numbers from elevenlabs.io/pricing/api as of 2026-06-02 — re-check the page before quoting a budget.** Shorter scripts and Flash on drafts are the cost levers.

## Modality 2 — Image-to-video

**The still is an input, not your output.** Generate or edit the source image in `../replicate-images/SKILL.md`, then animate it here. Reality check: every serious 2026 model does 1080p or native 4K — **resolution is no longer the differentiating axis**. The hard limit is **per-generation duration (~5–15 s, model-dependent)**. Long pieces are **one clip per scene, then concat** — never one long take.

Durations below are from each vendor's own pages (as of 2026-06; see `references/models-and-params.md` for the citations) — they move with releases, so verify on the catalog before a final run:

| Model | Duration | Aspect / max res | Control surface | Native audio | Open-source |
|-------|----------|------------------|-----------------|--------------|-------------|
| Google **Veo 3.1** | **8 s** / generation | 16:9 / 9:16, up to 4K | high | **yes** — synced 48 kHz dialogue/SFX | no |
| **Kling 3.0** | **up to 15 s** | flexible, 4K | strong identity/temporal, lip-sync | no | no |
| **Runway Gen-4.5** | **2–10 s** | flexible | **best** — motion brushes, camera control, reference image | no | no |
| **MiniMax Hailuo 02** | **6 s or 10 s** (1080p caps at 6 s) | up to 1080p | medium | no | no |
| **Wan 2.6** | **up to 15 s** | up to 1080p | first/last-frame control, A/V sync | no (sync) | **yes** (Apache) |

Choose by the binding constraint: need synced dialogue → Veo 3.1; need precise camera/motion control → Runway Gen-4.5; need identity consistency across scenes or the longest single take → Kling 3.0 / Wan 2.6; need open-source/self-host → Wan 2.6; cost-sensitive 1080p → Hailuo 02. Endpoint ids and per-call mechanics live in `../fal/SKILL.md` / `../replicate/SKILL.md` (both rails carry these models). See `references/models-and-params.md` for endpoint ids and current limits.

## Modality 3 — Music / score

Costs are per-minute and plan-dependent — treat them as approximate and **verify on the vendor pricing page** (figures as of 2026-06; sources in `references/models-and-params.md`):

| Model | Cost (approx, verify) | Licensing story | Control |
|-------|-----------------------|-----------------|---------|
| **ElevenLabs Music v2** | per-minute, ~$0.15–0.50/min depending on plan (Music API pricing cut up to 50% at v2 launch — separate from the 55% *TTS* cut) | **cleanest** — vendor states trained *only on licensed data, cleared for commercial use* (Believe collaboration named at launch) | genre-switch mid-track |
| **Suno v5** | plan-based | usage rights on paid plans post Nov-2025 label settlements (rights, not ownership) | vendor blind-test benchmark ELO ~1293 |
| **Udio** | $30/mo Pro plan (commercial rights); **no official public API** — third-party gateways only | UMG-licensed platform announced for 2026 | — |

**Confirm commercial rights before you ship.** Licensing differs per model and per plan; "I generated it" is not "I may sell the ad with it." For a clean commercial story with an official API, ElevenLabs Music v2 is the safe default — Udio has no first-party API, so do not plan a programmatic pipeline around it. The rest is the same fal/replicate call mechanics.

## Assembly with ffmpeg

Four operations. Each is a copy-paste recipe; full filter graphs, caption burning and pitfalls are in `references/ffmpeg-assembly.md`.

**(a) Mux VO onto video** — map both streams, copy video, take the shorter duration:

```bash
ffmpeg -i scene.mp4 -i vo.mp3 \
  -map 0:v -map 1:a -c:v copy -shortest out.mp4
```

**(b) Duck music under the VO** — `sidechaincompress` keys the music off the voice so it drops when narration plays (pro DAW ducking, no manual keyframes):

```bash
ffmpeg -i vo.mp3 -i music.mp3 -filter_complex \
  "[1:a][0:a]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[duck]; \
   [0:a][duck]amix=inputs=2:duration=longest[aout]" \
  -map "[aout]" -c:a aac mix.m4a
```

Cheaper static fallback when sidechain is overkill — fix the music low under a full VO:

```bash
ffmpeg -i vo.mp3 -i music.mp3 -filter_complex \
  "[1:a]volume=0.3[m];[0:a][m]amix=inputs=2:duration=longest[aout]" \
  -map "[aout]" mix.m4a
```

**(c) Loudnorm to a target LUFS (two-pass)** — measure, then apply. Target -14 LUFS for social/streaming, -16 for podcast-style VO. Normalize per track *before* mixing.

```bash
# pass 1: measure (read the JSON it prints)
ffmpeg -i mix.m4a -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -
# pass 2: apply with the measured values
ffmpeg -i mix.m4a -af \
  loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-20.1:measured_TP=-4.2:measured_LRA=6.0:measured_thresh=-30.8:offset=0.5:linear=true \
  master.m4a
```

**(d) Concat scenes — conform first.** Same-codec/res/fps clips → fast demuxer with `-c copy`. Mismatched clips → re-encode and scale first, then concat. **Never `-c copy`-concat mismatched clips** — you get desync or a corrupt stream.

```bash
# all clips identical codec/res/fps:
printf "file '%s'\n" scene1.mp4 scene2.mp4 scene3.mp4 > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy joined.mp4

# mismatched: conform each, then concat filter
ffmpeg -i s1.mp4 -i s2.mp4 -filter_complex \
  "[0:v]scale=1920:1080,fps=30,setsar=1[v0];[1:v]scale=1920:1080,fps=30,setsar=1[v1]; \
   [v0][1:a?][v1][1:a?]concat=n=2:v=1:a=0[v]" -map "[v]" joined.mp4
```

## End-to-end worked pipeline (narrated explainer)

Ordered command list — generate once, assemble deterministically:

1. **Lock the plan** — scene list, aspect (e.g. 16:9 1080p 30fps), target -14 LUFS, models chosen.
2. **Stills per scene** → `../replicate-images/SKILL.md` (one prompt per scene).
3. **Clip per scene** (img→video, ~5–15 s each, model cap) via your chosen model on `fal`/`replicate`.
4. **VO** → ElevenLabs `convert(...)` at the master sample rate.
5. **Music** → ElevenLabs Music v2, length = total runtime, confirm rights.
6. **Conform** every clip to 1920x1080/30fps/SAR 1.
7. **Concat** the conformed clips → `body.mp4`.
8. **Loudnorm** VO and music tracks (two-pass) to consistent levels.
9. **Mix + duck** music under VO → `mix.m4a`.
10. **Final loudnorm** the mix to -14 LUFS → `master.m4a`.
11. **Mux** `master.m4a` onto `body.mp4` with `-shortest` → `final.mp4`.

Emit this as a runnable script. `scripts/verify.sh` lints it (loudnorm present, conform-before-concat, final MP4 target).

## Cost & regen discipline

- **Draft small, then final.** Generate clips short/low-res and VO on Flash to lock timing and the cut; only the final pass spends on hero quality. Re-rolling locked scenes is the biggest waste.
- **Per-modality levers:** shorter scripts (TTS per-char), fewer scene re-rolls (img→video), fewer music minutes (music is billed per minute — verify the current rate on the vendor pricing page).
- Spend tracking *as a discipline* → `../fal/SKILL.md` / `../replicate/SKILL.md` for per-call cost; treat budget as a constraint you set before generating.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|--------------|--------------|------------|
| Generating assets before locking the pipeline | aspect/sample-rate/duration mismatches surface at mux time, forcing paid re-rolls | lock scene list, aspect, LUFS, models first |
| One long video-gen call for the whole piece | models cap at ~5–15 s; you fight the limit and waste rolls | one clip per scene, then concat |
| Mixing tracks without per-track `loudnorm` | VO buried or blasting over music; inconsistent levels | two-pass loudnorm each track before mix |
| `-c copy`-concat of mismatched clips | desync, corrupt stream, wrong frame timing | conform res/fps/SAR, then concat |
| Music low set by ear / static only when VO needs space | narration gets masked under the bed | `sidechaincompress` keyed off the VO |
| Shipping generated music without checking rights | "generated" ≠ "licensed to sell" — legal exposure | confirm commercial rights per model/plan |
| Prompting/editing the still inside this skill | duplicates `replicate-images`' job, worse prompts | delegate the still, consume it here |
| Mastering loudness by cranking the TTS | clipping, no true-peak control | set level with `loudnorm`, not the generator |
