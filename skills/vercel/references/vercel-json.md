# `vercel.json` — full key catalog

Static config for a Vercel project. Add `"$schema": "https://openapi.vercel.sh/vercel.json"` for
editor autocomplete and validation. `vercel.ts` supports the **same** properties but runs at build
time, so it can compute config from env vars or API calls.

## Top-level keys (current)

| Key | Type | Notes |
| --- | --- | --- |
| `$schema` | string | Set to `https://openapi.vercel.sh/vercel.json` for validation |
| `buildCommand` | string | Overrides the framework build command |
| `bunVersion` | string | Pin the Bun version used for builds |
| `cleanUrls` | boolean | Drop `.html`/`.htm` extensions from paths |
| `crons` | array | Scheduled invocations — **production only** (see below) |
| `devCommand` | string | Command for `vercel dev` |
| `fluid` | boolean | Fluid compute toggle (on by default for new projects since 2025-04-23) |
| `framework` | string | Framework preset (e.g. `nextjs`); `null` for no preset |
| `functions` | object | Per-path function config (see below) — cannot combine with legacy `builds` |
| `headers` | array | Response headers by path |
| `ignoreCommand` | string | Run before build; **exit 0 = skip/cancel the build** |
| `images` | object | Image Optimization config |
| `installCommand` | string | Overrides dependency install |
| `outputDirectory` | string | Build output dir |
| `public` | boolean | Expose source/logs publicly |
| `redirects` | array | URL redirects (status changes the visible URL) |
| `bulkRedirectsPath` | string | Path to a large redirects file |
| `regions` | array | Default deployment regions |
| `functionFailoverRegions` | array | Failover regions (Enterprise) |
| `rewrites` | array | URL rewrites (URL stays, content swaps) |
| `routes` | array | Low-level routing (prefer rewrites/redirects/headers) |
| `trailingSlash` | boolean | Force/forbid a trailing slash |

`functions` and the legacy `builds` are mutually exclusive — use `functions`.

## `functions` object

```json
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs22.x",
      "maxDuration": 60,
      "regions": ["fra1", "iad1"],
      "includeFiles": "data/**",
      "excludeFiles": "tests/**",
      "supportsCancellation": true
    }
  }
}
```

| Key | Notes |
| --- | --- |
| `runtime` | Runtime identifier; default Node (Vercel Functions). Edge Functions are deprecated |
| `memory` | **Not under Fluid** — set default memory/CPU in the dashboard instead |
| `maxDuration` | Max wall-clock seconds per invocation; plan-bound (table below) |
| `supportsCancellation` | Node only |
| `includeFiles` / `excludeFiles` | Glob extra/omitted files in the function bundle |
| `regions` | Where the function runs |
| `functionFailoverRegions` | Enterprise failover |

### Per-plan duration & memory

Under Fluid compute (on by default):

| Plan | `maxDuration` default → ceiling | Memory / CPU default → max |
| --- | --- | --- |
| Hobby | 300s → 300s | 2 GB / 1 vCPU → 2 GB / 1 vCPU |
| Pro | 300s → 800s (1800s in the extended-duration beta) | 2 GB / 1 vCPU → 4 GB / 2 vCPU |
| Enterprise | 300s → 800s (1800s in the extended-duration beta) | 2 GB / 1 vCPU → 4 GB / 2 vCPU |

Above 800s, set `maxDuration` per function, not as a project default. Under Fluid the default
memory/CPU is a dashboard setting, not a `vercel.json` key.

## `crons`

```json
{ "crons": [{ "path": "/api/digest", "schedule": "0 * * * *" }] }
```

- Each entry needs a `path` (must start with `/`) and a `schedule` (cron expression).
- Crons run **only on the production deployment** — never on preview.

## `rewrites` / `redirects` / `headers`

```json
{
  "redirects": [{ "source": "/old", "destination": "/new", "permanent": true }],
  "rewrites": [{ "source": "/proxy/:path*", "destination": "https://api.example.com/:path*" }],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "X-Frame-Options", "value": "DENY" }] }
  ]
}
```

- `redirects`: `permanent: true` → 308 (cacheable), `false` → 307. Changes the visible URL.
- `rewrites`: URL stays in the address bar; different content/origin is served. Use for proxying.
- `headers`: attach response headers per path.

## `vercel.ts` example

```ts
import type { VercelConfig } from "@vercel/config";

const config: VercelConfig = {
  functions: {
    "api/**/*.ts": {
      maxDuration: process.env.SLOW_API === "1" ? 60 : 15,
      regions: [process.env.PRIMARY_REGION ?? "fra1"],
    },
  },
  crons: [{ path: "/api/digest", schedule: "0 * * * *" }],
  cleanUrls: true,
};

export default config;
```

Use `vercel.ts` only when config must be *generated*; otherwise prefer the static `vercel.json`.

For the full region identifier list (`fra1`, `iad1`, `sfo1`, …) consult the Vercel regions doc — they
change over time and are not worth hard-coding here.
