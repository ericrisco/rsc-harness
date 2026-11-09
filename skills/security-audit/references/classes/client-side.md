# Client-side and browser classes

Load when: the browser makes trust decisions or renders content an attacker can shape. SPAs,
browser extensions, embedded webviews, service workers, offline-first apps, DOM rendering of
outside content, cross-window messaging, data kept in browser storage. Verdict rules:
[`../verification.md`](../verification.md).

Browser code has inputs the server never sees: the URL fragment, `window.name`, `postMessage`
payloads, content cached on an earlier visit. The native half of a webview bridge belongs in
`desktop-mobile-ipc.md`; CSRF, sessions and login callbacks on the server belong in
`web-and-auth.md`.

## Ground rules

- **Source plus sink.** A candidate needs an input the attacker controls and a sink that runs code
  or leaks data. Name both and show the data flowing between them.
- **Someone else must be hurt.** The impact has to reach a victim's session, a different origin, or
  storage other people share. Running script in your own page or reading your own data
  (self-XSS) does not count.
- **Credit the browser's real defences** before rating impact: auto-escaping in the framework, the
  same-origin policy, CSP, COOP and CORP, service-worker scope rules, the `noopener` default
  modern browsers apply to new windows.
- **Storage outlives sessions.** Browser storage and caches are per origin and survive logout
  unless code clears them. For every record, know its writer, its reader, and which account,
  tenant or worker lifecycle wipes it.
- Validate in a local test origin with fake accounts. Never with real users, real origins or
  shared services. Facts you cannot observe (renderer behaviour, extension permissions, headers in
  production, browser version) make the verdict `needs_validation`.

## DOM and object state

### `dom-xss`

**Sources.** Any part of `location` (hash, search, pathname), `document.referrer`, `window.name`,
message payloads, values read back from storage, other document state an attacker influences.

**Sinks.** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, string
arguments to `setTimeout`/`setInterval`, `new Function`, `javascript:` URLs placed in `href`, `src`
or `location`, jQuery `.html()`, `.append(html)` and `$(userString)`, and the framework escape
hatches: `dangerouslySetInnerHTML`, `v-html`, `[innerHTML]`, `bypassSecurityTrust*`, `{@html}`.

**Not a finding.** Values the framework escapes correctly for where they land.

### `dom-clobbering`

**What it is.** Markup the attacker injects carries `id` or `name` attributes that override a
global, a form property, a config object or an initialisation flag the script trusts later
(`window.config`, a `document.getElementById` fallback, `form.action`).

**Proof needs two things.** A path for markup that keeps those attributes (sanitiser, Markdown,
rich-text editor), and code that reads the overridden value in a way that matters for security.

### `prototype-pollution`

**What it is.** A key the attacker picks (`__proto__`, `constructor.prototype`) reaches a recursive
writer such as a deep merge, `set(obj, path, value)` or a query-string parser that builds nested
objects, and modifies prototype state every object shares.

**Proof needs a gadget.** Show code that later reads the polluted property and, because of it,
changes an authorisation result, executes something, navigates somewhere or renders something. A
plain `JSON.parse`, a shallow copy, or pollution that nothing consumes is not a finding.

## Messaging and cross-origin network

### `postmessage-trust`

A `message` listener acts on `event.data` but does not compare `event.origin` with an exact list,
or, when several frames share one origin, does not check `event.source` either. On the sending
side, posting private data with target origin `*` hands it to whoever embeds the page. Grep
`addEventListener('message'`, `onmessage`, `postMessage(` with `'*'`. Checks built from
`includes`, `startsWith`, `endsWith`, `indexOf` or a regex without anchors do not count as origin
checks. Listeners that only adjust harmless UI are notes.

### `cross-site-websocket`

The WebSocket handshake accepts the victim's cookies from any origin without checking `Origin` or
requiring a token per channel, so a hostile page can drive the victim's socket. Read the upgrade
handler (`verifyClient`, socket auth middleware) and then the message handlers that read or change
data. Sockets authenticated by a token the hostile page cannot get are fine.

### `credentialed-cors`

The server echoes the request `Origin`, or matches it loosely, while also sending
`Access-Control-Allow-Credentials: true`, and the response holds private data or the request
changes state. Look for origin values copied from the request, regex allowlists, `null` accepted as
an origin. A literal `*` combined with credentials is rejected by browsers, so it is not a finding;
nor is public data served without credentials.

## Service workers and storage

### `service-worker-takeover`

Content an attacker influences becomes the registered worker script, or sits on a path that gets a
wide `Service-Worker-Allowed` scope, or changes what `importScripts` loads with no integrity check.
Check the argument to `navigator.serviceWorker.register(`, the final script URL, its MIME type,
origin and scope, and who controls each imported file. A same-origin worker with the scope it was
meant to have is not a defect.

### `service-worker-cache-confusion`

The worker stores personalised responses without keying them on account, tenant, auth state or
request mode, and replays them after logout or an account switch. Read the `fetch` handler's
routing, cache names and keys, navigation fallbacks, what is deleted at logout, and offline or
error branches that might return the previous user's page.

### `browser-storage-exposure`

Tokens, private API responses, drafts or cached permission decisions remain in browser storage (IndexedDB, `localStorage`, Cache Storage, `sessionStorage`, an extension's storage area) or in-memory app state, where another
account or a same-origin component with less trust can read them. A token sitting in storage is
not enough by itself: show a reader with less authority, or show the value still being used after
logout or revocation.

### `cross-context-confusion`

Identity or commands travel between tabs over `BroadcastChannel`, `storage` events, caches shared by the whole origin or shared workers with nothing tying them to the current session. Test account switching,
private versus normal windows, tenant changes, and an old tab overwriting newer auth state.

Proof for this group: show the write or cache entry the attacker controls arriving at a different
account, a different tenant, or a later authorisation decision.

## Cross-site leaks

### `xs-leak`

**What it is.** A hostile page learns something private about another origin while the browser
sends the victim's credentials along: through load or error events, number of frames, window
properties, redirects, timing, cache probing or response length.

**Proof.** One specific yes-or-no secret (does this private record exist, is this user an admin,
is this person signed in to that service), backed by source and by behaviour in a local browser.
Then say which header or rendering change would close it: `Cross-Origin-Opener-Policy`,
`Cross-Origin-Resource-Policy`, `SameSite`, checks on fetch-metadata headers.

**Not a finding.** Random timing noise, or learning whether a public resource exists.

### `window-opener-disclosure`

The parts of a cross-origin window that a page is allowed to see (its navigation outcome, frame
count, other permitted properties) give away private state, or a retained `opener` or named window
lets a hostile page steer a privileged navigation. Check COOP, framing rules, `noopener`, exact
origins, and whether what can be observed is actually secret.

## UI redress and navigation

### `clickjacking`

A page with a state-changing action can be loaded in a frame because `frame-ancestors`,
`X-Frame-Options` or an equivalent defence is missing or ineffective. Report it only when a
sensitive action can be completed inside the frame. On read-only pages the missing header is a
hardening note.

### `client-navigation-confusion`

Script reads a client-side value and navigates to it without restricting scheme or destination,
including `javascript:` and `data:` URLs (`location = params.get('next')`, `window.open(url)`,
router pushes with outside input). Reverse tabnabbing only counts when the code keeps
`window.opener` on purpose, opens windows without isolation, or targets a browser that does not
apply `noopener` by default.

## Moves that work across this file

- Begin at the sinks (DOM writes, navigation, worker registration, message handlers, storage reads)
  and trace back to both browser-only and server-provided inputs. Note which browser policy should
  have stopped each path.
- In a local origin with fake users, run through logout, account switch, worker update, offline
  mode and stale tabs.
- For leaks, list only the yes-or-no questions you proved from source and local behaviour.

## Proof checklist

1. Input, sink, the browser policy in force, the origin or session affected, and the change or
   leak observed.
2. Prototype pollution: the recursive write and a gadget that matters. Clobbering: the markup
   survives sanitising and the overridden value is read.
3. Workers and storage: the record reaches a different account, tenant or later auth decision.
4. Messaging, CORS, sockets and leaks: the exact origin or source check, the private state or
   action reached, and proof that CSP, COOP/CORP, cookie attributes and `SameSite` do not already
   block the path.
5. `confirmed` needs the full client path and bounded local evidence. Otherwise
   `needs_validation`, naming the production header, extension permission, browser version or
   renderer behaviour someone must check. See [`../verification.md`](../verification.md).
