---
name: replicate-images
description: "Use when generating or editing images through the Replicate API, or when a modern image model keeps ignoring the prompt — choosing aspect ratio, resolution, seed and output format, image-to-image, multi-reference composition, text-driven inpainting, readable text inside a generated image, and structuring prompts per model family. NOT general Replicate platform, auth or non-image models (that is `replicate`)."
tags: [replicate, image-generation, image-editing, nano-banana, flux, prompting, gpt-image, seedream]
recommends: [replicate, prompt-engineering, ai-media, fal]
origin: risco
---

# Replicate image generation & prompt craft

This skill is the **image layer on top of Replicate**: how to call an image model from code and how
to write a prompt that the specific model family actually obeys. Two competencies braided together —
**mechanics** (run path, output handling, levers, image inputs) and **prompt shape per family**
(Gemini/Nano-Banana wants prose, Flux wants dense description, gpt-image wants instructions). If the
question is platform plumbing — auth, billing, deployments, webhooks, running an LLM or audio model —
that is `replicate`, not this skill.

Pinned facts (verified 2026-06-02). Slugs and parameter names are the load-bearing details that make
code run, and they drift — the full per-model schema lives in `references/models.md` so this file
stays evergreen. Confirm any exact slug/param on the model page before quoting it as fact.

## First move

```bash
export REPLICATE_API_TOKEN=r8_...     # both clients read this automatically
npm install replicate                  # Node; pip install replicate for Python
```

```javascript
import Replicate from "replicate";
const replicate = new Replicate();     // reads REPLICATE_API_TOKEN from env

const output = await replicate.run("google/nano-banana-2", {
  input: { prompt: "a red ceramic mug on a sunlit wooden table, soft morning light" },
});
console.log(output[0].url());          // hosted URL of the first image
```

Rule: do not hand-build the token into the client — let `new Replicate()` read the env var. Why: a
hardcoded token leaks into git and logs. Python is the same shape: `replicate.run("google/nano-banana-2", input={"prompt": ...})`.

## Pick the model

Pick by the dominant requirement, not by hype. Full input schemas and rough cost tiers per model are
in `references/models.md`.

| Need | Model slug | Why |
|---|---|---|
| Best editing + multi-image composition | `google/nano-banana-2` | Gemini 3.1 Flash Image; up to 14 reference images, conversational edits |
| Top-quality / hard compositions, budget allows | `google/nano-banana-pro` | Gemini 3 Pro Image; ~2x the NB2 cost at 1K |
| Dense photoreal, fine control of light/lens | `black-forest-labs/flux-1.1-pro` | rewards rich descriptive prompts; exposes seed, size |
| Fast/cheap draft loop | `black-forest-labs/flux-schnell` | sync-optimized, lowest latency for iterating |
| Strict instruction-following + crisp text | `openai/gpt-image-1` (OpenAI on Replicate) | follows complex instructions; needs your own OpenAI key wired in |
| Up-to-4K + batch/sequential output | `bytedance/seedream-4` | unified text-to-image and editing, multi-reference |

Rule: for anything involving editing an existing image or merging references, start at
`google/nano-banana-2`. Why: it is purpose-built for semantic edits and accepts many reference images,
which the Flux text-to-image models do not.

## The three run paths

```javascript
// 1. run() — synchronous, the default. Use for interactive/script calls.
const out = await replicate.run("google/nano-banana-2", { input: { prompt } });

// 2. predictions.create + wait — when you need the full object (status, metrics, retry/cancel).
const prediction = await replicate.predictions.create({
  model: "black-forest-labs/flux-1.1-pro",
  input: { prompt },
});
const done = await replicate.wait(prediction);   // done.output, done.status, done.metrics

// 3. stream — progressive output for streaming-capable models.
for await (const event of replicate.stream("black-forest-labs/flux-dev", { input: { prompt } })) {
  process.stdout.write(event.data);              // { event, data }
}
```

Rule: default to `run()`; reach for `predictions.create` + `wait` only when you actually read
`status`/`metrics` or need to `cancel()`. Why: `run()` is the low-latency path optimized for file
models — the extra object is overhead you do not need for a one-shot generation.

## Handling output

Since the file-output era, `replicate.run` returns **`FileOutput`** objects, not URL strings.
Treating one as a string is the most common bug.

```javascript
const output = await replicate.run("google/nano-banana-2", { input: { prompt } });

// Bad — output[0] is a FileOutput; this stringifies the object, not the image
fs.writeFileSync("out.jpg", output[0]);

// Good — read bytes via .blob(), or take the hosted link via .url()
import { writeFile } from "node:fs/promises";
const blob = await output[0].blob();
await writeFile("out.jpg", Buffer.from(await blob.arrayBuffer()));
console.log(output[0].url());                    // hosted URL if you'd rather link
```

`output` is an **array** even for a single image — index it. Pass `useFileOutput: false` to
`new Replicate({ useFileOutput: false })` if you want plain URL strings back instead of `FileOutput`.

Rule: index the array and call `.blob()` for bytes or `.url()` for the link. Why: silently coercing a
`FileOutput` to a string writes a `[object]`-style repr and the corruption surfaces far from the cause.

## Universal levers

| Lever | What it does | Note |
|---|---|---|
| `aspect_ratio` | shape of the output (`"16:9"`, `"4:5"`, `"1:1"`, `match_input_image`, …) | nano-banana set listed in `references/models.md`; prefer it over `width`/`height` when offered |
| `output_resolution` | `512px` / `1K` / `2K` / `4K` (nano-banana) | **the dominant cost lever** — see Cost discipline |
| `output_format` | `jpg` (default) vs `png` | png for transparency / text crispness; jpg for smaller files |
| `seed` | fixed integer → repeatable generation | use for A/B prompt diffs on Flux/SeeDream; Gemini image is less deterministic |
| `num_outputs` | several variants in one call | where supported; multiplies cost |

```javascript
const out = await replicate.run("google/nano-banana-2", {
  input: { prompt, aspect_ratio: "4:5", output_resolution: "1K", output_format: "png", seed: 42 },
});
```

Rule: only pass parameters that exist on the model you call. Why: Replicate rejects unknown inputs —
do not copy a Flux `width`/`height` onto a call that wants `aspect_ratio`, and do not invent a
parameter. Allowed values per model are in `references/models.md`.

## Image-to-image & editing

Local files auto-upload, public URLs and `data:` URIs pass as strings. The single classic mistake is
passing a **bare path string** for a local file — that uploads the literal text, not the bytes.

```javascript
import { readFile } from "node:fs/promises";

// Bad — sends the string "./photo.jpg" as the image, not the file
await replicate.run("google/nano-banana-2", { input: { prompt, image_input: ["./photo.jpg"] } });

// Good — read the bytes (or pass a real https:// URL / data: URI string)
const photo = await readFile("./photo.jpg");
await replicate.run("google/nano-banana-2", {
  input: {
    prompt: "Remove the person on the left. Keep everything else identical.",
    image_input: [photo],            // nano-banana takes up to 14 reference images
    aspect_ratio: "match_input_image",
  },
});
```

For edits, write **what to change and what to preserve** in plain language — "keep everything else
identical" is the idiom that stops the model from re-rendering the whole scene. Multi-image
composition passes several references in `image_input` and describes how they combine. Copy-paste
recipes (object removal, background swap, style transfer, 2-image composition, product shot with
rendered text, character consistency) are in `references/editing-recipes.md`.

Rule: never pass a bare local path as an image input. Why: clients only auto-upload file/Buffer
values — a string is treated as a URL or literal, and the model silently generates from nothing.

## Prompt structure per family

Each family rewards a different prompt shape. Match the shape or the model "ignores" you.

### Gemini / Nano-Banana — prose, not keywords

Google's formula: **`[Subject] + [Action] + [Location/context] + [Composition] + [Style]`**, written
as sentences. Editing is conversational and semantic. For text, put the literal string in quotes and
name the font.

```text
Bad:  cat, hat, studio, 85mm, cinematic, 8k, highly detailed, trending
Good: A ginger cat wearing a tiny red wool hat, sitting on a velvet stool in a
      softly lit studio, shot from slightly above with a shallow depth of field,
      warm cinematic color grade.
```

For a rendered label: `Add a banner reading "SUMMER SALE" in bold condensed sans-serif across the top`
— quotes fix the literal text, the font name fixes the rendering. It can also translate text on request.

### Flux — one dense descriptive paragraph

Flux rewards a single rich paragraph weighting subject, lighting, and lens; thin prompts get filled
in by the model. Use a fixed `seed` to A/B prompt edits.

```text
Bad:  a city at night, neon, rain
Good: A rain-slicked Tokyo backstreet at night, neon signage reflected in the
      puddles, a lone figure under a translucent umbrella, shot on a 35mm lens
      with shallow focus and cool teal-magenta lighting.
```

### gpt-image — explicit instructions + constraints

Write it like a brief with hard constraints; it follows complex instructions and renders readable
text well. `Generate a 3-icon row on a white background; each icon flat-style, 2px stroke, evenly
spaced; label them "Plan", "Build", "Ship" in a clean sans-serif.`

### SeeDream — multi-reference and batch phrasing

State the references and the relationship, and ask for the batch explicitly when you want a set:
`Using image 1 as the character and image 2 as the outfit, generate 4 sequential poses, same lighting.`

Rule: do not paste a keyword soup into a Gemini/Nano-Banana call. Why: these models parse natural
language; a comma-list of tags reads as noise and the model drops half of it.

## Cost & latency discipline

- **Resolution is the cost lever.** For nano-banana, cost climbs sharply with `output_resolution`
  (roughly: 0.5K cheapest → 1K default → 2K → 4K). Iterate at `1K`, render the chosen frame at `4K`.
- **Do not 4K every draft.** A 20-iteration prompt loop at 4K can cost an order of magnitude more than
  the same loop at 1K for output you are about to throw away.
- **Pro tier ≈ 2x Flash at the same size** — reach for `nano-banana-pro` only when NB2 genuinely can't
  do the job, not by default.
- **Verify live pricing on the model page** before quoting a number to anyone — the figures here are
  order-of-magnitude and Replicate may differ from upstream Google rates.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Bare path string as an image input | Uploads the text, not the file; model generates from nothing | `await readFile(path)`, or a real URL / `data:` URI |
| Keyword-soup prompt to Gemini/Nano-Banana | Parses as noise; half the request is dropped | Write the prose formula in sentences |
| Treating `FileOutput` as a URL string | Writes an object repr, not the image bytes | Index the array, then `.blob()` / `.url()` |
| 4K (or Pro) on every iteration | Multiplies cost on output you'll discard | Draft at 1K/Flash, render finals at 4K/Pro |
| Inventing or copy-pasting parameters across models | Replicate rejects unknown inputs; the call 400s | Use only params from `references/models.md` |
| Hardcoding a model version hash that rots | Pinned version gets deprecated; call breaks silently | Call by `owner/model` slug; pin a version only deliberately |
| Quoting stale pricing as fact | Rates drift; you mis-quote a client | Re-check the model page; treat numbers as order-of-magnitude |
| `run()` when you need metrics/retry | No access to status/metrics; can't cancel | `predictions.create` + `wait`, read `.status`/`.metrics` |

## References

- `references/models.md` — per-model slug, full input schema with allowed values, prompt shape,
  pick-when, and rough cost tier for nano-banana-2, nano-banana-pro, flux-1.1-pro / flux-dev /
  flux-schnell, openai/gpt-image-1, seedream-4. Header note: slugs and params drift — confirm on the model page.
- `references/editing-recipes.md` — copy-paste recipes (object removal, background swap, style
  transfer, 2-image composition, product shot with rendered text, character consistency), each as
  goal + model + input shape + prompt template.

`scripts/verify.sh` statically lints the Replicate image-calling code in **your project** — point it
at a directory of emitted `.js`/`.mjs`/`.ts`/`.py` files (no network, no token). It checks that image
slugs come from the allowlist, `aspect_ratio` literals are in the nano-banana set, `output_resolution`
values are valid, and local image inputs use `readFile`/Buffer rather than a bare quoted path. It does
not parse this skill's own Markdown fences — it scans source files, so run it where the code lands.
