---
name: e2e-testing
description: "Use when writing or stabilizing Playwright tests that drive a real browser through multi-step journeys — durable locators, web-first assertions, storageState auth, trace/retries, and flakes that only bite in CI. NOT in-process component tests (that is testing-web), NOT WCAG auditing (that is accessibility), NOT the pre-merge gate (that is verify)."
tags: [playwright, e2e, browser-testing, flakiness, ci]
recommends: [testing-web, accessibility, performance, github-actions, debug]
origin: risco
---

# e2e-testing — drive a real browser, keep it deterministic

You write **Playwright** tests that walk a real browser through real user journeys — log in, fill a
form, check out, navigate across pages — and you keep those tests deterministic enough to gate a
merge. The whole game is one tension: e2e tests catch integration bugs nothing else can, and they
are the slowest, flakiest layer you own. Every rule below exists to buy back determinism.

Pin `@playwright/test` and provision browsers with `npx playwright install --with-deps`. Current
line is **Playwright v1.60.x** (v1.60.0 shipped 2026-05-11). The `_react` / `_vue` selector engines
and the `:light` Shadow-DOM suffix were **removed in v1.58.0** — at any version you should be pinning
they are long gone, so do not reach for them.

## Is this even an e2e test?

E2e is the most expensive layer. Spend it only on journeys that cross pages or services. Route the rest out.

| The goal is… | Layer | Why |
|---|---|---|
| A multi-step journey across pages/auth/services in a real browser | **e2e (here)** | Only a real browser proves the pieces integrate. |
| One component or pure function, rendered in-process (Vitest/Jest, Testing Library) | `../testing-web/SKILL.md` | A browser round-trip to test render logic is slow and flaky for no gain. |
| "Is this page accessible?" — WCAG/ARIA as the deliverable | `../accessibility/SKILL.md` | E2e may *call* axe inside a test, but auditing a11y is its own skill. |
| "Is this page fast?" — LCP/CWV budgets | `../performance/SKILL.md` | Perf budgets are a different signal than journey correctness. |
| The runner matrix, caching, the pipeline itself | `../github-actions/SKILL.md` | E2e contributes a *job*; owning the pipeline is theirs. |
| "Is the change done?" — run the gate, collect evidence, then merge | `../verify/SKILL.md` | Running an existing suite as a pre-merge gate is not authoring or stabilizing one. |

Rule: if you can prove it without launching a browser, you should. Push logic down to `testing-web`.

## Locators: the priority ladder

Pick the highest rung that uniquely identifies the element. Higher rungs track what the user
perceives, so they survive markup churn.

1. `getByRole('button', { name: 'Buy' })` — role + accessible name. Default choice; doubles as an a11y signal.
2. `getByLabel('Email')` / `getByPlaceholder(...)` — form fields.
3. `getByText('Order confirmed')` — visible copy that uniquely identifies content.
4. `getByTestId('cart-total')` — when nothing user-facing is stable; requires a deliberate `data-testid`.
5. CSS as a last resort, scoped and shallow.

Never XPath, never `nth-child` chains, never the removed `_react`/`_vue`/`:light` engines.

```ts
// Bad — couples the test to DOM structure; one wrapper div breaks it.
await page.locator('div.card > button:nth-child(2)').click();

// Good — finds the button the way the user reads it.
await page.getByRole('button', { name: 'Buy' }).click();
```

**Strict mode.** A locator that matches two nodes *throws* — that is the framework catching an
ambiguous selector for you. Tighten the locator (`getByRole(...).and(...)`, scope with
`page.getByRole('listitem').filter({ hasText: 'Pro' })`). Reaching for `.first()` to silence the
error hides the ambiguity and is the next flake.

## Assertions: web-first only

```ts
// Bad — reads the DOM once, before the async update lands; races the render.
expect(await page.locator('#status').textContent()).toBe('Submitted');

// Good — re-polls the element until it says 'Submitted' or the timeout fires.
await expect(page.getByTestId('status')).toHaveText('Submitted');
```

`expect(locator)` assertions (`toBeVisible`, `toHaveText`, `toHaveURL`, `toHaveCount`) retry until
the condition holds. A read-once value (`await locator.textContent()` then compare) captures a single
frame and loses every race against a re-render. If you find `expect(await` in a test, it is a bug.

## Auto-wait and the no-sleep rule

Locator actions (`click`, `fill`, `check`) already auto-wait: they block until the element is
visible, stable, enabled, and receiving events. So `waitForTimeout(2000)` is never the right wait —
it is either too short (flake) or too long (slow), and it waits for wall-clock time instead of the
thing you actually care about.

| Instead of guessing with a sleep | Wait on the real signal |
|---|---|
| "give the button time to appear" | `await expect(locator).toBeVisible()` |
| "wait for navigation" | `await page.waitForURL('**/checkout')` |
| "wait for the XHR/fetch" | `const r = page.waitForResponse('**/api/order'); …action…; await r;` |
| "wait for the list to fill" | `await expect(page.getByRole('row')).toHaveCount(5)` |

The ordering trap: subscribe to a response (or register a `page.route` mock) **before** the action
that triggers it, or you miss the event.

```ts
// Bad — handler registered after goto; the initial request already fired unmocked.
await page.goto('/orders');
await page.route('**/api/orders', route => route.fulfill({ json: [] }));

// Good — mock in place before navigation, so the first request is intercepted.
await page.route('**/api/orders', route => route.fulfill({ json: [] }));
await page.goto('/orders');
```

## Fixtures and page objects

Fixtures give every test a fresh, isolated setup and kill copy-pasted boilerplate. Extend the base
`test` with your own; the code before `use(value)` is setup, after it is teardown.

```ts
import { test as base } from '@playwright/test';
import { CheckoutPage } from './pages/checkout';

type Fixtures = { checkout: CheckoutPage };

export const test = base.extend<Fixtures>({
  checkout: async ({ page }, use) => {
    const checkout = new CheckoutPage(page); // setup: depends on the built-in `page`
    await use(checkout);                      // hand it to the test
    // teardown after the test goes here, if any
  },
});
```

Option fixtures (`['default', { option: true }]`) let a project or `test.use()` flip behavior
without new fixtures. Keep page objects thin — locators and intent-named actions
(`checkout.placeOrder()`), no assertions buried inside them. Full page-object recipe lives in
[references/config-and-ci.md](references/config-and-ci.md).

## Auth and storageState

Logging in through the UI on every test is slow and a flake surface. Log in **once** in a `setup`
project, save the authenticated session to JSON, and load it via `storageState` in the projects that
depend on it.

- A `setup` project runs the login spec and writes `playwright/.auth/<role>.json`.
- Real test projects declare `dependencies: ['setup']` and `use: { storageState: '…/<role>.json' }`.
- **One file per role** (admin, member, anon) — never share one mutated session across roles.
- **Regenerate every CI run; gitignore the `.auth/` dir.** Committed session state leaks secrets and
  goes stale.

The full multi-role setup-project wiring is in [references/config-and-ci.md](references/config-and-ci.md).

## playwright.config.ts (condensed)

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,        // a stray test.only fails CI instead of skipping the suite
  retries: process.env.CI ? 2 : 0,     // retry only in CI; locally a flake should hurt
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',           // full trace captured the first time a test retries
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] }, dependencies: ['setup'] },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

Open a captured trace with `npx playwright show-trace`. The full annotated config (per-role
storageState, firefox, blob reporter for sharding) is in
[references/config-and-ci.md](references/config-and-ci.md).

## CI (GitHub Actions)

The shape: install browsers with OS deps, run, shard when one box can't finish inside the ~5–10 min
budget, upload the trace and HTML report as artifacts.

```yaml
- run: npx playwright install --with-deps
- run: npx playwright test --shard=${{ matrix.shard }}/4
- uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}
  with: { name: report-${{ matrix.shard }}, path: playwright-report/, retention-days: 7 }
```

Scale: bump `workers` to use a single machine; add `--shard=i/N` across machines only once a single
box overruns the budget. Sharded runs emit blob reports you merge with `npx playwright merge-reports`.
Full workflow (matrix, blob report, merge job) is in [references/config-and-ci.md](references/config-and-ci.md).

## Flakiness playbook

A 3% flake rate on a 40-minute pipeline burns roughly an engineer-day a week on reruns, so treat
flakes as bugs with named causes. **Open the trace first** (`show-trace`) — it replays the exact
failing run with DOM, network, and console; guessing from a one-line CI log is how flakes survive.

| Symptom in CI | Cause | Fix |
|---|---|---|
| Assertion races a re-render | Read-once value, not web-first | `await expect(locator).toHaveText(...)` |
| Mock/intercept never fires | `page.route` registered after `goto` | Register the route before the navigation |
| Test hangs / times out in an SPA | `networkidle` never settles (polling, websockets) | Wait on a locator/URL, not `networkidle` |
| `waitForResponse` misses the call | Subscribed after the action fired | `const r = page.waitForResponse(...)` before the action |
| "strict mode: resolved to 2 elements" | Ambiguous locator | Tighten with role+name/`filter`, not `.first()` |
| Passes alone, fails in the suite | `storageState` leak / shared mutable state | Per-role state file; fresh context per test |
| Wrong fixture/state in one file | `test.use()` scope confusion | Scope `test.use` to the right describe block |
| Green headed, red headless (or vice-versa) | Viewport/animation/timing drift | Pin viewport; reduce motion; debug in the failing mode |

Per-pattern reproduction and corrected code is in [references/flakiness-playbook.md](references/flakiness-playbook.md).

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| `await page.waitForTimeout(2000)` | Couples the test to wall-clock; too short flakes, too long drags | Wait on locator/URL/response |
| XPath or `:nth-child` locators | Breaks on any markup refactor the user never sees | `getByRole`/`getByTestId` ladder |
| `page.$(...)` / `page.$$(...)` element handles | No auto-wait, no retry — pre-locator API | `page.locator(...)` / `getBy*` |
| `expect(await locator.textContent()).toBe(...)` | Reads one frame; races the async update | `await expect(locator).toHaveText(...)` |
| Committing `storageState` JSON | Leaks session secrets, goes stale, false green | Gitignore `.auth/`; regenerate per run |
| `trace: 'on'` always | Heavy artifacts, slows every run | `trace: 'on-first-retry'` |
| Tests that depend on run order | One reorder cascades failures | Each test self-contained; fresh context |
| Driving pure logic through the browser | Slow + flaky for a unit-level check | Push it to `../testing-web/SKILL.md` |
| `.first()` to silence strict mode | Hides ambiguity → the next flake | Make the locator unique |

When a flake resists the table, hand the trace to `../debug/SKILL.md` — reproduce as a rate (k/N
runs), isolate one variable, fix the cause, not the symptom.

## Verify

Run `scripts/verify.sh [dir]` over the test/config files you emit. It is a read-only static lint
(no browser, no network) that fails on the skill's own banlist: `waitForTimeout(`, XPath/`//`
locators, `page.$(`/`page.$$(` handles, `expect(await` read-once assertions, and any
`playwright.config.*` missing both `trace` and `retries`. Clean or empty target exits 0.
