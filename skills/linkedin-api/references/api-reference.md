# LinkedIn API reference

Offloaded depth for `linkedin-api`. All paths assume the two versioned headers from `SKILL.md`:

```text
Authorization: Bearer $LINKEDIN_TOKEN
Linkedin-Version: 202605
X-Restli-Protocol-Version: 2.0.0
```

`202605` (`li-lms-2026-05`) is a supported version, sunset 2027-05-15; newer monthly versions exist — check the [API migration status](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/migrations#api-migration-status) table before pinning. `202505` is sunset — do not pin it.

## Publish payloads — `POST /rest/posts`

### Reshare (commentary on an existing post)

```jsonc
{
  "author": "urn:li:organization:12345",
  "commentary": "Worth a read.",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "reshareContext": { "parent": "urn:li:share:7012345678901234567" },
  "lifecycleState": "PUBLISHED",
  "isReshareDisabledByAuthor": false
}
```

### Multi-image post

Upload each image via the Images API first to get `urn:li:image:` ids, then:

```jsonc
"content": {
  "multiImage": {
    "images": [
      { "id": "urn:li:image:C5...", "altText": "slide 1" },
      { "id": "urn:li:image:C5...", "altText": "slide 2" }
    ]
  }
}
```

### Single image post

```jsonc
"content": { "media": { "id": "urn:li:image:C5...", "altText": "chart" } }
```

### Document post (carousel PDF)

Upload via the Documents API → `urn:li:document:{id}`, then:

```jsonc
"content": { "media": { "id": "urn:li:document:C4...", "title": "OAuth pitfalls" } }
```

### Poll

```jsonc
"content": {
  "poll": {
    "question": "Which broke your last integration?",
    "options": [ { "text": "missing scope" }, { "text": "sunset version" } ],
    "settings": { "duration": "THREE_DAYS" }
  }
}
```

### Response

`201 Created`. The new post URN is in the **`x-restli-id`** response header (`urn:li:share:{id}` or `urn:li:ugcPost:{id}`). The body does not contain the id.

## Media upload (initialize-upload pattern)

Images / Documents / Videos use the same two-step shape: register an upload to get an upload URL + URN, PUT the bytes, then reference the URN in `content`.

```bash
# Images example
curl -X POST "https://api.linkedin.com/rest/images?action=initializeUpload" \
  -H "Authorization: Bearer $LINKEDIN_TOKEN" \
  -H "Linkedin-Version: 202605" \
  -H "X-Restli-Protocol-Version: 2.0.0" \
  -H "Content-Type: application/json" \
  -d '{ "initializeUploadRequest": { "owner": "urn:li:organization:12345" } }'
# -> { "value": { "uploadUrl": "...", "image": "urn:li:image:C5..." } }
```

`/rest/documents?action=initializeUpload` → `urn:li:document:`; `/rest/videos?action=initializeUpload` → `urn:li:video:`.

## Post retrieval

```text
# Single post
GET /rest/posts/{urn-encoded-post-urn}

# By author (FINDER)
GET /rest/posts?q=author&author=urn%3Ali%3Aorganization%3A12345&count=10

# Batch
GET /rest/posts?ids=List(urn%3Ali%3Ashare%3A...,urn%3Ali%3Ashare%3A...)
```

## Share statistics — `GET /rest/organizationalEntityShareStatistics`

| Param | Value |
|---|---|
| `q` | `organizationalEntity` |
| `organizationalEntity` | URL-encoded `urn:li:organization:{id}` |
| `timeIntervals` (optional) | `(timeRange:(start:{ms},end:{ms}),timeGranularityType:DAY\|MONTH)` |
| `shares` / `ugcPosts` (optional) | filter to specific post URNs |

Organic only. Rolling 12-month window. Lifetime when `timeIntervals` omitted.

Response `totalShareStatistics` fields:

```jsonc
{
  "impressionCount": 4821,
  "uniqueImpressionsCount": 4102,
  "clickCount": 213,
  "likeCount": 96,
  "commentCount": 14,
  "shareCount": 8,
  "engagement": 0.0683
}
```

## Follower statistics — `GET /rest/organizationalEntityFollowerStatistics`

Same `q=organizationalEntity` shape. Lifetime or time-bound. Covers paid + organic. Segmented facets returned as `followerCountsBy*`:

- `followerCountsByGeoCountry`
- `followerCountsByIndustry`
- `followerCountsBySeniority`
- `followerCountsByFunction`
- `followerCountsByStaffCountRange`

Each facet entry carries `organicFollowerCount` and `paidFollowerCount`.

## URL-encoding & query tunneling

- Every URN in a path or query string must be percent-encoded: `urn:li:organization:12345` → `urn%3Ali%3Aorganization%3A12345`.
- When a query string would exceed URL limits (large batch / complex `timeIntervals`), use **query tunneling**: send the request as `POST` with header `X-HTTP-Method-Override: GET` and the query in the body as `application/x-www-form-urlencoded`.

## HTTP error catalog

| Status | Code / meaning | Cause | Fix |
|---|---|---|---|
| 400 | bad request | malformed body, missing required field, un-encoded URN | validate payload; encode URNs; send both versioned headers |
| 401 | unauthorized | expired/invalid token | refresh the token |
| 403 | ACCESS_DENIED | missing scope OR member lacks page role | grant the scope's product; verify ADMINISTRATOR/CONTENT_ADMIN/DSC role |
| 404 | not found | wrong/encoded URN, deleted post | check the URN and encoding |
| 409 | conflict | duplicate publish / state conflict | dedupe before retry |
| 422 | unprocessable | semantically invalid (e.g. article with no source) | fix the content shape |
| 426 | upgrade required | missing `X-Restli-Protocol-Version` / version header | send both versioned headers |
| 429 | TOO_MANY_REQUESTS | throttle | exponential back off; batch; schedule |
| 500 / 503 | server / unavailable | transient | retry with back off |

## Auth notes

- 3-legged OAuth 2.0 authorization-code flow: `https://www.linkedin.com/oauth/v2/authorization` → `https://www.linkedin.com/oauth/v2/accessToken`.
- Access tokens ~60 days. Marketing / Community apps can be issued refresh tokens — exchange with `grant_type=refresh_token` before expiry rather than re-consenting.
- Scopes are space-separated in the authorize URL. Org scopes require the Community Management / MDP product to be approved, or consent rejects them as "unauthorized scope".
