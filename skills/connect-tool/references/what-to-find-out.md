# What to find out, where to look, how to write it down

Research replaces any catalogue. A list of vendors is out of date within months: prices, plans,
endpoints and MCP servers change, and it only covers what someone already entered. The fields below
are what such a catalogue held. Fill them for **this** tool, now, from primary sources, and write
them into `01-TOOLS/<TOOL>/README.md`. That file is the catalogue entry for this project.

## The fields

| Field | The question | Where to look first |
|---|---|---|
| **API** | Is there a documented API? REST, GraphQL, SOAP web service? Which plan includes it? | Vendor developer portal; "API", "Developers", "Integrations" in the app's settings |
| **MCP** | Is there an official MCP server? A maintained community one? Read-only mode? | `registry.modelcontextprotocol.io`; the vendor's docs; the vendor's GitHub |
| **Other routes** | Cloud edition with an API, vendor or distributor integration module, unified API (e.g. Chift), built-in Zapier/Make/n8n connector | Vendor site, distributor site, the unified API's coverage list |
| **Exports** | What can it export, in which format, and can it be scheduled or dropped to a folder or FTP? | The user manual; the program's list screens ("Export to Excel") |
| **Imports** | What official import formats does it accept, for which objects (entries, invoices, customers, items)? | The user manual; vendor support articles |
| **Database** | Which engine does an installed program use? Is reading it allowed by the support terms? | Install guide; the data folder's file extensions; the distributor |
| **Scoped permissions** | Can the credential be limited (read scopes, modules, sites, folders)? What **cannot** be limited? | Token or app settings; vendor docs on scopes or roles |
| **Who to ask, and what** | Who activates it (account admin, distributor, IT person, accounting firm) and the exact request | The vendor's "how to activate" page; the user's answers |
| **Free trial** | Free tier, trial, sandbox, developer account, test company. Does the trial include the API? | Pricing page; developer portal |
| **Cost** | Minimum cost with API access; module or connector fees | Pricing page; ask the distributor in writing |
| **Migration** | Is the product near end-of-life? Does a successor exist? | Vendor roadmap, end-of-support notices |
| **Spain** | Veri\*factu declaration for the exact version; B2B e-invoicing readiness | The vendor's responsible declaration; see [Spain](spain.md) |
| **Sources and confidence** | URL and date for every claim; "verified", "secondary source" or "not verified" | — |

Leave a field as **unknown** rather than guessing. "Not found after searching X, Y and Z on
<date>" is a result; an invented endpoint is a week lost.

## Where to look, in order

1. The vendor's own domain: developer docs, help centre, pricing, legal pages.
2. Official registries: the MCP registry; app marketplaces of the platform (Google Workspace
   Marketplace, Microsoft AppSource, Shopify App Store…).
3. The distributor or partner's site, for modules the vendor does not list.
4. Secondary sources (forums, blog posts, partner presentations) only to find leads. Mark anything
   that comes only from them as **not verified**.

## How to write it down

In `01-TOOLS/<TOOL>/README.md`:

```markdown
## Research — checked 2026-11-01

| Field | Finding | Source (date) | Confidence |
|---|---|---|---|
| API | REST, invoices and contacts read; needs the Pro plan | https://… (2026-11-01) | verified |
| MCP | None official; community server unmaintained since 2025 | https://… (2026-11-01) | verified |
| Exports | Scheduled CSV of invoices to a folder | user manual, ch. 12 (2026-11-01) | verified |
| Free trial | 30 days, API included | https://… (2026-11-01) | not verified: page says "most features" |
```

## The 60-day rule

Before relying on an existing `README.md`, look at its dates. **More than 60 days old: check the
sources again** before quoting a price, a plan or an endpoint, and update the dates. This is what
keeps the research current without anyone maintaining a list.
