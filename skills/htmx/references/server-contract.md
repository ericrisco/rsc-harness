# htmx server contract

The full request/response header tables and the fragment-vs-page wiring per framework. The
contract is identical across stacks: **branch on `HX-Request`, return a partial or the page that
embeds the same partial, steer the client with `HX-*` response headers.**

## Request headers htmx sends

| Header | Meaning |
|---|---|
| `HX-Request` | `true` on every htmx-issued request — the branch point for partial vs page |
| `HX-Boosted` | `true` if the request came from an `hx-boost`ed element |
| `HX-Target` | `id` of the target element (if it has one) |
| `HX-Trigger` | `id` of the triggering element |
| `HX-Trigger-Name` | `name` of the triggering element |
| `HX-Current-URL` | the browser's current URL |
| `HX-Prompt` | the user's response to an `hx-prompt` |

## Response headers the server can set

| Header | Effect |
|---|---|
| `HX-Trigger` | fire client event(s) after the swap; JSON `{"event": detail}` to pass detail |
| `HX-Trigger-After-Settle` | fire after the settle step |
| `HX-Trigger-After-Swap` | fire after the swap step |
| `HX-Retarget` | CSS selector overriding `hx-target` |
| `HX-Reswap` | a swap value overriding `hx-swap` |
| `HX-Redirect` | full-page client redirect to a URL |
| `HX-Location` | client-side navigation via an htmx request (no full reload) |
| `HX-Push-Url` | push a URL into browser history (`false` to disable) |
| `HX-Replace-Url` | replace the current history entry |
| `HX-Refresh` | `true` triggers a full page reload |

Guard `HX-Redirect`/`HX-Location` against attacker-controlled URLs — a `javascript:` value is an
injection.

## FastAPI + Jinja2

```python
@app.get("/contacts")
def contacts(request: Request, q: str = ""):
    rows = search_contacts(q)
    name = "contacts/_rows.html" if request.headers.get("HX-Request") else "contacts/index.html"
    return templates.TemplateResponse(request, name, {"rows": rows, "q": q})
```

Fire a client event from the server:

```python
from fastapi.responses import HTMLResponse
resp = HTMLResponse("<span id='cart-count'>3 items</span>")
resp.headers["HX-Trigger"] = '{"cartUpdated": {"count": 3}}'
return resp
```

## Django (django-htmx)

Add the `django_htmx.middleware.HtmxMiddleware`, then `request.htmx` is truthy on htmx requests:

```python
def contacts(request):
    rows = search_contacts(request.GET.get("q", ""))
    template = "contacts/_rows.html" if request.htmx else "contacts/index.html"
    return render(request, template, {"rows": rows})
```

CSRF: Django requires the token on unsafe methods. Send it from htmx with a global header so you
do not add it to every element:

```html
<body hx-headers='{"X-CSRFToken": "{{ csrf_token }}"}'>
```

## Express

```js
app.get("/contacts", (req, res) => {
  const rows = searchContacts(req.query.q || "");
  const view = req.get("HX-Request") ? "contacts/_rows" : "contacts/index";
  res.render(view, { rows });
});
```

CSRF (a double-submit cookie or a maintained CSRF middleware; `csurf` is deprecated): expose the token to htmx via `hx-headers`, the
same pattern as Django — htmx never adds CSRF tokens itself.

## Fragment-vs-page rule (all stacks)

The full page **is** the layout that `include`s the fragment. Keep exactly one fragment template;
the page embeds it, the htmx branch returns it directly. Two divergent copies is the most common
htmx bug — fix it once and it stays fixed.
