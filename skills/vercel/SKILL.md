---
name: vercel
description: "Use when operating an already-chosen Vercel project from the CLI or its config file — preview versus production deploys, debugging builds, pushing and pulling env vars across environments, custom domains, function runtime, duration and regions, crons, rewrites and headers, and deployment protection. NOT host choice, Docker or CI (that is `deployment`), NOT Next.js app code or next.config (that is `nextjs`), NOT DNS records or registrar transfers (that is `domains-dns`)."
tags: [vercel, deploy, serverless, edge, env-vars]
recommends: [deployment, nextjs, domains-dns]
origin: risco
---

# Vercel, operated

The operator's manual for a project that already lives on Vercel: the commands you run and the
config keys you set, with the 2025-2026 platform baked in — **Fluid compute on by default**, and
**Edge Functions deprecated** (folded into Vercel Functions). Every claim here maps to a CLI command
or a `vercel.json` key, not vibes.

This skill assumes the host decision is settled. If you are still asking *where* to run, or you need
a Dockerfile / CI pipeline, that is `../deployment/SKILL.md`. If you are writing the app's route
handlers or `next.config.js`, that is `../nextjs/SKILL.md`.

```text
git push branch ──────────────▶ preview deployment (unique URL, protected on Hobby)
vercel              ───────────▶ preview deployment from your machine
vercel --prod       ───────────▶ production domain
vercel dev          ───────────▶ local emulation of functions + routing
                    config:  vercel.json (static)  |  vercel.ts (generated at build time)
                    env:     scoped per environment  →  production / preview / development
```

## When to use / When NOT to use

**When to use:**

- Linking a repo (`vercel link`), deploying (`vercel`, `vercel --prod`), or debugging a build.
- Authoring or fixing `vercel.json` / `vercel.ts`: `functions`, `crons`, `rewrites`, `redirects`,
  `headers`, `regions`, `cleanUrls`, `trailingSlash`, `framework`, `buildCommand`.
- Managing env vars across the three environments: `vercel env add|pull|ls`, `.env.local`, sensitive
  vars, `vercel env pull` round-trips that "don't update".
- Attaching a custom domain (`vercel domains add`), aliasing, deployment protection scopes.
- Setting function `maxDuration` / `regions`, choosing edge vs Node runtime, configuring crons.
- Reading `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_*` inside the running app.

**When NOT to use:**

- "Vercel vs Hetzner vs Coolify, Dockerfile, GitHub Actions CI" → `../deployment/SKILL.md`. That skill
  owns the host *choice* and containers; this one operates the chosen Vercel project.
- Next.js application code, App Router, RSC, `next.config.js`, ISR logic → `../nextjs/SKILL.md`.
  This skill only touches the Vercel-side knobs (function config, env, ISR-as-a-function).
- Raw DNS records, registrar transfers, nameserver theory → `../domains-dns/SKILL.md`. Here we cover
  only the `vercel domains` / `vercel dns` CLI surface for attaching a domain to a project.
- A different platform (Netlify, Railway, Render, Fly, Cloudflare) → its own sibling. For Cloudflare
  Pages/Workers, see `../cloudflare/SKILL.md`.

## Mental model

Three facts make Vercel predictable:

1. **A deployment is immutable and tied to one environment.** `git push` to a branch → a preview;
   `vercel --prod` (or a push to the production branch) → production. You never "edit" a deployment;
   you ship a new one and the domain points at it.
2. **Env vars are scoped, not global.** A var exists in some subset of `{production, preview,
   development}`. Pulling for the wrong environment is the #1 "my var is missing locally" cause.
3. **Config has two front doors with identical keys.** `vercel.json` is static; `vercel.ts` runs at
   build time and can compute the same properties from env vars or an API call. Pick `vercel.json`
   unless you genuinely need to generate config.

## First contact — which path

| Situation | Do this |
| --- | --- |
| New project, never linked | `vercel link` (or first `vercel` run prompts to set it up), then `vercel` for a preview |
| Existing repo, just deploying | `vercel` for a preview URL, `vercel --prod` when ready |
| Only need the prod env vars locally | `vercel env pull .env.local` (see env section — pick the env) |
| Only attaching a domain | jump to Domains: `vercel domains add example.com` |
| Build failing | `vercel --prod --debug`, then read the build log; check `buildCommand`/`installCommand`/`framework` in `vercel.json` |
| Function times out | not a deploy bug — set `maxDuration` (and confirm your plan's ceiling) in `functions` |

## Deploy & build

```bash
vercel                 # deploy a PREVIEW from the current dir, prints a unique URL
vercel --prod          # deploy to the PRODUCTION domain
vercel dev             # run functions + routing locally (emulates the platform)
vercel link            # associate this dir with a Vercel project (.vercel/ created)
vercel pull            # fetch project settings + env into .vercel/.env.* for local builds
vercel --prod --debug  # same prod deploy with verbose build output for debugging
```

Skip redundant builds with `ignoreCommand` — Vercel runs it and **cancels the build when it exits
`0`** (yes, zero means skip). Useful in a monorepo where most pushes don't touch this project:

```json
{ "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ." }
```

Bad → Good, the one that bites everyone:

```bash
# Bad: secrets committed so the build can read them
echo "STRIPE_SECRET=sk_live_..." >> .env && git add .env && git commit

# Good: secret lives in Vercel, never in git; pulled only for local dev
vercel env add STRIPE_SECRET production
vercel env pull .env.local        # .env.local is gitignored by Next/Vite defaults
```

## Environments & env vars

Why scoping matters: the same key holds different values in `production`, `preview`, and
`development`, and the CLI treats `development` specially.

```bash
vercel env ls                          # list which vars exist in which environments
vercel env add API_URL production      # add to production (prompts for the value)
vercel env add API_URL preview         # separate command for preview
vercel env pull .env.local             # writes vars for the local-linked env into .env.local
vercel env pull .env.local --environment=preview   # pull a SPECIFIC environment
vercel env run -- npm run seed         # run a command with the project's vars injected
```

Gotchas, each with the reason:

- **You cannot add `development` in the same command as `production`/`preview`.** The API rejects
  mixing the dev environment with the others — run a second `vercel env add … development`. (Run
  `vercel env add` with no args for the interactive picker.)
- **`vercel env add` for production/preview/custom defaults the var to *sensitive*** (write-only;
  you can't read it back, only overwrite). Fine for secrets, surprising for plain config.
- **"`vercel env pull` doesn't update my `.env.local`"** is almost always the *environment*: pull
  defaults to the linked environment (usually development). Pass `--environment=preview` (or
  `production`) to get the values you actually mean. It overwrites the target file, so re-pull after
  you change a var in the dashboard.
- **Browser-exposed vars need the framework prefix.** Anything reachable in client code must be
  prefixed (`NEXT_PUBLIC_` for Next.js, `VITE_` for Vite). No prefix → server-only. Never prefix a
  secret.

System vars are read-only and prefixed `VERCEL_` — read them in the app, never set them:

```ts
const env = process.env.VERCEL_ENV        // 'production' | 'preview' | 'development'
const url = process.env.VERCEL_URL        // deployment host, no protocol
const branch = process.env.VERCEL_GIT_COMMIT_REF  // git branch that triggered the deploy
```

Checklist — "my var isn't showing up locally":

1. `vercel env ls` — does the var exist in the environment you expect?
2. Re-run `vercel env pull .env.local --environment=<env>` (it overwrites, doesn't merge).
3. Browser code? Confirm the framework prefix (`NEXT_PUBLIC_`/`VITE_`).
4. Dev server reads `.env.local` at boot — restart it.

## vercel.json essentials

Add the `$schema` line first — you get editor autocomplete and validation for free.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30,
      "regions": ["fra1"]
    }
  },
  "crons": [{ "path": "/api/digest", "schedule": "0 * * * *" }],
  "redirects": [{ "source": "/old", "destination": "/new", "permanent": true }],
  "rewrites": [{ "source": "/proxy/:path*", "destination": "https://api.example.com/:path*" }],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "X-Frame-Options", "value": "DENY" }] }
  ],
  "cleanUrls": true
}
```

Whys:

- **`maxDuration`** caps wall-clock per invocation. Defaults/ceilings are plan-bound (Hobby 60s, Pro
  300s, Enterprise 900s). Setting `30` on Hobby is fine; setting `300` on Hobby silently can't apply.
- **No `memory` key here when Fluid is on** (default for new projects since 2025-04-23). Under Fluid,
  default function memory/CPU is a *dashboard* setting, not a `vercel.json` key — putting `memory`
  in-file is ignored or rejected. See `references/vercel-json.md`.
- **`crons` fire only on the production deployment.** Each entry needs a `path` starting with `/` and
  a `schedule` cron expression. They never run against preview. Don't expect a preview to tick.
- **`redirects` change the URL the browser sees** (`permanent: true` → 308, cacheable); **`rewrites`
  keep the URL and serve other content** (proxying, framework routing); **`headers` add response
  headers** by path. Reaching for the wrong one of these three is the classic mistake.
- **`functions` cannot be combined with the legacy `builds` key** — pick one; `functions` is current.

`vercel.ts` exports the same shape but is code that runs at build time — use it only to *generate*
config (e.g. regions from an env var). Full top-level key catalog (21 keys), object shapes, and the
per-plan limit table live in `references/vercel-json.md`.

## Runtimes in 2025-2026

Edge Functions and Edge Middleware were **deprecated and unified into Vercel Functions** — the edge
runtime now runs *on* Vercel Functions (changelog "Edge Middleware and Edge Functions are now powered
by Vercel Functions", 2025-06). What this means for you:

- **New standalone functions: don't set `runtime: 'edge'`.** Use the default Node runtime (Vercel
  Functions). Reaching for the edge runtime for a fresh API route is the deprecated path.
- **Routing Middleware still defaults to the edge runtime** — the deprecation does *not* apply to it.
  Leave middleware as-is.
- **Pick Node** when you need full Node APIs, longer duration, larger payloads, or a database driver
  that isn't edge-compatible. The Fluid-compute default already gives you fast cold starts and
  concurrency, so the old "use edge for speed" reflex is mostly obsolete.

## Domains & deployment protection

```bash
vercel domains add example.com         # attach a domain to the current project
vercel domains ls                      # list domains
vercel domains inspect example.com     # show config + nameserver/record status
vercel domains add example.com --force # move it off whatever project currently holds it
vercel alias set <deployment-url> staging.example.com   # point an alias at a deployment
```

For DNS records themselves (`vercel dns add`) beyond attachment, and for registrar/nameserver theory,
see `../domains-dns/SKILL.md`.

**Deployment Protection** is per-project: a *method* (Vercel Authentication or Password) plus a
*scope*. On **Hobby, Standard Protection covers preview deployments and the generated deployment
URLs; the production custom domain stays public.** For CI that must hit a protected preview, use a
protection-bypass token rather than disabling protection — recipe in `references/cli-cookbook.md`.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
| --- | --- | --- |
| `memory` set inside `functions` on a Fluid project | Ignored/rejected — Fluid sets memory/CPU in the dashboard, not the file | Remove `memory`; set the default in project settings |
| `builds` + `functions` together | Legacy `builds` is mutually exclusive with `functions` | Delete `builds`; express everything via `functions` |
| Committing `.env` so the build can read secrets | Secret leaks into git history; rotates badly | `vercel env add`; `vercel env pull` for local only |
| Expecting `crons` to run on a preview | Crons execute only on the production deployment | Test the handler with `vercel dev`; rely on prod for the schedule |
| Cranking `maxDuration` to the plan ceiling to mask a slow query | Hides the real bug; burns compute; still hits the hard cap | Fix the query/timeout; set `maxDuration` to a sane headroom value |
| `runtime: 'edge'` on a new standalone function | Edge Functions are deprecated → Vercel Functions | Use the default Node runtime; keep edge only for middleware |
| Using `redirect` when you meant `rewrite` (or vice-versa) | Redirect changes the visible URL; rewrite keeps it | Redirect for moved URLs (308), rewrite for proxy/internal routing |
| `vercel env pull` then surprised the value is stale | Pull overwrites for one environment at the moment you run it | Re-pull with `--environment=<env>` after any dashboard change |

## References

- `references/vercel-json.md` — every top-level key, the `functions`/`crons`/`rewrites`/`redirects`/
  `headers` object shapes, the per-plan `maxDuration`/`memory` limit table, and a `vercel.ts` example.
- `references/cli-cookbook.md` — copy-paste CLI recipes (link, deploy, env round-trip, domains +
  alias, promote a preview to production, protection-bypass for CI) and the full `VERCEL_*` system
  env var table.
