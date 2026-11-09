# Attack classes

Load when: you are choosing what to hunt after reconnaissance, or you need the exact `class` id
for a finding in `findings.json`. Verdict rules (`confirmed`, `needs_validation`, rejected) live in
[`../verification.md`](../verification.md); this folder only says what to look for.

## How to use this folder

1. Read the target map from reconnaissance. Pick only the classes that fit the code you have. A
   CLI with no network listener does not need CSRF; a static site does not need MCP identity.
2. Always run the core catalog below. Then load each domain file whose "load when" matches.
3. Split big targets by subsystem (auth, billing, import, agent tools) and run the chosen classes
   per subsystem, not once for the whole repository.
4. Stay inside safe validation: read source, run bounded local fixtures with dummy data. Never
   build payload chains, never test availability against a live service, never touch shared
   environments.
5. Every finding carries one `class` id from this folder. If two ids fit, pick the one that names
   the broken control (where the fix goes), and mention the other in the narrative.

## Domain files

| File | Load when |
|------|-----------|
| [`ai-and-llm.md`](ai-and-llm.md) | A model reads untrusted content or its output drives tools, memory, MCP calls, rendering or any decision with authority (chatbots, RAG, agents, prompt builders). |
| [`web-and-auth.md`](web-and-auth.md) | The target parses or caches HTTP, sits behind a proxy/CDN, or issues and checks identity: JWT, OAuth/OIDC, SAML, passkeys, MFA, cookie sessions and CSRF, recovery, account linking, API keys, mTLS. |
| [`client-side.md`](client-side.md) | Trust decisions or rendering happen in a browser: SPAs, extensions, webviews, service workers, browser storage, `postMessage`, CORS, WebSockets, DOM sinks. |
| [`supply-chain.md`](supply-chain.md) | The repo resolves dependencies, generates code, runs CI, builds, signs, promotes or ships updates, or loads plugins and extensions. |
| [`cloud-and-deployment.md`](cloud-and-deployment.md) | The repo defines IAM, infrastructure as code, containers, Kubernetes, mesh, serverless or edge functions, ingress, buckets, provider events or per-environment config. |
| [`memory-and-binary.md`](memory-and-binary.md) | Native or low-level code: C, C++, unsafe Rust, FFI, kernel modules, parsers and decoders, binary loaders, JITs, firmware, lock-free or concurrent runtimes. |
| [`protocols-and-messaging.md`](protocols-and-messaging.md) | gRPC, GraphQL transports, Protobuf/Thrift/Cap'n Proto, custom wire protocols, queues, brokers, pub/sub, webhooks, streaming RPC. |
| [`resource-exhaustion.md`](resource-exhaustion.md) | Untrusted work can burn shared CPU, memory, disk, connections, workers, queue depth, quotas or money the operator pays for. |
| [`data-isolation.md`](data-isolation.md) | Multi-tenant stores, shared caches or search indexes, object links, analytics, export and backup, migrations, deletion, retention, restore. |
| [`desktop-mobile-ipc.md`](desktop-mobile-ipc.md) | Native desktop or mobile apps and what they expose on the device: URL schemes and deep links, exported components, the bridge between a webview and native code, local daemons and privileged helpers, IPC over Unix sockets, D-Bus, XPC or Binder. |

Each domain file defines its own ids. The ids in this README are the core set; domain ids never
reuse a core id with a different meaning.

## Core catalog

The core catalog applies to almost every codebase. For each class: what breaks, where to look,
and the line between a finding and a note.

### Injection

| id | What it is |
|----|------------|
| `injection` | Untrusted data reaches an interpreter or dangerous sink without the encoding or parameterisation that sink needs. |
| `second-order-injection` | Data is stored safely, later read by other code and used in a context where it becomes dangerous. |

**Sinks by target type.**

- Web apps: SQL and ORM raw queries, HTML output, template engines, shell, file paths, HTTP
  redirects, deserialisers.
- Libraries: any function that processes caller bytes without checks: buffer ops, parsers,
  format strings.
- CLI tools: command lines built from strings, path handling, environment variable expansion.
- Services: query builders, message serialisation, log lines, LDAP and XPath filters.
- Browser code: DOM XSS, prototype pollution, `postMessage` trust; use the `client-side.md` ids.

**Where people stop too early.** Values are not the only carrier. Check field names, object keys,
header names and metadata. Check secondary systems the input lands in: logs, caches, search
indexes, analytics pipelines. For `second-order-injection`, look for a field name that becomes a
JSON path, a slug that becomes a file path, escaped text that later renders raw, or a stored
string that is later treated as a URL, a regular expression, a template or a policy rule.

**Grep starts.** `query(` with `+` or template literals, `raw(`, `exec(`, `system(`,
`subprocess` with `shell=True`, `child_process`, `eval(`, `Function(`, `vm.runInContext`,
dynamic `import()`, `render_template_string`, `| safe`, `dangerouslySetInnerHTML`,
`pickle.loads`, `yaml.load` without a safe loader, `ObjectInputStream`.

**Only a note.** A sink fed only by constants or by the caller's own trusted config; a value the
framework already escapes for that exact context.

### Access control

| id | What it is |
|----|------------|
| `broken-access-control` | A caller can read or change something outside its authority. |
| `authn-without-authz` | An endpoint checks that the caller is logged in, never that it may touch this resource. |
| `mass-assignment` | A request body field overrides what the permission model meant to fix (owner, role, tenant, price). |
| `inconsistent-access-paths` | The same resource or state change has several routes and at least one checks a weaker permission. |
| `bulk-operation-authz` | Batch, bulk, export or import paths skip the per-item check the single-item path applies. |

Do not stop at "a check exists". Confirm it is the right permission, on the right resource, through
the right mechanism. Enumerate every route to the same state change (REST, GraphQL, admin, jobs,
legacy versions) and compare their checks side by side. For complex models, hunt authentication
bypass and authorisation logic as separate passes.

**Grep starts.** Route tables and middleware lists, `@login_required` without a permission
decorator, `findById(req.params.id)` without an owner filter, `update(req.body)`,
`Object.assign(model, body)`, `**request.data`.

### Resource and file handling

| id | What it is |
|----|------------|
| `path-traversal` | Reads or writes escape the intended directory, through `..`, encoded sequences, absolute paths, symlinks or NUL bytes. |
| `ssrf` | The server fetches a URL the attacker controls, also reachable via redirect chains, DNS rebinding, or two URL parsers that disagree. Webhook, callback and notification URLs belong here. |
| `unsafe-deserialization` | Untrusted bytes go into a deserialiser that can build arbitrary objects or run code. |
| `archive-extraction` | Archive entries (zip slip, tar links) write outside the extraction root or overwrite files. |
| `temp-file-handling` | Predictable or shared temp paths let another local principal read, replace or pre-create the file. |
| `file-toctou` | A file is checked, then used, and the path can change between the two. |
| `memory-safety` | Buffer overflow, use-after-free, integer overflow in native code. Use the detailed ids in `memory-and-binary.md` when that file is loaded. |

**Where to look.** `open(`/`fs.readFile` with joined user input, `path.join` without a
`realpath` + prefix check afterwards, `send_file`, upload handlers, `ZipFile.extractall`,
`tar.extractall`, `requests.get(user_url)`, `fetch(url)` on the server, image and PDF renderers
that load remote resources, `mktemp`, `/tmp/` literals, `os.access` followed by `open`.

**Only a note.** Fetchers restricted to a fixed allowlist resolved after redirects; paths resolved
and prefix-checked after symlink resolution.

### Cryptography and secrets

| id | What it is |
|----|------------|
| `weak-randomness` | Tokens, keys, nonces or reset codes come from a non-cryptographic generator (`Math.random`, `random.random`, time seeds). |
| `hardcoded-secret` | A live credential sits in source, config, history, fixtures or images. |
| `secret-exposure` | A secret leaks into logs, error messages, URLs, client-visible responses or bundles. |
| `broken-crypto-construction` | Broken key derivation, missing or skipped HMAC verification, nonce or IV reuse, static IVs. |
| `crypto-primitive-misuse` | ECB mode, unauthenticated encryption, homemade schemes, wrong primitive for the job. |
| `timing-side-channel` | Secrets compared with early-exit equality (`==`, `strcmp`) instead of a constant-time compare. |
| `crypto-fail-open` | When a crypto call throws or a key is missing, the code continues without encryption or verification. |

**Only a note.** A "secret" that is a public identifier (publishable key, key id); a timing
difference on a value that is not secret.

### Business logic

Scanners do not find these. Walk each major workflow by hand.

| id | What it is |
|----|------------|
| `state-machine-violation` | Steps can be skipped, reversed, replayed after completion, or left half-done when a later step fails without rollback. |
| `business-race-condition` | Non-atomic check-then-act lets concurrent calls double-spend, double-approve or lose updates. |
| `numeric-manipulation` | Negative, zero, huge, fractional or string-typed quantities break totals, limits or balances. |
| `business-rule-bypass` | The check exists but enforces the wrong rule, or input to one operation reaches an effect another operation restricts. |
| `implicit-trust` | Data from storage, config, another component or a plugin is trusted because "it was validated on the way in", but a different writer exists. |
| `time-logic-flaw` | Expiry, scheduling, rate windows, clock skew, exact-boundary instants or timezone mismatches give wrong decisions. |
| `insecure-default` | Missing config, a flag turned off, a dependency down or a half-run migration leaves the system open instead of closed. |

**Where to look.** `status ==` checks without a transition table, balance or stock updates done
as read-then-write without a lock or conditional update, `parseInt`/`float` on amounts, `except:
pass` around a step that should abort the flow, `if not config.get(...)` that skips a check,
`datetime.now()` compared against stored values from another zone.

### Feature abuse and data leakage

Legitimate features used for something they were not meant for. Look at the design, not only the code.

| id | What it is |
|----|------------|
| `export-exfiltration` | A low-privilege user triggers an export, snapshot or backup that holds data above their level: other users, deleted or draft content, revisions meant to be pruned. |
| `import-injection` | Import or restore overwrites existing records, skips normal validation, or writes into collections the user cannot write through the UI. |
| `search-oracle` | Search, filters or sort order reveal the existence or value of hidden records, statuses, roles or fields. |
| `enumeration-side-channel` | Different errors, status codes, sizes or timings separate "does not exist" from "no access", or reset/invite/signup flows list accounts. |
| `preview-leakage` | Preview tokens unlock more than one item; drafts surface through search, RSS, sitemaps or list APIs; cache headers let a CDN serve private content publicly. |

Callback and webhook URLs fetched by the server use `ssrf`.

**Only a note.** Enumeration of identities that are already public (usernames shown on profiles).

### Chained vulnerabilities and trust boundaries

Two behaviours that are each fine can combine into a break when a later step relies on a stronger
guarantee than an earlier step gives.

| id | What it is |
|----|------------|
| `multi-step-chain` | Low-privilege reads, writes, calls and retained data connect into a later trust decision. Confirm each link; never assume a downstream effect. |
| `cross-component-trust-gap` | Component A validates and hands to B, but B assumes more than A guarantees: truncation, type coercion, normalisation, tenant scope, plugin access. |
| `capability-growth` | What an OAuth grant, API key, token, plugin, MCP server or AI agent may do grows once it is delegated, refreshed, cached, combined with something else, or its role changes. State the precise operation the widened principal should not be able to perform. |
| `ordering-window` | Setup, migration, soft delete, revoke-vs-cache expiry, check-vs-use or validate-vs-consume windows accept stale state. Confirm the stale state is actually accepted. |
| `rollback-restore-bypass` | Undelete, restore, revision rollback or cancel brings back an invalid state without re-applying current ownership, validation and authorisation. |

(`second-order-injection` above is the data-flow member of this family.)

### Wildcard

| id | What it is |
|----|------------|
| `wildcard` | A real boundary break that fits no other id. Same proof bar as every other class. |

Prompts for the wildcard pass: the strangest code in the repo and why it exists; half-built,
experimental or bolted-on features; API calls the frontend never makes; routes, params, headers
or flags missing from the docs; features that were never designed to meet (localisation + preview
+ cache, import + plugins + webhooks, OAuth + impersonation + API keys); reverted security fixes,
commented-out checks and removed secrets in git history; actions by a valid account that hurt
others, shared integrity, availability or the operator's bill; irreversible operations and
whether approval binds to the final principal, action and resource; environment assumptions
(local database, honest clock, trustworthy DNS, case-sensitive filesystem); edge cases the tests
skip. Read anything named `temp`, `hack` or `legacy`. If a comment claims something is safe,
verify the claim.

### Obvious exposures

A literal checklist. Every item gets a result, even "clean". A matching pattern is a lead, not a
finding: trace the impact first (is that cookie actually sensitive, does JS need to read it, is
that error field ever filled with private data).

| id | Check |
|----|-------|
| `hardcoded-secret` | Grep `password`, `secret`, `apikey`, `api_key`, `token`, `Bearer `, `-----BEGIN`, common default passwords. |
| `security-todo` | `TODO`/`FIXME`/`HACK`/`XXX` that mention auth, validation, permissions or "skip check". Report only when the gap is real in shipped code. |
| `debug-mode-exposure` | Debug or dev mode switchable in production by env var, query param or header. |
| `default-credentials` | Seed, demo, test or example accounts that still work in production. |
| `exposed-admin-endpoint` | Unprotected `/debug`, `/admin`, `/test`, `/status`, `/metrics`, `/env`, `/.env`, `/config`, actuator-style routes. Health checks that return only "ok" are notes. |
| `committed-secret-file` | `.env`, `.env.local`, `credentials.json`, `*.pem`, `*.key`, `id_rsa`, keystores in the repo or its history. |
| `gitignore-gap` | `.gitignore` misses secrets, uploads or local config that the code writes. Note unless a secret actually landed. |
| `vulnerable-dependency` | Unpinned ranges or lockfile versions with known CVEs. A finding only if the vulnerable path is reachable from the target. |
| `dynamic-code-execution` | `eval`, `exec`, `Function`, `vm.runInContext`, `child_process`, dynamic `import()` fed by non-constant input. |
| `credentialed-cors` | `Access-Control-Allow-Origin` reflected or `*` together with credentials. Details in `client-side.md`. |
| `cookie-scope-transport` | Session cookies missing `HttpOnly`, `Secure`, `SameSite` or with a broad `Domain`. Details in `web-and-auth.md`. |
| `open-redirect` | Params named `redirect`, `return`, `returnTo`, `next`, `url`, `goto`, `continue`, `callback` feeding a redirect without an allowlist. |
| `missing-tls` | Plain HTTP endpoints, TLS verification turned off (`verify=False`, `rejectUnauthorized: false`, `InsecureSkipVerify`). |
| `verbose-errors` | Production responses carrying stack traces, internal paths, SQL errors or config values. |

## Proof shape for every class

Before a candidate leaves the hunt, it must name: the attacker principal, the boundary it crosses,
the source and the sink (or the missing check), and the observed result from source reading or a
bounded local fixture. When a deployment, provider, identity or runtime fact cannot be seen
locally, the verdict is `needs_validation` and the finding states the missing fact plus the safe
check (owner-observed or local) that would settle it. The full rules are in
[`../verification.md`](../verification.md).
