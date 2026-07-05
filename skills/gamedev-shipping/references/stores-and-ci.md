# Stores & CI — Steam, itch.io, Play/App Store, and headless build pipelines

Back to the entrypoint: `../SKILL.md`. Store submission mechanics and per-engine CI.

## Steam (Steamworks + SteamPipe)

1. **Partner setup**: Steamworks account, an **App ID**, and the store page (assets, description,
   trailers, tags, pricing) filled in the partner site.
2. **Depots**: a depot is a bucket of files for a platform/language (e.g. one Windows depot, one
   macOS depot). Map each to your App ID.
3. **SteamPipe upload** with `steamcmd` driven by VDF scripts.

`app_build_APPID.vdf`:

```
"appbuild"
{
  "appid" "480"
  "desc"  "1.2.3 - CI build"
  "buildoutput" "output/"
  "contentroot" "build/"
  "setlive" ""                      // leave empty; set a branch live in the site, or "beta"
  "depots" { "481" "depot_build_481.vdf" }
}
```

`depot_build_481.vdf`:

```
"DepotBuild"
{
  "DepotID" "481"
  "FileMapping" { "LocalPath" "*" "DepotPath" "." "recursive" "1" }
  "FileExclusion" "*.pdb"
}
```

Upload:

```bash
steamcmd +login <builder_account> +run_app_build $(pwd)/app_build_APPID.vdf +quit
```

- Push to a **beta branch** first, test, then set it as the default (live) branch in the partner site.
- Use a dedicated **build account** with 2FA handled for CI (Steam Guard); never the studio owner login.
- `.pdb`/debug symbols usually excluded from the shipped depot.

## itch.io (butler)

`butler` is itch's CLI. A **channel** encodes the platform:

```bash
butler push build/windows user/game:windows   --userversion 1.2.3
butler push build/html5   user/game:html5      --userversion 1.2.3
butler push build/osx.zip user/game:mac        --userversion 1.2.3
butler status user/game                        # see channels + versions
```

- Channel names containing `windows`/`osx`/`linux`/`android` tag the platform for the itch app;
  `html5`/`web` marks a browser build.
- For threaded web builds, in the uploaded file's settings tick **"This file will be played in
  the browser" ▸ SharedArrayBuffer support** so itch serves COOP/COEP (see `web-export-headers.md`).
- CI auth: `BUTLER_API_KEY` env var (from itch API keys). `butler push` is idempotent and diff-based.

## Google Play

- Upload an **AAB**; enable **Play App Signing**.
- Meet the current **target API level** requirement (Play enforces a recent level for new uploads and updates).
- Complete: **content rating** (IARC questionnaire), **Data safety** form, store listing (icon,
  feature graphic, screenshots per device, short/full description), pricing/countries.
- Tracks: internal → closed → open → production. Promote a build up the tracks.
- `versionCode` strictly increasing; can't reuse one.

## Apple App Store

- Archive + upload to **App Store Connect** (Xcode Organizer / Transporter).
- App Store record: name, subtitle, keywords, description, screenshots per device size, app icon,
  privacy nutrition labels, **age rating** questionnaire, pricing.
- **TestFlight** for beta before submitting for review.
- The store notarizes automatically — no manual `notarytool` for App Store builds.

## Age ratings (shared)

- **IARC** questionnaire generates ratings for Google Play, Microsoft Store, Nintendo eShop in one pass.
- **ESRB** (NA), **PEGI** (EU), **USK** (DE), **CERO** (JP) as required by platform/region.
- Apple has its own age-rating questionnaire in App Store Connect.
- Answer truthfully — misdeclaring content (violence, gambling, user-generated content) risks removal.

## CI/CD — headless builds

Principles: run the export headless, feed a **version/build number** from the CI run, restore
**signing material from secrets** at runtime, upload the artifact.

### Godot (GitHub Actions)

```yaml
name: export
on: { push: { tags: ['v*'] } }
jobs:
  build:
    runs-on: ubuntu-latest
    container: barichello/godot-ci:4.5.1        # image bundles matching export templates
    steps:
      - uses: actions/checkout@v4
      - name: Prepare templates
        run: |
          mkdir -p ~/.local/share/godot/export_templates/4.5.1.stable
          mv /root/.local/share/godot/export_templates/4.5.1.stable/* \
             ~/.local/share/godot/export_templates/4.5.1.stable/
      - name: Export Web + Linux
        run: |
          mkdir -p build/web build/linux
          godot --headless --export-release "Web"   build/web/index.html
          godot --headless --export-release "Linux/X11" build/linux/game.x86_64
      - uses: actions/upload-artifact@v4
        with: { name: builds, path: build/ }
```

The template version in the image **must** equal the editor build (`4.5.1` here). For Android in CI,
add JDK 17 + the Android SDK and restore the keystore from a secret.

### Unity (GitHub Actions)

```yaml
- uses: game-ci/unity-builder@v4
  with:
    targetPlatform: Android
    buildMethod: BuildScript.PerformBuild
  env:
    UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
    UNITY_EMAIL:   ${{ secrets.UNITY_EMAIL }}
    UNITY_PASSWORD: ${{ secrets.UNITY_PASSWORD }}
```

- License activation is required (personal/pro); store it in secrets via `game-ci/activate`.
- Matrix over `targetPlatform` for multi-target. Keystore + passwords come from secrets for signed Android.

### Unreal (self-hosted)

- The engine install is multi-GB, so Unreal CI needs a **self-hosted runner** with the engine + SDKs installed.
- Drive with `RunUAT BuildCookRun ... -clientconfig=Shipping -cook -stage -pak -package -archivedirectory=...`.

### Versioning

```yaml
env:
  BUILD_NUMBER: ${{ github.run_number }}          # monotonic → versionCode / CFBundleVersion / Steam desc
  VERSION: ${{ github.ref_name }}                  # semver tag → versionName / marketing version
```

- Semver tag (`v1.2.3`) triggers a release build; the run number is the strictly-increasing integer.
- Feed `BUILD_NUMBER` into Android `versionCode`, iOS `CFBundleVersion`, and the Steam build `desc`.
- Publish signing secrets (keystore base64, App Store Connect API key, `BUTLER_API_KEY`, `STEAM_*`) as encrypted repo/environment secrets — never in the workflow file.

## Checklist

- [ ] Store page assets + metadata + age rating complete for the target store.
- [ ] Steam: depots mapped, SteamPipe VDFs correct, pushed to a beta branch first, build account with Steam Guard.
- [ ] itch: correct channel names, SAB checkbox for web, `BUTLER_API_KEY` in CI.
- [ ] Play: AAB + Play App Signing + target API level + Data safety.
- [ ] App Store: archive uploaded, TestFlight tested, privacy labels + age rating done.
- [ ] CI: headless export, version/build number from the run, signing material from secrets, artifact uploaded.
