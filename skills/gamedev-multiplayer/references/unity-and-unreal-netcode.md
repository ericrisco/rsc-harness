# Unity & Unreal netcode

Per-engine deep dive for the two C#/C++ engines. Godot lives in its own reference.

---

## Unity — Netcode for GameObjects (NGO)

NGO is Unity's first-party high-level netcode. **UNet / HLAPI is removed** — never emit `NetworkIdentity`,
`[Command]`, `[SyncVar]`, `NetworkServer`, or anything under `UnityEngine.Networking`. (Mirror is a
community fork with a UNet-like API; if a repo uses it, name it, but this reference targets NGO.)

### Setup & session

- One `NetworkManager` in the scene, with a chosen transport (Unity Transport / UTP).
- Start a session: `NetworkManager.Singleton.StartHost()` (server + local client), `.StartServer()`
  (dedicated/headless), or `.StartClient()`.
- Networked prefabs need a `NetworkObject` and must be registered in the NetworkManager prefab list;
  the **server** spawns them: `Instantiate(...).GetComponent<NetworkObject>().Spawn()`.

### NetworkBehaviour, roles, lifecycle

Networked scripts derive from `NetworkBehaviour`. Use `OnNetworkSpawn()` / `OnNetworkDespawn()` instead of
`Start` for network-aware init. Role/ownership properties: `IsServer`, `IsClient`, `IsHost`, `IsOwner`,
`OwnerClientId`, `NetworkObjectId`.

### NetworkVariable — replicated state

```csharp
public class PlayerState : NetworkBehaviour {
    // Default: read Everyone, write Server → authoritative health.
    public NetworkVariable<int> Health = new(100);

    // Client convenience state: owner writes, everyone reads.
    public NetworkVariable<int> SkinIndex =
        new(0, NetworkVariableReadPermission.Everyone, NetworkVariableWritePermission.Owner);

    // Hidden-from-others: owner reads, owner writes.
    public NetworkVariable<int> Ammo =
        new(default, NetworkVariableReadPermission.Owner, NetworkVariableWritePermission.Owner);

    public override void OnNetworkSpawn() {
        Health.OnValueChanged += (prev, cur) => UpdateHealthBar(cur);
    }
}
```

`NetworkVariableReadPermission` is `Everyone` | `Owner`; `NetworkVariableWritePermission` is `Server` |
`Owner`. Default (no perms arg) = read Everyone, write Server — the right default for authoritative gameplay
values. Only the permitted writer may assign `.Value`; a client writing a server-write variable is ignored.

### RPCs

NGO 2.x's unified attribute is preferred:

```csharp
[Rpc(SendTo.Server)]                 // client → server
void FireRpc(Vector3 target) { /* runs on server; validate + apply */ }

[Rpc(SendTo.ClientsAndHost)]         // server → all clients (+ host)
void PlayFxRpc(Vector3 at) { /* cosmetic */ }

[Rpc(SendTo.Owner)]                  // server → the owning client only
void YouWereHitRpc(int dmg) { }
```

`SendTo` options include `Server`, `ClientsAndHost`, `Everyone`, `Owner`, `NotServer`, `SpecifiedInParams`.
The **legacy** attributes still compile and enforce method-name suffixes:

```csharp
[ServerRpc(RequireOwnership = true)]  void FireServerRpc(Vector3 t) { }   // name MUST end in ServerRpc
[ClientRpc]                           void PlayFxClientRpc(Vector3 a) { } // name MUST end in ClientRpc
```

Prefer `[Rpc(SendTo.X)]` on new code; recognize the legacy pair in existing code. RPCs are unreliable by
default for some configs — mark reliability via the attribute's `Delivery` where consistency matters.

### Transforms & movement

`NetworkTransform` replicates position/rotation/scale (server-authoritative by default; an
`OwnerNetworkTransform`/authority setting allows client-authoritative). For server-authoritative movement
with responsiveness you add prediction yourself (NGO does not ship full prediction; see
prediction-and-latency.md). `NetworkAnimator` syncs Animator state.

### Gotchas

- Only the **server** may `Spawn()`/`Despawn()` NetworkObjects.
- Writing a `NetworkVariable` you don't have write permission for silently no-ops — check perms first.
- `IsOwner` ≠ `IsServer`; on a listen host both can be true. Gate authoritative logic on `IsServer`.
- Legacy RPC name-suffix rule is a compile error if violated; the unified `[Rpc]` has no such rule.

---

## Unreal Engine 5.x — Actor replication

Replication is per-`AActor`. Turn it on (`bReplicates = true` in the constructor or `SetReplicates(true)`),
mark properties, and register them. RPCs are `UFUNCTION`s with network specifiers.

### Replicated properties

```cpp
// Header
UPROPERTY(Replicated)
int32 Score = 0;

UPROPERTY(ReplicatedUsing = OnRep_Health)     // RepNotify: OnRep_Health() runs on clients on change
float Health = 100.f;

UFUNCTION() void OnRep_Health();

// Cpp — every replicated prop MUST be registered here
void AMyPawn::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const {
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(AMyPawn, Score);
    DOREPLIFETIME(AMyPawn, Health);
    // DOREPLIFETIME_CONDITION(AMyPawn, Ammo, COND_OwnerOnly);   // owner-only relevancy
}
```

`ReplicatedUsing` (RepNotify) is how you react to a change — use it instead of polling the value in `Tick`.
The **push model** (`SetReplicatedByCondition` / `MARK_PROPERTY_DIRTY`) avoids per-frame comparison for
high-count actors.

### RPCs

```cpp
UFUNCTION(Server, Reliable, WithValidation)   // client → server (validated)
void ServerFire(FVector Target);
bool ServerFire_Validate(FVector Target) { return Target.SizeSquared() < 1e8f; }
void ServerFire_Implementation(FVector Target) { /* server applies */ }

UFUNCTION(Client, Reliable)                    // server → owning client
void ClientNotifyHit(int32 Dmg);

UFUNCTION(NetMulticast, Unreliable)            // server → all relevant clients
void MulticastMuzzleFx(FVector At);
```

- `Server` RPCs run on the server, callable by the owning client; add `WithValidation` for gameplay-critical
  ones and reject cheating inputs in `_Validate`.
- `Client` RPCs run on the actor's owning client only.
- `NetMulticast` runs on the server and all relevant clients — cosmetic events; keep unreliable.
- `Reliable` vs `Unreliable`: reliable is guaranteed+ordered but can saturate; reserve for gameplay.

### Roles, authority, relevancy

- `HasAuthority()` → true on the server (or standalone). Guard server logic with it.
- `GetLocalRole()`: `ROLE_Authority` (server), `ROLE_AutonomousProxy` (the owning client's predicted pawn),
  `ROLE_SimulatedProxy` (an observed remote actor). Prediction lives on autonomous proxies.
- **Relevancy** controls what each client receives: `NetCullDistanceSquared`, `bAlwaysRelevant`,
  `bOnlyRelevantToOwner`, override `IsNetRelevantFor`, and **dormancy** (`SetNetDormancy(DORM_DormantAll)`)
  to stop replicating quiescent actors. This is the main bandwidth/anti-wallhack lever.

### Movement & prediction

`UCharacterMovementComponent` already implements client-side prediction + server reconciliation for
character movement — use `ACharacter` and let it do the work rather than hand-rolling. For abilities, the
Gameplay Ability System (GAS) has prediction; the Network Prediction plugin generalizes it (experimental).

### Gotchas

- Forgetting `DOREPLIFETIME` = the property silently never replicates.
- RPC specifiers are directional: calling a `Server` RPC from the server, or a `Client` RPC from a client,
  does nothing useful — respect the flow (client→Server, server→Client/Multicast).
- Actors only replicate if `bReplicates` is true *and* the actor is net-relevant to that client.
- On a listen server the host is authority + local player; `HasAuthority()` is your gate.
