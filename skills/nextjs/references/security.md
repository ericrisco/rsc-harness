# Next.js security — auth, CSRF, XSS, CSP, env, SSRF

Deep dive behind the "Security" section of `SKILL.md`. Next.js-specific layer; complements the
generic `../security-audit/SKILL.md` rather than duplicating it. Sources: authjs.dev
session-management/protecting, the Next.js security model docs.

## Auth on every Server Action / Route Handler / DAL

The load-bearing rule: middleware/`proxy.ts` is a coarse redirect, **not** a security boundary. The
real boundary is an `auth()` check inside every Server Action, every Route Handler, and a Data
Access Layer that every read/write goes through.

```ts
// app/admin/actions.ts — guarded action: authenticate, authorize, then mutate
"use server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const BanSchema = z.object({ userId: z.string().uuid() });

export async function banUser(input: z.infer<typeof BanSchema>) {
  const session = await auth();
  if (!session?.user) return { status: "error", message: "Not authenticated" } as const;
  if (session.user.role !== "admin") return { status: "error", message: "Forbidden" } as const;

  const parsed = BanSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid input" } as const;

  await db.user.update({ where: { id: parsed.data.userId }, data: { banned: true } });
  return { status: "ok" } as const;
}
```

```ts
// lib/dal.ts — the Data Access Layer: every read goes through a session check
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
});

export async function getMyProjects() {
  const user = await requireUser(); // re-checks the session here, not just in middleware
  return db.project.findMany({ where: { ownerId: user.id } });
}
```

## CSRF

Server Actions are same-origin POSTs. Defense: SameSite cookies (`lax`) plus Next.js's built-in
`Origin`/`Host` comparison, which rejects cross-origin action requests. Configure trusted origins
explicitly, and never expose a mutation as an unauthenticated GET.

```ts
// next.config.ts — restrict which origins may invoke Server Actions
import type { NextConfig } from "next";
const config: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["app.example.com", "*.example.com"] },
  },
};
export default config;
```

## XSS

Avoid `dangerouslySetInnerHTML`. React escapes by default — opting out reintroduces XSS. If you must
render HTML (e.g. sanitized CMS content), sanitize it **on the server** with DOMPurify first, and
never interpolate user input into `<script>` tags or URLs.

```tsx
// Bad: raw user/CMS HTML straight into the DOM
<div dangerouslySetInnerHTML={{ __html: post.body }} />;

// Good: sanitize on the server before it reaches the client
import DOMPurify from "isomorphic-dompurify";
const clean = DOMPurify.sanitize(post.body, { ALLOWED_TAGS: ["p", "a", "strong", "em", "ul", "li"] });
<div dangerouslySetInnerHTML={{ __html: clean }} />;
```

```tsx
// Bad: user input in an href can be a javascript: URL
<a href={user.website}>Site</a>;
// Good: validate the scheme first
const safe = /^https?:\/\//.test(user.website) ? user.website : "#";
<a href={safe} rel="noopener noreferrer">Site</a>;
```

## Env exposure

`NEXT_PUBLIC_*` variables are **inlined into the client bundle** at build time — anyone can read
them. Keep secrets in plain (server-only) env vars and guard secret modules with `import "server-only"`.

| Variable form             | Visible in browser? | Use for                          |
| ------------------------- | ------------------- | -------------------------------- |
| `DATABASE_URL`, `API_KEY` | No (server only)    | secrets, DB, server-to-server    |
| `NEXT_PUBLIC_*`           | Yes (inlined)       | public, non-secret config only   |

```ts
// lib/payments.ts — fails the build if this module is ever pulled into a client bundle
import "server-only";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!; // never NEXT_PUBLIC_*
export async function charge(amount: number) {
  /* server-to-server call using STRIPE_KEY */
}
```

Proxy a third-party API through a Route Handler so the key never leaves the server:

```ts
// app/api/quote/route.ts — the browser calls this; the key stays server-side
import { NextResponse } from "next/server";
export async function GET() {
  const res = await fetch("https://api.vendor.com/quote", {
    headers: { Authorization: `Bearer ${process.env.VENDOR_KEY}` },
  });
  return NextResponse.json(await res.json());
}
```

## SSRF

A Route Handler that fetches a **user-supplied URL** must allowlist host + scheme, block
internal/metadata ranges (`169.254.169.254`, `localhost`, RFC1918), and not follow redirects to
internal hosts.

```ts
// Bad: fetches whatever URL the user sends — can hit the cloud metadata endpoint
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url")!;
  return Response.json(await (await fetch(target)).json()); // ✗ SSRF
}
```

```ts
// Good: allowlist host + scheme, reject internal ranges, disable redirects
const ALLOWED_HOSTS = new Set(["images.example.com", "cdn.example.com"]);
const BLOCKED = [/^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./];

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return Response.json({ error: "missing url" }, { status: 400 });
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }
  if (url.protocol !== "https:") return Response.json({ error: "https only" }, { status: 400 });
  if (!ALLOWED_HOSTS.has(url.hostname)) return Response.json({ error: "host not allowed" }, { status: 400 });
  if (BLOCKED.some((re) => re.test(url.hostname))) return Response.json({ error: "blocked range" }, { status: 400 });

  const res = await fetch(url, { redirect: "error" }); // do not follow redirects
  return Response.json(await res.json());
}
```

## Security headers / CSP

Set a nonce-based Content Security Policy in `proxy.ts` (v16) / `middleware.ts` (v15), pass the
nonce to `<Script nonce>`, and add the standard hardening headers.

```ts
// proxy.ts (v16) — generate a per-request nonce and set the CSP
import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
  ].join("; ");

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}
```

```tsx
// read the nonce in a layout and pass it to any inline script
import { headers } from "next/headers";
import Script from "next/script";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      {children}
      <Script id="analytics" nonce={nonce} strategy="afterInteractive">
        {`/* inline analytics bootstrap */`}
      </Script>
    </>
  );
}
```

## Cookies

Set session cookies `httpOnly`, `secure`, `sameSite: "lax"`. Rotate the session on any privilege
change (login, role elevation, password change) to prevent fixation.

```ts
import { cookies } from "next/headers";

export async function setSession(token: string) {
  (await cookies()).set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
```

## See Also

Complements `../security-audit/SKILL.md` (generic). This file is the Next.js-specific layer; for the
auth wiring and DAL pattern in context see the "Auth" section of `../nextjs/SKILL.md` and
`data-and-caching.md`.
