# Worktrees managed by Orca

Orca tracks the checkout and runs its preparation and teardown hooks. Use its lifecycle when the
project declares `"worktreeManager": "orca"` in `.rsc.json`, or the CLI identifies the checkout.
The setting protects all linked checkouts in that project, including clones without Orca installed.
It does not grant permission to remove anything.

## Inspect and create

Run `orca worktree current --json` from the checkout. Check that `result.worktree.path` resolves to
that checkout; caller context can otherwise select another workspace. If the command fails, inspect
the runtime or configuration; do not infer ownership from a branch name or `.worktrees/` location.

For independent work, use `orca worktree create --name <task> --no-parent --json`. Outside an
unambiguous managed project, add `--repo id:<repoId>` using a previously inspected repository ID.
When the project specifies a base such as `origin/develop`, add `--base-branch origin/develop`.
Use the path returned by Orca rather than guessing where the checkout was created. Wait for the
preparation hooks to finish before starting implementation; use Orca's
`setupAgentStartupPolicy: wait-for-setup` when the installed version supports it.

## Rebuild the declared harness during setup

The non-interactive entry point is `sync` from the new checkout. Read `catalogVersion` from its
committed `.rsc.json`, validate it as an exact version, and invoke that version. Do not substitute
`@latest`. For a PowerShell setup hook:

```powershell
$manifest = Get-Content -LiteralPath .rsc.json -Raw -Encoding UTF8 | ConvertFrom-Json
$rscVersion = $manifest.catalogVersion
if ($rscVersion -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') {
  throw 'Set an exact catalogVersion in .rsc.json before running setup.'
}
npx -y "@ericrisco/rsc@$rscVersion" sync
if ($LASTEXITCODE -ne 0) { throw 'Harness setup failed; do not start the agent yet.' }
```

Use the same exact version with a preinstalled `rsc` executable if the environment disallows npx.
Keep credential copying and submodule setup in the project's existing Orca hooks; rsc does not
need to read those credentials or replace those scripts.

## Concurrent sessions

Inspect the worktree and the actual agent sessions before sharing a checkout. `parentWorktreeId`,
`childWorktreeIds`, `lineage` and `creatorProvenance` describe workspaces, not proof that every
active session belongs to the current task. rsc therefore keeps the concurrency warning and gives
Orca-specific instructions. It does not automatically suppress unrelated sessions based on lineage.
If session identity cannot be verified, create a separate Orca worktree for the independent task.

## Clean up

rsc retains Orca-owned checkouts, including when `rsc worktrees reap --confirm` is requested.
After checking integration, pending changes, ignored files and submodules, use:

```text
orca worktree rm --worktree "path:<absolute-checkout-path>" --run-hooks --json
```

The quotes preserve paths with spaces. Check `orca worktree rm --help` for the installed version
before using it; if hook execution is unavailable, resolve that with Orca rather than substituting
`git worktree remove`. rsc does not execute this removal itself. Timeouts, invalid CLI output or a
different returned path make rsc retain the checkout until ownership can be verified.

Sources checked 2026-11-11: [Orca CLI reference](https://www.onorca.dev/docs/cli/reference),
[upstream CLI guide](https://github.com/stablyai/orca/blob/main/skill-guides/orca-cli.md).
