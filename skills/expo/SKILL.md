---
name: expo
description: "Use when shipping a React Native app with Expo — EAS Build/Submit/Update, eas.json profiles and channels, config plugins, prebuild/CNG, runtime-version policy, OTA updates that never land, SDK upgrades, the New Architecture. NOT RN UI, navigation or native-module authoring (that is `react-native`), NOT a Dart app (that is `flutter`)."
tags: [expo, eas, react-native, mobile, ota-updates, app-store]
recommends: [react-native, github-actions, ship, deployment, secure-coding]
origin: risco
---

# Expo & EAS: shipping React Native

**Hand-off — the app vs its motion.** This skill owns the Expo platform: router, config plugins, EAS,
native modules, store builds. **Animation and gestures** — Reanimated worklets, the UI runtime,
sheets, screen transitions, press feedback, haptics, motion that stutters on a real device — are
`../animate-expo/SKILL.md`'s.


## What this skill owns

Expo is the toolchain and **EAS cloud platform** layered on React Native: cloud
builds, store submission, over-the-air JS updates, and **native configuration
declared in JavaScript** instead of hand-edited Xcode/Gradle projects. This skill
owns the *shipping pipeline* and *native-config-via-JS*.

The verb rule of thumb: if the verb is **build / submit / update / prebuild /
plugin / EAS / channel / runtime-version**, you are in `expo`. If it is **render /
navigate / animate / bridge / write a native module**, route to `react-native`.
Other exits: web React/hooks/state → `react`, a Dart app → `flutter`, native-only
Swift/Kotlin → `swift-ios`/`kotlin-android`, a desktop wrapper → `tauri`/`electron`,
CI unrelated to EAS → `github-actions`.

Current stable as of 2026-06-02: **Expo SDK 55** — React Native 0.83.1, React
19.2.0, shipped 2026-02-25. **SDK 56 is in beta** (beta opened 2026-05-06, ~2-week
window; RN 0.85.2, React 19.2.3) — upcoming, not yet shipped stable. Both run
exclusively on the New Architecture; the Legacy Architecture was removed in SDK 55.

## Decision rules

| Situation | Do this | Why / not that |
|---|---|---|
| New app, want config-as-JS | **managed + prebuild (CNG)** — no committed `ios/`/`android/` | native dirs are regenerable artifacts; hand-edits get blown away |
| You truly need to hand-edit native code long-term | **bare** (commit `ios/`/`android/`) | last resort; you lose `prebuild --clean` upgrades |
| Quick demo, only Expo-SDK modules | **Expo Go** | zero build, but custom native deps will crash |
| Any custom native dependency or plugin | **dev build** (`developmentClient: true`) | Expo Go cannot load arbitrary native code |
| Runtime version, picking a policy | **`fingerprint`** (auto-bumps on native change) | safest default; prevents serving JS to an incompatible binary |
| Runtime tied to your release version | `appVersion` | simpler, but you must remember to bump it on native changes |

## The shipping pipeline (core)

Four EAS verbs, in this order: **prebuild → build → submit → update**.

```bash
npx expo prebuild --clean      # regenerate native dirs from app config + plugins (CNG)
eas build -p ios --profile production       # cloud-build the binary (.ipa/.aab)
eas submit -p ios --profile production      # upload to App Store / Play Store
eas update --branch production --message "fix typo"   # ship JS-only over the air
```

`prebuild` is only needed for managed/CNG apps and runs automatically inside
`eas build`; run it locally to inspect or to verify a plugin. **Build/submit ship a
new binary; update ships JS only** — anything touching native code needs a new build.

Minimal `eas.json` with the three default profiles plus channels. Each build is
stamped with a `channel`; a channel maps to a same-named EAS Update branch by default
(SDK 55 stable builders: RN 0.83.1, Xcode 26 on iOS, Android 16 target):

```jsonc
{
  "cli": { "version": ">= 16.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

Run `scripts/verify.sh` inside an Expo project to gate `eas.json`, the runtime
policy, committed secrets, and New-Arch readiness.

## EAS Update mental model

Runtime version is the **compatibility gate**. An update applies to a build only
when **BOTH the platform AND the `runtimeVersion` match exactly** — there is no
"close enough". The chain is: build stamped with a **channel** → channel points at a
**branch** → you publish updates to a branch. Updates flow only down a matching
runtime within the linked branch.

The #1 footgun: a hardcoded `runtimeVersion` that drifts from the binary, so the
update silently never installs and you stare at unchanged devices.

```jsonc
// BAD — hardcoded string in app.json; bump a native dep and every old build
// silently stops matching, so your "shipped" OTA never reaches users.
{ "expo": { "runtimeVersion": "1.0.0" } }
```

```jsonc
// GOOD — fingerprint policy: EAS hashes the native runtime and auto-bumps the
// runtime version whenever native code/config changes, so updates only ever
// reach binaries that can actually run them.
{ "expo": { "runtimeVersion": { "policy": "fingerprint" } } }
```

Inspect, branch ops, rollouts/rollbacks, republish, and the full "update not
applying" decision flow → `references/eas-update.md`.

## Config plugins / CNG

**Never hand-edit `ios/` or `android/`** — they are ephemeral, regenerated by
`npx expo prebuild --clean` from `app.config` + plugins + autolinking. To change
native config, write a config plugin (a function in the `plugins` array) or use a
mod like `withInfoPlist` / `withAndroidManifest`.

```ts
// app.plugin.ts — add an iOS Info.plist key during prebuild, the CNG way.
import { ConfigPlugin, withInfoPlist } from "expo/config-plugins";

const withCameraUsage: ConfigPlugin<{ reason: string }> = (config, { reason }) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.NSCameraUsageDescription = reason;
    return cfg;
  });

export default withCameraUsage;
```

```ts
// app.config.ts — dynamic config; reference the plugin with its options.
export default {
  expo: {
    name: "MyApp",
    runtimeVersion: { policy: "fingerprint" },
    plugins: [["./app.plugin.ts", { reason: "Scan receipts" }]],
  },
};
```

Plugin anatomy, dangerous mods, mod ordering, and prebuild troubleshooting →
`references/config-plugins.md`.

## New Architecture & SDK upgrade

**The Legacy Architecture is gone.** SDK 54 was the last release to ship it; SDK 55
(2026-02-25, current stable) removed it entirely, and the SDK 56 beta builds on that.
On any supported SDK you are **already** on the New Architecture — it is always
enabled and cannot be turned off. The `newArchEnabled` flag was deleted from
`app.json` in SDK 55; if you still carry one, it is dead config — remove it. There is no legacy
fallback to lean on, so a dependency that only works on the old architecture is now a
hard blocker, not a "flip the flag back" escape hatch.

Upgrade checklist:

1. `npx expo install expo@latest --fix` — bump SDK and align every dependency.
2. `npx expo-doctor@latest` — catch deps that never made the New-Arch jump before you build.
3. `npx expo prebuild --clean` — regenerate native dirs (managed/CNG apps).
4. Build a `development`/`preview` binary on a device before promoting to production.

Two upgrade tripwires: every Android app is **edge-to-edge** (on since SDK 54,
non-negotiable) — audit manual inset/status-bar code. And SDK 55+ ships **Hermes
bytecode diffing** for EAS Update (~75% smaller OTA downloads) automatically; you get
it for free once both the build and the update are on SDK 55+.

## Credentials & secrets

- Let **EAS manage credentials** (signing keys, provisioning profiles) by default —
  it stores and rotates them server-side so they never touch the repo.
- Supply per-profile config through **EAS environment variables** / `.env` files
  scoped by profile, not committed plaintext.
- **Never commit** a keystore (`*.jks`/`*.keystore`), `*.p12`, or
  `*.mobileprovision`, and never put API keys in `app.config`/`app.json` — anything
  in app config ships inside the public bundle. See `../secure-coding/SKILL.md`.

## EAS Workflows

EAS Workflows are Expo's own CI: YAML in `.eas/workflows/`. Jobs use pre-packaged
`type`s (`build`, `submit`, `update`) and chain via `needs:` + outputs. Route to the
`github-actions` skill **only** when the user explicitly wants GH Actions or
non-Expo CI.

```yaml
# .eas/workflows/release-android.yml — build then submit, chained by needs.
name: Release Android
on:
  push:
    branches: [main]
jobs:
  build:
    type: build
    params:
      platform: android
      profile: production
  submit:
    needs: [build]
    type: submit
    params:
      platform: android
      build_id: ${{ needs.build.outputs.build_id }}
```

## Plan limits (set expectations)

EAS **Free**: 15 Android + 15 iOS builds/month on the **low-priority queue only**
(peak waits can exceed an hour). High-priority queue needs a paid plan; the
Production plan includes 2 build concurrencies, with extra concurrency at
$50/concurrency/month, up to 5 extra. If a user complains about build queue waits,
the fix is usually the plan, not the config. (Pricing per expo.dev/pricing, verified
2026-06-02; re-check before quoting — Expo adjusts tiers and dollar figures.)

## Anti-patterns

| Anti-pattern | Do instead |
|---|---|
| Editing `ios/Info.plist` directly | `prebuild --clean` overwrites it; write a config plugin / `withInfoPlist`. |
| Hardcoding `runtimeVersion: '1.0.0'` because it is simpler | it drifts from the binary; updates silently stop matching. Use the `fingerprint` policy. |
| Expecting an OTA update to deliver a bumped native dep | EAS Update is JS-only; native changes need a new `eas build`. |
| Telling users to "just refresh" when a published update does not land | check the channel→branch and exact runtime match first — wrong channel = no delivery. |
| Testing a custom native module in Expo Go | Expo Go can't load arbitrary native code; build a dev client. |
| Upgrading the SDK and building straight to production | run `expo-doctor` + a preview build first; there is no Legacy-Arch fallback to catch a New-Arch-incompatible dep. |
| Setting `newArchEnabled: false` to dodge a broken native dep | the flag was removed in SDK 55 and the Legacy Architecture is gone; fix or replace the dep. |
| Committing the keystore so CI can sign | never; let EAS manage credentials or use EAS secrets. |
| Putting the API key in `app.config` extra | app config ships in the public bundle; use EAS env vars / a backend. |
| Reaching for GitHub Actions to call `eas build` | EAS Workflows is the native CI; only reach for github-actions if explicitly required. |

## Project grounding (02-DOCS + CLAUDE.md)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) wiki),
read `02-DOCS/wiki/stack/expo.md` first and record this app's shipping decisions
there — managed-vs-bare, runtime-version policy, channel/branch map, SDK/New-Arch
status — linked from the root `CLAUDE.md` `## Knowledge map`, bumping its `Updated`
date when a convention changes. No `02-DOCS/`? Skip silently. Conventions are
*recorded, not gated* — never block the task on this.
