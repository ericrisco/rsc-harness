# Packaging, signing & auto-update

Two toolchains. **Electron Forge** is first-party and feature-first; **electron-builder** has
the richer update/config surface via `electron-updater`. Pick one — don't mix.

## Decision

| You want…                                                       | Pick             |
|-----------------------------------------------------------------|------------------|
| New app, first-party alignment, newest Electron features first   | Electron Forge   |
| ASAR integrity + universal macOS out of the box                  | Electron Forge   |
| Differential downloads, staged rollouts, multi-provider feeds    | electron-builder |
| The deepest config surface for exotic installer needs            | electron-builder |

## Electron Forge config (`forge.config.ts`)

```ts
import type { ForgeConfig } from '@electron/forge-shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';   // Windows
import { MakerDMG } from '@electron-forge/maker-dmg';             // macOS
import { MakerDeb } from '@electron-forge/maker-deb';             // Linux
import { PublisherGithub } from '@electron-forge/publisher-github';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    osxUniversal: { mergeASARs: true }, // single binary for Intel + Apple Silicon
    osxSign: { identity: 'Developer ID Application: Your Co (TEAMID)' },
    osxNotarize: {
      appleId: process.env.APPLE_ID!,
      appleIdPassword: process.env.APPLE_APP_PASSWORD!, // app-specific password
      teamId: process.env.APPLE_TEAM_ID!,
    },
  },
  makers: [new MakerSquirrel({}), new MakerDMG({}), new MakerDeb({})],
  publishers: [
    new PublisherGithub({ repository: { owner: 'you', name: 'my-app' } }),
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
export default config;
```

```bash
npm run make      # build installers for the current OS
npm run publish   # build + upload to the configured publisher
```

## electron-builder config (`electron-builder.yml`) + updater

```yaml
appId: com.yourco.myapp
asar: true
mac:
  hardenedRuntime: true
  gatekeeperAssess: false
  notarize: true            # builder calls notarytool for you
win:
  target: nsis
  signtoolOptions:
    sign: ./scripts/sign.js # Authenticode signing hook
publish:
  provider: github
  owner: you
  repo: my-app
  releaseType: release
```

```ts
// main.ts — auto-update via electron-updater (pairs with electron-builder)
import { autoUpdater } from 'electron-updater';

app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify(); // checks the GitHub Releases feed
});
autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall());
```

Staged rollout: publish `latest.yml` with a `stagingPercentage` so only a fraction of clients
pick up the new version until you're confident, then raise it.

## macOS signing + notarization

1. **Sign** with a *Developer ID Application* certificate and the hardened runtime enabled.
2. **Notarize** the signed app with `notarytool` (Apple scans it for malware):
   ```bash
   xcrun notarytool submit MyApp.dmg \
     --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" \
     --password "$APPLE_APP_PASSWORD" --wait
   ```
3. **Staple** the ticket so the app validates offline: `xcrun stapler staple MyApp.dmg`.

**Why it's mandatory for updates:** Squirrel.Mac refuses to apply an update whose new build
isn't properly signed + notarized. Skip it and auto-update silently does nothing.

## Windows Authenticode

Sign the installer and the app `.exe` with an Authenticode certificate (an EV or OV cert from
a CA; cloud HSM signing is increasingly required):

```bash
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 \
  /a MyAppSetup.exe
```

Squirrel.Windows / NSIS auto-update relies on the signature matching across versions, so use
the same publisher identity for every release.

## Secrets

Certificates, Apple app-specific passwords, and signing keys are CI secrets — never commit
them. Storage/rotation policy belongs to `security-audit`; this reference only covers where the
Electron flow consumes them (`process.env`, CI secret store).
