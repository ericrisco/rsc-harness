---
name: chrome-extension
description: "Use when building or shipping a Manifest V3 browser extension and hitting its quirks — service worker dying and losing state, permission warnings, a Chrome Web Store rejection, content-script/worker/popup messaging, or an MV2-to-V3 migration. NOT a generic web app (that is `nextjs`), NOT a desktop shell (that is `electron`)."
tags: [chrome-extension, manifest-v3, browser-extension, service-worker, chrome-web-store]
recommends: [nextjs, react, gdpr-privacy, secure-coding, vercel]
origin: risco
---

# Chrome extension (Manifest V3)

An MV3 extension is **three isolated JavaScript contexts that never share memory and only talk via messages**:

1. **Service worker** (`background.service_worker`) — the logic and lifecycle brain. Ephemeral: Chrome kills it when idle and restarts it on the next event. It has no DOM and no `window`.
2. **Content scripts** — run inside a web page, can read/write that page's DOM, live in an isolated JS world by default. No access to most `chrome.*` APIs except messaging and `storage`.
3. **UI surfaces** — popup (`action.default_popup`), options page, side panel. Normal web pages that load and unload as the user opens/closes them.

Internalize that picture first. Most extension bugs are someone treating one of these as if it shared state with another. They do not. The wire between them is `chrome.runtime` messaging and `chrome.storage`.

Manifest V3 is the only version the Chrome Web Store accepts; MV2 phase-out began June 2024 and is still rolling out. Build MV3 from the start.

## Pick a skeleton

| Setup | Pick when | Cost |
|---|---|---|
| **Vanilla** (raw files, `load unpacked`) | tiny extension, no npm imports, you want the fastest possible reload loop | no TS, no HMR, manual reloads |
| **Vite + CRXJS** (`@crxjs/vite-plugin`) | TS, npm imports, React/Vue popup, you want HMR | a build step; you ship `dist/`, not the repo |

Default to **Vite + CRXJS** the moment you want TypeScript or a framework popup — it does the manifest wiring and HMR for you. Reach for vanilla only for a one-file experiment.

Minimal tree (Vite + CRXJS):

```text
my-ext/
  manifest.json        # source of truth; CRXJS reads it
  src/
    background.ts       # service worker
    content.ts          # content script
    popup/
      index.html
      popup.tsx
  public/icons/         # 16, 48, 128 px PNGs
  vite.config.ts
  # build output -> dist/  (this is what you zip)
```

## manifest.json — minimum viable shape

```json
{
  "manifest_version": 3,
  "name": "Highlighter",
  "version": "1.0.0",
  "description": "Highlights selected text on the current page.",
  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" },
  "action": { "default_popup": "popup/index.html" },
  "background": { "service_worker": "background.js", "type": "module" },
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": [],
  "minimum_chrome_version": "120"
}
```

Rules that fail review or break the worker if you get them wrong:

- `manifest_version` **must be `3`**. There is no `2` path forward.
- `background.service_worker` is a **string**, not an array. There is no `background.scripts` and no `background.page` in MV3. The `persistent` key does not exist — delete it. (Source: developer.chrome.com "Migrate to a service worker", accessed 2026-06-02.)
- `"type": "module"` lets the worker use `import`. Use it if you bundle.
- Keep `host_permissions` empty until you can name exactly which sites and why (see permission table).

## The three contexts and how they talk

The service worker is **ephemeral**. It terminates when idle and wakes on an event. Two consequences govern almost all your code:

- **Register every listener synchronously at the top level.** If you call `chrome.runtime.onMessage.addListener` inside an `async` callback or after an `await`, Chrome may not have registered it when it wakes the worker, and your event is lost. (Source: developer.chrome.com "Migrate to a service worker", accessed 2026-06-02.)
- **Never keep state in a global variable.** The worker dies and your variable resets to its initial value. Persist to `chrome.storage`.

```js
// Bad — global resets to 0 every time the worker is killed and restarts
let clickCount = 0;
chrome.action.onClicked.addListener(() => {
  clickCount++;                          // silently back to 1 after idle
});

// Good — durable across worker restarts, listener registered at top level
chrome.action.onClicked.addListener(async () => {
  const { clickCount = 0 } = await chrome.storage.local.get("clickCount");
  await chrome.storage.local.set({ clickCount: clickCount + 1 });
});
```

Messaging choices:

- **One-shot** request/response: `chrome.runtime.sendMessage(msg)` / `chrome.tabs.sendMessage(tabId, msg)` paired with `chrome.runtime.onMessage`. Return `true` from the listener to keep the channel open for an async `sendResponse`.
- **Long-lived** stream (e.g. a content script feeding the popup continuously): `chrome.runtime.connect()` → `Port`, with `port.onMessage` / `port.postMessage`.

Content script → service worker → popup: there is no direct content-script-to-popup channel when the popup is closed. Route through the worker or through `chrome.storage` and let the popup read on open.

## Permissions — least privilege or you get rejected

Reviewers reject broad permissions with no justification, and broad `host_permissions` trigger a scary install-time warning that tanks conversion. Declare the **narrowest** thing that works.

| Permission | Grants | Warning? | Use when |
|---|---|---|---|
| `activeTab` | temporary access to the current tab, only after a user gesture (toolbar click) | none | the user clicks your icon and you act on that one page |
| `scripting` | `chrome.scripting.executeScript` to inject programmatically | none alone (needs a host or `activeTab` to target) | inject on demand instead of on every page |
| `host_permissions: ["https://example.com/*"]` | persistent access to those origins | yes, lists the sites | you must run in the background on specific sites |
| `host_permissions: ["<all_urls>"]` | every site | loud, broad warning | almost never — avoid; prefer `activeTab` |
| `optional_permissions` + `chrome.permissions.request()` | runtime opt-in inside a user gesture | shown only when requested | a feature only some users need; ask when they enable it |
| `declarativeNetRequest` | static/dynamic rules block or modify requests, no request bodies seen | install-time warning | ad/tracker blocking — replaces blocking `webRequest` |
| `declarativeNetRequestWithHostAccess` | same, but access granted per host instead of install-time | per-host | DNR scoped to granted hosts only |

Rule: write a one-sentence justification for **every** permission before you add it. If you cannot, drop it. `activeTab` covers more cases than people expect — try it first. (Source: developer.chrome.com "Declare permissions" + "declarativeNetRequest", accessed 2026-06-02.)

## Content scripts: declarative vs programmatic

```json
// Declarative — in manifest. Runs automatically on matching pages.
"content_scripts": [{
  "matches": ["https://example.com/*"],
  "js": ["content.js"],
  "run_at": "document_idle"
}]
```

```js
// Programmatic — inject on a gesture. Needs "scripting" + activeTab or a host match.
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  });
});
```

- `run_at`: `document_start` (before DOM), `document_end`, or `document_idle` (default, after load). Pick `document_start` only if you must beat the page's own scripts.
- **Isolated world** (default): your content script's JS is sandboxed from the page's JS — they share the DOM but not variables. Use **MAIN world** (`"world": "MAIN"`) only when you must touch the page's own JS objects, and know it loses the isolation guarantee.
- For dynamic, user-supplied injection, `chrome.userScripts.execute()` exists (Chrome 135, Mar 2025) — see [references/store-and-migration.md](references/store-and-migration.md).

## Storage, alarms, no remote code

- `chrome.storage.local` (~10 MB, larger with `unlimitedStorage`) for most data; `chrome.storage.sync` (~100 KB, ~8 KB/item) only for small settings you want to follow the user across devices.
- **`setTimeout`/`setInterval` are unreliable** in the worker — it may be asleep when they fire. Use `chrome.alarms` for anything beyond a few seconds. (Source: developer.chrome.com "Migrate to a service worker", accessed 2026-06-02.)
- **Remotely hosted code is banned.** No `<script src="https://cdn...">`, no `eval`-of-fetched-string. All executable JS must ship inside the package — bundle every dependency. This is enforced by MV3's CSP and by review. (Source: developer.chrome.com "What is Manifest V3", accessed 2026-06-02.)

## Shipping to the Chrome Web Store

1. **Build**, then **zip the `dist/` output** — never the repo. No `node_modules`, no `.git`, no source maps you do not want public.
2. Pay the **one-time $5 USD** developer registration (covers up to 20 extensions on the account).
3. Upload the zip in the Developer Dashboard.
4. Listing assets: a **128×128 PNG** icon, **at least one screenshot** (1280×800 or 640×400), a clear description, a category, and a **privacy-policy URL if you collect any data**.
5. Review is typically **1–3 business days** (simple extensions often under 24h).

(Source: developer.chrome.com "Register your developer account" + fee guide, accessed 2026-06-02.) For the full dashboard walkthrough, data-disclosure form, staged rollout, appeals, and the MV2→MV3 migration map, see [references/store-and-migration.md](references/store-and-migration.md).

## Anti-patterns

| Anti-pattern | Why it breaks | Do instead |
|---|---|---|
| `background.scripts` / `persistent: true` | MV2 shape; rejected, worker never registers | `background.service_worker: "bg.js"` (string) |
| Listener added after an `await` | Chrome wakes the worker without your listener; event lost | register all listeners synchronously at top level |
| State in a global var | worker dies, var resets silently | persist to `chrome.storage` |
| `<all_urls>` when a click suffices | scary install warning, review pushback | `activeTab` triggered by the toolbar click |
| `<script src="https://cdn…">` | remote code is banned in MV3 | bundle the dependency into the package |
| `setInterval` for periodic work | fires only while worker is alive | `chrome.alarms` |
| Zipping the repo / `node_modules` | bloated, leaks source, may fail review | zip only the built `dist/` |
| Auth token in a global / `sync` | lost on restart, or synced off-device | `chrome.storage.local` (or `session` for in-memory) |
| MAIN world by default | loses isolation, page can tamper | isolated world unless you must reach page JS |

Run `scripts/verify.sh <dir>` to lint a produced `manifest.json` against the MV3 invariants above.
