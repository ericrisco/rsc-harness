# UE5 packaging & build config (overview)

Enough to configure a build correctly. Deep shipping (cook tuning, pak/IoStore, on-disk size,
platform certification, CI/CD, LTO, encryption) belongs to `gamedev-shipping`.

## Build configurations

| Config | Engine code | Game code | Logging | Use for |
| --- | --- | --- | --- | --- |
| `Debug` | debug | debug | full | stepping through engine internals |
| `DebugGame` | optimized | debug | full | debugging **your** game code with fast engine |
| `Development` | optimized | optimized | full | day-to-day iteration in editor & standalone (default) |
| `Test` | optimized | optimized | full-ish | profiling a near-shipping build with stats/console |
| `Shipping` | optimized | optimized | **stripped** | the build you release — no console, `check()` compiled out |

`Development` is what you run while making the game. Package **`Shipping`** for release; verify
it separately because stripped logging/asserts change behavior (never rely on `check()`
side effects — they vanish in Shipping).

## Targets and modules

- **`Source/<Project>.Target.cs`** and **`<Project>Editor.Target.cs`** — one per output kind
  (Game, Editor, and optionally Client/Server for networked titles). They set `Type`,
  `DefaultBuildSettings`, and `IncludeOrderVersion`.
- **`Source/<Module>/<Module>.Build.cs`** — per-module rules. Declare dependencies here; a
  missing module = unresolved-symbol linker errors even though the header compiles.

Starter module rules for a Blueprint+C++ game using Enhanced Input, UMG, and Paper2D:

```csharp
using UnrealBuildTool;

public class MyGame : ModuleRules
{
    public MyGame(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[] {
            "Core", "CoreUObject", "Engine", "InputCore",
            "EnhancedInput",     // Enhanced Input (required — legacy input is deprecated)
            "UMG", "Slate", "SlateCore",   // UMG UI
            "Paper2D"            // 2D sprites/flipbooks/tilemaps
        });

        // PrivateDependencyModuleNames.AddRange(new string[] { "AIModule", "GameplayTasks" });
    }
}
```

After editing `.Build.cs` or adding C++ classes, **regenerate project files** (right-click the
`.uproject` → *Generate … project files*, or `GenerateProjectFiles`) and rebuild from the IDE.

## Packaging the build

- **Editor**: *Platforms ▸ \<Platform\> ▸ Package Project* (set the config in
  *Packaging* settings). Choose the maps to cook and the `Shipping` config for release.
- **Command line** (CI-friendly): Unreal Automation Tool runs cook → stage → package in one go:

```bash
RunUAT BuildCookRun \
  -project="/path/MyGame.uproject" \
  -noP4 -platform=Win64 -clientconfig=Shipping \
  -cook -allmaps -build -stage -pak -archive \
  -archivedirectory="/path/Builds"
```

## Config files

Per-project defaults live in `Config/`: `DefaultEngine.ini`, `DefaultGame.ini` (project
name/version, maps), `DefaultInput.ini`, and platform overrides like `Windows/WindowsEngine.ini`,
`Android/AndroidEngine.ini`. Packaging options (maps to cook, build config, compression,
Blueprint nativization off in UE5) are under *Project Settings ▸ Packaging*, persisted to these
`.ini` files — commit them so builds are reproducible.

## Common failure modes

- **"Module could not be loaded"** at launch → the module isn't in `.Build.cs`'s dependency list,
  or it's an editor-only module referenced by a runtime build.
- **Cooks fine, crashes packaged only** → usually a hard reference to an editor-only asset, or
  code depending on a `check()`/`ensure()` side effect that Shipping stripped.
- **Asset not in the build** → not reachable from a cooked map or an asset directory; add it to
  *Packaging ▸ Additional Asset Directories to Cook*.
