# Protocols, RPC and messaging

Load when the target speaks gRPC, GraphQL over a non-HTTP transport, Cap'n Proto, Thrift, Protobuf, a custom binary protocol, streaming RPC, webhooks, or uses brokers, queues, pub/sub or an event bus. Parser memory safety belongs in [memory-and-binary.md](memory-and-binary.md); availability impact belongs in [resource-exhaustion.md](resource-exhaustion.md).

This file covers who the peer is, how a message is interpreted, where it is routed, and what happens on replay, reordering and redelivery. Split large systems by producer/consumer pair, by internal vs external peer, and by sync RPC vs stream vs async message.

## Ground rules for this domain

- A service being "internal" authenticates nobody. At every hop, name the peer identity and show how it turns into the application principal that authorization uses.
- A schema check proves the message has the right shape. It says nothing about where it came from, what the sender may touch, its order, or whether its values are safe. Follow the decoded fields all the way to policy and side effects.
- What the broker guarantees and what the application assumes are different things. Write down retry, ordering, ack, dedup and transaction behaviour before judging any state change.
- A parser-disagreement claim needs two concrete consumers (or schema versions, or wire forms) and one security-relevant value they decode differently.
- Prove with bounded local producer/consumer tests or an in-memory transport ([../isolated-execution.md](../isolated-execution.md)), never against a live broker. Verdicts follow [../verification.md](../verification.md); broker ACLs, mesh identity, topic wiring or compatibility settings outside the repo leave a finding at needs-validation.

## Framing and interpretation

### `message-canonicalization-mismatch`

**What.** Two components read the same bytes differently. Typical disagreements: framing length, compression, repeated fields, fields the schema does not know, text encoding, normalization, integer width, and whether the envelope or the body wins.

**Where to look.** Generated parser vs a hand-written one, gateway vs backend, two language bindings, version converters. Protobuf last-field-wins vs JSON first-wins, int64 read as float in JavaScript, duplicate map keys.

**How to prove.** Cite both decoders, feed one fixture to both, and show a different principal, resource or operation after decoding. If either side rejects the message cleanly, it is not confirmed.

### `variant-default-confusion`

**What.** Unknown enum values, a missing discriminator, zero values, privileges granted by default or legacy compatibility mappings flow into code that believes the case was already validated.

**Where to look.** `switch` with a permissive `default`, proto3 zero values meaning "admin" or "all", old consumers reading a newly added field as absent, `oneof` with no case set.

**How to prove.** A message with the unknown or zero variant, and the privileged branch it lands in.

**Only a note.** An unknown variant that falls through to a safe rejection.

### `envelope-body-identity-mismatch`

**What.** Authorization reads trusted-looking routing or envelope metadata, but the handler acts on a different tenant, account, subject, object or sender taken from the body.

**Where to look.** Headers/metadata checked by middleware, then `req.body.tenantId` used by the handler. Decide which source is authoritative and whether the client can override it.

**How to prove.** One message where envelope and body name different principals, and the side effect landing on the body's one.

## RPC identity and authorization

### `interceptor-coverage-gap`

**What.** An authn/authz interceptor guards unary calls but not streams, server reflection, health checks, gateway-transcoded routes, legacy service names or individual stream messages.

**Where to look.** Every server registration: `UnaryInterceptor` vs `StreamInterceptor`, reflection service enabled in production, REST gateway routes, duplicated services under an old package name. Map each route to the operation it reaches.

**How to prove.** The same operation reached through the unguarded route without credentials, in a local server.

### `channel-principal-confusion`

**What.** mTLS, workload identity, bearer metadata, a forwarded identity header or broker credentials authenticate the channel, but a caller-supplied field picks the user or tenant.

**Where to look.** `x-user-id`, `on_behalf_of`, `tenant` fields read after peer authentication without a policy that ties the peer to that principal.

**How to prove.** A peer authenticated as A that acts as B by setting the field. The fix is a deterministic binding between channel identity and claimed principal.

### `stream-item-authz-gap`

**What.** A stream, subscription, batch or bulk request is authorized once; later items name other resources, or the stream keeps running after role change, membership removal or token revocation.

**Where to look.** Authorization at stream open only, batch handlers checking the first item, long-lived subscriptions with no re-check.

**How to prove.** A local stream where a later item touches an unauthorized resource, or delivery continues after revocation.

### `reply-correlation-confusion`

**What.** Correlation IDs that are guessable, reused or shared across tenants let one caller's response, webhook, ack or cancel complete someone else's pending operation.

**Where to look.** Sequential request IDs, reply-to queues shared across tenants, webhook callbacks matched only by an ID, cancellation by ID without owner check.

**How to prove.** Two local callers; one satisfies or cancels the other's pending request. Bind every pending request to its peer, its tenant, its operation and its lifecycle.

## Broker and queue isolation

### `topic-scope-gap`

**What.** A publisher or subscriber can pick a channel that belongs to another tenant: a topic, a partition, a wildcard pattern, a reply queue, a consumer group or a dead-letter route.

**Where to look.** Topic names built from request input, `#` / `*` / `>` wildcards allowed to clients, consumer group IDs chosen by the client. Check broker ACLs when they are in the repo, and how the app builds namespaces. A tenant name inside the payload isolates nothing.

**How to prove.** A local broker where tenant A's client receives or publishes on tenant B's channel. ACLs not visible in the repo: needs-validation.

### `dead-letter-disclosure`

**What.** Messages sent to dead-letter queues, error topics, traces or operator consoles carry secrets or other tenants' payloads to a lower-trust reader.

**Where to look.** The failure path: what gets copied into the DLQ, error event or span, who can read it, and whether redaction happens there and not only on normal delivery.

**How to prove.** A failing local message whose sensitive content lands where a lower-trust consumer reads it.

**Only a note.** Operator-only diagnostics under an intended access policy.

### `unauthenticated-control-message`

**What.** A message body can claim to be an admin event, a provider callback, a replication record or a migration instruction, and is handled as such even though nobody authenticated the producer or the event type separately from the body.

**Where to look.** Handlers switching on `body.type == "admin"`, webhooks without signature checks, signature checks that do not bind source, account and audience.

**How to prove.** An ordinary producer publishes a forged control message and the privileged handler runs, locally.

## Replay, ordering and transactions

### `duplicate-delivery-side-effect`

**What.** A retry or redelivery repeats a side effect because dedup is missing, happens after the mutation, or uses a dedup key that two tenants or two operations can share.

**Where to look.** At-least-once consumers that charge, credit, grant or send; idempotency keys without tenant prefix; dedup written after the side effect.

**How to prove.** Establish the actual delivery model, then deliver the same message twice in-memory and show the non-idempotent effect twice.

### `stale-message-acceptance`

**What.** An older state, a revoked membership, a cancelled job or a pre-step-up authorization arrives after a newer one and overwrites it.

**Where to look.** Missing sequence/version checks, tombstones that are not honoured, partition rebalancing, replay and restore workflows.

**How to prove.** Reorder two messages locally and show the stale one winning.

### `ack-commit-ordering`

**What.** The ack goes out before the durable commit, so security-relevant work is lost; or the commit happens before an ack that can fail, so a mutation is duplicated.

**Where to look.** Manual ack placement, auto-ack consumers, missing transactional outbox/inbox, crash-recovery behaviour.

**How to prove.** Inject a failure between ack and commit in a local test and show the lost or duplicated security effect.

### `partial-multi-consumer-transition`

**What.** Several consumers together carry one authorization or business transition; retries and partial failure leave only some of them committed.

**Where to look.** Sagas without compensation, grant-then-notify chains, revocation fanned out to several services.

**How to prove.** Fail one consumer locally and show the inconsistent end state (for example, access granted but not recorded, or revoked in one service only). Name the invariant that must become atomic or be compensated under current authorization.

## Moves that apply to every class above

- For each message family, draw producer → transport/broker → gateway → consumer → storage. At each hop record the authenticated peer, the authoritative tenant/resource fields, validation, and the side effect.
- Feed one small fixture to every schema version and language binding in the repo. Try messages that are replayed, reordered, duplicated, missing a field, carrying unknown fields, or sitting at a boundary value. Never generate load.
- Check that the policy still holds on every alternative route: retries, the DLQ, replays, migrations, stream methods, reflection, and routes a gateway transcodes. Changing transport must not drop the check.

## Checklist before reporting

1. A realistic producer or peer, the accepted message, the authenticated channel identity, the affected principal or resource, and the unauthorized mutation or disclosure.
2. Disagreement claims: both parsers or consumers cited, and the diverging decoded value. A safe rejection on either side means not confirmed.
3. Replay/order claims: real delivery guarantees established and the broken invariant reproduced on a bounded local or in-memory transport.
4. Authorization and isolation: every interceptor, broker ACL, gateway and consumer layer visible in source checked. Anything attached outside the repo makes it needs-validation.
5. Confirmed needs the full message lifecycle and an observed meaningful result. Otherwise needs-validation, naming the single delivery, route, service-identity or broker fact still to check.
