---
name: compose-multiplatform
description: "Use when building one shared Compose UI in Kotlin across Android, iOS, and desktop — commonMain @Composables, expect/actual, source-set placement, native interop, multiplatform ViewModel/navigation/Koin. NOT a single-platform native build (that is kotlin-android / swift-ios), and NOT Dart/Flutter cross-platform UI (that is flutter)."
tags: [kotlin, kmp, compose-multiplatform, cross-platform, shared-ui, expect-actual, ios, android]
recommends: [kotlin-android, swift-ios, flutter, tauri]
origin: risco
---

# Compose Multiplatform

You write **one** Compose UI tree in `commonMain` and let each platform be a thin host. The whole discipline is one sentence: **common by default, platform by exception.** Every line you put in `commonMain` ships to Android, iOS, and desktop unchanged; every line you put in a platform source set is a deliberate exception you should be able to justify.

## Versions floor (2026)

Pin these or the K2 compiler bites you. Verify against current docs before locking a project — these are the floors, not opinions.

- **Compose Multiplatform 1.11.0**, bundling Jetpack Compose 1.11.1.
- **Kotlin 2.1.0+** required (2.2.20 recommended for evolving iOS/Web targets). Since CMP 1.8.0 the **K2 compiler is mandatory**, so *every* dependency must compile against Kotlin 2.1.0+.
- **iOS is Stable** (production-ready since CMP 1.8.0, May 2025): feature parity for popular cases, type-safe navigation with deep linking, accessibility (VoiceOver, Full Keyboard Access).
- **Web is Beta** (CMP 1.9.0, Sept 2025), runs on WasmGC browsers. Do **not** promise Web parity — ship Android/iOS/desktop, pilot Web.
- Platform minimums: Android API 21, iOS 14+, macOS 13 arm64, Windows 10+, Ubuntu 20.04+, desktop JDK 11+ (17+ for `jpackage` packaging).

## Where does this code go?

This is the question you answer dozens of times a day. Default to the leftmost column that compiles.

| Source set | Put here | Concrete example | Never here |
|---|---|---|---|
| `commonMain` | Shared `@Composable`s, `ViewModel`s, business logic, common `interface`s, `expect` declarations | `@Composable fun GreetingScreen()`, `expect fun platformName(): String` | `android.*`, `platform.UIKit`, `java.awt`, `androidx.activity` |
| `androidMain` | `Activity`, `actual` using Android `Context`/`Build` | `class MainActivity : ComponentActivity` | iOS/desktop-only APIs |
| `iosMain` | `ComposeUIViewController` factory, `actual` via cinterop/`platform.*` | `fun MainViewController() = ComposeUIViewController { App() }` | `android.*` |
| `desktopMain` | `application {}` window, Swing interop | `application { Window(::exitApplication) { App() } }` | mobile-only APIs |
| `wasmJsMain` (Beta) | Web entry point | `ComposeViewport(document.body!!) { App() }` | anything you can't ship as Beta |

Why this matters: a platform import in `commonMain` breaks the build for *every other* target, and the error surfaces in the iOS link step, far from the offending line. Keep `commonMain` import-clean.

## Project structure (the 2026 default)

The current default KMP layout (announced May 2026, aligned with AGP 9.0) is **a dedicated `shared` KMP library module + per-platform app modules**, not the old single `composeApp`:

```text
my-app/
  shared/            # KMP library: commonMain holds the Compose UI tree
    src/
      commonMain/    # @Composables, ViewModels, expect declarations, DI
      androidMain/   # actual impls using android.*
      iosMain/       # actual impls + ComposeUIViewController
      desktopMain/   # actual impls + application {} window
      wasmJsMain/    # web entry (Beta)
  androidApp/        # thin Android host -> setContent { App() }
  iosApp/            # Xcode project -> embeds the shared framework
  desktopApp/        # ./gradlew :desktopApp:run
  webApp/            # WasmGC entry (Beta)
```

Split rule: if some screens are native and only *some* are shared Compose, split into **`sharedLogic`** (all platforms) + **`sharedUI`** (CMP platforms only). A server-inclusive project adds a root **`core`** module. Don't pre-split — start with one `shared` module and split when a platform genuinely needs native UI.

Source-set hierarchy — `commonMain` fans out, with intermediate sets where targets share code:

```text
commonMain
├── androidMain
├── desktopMain (jvm)
├── wasmJsMain (Beta)
└── iosMain (intermediate)
    ├── iosArm64
    └── iosSimulatorArm64
```

Scaffold a new project with **kmp.new** or the Kotlin Multiplatform wizard (IntelliJ IDEA 2025.2.2+ / Android Studio Otter 2025.2.1+ with the KMP plugin). Add a shared module to an *existing* Android app via Android Studio's **Shared Module Template**.

Minimal version-catalog plugin wiring (full Gradle in `references/project-setup.md`):

```kotlin
// gradle/libs.versions.toml
[versions]
kotlin = "2.2.20"
compose = "1.11.0"
agp = "9.0.0"

[plugins]
kotlinMultiplatform = { id = "org.jetbrains.kotlin.multiplatform", version.ref = "kotlin" }
composeMultiplatform = { id = "org.jetbrains.compose", version.ref = "compose" }
```

## expect / actual — the core mechanism

`expect`/`actual` is how you reach a platform API while keeping the call site common. Declare `expect` in `commonMain`; provide an `actual` in **every** target you compile.

```kotlin
// commonMain
expect fun platformName(): String
```

```kotlin
// androidMain
import android.os.Build
actual fun platformName(): String = "Android ${Build.VERSION.SDK_INT}"
```

```kotlin
// iosMain
import platform.UIKit.UIDevice
actual fun platformName(): String =
    UIDevice.currentDevice.systemName + " " + UIDevice.currentDevice.systemVersion
```

Rules, each with the reason it exists:

- **Every `expect` needs an `actual` in every compiled target.** An orphan `expect` is not a warning — it is a hard build failure (often only surfacing on the iOS target), so add the `actual` per target or remove the target.
- **Keep the common surface tiny.** Each `expect` symbol multiplies into N `actual`s you maintain; expose the smallest function, not a fat class.
- **Prefer a common `interface` + DI over deep `expect` trees** for anything you want to test or fake. `expect class` can't be mocked in common tests.

```kotlin
// Bad: deep expect class — N actuals, untestable in commonTest
expect class Database {
    fun query(sql: String): List<Row>
    fun close()
}
```

```kotlin
// Good: common interface, platform impls injected via Koin (fakeable in tests)
interface Database {
    fun query(sql: String): List<Row>
    fun close()
}
// androidMain/iosMain provide SqliteDatabase implementing Database, bound in a Koin module.
```

## Native interop

You bridge in both directions. Shared Compose embeds native views; native hosts embed shared Compose.

- **iOS — native view inside shared Compose:** `UIKitView` / `UIKitViewController` with a factory lambda.
- **iOS — shared Compose inside SwiftUI:** wrap `ComposeUIViewController` in a `UIViewControllerRepresentable`.
- **Android:** `AndroidView` for native views; host the tree via `setContent { App() }` in an `Activity`.
- **Desktop:** `application { Window { App() } }`; Swing interop via `SwingPanel`.

Embed a native view through an *injected interface*, not a raw `expect` — so the common screen stays platform-agnostic and testable:

```kotlin
// commonMain
interface MapFactory { /* returns a platform map handle */ }

@Composable
fun MapScreen(mapFactory: MapFactory = koinInject()) {
    // iosMain provides the actual UIKitView wiring around mapFactory; see references/ios-interop.md
}
```

Full bridge patterns (`ComposeUIViewController` SwiftUI wrapper, native-view-factory-via-Koin, MapKit/camera, ViewModel lifecycle) live in `references/ios-interop.md` — read it before writing iOS interop.

## State, ViewModel, navigation, DI

- **`androidx.lifecycle.ViewModel` works in `commonMain`.** Obtain instances with `koin-compose-viewmodel`'s `koinViewModel { }` so they survive recomposition. iOS has **no built-in `ViewModelStoreOwner`** — tie the VM lifecycle to SwiftUI manually (KMP-ObservableViewModel lets SwiftUI observe Kotlin VMs).
- **Koin is the common DI runtime.** Define a shared `initKoin()` and call it from the Android `Application` and from iOS app init:

```kotlin
// commonMain
fun initKoin(config: KoinAppDeclaration? = null) = startKoin {
    config?.invoke(this)
    modules(appModule, platformModule)
}
```

- **Navigation:** `androidx.navigation` provides type-safe nav + deep links in `commonMain`.
- **Resources:** `compose.components.resources` generates `Res` accessors — `Res.string.app_name`, `Res.drawable.logo`, fonts — shared across all platforms.

## Running & packaging

- **Android:** run the `androidApp` run config (hosts via `setContent`).
- **iOS:** open `iosApp` in Xcode, or use the KMP iOS run config in the IDE.
- **Desktop:** `./gradlew :desktopApp:run`; package with `./gradlew :desktopApp:packageDistributionForCurrentOS` (needs **JDK 17+** for `jpackage`).
- **Web (Beta):** `./gradlew :webApp:wasmJsBrowserDevelopmentRun`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| `android.*` / `platform.UIKit` / `java.awt` import in `commonMain` | Breaks the build for every other target, error surfaces far away | `expect`/`actual` or inject via a common interface |
| `expect` with no `actual` for a target | Hard build failure on that target | Add an `actual` per compiled target or drop the target |
| Recreating a `ViewModel` each recomposition (`remember { VM() }` wrong) | State loss on every recompose | `koinViewModel { }` / hoist state |
| Treating Compose Web as production | Web is Beta (1.9), not Stable | Ship Android/iOS/desktop; pilot Web only |
| Kotlin < 2.1.0 with CMP 1.8+ | K2 incompatibility — deps fail to link | Bump to Kotlin 2.2.x |
| Deep `expect class` for testable logic | Can't fake in `commonTest` | Common `interface` + Koin-injected platform impl |
| Pre-splitting into `sharedLogic`/`sharedUI` on day one | Premature complexity, extra Gradle wiring | Start with one `shared` module; split when a platform needs native UI |

## Verify

After scaffolding or editing, run `scripts/verify.sh <project-dir>` (read-only, no Gradle/Xcode needed). It statically checks the structural invariants:

- a `commonMain` source set exists;
- every `expect` in `commonMain` has a matching `actual` in some platform source set (catches orphans);
- the Compose Multiplatform plugin (`org.jetbrains.compose`) and a Kotlin version are present, and Kotlin is >= 2.1.0 (K2 floor);
- no forbidden platform imports leak into `commonMain`.

It exits 0 on a clean or empty target and non-zero only on hard failures.
