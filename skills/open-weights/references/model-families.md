# Open-weight model families — depth notes

**Every version and license line here is [verify the card] — authored against cards live mid-2026
(accessed 2026-07-18). Families and rough size ladders are durable; specific versions are not.**
Do not quote a license from this file into a product decision — open the model's `LICENSE`.

## Llama (Meta)

- **Sizes:** historically ~1B–70B dense; current line (Llama 4: Scout, Maverick) uses a
  **mixture-of-experts** design with large total-param counts but a smaller active count per token.
- **Strengths:** huge ecosystem — the most fine-tunes, quants, tooling, and community docs of any
  family. If "will it just work in my runtime" matters, Llama is the safe bet.
- **License:** **Meta Llama Community License — custom, NOT OSI-open.** Acceptable-Use Policy,
  "Built with Llama" attribution, naming rules, and a **>700M-MAU** clause. Gated on the Hub. See
  [licenses.md](licenses.md).

## Qwen (Alibaba)

- **Sizes:** a very wide ladder — sub-1B up to 200B+ (dense **and** MoE). Strong specialized lines:
  **Qwen-Coder** (coding), **Qwen-VL** (vision), reasoning variants. Recent lines (Qwen3 / Qwen3.5 /
  Qwen3.6) [verify].
- **Strengths:** excellent multilingual coverage, strong coding, a size for nearly every hardware
  budget, generally permissive licensing.
- **License:** **mostly Apache-2.0 but per-size variance** — some sizes historically shipped under a
  separate Qwen license. Check **each size's** card; never generalize "Qwen = Apache" to the family.

## Mistral / Mixtral (Mistral AI)

- **Sizes:** 7B dense (Mistral 7B), MoE (Mixtral 8x7B / 8x22B), and named tiers (Small/Large/Nemo).
- **Strengths:** efficient, strong for their size; Mixtral popularized accessible MoE.
- **License:** open models **Apache-2.0**; but **Codestral (original, code model) = MNPL
  non-production** — free to eval, not to ship commercially. **Codestral 2** was relicensed
  Apache-2.0 (Apr 2026) [verify]. Some newer models use a "Modified MIT" with a revenue-threshold
  commercial clause. Per-model check required — see [licenses.md](licenses.md).

## Gemma (Google)

- **Sizes:** ~1B–~27B, plus specialized siblings: **PaliGemma** (vision-language), **CodeGemma**,
  **ShieldGemma** (safety), **RecurrentGemma**, EmbeddingGemma, DataGemma.
- **Strengths:** strong small-model quality, good multilingual, tight integration with Google tooling.
- **License:** **Gemma 1–3 = custom Gemma Terms of Use + Prohibited Use Policy** (NOT Apache), with
  a downstream pass-through duty. **Gemma 4** reportedly moved to **Apache-2.0** (confirmed on
  ai.google.dev/gemma/terms, 2026-07-18) — verify the version you use. See [licenses.md](licenses.md).

## DeepSeek

- **Sizes:** very large MoE base/chat (V3-class, hundreds of B total), **R1** reasoning models, plus
  **distills** into smaller Llama/Qwen backbones (handy for consumer hardware).
- **Strengths:** frontier-class reasoning and coding at open-weight cost; distills bring much of the
  quality to small sizes.
- **License:** **per-model split.** Code repos MIT; **DeepSeek-R1 weights MIT**; original
  **DeepSeek-V3 weights = custom DeepSeek License Agreement with OpenRAIL-style use restrictions**.
  Newer point releases have moved toward MIT [verify]. Never assume "DeepSeek = MIT" — check the model.

## Phi (Microsoft)

- **Sizes:** small — ~3B to ~15B ("mini", reasoning, multimodal variants in the Phi-4 family).
- **Strengths:** punches above its weight on reasoning for the size (trained on curated/synthetic
  data); great for edge and cost-sensitive deployments.
- **License:** **MIT** across the Phi-4 family [verify] — genuinely permissive, commercial-friendly.

## gpt-oss (OpenAI)

- **Sizes:** **gpt-oss-20b** and **gpt-oss-120b** — MoE, open *weights*. 120B runs on a single 80 GB
  GPU; 20B targets ~16 GB.
- **Strengths:** OpenAI's first open-weight LLMs since GPT-2; strong reasoning/agentic/tool-use.
- **License:** **Apache-2.0** [verify] — permissive. Confirmed on OpenAI's own model-card page and
  the Hugging Face repo (2026-07-18).

## Others worth knowing (check the card)

- **OLMo (AI2)** — *fully* open: weights **and** training data/code released. The pick when
  reproducibility/provenance matters, not just weight availability.
- **SmolLM (HF)** — tiny, permissive, edge-friendly.
- **Falcon (TII)**, **Yi (01.AI)**, **Command / Command-R (Cohere)** — Command family often carries
  more restrictive terms (research vs commercial split); verify carefully before shipping.

## The "will it work Monday" filter

Beyond quality, a family/size is only a real option if the **ecosystem** supports it: ready-made
GGUF/AWQ/GPTQ quants on the Hub, support in your runtime (llama.cpp/Ollama/vLLM/TGI), documented
chat template, and recent downloads. A brand-new model with no quants and no runtime support is a
research artifact — route the actual pull to `huggingface` and the run to `ollama`/`vllm`.
