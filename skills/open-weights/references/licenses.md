# Open-weight LICENSES — the load-bearing reference

**Get this wrong and you ship something you have no legal right to ship.** This is the section that
most often bites teams. The cardinal rule, again: **state the license class, then open the exact
model + size card and confirm.** Everything below is class guidance + [verify-the-card] pointers,
authored mid-2026 — licenses move per version, per size, per release month.

## The three classes

### 1. OSI-open (Apache-2.0, MIT) — permissive

Commercial use, modification, and redistribution are allowed. Apache-2.0 adds a patent grant and a
notice/attribution requirement (keep the `NOTICE`/`LICENSE`); MIT is barely-there attribution. This
is the class you want for a product you distribute. Still read the card — attribution and notice
obligations are real even when permissive.

Class members (mid-2026, **verify each**): most Qwen sizes, Mistral open models, Phi (MIT), gpt-oss
(Apache-2.0), DeepSeek-R1 (MIT), Gemma **4** (Apache-2.0), OLMo, SmolLM.

### 2. Custom / community — free use *with conditions*

Broad, royalty-free rights **but** the vendor keeps strings attached: an acceptable-use policy,
mandatory attribution, naming rules, sometimes a scale cap, and a duty to pass restrictions
downstream. **This is NOT OSI-open** even though people loosely call it "open." You can usually ship
commercially — *if* you meet every condition.

Class members (mid-2026, **verify**): **Llama** (Meta Community License), **Gemma 1–3** (Gemma
Terms of Use).

### 3. Non-commercial / restricted — cannot ship without a separate license

Free to download and evaluate, but **not** for commercial deployment. Includes "research-only"
cards, some RAIL variants, revenue-gated licenses ("above $X/month you must buy a commercial
license"), and non-production licenses. Missing one of these is the expensive mistake.

Class members (mid-2026, **verify**): **original Codestral** (MNPL non-production), some Cohere
Command terms, various research-only community fine-tunes.

## Per-family detail

### Llama — Meta Llama Community License (custom, NOT OSI-open)

- **Acceptable Use Policy** incorporated by reference — prohibited uses bind you and your users.
- **Attribution:** derivatives/products must **prominently display "Built with Llama"**, and derived
  model names must carry "Llama" per the naming rules.
- **Redistribution:** include a copy of the Community License with any distribution of the weights.
- **Scale cap:** if your product (or affiliates') exceeds **700M monthly active users** in the prior
  calendar month, you must **request a license from Meta**, granted at Meta's sole discretion.
- **Gated** on the Hub — accept terms before you can download.
- Meta has revised terms across Llama versions — **verify the current version's license page**.

### Gemma — custom Gemma Terms of Use + Prohibited Use Policy (Gemma 1–3)

- Not Apache. A Google-authored license with a **Prohibited Use Policy** covering sensitive domains.
- **Downstream pass-through:** if you distribute Gemma or a Gemma-derived model (weights, API, or
  embedded), you must include/reference the Terms, ship the notice file ("Gemma is provided under
  and subject to the Gemma Terms of Use found at ai.google.dev/gemma/terms"), and bind downstream
  users to the Prohibited Use Policy. The restrictions **follow derivatives** — a fine-tune can't be
  used for a purpose that would've been prohibited on the base.
- **Gemma 4** reportedly switched to **Apache-2.0** (confirmed on ai.google.dev/gemma/terms,
  2026-07-18). Same brand, different class by version — **check which Gemma you have.**
- Google claims no rights in outputs you generate.

### Qwen — mostly Apache-2.0, with per-size variance

- Most sizes are Apache-2.0. Historically the very largest (and occasionally a special tier) shipped
  under a separate **Qwen license**. Do not assume the whole family is Apache — **check each size**.

### Mistral / Mixtral

- Open models (Mistral 7B, Mixtral 8x7B/8x22B, many "Small") = **Apache-2.0**.
- **Original Codestral = MNPL (Mistral AI Non-Production License)** — research/eval only, **no
  commercial deployment**. **Codestral 2** relicensed **Apache-2.0** (Apr 2026) [verify which one].
- Some newer models use a **"Modified MIT"** with a revenue-threshold commercial clause (e.g. above
  a monthly-revenue bar you need a commercial license / Mistral platform access). Verify.

### DeepSeek — per-model split

- **Code** repositories: MIT.
- **DeepSeek-R1** weights: **MIT**.
- **Original DeepSeek-V3** weights: **custom DeepSeek License Agreement** (v1.0) with **OpenRAIL-
  style use-based restrictions** (military use, harm to minors, disinformation, PII, discrimination,
  etc.), which you must **pass forward** as an enforceable provision on redistribution.
- Newer point releases have trended toward MIT [verify]. "DeepSeek = MIT" is an over-simplification.

### Phi — MIT

- The Phi-4 family (Phi-4, Phi-4-mini, reasoning, multimodal) is **MIT** [verify] — commercial use,
  fine-tuning, redistribution allowed, no royalties.

### gpt-oss — Apache-2.0

- gpt-oss-20b / gpt-oss-120b = **Apache-2.0** [verify] — permissive commercial use.

## Gated models (mechanics)

Some models (Llama, Gemma, many others) are **gated**: you must accept terms on the Hub model page,
then use a read-scoped token. Gating is an access gate, not a use-class — a gated model can be
commercially usable (under its conditions), and an ungated model can still be non-commercial.
Downloading without accepting terms returns a 403. The download step itself is a `huggingface` job.

## The fine-tune / distill inheritance trap

**A derivative inherits the base model's license and obligations.**

- Fine-tune Llama → your fine-tune still owes "Built with Llama", the Acceptable-Use Policy, and the
  MAU clause. You cannot re-license it as MIT.
- Fine-tune Gemma → the Gemma Terms + Prohibited Use Policy follow your model downstream.
- A **distill** trained on another model's outputs can inherit the **teacher's** terms (this is how
  a restriction can travel into a model whose own card looks permissive). Check the base_model chain.
- Merging models can compound obligations from **every** parent. Trace the lineage.

When in doubt, treat the strictest ancestor's license as governing, and confirm on each card.

## Commercial-ship decision flow

1. Identify the **exact model + size** (not the family) you'll deploy.
2. Open its `LICENSE` / terms page on the Hub or the vendor site.
3. Classify: OSI-open → ship (honor attribution/notice). Custom/community → meet the conditions
   (attribution string, AUP, MAU/revenue caps, pass-through) → ship. Restricted/non-commercial →
   **stop**; get a separate license or pick another model.
4. If it's a fine-tune/distill/merge, repeat for **every** ancestor and take the strictest.
5. Record the decision (which model, which license, which conditions) — see `decision-records`.
