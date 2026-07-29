---
name: bash-scripting
description: "Use when writing or hardening a shell script that must survive another machine — a CI step, install script, cron job, git hook, devcontainer entrypoint: strict-mode leaks, quoting/word-splitting, arrays, trap cleanup, bash-vs-POSIX portability, ShellCheck findings. NOT CI workflow structure, runners, caching or matrix (that is `github-actions`)."
tags: [bash, shell, shellcheck, posix, scripting]
recommends: [github-actions, error-handling, docker, secure-coding]
origin: risco
---

# Bash scripting — scripts that survive a stranger's machine

You are the shell author who has been burned: by an unquoted `"$@"` that
exploded a path with spaces, by `rm -rf "$DIR/"` where `$DIR` was empty, by a
`trap` that fired twice, by a `set -e` that swore it caught errors and didn't.
Write every script as if it will run in CI, in a container, and on a 2014 Mac
with `bash 3.2` — because eventually it will.

The first decision is not a line of code. It is: **which shell am I targeting?**
That choice decides what you are allowed to write. Make it before the shebang.

## The header you start every bash script with

```bash
#!/usr/bin/env bash
set -euo pipefail        # see "Strict mode, honestly" — this is a baseline, not a force field
IFS=$'\n\t'              # split words on newline/tab only, never on spaces
```

- `#!/usr/bin/env bash` — find bash on `PATH`; do not hardcode `/bin/bash`, which is **3.2** on macOS and may not exist on some images.
- `set -e` — exit on an uncaught non-zero command. Leaky (below), still worth having.
- `set -u` — error on an unset variable, so a typo'd `$OUPUT` fails loud instead of expanding to empty.
- `set -o pipefail` — a pipeline fails if **any** stage fails, not just the last. Bashism — not in POSIX `sh`.
- `IFS=$'\n\t'` — stops the classic "unquoted expansion splits on every space" bug at the source.

## Pick your shell first

`set -o pipefail`, arrays, `[[ ]]`, and `local` are **bashisms**. If your shebang
is `#!/bin/sh` you may not get bash — on Debian/Alpine `sh` is `dash`/busybox.

| | `#!/usr/bin/env bash` | `#!/bin/sh` (POSIX) |
|---|---|---|
| Where it runs | anywhere bash is installed | every Unix; the only safe choice for an unknown box |
| You GAIN | arrays, `[[ ]]`, `pipefail`, `local`, `${var,,}`, process substitution `<(…)` | maximal portability, smaller deps |
| You LOSE | nothing (if bash is guaranteed) | all the above — POSIX `sh` has none of them |
| Lint with | `shellcheck script.sh` | `shellcheck -s sh script.sh` |
| Test with | `bash script.sh` | `dash script.sh` |

Two traps to internalize: macOS `/bin/bash` is **3.2** (no `declare -A`,
no `${var,,}`, no `mapfile`); and bash **5.3** added `${ cmd; }` /
`GLOBSORT` / `read -E` that will not run on either of the above. Pick a floor
and stay above it — the full bash-vs-POSIX feature matrix, `bash 3.2`
workarounds, dash/busybox gotchas, the 5.3 features to guard, and how to test
one script under several shells are in
[`references/portability.md`](references/portability.md).

## Strict mode, honestly

`set -e` is not a force field. It is silently suppressed in three places, and
people ship broken scripts because they trusted it:

1. **In an assignment with command substitution.** `local x=$(failing)` — the
   assignment succeeds (exit status is the `local`/assignment, not the substitution).
2. **In a condition.** Anything in `if`, `while`, `&&`, `||`, or after `!` is
   exempt by design — `set -e` would make `if grep …` unusable otherwise.
3. **Inside functions** called in a condition: a failing line won't abort.

So: do not lean on `set -e` for control flow. Check what matters explicitly.

```bash
# Bad — set -e will NOT catch this; x is empty, script sails on
local x=$(curl -fsS "$url")

# Good — split declaration from assignment so the substitution's status is seen
local x
x=$(curl -fsS "$url") || { echo "fetch failed" >&2; return 1; }
```

`trap 'echo "failed at line $LINENO" >&2' ERR` gives you a breadcrumb on the
uncaught failures `set -e` *does* catch. To deliberately ignore a non-zero exit,
say so: `cmd || true` (and a comment why), never a bare unchecked `cmd`.

## Quoting — the highest-value section

Unquoted expansions are the №1 cause of shell bugs and of the data-loss story
everyone has heard. Quote every expansion unless you have a specific reason not to.

| Bad | Good | Why |
|---|---|---|
| `rm $file` | `rm "$file"` | space/glob in `$file` becomes multiple args (SC2086) |
| `func $@` | `func "$@"` | `"$@"` preserves each arg verbatim; `$@` re-splits them |
| `x=$(cmd)` … `echo $x` | `echo "$x"` | unquoted output word-splits and glob-expands |
| `[ $x = y ]` | `[ "$x" = y ]` | empty/spaced `$x` makes `[` a syntax error |
| `for f in $(ls)` | `for f in ./*` | parsing `ls` breaks on spaces/newlines (SC2045) |
| `rm -rf $DIR/` | see below | the disaster |

The `rm -rf` disaster: if `$DIR` is unset/empty, `rm -rf $DIR/` becomes
`rm -rf /`. Guard the variable *and* quote it:

```bash
: "${DIR:?DIR must be set}"   # abort with a message if unset or empty
rm -rf "${DIR:?}"/           # belt and braces: fail rather than expand to /
```

Use `[[ … ]]` in bash (no word-splitting inside, supports `=~`, `&&`); use
`[ … ]` in POSIX `sh`. `[ a == b ]` is a bashism — POSIX `[` uses `=`.

## Arrays, not space-split strings

The instant an argument list is built from a string, spaces betray you. Build
it as an array and expand `"${arr[@]}"` (each element stays one argument).

```bash
# Bad — flags string splits wrong if any value contains a space
flags="--name my project --force"
docker run $flags image          # 5 args, "my" and "project" split apart

# Good — array; "${flags[@]}" expands to exactly 4 arguments
flags=(--name "my project" --force)
docker run "${flags[@]}" image
```

Iterating files: never parse `ls`. Use a glob, or `find -print0` with a
NUL-delimited read so even newlines in names are safe.

```bash
# Good — glob; the ./ prefix protects files named like "-rf"
for f in ./*.txt; do
  [ -e "$f" ] || continue       # guard the no-match case (glob stays literal)
  process "$f"
done

# Good — robust against spaces AND newlines in filenames
find . -name '*.log' -print0 | while IFS= read -r -d '' f; do
  process "$f"
done
```

macOS `bash 3.2` has no `mapfile`/`readarray`; the `find -print0` loop above is
the portable way to collect names.

## Cleanup with traps

A script that creates temp state must remove it even when interrupted. Register
**one** `EXIT` trap right after you create the resource — `EXIT` fires on normal
exit, on `set -e` abort, and after `INT`/`TERM`, so you don't need per-signal traps.

```bash
tmp=$(mktemp -d)                          # never a fixed /tmp/foo path (race + collision)
trap 'rm -rf "$tmp"' EXIT                 # one trap, covers every exit path

work_in "$tmp"
```

Make cleanup idempotent (`rm -rf` tolerates a missing dir) so a double-fire or a
re-entry is harmless. Track background PIDs and reap them in the same trap:

```bash
server & srv_pid=$!
trap 'kill "$srv_pid" 2>/dev/null; rm -rf "$tmp"' EXIT
```

## Input & variables

| Pattern | Use |
|---|---|
| `: "${1:?usage: deploy <env>}"` | require an argument, abort with a message |
| `env="${1:-staging}"` | default when omitted |
| `readonly ROOT="$PWD"` | constants that must not be reassigned |
| `local x` (bash) | function-scope a variable so it doesn't leak (not POSIX) |

Option parsing uses `getopts` (POSIX, single-dash flags):

```bash
verbose=0; out=""
while getopts ":vo:" opt; do
  case "$opt" in
    v) verbose=1 ;;
    o) out="$OPTARG" ;;
    *) echo "usage: $0 [-v] [-o FILE]" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))
```

Use `printf '%s\n' "$x"` instead of `echo "$x"` for arbitrary data — `echo`'s
handling of `-n`/`-e` and backslashes is not portable.

## Run ShellCheck — and fix, don't silence

ShellCheck v0.11.0 (2025-08) is the canonical static analyzer. Run it on every
script; it catches most of the above before runtime.

```bash
shellcheck script.sh             # bash target
shellcheck -s sh script.sh       # verify POSIX-sh compliance
```

Codes worth memorizing: **SC2086** (unquoted expansion → quote it),
**SC2046** (unquoted `$(…)` word-splits), **SC2164** (`cd` without `|| exit`),
**SC2155** (`local x=$(cmd)` masks the command's exit status — declare then assign).

Silence a finding only with a justified directive on the line directly above it,
never project-wide:

```bash
# shellcheck disable=SC2086  # word-splitting is intentional: $flags is a flag list we control
some_cmd $flags
# shellcheck source=lib/common.sh   # resolve a dynamic `source` for cross-file analysis
. "$dir/common.sh"
```

Wire `shellcheck` into CI as a `run:` step — the workflow scaffolding around it
belongs to `../github-actions/SKILL.md`, the shell inside the step belongs here.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| `for x in $(ls *.txt)` | breaks on spaces/newlines; SC2045 | `for x in ./*.txt; do [ -e "$x" ] \|\| continue` |
| Unquoted `$var` / `$@` | word-split + glob; SC2086 | always `"$var"` / `"$@"` |
| `cd "$d"; rm -rf .` | if `cd` fails you `rm` the wrong dir; SC2164 | `cd "$d" \|\| exit 1` |
| Trusting `set -e` for control flow | leaks in assignments/conditions/functions | check explicitly: `cmd \|\| { …; exit 1; }` |
| `local x=$(cmd)` | masks `cmd` exit status; SC2155 | `local x; x=$(cmd) \|\| return 1` |
| Bash 5.3 / `declare -A` in a 3.2 or `sh` target | "command not found" on the user's box | pick a floor; see `references/portability.md` |
| `echo "$untrusted"` for data | non-portable `-n`/`-e`/backslash handling | `printf '%s\n' "$x"` |
| `[ a == b ]` under `#!/bin/sh` | `==` is a bashism; dash errors | POSIX uses `[ a = b ]` |
| Fixed temp path `/tmp/build` | race + collision + no cleanup | `tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT` |
| `pipefail` in a `#!/bin/sh` script | not POSIX; dash ignores or errors | use bash, or check pipeline status another way |
