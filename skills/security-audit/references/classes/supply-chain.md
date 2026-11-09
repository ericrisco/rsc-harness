# Supply chain and release classes

Load when: the repo pulls dependencies, accepts outside contributions into builds, runs CI,
produces, signs or promotes release artifacts, ships updates to installed software, or loads
plugins and extensions. Verdict rules: [`../verification.md`](../verification.md).

The question: between the source a maintainer reviewed and the thing a user finally runs, where can
someone with less trust swap, add or steer content? Bugs inside a local binary loader go to
`memory-and-binary.md`; runtime authority of deployed workloads goes to `cloud-and-deployment.md`.

For a large target, hunt in five passes: how dependencies resolve, how CI jobs are isolated, how
artifacts keep their identity, who may release, and how updaters and plugins are trusted.

## Ground rules

- **"Old or unpinned package" is a lead, not a finding.** Say who can steer which version gets
  picked, which build uses it, and what execution or release boundary that opens.
- **Integrity is a chain.** Source identity, then resolved inputs, then the build machine, then the
  artifact digest, then test evidence, then signature or attestation, then promotion, then the
  client that installs it. One weak link breaks it.
- **Treat CI files as authorisation code.** Per workflow: what triggers it, whose code executes,
  which secrets and tokens it holds, what it can publish or modify.
- **A hash served next to the artifact it describes adds no trust.** Find the independent root of
  trust and what the code does when verification fails.
- Control-flow failures visible in the repo, checked with a bounded local fixture, can be
  `confirmed`. Branch protection, hosted runner setup, registry settings, signing services and
  production promotion are usually not visible: `needs_validation`.
- Validate with a throwaway fixture repo, a fake credential marker, a local registry or config and a
  namespace nobody ships from. Never publish to, or modify, a real release.

## Dependencies and build inputs

### `dependency-confusion`

The resolver can be led to a different namespace, registry, mirror, repo or source URL than the
one intended (public instead of private, fallback instead of primary). Look at: internal packages
with unscoped names, registry order in `.npmrc`, `pip.conf` or `settings.xml`,
`--extra-index-url`, whether lockfiles and checksums are enforced, secondary build files,
platform-specific resolution, and how a fresh install differs from an update.

### `mutable-build-input`

The build consumes something that can change after review: a branch or tag ref, a submodule not
pinned to a commit, a tool downloaded at build time, `curl | sh`, a remote include, a CI action
referenced by tag instead of SHA (`uses: org/action@main`), a base image without a digest
(`:latest`). To be a finding, someone with less trust must be able to change it and the change
must reach trusted output. A reproducible build is not the same as an authentic one.

### `codegen-provenance`

Generated or vendored content ships without the review and integrity checks normal source gets:
code generated from schemas, vendored tarballs, generated API clients, translation files, sample
code in docs, binary blobs. Regenerate locally, diff against the committed copy, and find who
controls the generator and its input.

### `build-context-leak`

The package or image picks up things it should not (secrets, local config, `.git`, test fixtures,
developer leftovers) because the build context and ignore rules cover more than the release needs.
Look at `COPY . .` with a thin `.dockerignore`, the `files` field in `package.json`,
`MANIFEST.in`. Report only when the shipped artifact exposes a working credential, private data or
privileged config.

## CI and automation

### `privileged-workflow-untrusted-code`

Contributor-controlled code (from a fork, a pull request, an issue comment, a bot dependency bump,
an external webhook) runs where protected secrets, write tokens, deploy rights or a trusted runner
are available. Look at `pull_request_target` or `workflow_run` jobs that check out the PR head,
self-hosted runners on public repos, approval gates, environment protection, `permissions:`
blocks. Do not assume host defaults that the source does not state.

### `workflow-injection`

Text an outsider controls (branch or tag name, commit message, issue or PR title and body,
artifact name, matrix entry, output of an earlier step) is spliced into a shell line, an
expression, a path or a privileged input without being canonicalised. Classic sign:
`${{ github.event.* }}` inside `run:`; also untrusted writes to `GITHUB_ENV` or `GITHUB_OUTPUT`.

### `ci-cache-poisoning`

A job with less trust writes to a cache, an uploaded artifact, a shared workspace or a step output,
and a job with more trust later restores it and runs or ships it. Check cache key scopes, who
produced each artifact, whether its digest is pinned, retention, and promotion steps that look
things up by a name that can change.

### `ci-token-overreach`

A job gets more permission than the task needs (wider scope, other repos or environments, longer
lifetime) and untrusted input picks which resource is affected. Typical: default write-all tokens,
long-lived cloud keys stored as secrets instead of short-lived federation. Lack of least privilege
by itself is hardening; a finding needs a privileged action someone can actually reach.

## Release and update

### `artifact-substitution`

Testing, review, signing and publishing each refer to something mutable (a tag, a file name, a
channel, an artifact id) instead of one fixed digest, so what was tested is not provably what
shipped. Inspect every copy, repack, multi-arch manifest merge and provenance step from build to
release.

### `release-signing-policy`

Releases or signatures are accepted even though they come from the wrong repository, workflow,
branch, environment, key role or signer threshold. Read the identity claims inside attestations
and check the consumer enforces them; "the signature verifies" is not enough. Where policy demands
it, expired, rotated or revoked keys must cause rejection.

### `update-rollback`

The updater checks the payload bytes but not the metadata around them: version, product, platform,
channel, install path, expiry, protection against rollback. Or it pairs metadata and payload from
two different signed releases. Also check that install is atomic and recovery is safe. Calling a
signature API without binding it to policy is an incomplete check.

### `plugin-trust-expansion`

A plugin or extension ends up with more host authority than it declared, one publisher can take
over another publisher's identity, or install and update hooks (`postinstall`, activation scripts)
run before authenticity and permissions are checked. Deliberately installing arbitrary plugins for
the same user is not a privilege boundary.

## Moves that work across this file

- Start from a released digest or an installed update and walk backwards to every input behind it:
  sources, generated files, credentials, build machines, caches, test results, approvals.
- Lay untrusted and protected workflow triggers next to each other. Mark every persisted channel
  between them (cache, artifact, output, workspace) and demand a fixed identity and a trusted
  producer for each.
- Exercise failure: a revoked key, a broken download, a missing attestation, a release that only
  exists for some platforms, a rollback, the registry being down. How the system fails is part of
  release integrity.

## Proof checklist

1. Name the actor with less trust, the thing they control (source, cache, artifact, metadata), the
   trusted job or updater that consumes it, and the outcome: something published without
   authorisation, code added to the product, a secret disclosed or privileged execution.
2. Show where artifact identity breaks: a mutable name or an unpinned digest that a real consumer
   then uses.
3. Look up the defaults of the package manager, code host, registry and signing tool at the pinned
   versions. Hosted controls you cannot see mean `needs_validation`.
4. `confirmed` only with the whole handoff visible in source and a meaningful result. Otherwise
   `needs_validation`, naming the branch, runner, registry, signing or deployment fact the owner
   must check. See [`../verification.md`](../verification.md).
