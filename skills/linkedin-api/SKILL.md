---
name: linkedin-api
description: "Use when wiring an app to LinkedIn's organic Posts / Community Management API — 3-legged OAuth, publishing text, article or document posts to a member profile or company page, and pulling impressions, engagement and follower stats into a durable feedback record. NOT writing the post copy (that is `linkedin-content`), NOT planning cadence (that is `linkedin-strategy`), NOT DM sequences (that is `linkedin-outreach`)."
tags: [linkedin, social-api, oauth, community-management-api, analytics, connector]
recommends: [api-connector-builder, webhooks, analytics, knowledge-ops]
origin: risco
---

# LinkedIn API: publish and pull analytics over the wire

You own the **transport**. Auth headers, scopes, URNs, request shapes, rate-limit handling, token refresh, and the write that turns post performance into a durable feedback log. You do **not** decide what to post or why.

**Decision line:** if the question is *which HTTP call, which header, which scope, which URN, how do I store the numbers* → you. If it is about the *meaning* of the content → a sibling.

- Words, hooks, CTA for one post → `linkedin-content` (planned sibling).
- Cadence, pillars, audience plan → `linkedin-strategy` (planned sibling).
- The multi-slide PDF artifact → `linkedin-carousels` (planned sibling) builds it; you only upload the resulting document URN.
- DMs, connection requests, sequences → `linkedin-outreach` (planned sibling).
- Generic OAuth2 / webhook scaffolding with no LinkedIn specifics → `../api-connector-builder/SKILL.md`, `../webhooks/SKILL.md`.

## Prereqs: app + products + scopes

You configure this on the LinkedIn Developer portal once, before any code runs.

1. Create a developer app, associate it with a company page (required to request org products).
2. On the **Products** tab, request the product that grants the scopes you need:
   - **Share on LinkedIn** → grants `w_member_social` (default-grantable, post as the member).
   - **Community Management API** / **Marketing Developer Platform (MDP)** → grants the organization scopes and member-read. These require approval — the app sits in a review queue.
3. Add your exact **redirect URI** under Auth. It must match the one in the authorize URL byte-for-byte or the callback fails.

| Scope | Grants | Product needed | Page-role requirement |
|---|---|---|---|
| `w_member_social` | post/comment/like as the authed member | Share on LinkedIn | none |
| `r_member_social` | read the member's own posts | restricted — approved apps only | none |
| `w_organization_social` | post on behalf of an org | Community Management / MDP | ADMINISTRATOR, CONTENT_ADMIN, or DIRECT_SPONSORED_CONTENT_POSTER on the page |
| `r_organization_social` | read org posts/stats | Community Management / MDP | same role set |

> "unauthorized scope `w_organization_social`" at the consent screen does not mean a typo — it means the app's Community Management / MDP product is **not yet approved**. The fix is product approval, not code.

## Step 1 — 3-legged OAuth

Authorization-code flow. Two endpoints:

```text
GET  https://www.linkedin.com/oauth/v2/authorization   # send the user here
POST https://www.linkedin.com/oauth/v2/accessToken     # exchange code -> token
```

Send the user to authorize with `response_type=code`, your `client_id`, `redirect_uri`, a CSRF `state`, and space-separated `scope`. On callback, exchange the `code`:

```bash
curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
  -d grant_type=authorization_code \
  -d code="$AUTH_CODE" \
  -d redirect_uri="$LINKEDIN_REDIRECT_URI" \
  -d client_id="$LINKEDIN_CLIENT_ID" \
  -d client_secret="$LINKEDIN_CLIENT_SECRET"
```

Access tokens are short-lived (~60 days). Marketing / Community apps can be issued **refresh tokens** — store the refresh token and exchange it (`grant_type=refresh_token`) before expiry. Why: re-prompting consent on every expiry breaks unattended publishing and looks broken to the user.

```text
Bad:  client_secret = "WPL_AP1.abc..."            # committed in source
Good: client_secret = process.env.LINKEDIN_CLIENT_SECRET   # injected at runtime, file gitignored
```

Never write the token or secret into a tracked file. `scripts/verify.sh` greps for committed `client_secret=` and `AQED`-style token literals and fails the build if it finds one.

## Step 2 — resolve the author URN

Every post needs an `author`. Two shapes:

- Member: `urn:li:person:{id}` (the `sub` from the OpenID userinfo / token introspection).
- Organization: `urn:li:organization:{id}` (the numeric page id).

Before publishing as an org, confirm the authed member holds an eligible **page role** (ADMINISTRATOR / CONTENT_ADMIN / DIRECT_SPONSORED_CONTENT_POSTER). Why: with the scope granted but no role, the publish still returns **403 ACCESS_DENIED** — the scope authorizes the app, the role authorizes the person.

## Step 3 — publish

Current organic endpoint: `POST https://api.linkedin.com/rest/posts`. The legacy `/v2/ugcPosts` and `/v2/shares` are deprecated — migrate to the versioned `/rest/posts`. Pin the version **once**:

```bash
LINKEDIN_VERSION=202605   # latest; 202505 is sunset — pinning a sunset version breaks
```

Every versioned call carries **two** headers (omit either and you get 426/400):

```text
Linkedin-Version: 202605
X-Restli-Protocol-Version: 2.0.0
```

### Text post

```bash
curl -X POST https://api.linkedin.com/rest/posts \
  -H "Authorization: Bearer $LINKEDIN_TOKEN" \
  -H "Linkedin-Version: $LINKEDIN_VERSION" \
  -H "X-Restli-Protocol-Version: 2.0.0" \
  -H "Content-Type: application/json" \
  -d '{
    "author": "urn:li:organization:12345",
    "commentary": "Shipping notes for this week.",
    "visibility": "PUBLIC",
    "distribution": {
      "feedDistribution": "MAIN_FEED",
      "targetEntities": [],
      "thirdPartyDistributionChannels": []
    },
    "lifecycleState": "PUBLISHED",
    "isReshareDisabledByAuthor": false
  }'
```

Success is **201**, and the new post URN comes back in the **`x-restli-id` response header** (`urn:li:share:{id}` or `urn:li:ugcPost:{id}`) — not the body. Capture that header; you need the URN to pull analytics later.

### Article (link share) post

The Posts API does **NOT scrape the URL**. You set the preview fields yourself, and the `thumbnail` must be an **Image URN** you uploaded via the Images API first:

```jsonc
"content": {
  "article": {
    "source": "https://example.com/post",
    "title": "Our launch writeup",
    "description": "What we shipped and why",
    "thumbnail": "urn:li:image:C5..."
  }
}
```

### Document post

Upload the file via the **Documents API** to get `urn:li:document:{id}`, then reference it:

```jsonc
"content": { "media": { "id": "urn:li:document:C4..." } }
```

(Images → Images API → `urn:li:image:`; videos → Videos API → `urn:li:video:`.) Full reshare / multi-image / poll payloads and the retrieval finders live in `references/api-reference.md`.

## Step 4 — pull analytics

### Share statistics (post-level engagement)

```text
GET https://api.linkedin.com/rest/organizationalEntityShareStatistics
    ?q=organizationalEntity
    &organizationalEntity=urn%3Ali%3Aorganization%3A12345
```

**Organic only** (sponsored excluded), **rolling 12-month window**. Omit `timeIntervals` for lifetime; include it for a time-bound slice. Returns `impressionCount`, `uniqueImpressionsCount`, `clickCount`, `likeCount`, `commentCount`, `shareCount`, and `engagement` (engagement rate).

### Follower statistics

```text
GET https://api.linkedin.com/rest/organizationalEntityFollowerStatistics
```

Lifetime or time-bound follower counts, segmented by facet (geo, industry, seniority, function, staff size), covering **paid + organic** followers.

> URNs in any URL path or query **must be URL-encoded**: `urn:li:organization:12345` → `urn%3Ali%3Aorganization%3A12345`. An un-encoded colon silently breaks the route.

## Step 5 — ingest performance into the wiki

This is the deliverable that makes the skill durable: after pulling stats, write one file per post under `02-DOCS/wiki/linkedin/`. Later content decisions get grounded in what actually worked, not vibes.

Filename: the post id slug, e.g. `02-DOCS/wiki/linkedin/share-7012345678901234567.md`.

```markdown
---
type: linkedin-record
title: "Share 7012345678901234567 — OAuth pitfalls carousel"
description: Performance snapshot for one LinkedIn post, pulled from organizationalEntityShareStatistics.
tags: [linkedin, analytics, post-performance]
timestamp: "2026-06-02T10:00:00Z"
topic: linkedin
status: stable
post_urn: "urn:li:share:7012345678901234567"
author: "urn:li:organization:12345"
captured_at: "2026-06-02T10:00:00Z"
impressions: 4821
unique_impressions: 4102
clicks: 213
likes: 96
comments: 14
shares: 8
engagement: 0.0683
---

# Share 7012345678901234567 — OAuth pitfalls carousel

Carousel on OAuth pitfalls. Highest unique-impression post this month;
CTR ~4.4%. The "common 403 causes" hook outperformed the plain howto.
```

`type` is the only required OKF v0.1 field; `title`/`description`/`tags`/`timestamp` are the recommended OKF surface. The DOMAIN keys below them are mandatory and must stay byte-for-byte — `verify.sh` checks that `post_urn`, `captured_at`, `impressions`, and `engagement` are present in every file under that directory. `captured_at` is the API-capture instant (a domain value verify.sh parses); `timestamp` is the OKF last-edit field — keep both. Note these files share `02-DOCS/wiki/linkedin/` with `linkedin-strategy`; using `type: linkedin-record` keeps the two skills' wiki content consistent.

## Anti-patterns

| Anti-pattern | Why it breaks | Do instead |
|---|---|---|
| Pinning `Linkedin-Version: 202505` | That version is sunset; calls start failing on cutover | Pin `202605` in one constant; bump deliberately |
| Sending only `Linkedin-Version`, dropping `X-Restli-Protocol-Version` | Versioned endpoints reject the request (426/400) | Always send both headers together |
| Expecting the API to scrape an article URL | Posts API never fetches OG tags; you get a bare link | Set `source`/`title`/`description` + an uploaded Image URN |
| Reading the new post id from the response body | The URN is in `x-restli-id`, body has no id | Read the `x-restli-id` response header |
| Treating share statistics as total reach | They are **organic only**, 12-month window | Pull sponsored from the ads stats endpoints separately |
| Un-encoded URN in the URL path/query | The colons break routing → 400/404 | URL-encode every URN argument |
| Committing the token or `client_secret` | Leaked credential, instant revoke | Read from env; gitignore token files |
| Re-prompting consent on every token expiry | Breaks unattended jobs, looks broken | Store the refresh token, refresh before ~60-day expiry |
| Granted scope but member has no page role | Publish still returns 403 ACCESS_DENIED | Verify ADMINISTRATOR/CONTENT_ADMIN/DSC role first |
| Polling analytics in a tight loop | `429 TOO_MANY_REQUESTS` throttle | Back off and batch; schedule, don't hammer |

## Verify

Run `scripts/verify.sh [TARGET_DIR]` (default current dir). It is read-only and static — no network. It confirms each `02-DOCS/wiki/linkedin/*.md` carries the required front-matter keys, and fails on any committed token / client secret in the tree. A clean or not-yet-run target passes with a NOTE.

## References

`references/api-reference.md` — full curl bodies (text, article, document, reshare, multi-image, poll), post retrieval finders, the complete analytics query params and response schemas for both statistics endpoints, the HTTP error-code catalog (400/401/403/404/409/422/429/500/503), URL-encoding and query-tunneling rules, and the version-deprecation note.
