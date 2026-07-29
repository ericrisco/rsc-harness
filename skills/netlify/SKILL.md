---
name: netlify
description: "Use when deploying or operating a site on Netlify — writing or fixing netlify.toml, authoring Functions or Edge Functions, redirects, rewrites and headers, env vars per deploy context, and shipping via the Netlify CLI. NOT deploying to Vercel (that is `vercel`)."
tags: [netlify, deployment, serverless-functions, edge-functions, netlify-toml, redirects]
recommends: [vercel, cloudflare, nextjs, domains-dns, github-actions]
origin: risco
---

# Netlify — netlify.toml, Functions, Edge Functions, redirects & the CLI

> The platform-mechanics layer for Netlify: config, function handlers, routing, env
> contexts, and the deploy CLI. Not framework code, not generic CI.

## What this owns

You own the Netlify adapter/config surface — `netlify.toml`, `netlify/functions/`,
`netlify/edge-functions/`, `_redirects`, `_headers`, and `netlify <cmd>`. You do **not** own
the app's routing or data layer (that is `../nextjs/SKILL.md` / a React skill), DNS records
(`../domains-dns/SKILL.md`), or another platform's config — Vercel is `../vercel/SKILL.md`,
Cloudflare is `../cloudflare/SKILL.md`. Their config files and function models differ; never
cross-apply.

## The 5-minute happy path

```bash
netlify link                 # link the cwd to a site (or `netlify init` to create one)
# write/edit netlify.toml (see skeleton below)
netlify dev                  # local emulation: build, functions, redirects, env injection
netlify deploy --prod        # build + push straight to production
```

`netlify deploy` with no flag creates a **draft** deploy (preview URL, not live). `--prod`
publishes. Test with `netlify dev` first — it is the only local runtime that emulates
redirects and function routing together.

## Where does each piece of config live?

Two rules decide everything below: **`_redirects`/`_headers` files are processed before the
`netlify.toml` equivalents**, and a function's own `config` export beats dashboard guesses.

| Concern | Put it in | Why |
| --- | --- | --- |
| Redirects / rewrites / SPA fallback | `[[redirects]]` in toml **or** `_redirects` file | One source. File rules run first; pick one and stay consistent. |
| Response headers (CSP, caching) | `[[headers]]` in toml **or** `_headers` file | Same precedence; keep security headers in version control, not the UI. |
| Build command / publish dir / functions dir | `[build]` in toml | Single declarative source the build picks up; survives UI drift. |
| A function's URL path | `export const config = { path }` in the function | Co-located with the handler; deterministic, no dashboard mapping. |
| Edge function path + ordering | `[[edge_functions]]` in toml | Declaration order in toml is deterministic (inline config is not). |
| Secrets / API keys / per-context vars | dashboard or `netlify env:set` | Never commit secrets — build-time secrets scanning fails the build if it finds one. |

## netlify.toml skeleton

```toml
[build]
  command  = "npm run build"
  publish  = "dist"            # the directory you deploy; relative to base
  functions = "netlify/functions"
  [build.environment]
    NODE_VERSION = "22"

[functions]
  node_bundler = "esbuild"
  # included_files = ["data/**"]   # bundle extra files a function reads at runtime

# SPA fallback — note status 200, NOT 301 (see Redirects)
[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    Content-Security-Policy = "default-src 'self'"

# per-context override: deploy previews build differently
[context.deploy-preview]
  command = "npm run build:preview"
  [context.deploy-preview.environment]
    SHOW_PREVIEW_BANNER = "true"
```

Contexts are `production`, `deploy-preview`, `branch-deploy`, and `branch."name"`. Each can
override `command`, `publish`, `environment`, etc. The full key-by-key reference (every
`[build]`/`[functions]`/`[[plugins]]` option, all header/redirect fields) lives in
[references/netlify-toml.md](references/netlify-toml.md) — link there instead of inlining it.

## Functions (Node runtime)

Default directory is `netlify/functions/`. TypeScript files are `.mts`, JS is `.mjs` (ES
modules). Use the **modern Web-platform handler** — `Request` in, `Response` out — and route
with a `config` export, not a dashboard mapping.

```typescript
// netlify/functions/hello.mts
import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const name = new URL(req.url).searchParams.get("name") ?? "world";
  return Response.json({ hello: name });
};

export const config: Config = { path: "/api/hello" };
```

Read secrets from the environment; never hardcode them:

```typescript
const key = Netlify.env.get("RESEND_API_KEY") ?? process.env.RESEND_API_KEY;
```

Do **not** revive the legacy AWS-Lambda signature in new functions:

```javascript
// Bad — legacy handler/event/statusCode shape
exports.handler = async (event) => ({ statusCode: 200, body: "ok" });
```

```typescript
// Good — Web-API handler + Config.path
export default async (req: Request) => new Response("ok");
export const config: Config = { path: "/ok" };
```

Scheduled (`config.schedule` cron), background (`-background` suffix), and streaming
responses are covered in [references/functions.md](references/functions.md).

## Edge Functions (Deno runtime)

Live in `netlify/edge-functions/`, run on Deno at the edge. Declare them in toml so ordering
is explicit:

```toml
[[edge_functions]]
  function = "geo-rewrite"
  path     = "/*"
  # excludedPath = "/assets/*"
```

When **multiple** edge functions match one path, they run **top-to-bottom in declaration
order** — declaring in `netlify.toml` is deterministic; relying on each function's inline
`config` for ordering is not. Pick edge functions for latency-sensitive rewrites,
geolocation, and A/B routing. Avoid them for heavy npm dependencies or Node-only APIs — use a
regular Function there.

## Redirects & rewrites

```text
# _redirects (or the [[redirects]] equivalent)
/api/*   https://api.example.com/:splat   200   # proxy/rewrite: keep the URL, fetch remote
/old/*   /new/:splat                       301   # permanent redirect (default status)
/*       /index.html                        200   # SPA fallback
```

Three things people get wrong:

- **SPA fallback must be `status = 200`**, not 301. 200 *serves* `index.html` at the original
  URL so the client router can read the path; a 301 changes the URL and breaks deep links.
- **Proxy/rewrite = `status = 200`** to a remote URL (add `force = true` to override an
  existing file at that path).
- **Processing order**: Edge Functions run first, then `_redirects` rules, then `netlify.toml`
  redirects; within the set the **first matching rule wins** (top-to-bottom). Put specific
  rules above the `/*` catch-all.

## Env vars & deploy contexts

```bash
netlify env:set RESEND_API_KEY "xxxx" --context production
netlify env:set SHOW_BANNER "true" --context deploy-preview
netlify env:list --context deploy-preview
netlify env:import .env            # bulk import (do not commit .env)
```

Variables are scoped to deploy contexts, so a key can differ between production and previews.
Build-time **secrets scanning** inspects build output; if a value you marked secret leaks into
the bundle, the build **fails** — fix the leak, don't disable the scan blindly.

## Deploy & local dev

| Command | Use it for |
| --- | --- |
| `netlify dev` | Local: build + functions + redirects + env injection. The truth before deploy. |
| `netlify deploy` | Draft deploy → preview URL, not live. |
| `netlify deploy --prod` | Build + publish to production. |
| `netlify deploy --prod --no-build` | Publish an **already-built** dir; skips the build command. |
| `netlify deploy --skip-functions-cache` | Force re-bundle functions when a stale cache bites. |

`--no-build` is the classic foot-gun: if you didn't actually build (or built into the wrong
`publish` dir), you ship a stale or empty site. Only use it when the artifact is fresh.

## Anti-patterns

| Anti-pattern | Why it breaks | Do instead |
| --- | --- | --- |
| SPA fallback as `status = 301` | URL rewrites; deep-link refresh 404s or loops | `status = 200` to `/index.html` |
| Hardcoding API keys in a function | Leaks in bundle; secrets scan fails the build | `Netlify.env.get(...)` / `process.env`, set via `netlify env:set` |
| Legacy `exports.handler = (event) => ({statusCode})` | Old Lambda shape, mismatched runtime expectations | Web-API `export default (req) => Response` + `config.path` |
| Relying on inline edge `config` for run order | Ordering is non-deterministic across functions | Declare order in `[[edge_functions]]` in toml |
| `netlify deploy --prod --no-build` without building | Ships stale/empty `publish` dir | Build first, or drop `--no-build` |
| Pasting Vercel/Cloudflare config into Netlify | Different files & function models; nothing wires up | Use `netlify.toml` + `netlify/functions`; see `../vercel/SKILL.md` for Vercel |
| `functions` dir in toml ≠ actual folder on disk | Functions silently not bundled → 404 | Make `[build].functions` match `netlify/functions/` exactly |
| `/*` redirect above a specific rule | Catch-all wins first; specific rule never matches | Order specific rules before the `/*` fallback |

## Verify

Run `scripts/verify.sh [target-dir]` (default cwd). It confirms a `netlify.toml` exists,
parses, that any SPA fallback is `status = 200`, and that every `[[redirects]]` has both
`from` and `to`. Read-only; exits 0 on a clean or empty target.
