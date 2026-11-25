# Shopify apps & the GraphQL Admin API — deep dive

Companion to the App surface section of `../SKILL.md`. The template is `@shopify/shopify-app-react-router`.

## Template wiring

```js
// app/shopify.server.js
import { shopifyApp, ApiVersion } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,   // env, never in shopify.app.toml
  apiVersion: ApiVersion.April26,                  // pin; bump quarterly
  scopes: process.env.SCOPES?.split(","),
  sessionStorage: new PrismaSessionStorage(prisma),
  webhooks: { ORDERS_CREATE: { deliveryMethod: "http", callbackUrl: "/webhooks" } },
  future: { unstable_newEmbeddedAuthStrategy: true },
});
export const authenticate = shopify.authenticate;
```

OAuth, token exchange, and session storage are handled by the template — store sessions in a real
DB (Prisma/SQL) in production, never in memory.

## Queries & mutations

```js
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const res = await admin.graphql(
    `#graphql
     query Products($n: Int!) {
       products(first: $n) { nodes { id title totalInventory } }
     }`,
    { variables: { n: 20 } },
  );
  const { data, extensions } = await res.json();
  return { products: data.products.nodes, cost: extensions.cost };
}
```

Mutations follow the same shape and always select `userErrors { field message }` — Shopify returns
validation failures there, not as thrown errors:

```graphql
mutation UpdatePrice($input: ProductVariantsBulkInput!, $productId: ID!) {
  productVariantsBulkUpdate(productId: $productId, variants: [$input]) {
    productVariants { id price }
    userErrors { field message }
  }
}
```

## Query-cost, throttling & bulk operations

Read `extensions.cost.throttleStatus` after every call. Over-budget = HTTP 200 + a
`MAX_COST_EXCEEDED` entry in `errors`. Back off using `restoreRate` (points/sec). For large
exports use bulk operations instead of `first:`/`after:` loops:

```graphql
mutation {
  bulkOperationRunQuery(query: "{ products { edges { node { id title } } } }") {
    bulkOperation { id status }
    userErrors { field message }
  }
}
```

Poll `currentBulkOperation` until `status: COMPLETED`, then stream the JSONL from its `url`.

## Webhooks (HMAC)

```js
// app/routes/webhooks.jsx
export async function action({ request }) {
  const { topic, shop, payload } = await authenticate.webhook(request); // verifies HMAC
  // ... handle topic; return 200 fast, offload heavy work
  return new Response();
}
```

Never parse `request.body` directly — an unverified payload is untrusted input. Reconcile periodically;
webhooks can be missed.

## App Bridge & Polaris

Embedded UI runs inside the Shopify admin iframe. App Bridge handles session-token auth, navigation,
and toasts; Polaris web components give admin-consistent UI. Keep app UI in Polaris so it matches the
admin chrome — do not hand-roll admin-looking CSS.

## App extensions & deploy

Extensions live under `extensions/` (theme app extension, admin/customer-account UI extensions,
Functions, Flow). Ship them with versioned releases:

```bash
shopify app deploy   # creates an app version bundling code + extensions; `app config push` is removed
```

Each `shopify app deploy` is an immutable, rollback-able version. Pin and bump `apiVersion`
quarterly across both the app client and extension configs.
