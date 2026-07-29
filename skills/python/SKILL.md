---
name: python
description: "Use when the task is Python itself, in any framework or none: PEP 695 generics, mypy --strict typing, dataclass/Protocol/TypedDict/Enum choices, asyncio.TaskGroup, stdlib idioms, src/ layout + pyproject.toml with uv, ruff+mypy+pytest gate. NOT a FastAPI/ASGI service (that is fastapi), NOT a deep pytest suite (that is testing-py)."
tags: [python, typing, async, packaging, uv]
recommends: [fastapi, secure-coding, deployment]
origin: risco
---

# Modern Python at the language level

Write, review, modernize, type, and package Python that reads like a typed,
flat-control-flow, stdlib-first program whose dependencies and tooling all live in one
`pyproject.toml`. Types are part of the design, not decoration; the stdlib is large and you
reach for it before a dependency; correctness is `ruff` + a type checker + `pytest` in one gate.

Targets **Python 3.12+ (floor) / 3.14 (current**, released 7 Oct 2025): PEP 695 inline
type parameters (`class Box[T]:`, `type Alias = ...`), `asyncio.TaskGroup`, and — in 3.14 —
deferred annotation evaluation by default (PEP 649/749, no more `from __future__ import
annotations`), PEP 750 template strings (`t"..."`), and `compression.zstd`. Tooling pins:
**uv 0.11** (project + package manager), **ruff 0.15** (lint + format), **mypy 1.20
`--strict`** (or Astral's `ty`, still preview — default to mypy), **pytest 8**.

## Scope — what this skill delegates

- Building a FastAPI / ASGI service (routes, Pydantic models, SQLAlchemy, uvicorn) ->
  [`fastapi`](../fastapi/SKILL.md). That skill owns the service shape; this one owns the
  language it is written in.
- A pytest suite as the primary task — fixtures, parametrize matrices, mocking, coverage,
  property-based testing -> `testing-py` (this skill keeps only the *baseline*: a few tests
  so `verify.sh` has something to run, then hands off).
- Language-agnostic threat modeling / authz / OWASP review ->
  [`secure-coding`](../secure-coding/SKILL.md) (this skill keeps Python-specific safety: no
  `eval`/`pickle` of untrusted data, `subprocess` without `shell=True`, `secrets` over `random`).
- Containerfile / CI pipeline / deploy mechanics -> [`deployment`](../deployment/SKILL.md)
  (this skill ships only a uv-based CI note).
- Another language -> `go`, `typescript`, `rust`, etc. Django ORM/models/migrations -> `django`.

Python typing, async language semantics, and uv packaging live **here**, not in a separate
skill — this skill is the canonical authority for the language substrate under any Python program.

## Decision rules

Apply on every Python edit:

1. **Type the boundary.** Every public function, method, and module-level name gets an
   annotation; let inference handle locals. Untyped public API defeats `--strict`.
2. **Flat control flow.** Guard-clause and `return`/`raise` early; keep the happy path
   unindented — arrow code hides the logic.
3. **Stdlib before a dependency.** `pathlib`, `itertools`, `functools`, `dataclasses`,
   `collections` cover most needs; a new dep is a maintenance liability you must justify.
4. **Prefer immutability.** `@dataclass(frozen=True, slots=True)` for value objects; mutate
   only where you must — shared mutable state is the bug you debug at 2am.
5. **Everything passes the gate.** `ruff check` + `ruff format --check` + `mypy --strict` +
   `pytest` — green locally via `scripts/verify.sh` before you call it done.

## Typing

Type the boundary; run `mypy --strict` so untyped code and implicit `Any` are errors, not
silent gaps. Use **PEP 695** inline syntax for all new generic code — no explicit `TypeVar`
objects:

```python
# Good (3.12+): inline type parameter and the `type` alias statement.
def first[T](xs: list[T]) -> T:
    return xs[0]

class Box[T]: ...
type UserId = int                 # `type` statement: a real alias, lazily evaluated
# Bad (legacy): `T = TypeVar("T")` then a Generic[T] — fine in old code, don't write it new.
```

Core choices: `Protocol` (structural, no inheritance) over an ABC when you only need "has these
methods"; `X | None` (not `Optional[X]`); `Literal`/`Enum` for closed value sets; `Final` for
constants; `Self` for fluent returns; `@overload` for signature families. Narrow with
`isinstance`, `assert`, or an `is None` guard — mypy follows the flow. In **3.14** annotations
are lazy by default (PEP 649/749), so forward references resolve without `from __future__ import
annotations`.

Full PEP 695 bounds/constraints/variance, `Protocol` vs ABC, `TypedDict`
`Required`/`NotRequired`, `ParamSpec`/`TypeVarTuple`, `TypeGuard`/`TypeIs`, `cast`, and common
`--strict` errors with fixes -> [`references/typing.md`](references/typing.md).

## Data modeling

Pick the carrier by what the data *is*, not by habit:

| Need | Use | Why |
| --- | --- | --- |
| Immutable value object, typed fields, methods | `@dataclass(frozen=True, slots=True)` | Hashable, no `__dict__` overhead, real types |
| Small fixed tuple, positional + named, immutable | `NamedTuple` | Tuple semantics + field names; cheap |
| Shape of an external/JSON dict, no runtime class | `TypedDict` | Types a plain `dict` without wrapping it |
| Closed set of named constants | `Enum` / `StrEnum` / `IntEnum` | One source of truth; `Literal`-friendly |
| Mutable bag of related state with behavior | plain class / `@dataclass` | When you genuinely need mutation |
| Runtime-validated I/O model (parse untrusted data) | Pydantic -> [`fastapi`](../fastapi/SKILL.md) | Validation is a service concern, not language |

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float
    def translated(self, dx: float, dy: float) -> "Point":
        return Point(self.x + dx, self.y + dy)   # returns a new value, never mutates
```

Frozen-slots dataclass when you want methods + hashability + clear types; `NamedTuple` when
the thing genuinely *is* a small tuple you also unpack positionally.

## Stdlib idioms

Reach into the stdlib before adding a dependency.

- **`pathlib`** for all filesystem paths: `Path("data") / name`, `p.read_text()`,
  `p.glob("*.json")`, `p.with_suffix(".bak")` — typed and composable, never `os.path.join`.
- **`collections`**: `defaultdict(list)`, `Counter(words)`, `deque(maxlen=100)` for ring buffers.
- **`itertools`**: `chain`, `groupby`, `islice`, `batched` (3.12+) instead of hand-rolled loops.
- **`functools`**: `@cache` / `@lru_cache` for pure memoization, `@cached_property`, `partial`.
- **`contextlib`**: `@contextmanager`, `ExitStack` for dynamic resource sets, `suppress(FileNotFoundError)`.
- **`logging`**, never `print` in a library: `print` writes to a caller's stdout you do not own;
  `logging.getLogger(__name__)` lets them configure it.

Prefer comprehensions over `map`/`filter`+`lambda`; prefer a generator (`(... for ...)`) when
you only iterate once. Use `match` for structural dispatch over a chain of `isinstance`:

```python
from functools import cache
from pathlib import Path

@cache
def config_dir() -> Path:                 # computed once, memoized
    return Path.home() / ".config" / "myapp"

def area(shape: object) -> float:
    match shape:                          # structural dispatch, captures by attribute/key
        case {"kind": "circle", "r": float(r)}:
            return 3.14159 * r * r
        case _:
            raise TypeError(f"unknown shape: {shape!r}")
```

f-strings for formatting; note 3.14's PEP 750 `t"..."` template strings yield a `Template`
(not a `str`) for *safe custom interpolation* (e.g. escaping) — use them when an f-string would
inject untrusted text. Full cookbook (itertools/functools/collections recipes, `match`
patterns, dataclass `field`/`default_factory`/`__post_init__`, `Enum`/`StrEnum`/`IntFlag`) ->
[`references/stdlib.md`](references/stdlib.md).

## Errors & resources

Define a small exception hierarchy rooted in one base so callers can catch broadly or
narrowly; chain causes with `raise ... from`; never write a bare `except:`.

```python
class AppError(Exception): ...
class NotFoundError(AppError): ...

def load(path: Path) -> str:
    try:
        return path.read_text()
    except FileNotFoundError as e:
        raise NotFoundError(f"missing {path}") from e   # preserves the cause chain
```

Use `except*` to handle an `ExceptionGroup` (what a `TaskGroup` raises) by member type.
Prefer **EAFP** (try the operation, handle the failure) over LBYL race-prone pre-checks.
Always release resources with `with` (a context manager), not manual try/finally close.

## Async (language level)

Use `asyncio.run(main())` as the single entry point. **`asyncio.TaskGroup` (3.11+) over bare
`gather`** — it is the structured-concurrency primitive: a child failure cancels its siblings
and surfaces as an `ExceptionGroup`, and no task outlives the block.

```python
import asyncio

# Bad: gather leaks the other tasks on first failure and loses structure.
async def fetch_all_bad(ids: list[int]) -> list[bytes]:
    return await asyncio.gather(*(fetch(i) for i in ids))

# Good: TaskGroup — sibling cancellation on error, bounded lifetime, real grouping.
async def fetch_all(ids: list[int]) -> list[bytes]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch(i)) for i in ids]
    return [t.result() for t in tasks]                  # block exited => all done or raised
```

Bound every wait with `async with asyncio.timeout(5.0):`. On `CancelledError`, clean up and
**re-raise** — swallowing it breaks cancellation for the whole tree. Async is for **IO-bound**
concurrency only; CPU-bound work blocks the loop — push it to `asyncio.to_thread` / a
`ProcessPoolExecutor` (or 3.14's free-threaded build). **HTTP servers belong to
[`fastapi`](../fastapi/SKILL.md), not here.** Runtime model, `ExceptionGroup`/`except*`, queues
with backpressure, cancellation discipline, and sync<->async bridging ->
[`references/async.md`](references/async.md).

## Project layout & packaging (uv)

Use a `src/` layout so tests import the installed package, not the source tree by accident:

```text
myapp/
  src/myapp/__init__.py
  src/myapp/core.py
  tests/test_core.py
  pyproject.toml
  uv.lock              # committed
  scripts/verify.sh
```

`pyproject.toml` is the single config — PEP 621 metadata, dependency groups, and tool config.
Never hand-edit a `requirements.txt`; `uv add` writes the dep and updates `uv.lock`, which you commit.

```toml
[project]
name = "myapp"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["httpx>=0.27"]

[project.scripts]
myapp = "myapp.core:main"          # console entry point

[dependency-groups]
dev = ["ruff>=0.15", "mypy>=1.13", "pytest>=8"]

[build-system]
requires = ["uv_build>=0.11"]
build-backend = "uv_build"         # uv's own backend, stable since July 2025

[tool.ruff]
line-length = 100

[tool.mypy]
strict = true
```

Core uv verbs (each updates `uv.lock`, which you commit):

```bash
uv init --package myapp        # scaffold pyproject.toml + src/ + .venv
uv add httpx                   # add a runtime dep
uv add --dev ruff mypy pytest  # add to the dev group
uv sync --frozen               # install exactly from the lockfile (CI + fresh clones)
uv run pytest -q               # run inside the managed venv
uv python install 3.14         # pin/install an interpreter
```

## Quality gate + verify.sh

One local gate, mirroring CI: `ruff check --fix .`, `ruff format .`, `mypy --strict src`
(or `ty check`), `pytest -q`. `scripts/verify.sh` runs all of them, skips a missing tool/dir
with a warning, and exits non-zero on any real failure — run `./scripts/verify.sh` from the
project root before declaring done. CI is `astral-sh/setup-uv` + `uv sync --frozen` + the same
four commands; full pipeline -> [`deployment`](../deployment/SKILL.md).

## pytest baseline

Carry just enough to make `verify.sh` meaningful — plain `test_*` functions, `assert`,
`pytest.raises`, one `parametrize`, `tmp_path` for files:

```python
import pytest
from myapp.core import head

@pytest.mark.parametrize("xs, expected", [(["a", "b"], "a"), (["x"], "x")])
def test_head_returns_first(xs: list[str], expected: str) -> None:
    assert head(xs) == expected

def test_head_rejects_empty() -> None:
    with pytest.raises(ValueError):
        head([])

def test_writes_file(tmp_path) -> None:
    (tmp_path / "f.txt").write_text("hi")
    assert (tmp_path / "f.txt").read_text() == "hi"
```

Deep fixtures, mocking, coverage gates, and property-based testing belong to `testing-py` —
stop at the baseline and hand off.

## Security (embedded, Python-specific)

Generic threat modeling and authz live in [`secure-coding`](../secure-coding/SKILL.md); these Python-specific controls stay here:

```python
# Bad                                          # Good
eval(user_input)                                ast.literal_eval(user_input)   # never eval/exec input
pickle.loads(network_bytes)                     json.loads(network_bytes)      # never unpickle untrusted data
subprocess.run(cmd, shell=True)                 subprocess.run(["ls", path])   # list args, no shell=True
random.random()  # tokens                       secrets.token_urlsafe(32)      # secrets, not random, for secrets
```

Keep deps locked (`uv.lock`) and audited (`pip-audit` / `uv` resolution); read secrets from
env or a secret manager, never hardcode or log them.

## Anti-patterns -> STOP

| Tempting move | Reality / do instead |
| --- | --- |
| "`def f(xs=[])` is fine, it's empty" | One list shared across all calls; use `= None` then `xs = xs or []`. |
| "bare `except:` to be safe" | Swallows `KeyboardInterrupt`/bugs; catch a specific type. |
| "`from module import *`" | Pollutes the namespace, breaks tooling; import names explicitly. |
| "`print()` to debug this library" | Writes to a stdout you don't own; use `logging.getLogger(__name__)`. |
| "`os.path.join` is what I know" | `pathlib.Path` is typed and composable; use `/`. |
| "I'll add types later" | Untyped public API defeats `--strict`; type the boundary now. |
| "edit `requirements.txt` by hand" | Drifts from the lock; `uv add` / `uv remove` and commit `uv.lock`. |
| "`asyncio.gather` is simpler" | Leaks siblings on failure; `TaskGroup` for structured concurrency. |
| "swallow `CancelledError`, it's noise" | Breaks cancellation for the whole tree; clean up and re-raise. |
| "`time.sleep` inside this coroutine" | Blocks the event loop; `await asyncio.sleep(...)`. |
| "`pickle.loads` the cache, it's ours" | Any untrusted byte = code execution; use `json`. |
| "explicit `TypeVar` everywhere" | New code uses PEP 695 `def f[T]` / `class C[T]` / `type X`. |

## Project grounding (02-DOCS)

In a project that has the [`harness`](../harness/SKILL.md) wiki, record this project's Python
conventions in `02-DOCS/wiki/stack/python.md` and index it in `02-DOCS/wiki/index.md` — the
interpreter floor, `src/` layout, uv workflow, ruff/mypy config, async-vs-sync stance, and
data-modeling defaults. Read it first on every use and bump its `Updated` date when a convention
changes. This is *recorded, not gated*: never block the task on it, and skip silently when there
is no `02-DOCS/` layer.
