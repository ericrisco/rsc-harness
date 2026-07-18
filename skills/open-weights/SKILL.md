---
name: open-weights
description: "Use when choosing an open-weight LLM and clearing it for use — which family and size fit a task, hardware and budget, and above all whether the license lets you ship (Llama, Qwen, Mistral/Mixtral, Gemma, DeepSeek, Phi, gpt-oss, and others). Owns the license-CLASS map (OSI-open Apache/MIT vs custom-community like Llama/Gemma vs non-commercial/restricted like the original Codestral) and the always-verify-the-model-card rule, plus size-to-VRAM budgeting and quant formats (GGUF/AWQ/GPTQ, what Q4_K_M means). Triggers: 'which open model should I use', 'can I use Llama/Gemma commercially', 'is Qwen Apache-2.0', 'what open LLM fits a 24GB GPU', 'is this license safe to ship in a product', 'quin model obert puc fer servir legalment'. NOT how to download or host on HF (that is huggingface), NOT running it locally (that is ollama), NOT serving at throughput (that is vllm), NOT fine-tuning it (that is finetuning) — this layer only tells you WHICH model and whether the license permits it, then hands off."
tags: [open-weights, open-source-llm, model-selection, model-licenses, llama-qwen-mistral-gemma]
recommends: [huggingface, ollama, finetuning, vllm]
origin: risco
---

# Open weights — pick the model, then clear the license

This is the CHOICE layer. Given a task, a box, and a shipping constraint, it tells you *which*
open model to reach for and *whether the license lets you ship it*. It does not download, run,
serve, or fine-tune anything — it feeds the skills that do (see [Related skills](#related-skills)).

## The one rule (read before you name a model)

**Model names and their licenses change monthly. Never state a license from memory — open the
model card and confirm it, every time.** This file was authored against cards live in mid-2026;
by the time you read it, versions have shipped and terms have moved. So:

- Treat every specific version/license line below as **[verify the card]**, not as settled fact.
- State the license **class** (OSI-open vs custom-community vs restricted), then send the reader to
  the actual `LICENSE` / terms page for the exact model + size they intend to ship.
- The *decision framework* and the *class taxonomy* are the durable parts. The version list is the
  perishable part. Weight your trust accordingly.

Real, verified-mid-2026 examples of *why* this rule exists — all confirmed against the source, and
all things that were different at my Jan-2026 cutoff:

- **Gemma 4** moved to **Apache-2.0**, while Gemma 1–3 stay on the custom Gemma Terms of Use
  (confirmed on [ai.google.dev/gemma/terms](https://ai.google.dev/gemma/terms), accessed
  2026-07-18). Same brand, opposite license class depending on version.
- **Codestral 2** was relicensed **Apache-2.0** (per Mistral, Apr 2026), while the original
  Codestral stays **non-production (MNPL)**. Same name, opposite shippability depending on release.
- **DeepSeek-R1** is **MIT**, but the original **DeepSeek-V3** weights ship under a **custom
  DeepSeek License Agreement with OpenRAIL-style use restrictions** (confirmed on the
  [V3 LICENSE-MODEL](https://huggingface.co/deepseek-ai/DeepSeek-V3/blob/main/LICENSE-MODEL)),
  not MIT. Same family, different license per model.

If three of the load-bearing facts moved in one release cycle, yours have too. Check the card.

## 1. How to choose an open model

Five gates, in this order. The license gate can veto everything above it, so never fall in love
with a model before you clear it.

1. **Task fit** — match the model's design to the job:
   - General chat / instruct → Llama, Qwen, Mistral, Gemma instruct variants.
   - Coding → Qwen-Coder, Codestral (license!), DeepSeek-Coder, gpt-oss.
   - Reasoning / math → DeepSeek-R1-style reasoning models, gpt-oss, Qwen reasoning variants.
   - Multilingual → Qwen and Gemma tend to lead; check the card's language list.
   - Multimodal (vision) → Llama vision, Qwen-VL, Gemma vision, PaliGemma, Phi multimodal.
   - Embeddings / retrieval → a dedicated embedding model, **not** a chat LLM → `embeddings-search`.
   - Small / edge → 0.5B–4B (Qwen small, Gemma small, Phi-mini, gpt-oss-20b class).
2. **Size vs your hardware class** — can it even fit? See [§4](#4-size--vram). A 70B at fp16 is
   ~140 GB; if you have one 24 GB GPU, that model is off the table unless you quantize *and* accept
   the quality/throughput cost. Pick a size your box can hold before you compare quality.
3. **License / shippability** — **the gate that matters most** (see [§3](#3-licenses)). Decide up
   front: is this a hobby/internal use, or a commercial product you distribute? "Open weights" does
   **not** mean "open source" and does **not** guarantee commercial rights. Verify the card.
4. **Hardware target** — consumer GPU (8–24 GB), data-center GPU (A100/H100 80 GB), Apple unified
   memory, or CPU/edge. This narrows both size and quant format (GGUF for CPU/Mac/llama.cpp; AWQ/GPTQ
   for GPU serving).
5. **Community support** — a proxy for "will this actually work Monday morning": are there
   ready-made GGUF/AWQ quants on the Hub, is it supported by your runtime (llama.cpp/Ollama/vLLM),
   are there fine-tunes and recent downloads? A model with no quants and no runtime support is a
   research artifact, not a shippable choice.

Rule of thumb: **smallest model that passes your eval wins.** Don't reach for 70B when a well-chosen
8B clears the bar — it's cheaper to run, faster, and fits more hardware. Prove it with `agent-eval`.

## 2. Model families

Families and *typical* size ladders below. Specific version claims are marked — **[verify]** at
author time; the family and its rough sizing are the durable part. Full per-family notes,
strengths, and license pointers in [references/model-families.md](references/model-families.md).

| Family | Maker | Typical open sizes | Notes / current line [verify] |
|---|---|---|---|
| **Llama** | Meta | ~1B–~400B (dense + MoE) | Llama 4 (Scout/Maverick, MoE) current line; custom **Community License**, gated |
| **Qwen** | Alibaba | 0.5B–235B+ (dense + MoE), strong Coder/VL | mostly Apache-2.0 but **per-size variance** — check each card |
| **Mistral / Mixtral** | Mistral AI | 7B dense, 8x7B/8x22B MoE, "Small/Large" | open ones Apache-2.0; **Codestral original = MNPL non-production** |
| **Gemma** | Google | ~1B–~27B, plus PaliGemma/CodeGemma/ShieldGemma | Gemma 1–3 = **custom Gemma Terms**; Gemma 4 = Apache-2.0 [verify] |
| **DeepSeek** | DeepSeek | V3-class MoE (~600B+), R1 reasoning, distills | **per-model license split** — R1 MIT, original V3 custom; verify |
| **Phi** | Microsoft | ~3B–15B ("mini", reasoning, multimodal) | **MIT** across the Phi-4 family [verify] |
| **gpt-oss** | OpenAI | 20B and 120B (MoE, open *weights*) | **Apache-2.0** [verify]; OpenAI's first open-weight LLMs since GPT-2 |
| Others | various | — | SmolLM, OLMo (fully-open incl. data), Falcon, Yi, Command — check card |

## 3. Licenses

**This is the load-bearing section. Get it wrong and you ship something you have no right to
ship.** Every model falls into one of three classes. Identify the class, then open the card.

### The three classes

| Class | Examples (class, not a promise) | What it means for shipping |
|---|---|---|
| **OSI-open** (Apache-2.0, MIT) | Qwen (most), Mistral open, Phi, gpt-oss, DeepSeek-R1, Gemma **4** | Commercial use, modify, redistribute — permissive. Still read the card for attribution/notice. |
| **Custom / community** | **Llama** (Meta Community), **Gemma 1–3** (Gemma Terms) | Broad free use **but with conditions**: acceptable-use policy, attribution, sometimes a scale cap. NOT OSI-open. |
| **Non-commercial / restricted** | original **Codestral** (MNPL), any "research-only", some RAIL, some "≥$X revenue → buy a license" | You **cannot** ship it in a commercial product without a separate license. Fatal if missed. |

"Open weights" describes availability of the weights file — it says nothing about your legal rights.
A model can be a free download and still be non-commercial. **The download button is not a license.**

### Per-family license notes (state the class, then verify the exact card)

- **Llama = Meta Llama Community License — NOT OSI-open.** Carries an Acceptable Use Policy, a
  **"Built with Llama"** attribution requirement on derivatives/products, naming rules, and a
  **>700M-monthly-active-users clause** (above that you must request a separate license from Meta,
  granted at Meta's discretion). Gated on the Hub (accept terms first). Verify the *current* Llama
  version's terms — Meta has revised them across releases.
- **Gemma = custom Gemma Terms of Use + Prohibited Use Policy** for Gemma 1–3 (not Apache), with a
  duty to pass the restrictions **downstream** to every user and to ship the terms/notice file.
  Gemma **4** reportedly moved to **Apache-2.0** — a textbook reason to check the version's card.
- **Qwen = mostly Apache-2.0, but with per-size variance.** Historically some sizes (often the very
  largest or a special tier) carried a separate Qwen license instead of Apache. **Check each size's
  card** — do not assume "Qwen = Apache" for the whole family.
- **Mistral / Mixtral open models = Apache-2.0**, but the **original Codestral is MNPL
  (non-production)** — free for research/eval, **not** for commercial deployment. Codestral **2**
  was relicensed Apache-2.0; verify which Codestral release you actually have. Note some newer
  Mistral models use a "Modified MIT" with a revenue-threshold commercial clause — verify.
- **DeepSeek = per-model split.** Code repos are MIT; **DeepSeek-R1 weights are MIT**; but the
  original **DeepSeek-V3 weights** ship under a **custom DeepSeek License Agreement with OpenRAIL-
  style use-based restrictions**. "DeepSeek = MIT" is too simple — verify the specific model.
- **Phi = MIT** across the Phi-4 family [verify] — genuinely permissive, commercial-friendly.
- **gpt-oss (OpenAI open-weight models, 20B/120B) = Apache-2.0** [verify] — permissive.

### Commercial-use checklist (run before you ship)

- [ ] Opened the **exact model + size** card and read its `LICENSE` / terms — not a blog, not this file.
- [ ] Confirmed the **class**: OSI-open, custom-community, or restricted/non-commercial.
- [ ] If custom/community: identified the **conditions** (attribution string, acceptable-use policy,
      MAU/revenue caps, downstream pass-through duty) and can meet them.
- [ ] If restricted: confirmed you are **not** deploying commercially, or obtained a separate license.
- [ ] Checked whether the model is **gated** (accept terms on the Hub before download).
- [ ] Checked the **base model** license — a fine-tune inherits the base's obligations (a Llama
      fine-tune still owes "Built with Llama"; a distill can inherit the teacher's terms).

Deeper class breakdown, gated-model mechanics, and the fine-tune-inheritance trap:
[references/licenses.md](references/licenses.md).

## 4. Size ↔ VRAM

A **selection-time** budget: will this size class even fit your hardware? (Operational per-request
KV-cache math lives in `ollama`/`vllm` — this is the "before I pick it" estimate.)

```text
weights_GB ≈ params(B) × bytes_per_param      # then add KV cache + runtime overhead on top
  fp16/bf16 → 2.0   (≈ 2 GB per 1B params)
  8-bit     → ~1.0  (≈ 1 GB per 1B params)
  4-bit     → ~0.6  (≈ 0.6 GB per 1B + cache + overhead; conservative ~0.5–0.6/param)
```

What that means per hardware class (weights only — leave headroom for context/KV cache):

| Hardware | fp16 ceiling | Practical pick (4-bit) |
|---|---|---|
| 8 GB consumer GPU | ~3B | 7–8B at 4-bit (~5 GB) |
| 16 GB | ~7B | 13–14B at 4-bit |
| 24 GB (e.g. 3090/4090) | ~10B | ~32B at 4-bit (~20 GB) |
| 80 GB (A100/H100) | ~34B | 70B at 4-bit (~40 GB), or a big-MoE like gpt-oss-120b |
| Apple unified (e.g. 64 GB) | shares with the OS | budget against **total** unified memory |
| multi-GPU / 2×80 GB+ | 70B fp16 (~140 GB) via tensor-parallel | full-precision large models |

**A 70B at fp16 is ~140 GB — it does not fit one GPU.** You either quantize (4-bit ≈ ~40 GB, fits one
80 GB card) or split across GPUs with **tensor parallelism** (that's a `vllm` job). Longer context
grows the KV cache *on top of* weights, so keep a margin. Full derivation + KV math:
[references/sizing-and-quant.md](references/sizing-and-quant.md).

## 5. Quant / formats

Quantization shrinks weights (fewer bits/param) to fit smaller hardware, trading a little quality.
Which **format** you pick is driven by your runtime:

| Format | Where it runs | Use it for |
|---|---|---|
| **GGUF** | llama.cpp, **Ollama**, LM Studio | CPU, Apple Silicon, single-box local; the everyday local format |
| **AWQ** | vLLM, TGI, transformers | GPU serving — activation-aware 4-bit, strong quality/latency |
| **GPTQ** | vLLM, TGI, transformers | GPU serving — older, widely available 4-bit |
| bitsandbytes (NF4) | transformers | quick load-time 4/8-bit for experiments/fine-tuning |
| EXL2 | ExLlamaV2 | flexible bit-rates on consumer GPUs |

**Decoding a GGUF quant tag like `Q4_K_M`:** `Q4` = ~4-bit weights; `_K` = a k-quant (mixed
precision — keeps the more sensitive tensors at higher bit-depth); `_M` = the medium size/quality
tier (`_S` smaller/lower, `_L` larger/higher). **`Q4_K_M` is the standard default** — roughly half
the memory of fp16 for a few percent quality loss. `Q8_0` is near-lossless (~1 byte/param); below
`Q4`, quality drops off fast. Don't go sub-Q4 to force a too-big model onto a too-small box — pick a
smaller model instead. More in [references/sizing-and-quant.md](references/sizing-and-quant.md).

## 6. Where to get it + how to run it (routing)

You've chosen a model and cleared its license. Now hand off — this skill stops here.

- **Get the weights / host on HF** → `huggingface` (Hub download/upload, Inference Providers,
  endpoints). Also where you convert to GGUF.
- **Run it locally on one box** (laptop/desktop, GGUF via Ollama) → `ollama`.
- **Serve it at throughput / with tensor-parallel** (production, batching, big models) → `vllm`.
- **Fine-tune it** (LoRA/QLoRA, SFT, preference tuning) → `finetuning`.
- **Prove the small model is enough** before committing → `agent-eval`.

The Hub filters (task + license + size + recent downloads) and the Ollama library are where you
actually find candidates — that mechanics lives in `huggingface` / `ollama`, not here.

## Guardrails / gotchas

- **Never assert a license from memory.** State the class, open the card. Licenses change per
  version, per size, and per release month.
- **"Open weights" ≠ "open source" ≠ "commercial-use OK".** Three different things.
- **A fine-tune inherits its base license.** Fine-tuning Llama does not launder away "Built with
  Llama" or the acceptable-use policy; a distill can inherit the teacher model's terms.
- **Gated ≠ restricted.** Gemma/Llama are gated (accept terms to download) yet usable commercially
  under their conditions; a "research-only" card is restricted regardless of gating.
- **Don't sub-Q4 a too-big model onto a too-small GPU.** Quality collapses and it still may OOM at
  real context. Choose a size that fits.
- **Newest ≠ best for you.** The smallest model that passes your eval wins on cost, speed, and fit.
- **MoE total vs active params.** A "120B" MoE may activate only ~5B/token (fast) but you still need
  VRAM for *all* experts — size against total params, not active.

## Related skills

- **`huggingface`** — get/host: Hub download/upload, Inference Providers, endpoints, GGUF
  conversion. This skill tells you *which* repo to pull; `huggingface` pulls it.
- **`ollama`** — run one model locally (GGUF, single box, VRAM sizing at request time). This skill
  says which model + quant *class* fits; `ollama` runs it and does the KV-cache math.
- **`vllm`** — serve at throughput, batching, tensor-parallel for models too big for one GPU.
- **`finetuning`** — adapt a chosen base with LoRA/QLoRA/SFT. Choose+clear the base here first.
- Boundary: this skill is **selection + licensing knowledge only**. It never re-teaches calling,
  running, serving, or training — it feeds those four.

## Checklist

- [ ] Named the **task** and matched a family designed for it (chat/code/reasoning/vision/embeddings/edge).
- [ ] Picked the **smallest size** likely to pass the eval, and confirmed it **fits the hardware class**.
- [ ] Identified the **license class** (OSI-open / custom-community / restricted).
- [ ] Opened the **exact model + size card** and confirmed the license — not from memory, not from a blog.
- [ ] For commercial use: met the conditions (attribution, acceptable-use, MAU/revenue caps) or confirmed permissive.
- [ ] Checked the **base model** license if it's a fine-tune/distill.
- [ ] Picked a **quant format** matching the runtime (GGUF local / AWQ-GPTQ serving) and a sane tier (`Q4_K_M` default).
- [ ] Handed off: `huggingface` (get), `ollama` (run local), `vllm` (serve), `finetuning` (adapt).
