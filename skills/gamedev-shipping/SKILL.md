---
name: gamedev-shipping
description: "Use when exporting, building, packaging, or publishing a game — per engine (Godot export templates, Unity Build Profiles, Unreal Shipping vs Development) and per platform: desktop (Windows/macOS/Linux; macOS codesign + notarytool notarization), web (the COOP same-origin + COEP require-corp headers threaded SharedArrayBuffer WebAssembly builds need, and that Godot's C#/.NET edition can't export to web), mobile (Android JDK 17 build template, AAB vs APK, release keystore; iOS provisioning). Also store prep (icons/splash, metadata, age ratings, AAB for Play, Mac App Store, Steamworks/SteamPipe, itch.io butler), headless-export CI/CD, build/version numbers, and ship-time size/startup optimization. Triggers: 'export my game', 'build for Steam', 'ship to web/mobile', 'publish to the Play Store', 'notarize my Mac build', 'itch.io upload', 'SharedArrayBuffer is not defined'. NOT for writing gameplay/runtime code (that's the engine skill — godot/unity/unreal) or hosting a normal web app/API/container (→ deployment)."
tags: [export, build, release, packaging, store, steam, itch, notarization, webassembly, aab]
recommends: [godot, unity, unreal, deployment]
profiles: [full]
origin: risco
---

# Ship the game — export, build & release (per engine · per platform)

Take a finished project from editor → signed, correctly-configured artifact → live on the
right target (desktop / web / mobile / store), with the platform gotchas that silently break a
build handled up front. This skill owns the *packaging and release boundary*; the engine skills
own the code that runs inside the artifact.

```text
project ──[engine export/build]──▶ artifact ──[per-platform sign/config]──▶ target
Godot templates·Unity Build Profiles·Unreal Shipping    desktop·web·mobile    Steam·Play·App Store·itch
```

## Version anchors (what "current" means here — July 2026)

| Tool | Target | Ship note |
| --- | --- | --- |
| Godot | 4.5 stable (4.6 dev) | Export templates must match the editor build **exactly** (4.5.1 editor ⇒ 4.5.1 templates). **C#/.NET edition has NO web export** — GDScript/standard only. |
| Unity | Unity 6 (6000.x) | "Build Settings" is now **Build Profiles**. IL2CPP backend for iOS/Android/WebGL. |
| Unreal | 5.6 | Ship in the **Shipping** config; test packaged builds in **Development**. |
| Android | JDK **17**, target a recent API level | AAB required for Google Play (new apps + updates). APK only for sideload/itch/direct. |
| iOS/macOS | Xcode 16+, `notarytool` | `altool` notarization is dead — use `xcrun notarytool`. |

## When to use / When NOT to use

**Use when:**
- Configuring export templates / build presets / packaging settings for any target.
- Signing & notarizing a desktop build, or debugging Gatekeeper/SmartScreen rejections.
- Fixing a web build that boots to `SharedArrayBuffer is not defined` or a blank canvas.
- Producing an AAB/APK or an iOS archive; wiring keystores/provisioning.
- Store submission prep (icons, metadata, ratings) or uploading to Steam/itch/Play/App Store.
- Automating headless exports in CI, or setting version/build numbers.
- Shrinking build size / startup time before release.

**NOT for (route elsewhere, say so, stop):**
- Writing gameplay, shaders, netcode, or any runtime logic → the **engine** skill (`godot`/`unity`/`unreal`) or `gamedev-shaders`/`gamedev-multiplayer`. This skill packages code; it does not write it.
- Hosting a normal web app, API, or container (Dockerfile, Coolify, Vercel, VPS) → **`deployment`**. A WebAssembly game is *static files*; only its **headers** are special (below).
- Designing game feel, economy, or narrative → `game-design` / `game-storytelling`.

## Decision rules (settle these before touching a build)

| Question | Rule |
| --- | --- |
| Web build uses threads / SharedArrayBuffer? | You **must** serve `COOP: same-origin` + `COEP: require-corp` (cross-origin isolation). No headers ⇒ no threads ⇒ boot failure. |
| Godot + C# + web? | **Impossible today.** Switch to GDScript for web, or ship that title desktop/mobile only. |
| Play Store? | **AAB**, signed with an upload key, Play App Signing on. Not APK. |
| macOS distribution outside the App Store? | codesign (Developer ID) → **notarize** → **staple**. Skipping = Gatekeeper blocks it. |
| Mac **App Store**? | Different cert (Apple Distribution) + sandbox entitlements; notarization is automatic, not manual. |
| Steam? | SteamPipe upload via `steamcmd` + an `app_build` VDF; set the default branch live in the partner site. |
| Quick public build / demo / jam? | **itch.io** + `butler push`. Tick "SharedArrayBuffer support" for threaded web builds. |
| Release config? | Godot **release** preset (debug off), Unity release/**IL2CPP**, Unreal **Shipping**. Never ship a debug/Development build. |

## Export / build per engine

**Godot** — `Editor ▸ Manage Export Templates` (match version), then `Project ▸ Export`, add one
preset per platform. Headless for CI:

```bash
godot --headless --export-release "Windows Desktop" build/game.exe
godot --headless --export-release "Web"             build/index.html
# Android AAB needs the Gradle build template + JDK 17 + a release keystore (see references)
```

Web preset toggles: **Thread Support** (⇒ needs COOP/COEP) and **Extensions Support**. Android
needs `Project ▸ Install Android Build Template` (enables *Use Gradle Build*).

**Unity** — `File ▸ Build Profiles` (formerly Build Settings). Create a profile per platform;
override **Player Settings** per profile (company/product name, bundle id, icons, scripting
backend). iOS/Android/WebGL force **IL2CPP**. CI headless:

```bash
Unity -quit -batchmode -nographics -projectPath . \
  -buildTarget Android -executeMethod BuildScript.PerformBuild -logFile -
```

Android: tick **Build App Bundle (Google Play)** for AAB; set the keystore in *Publishing Settings*.
WebGL: threads ⇒ COOP/COEP; keep **decompression fallback** for hosts that can't set gzip/br headers.

**Unreal** — build **configurations**, not "modes": Debug, DebugGame, **Development** (test packaged
builds — keeps logs/console), Test, **Shipping** (release — strips logging, most optimized). Package
via `Platforms ▸ <target> ▸ Package Project`, the Project Launcher, or UAT for CI:

```bash
RunUAT BuildCookRun -project="Game.uproject" -platform=Win64 \
  -clientconfig=Shipping -cook -stage -pak -package -archivedirectory=build
```

Android adds `-distribution` for an AAB; iOS requires a Mac + provisioning. Run the platform
**Turnkey**/SDK setup once (Android Studio + NDK, or Xcode) or the cook fails.

→ full per-engine preset/flag tables: `references/mobile-and-desktop.md` and `references/stores-and-ci.md`.

## Per-platform

### Desktop (Windows / macOS / Linux) — the simplest path

| OS | Sign? | Gotcha |
| --- | --- | --- |
| Windows | Optional (Authenticode; EV avoids SmartScreen warm-up) | Unsigned still runs but SmartScreen warns; ship `.exe` + engine data next to it, or an installer. |
| Linux | No | Ship binary + data, or wrap as **AppImage**/**Flatpak** for a portable single file. |
| macOS | **Required** | Must codesign (Developer ID Application) **+ notarize + staple**, or Gatekeeper refuses to open it. |

macOS notarization (the step everyone forgets):

```bash
codesign --deep --force --timestamp --options runtime \
  --sign "Developer ID Application: Studio (TEAMID)" Game.app
ditto -c -k --keepParent Game.app Game.zip
xcrun notarytool submit Game.zip --keychain-profile "AC" --wait   # store creds once via store-credentials
xcrun stapler staple Game.app                                     # staple so it verifies offline
```

`--options runtime` (Hardened Runtime) is **mandatory** for notarization. Codesign every bundled
`.dylib`/helper *before* the outer `.app`, inside-out.

### Web — the header trap (read this before blaming your build)

Threaded WebAssembly builds (Godot with Thread Support, Unity WebGL with threads) use
**`SharedArrayBuffer`**, which browsers gate behind **cross-origin isolation**. The server must send:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Missing them ⇒ `SharedArrayBuffer is not defined`, a hang, or a blank canvas — even though the
files are fine. Where to set them:

- **Netlify** `_headers`, **Vercel** `vercel.json` headers, **nginx** `add_header` — set both on the game path.
- **itch.io** — tick **"This file will be played in the browser" ▸ SharedArrayBuffer support**; itch sets the headers for you.
- **GitHub Pages** — **cannot** set headers. Use a non-threaded export, or the `coi-serviceworker` shim (a service worker that re-serves with the headers).

`COEP: require-corp` also means every cross-origin subresource (fonts, analytics, embeds) must
send CORP/CORS or it's blocked. **Godot C#/.NET has no web export at all** — use GDScript.

→ hosts, exact configs, the service-worker shim, self-test: `references/web-export-headers.md`.

### Mobile

**Android** — needs **JDK 17** and the engine's Gradle build template. Ship **AAB** to Play
(Google re-signs and generates per-device APKs), **APK** for sideload/itch/direct. Generate a
release keystore once and reuse it forever (lose it = you can't update the app without Play App
Signing key reset):

```bash
keytool -genkey -v -keystore release.keystore -alias game \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep the keystore + passwords out of git (CI secret). `versionCode` must increase every upload.

**iOS** — Mac + Xcode + Apple Developer account. Bundle ID must match an **App ID**; pick a
**provisioning profile** (development / ad-hoc / App Store) and a signing certificate. Archive,
then upload to App Store Connect / TestFlight via Xcode Organizer or **Transporter**. `CFBundleVersion`
must increase per upload.

→ full keystore, Play App Signing, provisioning, TestFlight walkthrough: `references/mobile-and-desktop.md`.

## Store prep

- **Assets**: platform icons (Android adaptive, iOS icon set, Windows `.ico`, macOS `.icns`), splash/launch, store screenshots per device class, a trailer where required.
- **Metadata**: title, short + full description, keywords, category, support/privacy URLs, localized strings.
- **Age ratings**: fill the **IARC** questionnaire (Play, Microsoft, Nintendo) or ESRB/PEGI/USK; Apple has its own age-rating questionnaire. Wrong answers = removal.
- **Google Play**: AAB + **Play App Signing**, a recent **target API level**, content rating, and the **Data safety** form.
- **Steam**: Steamworks partner + appid; define **depots**; upload with **SteamPipe** (`steamcmd +run_app_build app_build_APPID.vdf`); store page assets; set the branch live.
- **itch.io**: `butler push build/ user/game:channel --userversion 1.2.3` — channel name (e.g. `windows`, `html5`) picks the platform.
- **Mac App Store**: Apple Distribution cert + App Sandbox entitlements (not Developer ID); notarization is handled by App Store submission.

→ Steamworks/SteamPipe VDF, butler channels, Play/App Store checklists: `references/stores-and-ci.md`.

## CI/CD for builds

Headless export in GitHub Actions; version from the run/commit so every artifact is traceable.

- **Godot**: run in a container that bundles matching export templates (e.g. a `barichello/godot-ci`-style image), `godot --headless --export-release`.
- **Unity**: `game-ci/unity-builder` + a license activation step (secrets); matrix over targets.
- **Unreal**: needs a **self-hosted runner** with the engine installed (multi-GB); UAT `BuildCookRun`.
- **Signing in CI**: import the keystore/cert from an encrypted secret at runtime, never commit it. macOS notarization runs on a `macos-latest` runner with `notarytool` + an App Store Connect API key.
- **Versioning**: semver tag for releases; a monotonic build number from `github.run_number` or the git commit count feeds `versionCode`/`CFBundleVersion`/Steam build description.

→ ready workflows per engine: `references/stores-and-ci.md`.

## Ship-time optimization

- **Texture compression per platform**: ASTC (mobile), BCn/DXT (desktop), ETC2 (GLES fallback). Set per-platform import overrides — never ship uncompressed PNGs to mobile.
- **Strip the fat**: Unity **Managed Stripping Level: High** + IL2CPP; Unreal **Shipping** drops logs/console; Godot — export only used resources and disable unused modules in a custom template.
- **Startup**: small boot scene, stream/preload heavy assets, compress the `.pck`/data, use Ogg Vorbis over WAV. Web: enable gzip/brotli on `.wasm`/`.pck`.
- **Budgets**: set a per-platform size budget (web especially — every MB is download latency) and check the final artifact against it before submitting.

## Anti-patterns — rationalization → STOP

| Rationalization | STOP — do this instead |
| --- | --- |
| "Web build works locally, host later" | Set COOP/COEP now; `file://`/simple servers hide the `SharedArrayBuffer` failure. |
| "I'll add C# web export for Godot" | It doesn't exist in 4.x. GDScript for web, or no web. |
| "Notarization is optional" | On macOS, no notarize+staple = Gatekeeper blocks the app for every user. |
| "Ship an APK to the Play Store" | Play requires **AAB** for new apps and updates. |
| "Commit the keystore so CI can sign" | Keystore/cert live in encrypted CI secrets, never in git. |
| "Ship the Development/Debug config" | Ship Godot release / Unity IL2CPP release / Unreal **Shipping** — debug leaks console + is slow. |
| "Templates are close enough (4.5 vs 4.5.1)" | Godot templates must match the editor build exactly or export breaks. |
| "Uncompressed textures are fine" | Per-platform compression (ASTC/BCn/ETC2) — raw textures blow memory + size. |
| "Reuse an old versionCode/CFBundleVersion" | Both must strictly increase or the store rejects the upload. |

## Related skills

- `godot`, `unity`, `unreal` — write the game; this skill exports/ships what they build. Draw the line at the export button.
- `deployment` — Docker/CI/hosting for **web apps & APIs**; borrow its GitHub Actions + header-setting patterns, but a WebAssembly game is static files, not a container.
- `gamedev-shaders`, `gamedev-multiplayer`, `gamedev-physics` — runtime subsystems packaged into the ship artifact, not configured here.
- `secure-coding` — signing-key and secret handling this skill assumes for keystores/certs in CI.

## Checklist

- [ ] Release/Shipping config, not Debug/Development.
- [ ] (Godot) export templates match the editor version exactly.
- [ ] (Web, threaded) COOP `same-origin` + COEP `require-corp` served; boots without `SharedArrayBuffer` errors.
- [ ] (Godot + web) confirmed GDScript, not C#/.NET.
- [ ] (macOS) codesigned (Hardened Runtime) + notarized + stapled.
- [ ] (Android) AAB for Play, JDK 17, release keystore in CI secrets, `versionCode` bumped.
- [ ] (iOS) provisioning profile + signing cert correct, `CFBundleVersion` bumped.
- [ ] Store assets: icons, splash, screenshots, metadata, age rating done.
- [ ] Version/build number set from CI and traceable.
- [ ] Textures compressed per platform; build size within budget.

## References

- `references/web-export-headers.md` — cross-origin isolation deep dive: COOP/COEP per host (Netlify/Vercel/nginx/itch/GitHub Pages), the `coi-serviceworker` shim, COEP subresource fallout, self-test snippet, Godot vs Unity web specifics.
- `references/mobile-and-desktop.md` — Android keystore + Gradle template + Play App Signing; iOS provisioning/TestFlight; full macOS codesign→notarytool→staple; Windows Authenticode; Linux AppImage/Flatpak.
- `references/stores-and-ci.md` — Steamworks/SteamPipe VDF upload, itch.io butler channels, Play/App Store submission checklists, and per-engine GitHub Actions headless-build workflows with signing.
