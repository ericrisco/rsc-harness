# Zapier's programmatic limits, and the Partner / Workflow APIs

The single most important fact about automating Zapier, stated without hedging.

## There is no public API to manage your own Zaps

A normal Zapier account **cannot** create, read, update, or delete its own Zaps through any public REST API. Not list them, not toggle them on/off, not read their run history programmatically. This is a long-standing, deliberate gap, confirmed repeatedly in Zapier's own community and docs. Symptoms of someone hitting the wall:

- "How do I get a list of all my Zaps via the API?" → you can't (not on a normal account).
- "Create a Zap with a POST request." → not available to normal accounts.
- "Give my app a Zapier API key so it can build workflows for my users." → that is a different product (Partner API) with hard prerequisites.

When a request assumes this API exists, **do not improvise a workaround.** Name the limit and route:

- Need to *run an action* in an app → **Zapier MCP** (the main skill).
- Need to *create/manage workflows by code* → **n8n** or **make**. Both expose real workflow CRUD APIs. This is the honest answer, even though it means leaving Zapier.
- Need to *design* the flow and build it by hand → **automation-flows** → the visual editor at `zapier.com`.

## What the two real APIs actually are

### Partner API — `https://api.zapier.com/v1/...`

For **SaaS vendors embedding Zapier inside their own product**. Auth is OAuth with a `client_id` you get by creating a Zapier developer app (and typically passing a review — allow ~a week). It gives you, roughly:

- **Zap templates** (`zap-templates`) — publish and surface pre-built Zap templates that use *your* integration.
- **List a user's Zaps that include YOUR app** — not all their Zaps; only the ones touching your integration.
- **An embeddable editor** — an iframe / Zapier-hosted UI so your users build Zaps without leaving your product ("Powered by Zapier").

It is built so a product like a CRM can offer "Connect with Zapier" in-app. It is **not** a general "manage arbitrary Zaps in my account" API, and it is not usable without being an integration partner.

### Workflow API

Can **create a Zap** programmatically — but only for **developers who have a published public integration** on the Zapier platform (i.e., your app is live in Zapier's App Directory). It exists to let integration builders bootstrap Zaps for their integration, not to let an account owner script their own automations. If the user does not own a published public integration, this door is closed.

## Decision table

| The user is… | Can they use it? | Path |
| --- | --- | --- |
| A normal account owner wanting to CRUD their Zaps by API | **No** | Route to n8n / make (CRUD APIs) or the visual builder (automation-flows). |
| A SaaS vendor embedding "Connect to Zapier" in their product | Yes | Partner API — dev app + OAuth `client_id` + review. |
| A developer with a published public integration on Zapier | Partly | Workflow API — can create Zaps tied to that integration. |
| Anyone wanting an agent to *invoke actions* in apps | Yes | Zapier MCP (main skill). |

## The one-line honest answer to give

"Zapier has no public API for a normal account to create or manage its own Zaps. For running actions, use Zapier MCP. For programmatic control over the workflows themselves, use n8n or Make — they have full CRUD APIs. The Zapier Partner/Workflow APIs only apply if you're a SaaS vendor embedding Zapier or a published-integration developer."

Verify current scope at `docs.zapier.com` and `zapier.com/blog/zapier-partner-api-overview` before quoting specifics — the endpoints and gating evolve.
