# Isolated execution

When and how target code may run during an audit, how anything it produced becomes evidence, and the hard line around live systems. If isolation cannot be guaranteed, nothing runs.

## Default: read, don't run

Reading source settles most questions. Run target code only when a small isolated check settles a claim that reading cannot, and stop at the minimum effect that proves it.

"Target code" means anything the audited repo controls: builds, tests, scripts, package lifecycle hooks, binaries, browsers or emulators loading its pages, fuzzers, parsers fed its fixtures, its Makefile, its Dockerfile.

## The five conditions

Target code runs only when the operating system enforces **all five** for that process and its children:

| # | Condition | Concretely |
|---|---|---|
| 1 | **No network** | No external network at all. A loopback inside an isolated network namespace is allowed only when the check needs a local client and server it started itself |
| 2 | **Empty environment** | Start from nothing; add only an explicit allowlist with safe dummy values. `HOME`, temp dirs and caches point inside the agent's scratch. No credentials, tokens, SSH agent, cloud profiles, inherited variables |
| 3 | **Read-only target** | The target tree and toolchain are mounted or exposed read-only. If a build must write next to source, the agent (not the target process) first makes a disposable copy inside its scratch and runs there |
| 4 | **Writes only to scratch** | The process can write only under `<audit-dir>/scratch/<agent-id>/`. Never the audit directory's other files, `evidence/`, another agent's scratch, the host home, `/tmp`, sockets, or shared services |
| 5 | **Resource limits** | Explicit low caps on CPU time, memory, process count, file size, disk usage and wall-clock time, on every run, not only the ones expected to be heavy |

Also: never install dependencies or let the build fetch them. Use only tools and packages already on the machine. Use dummy principals, fixtures and secrets.

### When isolation is not available

If any one of the five cannot be enforced (no sandbox tool, no network namespace, no way to drop the environment), **nothing runs**. The candidate stays `needs_validation`, and `missing_evidence` says exactly:

- which condition could not be enforced, and
- how to validate safely: the command, the fixture, the expected observation, and the isolation it needs (for example: "run `npm test -- authz.spec.ts -t 'tenant B'` in a container with `--network none`, read-only bind of the repo, empty env, 512 MB, 60 s; expect 403, a 200 confirms the finding").

A missing sandbox never erases a source-grounded candidate. It only changes its verdict.

Recon role R4 ([reconnaissance](reconnaissance.md)) reports up front which conditions this machine can enforce, so hunters know before they try.

### Allowed and forbidden inside isolation

- **Allowed**: offline builds with dependencies already present; unit and integration tests; minimal function harnesses; small fixture processing; sanitizers; short bounded fuzz or regression runs; deterministic concurrency schedules; local browser or emulator tests with dummy accounts; rendering manifests and evaluating policies with dummy identities; external or paid calls replaced by mocks.
- **Forbidden**: anything that leaves the machine; services not started for this check; installing from the network; real accounts, credentials or data; publishing anything; CI runners, package registries, signing or release services; shared queues or cloud resources; load, saturation or anything that costs money; any step after the minimum boundary result is observed. No persistence, no concealment, nothing that only matters after the fault.

## Recording a run

For each isolated check, record: the command, the exact input, the limits applied, and only the allowlisted environment variable names with their safe values. Launch from an empty environment instead of trying to scrub one afterwards. Leave out credential values, inherited variables, auth state, the host's ambient environment and any host path the check does not need.

## Promoting artifacts

Everything in scratch is attacker-controlled once the target ran: the target could have planted links, special files, giant files, or files that change while being read. Only the coordinator promotes, only after the sandboxed process and all its children have exited, and only files the hunter declared in advance.

Before the run, the coordinator records for that agent: the list of expected scratch-relative file names, a per-file size cap (default 1 MiB) and a total cap (default 8 MiB).

After the run, for each declared file:

1. **Path**: relative, non-empty, no `.` or `..` components, no absolute path. Resolve it inside scratch without following links at any component; a symlinked component rejects it.
2. **Type**: a regular file, link count exactly one. Reject symlinks, hard links, directories, FIFOs, sockets, devices.
3. **Size**: within the per-file cap and the remaining total cap, checked before reading and enforced again while reading.
4. **Stable**: identity, type, link count and size are the same after reading as before. Anything that changed is rejected.
5. **Copy, never move**: copy exactly the verified bytes to `<audit-dir>/evidence/<agent-id>/<name>`, creating the destination exclusively (fail if it exists) and without following links. Directories along the way must be real directories. Never copy a whole directory, glob scratch, or extract an archive into `evidence/`.
6. **Hash**: compute SHA-256 of the copied bytes and append `{path, sha256, bytes, agent, promoted_at}` to `evidence/manifest.json`.
7. **Scrub**: before or during promotion, check the file for secrets; a visible secret is redacted as in [auditor safety](auditor-safety.md#secrets-found-in-the-target), and the redaction is noted in the manifest.

Use the operating system's no-follow, descriptor-relative calls (or the platform's race-safe equivalents) so nothing is reopened by path between checks. If any step cannot be enforced or fails, discard that file. If it was decisive evidence, the candidate stays `needs_validation` with the exact promotion failure as its missing fact.

`evidence[]` entries in `findings.json` point only at promoted paths (relative to the audit directory). Scratch is never cited, and is deleted when the run ends.

## The source copy must stay untouched

Before the first isolated run, record a fingerprint of the target: the commit, whether the tree is dirty, and a SHA-256 over every tracked and untracked-but-not-ignored file (path plus content hash, sorted). Store it in `ledger.json` → `run.source`.

After each wave that executed anything, and at the end of the run, recompute and compare. Any difference means isolation leaked:

- stop executing target code for the rest of the run;
- record which paths changed in the run summary and `user_actions[]`;
- do not "restore" the owner's tree yourself; tell the owner what changed;
- findings whose evidence came from runs after the last clean comparison are re-verified or demoted to `needs_validation`.

## Live systems: read configuration, never probe

Never exploit, attack, fuzz, scan or load-test a live system, including the owner's own production, staging, preview deployments, APIs, databases, queues, identity providers or CI. Ownership does not change this; the audit is source-first and local.

What is allowed for `platform` surface:

- **Read-only configuration access** the owner set up for this purpose (a read-only token, a viewer role, an exported config). Read settings that decide a boundary: bucket and row policies, CORS, redirect allowlists, auth providers, branch protection, secret scopes, IAM bindings, environment variable *names* (never values). Never write, toggle, rotate or "test" a setting.
- **Harmless external checks** against the public endpoints the owner named: response headers on a normal `GET` of a public page, the TLS certificate and protocol versions offered, and which of a short list of common ports answer. One request each, no payloads, no credentials, no crawling.

Anything else a platform finding needs becomes `needs_validation` with an owner-side step ("open Authentication → URL configuration and check whether `*.vercel.app` is in the redirect allowlist"), or a `user_actions[]` entry.
