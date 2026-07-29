---
name: react-native
description: "Use when writing the JS/TS inside a React Native or Expo app — screens, Expo Router navigation, lists, Reanimated gestures, platform forks, offline state, native modules — or killing jank and render storms. NOT eas build/submit/OTA/config-plugin (that is `expo`), NOT a Dart app (that is `flutter`), NOT web React/DOM (that is `react` or `nextjs`)."
tags: [react-native, expo, mobile, ios, android, navigation, performance]
recommends: [expo, react, flutter, design, debug, performance]
origin: risco
---

# React Native (app code)

You write the code that runs *inside* the app: render, navigate, animate, list, persist, and author native modules. Mobile is split across two skills by **verb** — run the verb test before doing anything:

| Verb in the request | Skill |
|---|---|
| render / navigate / animate / list / persist / author-native-module / debug-runtime | **react-native** (here) |
| build / submit / update (OTA) / prebuild / config-plugin / `eas.json` / channel / runtime-version | **`../expo/SKILL.md`** |

Assume the **New Architecture is on** (Fabric + Turbo Modules). It is mandatory from RN 0.82 / Expo SDK 55 — RN 0.82 (2025-10-08) ignores any disable flag, and SDK 55 is New-Arch-only. SDK 54 (RN 0.81) was the last that could opt out. Never write `newArchEnabled: false` to dodge a bug; fix the bug. Why: the flag is a no-op on current versions, so the "fix" silently does nothing.

Reference SDK→RN map (accessed 2026-06-02): **SDK 53** = RN 0.79, **SDK 54** = RN 0.81 (React Compiler GA), **SDK 55** = RN 0.83.

## Project shape — pick a router first

This is the one real branch at scaffold time:

| Use | When |
|---|---|
| **Expo Router** (file-based) | New apps, web parity, deep links, typed routes. The recommended default. It is a layer on top of React Navigation; both are Expo-team maintained. |
| **React Navigation v7** (static API) | Brownfield apps, native integration, highly bespoke custom transitions where you need imperative control. |

Default file tree for an Expo Router app:

```text
app/                  # routes — file system IS the navigation
  (auth)/             # group: unauthenticated screens
  (app)/              # group: authenticated screens
    (tabs)/           # nested tab navigator
  _layout.tsx         # root layout + providers
components/           # dumb, reusable UI
features/<domain>/    # feature-scoped screens, hooks, components
lib/                  # clients, query setup, storage, utils
```

Keep route files thin: a route file wires params and renders a feature component. Put logic in `features/`. Why: routes get re-mounted by navigation; business logic in them is hard to test and re-runs unexpectedly.

## Navigation

Type your routes. With Expo Router, enable typed routes and let `useLocalSearchParams<{ id: string }>()` carry the contract. Why: deep links and back-stack restoration pass strings you will otherwise misread.

Gate auth at the **group layout**, declaratively — not imperatively inside an effect:

```tsx
// app/(app)/_layout.tsx — Bad: imperative nav in an effect races the first paint
export default function AppLayout() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) router.replace('/(auth)/sign-in'); // flashes protected UI first
  }, [user]);
  return <Stack />;
}
```

```tsx
// app/(app)/_layout.tsx — Good: redirect before children mount
import { Redirect, Stack } from 'expo-router';
export default function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;          // or a splash
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  return <Stack />;
}
```

Modals/sheets: declare presentation on the screen, not by pushing a styled full-screen route — `<Stack.Screen options={{ presentation: 'modal' }} />`. Configure deep links via the `scheme` + the linking config so a cold-start link resolves to the right nested route, not just the root. A deep link landing on the wrong screen is almost always a group/segment mismatch between the URL and the `app/` tree.

## Lists & performance

Switch from `FlatList` to **FlashList** (Shopify) once a list crosses **~100 items**, has variable row heights, or renders images. Why: FlashList recycles views instead of mounting one per row, so memory and scroll jank stay flat as the list grows.

Three things every long list needs:

1. A stable `keyExtractor` — return a real id, never the index. Index keys defeat recycling and reorder rows on insert.
2. `getItemType` when rows differ structurally (header vs product vs ad). Why: it lets FlashList recycle within a type instead of remeasuring.
3. A memoized row component with **no inline closures or style objects** in `renderItem`.

```tsx
// Bad: new fn + new style object every parent render -> every visible row re-renders
<FlashList
  data={items}
  renderItem={({ item }) => (
    <Pressable style={{ padding: 12 }} onPress={() => open(item.id)}>
      <Text>{item.title}</Text>
    </Pressable>
  )}
/>
```

```tsx
// Good: stable refs, memoized row, typed rows
const Row = memo(function Row({ item }: { item: Product }) {
  const open = useOpenProduct();          // stable from context/store
  return (
    <Pressable style={styles.row} onPress={() => open(item.id)}>
      <Text>{item.title}</Text>
    </Pressable>
  );
});

<FlashList
  data={items}
  keyExtractor={(it) => it.id}
  getItemType={(it) => it.kind}
  renderItem={({ item }) => <Row item={item} />}
/>
```

FlashList caveat: rows can flash into the wrong position for a split second if mounted while entry animations run. Disable entry animations on the **initial** mount.

React Compiler (GA in SDK 54) auto-memoizes components and reduces manual `useMemo`/`useCallback` — but it does **not** remove the need for virtualization, stable keys, or `getItemType`. Don't delete your list discipline because the compiler is on. For re-render hunting and profiling, see `references/performance-debugging.md`.

## Animation & gestures

Reanimated worklets run on the **UI thread**, so animations keep going at 60fps even when JS is busy. Reanimated 4 (stable Oct 2025) requires the New Architecture / RN 0.76+ and adds CSS-style animations while keeping the worklet API. Many teams stay on Reanimated 3 for dependency compatibility — match the project's installed major.

Two rules that fix most gesture bugs:

- Wrap gesture objects in `useMemo`. Why: a new gesture object each render reattaches the recognizer and drops in-flight touches.
- Cross to JS only at the boundary with `runOnJS`. Why: calling a JS-thread function directly from a worklet crashes; everything inside the worklet must stay on the UI thread.

```tsx
// Good: memoized gesture, UI-thread shared value, JS only at the end
const x = useSharedValue(0);
const pan = useMemo(
  () =>
    Gesture.Pan()
      .onUpdate((e) => { x.value = e.translationX; })            // UI thread
      .onEnd(() => { runOnJS(onSwiped)(); x.value = withSpring(0); }), // boundary
  [onSwiped],
);
```

Use Reanimated 4 CSS animations for simple declarative cases (fades, simple transitions); use worklets for gesture-driven or physics-based motion. Never animate layout on the JS thread when a shared value will do it on the UI thread.

## Platform-conditional code

- Small forks: `Platform.select({ ios: 12, android: 8 })` or `Platform.OS === 'ios'`.
- Whole-component forks: `Button.ios.tsx` / `Button.android.tsx` — the bundler picks the right one; import `./Button` with no extension.
- Safe area: use `react-native-safe-area-context` insets, not hardcoded notch padding. Why: insets differ per device and orientation. Palette, type scale and layout intent are not decided here → `../design/SKILL.md`.
- `KeyboardAvoidingView` behaves differently per platform — `padding` on iOS, often `height` or nothing on Android; test both, don't assume the iOS behavior ports.
- Set the status bar style explicitly per screen via `expo-status-bar`.

## Data & state

- **Server state → TanStack Query.** It owns caching, dedupe, retries, and background refetch. Don't hand-roll loading flags in component state.
- **Persistence:** **MMKV** for fast synchronous key/value (auth tokens, flags, small prefs); **expo-sqlite + Drizzle** for relational or offline-first data. Pick by shape, not habit.
- Don't reach for Redux by default. Server state lives in Query; the small amount of true client state fits in context or Zustand.
- Offline-first: persist the Query cache and treat the network as an enhancement, not a precondition.

## Native modules — pick the path

| Path | When | Cost |
|---|---|---|
| **Plain JS wrapper** of an existing lib | A maintained npm package already bridges the native API | None — do this first |
| **Expo Modules API** (Swift/Kotlin) | App uses Expo; you want clean Swift/Kotlin, no codegen | Requires Expo; least boilerplate |
| **Turbo Module** (codegen from TS specs) | Bare RN, or you need the RN-default path | Codegen specs + more boilerplate |
| **Nitro Modules** | Hot path needing max throughput | Emerging; weigh maturity |

Minimal Expo Module skeleton (definition lives in the module's Swift/Kotlin):

```swift
// ios/MyModule.swift
import ExpoModulesCore
public class MyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyModule")
    Function("hello") { (name: String) -> String in "Hi \(name)" }
  }
}
```

```ts
// index.ts — typed JS surface
import { requireNativeModule } from 'expo-modules-core';
const MyModule = requireNativeModule('MyModule');
export function hello(name: string): string { return MyModule.hello(name); }
```

Full Expo Module (Swift + Kotlin + view), the Turbo Module codegen-spec walkthrough, packaging, and autolinking → `references/native-modules.md`.

## Debugging

- Read **Hermes** stack traces from the bottom up; the JS frame that matters is usually above the native bridge frames.
- "Works on iOS, breaks on Android" (or vice versa) → run the platform-divergence checklist in `references/performance-debugging.md` before guessing.
- A red screen citing the interop layer is usually an old-architecture lib running under Fabric — update the lib or find a New-Arch-ready replacement; do **not** disable New Arch.
- A fault that resists all of the above needs systematic isolation, not more guesses → `../debug/SKILL.md`.

## Anti-patterns

| Anti-pattern | Why it hurts | Do instead |
|---|---|---|
| `FlatList` for 5k rows / image feeds | Mounts a view per row; jank + memory blowup | FlashList with `getItemType` + stable `keyExtractor` |
| Inline arrow / style object in `renderItem` | New ref every render re-renders every visible row | Memoized `Row`, `StyleSheet.create`, stable handlers |
| Gesture object built inline each render | Reattaches recognizer, drops in-flight touches | Wrap in `useMemo` keyed on real deps |
| `setState` in render path | Render loop / re-render storm on every keystroke | Derive in render or move to an event handler |
| Imperative `router.replace` in an effect to gate auth | Flashes protected UI, races first paint | `<Redirect>` at the group layout |
| `newArchEnabled: false` to dodge a New-Arch bug | No-op on RN 0.82+/SDK 55; hides the real cause | Update the offending lib; fix the bug |
| Animating layout on the JS thread | Drops frames when JS is busy | Reanimated shared value on the UI thread |
| Index as list key | Breaks recycling, reorders rows on insert | Stable domain id |
| Doing native config / `eas.json` / OTA here | Wrong skill; this is app code | `../expo/SKILL.md` |
| Hardcoded notch/safe-area padding | Wrong on other devices/orientations | `react-native-safe-area-context` insets |
