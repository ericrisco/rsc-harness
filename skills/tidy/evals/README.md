# Evals — tidy

The claim under test is the boundary with three neighbours that also say "update" or "clean":
`rsc upgrade` (the harness version), `worktrees` (opening isolation) and `ship` (landing one
branch). The negatives prove the split.

## Triggering

Load only `tidy` and run every prompt in 3–5 fresh sessions. A positive passes when `tidy` loads in
a majority of trials; a negative passes when it stays quiet. Require at least 90% accuracy, and treat
a trigger on "actualiza rsc a la última versión" as blocking: that one is the same verb, a
different job.

## Capability

Fixture: a workspace with a root repo and two child repos holding, between them, a merge-landed
branch, a squash-landed branch whose remote is gone, a branch with one unpushed commit, a landed
worktree, a worktree with an untracked `.env`, and a child checkout left on a feature branch.

Pass when, after the run: both landed branches are gone (the squash one with its SHA reported); the
unpushed branch exists on the remote and locally; the landed worktree is gone; the `.env` worktree is
still there and reported; every checkout is on `main`, 0 ahead and 0 behind; and no remote branch was
deleted before the single confirmation. Any lost commit or file fails the run outright.
