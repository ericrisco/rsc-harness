# Build, platforms & player settings (Unity 6)

Reference: Unity Manual "Build Profiles", "Player Settings", "IL2CPP".

## Build Profiles (Unity 6) — replaces the old Build Settings window

`File → Build Profiles`. A **Build Profile** is a saved, per-platform configuration:
- **Scene List** — which scenes are included and their build index (index 0 = first/boot scene). Scenes
  not in the list can only be loaded Additively if already present, so register everything you load.
- **Target platform & architecture** — Windows/macOS/Linux, Android, iOS, WebGL, consoles.
- **Overrides** — a profile can override Player Settings (e.g. a "Demo" profile with a different bundle id).

`Shared Settings` hold the defaults; each profile diffs from them. Build with `Build` or `Build And Run`.
Headless/CI builds go through `BuildPipeline.BuildPlayer` in an editor script.

## Scripting backend: IL2CPP vs Mono

`Player Settings → Configuration → Scripting Backend`:

| | IL2CPP | Mono |
| --- | --- | --- |
| How | C# → IL → C++ → native (AOT) | JIT at runtime |
| Platforms | required for iOS, WebGL, consoles; available desktop/Android | Editor + desktop + Android |
| Runtime speed | faster | slower |
| Build time | slower | faster (good for iteration) |
| Reverse-engineering | harder | easier |
| Reflection/`dynamic` | AOT limits (no runtime codegen; `System.Reflection.Emit` unsupported) | full |

Ship production builds on **IL2CPP**; iterate in the Editor (always Mono/interpreted). IL2CPP + AOT means
generic code reached only via reflection can be stripped — see managed stripping below.

## Player Settings essentials

- **Identity**: Company Name, Product Name, **bundle identifier** (`com.company.game` — must match store
  listing), version + build/bundle number.
- **Icons & splash**, default orientation (mobile), resolution/presentation.
- **API Compatibility Level**: `.NET Standard 2.1` (default, smaller) vs `.NET Framework` (broader API,
  larger). Prefer Standard unless a dependency needs Framework.
- **Managed Stripping Level** (`Minimal`/`Low`/`Medium`/`High`): strips unused IL to shrink builds. High
  can strip types only used via reflection/serialization — preserve them with a `link.xml` or
  `[Preserve]`.
- **Graphics APIs** per platform (Vulkan/Metal/D3D12/GLES3/WebGPU), color space (Linear recommended).

## Platform quick-notes

- **WebGL**: IL2CPP only; **no multithreading by default** (so `System.Threading`/most `Task`
  parallelism is unavailable — `Awaitable` frame awaits are fine); no synchronous file I/O; build size
  and memory matter; use compression (Brotli/Gzip) + a server that serves the right headers.
- **Android**: set target/min SDK, choose ARM64 (required for Play Store), build **AAB** for the store
  (APK for sideload). Configure keystore signing.
- **iOS**: Unity emits an Xcode project; sign & archive in Xcode. IL2CPP + ARM64.
- **Desktop**: simplest; Mono or IL2CPP.

## Rendering pipeline choice (affects builds & shaders)

- **URP** (Universal RP) — default for most 2D/3D projects, scales phone→desktop.
- **HDRP** — high-end desktop/console visuals.
- **Built-in** — legacy; new projects should pick URP/HDRP.

Pipeline choice changes materials and shader authoring — see the `gamedev-shaders` skill.

## Handoff

Store submission, signing, size budgets, certification, and release ops belong to the `gamedev-shipping`
skill. This reference stops at producing a correct platform build from the Editor.
