# Security policy

## Reporting a vulnerability

Use GitHub's private reporting, which is enabled on this repository:

**[Report a vulnerability](https://github.com/ericrisco/rsc-harness/security/advisories/new)** — or
Security → Advisories → Report a vulnerability.

That channel is private between you and the maintainer. Please use it instead of a public issue for
anything you think is exploitable. If you are not sure whether something qualifies, use it anyway;
a false alarm costs nothing and a public zero-day costs everyone.

A useful report says what you did, what happened, and what you expected. A reproduction beats a
description. You do not need a proof of concept, a CVSS score or a suggested patch.

**What to expect:** a first reply within a few days, and the fix released as a normal patch version
once it exists. This is a solo, unfunded project, so there is no bug bounty and no SLA. What there
is: your finding gets credited in the advisory and in the release notes unless you would rather it
did not.

## What rsc is, so scope is not a guess

rsc is a local command-line tool. It installs skill content into an AI assistant's directories,
writes hooks that the assistant then runs on your machine, and keeps session records under `.rsc/`.
It has no server, no accounts and no network service. So the interesting attack surface is the
places where **someone else's input reaches your machine or your assistant**:

- **`.rsc.json`** travels through git, so its contents are written by anyone who can open a pull
  request, and parts of it are read back into the model's context. Anything that escapes its
  validation and lands in that text is worth reporting.
- **Hooks** are wired into your assistant's settings and run commands. A path that lets a repository
  decide what those commands are is a real finding.
- **Session records and memory** hold your work. Anything that makes them readable from a project,
  worktree or scope that should not see them counts, and so does anything that writes them where
  they were not meant to go.
- **Skill and agent content** is injected into the model's context. Content that can make the
  assistant act against the user's intent is in scope even though the mechanism is prose.
- **The installer** writes into directories you share with your own work. Anything that overwrites
  or deletes what rsc did not create is a finding, whether or not it is exploitable.

Out of scope: the assistants themselves (report those to their vendors), npm registry or GitHub
infrastructure, and anything that needs an attacker who already has your shell.

## Before you report a guard

rsc's guards (commit conventions, dangerous-command denial, branch discipline) **fail open on
purpose** and each one has a documented per-project switch. That is a design decision, written down,
not an oversight: a guard that guesses is a guard that gets turned off, and a harness that blocks
real work gets uninstalled. "The guard can be bypassed" is only a finding if the bypass makes the
guard claim it is armed while it is not — that one we do want to hear about.
