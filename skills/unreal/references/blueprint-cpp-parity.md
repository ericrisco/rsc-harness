# Blueprint ↔ C++ parity (UE5)

Blueprint and C++ compile to the same reflected types. This is the full mapping + the exposure
specifiers + the hybrid (C++ base, Blueprint subclass) workflow.

## Node ↔ C++ mapping

| Blueprint node | C++ equivalent |
| --- | --- |
| Event BeginPlay | `virtual void BeginPlay() override;` — call `Super::BeginPlay()` first |
| Event Tick (Delta Seconds) | `virtual void Tick(float DeltaSeconds) override;` (enable `PrimaryActorTick.bCanEverTick`) |
| Construction Script | `virtual void OnConstruction(const FTransform& T) override;` |
| Spawn Actor from Class | `GetWorld()->SpawnActor<AType>(Class, Loc, Rot, Params);` |
| Spawn Actor Deferred + Finish | `SpawnActorDeferred<AType>(...)` then `UGameplayStatics::FinishSpawningActor(A, T)` |
| Cast To `X` | `if (AX* P = Cast<AX>(Obj)) { … }` (null on failure — always check) |
| Get Player Controller / Pawn / Character | `UGameplayStatics::GetPlayerController(this, 0)` / `GetPlayerPawn` / `GetPlayerCharacter` |
| Get Game Mode / Game State | `GetWorld()->GetAuthGameMode<AMyGameMode>()` / `GetGameState<AMyGameState>()` |
| Set Timer by Event / by Function | `GetWorldTimerManager().SetTimer(Handle, this, &A::Fn, Rate, bLoop, Delay);` |
| Delay | `FTimerHandle` one-shot timer, or a latent node from C++ via `FLatentActionInfo` |
| Print String | `UE_LOG(LogTemp, Warning, TEXT("x=%d"), X);` or `GEngine->AddOnScreenDebugMessage(-1, 5.f, FColor::Green, TEXT("hi"));` |
| Bind Event to `OnClicked` / `OnComponentBeginOverlap` | `Button->OnClicked.AddDynamic(this, &U::Handler);` |
| Get / Set variable | `UPROPERTY` member read/write |
| Make / Break struct | aggregate init / field access on a `USTRUCT` |
| Line Trace By Channel | `GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params);` |
| Attach Actor/Component to | `AttachToComponent(Parent, FAttachmentTransformRules::SnapToTargetNotIncludingScale)` |
| Destroy Actor | `Destroy();` |

## Expose C++ → Blueprint

```cpp
// --- Class visibility ---
UCLASS(Blueprintable)         // can be subclassed as a Blueprint
UCLASS(BlueprintType)         // can be used as a variable type / pin in Blueprint
// (both are common together on gameplay classes)

// --- Functions ---
UFUNCTION(BlueprintCallable, Category="Combat")
void Fire();                                  // impure node with exec pins (may have side effects)

UFUNCTION(BlueprintPure, Category="Combat")
float GetDamage() const;                      // pure node, no exec pins (read-only getter)

UFUNCTION(BlueprintCallable, meta=(WorldContext="WorldContextObject"))
static AItem* SpawnItem(UObject* WorldContextObject);   // static → library-style node

// --- Properties ---
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Stats")
float Speed = 600.f;                          // editable in editor + get/set in BP graph

UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Config")
TSubclassOf<AWeapon> WeaponClass;             // pick a class in the editor; read-only in BP

UPROPERTY(BlueprintAssignable, Category="Events")
FOnDied OnDied;                               // dynamic multicast delegate, bindable in BP
```

Specifier cheats: `EditAnywhere` (instances + defaults) · `EditInstanceOnly` · `EditDefaultsOnly`
(class defaults only) · `VisibleAnywhere` (read-only in editor). `BlueprintReadWrite` (get+set) vs
`BlueprintReadOnly` (get only). `meta=(AllowPrivateAccess="true")` exposes a `private` member.
`meta=(ClampMin="0", ClampMax="100")` bounds a numeric field in the editor.

## Call Blueprint ← C++ (overridable hooks)

Two ways to let a Blueprint subclass provide/override behavior a C++ base invokes:

```cpp
// (1) Implemented entirely in Blueprint. C++ declares it and calls it; there is NO C++ body.
UFUNCTION(BlueprintImplementableEvent, Category="Events")
void OnScored(int32 Points);

// (2) C++ gives a default implementation; Blueprint MAY override (and can call Parent).
UFUNCTION(BlueprintNativeEvent, Category="Events")
void OnDamaged(float Amount);
void AMyActor::OnDamaged_Implementation(float Amount)   // note the _Implementation suffix
{
    Health = FMath::Max(0.f, Health - Amount);
}

// Call BOTH from C++ by their plain names — the reflected thunk dispatches to BP if overridden:
void AMyActor::ApplyHit(float Dmg) { OnDamaged(Dmg); OnScored(10); }
```

To call an arbitrary Blueprint-defined function by name (rare — prefer the hooks above):
`FindFunction(FName("MyFn"))` + `ProcessEvent(Fn, &Params)`.

## The hybrid workflow (recommended default)

1. **C++ base class** (`UCLASS(Blueprintable)`): fields, systems, tick/perf-critical logic,
   the math. Expose tunables (`UPROPERTY(EditAnywhere, BlueprintReadWrite)`) and hooks
   (`BlueprintImplementableEvent` / `BlueprintNativeEvent`).
2. **Blueprint subclass** (Content Browser → Blueprint Class → pick your C++ class): designers
   set default values, assign meshes/materials/sounds/`TSubclassOf` refs, and script the hooks
   and per-instance behavior on the graph.
3. **Spawn/reference the Blueprint class**, not the C++ class, from the game (via a
   `TSubclassOf<AMyActor>` UPROPERTY the designer fills in) — otherwise the Blueprint's default
   values and graph never run.

Why: C++ gives speed, testability, and clean git diffs; Blueprint gives fast iteration and a
designer-editable surface. The reflection macros are the seam that keeps both in sync.

## Gotchas

- A `BlueprintAssignable` delegate must be a **dynamic** multicast (`DECLARE_DYNAMIC_MULTICAST_DELEGATE…`);
  a plain multicast delegate won't show in Blueprint.
- `AddDynamic` handlers must be `UFUNCTION`s; a non-`UFUNCTION` method silently fails to bind.
- Overriding a `BlueprintNativeEvent` in C++ means overriding `Fn_Implementation`, never `Fn`.
- Changing a `UFUNCTION`/`UPROPERTY` signature is a header change → full recompile, not Live Coding.
- Renaming a C++ property that a Blueprint references breaks the pin; use
  `UPROPERTY(meta=(DeprecatedProperty))` or a Core Redirect to migrate.
