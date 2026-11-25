# Publishing reference — containers, fields, errors, batching

All endpoints on `https://{GRAPH_HOST}/{GRAPH_VERSION}/...` with `GRAPH_VERSION=v25.0`.

## Container fields by media type

### Reels (`media_type=REELS`)

| Field | Required | Notes |
|---|---|---|
| `media_type` | yes | Literal `REELS` |
| `video_url` | yes | Public MP4, reachable for the whole processing window |
| `caption` | no | Up to 2200 chars; hashtags/mentions allowed |
| `share_to_feed` | no | `true` shows the Reel in the main feed grid too |
| `cover_url` | no | Public image URL for the cover frame |
| `thumb_offset` | no | Milliseconds into the video for the auto-cover (ignored if `cover_url` set) |
| `location_id` | no | A Page id usable as a location tag |

### Single image / feed (`media_type` omitted or `IMAGE`)

Use `image_url` instead of `video_url`. No `share_to_feed`.

### Stories (`media_type=STORIES`)

`video_url` or `image_url`; no `caption`. Expires after 24h. Insights metric set differs (see insights-metrics.md).

### Carousel (two-stage)

1. Create each child container with `is_carousel_item=true` (+ `image_url`/`video_url`).
2. Create the parent: `media_type=CAROUSEL`, `children=<id1>,<id2>,...`, optional `caption`.
3. Poll the parent's `status_code`, then `media_publish` the parent `creation_id`.

Why the extra stage: children must each finish before the parent can be published.

## Status codes

`GET /{container-id}?fields=status_code,status` returns one of:

- `IN_PROGRESS` — keep polling (~60s cadence).
- `FINISHED` — publish now.
- `ERROR` — read `status` for the reason; do not retry the same source blindly.
- `EXPIRED` — container sat unpublished for 24h; recreate from step 1.

Poll ceiling ~5 minutes. Containers are not permanent.

## Common error subcodes on publish

| Subcode | Meaning | Fix |
|---|---|---|
| 2207042 (code 9) | 24h publish limit reached (100/account) | Wait or read `content_publishing_limit` |
| 2207027 (code 9007) | Media not ready / not `FINISHED` | Poll until `FINISHED` first |
| 2207003 (code -2) | Media download took too long | Serve `video_url` from a fast, public host |
| 2207052 (code 9004) | Media could not be fetched | Make `video_url` truly public |
| 2207026 (code 352) | Unsupported video format | Re-encode H.264/HEVC + AAC, 3 s–15 min, ≤300 MB, 9:16 recommended |

## Retry / backoff snippet

```python
import time, requests

def wait_finished(base, cid, tok, max_tries=10, step=30):
    for _ in range(max_tries):
        st = requests.get(f"{base}/{cid}",
                          params={"fields": "status_code", "access_token": tok}
                          ).json()["status_code"]
        if st == "FINISHED":
            return
        if st in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"{cid} -> {st}")
        time.sleep(step)
    raise TimeoutError(f"{cid} never FINISHED")
```

## Batch publish with cap check

```python
def remaining_quota(base, uid, tok):
    d = requests.get(f"{base}/{uid}/content_publishing_limit",
                     params={"fields": "quota_usage,config", "access_token": tok}
                     ).json()["data"][0]
    return d.get("config", {}).get("quota_total", 100) - d.get("quota_usage", 0)

def publish_batch(base, uid, tok, jobs):
    published = []
    for video_url, caption in jobs:
        if remaining_quota(base, uid, tok) <= 0:
            break  # stop cleanly; don't trip subcode 2207042
        cid = requests.post(f"{base}/{uid}/media", data={
            "media_type": "REELS", "video_url": video_url,
            "caption": caption, "access_token": tok}).json()["id"]
        wait_finished(base, cid, tok)
        mid = requests.post(f"{base}/{uid}/media_publish",
                            data={"creation_id": cid, "access_token": tok}
                            ).json()["id"]
        published.append(mid)
    return published
```

Check the cap *inside* the loop, not once before — each publish consumes one slot.
