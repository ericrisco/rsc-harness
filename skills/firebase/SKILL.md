---
name: firebase
description: "Use when building on Firebase — Firestore data modeling, Security Rules, Auth and custom claims, Cloud Functions, Storage, modular Web/Admin SDK imports — including symptoms like a database open to the internet, a query rejected by rules, or a doc stuck at ~1 write/sec. NOT managed-Postgres BaaS with SQL and RLS (that is supabase)."
tags: [firebase, firestore, security-rules, cloud-functions, auth]
recommends: [secure-coding, gcp-essentials, nextjs]
origin: risco
---

# Firebase — Firestore, Rules, Auth, Functions, Storage

The Firebase product surface that sits on top of GCP, on the modular Web SDK (v12) and the Admin SDK.
The whole skill exists to stop two failure modes: dragging relational/SQL habits into a NoSQL
document store, and leaving the database open to the internet.

Two facts drive everything below:

- **It is a NoSQL document store, shaped for the read path.** No joins, no server-side `OR` across
  different fields without a composite index, no `SELECT *` across collections. Denormalize and
  fan-out so a screen is one cheap query — reads are what you pay for and what users wait on.
- **Rules ARE the access control.** Firestore is reachable directly from untrusted clients. There is
  no app server in the trust path by default — `firestore.rules` (CEL) is the only thing between a
  browser and your data. App Check attests the request even came from your app before Rules evaluate.

Not this skill:

| Instead of Firebase | Go to |
|---|---|
| Relational schema, SQL, EXPLAIN, indexing a SQL engine | `../postgresdb/SKILL.md` |
| Managed Postgres BaaS (SQL + Postgres RLS + PostgREST) — the most-confused sibling: same "backend-as-a-service" shape, completely different data model and rules language | `supabase` |
| AWS document/key-value store with its own capacity model | `dynamodb` |
| Self-hosted Mongo document modeling | `mongodb` |
| Generic GCP project/IAM/billing not specific to a Firebase product | `gcp-essentials` |
| React/Next.js component or rendering work that merely calls Firebase | `react` / `../nextjs/SKILL.md` |

## Data modeling

Firestore charges and waits on reads. Model so the common screen is one query against one collection.

**Collection vs subcollection vs root + denormalized field — decide by access pattern:**

| Shape | Use when | Why |
|---|---|---|
| Subcollection (`rooms/{id}/messages`) | Child list is only ever read inside its parent, can grow unbounded | Subcollections don't bloat the parent doc; deleting a parent does NOT delete them (handle that) |
| Separate root collection + foreign id | Child must be queried across all parents (collection-group query) | A `collectionGroup('messages')` query needs the docs in same-named subcollections OR a root collection |
| Denormalized field on the parent | A few values are shown alongside the parent and rarely change | Avoids a second read; you accept writing the copy on every change |

**Hard limits — design around them, don't discover them in prod:**

- A document maxes out at **1 MiB (1,048,576 bytes)**. Don't accumulate an unbounded array (chat
  messages, audit log) inside one doc — it will hit the wall and every read pays for the whole blob.
  Use a subcollection.
- A single document tolerates only **~1 sustained write/sec**. Monotonic IDs and indexed sequential
  timestamps create a hotspot on one index range. Use scattered auto-IDs (`doc(collection(db,'x'))`),
  and for high-frequency counters use a **sharded counter** (N shard docs, sum on read).

**Query reality:** no joins; range/inequality filters on a field plus an `orderBy` on another field
require a **composite index**; `in` / `array-contains-any` are capped (~30 values). If a query needs
an index, declare it in `firestore.indexes.json` — see the emulator gotcha below.

```ts
// Bad — unbounded array inside one doc; hits 1 MiB, every read pays for all of it
await setDoc(doc(db, "rooms", roomId), { messages: [...allMessages, newMsg] });

// Good — one doc per message in a subcollection, scattered auto-ID, no hotspot
await addDoc(collection(db, "rooms", roomId, "messages"), {
  text, authorId, createdAt: serverTimestamp(),
});
```

Denormalization recipes, counter sharding, cursor pagination, `getCountFromServer`, collection-group
queries, and composite-index design live in `references/data-modeling.md`.

## Security Rules — the load-bearing section

**Rules are NOT filters.** A query is rejected outright unless the rules can guarantee *every* matched
document is readable — Firestore will not silently drop the docs you can't see. So a `list` rule and
the query that runs against it must agree: if the rule allows reading only your own docs, the query
must itself be constrained (`where("ownerId","==",uid)`), or the whole query fails.

```javascript
// Bad — the entire database is readable AND writable by anyone on the internet
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}

// Good — default-deny, ownership-scoped, with create-time validation
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow get:    if resource.data.ownerId == request.auth.uid;
      allow list:   if request.auth != null;            // query MUST add where(ownerId == uid)
      allow create: if request.auth.uid == request.resource.data.ownerId;
      allow update, delete: if resource.data.ownerId == request.auth.uid;
    }
    // everything else: no rule = denied
  }
}
```

Rules to internalize:

- **Default-deny.** No matching `allow` = denied. Never add a `/{document=**}` catch-all with
  `if true`. That single line is the "open to the internet" headline risk.
- **`request.auth`** is the authenticated identity (null when signed out); `request.auth.token`
  carries **custom claims** for RBAC (e.g. `request.auth.token.admin == true`).
- **`resource.data`** is the existing doc; **`request.resource.data`** is the incoming write. Validate
  the incoming write on `create`/`update` (types, immutable `ownerId`, no privilege escalation).
- **`get()` / `exists()`** read another doc for cross-document checks (e.g. role lookup) — each costs
  a billed read and counts against rule-evaluation limits, so keep them shallow.
- **`get` vs `list`** are distinct: a single-doc read vs a query. `read` = both; split them so a
  query can't leak documents a single `get` would also have blocked.

Set custom claims with the Admin SDK, never from the client. Add **App Check** in production so Rules
only run for requests that provably came from your real app.

Full CEL patterns — RBAC via claims, ownership, validation functions, time-based throttling, and the
complete `@firebase/rules-unit-testing` recipe — are in `references/security-rules.md`.

## Auth

- **Client sign-in** with `getAuth()` + a provider; the SDK manages the refresh of the ID token.
- **Server-side, verify the ID token** with `getAuth(adminApp).verifyIdToken(idToken)` before trusting
  any caller. A raw UID from the client is not proof of anything.
- **Custom claims for RBAC:** `getAuth(adminApp).setCustomUserClaims(uid, { admin: true })`. Claims
  land in `request.auth.token` in Rules and in the decoded token on the server. They refresh on the
  client's next token refresh, not instantly — force a refresh if you need it immediately.
- **Session cookies** (`createSessionCookie`) suit SSR / server-rendered apps where you want an
  httpOnly cookie instead of shipping the ID token to every request — pairs with `../nextjs/SKILL.md`.

## Cloud Functions (2nd gen)

2nd gen is the default and the only generation that runs **Node.js 22**. Use `firebase-functions` v7
modular triggers and `firebase-admin`.

```ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const STRIPE_KEY = defineSecret("STRIPE_KEY"); // never hard-code secrets

export const onPostWrite = onDocumentWritten(
  { document: "posts/{postId}", region: "europe-west1" },
  async (event) => {
    // Background events deliver AT-LEAST-ONCE — make this idempotent.
    const eventId = event.id; // dedupe on this (e.g. a processed/{eventId} marker doc)
  }
);

export const setAdminClaim = onCall(async (request) => {
  if (request.auth?.token.admin !== true) throw new HttpsError("permission-denied", "admins only");
  // ... verify, then setCustomUserClaims via admin SDK
});
```

- **Callable** (`onCall`) gives you `request.auth` already verified; raw **`onRequest`** HTTPS does not
  — you must verify the ID token yourself.
- **Idempotency is mandatory** for background triggers (`onDocumentWritten` etc.): events can fire more
  than once, so guard side effects with the event id.
- Pin **region**, set **secrets** with `defineSecret` (not env literals), and tune concurrency for cost.
- Functions require the **Blaze** plan; outbound networking from a function also requires Blaze.

Trigger catalogue, callable-vs-HTTPS auth, idempotency keys, cold-start/cost, Auth blocking functions,
and region pinning are in `references/cloud-functions.md`.

## Cloud Storage

Storage paths are gated by their own Rules; clients can hit them directly.

```javascript
// Bad — any signed-in user can overwrite any other user's avatar
match /avatars/{fileName} { allow write: if request.auth != null; }

// Good — path-scoped to the owner, with a size/type guard
match /avatars/{uid}/{fileName} {
  allow read:  if true;                          // public avatars
  allow write: if request.auth.uid == uid
               && request.resource.size < 5 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');
}
```

For server-issued time-limited access (private downloads), generate a **signed URL** from the Admin
SDK rather than loosening the Rules.

## SDK & project mechanics

Use the **modular** SDK so the bundler tree-shakes unused Firebase code. The old namespaced
`firebase.firestore()` API is gone in v9+.

```ts
// Bad — pulls the entire SDK; defeats tree-shaking (and the compat/namespaced API is legacy)
import firebase from "firebase";
firebase.firestore().collection("posts").get();

// Good — named imports, only what you use ships (Web SDK v12)
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
const db = getFirestore(initializeApp(config));
const snap = await getDocs(collection(db, "posts"));
```

- `firebase.json` configures emulators, rules/index file paths, and hosting; `firestore.indexes.json`
  declares composite indexes.
- Run the **Local Emulator Suite** (`firebase emulators:start`) for local dev and tests.
- **Emulator gotcha:** the Firestore emulator does NOT enforce composite indexes — it runs any valid
  query. So "works in the emulator, fails in prod with *requires an index*" is expected. Verify index
  coverage separately by keeping `firestore.indexes.json` in sync and deploying it.
- The Firebase API key in client config is **not a secret** (it identifies the project, not authorizes
  access — Rules + App Check do that). Service-account JSON keys ARE secrets; keep them server-side.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| `allow read, write: if true;` catch-all | Whole DB is open to the internet | Default-deny; scope each `match` to `request.auth` + ownership |
| Treating rules as query filters | Query is rejected, not filtered — it fails entirely | Constrain the query to match what `list` allows |
| Unbounded array in one document | Hits the 1 MiB limit; every read pays for the whole blob | Subcollection, one doc per item |
| Monotonic IDs / sequential indexed timestamps | Index hotspot → ~1 write/sec/doc wall | Scattered auto-IDs; sharded counters for high write rate |
| Trusting client writes for sensitive fields | Client can set `role: "admin"` on itself | Validate `request.resource` in Rules; set claims via Admin SDK only |
| No App Check in production | Rules run for any caller, including scripts/scrapers | Enable App Check (reCAPTCHA / Play Integrity / App Attest) |
| Service-account key in client / repo | Full admin access leaks | Keep service-account JSON server-side; client API key is fine |
| Namespaced/compat SDK (`firebase.firestore()`) | Legacy, not tree-shakeable, gone in modular | Modular named imports from `firebase/firestore` |
| No emulator / rules tests | Open or broken rules ship silently | `@firebase/rules-unit-testing` via `firebase emulators:exec` |
| Background trigger with non-idempotent side effects | At-least-once delivery double-charges/double-writes | Dedupe on `event.id` |

## Verify

`scripts/verify.sh` is read-only and runs from your project root. It locates `firestore.rules` and
fails if a root `match /{document=**}` carries an `allow read, write: if true;` catch-all or the rules
file is empty; validates `firestore.indexes.json` parses as JSON; and, when the Firebase CLI is
present, points at the `firebase emulators:exec` rules-test path. It exits 0 and skips cleanly when no
Firebase artifacts are in the working directory — not every repo has them.
