# Mobile & desktop — signing, keystores, provisioning, notarization

Back to the entrypoint: `../SKILL.md`. The per-OS steps that gate a shippable build.

## Android

### Toolchain

- **JDK 17** — the version the current Gradle build template expects. JDK 21 or 11 breaks the
  build with cryptic Gradle errors. Point the engine's Android settings at a JDK 17 home.
- **Android SDK + build-tools + platform-tools**; NDK for native/IL2CPP.
- Godot: `Project ▸ Install Android Build Template`, then tick **Use Gradle Build** on the Android
  preset — required to produce an **AAB** and to use custom Gradle/plugins.
- Unity: `File ▸ Build Profiles ▸ Android`; **Build App Bundle (Google Play)** for AAB.
- Unreal: run **Turnkey**/Android setup once (Android Studio + correct NDK), then
  `RunUAT BuildCookRun ... -platform=Android -clientconfig=Shipping -distribution -cook -stage -pak -package`.

### AAB vs APK

| Format | Use for | Notes |
| --- | --- | --- |
| **AAB** (`.aab`) | Google Play (**required** for new apps + updates) | Play generates optimized per-device APKs; you can't install an AAB directly. |
| **APK** (`.apk`) | Sideload, itch.io, direct download, other stores | Installs directly; use a universal APK for QA. |

### Signing & keystore

Generate a release keystore **once** and guard it — losing it means you can't publish updates
(unless enrolled in Play App Signing, where Google holds the app-signing key and you rotate the
upload key):

```bash
keytool -genkey -v -keystore release.keystore -alias game \
  -keyalg RSA -keysize 2048 -validity 10000
```

- Godot: set the **Release** keystore path + alias + passwords in the Android preset (and a debug
  keystore for debug exports).
- Never commit the keystore or passwords. In CI, restore the keystore from a base64-encoded secret
  at runtime and pass passwords via env.
- **Play App Signing**: you sign the upload with the *upload key*; Google re-signs distribution
  with the *app-signing key* it stores. Recommended — it lets you recover a lost upload key.
- `versionCode` (integer) must **strictly increase** every upload; `versionName` is the human string.

### Common failures

- Editor 4.5.1 + templates 4.5 ⇒ export greyed out or Gradle error. Match versions exactly.
- Wrong JDK ⇒ Gradle build fails. Use 17.
- Debug keystore used for a release ⇒ Play rejects it.
- Target API level too old ⇒ Play blocks the submission.

## iOS

- **Mac + Xcode + an Apple Developer Program membership** (paid) are non-negotiable for device/store builds.
- **Bundle Identifier** must match a registered **App ID** in the developer portal.
- **Signing certificate** (Apple Development / Apple Distribution) + a **provisioning profile**
  that ties App ID + certificate + devices/distribution method:
  - *Development* — run on registered test devices.
  - *Ad Hoc* — distribute to a fixed device list outside the store.
  - *App Store* — submit to App Store Connect / TestFlight.
- Enable **Automatically manage signing** in Xcode for the common case; use manual profiles for CI.
- Flow: engine exports an Xcode project → open in Xcode → set team/signing → **Product ▸ Archive**
  → distribute via the Organizer, or upload with **Transporter** to App Store Connect.
- **TestFlight** for beta: upload a build, add internal/external testers, then submit for review.
- `CFBundleShortVersionString` = marketing version; `CFBundleVersion` = build number, must
  **increase** per upload to App Store Connect.

## macOS (desktop, outside the App Store)

Gatekeeper will refuse an unsigned/un-notarized app for end users. The full chain is codesign →
notarize → staple, inside-out.

```bash
# 1. Sign every nested binary FIRST, then the outer .app (Hardened Runtime is mandatory)
codesign --deep --force --timestamp --options runtime \
  --sign "Developer ID Application: Studio Name (TEAMID)" Game.app

# 2. Store notarization creds once (App Store Connect API key or Apple ID app-password)
xcrun notarytool store-credentials "AC" \
  --apple-id you@studio.com --team-id TEAMID --password app-specific-pw

# 3. Zip and submit; --wait blocks until Apple returns accepted/invalid
ditto -c -k --keepParent Game.app Game.zip
xcrun notarytool submit Game.zip --keychain-profile "AC" --wait

# 4. Staple the ticket so the app verifies OFFLINE, then verify
xcrun stapler staple Game.app
spctl --assess --type execute -vvv Game.app   # should say: accepted, source=Notarized Developer ID
```

- `--options runtime` (Hardened Runtime) is **required** or notarization is rejected.
- Sign nested `.dylib`s / helper tools / frameworks before the parent bundle.
- Distributing a `.dmg`? Notarize and staple the **`.dmg`** too (submit the dmg, staple the dmg).
- `altool` notarization is retired — use `xcrun notarytool`.
- If `notarytool` returns `Invalid`, fetch the log: `xcrun notarytool log <submission-id> --keychain-profile "AC"`.

### Mac App Store (different path)

- Sign with **Apple Distribution** (not Developer ID) + **App Sandbox** entitlements.
- Submit through App Store Connect (via Xcode/Transporter); the store notarizes automatically —
  you do not run `notarytool`/`stapler` manually for App Store builds.

## Windows

- Signing is **optional** but recommended: an Authenticode code-signing certificate reduces the
  SmartScreen "unknown publisher" warning. An **EV** certificate builds reputation faster.

```powershell
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a Game.exe
```

- Ship the `.exe` alongside the engine data/`.pck` (or bundle into an installer: Inno Setup / NSIS / MSIX).
- Unsigned still runs; users just click through a SmartScreen prompt.

## Linux

- No signing requirement. Ship the executable + data files, or wrap for portability:
  - **AppImage** — one self-contained file, runs across distros; easiest for direct/itch distribution.
  - **Flatpak** — sandboxed, distributed via Flathub; more packaging work, best store reach.
- Mark the binary executable (`chmod +x`) and test on a clean distro (glibc version differences bite).

## Cross-platform checklist

- [ ] Android: JDK 17, AAB for Play (APK for sideload), release keystore in CI secret, `versionCode` bumped, Play App Signing on.
- [ ] iOS: App ID + cert + provisioning profile matched, `CFBundleVersion` bumped, archive uploaded.
- [ ] macOS: codesign (Hardened Runtime) → notarytool → stapler → `spctl` accepted.
- [ ] Windows: signed (or SmartScreen prompt accepted as known), installer built if needed.
- [ ] Linux: AppImage/Flatpak or binary+data, tested on a clean distro.
