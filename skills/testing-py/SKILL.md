---
name: testing-py
description: "Use when writing or fixing Python tests with pytest — especially when the suite is green but bugs still ship, when you must decide where to patch a mocked dependency, when coverage is high but catches nothing, when fixture scope leaks state, or when adding property-based tests for parsers and invariants. NOT browser end-to-end flows (that is `e2e-testing`), NOT JS/TS unit tests (that is `testing-web`), NOT Go tests (that is `testing-go`)."
tags: [pytest, python, testing, coverage, hypothesis, mocking, fixtures, property-based]
recommends: [python, code-review, github-actions, e2e-testing]
origin: risco
---

# Testing Python

A green suite is not a tested suite. Most Python suites pass while shipping bugs because they lie in four predictable ways, and your job is to refuse each lie:

1. **Line-only coverage** reports 95% while every `else` and `except` arm is unvisited.
2. **Mocks patched at the wrong place** never apply, so the test runs the real code or asserts nothing.
3. **autospec-less mocks** pass even when you typo a method name or change a signature — a false green.
4. **autouse fixtures** mutate hidden global state, so tests pass alone and fail in CI order.

The posture, non-negotiable: pytest 9 strict markers and strict config on, **branch coverage on**, `autospec=` on every mock, and Hypothesis property tests for any pure logic with an invariant. Assert on behavior, never on a mock's internals.

Versions you are on (2026-06): pytest **9.0.2**, coverage.py **7.14.1**, pytest-cov **7.x** (needs coverage ≥ 7.10.6), Hypothesis **6.155.x**.

## Which test do I need?

Pick the cheapest test that still catches the bug.

| Situation | Test type | Reach for |
|---|---|---|
| Pure function, many input shapes, an invariant holds | property test | Hypothesis `@given(...)` |
| Same logic, a small fixed matrix of inputs/outputs | parametrized test | `@pytest.mark.parametrize` |
| Code calls an external boundary (HTTP, DB, SDK, clock) | unit test + mock **at the boundary** | `autospec=True` / `mocker` |
| Several real components must work together | integration test | real objects, fixtures, `tmp_path` |
| One test needs an env var / attr swapped and reverted | inline patch | `monkeypatch` |

Default to property + parametrized for logic; reserve mocks for boundaries you do not own.

## Layout and config

`tests/` mirrors the package tree. Put each fixture in the **nearest** `conftest.py`, not always the root one — proximity is documentation. Drive everything from `pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "--strict-markers --strict-config --cov=mypkg --cov-branch --cov-report=term-missing --cov-fail-under=85"
markers = [
  "slow: deselect with -m 'not slow'",
  "integration: touches a real boundary",
]

[tool.coverage.run]
branch = true            # measure both arms of every conditional, not just lines
source = ["mypkg"]

[tool.coverage.report]
show_missing = true
fail_under = 85
exclude_lines = [
  "if TYPE_CHECKING:",
  "raise NotImplementedError",
  "def __repr__",
  "pragma: no cover",
]
```

`--strict-markers` turns a typo'd `@pytest.mark.slwo` into an error instead of a silently-skipped test. `--strict-config` rejects unknown config keys. pytest 9 also exposes `strict_markers`, `strict_config`, `strict_xfail`, and `strict_parametrization_ids` as config aliases — treat strict as the default, not an upgrade.

## Fixtures

Scope is a contract about reuse and isolation. Default to `function` and widen only when setup is genuinely expensive and the object is genuinely immutable.

| Scope | Recreated | Use when |
|---|---|---|
| `function` (default) | every test | anything mutable — the safe default |
| `class` | per test class | a group sharing read-only setup |
| `module` | once per file | costly read-only object (a parsed config) |
| `package` | once per dir | shared fixture for a sub-tree |
| `session` | once per run | a process-wide resource you never mutate |

A `yield` fixture's pre-yield code is setup, post-yield is teardown — **and teardown runs even when the test fails**, so it is where cleanup belongs.

```python
# Bad: everything in the root conftest.py, plus a hidden autouse reset.
# Nobody can trace why a test depends on the DB, and the reset masks state leaks.
@pytest.fixture(autouse=True)
def reset_db():
    db.truncate_all()

# Good: scoped fixture in tests/api/conftest.py, explicit, documented.
# The docstring shows up in `pytest --fixtures`, so it is discoverable.
@pytest.fixture
def api_client(tmp_path):
    """An isolated API client backed by a throwaway sqlite file."""
    client = ApiClient(db_path=tmp_path / "test.db")
    yield client
    client.close()  # runs even if the test raises
```

Parametrize a fixture when several tests should each run against multiple backings:

```python
@pytest.fixture(params=["sqlite", "memory"])
def store(request):
    return make_store(request.param)  # every test using `store` runs twice
```

Use `autouse=True` only for something every test in scope truly needs (a frozen clock, a captured log). A hidden global dependency makes a failure impossible to read.

## Mocking

**Patch the name where it is looked up, not where it is defined.** This is the single most common mocking bug. If `mymod` does `from httpx import get`, then `get` now lives at `mymod.get`; patching `httpx.get` changes a name `mymod` no longer reads, so the mock never applies and the test silently hits the network.

```python
# Bad: patches the definition site; mymod already bound its own `get` at import.
with patch("httpx.get") as m:        # no effect on mymod.get
    result = mymod.fetch(url)

# Good: patch the name in the module under test, and autospec it.
with patch("mymod.get", autospec=True) as m:
    m.return_value.json.return_value = {"ok": True}
    result = mymod.fetch(url)
    m.assert_called_once_with(url, timeout=5)
```

**`autospec=True` is mandatory.** Without it a typo'd method or a wrong arg count still passes — the mock invents any attribute you touch. With autospec the mock enforces the real object's signature, so a refactor that renames a method or drops a parameter fails the test like it should. Use `create_autospec(obj)` when you need a standalone fake of a class or callable.

Choosing the swap tool:

- **`monkeypatch`** (built into pytest, no install): env vars, attributes, `chdir`. `monkeypatch.setenv` / `delenv` / `setattr` / `chdir` auto-revert after the test. Use it for "swap one thing for this test."
- **`mocker`** (`pytest-mock`): `unittest.mock` with automatic undo and call tracking. Less boilerplate for `return_value` / `side_effect` and `assert_called_*`. Use it for "fake a callable and inspect how it was called."

Both are correct; pick by what you are swapping. Faking time, HTTP, DB, the filesystem, `side_effect`, asserting calls, and `AsyncMock` for async code live in **[references/mocking.md](references/mocking.md)**.

## Coverage that means something

Run it with branch coverage and a floor:

```bash
pytest --cov=mypkg --cov-branch --cov-report=term-missing --cov-fail-under=85
```

Line coverage lies because executing a line is not the same as testing its outcomes. A function with `if x: a() else: b()` reaches 100% line coverage from a single test that only takes the `if` arm — the `else` ships untested. `--cov-branch` (or `branch = true`) forces both arms to be exercised, which is exactly where happy-path-only suites leak bugs. `term-missing` prints the unhit line and branch numbers so you know what to write next. Exclude only code that is correctly never run by tests (`if TYPE_CHECKING:`, `raise NotImplementedError`, `__repr__`) — never exclude a branch just to make the number go up.

## Mutation: does the suite actually notice?

Branch coverage tells you which code ran. It cannot tell you whether any test would have **noticed** if that code were wrong — and a test with no assertion, or an assertion that cannot fail, raises coverage without detecting anything. Mutation testing closes that gap by planting bugs on purpose: if the suite still passes, the mutant *survived* and you have found a test that asserts nothing.

```bash
# pyproject.toml → [tool.mutmut]  source_paths = ["src/"]
mutmut run                    # whole source tree
mutmut run "mypkg.core*"      # scope it — this is the normal case
mutmut results                # what survived
```

Reach for the real tool, not a hand-written mutant list: mutmut generates mutants from the syntax tree, so it cannot apply one to code that moved and cannot report one it never ran.

- **Scale it to risk.** This is not a default toll — it is minutes-to-hours on a real tree. Run it where a bug is expensive (money, auth, data loss, concurrency, a public API) or where a green suite keeps shipping bugs anyway. Always scope to the code you changed.
- **A survivor is not automatically a failure.** Some mutants are semantically equivalent to the original and cannot be killed. Classify those with the reason ("equivalent: both branches return the same value for every reachable input"). Never add a test that asserts non-behaviour just to kill one — that is the same gaming that coverage-chasing is.
- **A survivor that is a real bug gets a test, not an excuse.** Write the assertion that kills it, then rerun.
- **If you hand-roll a runner, prove it executed every mutant.** Clear `__pycache__` and set `PYTHONDONTWRITEBYTECODE` per mutant: two same-size mutants written in the same second can share a bytecode cache, and the runner then reports a kill for code it never ran. That defect can only ever *inflate* the score, so it will never show up as a red run — which is why the proof has to be built in rather than assumed.

## Property testing

Reach for Hypothesis when a fixed example matrix can't cover the input space: parsers, serializers, encoders, math, anything with an invariant. You assert a *property* that must hold for all inputs and let Hypothesis hunt counterexamples.

```python
from hypothesis import given, assume, strategies as st

@given(st.text())
def test_encode_decode_roundtrip(s):
    assume("\x00" not in s)            # skip inputs the encoder legitimately rejects
    assert decode(encode(s)) == s      # roundtrip: the core property
```

The property shapes worth knowing: **roundtrip** (`decode(encode(x)) == x`), **idempotence** (`f(f(x)) == f(x)`), and **invariant** (a sorted list stays the same length and is ordered). On failure Hypothesis **shrinks** to the simplest failing input and stores it in the `.hypothesis/` example DB, so the next run replays that exact case until you fix it — commit the DB or persist it in CI to keep regressions pinned. Use `assume()` to discard inputs that aren't meant to be valid, and bound slow strategies so the deadline doesn't flake. Strategy catalog, composite strategies, settings/profiles, `@example`, and stateful testing live in **[references/property-testing.md](references/property-testing.md)**.

## Anti-patterns

| Anti-pattern | Why it is wrong | Do instead |
|---|---|---|
| `patch(...)` without `autospec=`/`spec=` | false green on a renamed or mis-called method | always `autospec=True` (or `create_autospec`) |
| Patching the definition site (`httpx.get`) | the mock never applies to the module under test | patch the use site (`mymod.get`) |
| `time.sleep(...)` to "fix" flakiness | slow and still flaky | fake the clock / poll on a condition |
| Asserting on `mock._mock_calls` or private attrs | test breaks on refactor, not on bugs | assert on the return value / observable behavior |
| Session-scoped mutable fixture with no reset | state leaks across tests, order-dependent failures | `function` scope, or explicit teardown |
| `--cov` without `--cov-branch` | 100% lines while branches are untested | always `--cov-branch` / `branch = true` |
| One giant test asserting 12 things | first failure hides the rest; can't tell what broke | one behavior per test, parametrize the matrix |
| `@given` with no `assume`/bounds on slow code | deadline timeouts, flaky property tests | bound the strategy, raise/disable deadline deliberately |
| `assert True` or bare `pytest.skip()` | a test that can never fail or never runs | assert a real outcome; `skip(reason=...)` |

## Verify

Before declaring a suite done, run the static gate over the test tree. It flags the skill's own banned patterns — mocks without `autospec`/`spec`, `--cov` without `--cov-branch`, `time.sleep` in tests, and no-op tests:

```bash
scripts/verify.sh tests/
```

It is read-only, prints `file:line` for each hit, exits non-zero on any finding, and exits 0 on a clean or empty tree. A clean run is necessary, not sufficient — it cannot tell you the branches are actually tested, only that the obvious lies are absent.
