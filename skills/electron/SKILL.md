---
name: electron
description: "Use when building, hardening, or shipping a cross-platform Electron desktop app — main/renderer/preload process model, typed contextBridge IPC, locking down nodeIntegration/contextIsolation/sandbox/CSP, or packaging with signing and auto-update. NOT a Rust-backed shell on the native webview (that is tauri), nor the web UI inside it (that is react)."
tags: [electron, desktop, ipc, security, packaging, auto-update, code-signing]
recommends: [tauri, react, nodejs, github-actions, secure-coding]
origin: risco
---

# Electron — desktop shell, typed IPC, hardening, signing

This skill owns the **desktop shell**: process model, IPC, security, packaging, signing,
auto-update. It does **not** own the web UI inside the window (`../react/SKILL.md`), the
Node backend logic, or the CI runner matrix.

## The mental model — three processes, one rule

An Electron app is three kinds of process. Code lives in exactly one; putting it in the
wrong one is the root cause of most security holes.

| Process  | Runtime              | Trust         | One per | Does                                              |
|----------|----------------------|---------------|---------|---------------------------------------------------|
| main     | Node.js, full OS API | trusted       | app     | windows, menus, tray, dialogs, fs, child procs    |
| renderer | Chromium, no Node    | **untrusted** | window  | your web UI; can run attacker JS if you load remote content |
| preload  | isolated world, runs before page JS | semi-trusted | window | the **only** bridge: `contextBridge` exposes a tiny API |

**The governing rule: the renderer is untrusted, the main process holds all privilege, and
the preload is the only sanctioned bridge between them.** Renderer-to-OS escalation is the
dominant failure mode in real Electron apps, so everything below is a corollary.

## Start right

Scaffold with **Electron Forge** (`@electron/forge`) — first-party, all-in-one
(scaffold → package → make → publish), and it gets new Electron features first.

```bash
npm init electron-app@latest my-app -- --template=vite-typescript
cd my-app && npm start
```

**Pin to a supported major.** Electron ships a new major every 8 weeks (tracking Chromium)
and supports only the **latest 3 majors**. As of June 2026 the stable line is **Electron 42**
(Chromium M148, Node 24); 43 lands 2026-06-30. Shipping on an EOL major means unpatched
Chromium CVEs — check `package.json` and bump if behind.

Project layout keeps the boundary visible:

```text
src/
  main.ts       # main process — owns everything privileged
  preload.ts    # the bridge — contextBridge only
  renderer/     # your web UI (untrusted)
  ipc/types.ts  # IPC contract shared by main + preload
```

## The security baseline

Modern Electron defaults are already secure (`nodeIntegration:false`,
`contextIsolation:true`, `sandbox:true` since Electron 20). **Assert them explicitly anyway**
so a careless edit can't silently weaken the window:

```ts
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,        // renderer gets NO require/process — never flip true
    contextIsolation: true,        // preload + page run in separate JS worlds
    sandbox: true,                 // renderer in an OS sandbox; preload uses a limited API
    webSecurity: true,             // keep same-origin policy; never disable to "fix CORS"
    allowRunningInsecureContent: false, // no mixed http content on https pages
  },
});
```

One why per flag: each removes a documented way for renderer-side script to reach Node or
the OS. Flipping any of them to the insecure value is what `verify.sh` fails on.

**CSP via response headers, not a `<meta>` tag** — meta CSP can't restrict the initial
document and is trivially bypassed for some directives. Set it in the main process:

```ts
session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
  cb({ responseHeaders: { ...details.responseHeaders,
    'Content-Security-Policy': ["default-src 'self'; script-src 'self'"] } });
});
```

**Lock navigation.** A renderer that can navigate to attacker content gets the renderer's
privileges. Deny unexpected navigation and block new windows:

```ts
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (e, url) => {
    if (new URL(url).origin !== 'https://app.local') e.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' })); // no tab-jacking
});
```

Open real external links deliberately, after allow-listing the protocol:

```ts
function openExternal(url: string) {
  const { protocol } = new URL(url);
  if (protocol === 'https:' || protocol === 'mailto:') shell.openExternal(url);
}
```

**Which branch are you on?**

- **Local-only UI** (you bundle the HTML/JS): CSP + `sandbox:true` + nav lockdown is enough.
- **Loads any remote/third-party content**: also add Electron Fuses (disable run-as-node,
  encrypt cookies, ASAR integrity) and treat every embedded origin as hostile.

Fuses and the full hardened example live in `references/security-and-ipc.md`.

## Typed IPC the right way

IPC is the seam between untrusted renderer and privileged main. Get it wrong and you've
handed the OS to whatever script runs in the page.

**Never expose `ipcRenderer` (or any of its methods) across the bridge.** Sending the whole
module now yields an *empty object* on the other side — a deliberate footgun removal — and
exposing its methods lets the page call any channel with any payload.

```ts
// Bad — preload.ts: hands the renderer a universal IPC weapon (also: empty object now)
contextBridge.exposeInMainWorld('api', ipcRenderer);
```

```ts
// Good — preload.ts: ONE function per channel, each wrapping a specific call
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('api', {
  readConfig: () => ipcRenderer.invoke('config:read'),
  saveNote: (text: string) => ipcRenderer.invoke('note:save', text),
  onSync: (cb: () => void) => ipcRenderer.on('sync:done', cb), // events: send/on
});
```

**Prefer `ipcMain.handle` + `ipcRenderer.invoke`** (request/response, returns a Promise) for
anything that returns data. Reserve `send`/`on` for fire-and-forget events (progress, push
notifications). **Validate every argument in main** — a renderer message is an HTTP request
from an untrusted client:

```ts
ipcMain.handle('note:save', (_e, text: unknown) => {
  if (typeof text !== 'string' || text.length > 10_000) throw new Error('bad input');
  return saveNote(text); // never path.join(userInput) or eval it
});
```

Share the contract as TypeScript types across both sides (`ipc/types.ts`) so a channel
rename breaks the build, not production. Full main + preload + `window.api` d.ts example:
`references/security-and-ipc.md`.

## Native capabilities — renderer asks, main acts

The renderer can't (and must not) touch the OS directly. When the UI needs a native menu,
tray icon, file dialog, system notification, custom `protocol://` handler, or a
`child_process`, the renderer **invokes an IPC channel** and the **main process performs the
action** and returns a result. Same one-function-per-channel discipline as above.

For embedding web content in a region of a window, use **`WebContentsView`** —
`BrowserView` is deprecated since Electron 30. They share shape (both take `webPreferences`;
`setBounds`/`getBounds`/`webContents` carry over), so migration is mechanical.

## Packaging, signing, auto-update

Two real toolchains:

| Need                                            | Use              |
|-------------------------------------------------|------------------|
| New app, first-party alignment, features first  | **Electron Forge** (ASAR integrity, universal macOS, scaffold→make→publish) |
| Differential/staged updates, multi-provider (GitHub/S3), richer config | **electron-builder** + `electron-updater` |

**Code signing is a prerequisite for auto-update, not optional polish.** macOS auto-update
(Squirrel.Mac) **refuses** to update an app that isn't signed *and* notarized; Windows
updates need an Authenticode-signed installer. So the order is always: sign → notarize →
publish → auto-update. Full Forge and builder configs, notarytool steps, Windows
Authenticode, and `electron-updater` + GitHub Releases wiring: `references/packaging-and-updates.md`.

The CI matrix that *runs* these builds across three OSes is `github-actions`' job; this skill
defines *what* to build and sign.

## Anti-patterns and migration smells

| Anti-pattern                                          | Why it's wrong                                              | Do instead                                            |
|-------------------------------------------------------|------------------------------------------------------------|-------------------------------------------------------|
| `nodeIntegration: true`                               | Page JS gets `require('fs')`; any XSS becomes OS-level RCE | `false`; move the capability behind IPC               |
| `contextIsolation: false`                             | Page can rewrite the preload's globals                     | `true` (the default)                                  |
| `sandbox: false` without a reason                     | Drops the OS sandbox around the renderer                   | `true`; only relax for a measured, isolated need      |
| `exposeInMainWorld('api', ipcRenderer)` or its methods | Universal IPC weapon — any channel, any payload (and an empty object now) | One typed function per channel        |
| No arg validation in `ipcMain.handle`                 | Renderer is an untrusted client; you trust its input       | Type-check + bound every arg before acting            |
| `webSecurity: false` to "fix CORS"                    | Disables same-origin policy app-wide                       | Keep `true`; proxy/handle CORS in main                |
| CSP only in a `<meta>` tag                            | Doesn't cover the initial document; bypassable             | Set CSP in `onHeadersReceived`                         |
| Loading a remote URL into a Node-enabled window       | Remote site runs with your app's privilege                 | Bundle UI locally; sandbox + nav lockdown for remote  |
| `@electron/remote` import                             | Sync main-object access = renderer→main RCE                | Replace with explicit `ipcMain.handle` channels       |
| `new BrowserView(...)`                                | Deprecated since Electron 30, will be removed              | `new WebContentsView(...)`                            |
| Auto-update with an unsigned/un-notarized build       | Squirrel.Mac silently refuses; no updates ship             | Sign + notarize (mac), Authenticode (win) first       |
| Shipping on an EOL Electron major                     | Unpatched Chromium CVEs in your users' hands               | Stay within the latest 3 majors                       |
| Heavy CPU work in the main process                    | Blocks the event loop → the whole UI freezes               | `utilityProcess`/worker, or do it in the renderer     |

## Verify

Run `scripts/verify.sh /path/to/your-electron-project` to grep a target for insecure
patterns (`nodeIntegration: true`, `contextIsolation: false`, `sandbox: false`,
`@electron/remote`, `new BrowserView`, `exposeInMainWorld(..., ipcRenderer)`). It's read-only
and exits non-zero on any finding. With no argument it self-checks this skill's own example
snippets for the secure baseline. See `references/security-and-ipc.md` for the full checklist.
