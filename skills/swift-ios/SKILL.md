---
name: swift-ios
description: "Use when building native iOS and Apple-platform apps in Swift with SwiftUI and modern Swift concurrency — observable view models, Swift 6 strict data-race diagnostics, async/await and actors, SwiftData persistence, NavigationStack, and Swift Testing. NOT cross-platform Dart (that is `flutter`), NOT React Native (that is `react-native`), NOT native Kotlin for Android (that is `kotlin-android`), NOT shared KMP code across both OSes (that is `compose-multiplatform`)."
tags: [swift, swiftui, ios, swift-concurrency, swiftdata, swift-testing, apple]
recommends: [kotlin-android, compose-multiplatform, flutter, react-native, expo, testing-web, github-actions, ship]
profiles: []
origin: risco
---

# swift-ios

Native Apple-platform apps: the code is `.swift`, the UI is SwiftUI, and the compiler enforces actor isolation. If the answer is a `@MainActor`, `@Observable`, `async let`, `#expect`, `NavigationStack`, or `@Model`, you are in the right place.

## First move: match the project before you write a line

Mismatched language modes produce diagnostics you cannot reproduce and "fixes" that break the user's build. Pin the ground truth first.

```bash
swift --version                               # exact toolchain
xcodebuild -version                           # Xcode version
# In the .xcodeproj / Package.swift, read two settings per target:
#   SWIFT_VERSION (Swift Language Version: 5 or 6)
#   SWIFT_DEFAULT_ACTOR_ISOLATION (Default Actor Isolation: nonisolated or MainActor)
```

Assumed baseline: **Xcode 26 / Swift 6.2 / iOS 26 SDK** (current stable seen is Xcode 26.2 / Swift 6.2.3). Do not quote a version you have not confirmed in the user's project. Rule: **write for the target's actual language mode.** Swift 5-mode code dropped into a Swift 6 target (or vice-versa) is the most common source of "it compiles on my machine" failures.

## State & view architecture

For new code use `@Observable` (the Observation framework), never `ObservableObject` / `@Published`. Why: Observation tracks per-property — a view re-renders only when a property it actually reads changes, not on every object mutation.

| Property wrapper | Use it when | One-line why |
| --- | --- | --- |
| `@State` | The view *owns* a value or an `@Observable` instance | Lifecycle tied to the view; survives re-renders |
| `@Binding` | A child needs write access to a parent's value | Passes a mutable reference down, no ownership |
| `@Bindable` | You need two-way bindings *into* an `@Observable` | Produces `$model.field` for `TextField` etc. |
| `@Environment` | Dependency injection of a shared `@Observable` | One source of truth, no prop-drilling |

`@Observable` gives you **zero** thread safety. Mutating an observed property off the main actor races the UI. Annotate UI models `@MainActor`.

```swift
// Bad — legacy pattern, whole-object invalidation, no isolation
final class CounterModel: ObservableObject {
    @Published var count = 0
}

// Good — per-property tracking, main-actor isolated
@MainActor @Observable
final class CounterModel {
    var count = 0
}

struct CounterView: View {
    @State private var model = CounterModel()      // view owns it
    var body: some View {
        Stepper("\(model.count)", value: $model.count)  // @State gives bindings to @Observable
    }
}
```

## Concurrency correctness (the core)

The mental model: SwiftUI runs on the main actor. Anything that touches UI state is main-actor work. Background work hops off, then hops back to mutate.

- **`@MainActor` class** for UI/view-model state — it *is* the UI thread.
- **`actor`** for shared *non-UI* mutable state (a cache, a connection pool). Never model a SwiftUI view model as an `actor` — actors are reentrant and not main-bound, so your UI updates land off-main.
- **`Task { }`** inherits the current actor + priority — use it to fire async work from a `Button`. **`Task.detached`** inherits nothing and is almost never what you want; reaching for it to silence a warning is a bug, not a fix.
- **`async let` / `TaskGroup`** for structured parallelism (fan out, then `await` all).
- **Cancellation is mandatory**: check `Task.isCancelled` or `try Task.checkCancellation()` in loops. SwiftUI's `.task {}` auto-cancels when the view disappears — prefer it over a bare `Task {}` for view-lifetime work.

The #1 footgun — mutating observed UI state off the main actor:

```swift
// Bad — detached task mutates main-isolated state; intermittent glitches + Swift 6 data-race warning
@MainActor @Observable final class Feed {
    var items: [Item] = []
    func load() {
        Task.detached {
            let data = try? await API.fetch()
            self.items = data ?? []          // off-main mutation: WRONG
        }
    }
}

// Good — Task {} inherits the main actor; await off-main work, mutation lands on-main
@MainActor @Observable final class Feed {
    var items: [Item] = []
    func load() async {
        do {
            items = try await API.fetch()    // await suspends; assignment is back on main
        } catch is CancellationError {
            // view disappeared — nothing to do
        } catch {
            // surface error
        }
    }
}
// In the view: .task { await feed.load() }   // auto-cancels on disappear
```

Escape hatch for UI-centric apps: set **Default Actor Isolation = MainActor** (SE-0466) on the target — unannotated code becomes main-actor-isolated by default, killing false-positive data-race warnings; you opt *out* with `nonisolated` only where you genuinely need it. The full diagnostic catalog, Sendable rules, and the staged Swift 6 migration live in [references/concurrency.md](references/concurrency.md).

## Persistence

| Choice | Use when |
| --- | --- |
| **SwiftData** (default) | New SwiftUI apps; relational/object graph; light-to-moderate migration needs |
| Core Data | Advanced/custom migrations, mature `NSPersistentCloudKit` edge cases |
| Files (`Codable` → disk) | Trivial, non-relational blobs only |

```swift
import SwiftData

@Model final class Workout {
    var name: String
    var minutes: Int
    init(name: String, minutes: Int) { self.name = name; self.minutes = minutes }
}

// App entry: attach the container once
WindowGroup { ContentView() }.modelContainer(for: Workout.self)

// In a view: query + mutate
struct ListView: View {
    @Query(sort: \Workout.name) private var workouts: [Workout]
    @Environment(\.modelContext) private var context
    var body: some View {
        List(workouts) { Text($0.name) }
            .toolbar { Button("Add") { context.insert(Workout(name: "Run", minutes: 30)) } }
    }
}
```

Bad: hand-rolling JSON-to-disk for relational data with cross-references. Good: model the relationship with `@Model` and let SwiftData own identity and autosave.

## Navigation

Use `NavigationStack` with a value-typed `path` + `navigationDestination(for:)` — type-safe, programmatic, and deep-linkable. `NavigationView` is deprecated.

```swift
// Bad
NavigationView { List(items) { NavigationLink(item.name, destination: DetailView(item: item)) } }

// Good — push by value, deep-link by mutating the path
@State private var path: [Item] = []
NavigationStack(path: $path) {
    List(items) { item in NavigationLink(item.name, value: item) }
        .navigationDestination(for: Item.self) { DetailView(item: $0) }
}
// Deep link: path = [parent, child]
```

Use `NavigationSplitView` for iPad/Mac multi-column layouts.

## Testing

Swift Testing is the default (Xcode 16+, matured through Xcode 26): `@Test`, `#expect` (soft — keeps running), `#require` (hard — throws/unwraps), `@Test(arguments:)` for parameterized cases, `@Suite` types, parallel + in-process by default.

```swift
import Testing
@testable import MyApp

@Suite struct ScoreTests {
    @Test func startsAtZero() { #expect(Score().value == 0) }

    @Test(arguments: [1, 2, 3]) func adds(_ n: Int) {
        var s = Score(); s.add(n)
        #expect(s.value == n)
    }

    @Test func requiredUser() throws {
        let user = try #require(UserStore().current)   // hard stop if nil
        #expect(user.isActive)
    }
}
```

UI automation (`XCUIApplication`) and performance (`XCTMetric`) **stay in XCTest** — both frameworks coexist in one target. Run: `xcodebuild test -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 17'`. Depth (traits, `confirmation` for async events, in-memory `ModelContainer` for SwiftData, the XCTest migration table) in [references/testing.md](references/testing.md).

## Build / run loop

```bash
xcodebuild -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 17' build
xcodebuild -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 17' test
xcrun simctl list devices                 # manage simulators
swift build && swift test                 # SwiftPM packages (libraries / modular targets)
```

App = `.xcodeproj`/`.xcworkspace` built with `xcodebuild`. Library or shared module = `Package.swift` built with `swift build`; use SwiftPM to pin dependency versions.

## iOS 26 adoption (brief)

New surface: Liquid Glass via `.glassEffect()` (no `UIVisualEffectView`), the `@Animatable` macro for custom animatable shapes, native SwiftUI `WebView`, `Chart3D`, richer `TabView` roles. Adopt them behind `if #available(iOS 26, *)`; do not casually raise the whole deployment target — most apps still support N-1/N-2.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
| --- | --- | --- |
| `actor` for a SwiftUI view model | Reentrant, not main-bound → UI mutates off-main | `@MainActor @Observable` class |
| `Task.detached` to silence a warning | Drops actor + priority inheritance; hides the real race | `Task {}` or `.task {}` |
| `@nonisolated(unsafe)` to quiet isolation errors | Disables the safety you turned on; the race remains | Make the type `Sendable` or keep it main-isolated |
| `DispatchQueue.main.async` inside an `@Observable` model | Old concurrency model fighting actors | Annotate the model `@MainActor` |
| `ObservableObject` / `@Published` for new code | Whole-object invalidation, no isolation help | `@Observable` |
| `NavigationView` | Deprecated, no type-safe path | `NavigationStack` + `navigationDestination` |
| Blocking the main actor with sync network/disk I/O | Freezes the UI | `await` async work, hop back to main to mutate |
| `@MainActor` on pure compute / leaf utilities | Needless serialization onto the UI thread | Leave it `nonisolated` |
| `XCTAssert` in a new Swift Testing file | Mixing frameworks; loses `#expect` diagnostics | `#expect` / `#require` |
| Force-unwrapping `@Query` / fetch results | Crashes on empty store | Handle the empty case |

## Cross-references

- Native Android in Kotlin/Compose → [../kotlin-android/SKILL.md](../kotlin-android/SKILL.md)
- One codebase for iOS + Android via KMP/CMP → [../compose-multiplatform/SKILL.md](../compose-multiplatform/SKILL.md)
- Cross-platform Dart → [../flutter/SKILL.md](../flutter/SKILL.md)
- React Native runtime / native modules → [../react-native/SKILL.md](../react-native/SKILL.md); the EAS/OTA shipping pipeline → [../expo/SKILL.md](../expo/SKILL.md)
- Store submission / release process → [../ship/SKILL.md](../ship/SKILL.md)
- Cloud CI build/sign and the non-Swift test stack are siblings (`github-actions`, `testing-web`) — see `recommends`.
