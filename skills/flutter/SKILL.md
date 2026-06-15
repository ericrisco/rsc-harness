---
name: flutter
description: "Use when building, structuring, testing or optimizing a Flutter app (Dart 3, Riverpod 3 / Bloc, go_router, Material 3, freezed, widget & golden tests). Triggers: creating a Flutter feature, choosing state management, wiring navigation/auth guards, modeling async/error state, JSON/dio data layer, killing widget rebuilds/jank, or writing widget/golden/integration tests. Stack: Flutter 3.44 / Dart 3.12."
tags: [flutter, dart, mobile, app, ios, android]
recommends: [design, deployment]
origin: risco
---

# Flutter & Dart app architecture

## What this skill is

The opinionated default stack for a production Flutter app: **feature-first + layered**
folders, **Riverpod 3** with codegen for shared/async state, a **typed go_router**, **freezed**
immutable models, a **dio** data layer, and explicit `Result<T, Failure>` error modeling — all on
**Material 3**. Escape hatches exist and are first-class: use **Bloc/Cubit** instead of Riverpod when
the team already runs Bloc, and raw `http`/`get_it` are allowed — but **pick one of each per app, never
mix two**. Pinned versions this skill targets: **Flutter 3.44 / Dart 3.12**, **Riverpod 3.0**,
**go_router 17.2.x** (+ `go_router_builder 4.3.x`), **freezed 3.x** / `json_serializable`, **dio 5.x**,
**mocktail 1.x**. When you load this skill inside the user's repo, it touches only the `pubspec.yaml`
subproject — never the FastAPI/Go/Next.js siblings.

## When to use / When NOT to use

> **⚠️ SDD new-feature gate — read this first.** If this skill fired on a **new, non-trivial feature or behaviour change** and there is **no approved spec + plan** under `02-DOCS/wiki/sdd/`, STOP — do **not** write feature code yet. Hand off to `../specify/SKILL.md` first: it runs brainstorm → spec → plan → tasks before any code, then routes back here once the plan is approved. Build here directly only for a genuinely one-line / low-risk change. Method: `../sdd/SKILL.md`.

**Use when:**

- Building a new Flutter feature or screen, or choosing/refactoring state management.
- Setting up routing, DI, theming, or the data layer; reviewing Dart for null-safety, sealed/pattern
  matching, immutability, async-gap discipline, or rebuild hygiene.
- Investigating performance/jank, wiring build flavors, or scaffolding unit/widget/golden/integration tests.

**Do NOT use when:**

- The UI is Compose Multiplatform, native Android-Kotlin, or SwiftUI — use the Compose/native skill.
- It is a pure Dart **server/CLI** with no widget tree — general Dart applies, but skip the UI/nav/perf references.
- The work is on a FastAPI/Go/Next.js sibling in the same monorepo — use that skill; this one only owns the Flutter subproject.
- It is a single-file throwaway sample — note that architecture is overkill, do not impose layering.

## Decision rules

| Situation | Do this | Not that |
|---|---|---|
| Ephemeral UI state (checkbox, slider, anim) | `setState` / `ValueNotifier` locally | a global provider |
| Shared / async state | Riverpod `@riverpod` `Notifier`/`AsyncNotifier` | scattered `setState` across pages |
| Team already on Bloc | Cubit (simple) / Bloc (event-sourced) | mixing Bloc + Riverpod in one app |
| Multi-state async | `AsyncValue` / sealed state | `bool isLoading` + `bool isError` flags |
| Navigation | one typed go_router | mixing `Navigator.push` with declarative routes |
| Errors at domain boundary | `Result<T, Failure>` / sealed | leaking `DioException` / raw `throw` to UI |
| Models / DTOs | `@freezed abstract class … with _$Name` | hand-written mutable classes |
| Cross-feature data | repository behind an interface | widgets calling `dio`/DB directly |

## Project layout

```text
lib/
  main.dart                 # bootstrap (shared)
  main_dev.dart             # flavored entrypoint -> runApp(const App(flavor: Flavor.dev))
  main_prod.dart
  app.dart                  # MaterialApp.router + ProviderScope wiring
  src/
    features/
      cart/
        presentation/       # widgets, screens, Riverpod consumers
        domain/             # entities, repository interfaces, Result/Failure (zero Flutter imports)
        data/               # DTOs, dio data sources, repository impls
    common/
      router/               # typed go_router + guards
      theme/                # ColorScheme.fromSeed, ThemeExtension tokens
      network/              # dio client + interceptors
      errors/               # Result, Failure sealed types
      widgets/              # shared reusable widgets
```

Dependencies point inward — `presentation → domain ← data`; `domain/` has **zero Flutter imports**.
See `references/architecture-and-state.md` for the full layering contract and a worked cart feature.

## Dart 3.12 idioms

**Null safety** — never reach for `!`:

```dart
// BAD  — bang crashes in prod when user is null
final n = user!.name;

// GOOD — null-aware + fallback
final n = user?.name ?? 'Unknown';

// GOOD — if-case pattern promotes the binding
if (user case User(:final name)?) {
  greet(name);
}

// GOOD — switch expression over a nullable is exhaustive
final label = switch (user) {
  User(:final name) => name,
  null => 'Guest',
};
```

**`late`** — only for guaranteed-before-first-access, prefer `late final`:

```dart
// BAD  — defers a null error to runtime
late String id;

// OK   — initialized in initState before any access
late final AnimationController _c;
```

**Records + destructuring** for concurrent multi-return (parallel, not sequential):

```dart
// Runs both requests at once; .wait is the Dart 3 record concurrency extension.
final (user, count) = await (repo.user(), repo.count()).wait;
```

**Sealed + exhaustive switch** eliminates impossible states:

```dart
sealed class JobState {}
final class JobIdle extends JobState {}
final class JobRunning extends JobState { const JobRunning(this.pct); final double pct; }
final class JobDone extends JobState { const JobDone(this.url); final String url; }

Widget build(JobState s) => switch (s) {
  JobIdle() => const Text('Idle'),
  JobRunning(:final pct) => LinearProgressIndicator(value: pct),
  JobDone(:final url) => Link(url),
}; // compiler errors if a variant is unhandled
```

**async-gap guard** after every `await` that precedes a `context`/`ref` use:

```dart
// In a State<T>:
await repo.save();
if (!context.mounted) return;
context.go('/done');

// Inside a Notifier (Riverpod 3):
await repo.save();
if (!ref.mounted) return;
ref.invalidate(listProvider);

// Fire-and-forget must be explicit, not a silently-dropped Future:
unawaited(analytics.log('checkout'));
```

**Streams** belong in a `StreamBuilder`, never a manual `.listen()` in `build`:

```dart
// BAD — leaks a subscription on every rebuild
@override
Widget build(BuildContext context) { stream.listen(_onData); return const SizedBox(); }
```

**Extension types** give zero-cost ID type-safety so the compiler rejects raw strings:

```dart
extension type UserId(String value) {}
extension type OrderId(String value) {}

void loadUser(UserId id) { /* ... */ }
// loadUser('o_42');           // BAD — compile error: String is not a UserId
loadUser(const UserId('u_7')); // GOOD
```

**Isolates** push CPU-bound work off the UI thread:

```dart
final parsed = await Isolate.run(() => heavyParse(jsonBig));
```

Error modeling → `references/architecture-and-state.md`; isolates deep dive → `references/performance.md`.

## State management: Riverpod 3 (default)

```dart
// Sync Notifier — list mutation. (Function providers for async reads and
// AsyncNotifier guarded mutation -> references/architecture-and-state.md.)
@riverpod
class CartNotifier extends _$CartNotifier {
  @override
  List<CartItem> build() => const [];

  void add(CartItem item) => state = [...state, item];
  void remove(String id) => state = state.where((i) => i.id != id).toList();
}
```

Render `AsyncValue` with an exhaustive switch; scope rebuilds with `.select()`:

```dart
final view = switch (ref.watch(productsProvider)) {
  AsyncData(:final value) => ProductList(value),
  AsyncError(:final error) => ErrorView(error),
  _ => const CircularProgressIndicator(),
};
final count = ref.watch(cartNotifierProvider.select((items) => items.length));
```

`ref.watch` rebuilds on change; `ref.read` is for callbacks only; `ref.listen` is for side-effects.
Riverpod 3 unifies Notifier/AsyncNotifier, merges `autoDispose`/`family` into the single `@riverpod`
annotation, exposes one `Ref` type, and adds automatic retry, a `Mutation` API, and `@Riverpod(keepAlive: true)`.
Legacy `StateProvider`/`ChangeNotifierProvider` live in `package:riverpod/legacy.dart` — **not for new code**.
Wrap the app root in `ProviderScope`. Codegen, `Mutation`, family-as-arg, persistence and the DI graph →
`references/architecture-and-state.md`. Testing → `references/testing.md`.

## State management: Bloc/Cubit (the alternative)

Cubit for simple state, Bloc (event → state) for complex/event-sourced flows.

```dart
sealed class AuthState {}
final class AuthInitial extends AuthState {}
final class AuthLoading extends AuthState {}
final class AuthAuthed extends AuthState { const AuthAuthed(this.user); final User user; }
final class AuthFailed extends AuthState { const AuthFailed(this.message); final String message; }

class AuthCubit extends Cubit<AuthState> {
  AuthCubit(this._repo) : super(AuthInitial());
  final AuthRepository _repo;

  Future<void> login(String email, String password) async {
    emit(AuthLoading());
    final res = await _repo.login(email, password);
    emit(res.fold((u) => AuthAuthed(u), (f) => AuthFailed(f.message)));
  }
}

// UI:
BlocBuilder<AuthCubit, AuthState>(
  builder: (context, state) => switch (state) {
    AuthInitial() || AuthLoading() => const CircularProgressIndicator(),
    AuthAuthed(:final user) => HomeView(user),
    AuthFailed(:final message) => ErrorView(message),
  },
);
```

```dart
// BAD  — a Bloc that depends on another Bloc
CartBloc(this.authBloc);
// GOOD — share the repository, not the Bloc
CartBloc(this.cartRepo);
```

**Pick one per app, never both.** Full event-driven Bloc, `BlocObserver`, and `hydrated_bloc` →
`references/architecture-and-state.md`.

## UI & navigation (essentials)

- Extract widgets to **classes, not `_build*()` methods** — enables `const`, element reuse and
  `RepaintBoundary` granularity. Use `const` everywhere; `ValueKey` in lists, **never `UniqueKey` in `build`**.
- Material 3 theming from a seed; read tokens via `Theme.of(context)`:

```dart
final theme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6750A4), brightness: Brightness.light),
);
// BAD  color: Colors.blue
// GOOD color: Theme.of(context).colorScheme.primary
```

- Typed go_router skeleton:

```dart
@TypedGoRoute<HomeRoute>(path: '/', routes: [TypedGoRoute<DetailRoute>(path: 'detail/:id')])
class HomeRoute extends GoRouteData with $HomeRoute {
  const HomeRoute();
  @override
  Widget build(BuildContext context, GoRouterState state) => const HomeScreen();
}

final router = GoRouter(
  routes: $appRoutes,
  refreshListenable: authListenable,
  redirect: (context, state) => authGuard(context, state),
);
const DetailRoute(id: '7').go(context); // typed navigation, no magic strings
```

Slivers, adaptive/responsive, deep links, `StatefulShellRoute`, design tokens and a11y →
`references/ui-and-navigation.md`.

## Data layer

```dart
final dio = Dio(BaseOptions(
  baseUrl: const String.fromEnvironment('API_URL'),
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 30),
));

dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) async {
    final token = await secureStorage.read(key: 'auth_token');
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  },
  onError: (error, handler) async {
    final isRetry = error.requestOptions.extra['_isRetry'] == true; // one-shot guard
    if (!isRetry && error.response?.statusCode == 401 && await refreshToken()) {
      error.requestOptions.extra['_isRetry'] = true;
      return handler.resolve(await dio.fetch(error.requestOptions));
    }
    handler.next(error);
  },
));
```

```dart
// GOOD — boundary returns a mapped Result; UI cannot crash on a wire error
Future<Result<Cart, Failure>> getCart();
// BAD  — leaks DioException into widgets
Future<Cart> getCart(); // throws DioException to the UI
```

DTOs are freezed/`json_serializable` and mapped via `CartDto.toDomain()`; **DTO ≠ entity**. Full
repository + `Result`/`Failure` + caching → `references/architecture-and-state.md`.

## Testing (gate)

```dart
// Unit — Riverpod 3 container helper.
final container = ProviderContainer.test();
final cart = container.read(cartNotifierProvider);

// Widget — override the controller with a fake.
await tester.pumpWidget(ProviderScope(
  overrides: [cartControllerProvider.overrideWith(FakeCartController.new)],
  child: const MaterialApp(home: CartScreen()),
));

// Golden — deterministic pixel comparison.
await expectLater(find.byType(CartCard), matchesGoldenFile('goldens/cart_card.png'));
```

**Every async state transition has a test (loading → data, loading → error).** `pumpAndSettle` hangs on
infinite animations (spinners) — use an explicit `pump(const Duration(milliseconds: 300))` there. Full
pyramid, repository tests, `blocTest`, golden determinism and coverage → `references/testing.md`.

## Performance (essentials)

- `const` + extract-to-class so only the changing subtree rebuilds.
- `RepaintBoundary` around independently-animating subtrees; `ListView.builder` for long lists.
- `cacheWidth`/`cacheHeight` to decode-at-size; cached network images with placeholder/error.
- Scoped consumers via `.select()` / `BlocSelector` / `buildWhen`.
- Profile in `flutter run --profile`; DevTools → "Track Widget Rebuilds", raster vs UI thread.

Rebuild/paint/jank workflow, isolates and build flavors → `references/performance.md`.

## Localization & dependency hygiene (essentials)

- l10n via first-party `flutter_localizations` + `gen_l10n` (set `generate: true`, add `l10n.yaml`); one
  **ARB** file per locale, strings read type-safely through `AppLocalizations.of(context)`.
- Plurals/genders use **ICU** syntax inside the ARB (`{count, plural, =0{…} =1{…} other{…}}`), never an
  `if (count == 1)` ladder in Dart.
- RTL: use `EdgeInsetsDirectional`/`AlignmentDirectional` (auto-mirrors); mirror directional icons, never
  logos or numbers. Format numbers/dates/currency with `intl` `NumberFormat`/`DateFormat` (locale-aware), never by hand.
- Before adding a dependency, check its **pub points**/popularity/last-publish on pub.dev; audit with
  `flutter pub outdated`. In a multi-package repo, **melos** orchestrates bootstrap/scripts and `package:`
  encapsulation (public API via `lib/<pkg>.dart`, internals under `lib/src/`, enforced by `implementation_imports`).

ARB + ICU plurals, RTL geometry, locale-aware formatting, pub points/pana, `melos` and workspace
encapsulation → `references/i18n-and-dependencies.md`.

## Production checklist

- `FlutterError.onError` + `PlatformDispatcher.instance.onError` + `ErrorWidget.builder` wired to Crashlytics/Sentry.
- Secrets via `--dart-define` / `--dart-define-from-file`; tokens in secure storage (Keychain / EncryptedSharedPreferences), **never plaintext**.
- HTTPS only.
- Strict `analysis_options.yaml`: `strict-casts` / `strict-inference` / `strict-raw-types` + `flutter_lints` or `very_good_analysis`.
- l10n via `flutter_localizations` + ARB (ICU plurals, RTL-safe geometry, locale-aware `intl` formatting);
  a11y (48px targets, `Semantics`, contrast ≥ 4.5:1).
- Dependency hygiene: `pubspec.lock` committed for apps, `flutter pub outdated` audited on a cadence,
  dependencies vetted by pub points before adding.
- No `print()` → `dart:developer` `log()`.

## Anti-patterns → STOP

| Rationalization | Reality |
|---|---|
| "I'll just `user!` here" | bang crashes in prod; use `?.`/`??` or an if-case pattern. |
| "`_buildHeader()` is fine" | extract to a `const` widget class — enables element reuse + const propagation. |
| "`bool isLoading` + `bool isError` is simpler" | allows impossible states; use `AsyncValue`/sealed. |
| "I'll `setState` at the top of the page" | rebuilds the whole subtree; scope it or `.select()`. |
| "global provider for this checkbox" | ephemeral UI state = local `setState`/`ValueNotifier`. |
| "mix `Navigator.push` with go_router for one screen" | one router; mixing breaks deep links + back stack. |
| "use `context` after `await`, it's fine" | guard `context.mounted` / `ref.mounted`; stale context crashes. |
| "hardcode `Colors.blue` just here" | use `colorScheme`; breaks dark mode + theming. |
| "`ListView(children: [...])` for the feed" | use `.builder`; the concrete form builds all children eagerly. |
| "`catch (e)` everything" | use `on`-typed clauses; never catch `Error` (it is a bug). |
| "ship raw `DioException.toString()` to the user" | map to a `Failure` with a localized message. |
| "`print()` for logging" | use `dart:developer` `log()` — has levels and can be filtered. |
| "use legacy `StateProvider`" | Riverpod 3 `Notifier`; legacy is `package:riverpod/legacy.dart` only. |
| "`pumpAndSettle` will fix the flaky test" | hangs on infinite animations; use explicit `pump(Duration)`. |

## Quick reference

| Concern | Default API | Reference |
|---|---|---|
| model | `@freezed` | `references/architecture-and-state.md` |
| sync state | `Notifier` / `Cubit` | `references/architecture-and-state.md` |
| async state | `AsyncNotifier` / `AsyncValue` | `references/architecture-and-state.md` |
| DI | `@riverpod` providers / `get_it` | `references/architecture-and-state.md` |
| routing | typed `go_router` | `references/ui-and-navigation.md` |
| errors | `Result` / sealed | `references/architecture-and-state.md` |
| http | `dio` + interceptor | `references/architecture-and-state.md` |
| long list | `ListView.builder` | `references/performance.md` |
| off-thread | `Isolate.run` | `references/performance.md` |
| unit test | `ProviderContainer.test()` | `references/testing.md` |
| widget test | `ProviderScope` override | `references/testing.md` |
| golden | `matchesGoldenFile` | `references/testing.md` |
| l10n | ARB + `gen_l10n` + `intl` | `references/i18n-and-dependencies.md` |
| deps | `flutter pub outdated` / `melos` | `references/i18n-and-dependencies.md` |
| verify | `scripts/verify.sh` | `scripts/verify.sh` |

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the
[`harness`](../harness/SKILL.md) Karpathy wiki), record this
project's app decisions there and index them in `02-DOCS/wiki/index.md`, so the next
agent inherits the conventions instead of re-deriving them.

1. **Find the article** `02-DOCS/wiki/stack/flutter.md`, indexed in `02-DOCS/wiki/index.md` (the Knowledge map index; root `CLAUDE.md` points to it).
2. **If missing or stale**, create/update it with the project's real choices — the state-management choice (Riverpod/Bloc), the architecture layers, routing, the Material 3 token system, and codegen setup —
   then index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it).
3. **Read it first on every use** and stay consistent; when a convention changes, update the
   article (bump its `Updated` date) in the same change.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Unlike the
brand study, technical conventions are *recorded, not gated* — never block the task on this.

## See Also

- `references/architecture-and-state.md` — layering, DI, Result/Failure, Riverpod 3 & Bloc deep dives.
- `references/ui-and-navigation.md` — widgets, Material 3 tokens, responsive, typed go_router, a11y.
- `references/testing.md` — unit/widget/golden/integration + coverage.
- `references/performance.md` — rebuilds, paint, jank, isolates, build flavors.
- `references/i18n-and-dependencies.md` — ARB/ICU l10n, RTL, locale-aware formatting, pub points, `melos`.
- `scripts/verify.sh` — run inside your Flutter project to gate format/codegen/analyze/tests.
- Sibling skills: `harness` (workspace `01-TOOLS`/`02-DOCS`, flavor secrets); `fastapi`,
  `go` and `nextjs` for the backends this app talks to; `secure-coding` for token handling and deep-link
  validation; `deployment` for store/CI release; `design` for the Material 3 token system.
