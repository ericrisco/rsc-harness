---
name: kotlin-android
description: "Use when building or fixing a native Android app in Kotlin and Jetpack Compose on the UDF layered architecture — ViewModel/StateFlow, Hilt, Room, Retrofit, coroutines, type-safe Navigation, and the Gradle/AGP surface. NOT shared Android and iOS UI from one Kotlin codebase (that is `compose-multiplatform`)."
tags: [kotlin, android, jetpack-compose, hilt, room, coroutines, mvvm, clean-architecture]
recommends: [compose-multiplatform, spring-boot, java, testing-web, github-actions]
origin: risco
---

# Native Android with Kotlin & Compose

You build production native Android: **Kotlin + Jetpack Compose + the UDF layered
architecture** (UI → domain → data). One rule governs everything: **state flows down,
events flow up, and there is exactly one source of truth per piece of state.** Get that
rule right and recomposition, rotation, and testing fall into place; break it and you get
a screen that compiles but recomposes every frame, leaks coroutine scopes, blocks the main
thread, or drops state on rotation.

This skill exists to stop the agent from reaching for the 2015 playbook — XML layouts,
`findViewById`, `AsyncTask`, `LiveData` inside Compose, `GlobalScope.launch`, `MutableState`
exposed straight out of a `ViewModel`. Emit a buildable, idiomatic module, not a toy.

## Versions floor (2026)

These are **floors verified against current docs (2026-06)**. Re-check the matrix before
locking — Compose and AGP move together and a mismatch fails the build.

| Piece | Floor | Why it matters |
|---|---|---|
| Kotlin (KGP) | **2.2.x** | K2 compiler is default & Stable; KGP must align with AGP. |
| AGP | **9.2+** when using Compose | Compose's compileSdk 37 requires AGP ≥ 9.2.0. |
| compileSdk | **37** | Current Compose target. |
| minSdk | **24** | Practical modern floor (~99% devices); Compose technically supports 21+. |
| JDK (build) | **17** | Required by current AGP/Compose toolchain. |
| Compose BOM | **2026.05.01** → Compose 1.11.2 | Pin artifacts via the BOM, never per-artifact versions. |
| Navigation | **2.8+** | Type-safe `@Serializable` routes land here. |
| Hilt + Room + Retrofit | current | DI / persistence / network. Wire Room & Hilt with **KSP, not kapt**. |
| Serialization | kotlinx.serialization | Retrofit converter + Navigation route types. |

## The architecture in one screen

Three layers. Higher layers depend on lower; never the reverse.

```text
UI layer      Composable (stateless) ── reads ──> UiState
                     │ events up                  ▲ state down
              ViewModel exposes StateFlow<UiState> │
                     │ calls
domain layer  (optional) UseCase — only when logic spans repos or is reused
                     │ calls
data layer    Repository (interface in domain, impl here)
                  ├── Room DAO  → Flow   (single source of truth)
                  └── Retrofit  → suspend (refreshes the source of truth)
```

- **UI** is dumb: render `UiState`, send events. No business logic in a `@Composable`.
- **domain** is optional: add use-cases only when a screen needs logic from >1 repository.
- **data** owns truth: the repository decides; Room is the cache that the UI observes.

Offline-first means **Room is the source of truth**. The network writes into Room; the UI
observes Room's `Flow`. `WorkManager` does background sync. The UI never reads the network
directly.

## State & recomposition

Each rule has a one-line reason.

- **Hoist state.** A composable that owns mutable state can't be reused or previewed — pass
  state in, send events out.
- **`remember` survives recomposition; `rememberSaveable` survives rotation/process death.**
  Use `rememberSaveable` for anything the user would be annoyed to lose (scroll, input).
- **`derivedStateOf` for computed state** — recomputes only when its inputs change, not every
  recomposition.
- **`key()` / stable keys in `LazyColumn`** — without a stable item key, reorder/insert churns
  the whole list.
- **Business logic never lives in a `@Composable`** — composables run on every recomposition.

```kotlin
// Bad — logic + I/O in the composable; runs on every recomposition.
@Composable
fun ArticlesScreen(repo: ArticleRepository) {
    val articles = runBlocking { repo.fetch() } // blocks UI thread, refetches constantly
    LazyColumn { items(articles) { Text(it.title) } }
}

// Good — stateless UI driven by hoisted state; logic in the ViewModel.
@Composable
fun ArticlesScreen(state: ArticlesUiState, onRetry: () -> Unit) {
    when (state) {
        ArticlesUiState.Loading -> CircularProgressIndicator()
        is ArticlesUiState.Error -> ErrorView(state.message, onRetry)
        is ArticlesUiState.Success ->
            LazyColumn { items(state.articles, key = { it.id }) { Text(it.title) } }
    }
}
```

## ViewModel + UI state

Model the screen as a **sealed `UiState`** so impossible states (loading *and* error) can't
exist. Expose it as `StateFlow`, never a mutable type.

```kotlin
sealed interface ArticlesUiState {
    data object Loading : ArticlesUiState
    data class Success(val articles: List<Article>) : ArticlesUiState
    data class Error(val message: String) : ArticlesUiState
}

@HiltViewModel
class ArticlesViewModel @Inject constructor(
    repository: ArticleRepository,
) : ViewModel() {
    val uiState: StateFlow<ArticlesUiState> =
        repository.observeArticles()
            .map<List<Article>, ArticlesUiState> { ArticlesUiState.Success(it) }
            .catch { emit(ArticlesUiState.Error(it.message ?: "Unknown error")) }
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5_000),
                initialValue = ArticlesUiState.Loading,
            )
}
```

Collect it lifecycle-aware so collection pauses below `STARTED` and you don't burn work
off-screen:

```kotlin
@Composable
fun ArticlesRoute(viewModel: ArticlesViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    ArticlesScreen(state = state, onRetry = viewModel::refresh)
}
```

`WhileSubscribed(5_000)` keeps the flow alive 5s past the last collector so a rotation
doesn't restart the upstream pipeline.

## Data layer

The repository interface lives in domain; its implementation lives in data. Retrofit uses
`suspend` functions and a `@Serializable` DTO; Room DAOs return `Flow`. Errors surface as a
sealed result, not raw exceptions thrown into the UI.

```kotlin
interface ArticleRepository {
    fun observeArticles(): Flow<List<Article>>   // from Room — the source of truth
    suspend fun refresh()                         // network -> Room
}
```

The full wired example — DTO, entity, DAO, Retrofit service, repository impl, mappers,
offline-first refresh — is in **[references/architecture.md](references/architecture.md)**.
Read it before scaffolding a feature end-to-end.

## DI with Hilt

`@HiltAndroidApp` on the `Application`, `@Module @InstallIn(SingletonComponent::class)` for
bindings, `@HiltViewModel` + `hiltViewModel()` for screens. Prefer **constructor injection**;
reach for `@Provides`/`@Binds` only for interfaces and third-party types you don't own.

Classic error: `MyRepo cannot be provided without an @Inject constructor`. Fix one of:
either add `@Inject constructor(...)` to the concrete class, or `@Binds` the interface to its
implementation inside an installed module. See **[references/gradle-setup.md](references/gradle-setup.md)**
for the KSP wiring that makes Hilt generate.

## Coroutines & Flow rules

- **Never `GlobalScope.launch`** — it outlives every screen and leaks. Use `viewModelScope`
  (UI logic) or a repository-scoped scope.
- **Structured concurrency**: a cancelled parent cancels children — keep work inside a real
  scope so navigation-away cancels it.
- **Inject dispatchers** (`@IoDispatcher CoroutineDispatcher`) instead of hardcoding
  `Dispatchers.IO` — otherwise the work isn't testable.
- **`flowOn` to switch a flow's upstream context**, not `withContext` inside a `flow { }`
  builder (which is a context-preservation violation).
- **Cold `Flow` for streams, `StateFlow` for current-value state** — don't `collect` a cold
  flow when the UI needs the latest value.

## Navigation (type-safe)

Since Navigation 2.8, routes are `@Serializable` types — the compiler checks your args.

```kotlin
@Serializable data object ArticleList
@Serializable data class ArticleDetail(val id: String)

NavHost(navController, startDestination = ArticleList) {
    composable<ArticleList> {
        ArticlesRoute(onOpen = { navController.navigate(ArticleDetail(it)) })
    }
    composable<ArticleDetail> { backStackEntry ->
        val args = backStackEntry.toRoute<ArticleDetail>()
        ArticleDetailRoute(id = args.id)
    }
}
```

No string routes, no manual `arguments = listOf(navArgument(...))`, no fragile key parsing.

## Build & verify

```bash
./gradlew :app:assembleDebug lintDebug testDebugUnitTest
```

`assembleDebug` proves it builds, `lintDebug` catches Android lint, `testDebugUnitTest` runs
JVM unit tests. For a fast, **SDK-free** static gate over the Kotlin/Gradle you just wrote,
run `scripts/verify.sh` — it greps for banned patterns and missing modern ones without
touching the Android SDK, so it works in CI or a bare checkout.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| XML layouts + `findViewById` | Stale; no compile-time view safety; doesn't compose | Jetpack Compose `@Composable` |
| `LiveData` collected in a Composable | Lifecycle mismatch, extra dependency, not Compose-native | `StateFlow` + `collectAsStateWithLifecycle()` |
| `GlobalScope.launch` | Leaks; outlives the screen; uncancellable | `viewModelScope` / scoped coroutine |
| `runBlocking` / network call on the main thread | ANR, frozen UI | `suspend` on an injected dispatcher |
| Business logic in a `@Composable` | Runs every recomposition; untestable | Move to ViewModel / use-case |
| `MutableStateFlow`/`mutableStateOf` exposed publicly | UI can mutate state; breaks single source of truth | private mutable backing + public `asStateFlow()`/`StateFlow` |
| God-Activity holding all state | Untestable, rotation-fragile | One ViewModel per screen, hoisted state |
| `kapt` for Room/Hilt | Slow, legacy; K2-incompatible edge cases | **KSP** |
| `collectAsState()` in Compose | Keeps collecting off-screen, wastes work | `collectAsStateWithLifecycle()` |
| Reading the network directly in the repository's read path | No offline; UI flickers on every fetch | Room as source of truth; network refreshes it |

## When this is the wrong skill

- **Shared UI across Android + iOS + desktop from one Kotlin codebase** — the moment
  `commonMain`, `expect/actual`, or an iOS target appears, use
  [../compose-multiplatform/SKILL.md](../compose-multiplatform/SKILL.md).
- **Server-side Kotlin / JVM web backend** the app talks to → [../spring-boot/SKILL.md](../spring-boot/SKILL.md).
- **Pure Kotlin/JVM language questions, no Android** → [../java/SKILL.md](../java/SKILL.md) is the
  nearest JVM-language sibling (there is no standalone `kotlin` language skill).
- **iOS/SwiftUI** → `swift-ios`. **Dart cross-platform** → [../flutter/SKILL.md](../flutter/SKILL.md).
  **React Native** → `react-native`.
- **CI for `assembleDebug`/tests** → `github-actions`.

## References

- [references/architecture.md](references/architecture.md) — end-to-end wired feature
  (UiState + ViewModel + Repository + Room + Retrofit + Hilt), complete file contents.
- [references/gradle-setup.md](references/gradle-setup.md) — `libs.versions.toml`, root +
  module `build.gradle.kts`, the Compose Kotlin plugin, Hilt/KSP wiring, and common
  Gradle/build error fixes.
