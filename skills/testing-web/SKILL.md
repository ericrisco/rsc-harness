---
name: testing-web
description: "Use when writing or fixing frontend unit, component or custom-hook tests with Vitest or Jest plus Testing Library — rendering a component in jsdom, testing a hook in isolation, choosing between sync and async queries, silencing act warnings, mocking fetch, or migrating a Jest suite to Vitest. NOT real-browser multi-page journeys (that is `e2e-testing`), NOT pytest suites (that is `testing-py`), NOT accessibility auditing (that is `accessibility`)."
tags: [testing, frontend, vitest, jest, testing-library, react, hooks, component-testing, jsdom]
recommends: [e2e-testing, accessibility, testing-py, react, nextjs, debug]
origin: risco
---

# testing-web — fast, trustworthy component and hook tests

A frontend test is only worth keeping if it survives a refactor and fails for the right reason.
The way to get there is boring and non-negotiable: render the thing, query it the way a user finds
it, drive it with real events, and assert on what the user can see. Everything in this skill bends
toward that. Tests that reach into `className`, `state`, props, or instance methods pass while the UI
is broken and break while the UI is fine — delete that instinct.

## What this owns / what it doesn't

This skill owns unit, component, and custom-hook tests that run in a simulated DOM (jsdom) or Vitest
Browser Mode at component granularity. The moment scope crosses a boundary, switch skills:

- Real browser driving a whole app, page navigation, multi-page login-to-dashboard journeys -> [`../e2e-testing/SKILL.md`](../e2e-testing/SKILL.md).
- pytest / fixtures / Python suites -> [`../testing-py/SKILL.md`](../testing-py/SKILL.md).
- axe runs, contrast ratios, keyboard-nav auditing as the *goal* -> [`../accessibility/SKILL.md`](../accessibility/SKILL.md). (You will use role queries here; auditing is not the job.)
- Render/runtime perf, re-render counts, web vitals -> [`../debug/SKILL.md`](../debug/SKILL.md) for diagnosis.
- How to build the component in the first place -> [`../react/SKILL.md`](../react/SKILL.md) or [`../nextjs/SKILL.md`](../nextjs/SKILL.md).

## Pick the runner (do this once, never run both)

| Project shape | Runner | Why |
|---|---|---|
| New Vite / React 19 / Next 16 repo | **Vitest 4** | Shares your `vite.config`, zero second transform pipeline, Browser Mode is stable as of v4.0 (Oct 2025). |
| Established Jest / CRA / React Native repo | **Jest 30** | Migration cost outweighs the win; Jest 30 is current (min Node 18.x, min TS 5.4). |
| Both installed | pick one and rip the other out | Two runners means two configs, two mock APIs, doubled CI — and tests that pass in one, fail in the other. |

Vitest is the de-facto default for new frontend projects in 2026; Jest stays where it already lives.
Jest 30 specifics (ts-jest vs babel, the jsdom v26 `window.location` break) live in
[`references/jest-setup.md`](references/jest-setup.md).

## Minimal Vitest setup that works

Pin current majors: `vitest ^4.0`, `@testing-library/react ^16.3`, `@testing-library/jest-dom ^6.9`,
`@testing-library/user-event ^14.6`, `jsdom`, `@vitejs/plugin-react`.

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",   // give the test a DOM; default 'node' has no document
    globals: true,          // describe/it/expect without imports; jest-dom matchers register globally
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest"; // the /vitest entry — NOT the bare import (that is Jest's)
```

The `/vitest` import path matters: the bare `@testing-library/jest-dom` registers against Jest's
`expect`. Wrong path = `toBeInTheDocument is not a function`.

## The one rule: test what the user sees

Query and assert on the rendered output a human perceives, never the mechanism. This is what makes a
test outlive a refactor — rename a state variable, swap a class library, restructure the tree, and a
behavioral test still passes.

```tsx
// Bad — coupled to internals; passes when broken, breaks when fine
expect(wrapper.find(".btn--loading")).toHaveLength(1);
expect(component.state.isOpen).toBe(true);

// Good — coupled to user-observable behavior
expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
expect(screen.getByRole("dialog")).toBeVisible();
```

## Query priority ladder

Reach for the highest query that fits. `getByTestId` is the fire escape, not the front door — it
asserts nothing about accessibility or labels.

| Priority | Query | Use for |
|---|---|---|
| 1 | `getByRole(name)` | Almost everything: buttons, headings, inputs, dialogs, links. |
| 2 | `getByLabelText` | Form fields tied to a `<label>`. |
| 3 | `getByPlaceholderText` | Inputs with only a placeholder (prefer a real label). |
| 4 | `getByText` | Non-interactive copy, paragraphs, list items. |
| 5 | `getByDisplayValue` | Asserting a filled-in input's current value. |
| last | `getByTestId` | Only when no role/label/text identifies the node. |

Pick the right variant by what you expect:

| Variant | Returns | Throws if absent? | Use when |
|---|---|---|---|
| `getBy*` | element now | yes | element must already be there |
| `queryBy*` | element or `null` | no (returns null) | asserting **absence** (`expect(...).toBeNull()`) |
| `findBy*` | Promise of element | rejects after timeout | element **appears later** (after fetch/async) |

Never `getBy` something that arrives asynchronously — it throws before the element mounts. That is what
`findBy` is for.

## Driving interactions

Set up `user-event` once per test and `await` every interaction. It dispatches the full realistic event
sequence (pointerdown -> mousedown -> focus -> mouseup -> click), so it catches handlers `fireEvent`
silently skips.

```tsx
import userEvent from "@testing-library/user-event";

it("submits the typed name", async () => {
  const user = userEvent.setup();           // call setup() before interacting
  render(<Greeter />);
  await user.type(screen.getByLabelText(/name/i), "Ada"); // await — these are async
  await user.click(screen.getByRole("button", { name: /greet/i }));
  expect(screen.getByText(/hello, ada/i)).toBeInTheDocument();
});
```

Reach for `fireEvent` only for events `user-event` has no verb for (e.g. `scroll`). A missing `await`
is the single most common source of "passes locally, flakes in CI."

## Async and the act() warning

"An update to X was not wrapped in act(...)" means state updated after your assertion ran — the test
finished, the component kept working, React complained. The fix in a **component** test is almost never
a manual `act()`. It is to *wait* for the observable result:

```tsx
// Bad — asserts before the fetch resolves; state lands "outside act"
render(<Profile id="1" />);
expect(screen.getByText("Ada")).toBeInTheDocument(); // throws / act warning

// Good — findBy retries until the node appears, inside RTL's act wrapper
render(<Profile id="1" />);
expect(await screen.findByText("Ada")).toBeInTheDocument();
```

For a transition you can't pin to a single element, wrap the assertion in `waitFor`. Bare `act()` in a
component test is a code smell — it belongs to hook tests (next section).

## Testing hooks

`renderHook` ships inside **`@testing-library/react`** itself. Do not install or import the long-deprecated
`@testing-library/react-hooks`. Read live values off `result.current`; wrap any setter call you trigger
yourself in `act()`; re-run with new props via `rerender`; await async settle with `waitFor`.

```tsx
import { renderHook, act, waitFor } from "@testing-library/react";

it("counts down then stops at zero", async () => {
  const { result, rerender } = renderHook(({ from }) => useCountdown(from), {
    initialProps: { from: 3 },
  });
  expect(result.current.value).toBe(3);

  act(() => result.current.start());     // a setter YOU invoke -> wrap in act
  await waitFor(() => expect(result.current.value).toBe(0)); // async settle -> waitFor

  rerender({ from: 10 });                // feed new props
  expect(result.current.value).toBe(10);
});
```

## Mocking the boundary

Mock at the edge your code talks to the outside world — the network or the imported module — never the
internal function you are trying to verify. Mock the unit under test and the test proves nothing.

- **Network**: prefer **MSW** (`http.get(...)` handlers) so components hit a real `fetch`/`axios` path. It survives client-library swaps.
- **A whole module**: `vi.mock("./api")` (Vitest) / `jest.mock("./api")` (Jest) for non-network collaborators.
- **Time**: `vi.useFakeTimers()` for timers/debounce; advance with `vi.advanceTimersByTime(ms)`, then restore in cleanup.

```ts
import { vi } from "vitest";
vi.mock("./flags", () => ({ isEnabled: () => true })); // a boundary module, not the component
```

Runnable copy-paste recipes — form submit, controlled input, MSW async data, a provider-wrapping custom
`render`, fake timers, a hook with an effect + cleanup, an error-boundary test — live in
[`references/recipes.md`](references/recipes.md).

## Snapshots vs assertions

Default to explicit behavioral assertions. A snapshot proves nothing about correctness — it proves output
didn't change, and a giant DOM snapshot gets blindly `--updated` the first time it breaks. Snapshot only
small, stable, serializable output (a formatted currency string, a normalized config object). Never
snapshot a full component tree as your primary assertion.

## Mutation: does the suite actually notice?

Coverage tells you which code ran. It cannot tell you whether any test would have **noticed** if that code were wrong — and a `render()` with no assertion, or a snapshot nobody reads, raises coverage while detecting nothing. Mutation testing plants bugs on purpose: if the suite still passes, the mutant *survived* and you have found a test that asserts nothing.

```jsonc
// stryker.config.json — scope is not optional here
{ "testRunner": "vitest", "mutate": ["src/cart/total.ts", "src/cart/discount.ts"] }
```

```bash
npx stryker run
```

Reach for the real tool over a hand-written mutant list: Stryker generates mutants from the syntax tree, so it cannot apply one to code that moved and cannot report one it never ran.

- **Always scope `mutate` to the files you changed.** A whole-project Stryker run on a real front-end does not finish in a useful amount of time; that is the main reason teams try it once and abandon it.
- **Scale it to risk.** Not a default toll. Run it on the logic where a bug is expensive — pricing, totals, permissions, anything money- or auth-shaped — not on presentational components, where a surviving mutant usually just means the DOM detail genuinely does not matter.
- **A survivor is not automatically a failure.** Some mutants are semantically equivalent to the original and cannot be killed; classify those with the reason. Never add an assertion about non-behaviour just to kill one — that is coverage-chasing wearing a different hat.
- **A survivor that is a real bug gets an assertion, not an excuse.** Write it, then rerun.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| `getByTestId` as first choice | Asserts nothing about a11y or labels; survives broken markup | Climb the ladder: role > label > text first |
| `getBy*` for async content | Throws before the element mounts | `await findBy*` / `await waitFor(...)` |
| Interaction without `await` | Assertion runs before the event settles; flakes in CI | `await user.click(...)` every time |
| `fireEvent.click` by default | Skips the realistic pointer/focus sequence | `userEvent.setup()` then `await user.click` |
| Manual `act()` in a component test | Masks the real fix (waiting for output) | Await `findBy`/`waitFor` instead |
| Asserting on `state`/`props`/`className` | Couples the test to internals; breaks on refactor | Assert on rendered role/text the user sees |
| `setTimeout`/`sleep` to wait | Arbitrary delay = slow + still flaky | `findBy`/`waitFor` retries until ready |
| Mocking the unit under test | The test verifies the mock, not the code | Mock the network/module boundary only |
| Importing `@testing-library/react-hooks` | Deprecated; folded into `@testing-library/react` | Import `renderHook` from `@testing-library/react` |
| Bare `@testing-library/jest-dom` in Vitest | Registers against Jest's expect -> matcher missing | Import `@testing-library/jest-dom/vitest` |
| Running Jest and Vitest in one suite | Two configs/mock APIs; passes in one, fails in other | Pick one runner, remove the other |
| A test file with zero `expect(...)` | Renders but verifies nothing; green by accident | Every test asserts an observable outcome |

## Verify your suite

Run the linter against a test file or directory to catch these shape violations before review:

```bash
scripts/verify.sh src/components/__tests__
```

It hard-fails on tests with no assertion and on un-awaited interactions, and warns on testid-first
queries, raw `fireEvent`, stray `act()` in component files, and `setTimeout`-based waiting. It checks
artifact *shape*, not whether your assertions are true.
