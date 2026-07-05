# UE5 Gameplay Framework — responsibilities & flow

The Gameplay Framework is Unreal's opinionated skeleton for a game. Put each responsibility in
the class that owns it; fighting the framework is the usual cause of "where does this code go?"

## The classes

### AActor
Base for anything with a presence in a level — placed or spawned at runtime. Holds a tree of
components rooted at `RootComponent` (a `USceneComponent` giving it a transform). Actors are
GC'd UObjects; spawn with `SpawnActor<T>()`, remove with `Destroy()`. Everything below is an
Actor except components.

### UActorComponent / USceneComponent / UPrimitiveComponent
Reusable, composable behavior/data attached to an Actor.
- `UActorComponent` — logic/data, no transform (e.g. an inventory or health component).
- `USceneComponent` — adds a transform; can be attached in a hierarchy.
- `UPrimitiveComponent` — a scene component with geometry that renders/collides
  (`UStaticMeshComponent`, `USkeletalMeshComponent`, `UCapsuleComponent`, `UBoxComponent`).
Prefer composition (small components) over deep Actor inheritance.

### APawn
An Actor that a controller can **possess** and drive. Minimal by itself (add a mesh + movement
if you want them). Use a bare Pawn for non-humanoid controllables (a ship, a camera, a ball).

### ACharacter
A Pawn preconfigured for a walking humanoid: `UCapsuleComponent` (collision), a
`USkeletalMeshComponent`, and a `UCharacterMovementComponent` that implements walking, falling,
jumping, crouching, and swimming — all **network-replicated** with client prediction. In 2D,
`APaperCharacter` is the equivalent with a flipbook mesh.

### AController / APlayerController / AAIController
The "brain" that possesses a Pawn. The Pawn is the body; the controller persists across
possession changes.
- `APlayerController` — one per human player: receives input, owns the camera
  (`PlayerCameraManager`), owns/creates the player's UI, and is the client's authority link.
  Input setup and HUD widgets live here (or on the Character it possesses).
- `AAIController` — drives an AI Pawn (behavior tree, perception, navmesh pathing).

### APlayerState
Per-player **replicated** data that must survive the Pawn dying/respawning: display name, score,
ping, team. Lives on every machine for every player. Do NOT put transient input here.

### AGameModeBase / AGameMode
The **rules** of the current level/match. Defines the default classes (`DefaultPawnClass`,
`PlayerControllerClass`, `HUDClass`, `GameStateClass`, `PlayerStateClass`), handles login and
where/what to spawn for a joining player. **Exists only on the server / authority** — clients
have `nullptr`. Use `AGameModeBase` (lean) by default; use `AGameMode` only when you need its
`MatchState` machine (WaitingToStart → InProgress → …) for match-based multiplayer.

### AGameStateBase / AGameState
Game-wide state that **all clients** need to see: current match phase, shared/team score, the
replicated array of `APlayerState`. Replicated from the server. This is how clients learn
game-level facts (the GameMode that owns those facts is server-only).

### AHUD / UUserWidget
On-screen UI. `AHUD` is the legacy immediate-mode canvas; **prefer UMG** — build a `UUserWidget`,
`CreateWidget` + `AddToViewport` from the `APlayerController`.

## Where does my code go?

| I need to… | Put it on |
| --- | --- |
| Read input, move the camera, open menus | `APlayerController` (or the possessed `Character`) |
| Store score/name that survives respawn | `APlayerState` |
| Decide who wins, when the match starts, where to spawn | `AGameModeBase` (server) |
| Share match phase / team score with all clients | `AGameStateBase` (replicated) |
| Make a thing that walks and jumps | `ACharacter` / `APaperCharacter` |
| Make a reusable ability (health, inventory) | a `UActorComponent` added to the owner |
| Make a placeable prop / pickup / trigger | `AActor` with the right components |

## Startup / spawn order (server or standalone)

```
Level loads
  → GameMode spawned (authority only)
    → for each player: PlayerController spawned
      → GameMode spawns the Pawn/Character (DefaultPawnClass) at a PlayerStart
        → PlayerController Possesses the Pawn
          → PlayerState created & associated
  → GameState spawned and replicated to clients
  → All actors: PostInitializeComponents → BeginPlay
```

Client join adds: connect → PlayerController (client proxy) → GameState/PlayerState replicate
down → possessed Pawn replicates down. Remember: the client never sees the GameMode.

## Possession pattern

```cpp
// Give a player a new body (e.g. respawn or vehicle enter):
APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
ACharacter* NewBody = GetWorld()->SpawnActor<ACharacter>(BodyClass, SpawnT);
PC->Possess(NewBody);          // controller now drives NewBody; input/camera follow
```
