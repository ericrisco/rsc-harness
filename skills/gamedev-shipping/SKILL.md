---
name: gamedev-shipping
description: "Use when exporting, packaging, signing, or publishing a game — export presets per engine, macOS notarization, cross-origin isolation for threaded web builds, Android AAB/keystore, iOS provisioning, store submission (Steam, Play, App Store, itch.io), headless build CI. NOT gameplay code inside the artifact (that is `godot`, `unity`, `unreal`), NOT hosting a web app or container (that is `deployment`)."
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

## When NOT to use — and who owns it instead

| Ask | Owner | Why the line is there |
| --- | --- | --- |
| Gameplay, shaders, netcode, physics — any runtime logic | `../godot/SKILL.md`, `../unity/SKILL.md`, `../unreal/SKILL.md`, `../gamedev-shaders/SKILL.md`, `../gamedev-multiplayer/SKILL.md`, `../gamedev-physics/SKILL.md` | This skill packages code, it does not write it. The boundary is the export button. |
| Hosting a normal web app, API or container (Dockerfile, Coolify, Vercel, VPS) | `../deployment/SKILL.md` | A WebAssembly game is *static files*; only its **headers** are special (below). Borrow its Actions + header-setting patterns. |
| Game feel, economy, narrative | `../game-design/SKILL.md`, `../game-storytelling/SKILL.md` | Design intent, not packaging. |
| Signing-key and CI secret handling in general | `../secure-coding/SKILL.md` | The practice this skill assumes for keystores/certs. |

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

→ full per-engine preset/flag tables: [references/mobile-and-desktop.md](references/mobile-and-desktop.md)
and [references/stores-and-ci.md](references/stores-and-ci.md).

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

→ per-host configs, the service-worker shim, COEP subresource fallout, a self-test snippet and the
Godot vs Unity web specifics: [references/web-export-headers.md](references/web-export-headers.md).

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

→ full keystore + Play App Signing, provisioning/TestFlight, Windows Authenticode and Linux
AppImage/Flatpak walkthroughs: [references/mobile-and-desktop.md](references/mobile-and-desktop.md).

## Store prep

- **Assets**: platform icons (Android adaptive, iOS icon set, Windows `.ico`, macOS `.icns`), splash/launch, store screenshots per device class, a trailer where required.
- **Metadata**: title, short + full description, keywords, category, support/privacy URLs, localized strings.
- **Age ratings**: fill the **IARC** questionnaire (Play, Microsoft, Nintendo) or ESRB/PEGI/USK; Apple has its own age-rating questionnaire. Wrong answers = removal.
- **Google Play**: AAB + **Play App Signing**, a recent **target API level**, content rating, and the **Data safety** form.
- **Steam**: Steamworks partner + appid; define **depots**; upload with **SteamPipe** (`steamcmd +run_app_build app_build_APPID.vdf`); store page assets; set the branch live.
- **itch.io**: `butler push build/ user/game:channel --userversion 1.2.3` — channel name (e.g. `windows`, `html5`) picks the platform.
- **Mac App Store**: Apple Distribution cert + App Sandbox entitlements (not Developer ID); notarization is handled by App Store submission.

→ Steamworks/SteamPipe VDF, butler channels, Play/App Store submission checklists:
[references/stores-and-ci.md](references/stores-and-ci.md).

## CI/CD for builds

Headless export in GitHub Actions; version from the run/commit so every artifact is traceable.

- **Godot**: run in a container that bundles matching export templates (e.g. a `barichello/godot-ci`-style image), `godot --headless --export-release`.
- **Unity**: `game-ci/unity-builder` + a license activation step (secrets); matrix over targets.
- **Unreal**: needs a **self-hosted runner** with the engine installed (multi-GB); UAT `BuildCookRun`.
- **Signing in CI**: import the keystore/cert from an encrypted secret at runtime, never commit it. macOS notarization runs on a `macos-latest` runner with `notarytool` + an App Store Connect API key.
- **Versioning**: semver tag for releases; a monotonic build number from `github.run_number` or the git commit count feeds `versionCode`/`CFBundleVersion`/Steam build description.

→ ready per-engine workflows with signing: [references/stores-and-ci.md](references/stores-and-ci.md).

## Ship-time optimization

- **Texture compression per platform**: ASTC (mobile), BCn/DXT (desktop), ETC2 (GLES fallback). Set per-platform import overrides — never ship uncompressed PNGs to mobile.
- **Strip the fat**: Unity **Managed Stripping Level: High** + IL2CPP; Unreal **Shipping** drops logs/console; Godot — export only used resources and disable unused modules in a custom template.
- **Startup**: small boot scene, stream/preload heavy assets, compress the `.pck`/data, use Ogg Vorbis over WAV. Web: enable gzip/brotli on `.wasm`/`.pck`.
- **Budgets**: set a per-platform size budget (web especially — every MB is download latency) and check the final artifact against it before submitting.

## Anti-patterns

| Anti-pattern | Do instead |
| --- | --- |
| Web build works locally, host it later | Set COOP/COEP now; `file://` and simple servers hide the `SharedArrayBuffer` failure. |
| Planning a Godot C# web export | It doesn't exist in 4.x. GDScript for web, or no web. |
| Treating notarization as optional | On macOS, no notarize + staple = Gatekeeper blocks the app for every user. |
| Shipping an APK to the Play Store | Play requires **AAB** for new apps and updates. |
| Committing the keystore so CI can sign | Keystore/cert live in encrypted CI secrets, never in git. |
| Shipping the Development/Debug config | Ship Godot release / Unity IL2CPP release / Unreal **Shipping** — debug leaks console + is slow. |
| Export templates "close enough" (4.5 vs 4.5.1) | Godot templates must match the editor build exactly or export breaks. |
| Uncompressed textures | Per-platform compression (ASTC/BCn/ETC2) — raw textures blow memory + size. |
| Reusing an old versionCode/CFBundleVersion | Both must strictly increase or the store rejects the upload. |

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
