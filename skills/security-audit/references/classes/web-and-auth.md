# Web protocol and authentication classes

Load when: HTTP parsing, caching or identity is where trust is decided. APIs and web apps, custom
HTTP servers, gateways, CDNs and reverse proxies, plus anything that issues or checks identity:
cookie sessions and CSRF defences, JWT, OAuth/OIDC, SAML, passkeys, MFA, recovery, account
linking, API keys, mTLS. Verdict rules: [`../verification.md`](../verification.md).

Core `broken-access-control` asks whether a principal may do something. This file asks something
else: can the HTTP or identity layer be fooled about **which** principal, request, token or
assurance level an operation belongs to?

Hunt a big target in slices: request framing and caching, browser sessions, federated login,
strong authentication and recovery, machine credentials. A single app server behind a managed
proxy you cannot see offers little framing surface you can confirm from source; a proxy, gateway
or home-grown parser offers a lot.

## Ground rules

- **Framing and cache bugs need two parties that disagree.** Name both components and the exact
  value each one ends up with after normalising the same bytes or key.
- **Every credential has a verification line and a list of bindings.** Find where its signature
  or secret is checked, then check each binding its role requires: who issued it, who it is for
  (audience, client, RP, origin), which session and principal, which resource, what assurance,
  when it expires, whether it is single use.
- **Request metadata is a trust decision.** `Host`, `Forwarded` and `X-Forwarded-*`, `Origin`,
  `Referer`, redirect destinations, callback `state`, and any URL built from the request: follow
  each to the identity or response it shapes.
- **A missing control alone is a note.** No header, no cookie flag, no MFA prompt, no rate limit:
  none is a finding by itself. A finding needs the server accepting something invalid, impact on
  another principal, a drop in assurance, or a credential leaking.
- **Much of this lives outside the repo.** Proxy chains, CDN cache keys, IdP settings, certificate
  trust, how browsers treat cookies, secrets, the auth mode in production. When the verdict hangs
  on one of these, write `needs_validation` with that fact; do not assert it.
- **Check defaults at the pinned version** of the framework and library. If you cannot establish
  version or config, use `needs_validation`. Never trade an unverified critical claim for a
  "confirmed" lower severity.

## HTTP framing and caching

### `request-smuggling`

Two HTTP processors in a chain split the same byte stream into requests at different points. Look
at: more than one `Content-Length`, `Transfer-Encoding` parsing, HTTP/2 or HTTP/3 traffic
downgraded to HTTP/1.1, case and whitespace handling of header names, hop-by-hop headers, bare CR
or LF handling in custom parsers. Proof: feed the same local fixture to both parsers and show
where each thinks request one ends and request two begins.

### `cache-poisoning`

A request input changes the cached body or a security header, yet the cache key ignores it.
Compare how the key is built with every input that varies the response: forwarded host or scheme,
selected cookies, query normalisation, language or device headers, logged-in state. Proof: the
unkeyed input, the altered response, and a second user served that response.

### `cache-deception`

The cache files a private dynamic page under rules for public static files (`/account/profile.css`
served by the profile route), or stores a response whose identity inputs are missing from cache
policy. Compare edge rules by extension or path with how the app router normalises suffixes and
path parameters, and with the `Cache-Control` sent on authenticated routes.

### `host-header-trust`

Client-supplied host or proxy headers decide something sensitive: links in password-reset emails,
absolute URLs, tenant routing, callback targets, cache keys, or the client IP an allowlist or rate
limit relies on. Look at `request.host`, `X-Forwarded-Host`, `X-Forwarded-For`, trust-proxy
settings. Proof: who can send the header, and evidence that the trusted ingress does not remove a
client copy.

### `header-injection`

Outside data is written into `Location`, `Set-Cookie`, a CSP or another response header with
control characters or unsafe normalisation. First check that the framework does not already reject
CR/LF; then show a response header change that matters for security.

## Browser sessions

### `csrf`

**What it is.** A cross-site page makes the victim's browser send ambient credentials (cookies,
HTTP auth, client certificates) to an endpoint that changes state, and the server takes it: no
working anti-CSRF token, no same-site binding, no strict check of `Origin` or `Referer`.

**Where to look.** Inventory every mutation that authenticates by cookie: HTML forms, JSON-looking
endpoints that also parse `text/plain` or form bodies, multipart uploads, `_method` overrides, GET
handlers that change data, old route versions. `SameSite` helps only for the cookies and browser
contexts it is really applied to. Login CSRF and cross-site subresource loads need their own look.

**How to prove.** The ambient credential, the mutating route, the cross-site request shape the
server accepts, the cookie policy actually in force, and the missing check.

**Not a finding.** Read-only routes, and routes that need a bearer token browsers never attach on
their own.

### `session-fixation`

The session id does not change at login, account switch, MFA completion, impersonation start or
any privilege change; or it keeps working after logout, password change, revocation or account
suspension. Cover server-side sessions, refresh tokens, signed cookies, open WebSockets, cached
copies and fallback endpoints. Proof: an id from before the transition still works after it.

### `cookie-scope-transport`

A sensitive cookie is scoped too widely (`Domain`, `Path`), can travel over plain HTTP, or is
shadowed by a same-named cookie that another component reads first. Missing `HttpOnly`, `Secure`
or `SameSite` is a hardening note on its own. It is a finding when a realistic weaker origin,
network attacker or browser path can read, plant or overwrite the credential.

## Federated identity

Decide the role first. Redirect URI allowlists and code issuance are the authorisation server's
job, not a client's. Verification and binding bugs belong to whatever component consumes the token
or assertion.

### `jwt-verification`

**Order of checks.** Is the signature verified at all? Is the algorithm fixed by the server rather
than read from the token (`alg: none`, RS256/HS256 confusion)? Is the key source fixed? Then the
claims: `exp`, `nbf`, `aud`, `iss`. Treat `kid`, `jku` and `x5u` as attacker-chosen key pointers.
Look for strange or duplicate header handling and any path that decodes without verifying
(`jwt.decode(..., verify=False)`, `jsonwebtoken.decode`).

**Key point.** A token minted by a trusted issuer for a different service must be rejected here.
A missing `aud` check is the usual cause.

### `oauth-binding`

If the target is the authorisation server: `redirect_uri` must match exactly and belong to the
client. In every role: `state` tied to the user's session; PKCE and the code bound together where
they apply; the ID token's signature, issuer, audience and `nonce` checked; with several providers,
the callback tied to the provider the user actually picked. Compare the first callback with retry,
mobile or deep-link and account-linking callbacks.

### `saml-assertion-binding`

The element whose signature was checked must be the same element the code reads identity from
(signature wrapping). Look at unsigned or fallback branches, XML parser hardening (no external
entities), canonicalisation differences, and freshness and binding: validity window, audience,
recipient, `InResponseTo`, replay cache.

## MFA, passkeys and account changes

### `mfa-downgrade`

Someone holding only the first factor can enroll, swap or remove the second factor, mint recovery
codes, mark a device as trusted, or use a fallback login, without the fresh authentication policy
requires. Also check that removed or stale factors stop authorising sessions.

### `step-up-bypass`

A passed challenge raises the assurance of the wrong thing (another session, account, tenant,
action or request), or some route never asks for it. The challenge should be bound to the
principal, the current session, the target assurance level, the specific operation or resource
where policy says so, a deadline, and one-time use. Compare the web UI with the API, batch jobs,
recovery and flows resumed after an interruption.

### `webauthn-verification`

Registration must tie the challenge, RP ID, expected origin, credential, user handle, algorithm
and any required user verification to the session that began it. Login must check challenge, RP ID
and origin, that the credential belongs to the account, the signature, and presence or
verification when required. Watch discoverable-credential login that maps a `userHandle` to an
account, and linking flows. The signature counter matters only if the product treats a counter
going backwards as a sign of cloning.

### `account-linking`

Attaching a new email, phone, passkey, device, IdP or external account should need: an active
authenticated session, proof that the person controls the new identifier, any step-up policy
demands, and callback state tied to the account that started the link. Inspect unlink and relink,
invite acceptance, and "same verified email, so merge accounts" logic for tenant or identifier
collisions.

### `account-recovery`

Recovery tends to be the weakest way in. Check reset tokens for randomness, binding to the user
and purpose, expiry, single use, rate accounting, a trustworthy URL inside the email (see
`host-header-trust`), and that older tokens and live sessions die when it succeeds. Also cover
support or admin-assisted recovery, backup codes, moving to a new device, and changing email or
phone. Replies that differ only in revealing that an already-public account exists are not a
finding.

For linking and recovery, draw the account graph before and after the change. Each new edge
should say: who is acting now, how they proved the new identity, what assurance was required,
which session or callback it is tied to, and what gets revoked.

## API keys and mTLS

### `api-key-scope`

A key works across more tenants, environments, resources or actions than its stored record allows,
or request parameters can override what the key is bound to. Read the key lookup (prefix-only
compare versus the full secret), whether publishable and secret keys can be confused, how scope is checked, what happens on rotation, how long revocation stays cached, and what bulk endpoints allow.

### `api-key-exposure`

Keys show up where someone with less trust can read them: frontend bundles (`NEXT_PUBLIC_*`,
`VITE_*`), query strings, redirect URLs, logs, error pages, build output, API responses. Something
merely called a key may be a public identifier; establish its type and what it unlocks before
calling it a leak.

### `mtls-identity-confusion`

The service believes certificate identity headers (`X-Client-Cert`, `X-SSL-Client-*`) from any
peer; or the chain validates but subject text the attacker influences maps to the wrong account
(naive CN parsing); or it accepts a cert from the wrong trust domain, with the wrong EKU, audience
or validity rules. When a proxy terminates mTLS, confirm only that proxy can reach the backend, it
discards incoming identity headers, and the backend ties the cleaned identity to the request.

### `cert-lifecycle-fallback`

A certificate that is missing, expired, revoked or failed to renew makes the service quietly fall
back to bearer-only or anonymous access, or pooled long-lived connections keep their authority
after revocation. A fail-open branch you can read in the repo can be `confirmed`; when the answer
depends on deployed revocation data, it is `needs_validation`.

## Moves that work across this file

- Follow each credential and challenge through its whole life: issued, stored, sent, consumed,
  refreshed, revoked. Do it for the happy path and again for errors, retries, migrations, legacy
  routes and account switching.
- List every way into one identity and every path that reaches one sensitive action. The
  effective policy is whichever parallel route is weakest, whatever the main UI does.
- Lay out how the parser, proxy, router, cache and app each normalise a request. Validate by
  feeding identical, bounded fixtures to each locally, never by sending traffic to a live
  deployment.

## Proof checklist

1. Framing and cache: both components, where their parse or key diverges, and the impact across
   requests, across users or on a private response, demonstrated with local fixtures.
2. Tokens, MFA, passkeys, linking, recovery, API keys, mTLS: the verification line and the binding
   it lacks (principal, session, resource, origin, audience, action or assurance), plus evidence
   the server accepts the bad credential or transition.
3. CSRF: ambient credential, route, accepted cross-site shape, cookie policy, missing check.
4. `confirmed` only with a full source trace and an observed unauthorised identity, state change or
   disclosure. Otherwise `needs_validation`, naming the missing fact and the safe check that
   settles it. See [`../verification.md`](../verification.md).
