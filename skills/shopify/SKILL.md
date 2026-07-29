---
name: shopify
description: "Use when building or customizing a Shopify store across its three code surfaces — themes (Liquid, Online Store 2.0 sections, blocks and JSON templates), apps (Remix with the versioned GraphQL Admin API and its query-cost model), and checkout (UI extensions, Functions, Web Pixels), plus the CLI flow and checkout-extensibility migration. NOT WooCommerce or PHP stores (that is `wordpress`), NOT the React layer of a headless storefront (that is `nextjs`), NOT non-Shopify payment integrations (that is `stripe`)."
tags: [shopify, liquid, ecommerce, themes, checkout, graphql, storefront]
recommends: [nextjs, stripe, wordpress, api-design, seo-geo]
origin: risco
---

# Shopify themes, apps & checkout

The single authoritative skill for building and customizing a Shopify store. The mental model:
**a Shopify store is a hosted platform you extend at well-defined seams — never a server you
control.** You render on the storefront with Liquid, you mutate data through the versioned
GraphQL Admin API, and you customize checkout through sandboxed extensions. The platform owns
hosting, the database, PCI scope, and the checkout DOM; you own only the seams. Three surfaces,
three toolchains — name the surface before you write a line of code.

Pinned stack (verify against shopify.dev before pinning in a repo):

- **Shopify CLI 4.x** — auto-upgrades via the package manager it was installed with; skips CI,
  project-local installs, and major bumps. `shopify app config push` is removed; use `shopify app deploy`.
- **GraphQL Admin API `2026-04`** — latest stable; supported window 2026-04 / 2026-01 / 2025-10 /
  2025-07†. Each version is supported ~12 months. Pin `apiVersion` and bump quarterly.
  † `2025-07` is at the edge of its window — accessible only until 2026-07-16; treat it as
  sunsetting and do not pin it in new work. Re-check the live list at shopify.dev/docs/api/usage/versioning.
- **Remix app template** (`@shopify/shopify-app-remix`, App Bridge, Polaris React). GraphQL > REST —
  REST Admin API is legacy; Shopify steers all new app work to GraphQL.
- **Dawn** — Shopify's source-available reference theme; OS 2.0 architecture is the baseline.

## Pick your surface first

Most Shopify mistakes are surface confusion — answering with a headless React build when the ask
was a Liquid section, or editing `checkout.liquid` when the seam is now an extension. Branch here:

| Surface | You're working on… | Tool & entry | Reference |
|---|---|---|---|
| **Theme** | `.liquid` files, `{% schema %}`, JSON templates, storefront rendering, merchant-editable content | `shopify theme dev` on a Dawn-based theme | `references/liquid-themes.md` |
| **App** | embedded admin UI, reading/writing store data, webhooks, automation | `shopify app dev` on the Remix template + Admin GraphQL | `references/apps-graphql.md` |
| **Checkout** | checkout/thank-you/order-status UI or logic, discounts, shipping, tracking | Checkout UI extensions / Functions / Web Pixels | `references/checkout-extensibility.md` |

If the answer is "the React rendering layer of a headless storefront", that is `../nextjs/SKILL.md`,
not this skill — Shopify is only the data seam (Storefront API) there.

## Theme surface — Online Store 2.0 architecture

OS 2.0 (GA 2021, sometimes marketed "3.0") is the architecture: JSON templates + sections-
everywhere + theme blocks + `@app` blocks + dynamic sources. The file map:

```text
layout/theme.liquid            # the HTML shell (one per theme)
templates/product.json         # JSON template: which sections render, in what order
sections/main-product.liquid   # a section: markup + {% schema %} of merchant settings
sections/*.liquid              # section groups (header/footer) live here too
blocks/*.liquid                # theme blocks (reusable, nestable) — OS 2.0
snippets/*.liquid              # partials rendered via {% render %}
config/settings_schema.json    # global theme settings
```

**Rule: every section carries a `{% schema %}` with `presets` so merchants edit content in the
theme editor without a deploy.** The why: content belongs in `section.settings` and metafields, not
in code — if a merchant has to ask you to change a headline, the section is built wrong.

```liquid
<!-- Bad: copy hardcoded in Liquid; merchant can't touch it -->
<h2>Summer Sale — 20% off everything</h2>

<!-- Good: editable in the theme editor, with a preset so it appears in "Add section" -->
<h2>{{ section.settings.heading | escape }}</h2>
{% schema %}
{
  "name": "Promo banner",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Summer Sale" }
  ],
  "blocks": [{ "type": "@app" }],
  "presets": [{ "name": "Promo banner" }]
}
{% endschema %}
```

The `{ "type": "@app" }` block lets merchant-installed apps drop content into your section. The
Shopify Theme Store **requires** the main product and featured-product sections to support `@app`
blocks. See `references/liquid-themes.md` for setting types, section groups, and dynamic sources.

## Liquid rules

- **`{% render %}`, never `{% include %}`.** `render` is scoped (the snippet only sees what you
  pass) and cacheable; `include` leaks the parent scope and is deprecated.

  ```liquid
  {% comment %} Bad {% endcomment %}
  {% include 'price' %}
  {% comment %} Good — explicit, scoped, cacheable {% endcomment %}
  {% render 'price', product: product, variant: variant %}
  ```

- **Bound every collection loop with `limit:`** and never nest unbounded loops — storefront render
  cost is real and slow pages cost conversions. `{% for p in collection.products limit: 8 %}`.
- **Pipe all dynamic output.** `| money` for prices (raw values render cents/locale wrong),
  `| escape` for any user/merchant string (XSS), `| json` when emitting data into a `<script>`.
- **Push branchy logic into metafields/metaobjects, not conditional chains.** A `case`/`if` ladder
  over product types is data pretending to be code — bind a metafield and let Liquid do a lookup.

## CLI workflow

Theme work (hot-reloads against a dev theme; never edits live unprompted):

```bash
shopify theme dev                      # local preview + hot reload
shopify theme pull                     # sync live/named theme down
shopify theme push --only templates/*  # push a subset; --ignore excludes paths
shopify theme check                    # Theme Check linter — wire into CI
```

Multi-environment lives in `shopify.theme.toml`; `--environment` is repeatable
(`shopify theme push --environment staging --environment prod`).

App work:

```bash
shopify app dev      # tunnel + env + reload; provisions admin.graphql()
shopify app deploy   # release app + extensions  (NOT `app config push` — removed in 4.x)
```

CLI 4.x auto-upgrades via your package manager but skips CI and project-local installs — pin the
version in CI so a silent bump never changes a release.

## App surface — Remix + GraphQL Admin API

Apps are the Remix template. The shape:

```text
app/shopify.server.js     # shopifyApp({ apiVersion, sessionStorage, webhooks, ... })
app/routes/app.*.jsx      # embedded admin pages (App Bridge + Polaris)
shopify.app.toml          # app config, scopes, webhook subscriptions
extensions/*              # app extensions (theme app ext, UI ext, Functions, Flow)
```

- **Pin `apiVersion` in `shopify.server` and bump it quarterly** — an unpinned client silently
  follows Shopify's default and can break on a version rollover.
- **Use the GraphQL Admin API, not REST.** REST is legacy; new fields ship to GraphQL only.

  ```js
  // Bad — legacy REST Admin endpoint
  await fetch(`https://${shop}/admin/api/2026-04/orders.json`);

  // Good — authenticated GraphQL through the template
  const { admin } = await authenticate.admin(request);
  const res = await admin.graphql(
    `#graphql
     query Orders { orders(first: 10) { nodes { id name } } }`
  );
  ```

- **Verify webhook HMAC** before trusting any payload — `authenticate.webhook(request)` in the
  template does this; never parse a raw webhook body without it.

See `references/apps-graphql.md` for OAuth/session storage, mutations, App Bridge, and extensions.

## GraphQL query-cost model

Admin GraphQL meters by **calculated query cost (points), not request count.** Every response
carries `extensions.cost`:

```json
{ "extensions": { "cost": {
  "requestedQueryCost": 92, "actualQueryCost": 30,
  "throttleStatus": { "maximumAvailable": 2000, "currentlyAvailable": 1970, "restoreRate": 100 }
}}}
```

- **Over-budget returns HTTP 200 with a `MAX_COST_EXCEEDED` error** — you must handle it in code; it
  is not an HTTP-level failure your client will throw on.
- **Read `throttleStatus` and back off on `restoreRate`** (points restored per second) rather than
  blindly retrying.
- **Large reads use bulk operations, not paginated loops.** A 10k-product export through `first:`
  pagination will throttle; `bulkOperationRunQuery` runs async and returns a JSONL file.

## Checkout surface — the post-`checkout.liquid` model

`checkout.liquid` and additional scripts are **deprecated and being removed**. Dated facts:

- **2024-08-13** — Information/Shipping/Payment steps lost `checkout.liquid` support.
- **2025-08-28** — Plus self-migrate deadline for Thank-you & Order-status customizations (additional
  scripts, script tags, `checkout.liquid`). This was the *deadline to act*, not the auto-upgrade date.
- **2026-01** — **automatic upgrades** of Thank-you & Order-status pages begin (30-day email notice);
  any remaining additional-scripts / script-tag / `checkout.liquid` customizations stop running.
- **2026-04-15** — legacy Shopify Scripts can no longer be edited or published (existing scripts still run).
- **2026-06-30** — legacy Shopify Scripts (Script Editor discount/shipping/payment scripts) stop executing entirely.

Migrate by surface — match the old mechanism to its new seam:

| Old (deprecated) | New seam | Notes |
|---|---|---|
| `checkout.liquid` UI tweaks | **Checkout UI extensions** | sandboxed React/JS targets, not DOM access |
| Script Editor / additional-script discounts, shipping, payment logic | **Functions** (Rust or JS → Wasm) | deterministic, run server-side |
| `<script>` tracking / analytics in checkout | **Web Pixels** + server-side events | sandboxed; no arbitrary DOM scripts |
| custom checkout colors/fonts/CSS | **Checkout Branding API** | GraphQL, not CSS injection |

Several checkout surfaces (full checkout UI customization, some Functions) are **Shopify Plus-only**.
The full migration map, extension targets, and Functions structure are in
`references/checkout-extensibility.md`.

## App extensions catalog

- **Theme app extension** — your app injects an `@app` block / blocks into themes (no theme edit).
- **Admin UI extension** — surfaces inside admin pages (product, order) without leaving Shopify.
- **Customer-account UI extension** — extends the new customer accounts.
- **Functions** — discount / shipping / payment / cart logic as Wasm; the `checkout.liquid` logic seam.
- **Flow** — triggers/actions for Shopify Flow automation, exposed by your app.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| `{% include %}` in new code | deprecated, leaks parent scope, not cacheable | `{% render %}` with explicit args |
| Raw `{{ price }}` / `{{ user_input }}` | wrong locale/cents; XSS | `\| money`, `\| escape`, `\| json` |
| Editing `checkout.liquid` / additional scripts | deprecated; auto-upgraded away starting 2026-01 | UI extensions / Functions / Web Pixels |
| REST Admin calls in a new app | legacy; new fields are GraphQL-only | `admin.graphql()` |
| Unpinned or stale `apiVersion` | breaks on Shopify's version rollover | pin a supported version, bump quarterly |
| Paginated `first:` loop for big reads | throttles on query cost | `bulkOperationRunQuery` |
| Ignoring `extensions.cost.throttleStatus` | silent `MAX_COST_EXCEEDED` at HTTP 200 | read cost, back off on `restoreRate` |
| Hardcoded copy in Liquid | merchant can't edit without a deploy | `section.settings` / metafields |
| Section with no `presets` | won't appear in "Add section" in the editor | add a `presets` entry to `{% schema %}` |
| Secrets committed in `shopify.app.toml` | leaks API credentials | env vars; keep secrets out of TOML |
| No Theme Check in CI | regressions ship to the storefront | `shopify theme check` in the pipeline |
| Answering with a headless React build | wrong surface for a Liquid/theme ask | confirm the surface; route React to `../nextjs/SKILL.md` |

Run `scripts/verify.sh <theme-or-app-dir>` for an advisory scan of these foot-guns.
