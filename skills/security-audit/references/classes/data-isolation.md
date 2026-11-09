# Data isolation and lifecycle

Load when the target holds data split by tenant or behind access control, keeps derived copies (search, index, cache, analytics), hands out links to objects, has export, import or restore, runs schema migrations, or promises deletion, revocation or retention. Endpoint-level access control is a general web class; provider-level storage policy is a cloud class.

The method here: pick one data item and follow it through every copy and every state change. Split large targets: primary store, blob storage, search and cache, logs and analytics, backups and exports, migrations, deletion and revocation.

## Ground rules for this domain

- A `tenant_id` or `owner_id` column is not isolation. For each read and write path, find what actually enforces it: a query predicate, a key prefix, a storage path, a policy, a row-level rule.
- Follow the copies. Primary data that is protected can be exposed in search, cache, analytics, exports, previews, logs, replicas and backups, which often have different ACLs and retention.
- Deletion and revocation are contracts about the whole lifecycle. Look at every copy: the live one, its history, and those sitting in caches, indexes, exports, queues and restored snapshots, as far as the product's promise reaches.
- Wanting more privacy or shorter retention does not make something a vulnerability. You need an explicit access boundary or a deletion/revocation promise, plus an unauthorized reader or a later operation that breaks it.
- Prove with two dummy tenants and non-sensitive fixtures in a local setup ([../isolated-execution.md](../isolated-execution.md)); never real user data. Verdicts follow [../verification.md](../verification.md). If external storage policy, retention, CDN behaviour, replica lag or backup access decides it, the finding is needs-validation.

## Tenant and object isolation

### `missing-tenant-scope`

**What.** A query (single read, list, count, update, delete, bulk operation) picks an object without tying it to the authenticated tenant or owner, or takes that identity from the request body.

**Where to look.** `findById(id)` with no tenant filter, `WHERE id = ?` without `AND tenant_id = ?`, `tenantId` read from the body, nested routes (`/orgs/:a/projects/:b`) that check `a` but load `b` globally. Compare direct lookup, nested relations, background jobs, admin tools, importers and legacy endpoints.

**How to prove.** Tenant A reads or changes tenant B's dummy record through the same local service method.

### `key-namespace-collision`

**What.** Cache keys, object paths, unique constraints, search document IDs, temp file names or dedup keys leave out the tenant or environment, so two principals hit the same logical key even though their records have separate owners.

**Where to look.** `cache.get("user:" + email)`, `s3://bucket/uploads/{filename}`, `UNIQUE(slug)` without tenant, `/tmp/{name}`, idempotency keys without a tenant prefix, shared caches across staging and production.

**How to prove.** Two dummy principals overwrite or read each other's entry through the colliding key.

### `policy-query-divergence`

**What.** Row-level security, ORM default scopes, authorization filters and raw or bypass clients apply different predicates.

**Where to look.** Joins and aggregates that skip the scope, aliases and views, transactions run as a service role, `unscoped()` / `withoutGlobalScopes` / admin clients, error paths where the tenant context is missing and the filter becomes empty.

**How to prove.** Cite the intended policy and the path that disagrees; show the cross-tenant row coming back locally.

### `signed-reference-overreach`

**What.** Object keys, attachment IDs, version IDs, share links or signed URLs allow operations or namespaces beyond what the issuer could do, or stay valid after the underlying ACL changes.

**Where to look.** Presigned URLs signed for a prefix rather than one key, write permission when read was intended, missing version binding, long expiry, links not revoked on ACL change, attachment IDs guessable across tenants.

**How to prove.** A local signed reference used for a different object, operation or tenant, or after access was removed. Each reference should bind operation, exact object and version, audience, expiry and tenant.

## Derived copies and disclosure

### `derived-copy-acl-drift`

**What.** The primary record's ACL or lifecycle changes, but a searchable, cached, embedded (vector), thumbnail, feed, preview or index copy is not invalidated.

**Where to look.** Search indexes filtered only at ingestion, vector stores without per-query ACL filters, CDN-cached previews, RSS feeds, materialized views.

**How to prove.** Change the ACL or delete the record locally, then retrieve it through the derived copy. Filtering has to happen at retrieval, not only at ingestion and invalidation.

### `secondary-sink-disclosure`

**What.** Private content or credentials are written into analytics, logs, traces or diagnostics that have wider access, longer retention or mixed tenants.

**Where to look.** Request/response body logging, exception reports with payloads, tracing span attributes, analytics events with free text, support dashboards.

**How to prove.** Name the data class and a realistic reader who should not see it.

**Only a note.** Field names, public identifiers, or content visible only to operators under the intended policy.

### `existence-oracle`

**What.** Counts, filters, sort order, error messages, unique-constraint errors, timing, notification behaviour or existence checks reveal state of protected objects or accounts.

**Where to look.** "Email already registered", different 403 vs 404, filter counts over hidden records, sorting by a hidden field, search result totals.

**How to prove.** A concrete confidential predicate and an observable difference that answers it.

**Only a note.** General response variance with no confidential predicate behind it.

## Export, backup, restore and migration

### `export-scope-expansion`

**What.** The produced artifact (a report, a backup, a snapshot, a data-portability bundle, an export) carries other tenants, fields the requester cannot see, soft-deleted rows, secrets, or history above the requester's access.

**Where to look.** Export jobs that select by tenant but skip per-field or per-item authorization, report builders using a service role, download links for the finished file without their own check.

**How to prove.** A local export for dummy tenant A that contains B's data or hidden fields. Two checks are needed: each item is authorized after the selection query, and fetching the finished file is authorized on its own.

### `import-restore-authority`

**What.** Restore or import skips the usual checks (ownership, ACL, schema, validation, uniqueness), replaces resources that already exist, or creates records inside a tenant the requester has no write access to.

**Where to look.** Importers that trust `id`, `owner_id` or `tenant_id` from the archive; restore endpoints that upsert by ID.

**How to prove.** A crafted local archive that lands records in or over another tenant. Archive content is untrusted input; authorize the resulting operation, not the archive's claimed origin.

### `migration-default-confusion`

**What.** Old records have no tenant, ACL or lifecycle field, IDs from two systems collide, or during a partial rollout new and old readers apply different defaults.

**Where to look.** Backfills that leave `NULL` tenant (and code that treats `NULL` as "visible to all"), dual-read/dual-write phases, rollback paths, migrations resumed after failure.

**How to prove.** A local migration fixture where a legacy row becomes visible or writable across the boundary.

### `backup-replica-scope-drift`

**What.** Encryption keys, storage accounts, cross-region replicas, restore environments or support snapshots have a wider identity or tenant scope than the primary data.

**Where to look.** Infrastructure code for replica and backup buckets, key policies, snapshot sharing settings, restore environments with broad access.

**How to prove.** Source can only confirm policy that lives in the repo. Hosted access and retention are needs-validation, with the exact check for the owner.

## Deletion, revocation and lifecycle

### `soft-delete-bypass`

**What.** Direct lookup, search, relation traversal, object links, background processors or restore ignore the deleted/revoked flag and return or act on the record.

**Where to look.** Queries missing `deleted_at IS NULL`, relation loaders that skip default scopes, jobs that load by ID. Also: can a soft-deleted identifier (username, slug, email) be registered again while old references still point to it?

**How to prove.** Delete a dummy record locally and reach it through the bypassing path.

### `stale-authorization`

**What.** Someone loses access (removed from a group, ACL tightened, consent withdrawn, role lowered, secret revoked), but sessions, caches, subscriptions, queued jobs or materialized data keep authorizing what happens next.

**Where to look.** Roles cached in sessions or tokens, permission caches without invalidation, websocket subscriptions opened before removal, scheduled jobs that captured the old principal.

**How to prove.** Revoke locally, then perform an operation that should now fail and succeeds.

### `retention-overrun`

**What.** Deletion finishes in the primary store, but jobs already queued, retries, exports, analytics pipelines or generated files bring the data back or keep it beyond what was promised.

**Where to look.** Jobs enqueued before deletion that write back, retry queues, derived files, analytics pipelines. Look for idempotent deletion and tombstone propagation.

**How to prove.** Delete while a local job is queued and show the data reappearing or surviving.

**Only a note.** Retention longer than you would like but within what the product states.

### `restore-reintroduces-state`

**What.** Backup restore, undo, undelete or replica recovery brings back rows, memberships, credentials or permissions that today's policy forbids.

**Where to look.** Restore code that writes snapshot rows as-is, undelete that restores old memberships, recovered replicas that resurrect revoked keys.

**How to prove.** Revoke, then restore a local snapshot from before the revocation, and show the revoked access back. Restored state must be re-authorized and later lifecycle changes reapplied.

## Moves that apply to every class above

- Pick one protected record and draw its write, query, cache, index, event, export, backup, delete and restore paths. Mark the principal and the tenant on every edge.
- Call the same local service methods as each of two dummy tenants. Repeat after an ACL change, a deletion, an account switch and a restore.
- Start with bypass clients, background jobs, migrations, global unique constraints and cache keys. Those paths usually lack the request-scoped identity that interactive endpoints carry.

## Checklist before reporting

1. The attacker or lower-trust principal, the protected data or state, the affected owner or tenant, the alternate copy or operation, and the unauthorized disclosure or change.
2. The policy meant to be the source of truth is cited next to the code path that skips or contradicts it, and no other layer enforces the same tenant or lifecycle condition.
3. Proof uses local dummy tenants and non-sensitive fixtures and stops as soon as one record or one operation shows the break.
4. When the answer depends on something outside the repo (retention or backup settings, a replica, analytics, the object store, a cache), needs-validation, with the owner-side check stated.
5. Confirmed needs the complete lineage and a concrete boundary impact. Otherwise needs-validation, naming the exact storage, ACL, invalidation, retention or restore fact.
