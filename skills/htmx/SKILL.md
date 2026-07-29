---
name: htmx
description: "Use when adding interactivity to a server-rendered app (FastAPI/Jinja, Django, Rails, Laravel, Go templates, Express) without adopting a JS framework — hx-get/post/put/delete with hx-target, hx-swap and hx-trigger, returning HTML fragments instead of JSON, out-of-band swaps, active search, infinite scroll, inline edit and polling. NOT a client-state SPA with routing and a store (that is `react` or `nextjs`)."
tags: [htmx, hypermedia, frontend, server-rendered, html]
recommends: [fastapi, django, secure-coding, accessibility]
origin: risco
---

# htmx: hypermedia-driven UIs

The server owns all application state and renders HTML. The client is dumb: it swaps
server-rendered fragments into the DOM. There is no JSON API for the UI, no client store,
no virtual DOM, no client router. If you find yourself returning JSON and rendering it with
JavaScript, you have stopped doing htmx and started building an SPA — use a different tool.

**The unit of work is one request, described by four attributes on one element:**

1. a verb — `hx-get` / `hx-post` / `hx-put` / `hx-patch` / `hx-delete` (the URL)
2. `hx-target` — which DOM node receives the response (CSS selector or `this`)
3. `hx-swap` — how the response is placed (default `innerHTML`)
4. `hx-trigger` — on what event (default: natural — `click` for buttons, `submit` for forms,
   `change` for inputs)

**Versions (verify before pinning).** htmx 2.0.x is current stable (2.0.10 latest 2.x line);
v1 (1.9.x) is legacy, kept only for IE/old-browser support. htmx v4 is in beta targeting
Summer 2026 and changes some defaults (default swap behavior, config) — do **not** write to v4
yet. Pin to 2.x:

```html
<script src="https://unpkg.com/htmx.org@2.0.10" crossorigin="anonymous"></script>
```

## When to use

- Adding interactivity to a server-rendered app without a JS framework.
- Wiring a verb + `hx-target` + `hx-swap` + `hx-trigger` to update a page region.
- Returning **partials/fragments** — full page on direct navigation, fragment on htmx request
  (branch on the `HX-Request` header).
- Out-of-band updates (`hx-swap-oob`) when one response must refresh several regions.
- Trigger-driven UX: active search, infinite scroll, inline edit, click-to-load, polling,
  `revealed`, `intersect`, debounced input.
- Server-driven control flow via response headers (`HX-Trigger`, `HX-Redirect`, …).

## When NOT to use — route elsewhere

- A client-state-heavy SPA (offline, optimistic UI everywhere, complex client routing) →
  `react`, `vue-nuxt`, `svelte`, `solid-js`, `angular`, or ../nextjs/SKILL.md. htmx is the
  anti-SPA; do not fight it.
- How to structure the server framework itself (routers, ORM, controllers) → ../fastapi/SKILL.md,
  `django`, `rails`, `laravel`. This skill owns the *htmx contract* (which fragment, which
  header, which swap), not framework internals. Cross-link, do not duplicate.
- Generic XSS/CSP/auth theory → ../secure-coding/SKILL.md. Keep only the htmx-specific notes here.
- Focus management and ARIA live regions after a swap → `accessibility`.
- Browser E2E of swaps → `testing-web` / `e2e-testing`.
- Purely-client state (Alpine, vanilla sprinkles) → out of scope; htmx is for server round-trips.

## Decision rules

1. **Return HTML, never JSON, for the UI.** The response *is* the new DOM. JSON forces a client
   renderer, which is the SPA you are trying to avoid.
2. **Branch on `HX-Request`: fragment for htmx, full page otherwise.** A bookmarked URL or hard
   refresh must still render a whole page; the htmx call gets just the partial.
3. **The full page is the layout wrapping the *same* partial.** One template for the fragment,
   reused inside the page layout — never two copies that drift.
4. **Set `hx-target` and `hx-swap` explicitly when the default is wrong.** Default target is the
   element itself; default swap is `innerHTML`. Be explicit the moment you need otherwise.
5. **Use out-of-band swaps for multi-region updates, not multiple requests.** One action that
   changes a list *and* a counter is one response with one OOB element.
6. **Drive UX with `hx-trigger`, not JavaScript.** Debounce, polling, reveal, intersect are all
   trigger modifiers — reaching for `addEventListener` usually means you missed a modifier.
7. **Steer the client from the server with response headers.** Redirect, retarget, reswap, and
   fire events via `HX-*` response headers instead of branching logic in the browser.
8. **Escape everything; add CSRF yourself.** Your template engine auto-escapes — keep it on.
   htmx does not add CSRF tokens; you propagate them via `hx-headers` or a hidden field.

## Request anatomy: Bad to Good

```html
<!-- Bad: JSON endpoint + hand-written DOM patching = a tiny SPA -->
<button id="like">Like</button>
<script>
  document.getElementById('like').addEventListener('click', async () => {
    const r = await fetch('/posts/42/like', { method: 'POST' });
    const data = await r.json();                       // JSON contract
    document.getElementById('count').textContent = data.count;  // manual render
  });
</script>
```

```html
<!-- Good: the server returns the new HTML; the element declares the swap -->
<button hx-post="/posts/42/like"
        hx-target="#likes"
        hx-swap="outerHTML">Like</button>
<span id="likes">42 likes</span>
<!-- POST /posts/42/like responds with: <span id="likes">43 likes</span> -->
```

The Good version has no JS, no JSON, no client state. The server computed the count and rendered
the truth; the client placed it.

## Fragment rendering: branch on HX-Request

Framework-agnostic rule: **if `HX-Request: true`, render the partial; otherwise render the page
that embeds that same partial.** Concrete FastAPI + Jinja2:

```python
from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates

app = FastAPI()
templates = Jinja2Templates(directory="templates")

@app.get("/contacts")
def contacts(request: Request, q: str = ""):
    rows = search_contacts(q)
    # htmx asked for just the table body; a browser nav gets the whole page.
    template = "contacts/_rows.html" if request.headers.get("HX-Request") else "contacts/index.html"
    return templates.TemplateResponse(template, {"request": request, "rows": rows, "q": q})
```

```jinja
{# templates/contacts/index.html — the page wraps the SAME partial #}
{% extends "base.html" %}
{% block content %}
  <input type="search" name="q" value="{{ q }}"
         hx-get="/contacts" hx-target="#rows" hx-swap="innerHTML"
         hx-trigger="keyup changed delay:500ms">
  <table><tbody id="rows">{% include "contacts/_rows.html" %}</tbody></table>
{% endblock %}
```

```jinja
{# templates/contacts/_rows.html — auto-escaped; reused by page AND fragment #}
{% for c in rows %}<tr><td>{{ c.name }}</td><td>{{ c.email }}</td></tr>{% endfor %}
```

Full per-framework wiring (Django `django-htmx` middleware, Express, CSRF per stack) is in
[references/server-contract.md](references/server-contract.md).

## Swap and target reference

| `hx-swap` | Where the response goes |
|---|---|
| `innerHTML` | inside the target, replacing contents (default) |
| `outerHTML` | replaces the target element itself |
| `beforebegin` / `afterbegin` | before the target / as its first child |
| `beforeend` / `afterend` | as its last child / after the target |
| `delete` | deletes the target (response ignored) |
| `none` | does not swap (use with OOB or `HX-Trigger`) |

Swap modifiers: `transition:true`, `swap:<time>` (delay before swap), `settle:<time>`,
`scroll:top|bottom`, `show:top|bottom`, `focus-scroll:false`.

`hx-target` accepts a CSS selector, `this`, or an extended selector: `closest <sel>`,
`find <sel>`, `next <sel>`, `previous <sel>`. Prefer a **stable `id`** over a fragile structural
selector — a deep `div > div:nth-child(3)` breaks the first time markup shifts.

## Out-of-band swaps

When one action must refresh more than the target, mark extra elements in the response with
`hx-swap-oob`. They are swapped into the matching live element **by `id`**, bypassing the target.

```html
<!-- Response to POST /cart/add: swap the row in normally... -->
<tr id="row-42">2 × Widget</tr>
<!-- ...and update the cart badge out of band (default OOB swap is outerHTML) -->
<span id="cart-count" hx-swap-oob="true">3 items</span>
```

`hx-swap-oob="true"` defaults to `outerHTML`; you can specify a strategy
(`hx-swap-oob="beforeend:#log"`). Use OOB instead of firing two requests for two regions.

## Server-driven control flow (response headers)

The server can steer htmx without any client code:

| Response header | Effect |
|---|---|
| `HX-Trigger` | fire client event(s); JSON value `{"event": detail}` passes detail |
| `HX-Retarget` | override `hx-target` with a CSS selector |
| `HX-Reswap` | override `hx-swap` for this response |
| `HX-Redirect` | full-page client redirect to the given URL |
| `HX-Location` | client-side navigation *with* an htmx request (no full reload) |
| `HX-Push-Url` | push a URL into history |
| `HX-Refresh` | `true` forces a full page reload |

Request headers htmx sends (read these server-side): `HX-Request`, `HX-Target`, `HX-Trigger`,
`HX-Current-URL`, `HX-Boosted`. Full tables in
[references/server-contract.md](references/server-contract.md).

`hx-boost` is the cheapest "SPA feel": it upgrades normal `<a>`/`<form>` to AJAX that swaps
`<body>` with `pushState` history — no SPA, no JSON.

## Security (htmx-specific only)

htmx makes HTML more expressive, so **injected HTML is an XSS surface**. The htmx-specific rules
(generic theory lives in ../secure-coding/SKILL.md):

- **Keep your template engine's auto-escaping on.** Never `| safe` / `|safe` user-controlled
  content. Manually rendering raw user HTML re-introduces XSS that escaping had closed.
- **When you must inject third-party HTML, scrub it with a whitelist** — strip `hx-*`/`data-hx-*`
  attributes and inline scripts. An injected `hx-get` would issue requests you never intended.
- **`hx-disable` halts htmx processing for a subtree** as defense-in-depth — but it is bypassable
  by closing the tag, so it is *not* a primary control. Sanitize at the source.
- **`htmx.config.selfRequestsOnly` defaults to `true` in 2.x** — keep it. It blocks htmx requests
  to other origins.
- **CSRF is your job.** htmx sends same-origin requests but adds no CSRF token. Propagate it:
  `<body hx-headers='{"X-CSRF-Token": "…"}'>` or a hidden form field.
- **Guard `HX-Redirect` / `HX-Location`** — never build them from attacker-controlled values;
  a `javascript:` URL there is an injection.

## UX recipes

Worked, copy-ready recipes — server fragment + client markup for each — live in
[references/patterns.md](references/patterns.md):

- **Active search** — debounced `keyup changed delay:500ms` filtering a results table.
- **Infinite scroll / click-to-load** — `hx-trigger="revealed"` or a "load more" button.
- **Inline edit (click-to-edit)** — swap a row to a form and back.
- **Delete row + OOB count** — remove a row and update a counter in one response.
- **Modal dialog** — load a dialog fragment on demand.
- **Progress bar** — `every 600ms` polling closed by an `HX-Trigger` event.
- **Tabs / accordion** — swap the active panel.

## Common triggers

| `hx-trigger` value | Use |
|---|---|
| `keyup changed delay:500ms` | active search (debounced, only on real change) |
| `every 2s` | polling a progress/status region |
| `revealed` | infinite scroll — load when the sentinel scrolls into view |
| `intersect once` | lazy-load a region once it enters the viewport |
| `load delay:1s` | deferred load after the page paints |
| `click[ctrlKey]` | event filter — only ctrl-click |
| `submit` / `change` | natural defaults for forms / inputs |
| `customEvent from:body` | react to an `HX-Trigger`-fired event from elsewhere |

Modifiers worth knowing: `throttle:<time>`, `queue:first|last|all|none`, `from:<sel>`, `once`,
`changed`, `delay:<time>`.

## Anti-patterns

| Anti-pattern | Why it is wrong | Do instead |
|---|---|---|
| Endpoint returns JSON, JS renders it | that is an SPA; you lose htmx's whole point | return the HTML fragment; the server renders |
| No `HX-Request` branch | the fragment leaks the full layout (nested `<html>`) on htmx calls, or a bookmark renders a bare partial | branch: partial vs page wrapping the same partial |
| Two copies of the fragment (page + ajax) | they drift; bug fixed in one, not the other | one partial template, `{% include %}`d by the page |
| Polling `every 1s` for a one-off event | wasteful traffic; hammers the server | poll only while pending, end it with `HX-Trigger`/`hx-swap-oob`; or use SSE |
| `hx-target="div > div:nth-child(3)"` | structural selectors shatter when markup shifts | target a stable `id` |
| `{{ user_html | safe }}` | unescaped user content → XSS | keep auto-escaping; whitelist-scrub if injecting 3rd-party HTML |
| Rebuilding client state in `hx-on`/JS | re-creates the SPA state you came here to avoid | let the server hold state; re-render from it |
| Multiple requests to update related regions | extra round-trips, races | one response + `hx-swap-oob` |

## See also

- ../fastapi/SKILL.md — FastAPI routes/templates that serve these fragments.
- ../secure-coding/SKILL.md — the general XSS/CSP/auth theory this skill defers to.
- ../nextjs/SKILL.md — when the requirement really is a React/SPA app, not hypermedia.
- `django`, `rails`, `laravel` — other server frameworks (the htmx contract is identical).
- `accessibility` — focus and ARIA after a DOM swap.
