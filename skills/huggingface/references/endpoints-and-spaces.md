# Dedicated Endpoints & Spaces

## Dedicated Inference Endpoints

Your own autoscaling deployment of a model on managed HF infra. Graduate here from the router
when you need fixed latency/SLA or the router's pay-as-you-go cost stops being predictable.

### Pricing (billed per minute, shown hourly)

| Tier | From |
|---|---|
| CPU | ~$0.033 / core / hr |
| GPU (entry) | ~$0.50 / hr |
| GPU A10G | ~$1.00 / hr |
| GPU H200 (AWS) | ~$5.00 / hr |
| GPU H100 (GCP) | ~$10.00 / hr |

### Scale-to-zero

Enable scale-to-zero so the endpoint parks at **$0 when idle** and cold-starts on the next
request — the right default for bursty traffic. A bursty 100–1000 req/day workload typically
lands at **$20–60/mo**. The trade-off is cold-start latency on the first request after idle; keep
a minimum replica > 0 only if you cannot tolerate that.

### Deploy from the UI

1. Model page → **Deploy → Inference Endpoints**, pick cloud/region/hardware.
2. Set **Autoscaling**: min replicas (`0` for scale-to-zero), max replicas, scale-to-zero idle
   timeout.
3. Set security (Protected/Public) and create. Copy the endpoint URL.

### Deploy with `huggingface_hub`

```python
from huggingface_hub import create_inference_endpoint

ep = create_inference_endpoint(
    name="llama-31-8b",
    repository="meta-llama/Llama-3.1-8B-Instruct",
    framework="pytorch",
    task="text-generation",
    accelerator="gpu",
    instance_size="x1",
    instance_type="nvidia-a10g",
    vendor="aws",
    region="us-east-1",
    min_replica=0,          # scale-to-zero
    max_replica=2,
)
ep.wait()                   # block until the endpoint is running
print(ep.url)
```

Call it like any provider endpoint:

```python
from huggingface_hub import InferenceClient
client = InferenceClient(base_url=ep.url, api_key=os.environ["HF_TOKEN"])
```

### Cost worksheet

```text
monthly_cost ≈ active_minutes/month × (hourly_rate / 60)
# scale-to-zero ⇒ active_minutes ≈ requests × seconds_per_request / 60, plus cold starts
# Example: 500 req/day × 2s × 30 days = 500 min ≈ 8.3 hr/mo on A10G ($1/hr) ≈ $8/mo + cold starts
```

## Spaces

A Space hosts a demo app at a public `*.hf.space` URL. Pick the SDK by need:

| SDK | Use for | ZeroGPU? |
|---|---|---|
| Gradio | ML demos, the default | **Yes** |
| Streamlit | data-app UIs | No |
| Docker | arbitrary servers/full control | No |
| Static | HTML/JS front-ends | No |

### ZeroGPU

Dynamic GPU allocation: **half an NVIDIA RTX Pro 6000 Blackwell (48GB)** by default — or the full
96GB card with `@spaces.GPU(size="xlarge")`, at 2x quota cost — is grabbed only while a decorated
function runs and released when idle. **Gradio SDK only.**

```python
import spaces
import gradio as gr

@spaces.GPU                       # GPU acquired for the duration of this call
def generate(prompt: str) -> str:
    # load/run your model here
    return run_model(prompt)

gr.Interface(fn=generate, inputs="text", outputs="text").launch()
```

- Free accounts get a daily ZeroGPU quota; **PRO ($9/mo)** gives **8x daily quota**, queue
  priority, and up to **10 owned ZeroGPU Spaces**.
- Keep `@spaces.GPU` functions short — the slice is held for the whole call, so quota burns with
  wall-clock GPU time.
