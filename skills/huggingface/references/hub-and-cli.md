# Hub & the `hf` CLI

The CLI is **`hf`**, shaped `hf <resource> <action>`. `huggingface_hub` 2.0 removed the
`huggingface-cli` entry point and the singular `hf repo` group (now `hf repos`) — use `hf` everywhere.

## Command map

```bash
hf auth login                 # interactive token store; or export HF_TOKEN=...
hf auth whoami                # confirm identity + token scope
hf download <repo>            # pull a repo (model/dataset/space) to the local cache
hf upload <repo> <path>       # push files to a repo
hf repos create <repo>        # create a new repo (--repo-type model|dataset|space)
hf jobs run <image> -- <cmd>  # run a containerized/uv job on HF infra (PRO)
```

## Download patterns

```bash
# Only the weights you need, not the whole repo:
hf download meta-llama/Llama-3.1-8B-Instruct --include "*.safetensors" "config.json"

# A dataset:
hf download HuggingFaceH4/ultrachat_200k --repo-type dataset
```

```python
from huggingface_hub import snapshot_download, hf_hub_download

# Whole repo (resumable, cached):
local = snapshot_download("BAAI/bge-small-en-v1.5")

# A single file:
cfg = hf_hub_download("BAAI/bge-small-en-v1.5", filename="config.json")
```

## Upload patterns

```bash
hf repos create my-org/my-model --repo-type model
hf upload my-org/my-model ./checkpoints --commit-message "v1 weights"
```

```python
from huggingface_hub import HfApi
api = HfApi()
api.create_repo("my-org/my-model", repo_type="model", private=True)
api.upload_folder(repo_id="my-org/my-model", folder_path="./checkpoints",
                  commit_message="v1 weights")
```

## Model cards

A model card is the repo's `README.md` with YAML front-matter. Ship one on every upload — an
uncarded repo is unsearchable and unusable by others.

```markdown
---
license: apache-2.0
pipeline_tag: text-generation
base_model: meta-llama/Llama-3.1-8B
tags: [llama, fine-tune, instruct]
language: [en]
---

# my-model

What it is, what it was trained on, intended use, limitations, and how to load it.
```

## Gated & licensed models

- **Gated** repos (Llama, Gemma, many others): accept the terms on the model page first, then use
  a token with **read** scope. Without acceptance the download/inference returns `403`.
- Read the `license` field before shipping: Apache-2.0/MIT are permissive; Llama/Gemma carry
  commercial conditions; `cc-by-nc`/"research-only" means you cannot ship it commercially.

## `hf jobs run`

Run a one-off containerized or `uv`-script job on HF infra (a PRO feature) — the path for an
eval, a batch convert, or a fine-tune without standing up an Endpoint or a Space.

```bash
hf jobs run python:3.12 -- python -c "print('runs on HF infra')"
```
