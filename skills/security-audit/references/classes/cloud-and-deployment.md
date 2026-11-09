# Cloud and deployment classes

Load when: the repo describes how software runs: cloud IAM, infrastructure as code, containers,
Kubernetes, a service mesh, serverless or edge functions, ingress, buckets, managed services or
config that differs per environment. Verdict rules: [`../verification.md`](../verification.md).

The question: once deployed, does each component end up with the identity, network reach,
isolation, secrets and policy its authors meant it to have? Repository files usually describe
intent, not the running state, so keep defects you can confirm from source apart from facts only
the owner can observe. Build and promotion trust lives in `supply-chain.md`; proxy semantics in
`web-and-auth.md`; tenant scoping of data stores in `data-isolation.md`.

## Ground rules

- **A manifest is not proof of live exposure.** Work out which environment uses it, which overlays
  and defaults alter it, and whether the path is active at all.
- **Tie every identity to what it can do.** For each workload identity, list operations and
  resources. A wide policy only becomes a finding when input from a less-trusted party can aim it
  at an action that party should not get.
- **A control counts only when you can see it wired in.** Ingress, sidecars, admission webhooks,
  metadata endpoints and proxies are real boundaries if their configuration and attachment are in
  view.
- **Referencing a secret is not leaking it.** A leak needs someone with less trust who can read it:
  through a log, an output, an artifact, a shared volume, or a fallback that exposes it.
- **Defaults depend on version.** Look up the behaviour of the provider and orchestrator at the
  version pinned in the repo. Do not assume a public IP, an open firewall, a reachable metadata
  endpoint or an absent admission hook.
- Local validation is limited to rendering (`helm template`, `kustomize build`, `terraform plan`
  against stub providers), policy evaluation, inspecting namespaces inside a throwaway fixture, or
  an emulator with fake identities. No probing of live endpoints, no changes to shared cloud
  resources.

## Workload identity and IAM

### `workload-identity-overreach`

The identity attached to a pod, function, edge worker, VM or node reaches accounts, tenants, APIs
or resources outside its job, and something in an untrusted request or job chooses which one.
Look at: IAM statements with `*` in resource or action, missing conditions, service-account
annotations, the mapping from namespace to cloud role, and fallbacks to node or default
credentials when the intended identity is missing.

### `cross-account-role-confusion`

Assume-role, token exchange, workload federation, external ids or resource policies trust a claim
without pinning it to the expected source account, repository, namespace, workload or audience.
Look at: trust policies with wildcard principals or subjects (`repo:org/*`), no
`sts:ExternalId`, OIDC federation with no `sub` or `aud` condition. Show both sides: the trust
policy and the claim the caller can shape.

### `metadata-trusted-as-authz`

The application believes identity data it receives (headers, tags, labels, account ids, object
metadata) without checking that the control plane or a trusted proxy produced it. Look at
handlers that read an identity header or an object tag and act on it. Cloud IAM and the app's own
authorisation are separate checks; passing one does not imply the other.

## Network, ingress and control plane

### `management-plane-exposure`

Something exposes an internal surface (admin or debug routes, metrics, node or control-plane APIs,
internal services) to a network with less trust. Usual carriers: ingress rules, `type:
LoadBalancer` or `NodePort`, security groups open to `0.0.0.0/0`, load-balancer annotations,
compose `ports:`, a server bound to `0.0.0.0`. A public route defined in the repo that lands on a
sensitive handler can be `confirmed`. "No network policy is visible" alone is `needs_validation`.

### `proxy-mesh-bypass`

The backend trusts forwarded identity, an mTLS subject or auth metadata from peers that did not
come through the intended ingress or sidecar, or a spare port, health route or legacy path goes
around the mesh. Check whether ingress strips those headers, who can reach the pod directly, and
whether the app fails open when the sidecar is absent.

### `metadata-service-reachability`

User-chosen URLs, hosts or protocols get to the instance or container metadata endpoint, a
control-plane socket or an internal API that carries the workload's credentials. Trace parsing and
redirects with core `ssrf`. In this file, settle the deployment facts: network path, metadata
version (IMDSv1 or v2, hop limit), and which identity answers.

## Containers and orchestration

### `container-escape-config`

A workload with less trust can request settings that hand it node or control-plane power:
`privileged: true`, extra capabilities, `hostPID`/`hostNetwork`/`hostIPC`, `hostPath` volumes,
devices, the Docker or containerd socket, an auto-mounted service-account token. A missing seccomp
profile or writable root filesystem is hardening only, unless a reachable operation actually
crosses the boundary.

### `admission-path-gap`

Policy on image identity, namespaces, resources, secrets or privilege is enforced on the main
deploy route, but another route skips it: a second controller, a job, an upgrade, a restore, a
compatibility path. Show that alternate route and the object it really creates.

### `label-trust-confusion`

Network policy, admission, secret access or workload identity is granted by matching labels,
annotations, names or namespaces, and someone with less trust can set those values. Put side by
side who writes the selector and what a match unlocks.

## Configuration and secrets over time

### `config-precedence-drift`

An overlay, chart default, environment variable, CLI flag, feature gate, injected sidecar or
regional setting turns off authentication, TLS, tenant scoping or auditing in a real environment.
Render the final config for every environment that is maintained, not only the base. Search for
`AUTH_DISABLED`, `insecure: true`, `tls: false`, `skipVerify`.

### `workload-secret-exposure`

A secret ends up somewhere another workload or tenant can read: process arguments, crash dumps,
logs, environment shared across containers, a widely mounted volume, build output, service
discovery, a read API. Confirm what the secret is and what it unlocks. An endpoint URL or a key identifier grants nothing on its own.

### `credential-renewal-fallback`

When mounting, refreshing, rotating or revoking a workload credential fails, the old credential
keeps working, or the app falls back to a weaker identity mode. Check startup, readiness probes,
reconnect logic and long-lived cached clients.

## Managed storage, events and edge

### `bucket-signed-url-policy`

Bucket or container policies, object key layout, CDN origins or presigned URLs do not pin who may
act, which operation, which key prefix, for which audience and until when. Look at public-read
ACLs, presigned URLs with long lifetimes or wildcard keys, listing and versioning operations, and
uploads, not just downloads.

### `event-source-spoofing`

A function or queue worker takes the sender's identity from fields in the event body instead of
verifying the provider's signed envelope, topic or subscription, account, region and replay
protection. Compare the push path with pull, retry and dead-letter handling.

### `edge-origin-mismatch`

Code at the edge or in a serverless runtime relies on secrets, APIs, a filesystem, isolation or a
tenant policy that differ from the origin runtime, and falling back to origin changes authority or
caching. Find the setting that decides which path runs.

## Moves that work across this file

- Render all maintained environments into one matrix: exposed ports, workload identity, network
  peers, mounted secrets, cloud resources touched. Each difference needs a policy reason or an
  owner.
- Pick a request, object, label or event from a less-trusted source and follow it into cloud
  policy. End at the credential that performs the final call and the condition that should have
  narrowed it.
- Compare the normal deploy with restore, migration, failover, node maintenance and local or
  emulator setups. Ask what happens when the mesh, admission, identity provider, secret store or
  policy engine is down.

## Proof checklist

1. Show which source path is active and what object is effectively deployed. When you cannot, the
   verdict is `needs_validation` and names the rendered manifest or attachment the owner must look
   at.
2. Name the less-trusted caller or workload, the identity used, the selector it influences, the
   resource hit and the operation or disclosure it should not have.
3. `confirmed` needs a full trace through active source and a concrete result at the boundary.
   Anything else is `needs_validation` with the exact missing fact (deployed policy, attached
   identity, overlay, network path or drift). See [`../verification.md`](../verification.md).
