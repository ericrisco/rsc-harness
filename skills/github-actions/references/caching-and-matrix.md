# Caching and matrix recipes

Deep patterns for cache keys, Docker layer caching, matrix shaping, and runner-minute cost. The SKILL.md covers the common case; reach for this when a monorepo, a Docker build, or a large matrix makes the simple version waste minutes.

## Cache keys beyond the simple case

A cache entry is **immutable per key**. Once written, that key returns the same bytes until the key string changes. So the key must encode everything that should invalidate the cache.

```yaml
# Multiple lockfiles (monorepo) — hash all of them so any change rotates the key
key: ${{ runner.os }}-deps-${{ hashFiles('**/package-lock.json', '**/pnpm-lock.yaml') }}
restore-keys: |
  ${{ runner.os }}-deps-
```

`restore-keys` is an ordered prefix-fallback list. On an exact-key miss, GitHub restores the newest cache whose key starts with the first prefix that matches, then the next, etc. That turns a "one dependency changed" cold start into a warm partial hit — you re-resolve only the delta.

Per-workspace caches in a monorepo: put the package path in the key so each package gets its own entry instead of one giant shared cache that thrashes:

```yaml
key: ${{ runner.os }}-${{ matrix.pkg }}-${{ hashFiles(format('packages/{0}/package-lock.json', matrix.pkg)) }}
```

## Docker layer cache via buildx + gha backend

For image builds inside a workflow, cache layers with the GitHub Actions cache backend (`type=gha`) so unchanged layers do not rebuild. The *image design* itself is the docker skill's concern — this is only the caching wiring.

```yaml
- uses: docker/setup-buildx-action@<full-40-char-sha>
- uses: docker/build-push-action@<full-40-char-sha>
  with:
    context: .
    push: false
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

`mode=max` caches all layers (including intermediate build stages), not just the final image — bigger cache, far more hits on multi-stage builds.

## Matrix shaping

`include` adds cells or extra variables; `exclude` removes specific combinations. They compose: the matrix is built, `exclude` prunes, then `include` is applied — an entry whose original keys all match an existing cell only adds its extra variables to that cell; any other entry appends a new cell.

```yaml
strategy:
  fail-fast: false
  max-parallel: 6
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [22, 24, 26]
    exclude:
      - { os: windows-latest, node: 22 }   # drop an unsupported combo
      - { os: macos-latest, node: 22 }
    include:
      - { os: ubuntu-latest, node: 24, coverage: true }  # matches an existing cell: adds coverage to it
```

- `fail-fast: false` — every cell reports, even after one fails. Use it for compatibility matrices where you want the full grid of results.
- `fail-fast: true` (default) — first failure cancels the rest. Use it to save minutes when any failure is a stop-the-line event.
- `max-parallel` — cap concurrent cells when a shared resource (a test DB, a rate-limited API) cannot take the full fan-out.

Dynamic matrix from a previous job (e.g. only the packages that changed): a setup job emits JSON via `$GITHUB_OUTPUT`, and the matrix consumes it with `fromJSON`:

```yaml
jobs:
  discover:
    runs-on: ubuntu-latest
    outputs:
      pkgs: ${{ steps.set.outputs.pkgs }}
    steps:
      - id: set
        run: echo "pkgs=$(./scripts/changed-packages.sh)" >> "$GITHUB_OUTPUT"
  test:
    needs: discover
    strategy:
      matrix:
        pkg: ${{ fromJSON(needs.discover.outputs.pkgs) }}
    runs-on: ubuntu-latest
    steps: [...]
```

## Runner-minute cost

GitHub bills minutes by runner OS with a multiplier on hosted runners:

| Runner | Relative cost |
| --- | --- |
| Linux (`ubuntu-latest`) | 1x — the baseline |
| Windows | ~2x |
| macOS | ~10x |

So: do the bulk of the matrix on Linux, and only add macOS/Windows cells where the platform difference actually matters (native modules, platform-specific builds). `exclude` the cheap-to-skip combinations rather than running the full cartesian product on every OS. A matrix of `3 OS x 4 versions = 12` cells with a 10x macOS multiplier costs far more than `8 ubuntu + 2 macos + 2 windows` shaped with `exclude`.
