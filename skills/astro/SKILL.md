---
name: astro
description: "Use when building a content-driven or marketing site with Astro 6: static-first pages, islands and partial hydration, content collections, server islands, per-route on-demand rendering, deploy adapters, and Astro 5→6 migration. NOT app-router React with server actions and heavy client interactivity (that is `nextjs`)."
tags: [astro, ssg, islands, content-collections, partial-hydration, marketing-site, frameworks]
recommends: [landing-copy, seo-geo, vercel, cloudflare, netlify]
origin: risco
---

# Astro 6 — static-first sites, islands, content collections

## The prime directive

**Ship zero client JavaScript by default. Hydrate the smallest possible surface, as late as you can
get away with.** An `.astro` component renders to HTML at build time and ships *no* runtime; every
island is a bundle the visitor downloads, parses, and executes. Content and marketing sites win on
TTFB/LCP and Lighthouse, not on React-everywhere. If you find yourself adding `client:load` to make
a page "work," stop — the page already works; you are adding interactivity, and interactivity is the
expensive exception, not the default.

## First: detect the project version

Astro 6.0 is stable ([released 2026-03-10](https://astro.build/blog/astro-6/)); the Astro 5 line is
still production-ready. Do not mix advice across majors — read `package.json` → the `astro` version
before advising. What v6 changes, per the
[upgrade-to-v6 guide](https://docs.astro.build/en/guides/upgrade-to/v6/):

- **Node `22.12.0` or higher is required** (18 and 20 are dropped) — check the actual runtime.
- Content config lives at `src/content.config.ts`. The legacy `src/content/config.ts` path is
  **removed**, not merely discouraged, and the old auto-detection (`legacy.collections`) is gone.
  The `legacy.collectionsBackwardsCompat` escape hatch is a migration crutch, not a supported layout.
- **Vite 7** and **Zod 4** for content schemas — `z` is imported from `astro/zod`, **not**
  `astro:content` (see Content collections below).
- **Live Content Collections**, the **Fonts API** and the **CSP API** are stable.
- The Rust compiler succeeding the Go one is *experimental* — do not rely on or configure it in
  production advice.

## Decision table — what kind of thing is this?

Pick the cheapest row that satisfies the requirement. Read top-down; stop at the first match.

| Need                                                   | Use                                      | Why                                                        |
| ------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------- |
| Pure content, no interactivity                         | `.astro` component, static               | Renders to HTML at build, ships **0 KB** JS                |
| One small interactive widget                           | UI-framework component + `client:*`      | Hydrate just that island; the rest stays static            |
| Per-request personalization on a mostly-static page    | server island (`server:defer`)           | Static CDN page + one deferred fragment, no full SSR       |
| Whole route needs request data on every load           | `export const prerender = false` + adapter | Opt that one route into on-demand rendering              |
| Many static routes generated from data                 | `getStaticPaths()`                       | Build-time fan-out, still fully static                     |

## Rendering model

Default: **every page is prerendered to static HTML** at build time. You opt *into* dynamism per
route — never the other way around.

```astro
---
// src/pages/dashboard.astro — opt this ONE route into on-demand (SSR) rendering.
// Requires a configured adapter (Vercel/Netlify/Cloudflare/Node). Everything else stays static.
export const prerender = false;
const user = await getUser(Astro.request); // runs per request
---
<h1>Hello {user.name}</h1>
```

```astro
---
// src/pages/blog/[slug].astro — many STATIC routes generated from data at build time.
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}
const { post } = Astro.props;
---
<h1>{post.data.title}</h1>
```

In Astro 6 the dev server runs the **production runtime** (Vite 7 Environment API), so dev no longer
diverges from prod on Cloudflare/Bun/Deno — fewer "works in dev, breaks on deploy" surprises. Adapter
choice per platform → `references/deploy-and-integrations.md`.

## Islands & client directives

A `client:*` directive turns a framework component into a hydrated island. Choose the **latest**
directive that still feels instant to the user — never default to `client:load`.

| Directive               | Hydrates when                       | Use for                                              |
| ----------------------- | ----------------------------------- | ---------------------------------------------------- |
| `client:load`           | Immediately on page load            | Above-the-fold, must-be-interactive-now controls     |
| `client:idle`           | On `requestIdleCallback`            | Important but not first-paint-critical widgets       |
| `client:visible`        | When it scrolls into view (IO)      | Below-the-fold carousels, comment boxes, maps        |
| `client:media={query}`  | When a media query matches          | Mobile-only menu, desktop-only panel                 |
| `client:only="react"`   | Client-only, **no SSR HTML**        | Components that crash during SSR (browser-only deps)  |

```astro
---
import Carousel from "../components/Carousel.tsx";
---
<!-- Bad: a below-the-fold carousel paying for JS at first paint -->
<Carousel client:load />

<!-- Good: defer its bundle until the user actually scrolls to it -->
<Carousel client:visible />
```

`client:only` gotcha: it **skips SSR entirely**, so the component produces no server HTML (expect a
flash/layout shift) and you **must** name the framework (`client:only="react"`) — Astro can't infer
it without the server render. Reach for it only when SSR genuinely breaks; otherwise prefer
`client:visible`.

## Content collections (Content Layer)

Type-safe content lives in a single config file. The path is load-bearing:

```typescript
// src/content.config.ts  ← v6 path. NOT src/content/config.ts (legacy path removed in v6)
import { defineCollection } from "astro:content";
import { z } from "astro/zod"; // v6: z moved OUT of astro:content into astro/zod (Zod 4)
import { glob } from "astro/loaders";

const blog = defineCollection({
  // glob() sources files from anywhere; `id` comes from the filename minus extension
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/data/blog" }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
```

Query and render in a page. `render()` is now a standalone call (not `entry.render()`):

```astro
---
// src/pages/blog/[slug].astro
import { getCollection, getEntry, render } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}
const { post } = Astro.props;
const { Content } = await render(post);
---
<article><h1>{post.data.title}</h1><Content /></article>
```

Built-in loaders are `glob()` (many files) and `file()` (one JSON/YAML array). Custom and CMS
loaders, Zod 4 schema patterns, collection references, Live Content Collections (real-time data with
no rebuild, stable in v6), querying and MDX details → `references/content-layer.md`.

## Server islands

When most of a page is static and CDN-cacheable but **one fragment** is per-visitor, use a server
island instead of turning the whole route into SSR. The page ships static; the island is fetched
and rendered after first paint.

```astro
---
// src/components/UserGreeting.astro — rendered on demand, deferred after the static shell
const user = await getUserFromCookie(Astro.request);
---
<span>Welcome back, {user.name}</span>
```

```astro
---
import UserGreeting from "../components/UserGreeting.astro";
---
<header>
  <!-- static page, one deferred personalized fragment with a placeholder while it loads -->
  <UserGreeting server:defer>
    <span slot="fallback">Welcome</span>
  </UserGreeting>
</header>
```

This beats full SSR when: the page is otherwise cacheable on a CDN, and only a small slice depends on
the request. You keep static LCP and personalize without making every request hit the origin.

## Integrations & setup

Use `astro add` so it patches `astro.config.mjs` and installs peers in one step:

```bash
npx astro add react mdx sitemap
```

- **Tailwind 4** wires through the official **Vite plugin** (`@tailwindcss/vite`), not the legacy
  `@astrojs/tailwind` integration (that path was for Tailwind 3).
- **Fonts API** (stable in v6) self-hosts and optimizes fonts from `astro.config.mjs` — no manual
  `@font-face`.
- **CSP API** (stable in v6) emits a Content-Security-Policy with hashes for your inline
  scripts/styles.

Adapter recipes per platform, hybrid rendering, env handling, SSR endpoints (`src/pages/api/*.ts`)
and the Fonts/CSP config → `references/deploy-and-integrations.md`.

## Performance rules

- Images: always `<Image>`/`<Picture>` from `astro:assets` — automatic width/height, format, and
  lazy-loading kill CLS and over-sized payloads. Never a raw `<img>` for local assets.
- Never global-hydrate: there is no "make the page interactive" switch; hydrate per island.
- View transitions: add `<ClientRouter />` from `astro:transitions` to the `<head>` for SPA-like
  navigation without an SPA. Prefetch links with the `prefetch` config/attribute.

## Astro 5 → 6 migration checklist

Run the codemod first, then verify each item:

```bash
npx @astrojs/upgrade
```

- [ ] Node runtime is **`22.12.0`+** (CI image, local, deploy target).
- [ ] Dependencies on **Vite 7** (Vite v7.0; custom Vite plugins/config may need updates).
- [ ] Schema `z` import moved: **`import { z } from "astro/zod"`** — `z` and `astro:schema` are gone
      from `astro:content`. Then review for **Zod 4** breaking changes.
- [ ] Content config renamed to **`src/content.config.ts`** (delete `src/content/config.ts`; the
      legacy path is removed, not just deprecated).
- [ ] Full guide (dated 2026): `docs.astro.build/en/guides/upgrade-to/v6`.

## Anti-patterns

| Anti-pattern                                             | Reality                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| "Add `client:load` so the page works"                    | An `.astro` page already works statically; you're shipping JS for nothing   |
| "`client:load` everywhere, simplest"                     | Pick `client:visible`/`idle`/`media`; first-paint JS is the LCP killer       |
| "Make the whole route SSR to personalize the header"     | Use a server island (`server:defer`); keep the page static & CDN-cached     |
| "`src/content/config.ts` worked before, keep it"         | v6 removed that path (LegacyContentConfigError) — must be `src/content.config.ts` |
| "`fetch()` the CMS inside the `.astro` frontmatter"      | Write a content-collection loader so content is typed, cached, and queryable |
| "Pull in React just to render this static markup"        | Static markup is an `.astro` component — 0 KB, no framework runtime          |
| "Skip the Zod schema, content is just frontmatter"       | Untyped content = silent build-time drift; the schema is the contract        |
| "`client:only` without the framework name"               | It can't infer the framework with no SSR — must be `client:only="react"`     |
| "Use the old `@astrojs/tailwind` for Tailwind 4"         | Tailwind 4 wires through `@tailwindcss/vite`; the old integration is v3-era  |

## Verify

`bash scripts/verify.sh` from the Astro project root — grep-based, needs no install. It **FAILS** if
a v6 project still has `src/content/config.ts` instead of `src/content.config.ts`, **WARNS** on
over-hydration smells (many `client:load`, or `client:only` with no framework string), **CHECKS**
that content schemas import from `astro:content`, and — only if the `astro` binary resolves —
optionally runs `npx astro check`. On an empty or clean tree it prints OK and exits 0; warnings are
advisory and never fail the run.

## See Also

- `../nextjs/SKILL.md` — when the project is really an app-router React app with server actions and
  heavy client interactivity, not a content/marketing site.
- `../landing-copy/SKILL.md` and `../seo-geo/SKILL.md` — this skill builds the site; those write the
  copy and decide the SEO/structured-data strategy that fills it.
- `../vercel/SKILL.md`, `../netlify/SKILL.md`, `../cloudflare/SKILL.md` — platform mechanics (DNS,
  env, build settings) once the code and adapter are ready.
