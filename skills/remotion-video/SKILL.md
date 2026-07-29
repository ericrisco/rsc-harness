---
name: remotion-video
description: "Use when you need to render an actual video file with Remotion — React compositions, the Composition/Sequence/TransitionSeries graph, transitions, burned-in word-by-word captions from a transcript, automatic silence removal, b-roll overlays, headless CI renders, and a final MP4 or MOV. NOT writing the script, hook, beats or caption text (that is `video-shorts`), NOT mastering audio to LUFS or building an RSS feed (that is `podcast`), NOT structuring the narrative arc (that is `course-storytelling`)."
tags: [remotion, video-rendering, react, captions, ffmpeg, whisper, youtube]
recommends: [video-shorts, podcast, course-storytelling, youtube-packaging, nextjs]
origin: risco
---

# Remotion Video — Encode the Actual Frames

*You are the encoder and renderer.* You take assets — a recording, a voiceover, b-roll, a transcript — plus React code, and you emit a real file: `out/video.mp4`. Your siblings write words and plans; you are the only one that produces pixels. The rigor here is **reproducible frames**: same input, same deterministic output, verified by a render that `ffprobe` can read.

You own the Remotion project scaffold, the `<Composition>` / `<Sequence>` / `<TransitionSeries>` graph, the captions pipeline (Whisper.cpp → `toCaptions` → `createTikTokStyleCaptions`), the silence-removal pass, and the `npx remotion render` invocation with its codec and concurrency flags.

## The one decision: frames or words?

If the ask is to produce a file, you are in the right place. If it is to produce text or a plan, route out before writing a single `.tsx`.

| The ask | Goes to | Why |
|---|---|---|
| Produce an MP4/MOV, transitions, burned captions, render | **here** | These are pixels and frames |
| Write the script, hook, beats, on-screen caption *text*, edit decision sheet | `../video-shorts/SKILL.md` | Those are words; the cut decisions, not the cut execution |
| Master audio to a LUFS target, produce chapters + RSS `<item>` | `../podcast/SKILL.md` | Audio mastering and feed, not video encode |
| Structure the lesson/video narrative arc and flow | `../course-storytelling/SKILL.md` | Narrative architecture, not rendering |
| Design the thumbnail image | `../youtube-thumbnails/SKILL.md` | A still image, not a video |

Boundary in one line: **video-shorts decides the cuts and writes the caption text; you execute the cuts in code and burn the captions into frames.**

## Scaffold the project

```bash
npx create-video@latest --yes --blank my-video
cd my-video
npm i
npm run dev        # opens Remotion Studio in the browser
```

Remotion's current stable line is **4.0.471**; it needs Node 16+ (or Bun 1.0.3+), and local rendering targets macOS 15 (Sequoia)+. Since **January 2026** Remotion ships Agent Skills — `npx skills add remotion-dev/skills` wires Remotion-aware guidance into Claude Code. Run it inside a Remotion project when you want the framework's own skill loaded alongside this one.

**Pin fps and dimensions on `<Composition>` first, and never change them mid-project.** *Why: every duration downstream is measured in frames, and `frames = seconds * fps`. Change fps after you have written durations and every timing silently shifts.* Vertical shorts are `1080×1920 @ 30`; landscape is `1920×1080 @ 30`.

## The composition graph

```tsx
// src/Root.tsx
import { Composition } from "remotion";
import { MyVideo } from "./MyVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MyVideo"            // the id you pass to `remotion render`
      component={MyVideo}
      durationInFrames={300}  // 10s at 30fps
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
```

```tsx
// src/MyVideo.tsx
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const MyVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const scale = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>{/* scene 1 */}</AbsoluteFill>
      </Sequence>
      <Sequence from={90} durationInFrames={210}>{/* scene 2 */}</Sequence>
    </AbsoluteFill>
  );
};
```

Animate off `useCurrentFrame()` with `interpolate()` and `spring()` only. **Never read wall-clock time (`Date.now()`) or call `Math.random()` unseeded inside a composition.** *Why: rendering is parallel and frame-addressable — each frame is computed independently, so any non-frame input produces a different pixel on re-render and breaks the "same input, same output" guarantee.* If you need randomness, use Remotion's `random(seed)`.

## Transitions

Use `@remotion/transitions` (available since **v4.0.53**). `<TransitionSeries>` interleaves `.Sequence` (a clip, with `durationInFrames`) and `.Transition` (a `presentation` + a `timing`). The transition duration is *subtracted* from the total, so adjacent sequences overlap during the wipe.

```tsx
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { Easing } from "remotion";

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={90}>{/* scene A */}</TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={slide({ direction: "from-left" })}
    timing={springTiming({ config: { damping: 200 }, durationInFrames: 30, durationRestThreshold: 0.001 })}
  />
  <TransitionSeries.Sequence durationInFrames={120}>{/* scene B */}</TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: 15, easing: Easing.inOut(Easing.ease) })}
  />
  <TransitionSeries.Sequence durationInFrames={90}>{/* scene C */}</TransitionSeries.Sequence>
</TransitionSeries>
```

Each presentation is a sub-import (`@remotion/transitions/slide`, `/fade`, `/wipe`, `/flip`, `/clockWipe`, `/none`).

| Presentation | Feel / when |
|---|---|
| `slide` | Scene pushes the next in; directional momentum between beats |
| `fade` | Soft crossfade; calm, neutral scene change |
| `wipe` | A hard edge sweeps across; energetic, "next topic" |
| `flip` | 3D card flip; playful, for reveals |
| `clockWipe` | Radial sweep; countdowns, "time passing" |
| `none` | A hard cut with no motion, but still as a TransitionSeries node |

**`linearTiming` for predictable, frame-exact cuts; `springTiming` for organic motion.** *Why: linear is deterministic in duration so you can budget frames exactly; spring overshoots and settles, which reads as natural but needs `durationRestThreshold` so the render knows when it has finished.*

## Animated burned-in captions

The native `@remotion/captions` package shipped in **v4.0.216** (the same release that deprecated the old `convertToCaptions()` helper). The pipeline runs once on a Node server, then the composition reads the captions:

1. **Transcribe.** `@remotion/install-whisper-cpp` downloads Whisper.cpp and a model (`medium.en` is ~1.5 GB) and transcribes the audio on a Node server to Whisper JSON.
2. **Convert.** `toCaptions()` from `@remotion/install-whisper-cpp` turns that JSON into a `Caption[]` with per-token timestamps. *(`convertToCaptions()` is the legacy alias — deprecated as of v4.0.216; use `toCaptions()`.)*
3. **Segment into pages.** `@remotion/captions` `createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds })` groups tokens into "pages" that appear together.

**The `combineTokensWithinMilliseconds` value is the page-size dial.** *Why: a low value (~200ms) keeps each word on its own page → word-by-word pop animation; a high value (~1200ms) packs a phrase per page.* Low ms = TikTok word-by-word energy; high ms = readable phrases. Pick by the format, not by default.

Full Whisper.cpp install, the transcribe server, and the token-highlight caption renderer component (with safe-zone styling) live in `references/captions-pipeline.md` — read it before building the captions layer.

## Automatic silence removal

**The silence pass runs on the source audio/video BEFORE it enters Remotion**, not inside a composition. *Why: Remotion renders frames you give it; trimming dead air is an upstream edit on the asset, and doing it first means every downstream frame number already reflects the tightened timeline.*

Use `auto-editor` (a Python + ffmpeg engine) for a first pass that cuts dead space by audio loudness:

```bash
auto-editor input.mp4 --margin 0.2s --edit audio:threshold=4% -o tightened.mp4
```

- `--margin` pads each kept region so cuts do not clip speech.
- `--edit audio:threshold=4%` sets the loudness floor below which a region is "silence".
- `--export premiere` emits an EDL/XML instead of a file, to re-import into an NLE.

**pip distribution is stale/discontinued — install via the official binary or `pipx`, not `pip install`.** *Why: the PyPI package lags behind and may not match the documented flags.* When `auto-editor` is unavailable, the low-level fallback is ffmpeg's `silencedetect` / `silenceremove` filters. Both, with the full flag matrix, are in `references/render-and-pipeline.md`.

## B-roll overlays

Stack the overlay above the main video by layering `<OffthreadVideo>` (or `<Img>`) inside an `<AbsoluteFill>`, gated by a `<Sequence from>`:

```tsx
import { AbsoluteFill, Sequence, OffthreadVideo, staticFile } from "remotion";

const fps = 30;
const broll = { start: 4.0, duration: 3.0 }; // seconds
<AbsoluteFill>
  <OffthreadVideo src={staticFile("main.mp4")} />        {/* base layer */}
  <Sequence from={Math.round(broll.start * fps)} durationInFrames={Math.round(broll.duration * fps)}>
    <AbsoluteFill style={{ /* e.g. inset for picture-in-picture */ }}>
      <OffthreadVideo src={staticFile("broll.mp4")} />    {/* overlay layer */}
    </AbsoluteFill>
  </Sequence>
</AbsoluteFill>
```

**Convert every timecode to frames with `Math.round(seconds * fps)`, once, at the edge.** *Why: a b-roll cue at 4.0s is frame 120 at 30fps but frame 240 at 60fps — keep seconds in your data and multiply by `fps` from `useVideoConfig()` so changing fps never desyncs overlays.* Use `<OffthreadVideo>` (not the DOM `<video>` or `<Video>`) for frame-accurate decoding during render.

## Render

```bash
# region test first: 1-2 seconds, validates the pipeline cheaply
npx remotion render MyVideo out/test.mp4 --frames=0-45

# then the full render
npx remotion render MyVideo out/video.mp4
```

Omit the composition id to get an interactive picker. Configure via `@remotion/cli/config` in `remotion.config.ts`, or pass flags on the CLI (flags win):

```ts
// remotion.config.ts
import { Config } from "@remotion/cli/config";
Config.setConcurrency(8);
Config.setCodec("h264");
```

| Codec | Use | Flag |
|---|---|---|
| `h264` | Default for web/YouTube; broad compatibility | (default) |
| `h265` | Smaller files, same quality; less universal playback | `--codec=h265` |
| `prores` | Edit-grade master, large files, re-import to an NLE | `--codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png` |
| `vp8` / `gif` | Web-alpha or looping previews | `--codec=vp8` / `--codec=gif` |

**Always render a 1–2s region (`--frames=0-45`) before the full render.** *Why: a full render of a minutes-long composition costs real time and CPU; a region test surfaces a broken caption layer or missing asset in seconds.* For headless/CI renders, deterministic-output rules, and the codec/quality matrix in full, see `references/render-and-pipeline.md`.

## Anti-patterns

| Bad | Why it breaks | Good |
|---|---|---|
| Hardcoding durations in seconds inside JSX | Remotion thinks in frames; seconds desync the moment fps changes | Store seconds in data, `Math.round(seconds * fps)` at the edge |
| `Date.now()` / unseeded `Math.random()` in a composition | Frames render in parallel and on re-render → non-deterministic pixels | Drive everything off `useCurrentFrame()`; use `random(seed)` |
| Changing `fps` after writing durations | Every frame-count downstream silently shifts | Pin fps + dimensions on `<Composition>` up front, leave them |
| Re-downloading the Whisper model every run | The ~1.5 GB `medium.en` download repeats and stalls the pipeline | Download once, cache the model path, reuse it |
| Committing the 1.5 GB Whisper model to git | Bloats the repo; the model is a build asset | `.gitignore` the model dir; fetch it in setup/CI |
| Rendering the full video to test a change | Minutes of wasted render to find a broken layer | `--frames=0-45` region test, then full render |
| Writing the caption *copy* or hook here | That is the script, not the encode | Route to `../video-shorts/SKILL.md`; you only burn it in |
| Plain `<video>` / `<Video>` for b-roll in a render | Not frame-accurate; tears or skips on render | `<OffthreadVideo>` for frame-exact decode |
| Running silence removal inside the composition | Trimming dead air is an upstream asset edit | `auto-editor` on the source file before Remotion |

## Verify & references

- `bash scripts/verify.sh <project-dir>` — checks the Remotion project is well-formed and renders. With Node + ffmpeg present it runs `npx remotion compositions` to confirm a composition id exists, does a short region render to a temp MP4, and uses `ffprobe` to confirm a video stream with the expected dimensions/fps. With neither, it falls back to a static check: at least one composition `.tsx` exists and the render script references a real composition id and an output path. Read-only by default; exits 0 on an empty/clean target.
- `references/captions-pipeline.md` — full Whisper.cpp install + transcribe server, `toCaptions`, the token-highlight caption renderer component, and caption styling/safe-zone notes.
- `references/render-and-pipeline.md` — `auto-editor` + ffmpeg silence commands, the full render flag matrix, headless/CI render, the codec table, and `ffprobe` verification.
