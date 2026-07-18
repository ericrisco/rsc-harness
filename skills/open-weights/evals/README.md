# Evals for the `open-weights` skill

Routing + capability checks read from `cases.yaml` by the skill eval harness — no network, no
model downloads, no license fetches. The `should_trigger` prompts must select this skill: they
cover general model selection, the Llama commercial-license question, Qwen per-size license
variance, VRAM-fit sizing, the non-commercial (Codestral/MNPL) gate, and a Catalan phrasing.
The `should_not_trigger` prompts must route to the named real sibling instead — `huggingface`
(download/host), `ollama` (run local + KV cache), `vllm` (serve/tensor-parallel), `finetuning`
(adapt), and `rag` (retrieval) — proving the tight "choose only, then hand off" boundary. The
single `capability` case is a rubric: a good answer to the 24GB commercial-assistant scenario must
verify the license on the exact card (never from memory), classify the license class, flag Llama as
custom/non-OSI with its conditions, size the model to fit 24GB, note fine-tune license inheritance,
and hand off to the four sibling skills. Run with whatever harness loads `evals/cases.yaml`;
nothing to install or connect.
