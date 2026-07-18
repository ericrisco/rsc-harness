# Export: from trained LoRA to a runnable artifact

After `trainer.train()` you hold LoRA adapters on top of a (possibly 4-bit) base. Export depends on
where it runs next. Tracks docs.unsloth.ai inference-and-deployment pages (accessed 2026-07).

## The matrix

| Target                     | Method                                                        | Notes |
| -------------------------- | ------------------------------------------------------------- | ----- |
| vLLM / re-host / portable  | `save_pretrained_merged(dir, tok, save_method="merged_16bit")`| Base + LoRA merged at 16-bit. The high-quality keeper. |
| Small, hot-swappable       | `save_pretrained_merged(dir, tok, save_method="lora")`        | Adapters only (~MBs). Load onto the base at run time. |
| Ollama / llama.cpp         | `save_pretrained_gguf(dir, tok, quantization_method="q4_k_m")`| Converts + quantizes to GGUF. |
| DPO / niche 4-bit inference| `save_method="merged_4bit"`                                   | **Discouraged** — quality loss; only if a tool needs it. |

## Merge to 16-bit (recommended keeper)

```python
model.save_pretrained_merged("model_16bit", tokenizer, save_method = "merged_16bit")
# push instead of / in addition to saving:
model.push_to_hub_merged("user/model", tokenizer,
                         save_method = "merged_16bit", token = "hf_...")
```

`merged_16bit` is the format vLLM and most serving stacks expect. Prefer it over `merged_4bit` — merge
at 16-bit, quantize downstream if you need to.

## LoRA adapters only

```python
model.save_pretrained("finetuned_lora"); tokenizer.save_pretrained("finetuned_lora")
# or save_pretrained_merged(..., save_method="lora")
```

Tiny and hot-swappable (e.g. vLLM LoRA hot-swap). Requires the base at inference time.

## GGUF for Ollama / llama.cpp

```python
# one quant:
model.save_pretrained_gguf("model_gguf", tokenizer, quantization_method = "q4_k_m")
# several at once, pushed to the Hub:
model.push_to_hub_gguf("user/model-gguf", tokenizer,
                       quantization_method = ["q4_k_m", "q8_0", "f16"], token = "hf_...")
```

Quant guide (size vs quality — this is a real tradeoff, not free):

| Method   | ~bits/weight | Use it for |
| -------- | ------------ | ---------- |
| `q4_k_m` | ~4.9         | Everyday default: ~half the size for a few % quality loss. |
| `q5_k_m` | ~5.5         | A notch more quality than Q4 for a bit more size. |
| `q8_0`   | ~8.5         | Near-lossless; larger. |
| `f16`    | 16           | Unquantized ceiling; biggest. |

Lower than Q4 (Q2/Q3) drops quality sharply — avoid unless desperate for size.

### Manual conversion (when the helper can't, or you want control)

Merge to 16-bit first, then run llama.cpp's converter:

```bash
python llama.cpp/convert_hf_to_gguf.py model_16bit \
    --outfile model-F16.gguf --outtype f16 --split-max-size 50G
# then quantize with llama.cpp's quantize tool to q4_k_m / q8_0, etc.
```

## Handoff — this skill stops at the file

- **Run the GGUF locally →** `ollama`. Roughly: `ollama create <name> -f Modelfile` with
  `FROM ./model-Q4_K_M.gguf`, then `ollama run <name>`. The Modelfile/quant/VRAM details are its job.
  Unsloth's docs also show `OLLAMA_MODELS=unsloth ollama run merged_file.gguf` for a quick check.
- **Serve merged-16bit at throughput →** `vllm` (engine flags, batching, LoRA hot-swap).
- **Host/share the weights →** `huggingface` (the `push_to_hub_*` calls above land there).

Export is the last thing this skill owns; running and serving belong to those siblings.
