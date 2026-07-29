---
name: unreal
description: "Use when building, scripting or debugging a game in Unreal Engine 5 with Blueprint or C++ — the gameplay framework (Actor, Pawn, Character, GameMode, PlayerController), Actor lifecycle and tick, the reflection macros and garbage collection, Enhanced Input, multicast delegates, UMG widgets, Paper2D, and Blueprint-to-C++ parity in both directions. NOT Godot (that is `godot`), NOT Unity or MonoBehaviour (that is `unity`), NOT language-only C++ memory and RAII questions with no Unreal types (that is `cpp`)."
tags: [unreal, ue5, blueprint, unreal-engine, gamedev]
recommends: [cpp, gamedev-shipping, gamedev-multiplayer, game-design, gamedev-physics, godot, unity]
profiles: [full]
origin: risco
---

# Unreal Engine 5 (Blueprint + C++)

Build and debug UE5 games with the grain of the engine: the Gameplay Framework for structure,
reflection macros so C++ and Blueprint see the same types, Enhanced Input for controls, UMG for
UI, Paper2D for 2D — and a clean Blueprint↔C++ boundary so either can call the other. Hands
3D-only concerns (shaders, physics, netcode, shipping) to the siblings below.

## Version contract — read first

Target **Unreal Engine 5.x** (patterns valid 5.3+; current stable **UE 5.8**, the last UE5 line
before UE6). Emit modern UE5 APIs only. **Never emit these deprecated / legacy patterns:**

| Never emit | Use instead (UE5) |
| --- | --- |
| Legacy input: Project-Settings Action/Axis Mappings + `InputComponent->BindAction/BindAxis(FName,…)` | **Enhanced Input**: `UInputAction` + `UInputMappingContext` + `UEnhancedInputComponent->BindAction(…)`, context added via `UEnhancedInputLocalPlayerSubsystem` (default since 5.1; legacy deprecated 5.2) |
| Raw `UObject*` / `AActor*` as a **UPROPERTY member** | `TObjectPtr<T>` for UPROPERTY members (raw `T*` is fine for locals/params) |
| `GENERATED_UCLASS_BODY()` | `GENERATED_BODY()` |
| `TAssetPtr<T>` / `FStringAssetReference` | `TSoftObjectPtr<T>` / `FSoftObjectPath` |
| `ANY_PACKAGE` in `FindObject` / `StaticLoadObject` | explicit package or `FTopLevelAssetPath` |
| Slate/Canvas `DrawText`/`HUD` for game UI | **UMG** (`UUserWidget`) |
| `AGameMode` as the default base for a solo game | `AGameModeBase` (use `AGameMode` only when you need `MatchState`/multiplayer login flow) |
| `DECLARE_MULTICAST_DELEGATE` for a Blueprint-bindable event | `DECLARE_DYNAMIC_MULTICAST_DELEGATE…` + `BlueprintAssignable` |
| `bCanEverTick = true` "just in case" | leave tick **off**; drive logic from events/overlaps/timers (`FTimerManager`) |
| Hard-referencing / loading heavy assets at runtime by path | soft refs + `FStreamableManager` async load (hard refs only via `ConstructorHelpers` in the constructor) |

**Blueprint vs C++ — and the hybrid.** Blueprint: designer-facing tweaks, per-level scripting,
UI wiring, rapid iteration, one-off actors. C++: core systems, performance-critical/tick-heavy
code, base classes, math, anything you want unit-tested or diffable in git. **Default to the
hybrid**: write the base class in C++ (`UCLASS(Blueprintable)`), expose tunables with
`UPROPERTY(EditAnywhere, BlueprintReadWrite)` and hooks with `BlueprintImplementableEvent` /
`BlueprintNativeEvent`, then create a **Blueprint subclass** for designers to set defaults, wire
assets, and script the specifics — C++ speed and testability with Blueprint iteration.

## Gameplay Framework — who owns what

| Class | Responsibility | Lifetime / scope |
| --- | --- | --- |
| `AActor` | Anything placeable/spawnable in a level; holds components. | Per instance in a level/world |
| `UActorComponent` / `USceneComponent` | Reusable behavior/data on an Actor; `USceneComponent` adds a transform. | Owned by its Actor |
| `APawn` | An Actor that can be **possessed** and driven by a controller. | Per instance |
| `ACharacter` | A Pawn with a `CapsuleComponent`, `SkeletalMesh`, and `CharacterMovementComponent` (walk/jump/crouch, networked). | Per instance |
| `AController` / `APlayerController` / `AAIController` | The "brain" that possesses a Pawn; `APlayerController` maps a human player to input, camera, and UI. | One per player/AI |
| `APlayerState` | Per-player **replicated** state that must survive respawn (name, score, team). | One per player |
| `AGameModeBase` | The rules of the match; spawns players, defines default Pawn/Controller/HUD classes. **Server-only** — never exists on clients. | One per level |
| `AGameStateBase` | Game-wide **replicated** state all clients need (match phase, shared score, player array). | One, replicated |
| `AHUD` / `UUserWidget` | On-screen UI; prefer UMG `UUserWidget` over `AHUD` canvas drawing. | Per PlayerController |

Rule of thumb: **transient input/camera → PlayerController; persistent per-player data →
PlayerState; match rules → GameMode (server); shared world state → GameState.** Full
responsibilities and a spawn-order diagram → `references/gameplay-framework.md`.

## Actor lifecycle, components & attachment

Order for a spawned/placed Actor: **constructor** (set defaults, create subobjects — never
gameplay logic) → `PostInitializeComponents` → `BeginPlay` (world is live; safe to start logic)
→ `Tick(DeltaSeconds)` each frame (only if enabled) → `EndPlay` / `Destroyed` (release).

```cpp
AMyActor::AMyActor()
{
    PrimaryActorTick.bCanEverTick = false;                         // opt in only if you truly tick
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
    Mesh->SetupAttachment(RootComponent);                          // attach in the CONSTRUCTOR
}
void AMyActor::BeginPlay() { Super::BeginPlay(); /* start logic here, not in ctor */ }
```

- **Create components** with `CreateDefaultSubobject<T>(TEXT("Name"))` in the constructor; store
  them in a `UPROPERTY() TObjectPtr<T>` so they're kept alive and visible.
- **Attach in the constructor** with `SetupAttachment`; **at runtime** use
  `AttachToComponent(Parent, FAttachmentTransformRules::SnapToTargetNotIncludingScale)`.
- Prefer timers over tick for periodic work:
  `GetWorldTimerManager().SetTimer(Handle, this, &AMyActor::Fn, 1.f, true);`

## Reflection macros & garbage collection

Macros register types with Unreal Header Tool (UHT) so they get GC, serialization, editor, and
Blueprint support. Put `GENERATED_BODY()` first inside the class.

```cpp
UENUM(BlueprintType)
enum class ETeam : uint8 { Red, Blue };

USTRUCT(BlueprintType)                       // value type, visible to BP; no GC of itself
struct FLoadout { GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Ammo = 30;
};

UCLASS(Blueprintable)                        // Blueprintable = can be subclassed in BP
class MYGAME_API AWeapon : public AActor {
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Combat") float Damage = 10.f;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Mesh;   // GC-tracked ref
    UFUNCTION(BlueprintCallable, Category="Combat") void Fire();
};
```

Common `UPROPERTY` specifiers: `EditAnywhere` (edit on instances + defaults),
`EditDefaultsOnly` (class defaults only), `VisibleAnywhere` (read-only in editor);
`BlueprintReadWrite` (get + set in BP) vs `BlueprintReadOnly` (get only); always give a
`Category`.

**Garbage collection — the #1 gotcha.** The GC frees any `UObject` that no reachable `UPROPERTY`
points to. A UObject reference stored **without** `UPROPERTY()` is invisible to GC: it will be
collected out from under you and the pointer dangles/crashes. So:

- Store every long-lived `UObject`/`AActor` reference in a `UPROPERTY() TObjectPtr<T>`.
- For a non-owning "might already be dead" reference (don't keep it alive, must null-check), use
  `TWeakObjectPtr<T>` and `.IsValid()`.
- Never `new`/`delete` a `UObject` — spawn Actors with `SpawnActor<T>()` and create other UObjects
  with `NewObject<T>()`; the GC owns their lifetime. `new`/`delete` and smart pointers apply only
  to **non-`UObject`** C++ types.

## Delegates & events

```cpp
// Dynamic multicast = Blueprint-assignable + serializable. Params need a typed macro variant.
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHealthChanged, float, NewHealth);

UPROPERTY(BlueprintAssignable, Category="Events")     // shows as a red event node in BP
FOnHealthChanged OnHealthChanged;

// C++ side: bind and fire.
OnHealthChanged.AddDynamic(this, &AMyActor::HandleHealth);   // dynamic → AddDynamic + UFUNCTION
OnHealthChanged.Broadcast(NewHealth);
```

Use a **dynamic** multicast delegate whenever Blueprint must bind to the event (`BlueprintAssignable`);
its handler must be a `UFUNCTION`. Use a plain `DECLARE_MULTICAST_DELEGATE…` (bind with
`AddUObject`/`AddLambda`) only for C++-to-C++ events that never touch Blueprint. Overlap/hit
events (`OnComponentBeginOverlap`, `OnActorHit`) are already dynamic multicast — bind with
`AddDynamic`.

## Blueprint ↔ C++ parity

Same graph, two languages. Left = the Blueprint node; right = the C++ that does the same thing.

| Blueprint node | C++ |
| --- | --- |
| Event **BeginPlay** | `virtual void BeginPlay() override;` (call `Super::BeginPlay()`) |
| Event **Tick (Delta Seconds)** | `virtual void Tick(float DeltaSeconds) override;` |
| **Spawn Actor from Class** | `GetWorld()->SpawnActor<AWeapon>(Class, Loc, Rot);` |
| **Cast To** `X` | `if (AX* P = Cast<AX>(Obj)) { … }` (always null-check) |
| **Set Timer by Event** | `GetWorldTimerManager().SetTimer(H, this, &A::Fn, Rate, bLoop);` |
| **Print String** | `UE_LOG(LogTemp, Warning, TEXT("v=%d"), V);` / `GEngine->AddOnScreenDebugMessage(...)` |
| **Get Player Controller** | `UGameplayStatics::GetPlayerController(this, 0);` |
| **Bind Event to** `OnClicked` | `Button->OnClicked.AddDynamic(this, &U::Fn);` |

**Expose C++ → Blueprint:**

```cpp
UFUNCTION(BlueprintCallable, Category="X") void DoThing();     // callable node (has exec pins)
UFUNCTION(BlueprintPure,     Category="X") int32 GetScore() const;  // pure node (no exec pins)
UPROPERTY(EditAnywhere, BlueprintReadWrite) float Speed = 600.f;    // exposed variable
```

**Call Blueprint ← C++** (the hybrid hooks — declare in C++, implement/override in the BP subclass):

```cpp
// No C++ body — Blueprint provides the whole implementation. C++ just calls OnScored().
UFUNCTION(BlueprintImplementableEvent) void OnScored(int32 Points);

// C++ gives a default; Blueprint may override. Implement the C++ default in OnDamaged_Implementation.
UFUNCTION(BlueprintNativeEvent) void OnDamaged(float Amount);
void AMyActor::OnDamaged_Implementation(float Amount) { Health -= Amount; }
// Call the event from C++ by its plain name: OnScored(10);  OnDamaged(5.f);
```

Mapping table (every specifier), full expose/override examples, and the C++-base-+-BP-subclass
workflow → `references/blueprint-cpp-parity.md`.

## UMG (UI)

UI is a `UUserWidget` (design the visuals in a WBP asset; drive logic in C++ or its BP graph).
Bind C++ members to named widgets with `meta=(BindWidget)` — the C++ name must match the WBP
widget.

```cpp
UCLASS() class UHealthWidget : public UUserWidget { GENERATED_BODY()
    UPROPERTY(meta=(BindWidget)) TObjectPtr<UProgressBar> HealthBar;   // name matches WBP
    UFUNCTION(BlueprintCallable) void SetHealth(float Pct);
};
// Create + show from a PlayerController:
UHealthWidget* W = CreateWidget<UHealthWidget>(PC, WidgetClass);
W->AddToViewport();
```

Layout with panels (Canvas/V-H Box/Overlay/Grid); `SetVisibility`,
`RemoveFromParent` to hide/close; anchors + a design resolution for scaling.

## Paper2D (2D)

Enable the Paper2D plugin. Core types:

- **Sprite** (`UPaperSprite` asset, `UPaperSpriteComponent`) — a single textured quad.
- **Flipbook** (`UPaperFlipbook` asset, `UPaperFlipbookComponent`) — frames + FPS = animation;
  `SetFlipbook(...)` to swap states (idle/run/jump).
- **`APaperCharacter`** — a `ACharacter` whose mesh is a flipbook; you get
  `CharacterMovementComponent` (walk/jump) for free, driven by Enhanced Input just like 3D.
- **Tile maps** (`UPaperTileMap`, `UPaperTileMapComponent`) for level geometry.

2D uses the same Gameplay Framework, Enhanced Input, and lifecycle as 3D — only the visual
components differ. Constrain movement to a plane and use an orthographic camera.

## Packaging & build config (brief)

- **Build configurations**: `Debug`, `DebugGame`, `Development` (default for iteration —
  optimized engine, hot-reloadable game code), `Shipping` (fully optimized, logging/console
  stripped — ship this), `Test`.
- **Target files** (`*.Target.cs`) define Game/Editor/Client/Server targets; **module rules**
  (`*.Build.cs`) declare module dependencies (e.g. `"EnhancedInput"`, `"UMG"`, `"Paper2D"`).
- Package from **Platforms ▸ <target> ▸ Package Project**, or automate with
  `RunUAT BuildCookRun` (cook content → stage → package). Per-platform settings live in
  `Config/DefaultGame.ini` / `Default<Platform>Engine.ini`.

This is the minimum. Deep shipping — cooking, pak/IoStore, certification, size/perf budgets, CI —
is owned by [`gamedev-shipping`](../gamedev-shipping/SKILL.md). Overview + a starter `.Build.cs` →
`references/packaging.md`.

## Guardrails & gotchas

- **UPROPERTY-or-GC'd**: any UObject ref you keep must be a `UPROPERTY()` or it will be garbage
  collected and crash. This is the most common Unreal C++ bug.
- **Enhanced Input only** — no legacy Action/Axis mappings; add the `UInputMappingContext` via the
  local player subsystem in `BeginPlay`/on-possess, bind actions on `UEnhancedInputComponent`.
- **GameMode is server-only** — never read it on a client; put client-visible state on GameState
  or PlayerState and replicate.
- **No gameplay in the constructor** — the world isn't ready. Do it in `BeginPlay`.
- **Always null-check `Cast<T>()`** and `SpawnActor` results; they can return `nullptr`.
- **Don't `new`/`delete` UObjects** — `NewObject`/`SpawnActor` and let GC free them. Header
  changes need a full editor recompile (Live Coding covers `.cpp` bodies only).
- **Regenerate project files** after adding classes/modules; add module deps in `*.Build.cs`
  (missing `"EnhancedInput"`/`"UMG"` = linker errors).
- **Multiplayer**: replicate state with `UPROPERTY(Replicated)`, gate server actions behind
  `HasAuthority()` → see `gamedev-multiplayer`.

## Related skills

- [`cpp`](../cpp/SKILL.md) — plain C++/RAII/smart-pointer ownership for **non-UObject** code; this
  skill owns the Unreal reflection + GC model layered on top.
- [`gamedev-shipping`](../gamedev-shipping/SKILL.md) — deep cooking/packaging/store submission.
- [`gamedev-multiplayer`](../gamedev-multiplayer/SKILL.md) — replication, RPCs, authority.
- [`gamedev-physics`](../gamedev-physics/SKILL.md) — Chaos physics, collision, constraints.
- [`game-design`](../game-design/SKILL.md) — mechanics/loops before you build them.
- [`godot`](../godot/SKILL.md) / [`unity`](../unity/SKILL.md) — the other engines; route there
  when the project is Godot or Unity, not Unreal.

## Checklist

- [ ] Correct base class chosen (Actor/Pawn/Character; GameMode**Base** unless match-state needed).
- [ ] No legacy input — Enhanced Input (`UInputAction` + `UInputMappingContext` + subsystem).
- [ ] Every long-lived UObject/Actor ref is a `UPROPERTY() TObjectPtr<T>` (GC-safe).
- [ ] Components made in ctor via `CreateDefaultSubobject` + `SetupAttachment`; no logic in ctor.
- [ ] Tick left off unless required; periodic work on a timer/event.
- [ ] C++↔BP boundary correct: `BlueprintCallable`/`Pure` to expose, `BlueprintImplementableEvent`/
      `NativeEvent` for BP-overridable hooks; BP-bound delegates are dynamic multicast.
- [ ] UI is UMG (`UUserWidget` + `BindWidget`), not HUD canvas drawing.
- [ ] Server-only vs replicated state placed correctly (GameMode server-only).
- [ ] Module deps (`EnhancedInput`/`UMG`/`Paper2D`) added in `*.Build.cs`; project files regenerated.
