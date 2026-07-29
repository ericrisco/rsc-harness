---
name: tauri
description: "Use when building a lightweight cross-platform desktop (or v2 mobile) app with Tauri — a Rust core plus the OS-native WebView: Rust commands and IPC, streaming to the frontend, the default-deny capabilities/permissions ACL, bundling and signed auto-updates. NOT a Chromium+Node shell needing Node APIs in a main process (that is electron)."
tags: [tauri, desktop, rust, cross-platform, ipc, webview]
recommends: [rust, electron, react, secure-coding, github-actions]
origin: risco
---

# Tauri — Rust core, OS WebView, locked-down IPC, tiny binaries

Tauri builds a desktop (and, since v2, mobile) app from a **Rust core** plus the
**operating system's own WebView** — not a bundled browser. That is the whole value
proposition: ~12MB installers and 30-50MB idle RAM, versus Electron's ~180MB installers
and 150-300MB because it ships Chromium + Node. You write your UI in any web framework,
expose privileged work as Rust commands, and the WebView talks to Rust over a sandboxed
IPC bridge.

**Always target v2.** Tauri 2.0 went stable in October 2024; the current line is 2.x
(2.11.x as of mid-2026). v1 docs use a `tauri > allowlist` config that no longer exists —
if you see `allowlist`, you are reading the wrong era. v2 also adds iOS/Android targets,
so the same Rust core can ship to mobile.

This skill owns the **shell**: commands, IPC, the security ACL, the bundler, the updater.
It does **not** own the Rust language itself (that is the `rust` skill), the web UI inside
the window (the `react`/`nextjs` skills), a Chromium+Node shell (`../electron/SKILL.md`), or
app-code hardening beyond the IPC boundary (`../secure-coding/SKILL.md`).

## Pick your starting shape

| Situation | Do this |
|-----------|---------|
| Greenfield app, no UI yet | `npm create tauri-app@latest` — pick your frontend, get `src-tauri/` wired |
| You already have a web app (Vite/Next/etc.) | `npx @tauri-apps/cli@latest init` inside it; point `build.frontendDist` at your build output |
| Add mobile to an existing desktop app | `tauri ios init` / `tauri android init`; gate native bits behind `#[cfg(mobile)]` |
| You see `tauri.conf.json > tauri > allowlist` | You are on v1 — migrate to v2 capabilities before adding anything |

`src-tauri/` is its own Cargo crate: `Cargo.toml`, `tauri.conf.json`, `src/lib.rs`
(the `run()` entry point), and `capabilities/`. The frontend is a sibling directory the
bundler reads from `frontendDist`.

## Commands & IPC — the core contract

A command is a Rust function the frontend can call. Each rule below has a one-line *why*.

- **Annotate and register.** `#[tauri::command]` on the fn, then list it in
  `tauri::generate_handler![...]` inside `invoke_handler`. *Unregistered commands are not a
  compile error — they fail at runtime when JS calls them.*
- **Naming crosses the bridge.** JS `invoke('read_config', { filePath })` maps to Rust
  `read_config(file_path: String)`. *Command names stay snake_case; args auto-map
  camelCase (JS) ⇄ snake_case (Rust).*
- **Fallible commands return `Result<T, E>` where `E: Serialize`.** *An `Err` becomes a
  rejected JS promise; a panic instead crashes the command thread silently.*
- **Never block the command thread.** Long or I/O work goes in an `async` command or a
  spawned task. *Commands run on a shared IPC thread pool — a blocking call freezes other
  IPC, which users see as a frozen UI.*
- **Share state with `.manage(x)` + `State<'_, T>`.** *If a guard is held across an
  `.await`, use `tokio::sync::Mutex`, not `std::sync::Mutex` — the std guard is not `Send`
  and will not compile in an async command.*

```rust
// src-tauri/src/lib.rs
use tauri::State;
use tokio::sync::Mutex;

#[derive(Default)]
struct AppState { counter: u64 }

#[tauri::command]                                   // registered below or it 404s at runtime
async fn read_config(file_path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&file_path)           // async I/O — does not block the IPC pool
        .await
        .map_err(|e| e.to_string())                 // Err -> rejected JS promise
}

#[tauri::command]
async fn bump(state: State<'_, Mutex<AppState>>) -> Result<u64, String> {
    let mut s = state.lock().await;                 // tokio Mutex: guard is held across .await
    s.counter += 1;
    Ok(s.counter)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]      // same core compiles for iOS/Android
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![read_config, bump])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```javascript
// frontend
import { invoke } from '@tauri-apps/api/core';

const text = await invoke('read_config', { filePath: '/app/config.toml' });
// throws (rejected promise) if the command returns Err — wrap in try/catch
```

Bad → Good, the failure people hit most:

```rust
// Bad: std Mutex held across .await — won't compile in an async command, or you
// "fix" it by dropping the guard early and create a race.
async fn save(state: State<'_, std::sync::Mutex<AppState>>) { /* ... */ }

// Good: async-aware lock.
async fn save(state: State<'_, tokio::sync::Mutex<AppState>>) -> Result<(), String> { Ok(()) }
```

## Stream vs notify

Two ways to push from Rust to the frontend — pick by ordering needs:

- **`Channel<T>` for ordered streaming.** Download progress, file chunks, an HTTP body.
  *Messages arrive in send order on one typed channel — the right tool for "report
  progress as it happens."*
- **`emit` / `listen` events for fire-and-forget pub/sub.** App-wide notifications, "data
  refreshed," a tray action. *No ordering or backpressure guarantees; many listeners, no
  reply.*

```rust
use tauri::ipc::Channel;

#[derive(Clone, serde::Serialize)]
struct Progress { downloaded: u64, total: u64 }

#[tauri::command]
async fn download(url: String, on_progress: Channel<Progress>) -> Result<(), String> {
    // ... as bytes arrive:
    on_progress.send(Progress { downloaded: 4096, total: 1_000_000 })
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

```javascript
import { Channel, invoke } from '@tauri-apps/api/core';

const onProgress = new Channel();
onProgress.onmessage = (p) => updateBar(p.downloaded / p.total);
await invoke('download', { url, onProgress });
```

## Security — the part people skip

Tauri v2's IPC is an **Access Control List**, default-deny. The chain:

**capabilities** (group windows/webviews) → grant **permissions** (named command sets) →
**permissions map scopes** (what data/paths a command may touch). **A webview that matches
no capability has zero IPC access.** This is the opposite of v1's opt-out allowlist —
you grant exactly what each window needs.

```json
// src-tauri/capabilities/default.json — grant only what the main window uses
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPCONFIG/*" }]   // scope: app config dir only, nothing else
    }
  ]
}
```

Three more rules that bite real apps:

- **CSP is only enforced if you set it** in `tauri.conf.json > app > security > csp`.
  *No CSP = the WebView runs whatever it loads; local scripts are hashed, external ones get
  a per-load nonce only once a CSP exists.*
- **Use the isolation pattern when frontend code may be untrusted** (third-party deps,
  plugins). *It injects a sandboxed iframe that can inspect/modify every IPC message before
  it reaches Rust; messages are encrypted with SubtleCrypto using a key regenerated each
  app start.*
- **Treat the WebView as hostile.** *Anything in the frontend bundle ships to the user —
  no API keys, tokens, or secrets in JS. Privileged work and secrets stay in Rust.*

Full capabilities/permissions/scope JSON, fs/http scope globs, CSP dev-vs-prod recipes, and
isolation-pattern setup live in `references/security.md`.

## Bundle & ship

`tauri build` produces native installers per OS — but unsigned binaries trigger
"unidentified developer" / SmartScreen warnings, so signing is not optional for distribution.

- **macOS:** sign with a Developer ID cert, then **notarize** — Gatekeeper blocks
  un-notarized apps.
- **Windows:** Authenticode-sign the `.exe`/MSI/NSIS or SmartScreen warns.
- **Linux:** AppImage / `.deb` / `.rpm`; no central signing authority, but ship checksums.
- **Auto-update:** the updater plugin needs a signing keypair (`tauri signer generate`);
  the private key signs releases, the public key ships in config. *Without it the updater
  refuses unsigned updates — by design.*
- **Sidecar:** embed an external binary via `bundle.externalBin` to call it at runtime
  (e.g. ship a CLI your app shells out to).

Per-OS flags, notarization steps, updater config, sidecar setup, and a CI release matrix
live in `references/bundling-distribution.md`. The CI runner matrix that *runs* those builds
across three OSes is the `github-actions` skill's job; this skill defines what to build and sign.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|--------------|----------------|------------|
| One capability granting broad permissions to all windows | Any XSS gets the full IPC surface | Per-window capability, scoped to the commands that window needs |
| Permission with no `allow`/scope on `fs`/`http` | Command can touch any path/host | Add an `allow` glob (`$APPCONFIG/*`) and deny the rest |
| Blocking call (`std::fs`, sync HTTP) in a command | Freezes the IPC pool → frozen UI | `async fn` + `tokio` / spawn the work |
| `.unwrap()` instead of returning `Result<T, E>` | Panic crashes the command thread silently | Return `Result`, `map_err` to a serializable error |
| API keys/tokens in the frontend bundle | Ships to every user; trivially extracted | Keep secrets and privileged calls in Rust |
| No CSP set in config | WebView runs any loaded script | Set `app.security.csp`; isolation pattern if deps are untrusted |
| Copying a v1 `tauri.conf.json > allowlist` | That key does not exist in v2 | Use `capabilities/*.json` (ACL) |
| Assuming bundled Chromium | It's the **OS** WebView (WebKit/WebView2) | Test rendering on each OS's engine; avoid Chromium-only CSS/JS |

`scripts/verify.sh` is an advisory static lint over an `src-tauri/` tree that catches several of
these: capabilities present, registered commands exist, no v1 `allowlist`, fallible-looking
commands return `Result`.
