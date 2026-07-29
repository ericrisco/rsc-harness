---
name: performance
description: "Use when a page or interaction is slow for one user and the fix starts from a measurement — a failing Core Web Vital (LCP, INP, CLS), a heavy JS bundle, wasted re-renders, an over-broad client boundary: profile, attribute the cost to one phase, fix it, re-measure. NOT surviving concurrent load (that is `scaling`), NOT the slow query (that is `postgresdb`)."
tags: [performance, core-web-vitals, lcp, inp, cls, bundle-size, profiling, react, web-vitals]
recommends: [scaling, postgresdb, redis, nextjs, react, observability, monitoring]
profiles: []
origin: risco
---

# Performance: make one thing fast

Performance makes a single request, page, or interaction faster for one user. Scaling makes many requests survive at the same time. Different problem, different toolbox — if the system is fine for you and only bends under concurrent load, that is `../scaling/SKILL.md`, not this.

The whole job in one line: **measure with a profiler → attribute the cost to one specific phase → apply the one fix that moves that phase → re-measure against a number.** Repeat until you clear the threshold, then stop.

**Prime directive: no fix without a profile first.** A waterfall, a flame chart, a bundle treemap, or a field CWV number comes before you touch code. The fix you guess is almost never the fix the measurement points at, and a "fast" change that moves a phase nobody was waiting on is wasted work that you then have to maintain.

Cross-reference, don't duplicate: the last column of the table below names where each deep fix lives. The one case it has no row for — you decided *what* to cache to cut a phase and now need that cache race-free — is `../redis/SKILL.md`.

## Decision table — symptom to first move

| Symptom | Metric / phase | First probe | First lever | Deep fix lives in |
|---|---|---|---|---|
| Slow load, hero appears late | LCP | Lighthouse + DevTools trace | attribute to a subpart, then fix that one | this skill / `../postgresdb/SKILL.md` if TTFB |
| Janky scroll, laggy typing/click | INP | DevTools Performance trace (long-task bars) | break the >50 ms task, yield | this skill |
| Layout jumps as it loads | CLS | Lighthouse layout-shift trace | reserve space (dimensions / aspect-ratio) | this skill |
| "First Load JS is huge" | bundle bytes | `@next/bundle-analyzer` / `source-map-explorer` | kill/replace the heavy dep, then dynamic import | this skill |
| Component re-renders constantly | render time | React DevTools Profiler ("why did this render") | fix the unstable ref / boundary | `../react/SKILL.md` for the pattern |
| `'use client'` drags server work down | First Load JS | bundle analyzer server/client trace | push the boundary to a leaf | `../nextjs/SKILL.md` |
| Slow **only** under concurrent load | throughput, not latency | load test | — not this skill — | `../scaling/SKILL.md` |
| TTFB dominated by one query | server time | query plan / `EXPLAIN` | — not this skill — | `../postgresdb/SKILL.md` |

## Step 0 — measure first: field vs lab

You have two kinds of measurement and they answer different questions. Use both, in this order.

- **Field data (CrUX, RUM via the `web-vitals` library) at the 75th percentile** tells you *what real users actually feel*. A metric passes when ≥75% of page views hit "good". This is the only number that matters for "is it actually a problem".
- **Lab data (Lighthouse, the Chrome DevTools Performance trace)** tells you *why* — it reproduces one load under controlled conditions so you can read the waterfall and flame chart.

**Rule: never optimize a lab number that no real user ever hits, and never report the mean — report the 75th percentile.** A lab Lighthouse run on a throttled cold cache can show an LCP your field p75 never sees; chasing it burns time on a phantom. Conversely a field INP failure with a clean lab run means you have not reproduced the slow interaction yet — go find it.

The output of Step 0 is **one sentence naming the bottleneck**: "LCP is 3.8 s and 2.1 s of it is resource load delay because the hero image is lazy-loaded." Do not proceed without that sentence. Tool runbooks (Lighthouse CI flags, reading a flame chart, the Profiler workflow, wiring `web-vitals` for RUM) live in `references/profiling-playbook.md`.

## CWV "good" thresholds (field p75)

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s |
| INP | ≤ 200 ms | 200–500 ms | > 500 ms |
| CLS | ≤ 0.1 | 0.1–0.25 | > 0.25 |

INP replaced FID as a Core Web Vital in March 2024 and is still a CWV — it measures the full interaction-to-next-paint, so a fast event handler with a slow paint still fails. As of 2025, ~62% of mobile pages hit good LCP (up from 44% in 2022), and LCP remains the hardest CWV to pass and the most common overall bottleneck — so start there when the symptom is "slow load".

## LCP — attribute to a subpart before fixing

LCP is not one thing. It decomposes into four sequential phases, and **each phase has a different fix**. Attribute first, then fix only the dominant phase.

| Subpart | What it is | The fix that moves it |
|---|---|---|
| TTFB | server + network to first byte | server work — punt to `../postgresdb/SKILL.md` (slow query) or `../scaling/SKILL.md` (under load); cache the response |
| Resource load delay | gap between TTFB and the LCP resource *starting* to load | discoverability — `<link rel="preload">`, `fetchpriority="high"`, never lazy-load the hero |
| Resource load duration | time to actually download the LCP resource | smaller/next-gen image, CDN, right dimensions, `priority` on `next/image` |
| Element render delay | resource downloaded but not yet painted | unblock the main thread / render-blocking CSS/JS, font readiness |

A text-node LCP rendered in a system font has zero load delay and zero load duration — its budget is all TTFB and render delay, so don't go hunting for an image to preload.

The single most common LCP mistake is lazy-loading the largest element. Make it eager and high priority:

```html
<!-- Bad: the hero is the LCP element and you just deferred it -->
<img src="/hero.webp" loading="lazy" alt="Product" />

<!-- Good: eager + high priority + reserved dimensions (also kills CLS) -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />
<img src="/hero.webp" fetchpriority="high" width="1200" height="630" alt="Product" />
```

```tsx
// Next.js: `priority` sets fetchpriority=high and disables lazy-loading for the LCP image
import Image from "next/image";
<Image src="/hero.webp" width={1200} height={630} priority alt="Product" />;
```

## INP — kill the long task

INP is dominated by **long tasks**: any main-thread task over **50 ms** blocks every interaction for its full duration. The fix is to break long work into chunks under 50 ms and yield to the main thread between them so a queued click or keypress can run.

```ts
// Bad: one 400ms loop blocks every click/keypress while it runs
function processAll(items: Item[]) {
  for (const item of items) heavyWork(item); // one long task
}

// Good: chunk + yield. scheduler.yield() resumes at the FRONT of the queue,
// so your continuation isn't starved behind newly-queued work.
async function processAll(items: Item[]) {
  for (let i = 0; i < items.length; i++) {
    heavyWork(items[i]);
    if (i % 50 === 0 && "scheduler" in globalThis) {
      await (globalThis as any).scheduler.yield();
    }
  }
}
```

Other INP levers, in order of payoff:

- **Move third-party JS off the main thread** (analytics, chat widgets, tag managers) — defer, load on interaction, or sandbox in a worker. Third-party scripts are the usual hidden long-task source.
- **Defer non-urgent handler work.** Do the visible state update now; push the expensive recompute behind `requestIdleCallback`, a debounce, or `startTransition`.
- **Measure the actual interaction** — the field INP failure names *which* interaction; reproduce it in a DevTools trace and read the long-task bar, don't guess.

## CLS — reserve the space

CLS comes from space that was not reserved before content arrived: images/video/ads/embeds without dimensions, content injected above existing content, and font swaps (FOUT). Fix by reserving the box up front.

```html
<!-- Bad: no dimensions, image reflows everything below it on load -->
<img src="/card.webp" alt="" />

<!-- Good: explicit box, zero shift -->
<img src="/card.webp" width="400" height="300" alt="" />
```

```css
/* Reserve space for ratio-based media and swap fonts without reflow */
.media { aspect-ratio: 16 / 9; }                 /* box exists before load */
@font-face { font-family: Inter; font-display: optional; size-adjust: 100%; }
```

Rules: give every image/embed explicit `width`/`height` or an `aspect-ratio`; render skeleton boxes the size of the real content; never insert banners/notices above content the user is already reading (push them below or overlay); use `font-display: optional` (or `swap` + `size-adjust`) so a font swap doesn't reflow text.

## Bundle size — analyze before you cut

Never guess what's heavy. Generate a treemap, read it, then cut the biggest box.

```bash
# Next.js: interactive treemap with server/client import tracing (Turbopack module graph)
ANALYZE=true npm run build      # with @next/bundle-analyzer wired in next.config

# Any webpack/Vite build: attribute bytes back to source via source maps
npx source-map-explorer 'dist/**/*.js'
```

Levers in order of payoff:

1. **Kill or replace the heavy dependency.** The treemap usually shows one or two boxes dwarfing everything (a date library, an icon set, a charting lib). Replace with a lighter one or a few lines of your own.
2. **Dynamic `import()` for non-critical UI.** Modals, editors, charts, anything below the fold or behind an interaction loads on demand instead of in First Load JS.
3. **Fix tree-shaking — stop importing the whole library for one function.** `import _ from "lodash"` pulls the entire library; import the one function (or use the native equivalent).

```tsx
// Bad: whole library in the initial bundle for one helper
import _ from "lodash";
const fn = _.debounce(save, 300);

// Good: named import (tree-shakeable) — or just write the 6-line debounce
import debounce from "lodash-es/debounce";
const fn = debounce(save, 300);
```

```tsx
// Bad: heavy editor in First Load JS even though it's behind a button
import { RichEditor } from "@org/rich-editor";

// Good: split it out, load on demand
import dynamic from "next/dynamic";
const RichEditor = dynamic(() => import("@org/rich-editor"), { ssr: false });
```

## Render cost — React 19, the compiler, and the boundary

**React 19 with the React Compiler auto-memoizes**, so blanket defensive `useMemo`/`useCallback`/`memo` is now an anti-pattern, not a best practice — it adds noise and the compiler already handles the common cases. Manual memo is the exception, and you justify it with a profile.

- Profile with the **React DevTools Profiler**: record an interaction, find the component that re-rendered, read "why did this render" and its render time.
- **The 16 ms rule:** one frame at 60 fps is ~16 ms. If a manual memo saves less than that, skip it — you can't see it and you're paying for the cache.
- The compiler **cannot** fix a new object/array/function reference created in render and passed as a prop — that's a fresh identity every time. Hoist it or derive it stably; that's the real fix, not wrapping the consumer in `memo`.

**RSC boundary discipline.** React Server Components ship zero JS for non-interactive trees; teams report 50–70% First-Load-JS cuts from full RSC adoption. The `'use client'` directive is a *boundary*: everything imported below it becomes client code. So push interactivity into the smallest leaf component and keep data fetching and layout on the server.

```tsx
// Bad: 'use client' at the top of the route — the whole tree ships to the browser
"use client";
export default function ProductPage({ data }) {
  /* layout, data display, and one tiny button all client-side */
}

// Good: server component holds data/layout; only the interactive leaf is a client component
export default function ProductPage({ data }) {       // server: zero JS
  return (
    <article>
      <ProductDetails data={data} />                  {/* server */}
      <AddToCartButton id={data.id} />                {/* the only 'use client' file */}
    </article>
  );
}
```

Use **streaming SSR with `<Suspense>`** to flush the static shell immediately and stream slow subtrees in parallel — multiple independent boundaries stream concurrently, cutting time-to-first-paint when one section is data-bound. The canonical App-Router data and component patterns are `../nextjs/SKILL.md` and `../react/SKILL.md`; bring the perf loop here, take the idioms there.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Optimizing on a hunch, no profile | you fix a phase nobody waits on | measure → attribute → fix the dominant phase |
| Chasing a lab score no real user hits | lab cold-cache LCP ≠ field p75 | optimize the field 75th-percentile number |
| Reporting the mean, not p75 | the average hides the tail users feel | always read/report the 75th percentile |
| Blanket `useMemo`/`useCallback` in React 19 | the compiler already memoizes; you add noise | memo only what the Profiler proves >16 ms |
| Lazy-loading the LCP / hero image | you defer the very element LCP measures | `priority` / `fetchpriority=high`, eager |
| `import _ from "lodash"` for one function | the whole library lands in First Load JS | named import or a few lines of your own |
| `'use client'` at the top of the tree | the entire subtree ships to the browser | push the boundary to the interactive leaf |
| Images/embeds with no reserved space | content reflows on load → CLS | explicit width/height or `aspect-ratio` |
| Micro-optimizing a non-bottleneck phase | effort moves a number off the critical path | fix only the phase the trace points at |
| "Done" without re-measuring | the fix may not have moved the metric | re-measure against the threshold, then stop |

## Stop rule

You are done when the **field 75th percentile clears the "good" threshold** (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1) and your bundle is under its budget — re-measure to confirm, then stop. Going from "good" to "slightly better good" is gold-plating: it costs maintenance and moves a number no user notices. Commit the threshold as a budget so it can't silently regress (`scripts/verify.sh` lints that budget; see `references/profiling-playbook.md` for the field-RUM wiring that keeps the p75 honest in production).
