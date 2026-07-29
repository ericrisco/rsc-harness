---
name: gamedev-multiplayer
description: "Use when adding multiplayer or netcode to a game — client-server vs P2P, server authority and anti-cheat, state replication vs RPCs, prediction and reconciliation, lag compensation, plus Godot 4 / Unity NGO / Unreal wiring. NOT single-player gameplay (that is `godot`, `unity`, `unreal`), NOT matchmaking or server hosting (that is `deployment`)."
tags: [multiplayer, netcode, replication, networking, prediction, authority]
recommends: [godot, unity, unreal, gamedev-physics]
profiles: [full]
origin: risco
---

# Game multiplayer & netcode

Design and wire the network layer of a game across Godot 4.x, Unity, and Unreal: choose a
topology, put authority in the right place, replicate the right state, and hide latency without
opening the door to cheaters. This skill owns the *networking* decisions; the engine skills own
the local gameplay those decisions sit on top of.

Route elsewhere when the ask is not netcode:

| The ask | Route to | Why not here |
| --- | --- | --- |
| Single-player movement, AI, input, animation, save files | [`godot`](../godot/SKILL.md) / [`unity`](../unity/SKILL.md) / [`unreal`](../unreal/SKILL.md) | The engine skill owns local gameplay; no network dimension. |
| Physics determinism, collision, character controllers | [`gamedev-physics`](../gamedev-physics/SKILL.md) | Netcode *consumes* determinism; it does not own the physics fix. |
| Matchmaking, lobby backend, dedicated-server hosting, relays, DB, game-server CI | [`deployment`](../deployment/SKILL.md) | Running the fleet, not designing the in-game net layer. |
| Web realtime — chat, presence, a generic WebSocket app | [`webhooks`](../webhooks/SKILL.md) | Not a game world/simulation. |
| General threat modeling, authz review | [`secure-coding`](../secure-coding/SKILL.md) | This skill keeps only the game-specific anti-cheat controls. |

## Version contract — read first

Target the current APIs. **Never emit these deprecated / removed APIs:**

| Engine | Target | Banned (removed/legacy) | Emit instead |
|---|---|---|---|
| **Godot** | 4.x | `master`/`puppet`/`remote`/`sync` keywords, `rpc_config()` as a func, `rset`, `NetworkedMultiplayerENet` | `@rpc(...)` annotation, `set_multiplayer_authority()`, `ENetMultiplayerPeer`, `MultiplayerSynchronizer` |
| **Unity** | Netcode for GameObjects (NGO) 1.x/2.x | UNet / HLAPI: `NetworkIdentity`, `[Command]`, `[SyncVar]`, `NetworkServer`, `UnityEngine.Networking` | NGO `NetworkObject`, `NetworkBehaviour`, `NetworkVariable<T>`, `[Rpc(SendTo.X)]` |
| **Unreal** | 5.x | replicating by polling in `Tick`, skipping `WithValidation` on gameplay RPCs | `UPROPERTY(Replicated / ReplicatedUsing=...)` + `GetLifetimeReplicatedProps`, `Server`/`Client`/`NetMulticast` `UFUNCTION`s |

UNet is **removed** from modern Unity — do not scaffold it. If a repo genuinely uses Mirror (a
community UNet-like fork), say so; this skill targets first-party NGO. In NGO 2.x the unified
`[Rpc(SendTo.Server)]` / `[Rpc(SendTo.ClientsAndHost)]` attribute is preferred; the older
`[ServerRpc]` / `[ClientRpc]` still compile (and enforce `…ServerRpc` / `…ClientRpc` method-name
suffixes) — cover them but prefer the unified form on new code.

## Topologies & authority

Pick the topology first; everything else follows from it.

- **Client-server, dedicated server** — a headless authoritative process no player controls. The gold
  standard for competitive/persistent games: one source of truth, hardest to cheat, costs money to run.
- **Client-server, listen server** — one player's machine is also the server (host). Cheap, zero infra,
  but the host has a latency advantage and can tamper; fine for co-op and casual PvP. **Design so the
  same code runs on both** (a listen server is a dedicated server that also has a local client).
- **Peer-to-peer** — no central authority; peers exchange state directly. Low infra cost and low latency
  between peers, but NAT traversal is painful, it is the easiest to cheat, and it needs lockstep or a
  rollback model to stay consistent. Reasonable for small trusted lobbies or deterministic fighting games.

**Server-authoritative is the default.** The server owns the truth; clients send *intent* (inputs,
requests), never results. **Never trust the client:** the client cannot set its own health, position,
score, currency, or hit results — it *asks*, the server *decides*, everyone else *observes*. A client
that says "I moved to X / I did 40 damage / I have 999 gold" is either lagging or cheating; treat both
the same. The one thing a client legitimately owns is its own input and, by convention, cosmetic-only
state. See **[references/prediction-and-latency.md](references/prediction-and-latency.md)** for how to
keep this responsive.

## State replication vs RPCs

Two complementary tools — use the right one:

- **State replication** = *continuous* synchronized values (health, position, ammo, team). The framework
  watches a variable and pushes changes to relevant peers; late-joiners get the current value automatically.
  Use for anything a client needs the *latest* of. It is idempotent and self-healing on packet loss.
- **RPCs (remote procedure calls)** = *one-shot events* ("fire weapon", "play explosion at P", "open door").
  Fire-and-forget; a dropped unreliable RPC is simply lost. Use for events, **never** for state you need to
  stay consistent — a missed "you died" RPC leaves a client desynced forever; a replicated `isDead` bool
  self-corrects.

**Rule of thumb:** replicate *nouns* (state), RPC *verbs* (events). What to replicate: only what other
peers must see, at the coarsest rate that still looks right — position/rotation of visible actors,
gameplay stats, animation state flags. Do **not** replicate values a peer can derive locally, purely
cosmetic particles, or high-frequency data no one observes.

**Ownership / authority** decides *who may write*. Every networked object has an owner (a peer id) and an
authority (usually the server). Writes to replicated state must come from the authority; ownership lets a
client drive *its own* pawn's input while the server still validates the outcome. Getting ownership wrong
is the #1 cause of "it works for the host but not the client" bugs.

## The hard problems

Latency (round-trip time, RTT) is the enemy; jitter and packet loss make it worse. Four techniques,
covered in depth in **[references/prediction-and-latency.md](references/prediction-and-latency.md)**:

1. **Client-side prediction** — the owning client applies its own input *immediately* instead of waiting a
   full RTT for the server, so local movement feels instant.
2. **Server reconciliation** — the server is still authoritative; the client tags each input with a sequence
   number, and when the authoritative state arrives it *replays* any inputs the server hadn't processed yet.
   Mismatch → a correction (the visible "rubber-band"); minimize it, don't hide it.
3. **Snapshot interpolation** — *remote* entities are rendered ~100 ms in the past, interpolating between the
   last two received snapshots, so other players move smoothly instead of teleporting between updates.
4. **Lag compensation** — for hitscan/instant hits, the server rewinds other entities to where the shooter
   *saw* them (at the shooter's render time) before testing the hit. Fairer for the shooter; occasionally
   "shot behind a wall" for the victim. A deliberate tradeoff, not a bug.

**Tick rate / netrate:** the server simulates at a fixed tick (e.g. 20–64 Hz) and sends state at a *send
rate* that may be lower than its sim rate and decoupled from client render FPS. Never tie gameplay to frame
rate on a networked game — simulate on a fixed timestep, interpolate for rendering.

## Per-engine mapping

Short form here; full patterns in the references. All snippets are current-API.

### Godot 4.x — high-level multiplayer

`ENetMultiplayerPeer` for transport, `@rpc` for events, `MultiplayerSynchronizer` for state, and
`MultiplayerSpawner` to replicate object spawns. Authority via `set_multiplayer_authority(peer_id)`.

```gdscript
# Host / join
func host(port := 9999) -> void:
    var peer := ENetMultiplayerPeer.new()
    peer.create_server(port, 8)
    multiplayer.multiplayer_peer = peer

func join(ip: String, port := 9999) -> void:
    var peer := ENetMultiplayerPeer.new()
    peer.create_client(ip, port)
    multiplayer.multiplayer_peer = peer

# RPC: params are optional and order-free. any_peer lets clients call it;
# authority (default) means only the multiplayer authority may call it.
@rpc("any_peer", "call_local", "reliable")
func request_fire(target: Vector3) -> void:
    if not multiplayer.is_server(): return          # server validates
    var shooter := multiplayer.get_remote_sender_id()
    _resolve_shot(shooter, target)                  # server decides the result
```

- `set_multiplayer_authority(id)` on a node; check with `is_multiplayer_authority()`. A player scene
  usually gives its input node authority to the owning peer while the server keeps authority over health.
- `MultiplayerSynchronizer` streams a chosen property list (position, etc.) from the authority to peers;
  set its replication interval and visibility (`set_visibility_for(peer, bool)`) to scope bandwidth.
- `MultiplayerSpawner` replicates instancing of scenes under a path so late peers get existing objects.
- Details, prediction wiring, and the full player-scene pattern:
  **[references/godot-high-level-multiplayer.md](references/godot-high-level-multiplayer.md)**.

### Unity — Netcode for GameObjects

`NetworkObject` (the identity, spawned via `Spawn()`), `NetworkBehaviour` (networked scripts),
`NetworkVariable<T>` (replicated state), and RPCs. `NetworkManager.Singleton.StartHost/StartServer/StartClient`.

```csharp
public class Player : NetworkBehaviour {
    // Default perms: everyone reads, only the SERVER writes → authoritative health.
    public NetworkVariable<int> Health = new(100);

    [Rpc(SendTo.Server)]                       // client → server: an intent
    void FireRpc(Vector3 target) {
        // runs on the server; validate, then apply and let NetworkVariables replicate the result
        ResolveShot(OwnerClientId, target);
    }

    [Rpc(SendTo.ClientsAndHost)]               // server → everyone: an event
    void PlayMuzzleFxRpc(Vector3 at) { /* cosmetic only */ }
}
```

- Ownership/role: `IsOwner`, `IsServer`, `IsClient`, `IsHost`, `OwnerClientId`. Only owners should send
  owner-intent RPCs; the server validates regardless.
- `NetworkVariable<T>(value, readPerm, writePerm)` — `NetworkVariableWritePermission.Server` (default) vs
  `.Owner`; subscribe via `OnValueChanged`. Use `NetworkTransform` for pos/rot sync.
- Prefer the unified `[Rpc(SendTo.X)]`; legacy `[ServerRpc]`/`[ClientRpc]` still work but need the
  method-name suffixes. Full patterns:
  **[references/unity-and-unreal-netcode.md](references/unity-and-unreal-netcode.md)**.

### Unreal — Actor replication

Set `AActor::bReplicates = true` (or `SetReplicates(true)`). Replicate properties with `UPROPERTY` and
register them in `GetLifetimeReplicatedProps`; use RPC `UFUNCTION` specifiers for events.

```cpp
UPROPERTY(ReplicatedUsing = OnRep_Health)   // RepNotify fires on clients when it changes
float Health = 100.f;

UFUNCTION(Server, Reliable, WithValidation)  // client → server intent (+ validation)
void ServerFire(FVector Target);

UFUNCTION(NetMulticast, Unreliable)          // server → all: cosmetic event
void MulticastMuzzleFx(FVector At);

void AMyPawn::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const {
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(AMyPawn, Health);          // or DOREPLIFETIME_CONDITION for push/owner-only
}
```

- Authority check: `HasAuthority()` (server or standalone); roles `ROLE_Authority`, `ROLE_AutonomousProxy`
  (the owning client), `ROLE_SimulatedProxy` (observed elsewhere).
- **Relevancy** keeps bandwidth sane: `NetCullDistanceSquared`, `bAlwaysRelevant`, `IsNetRelevantFor`, and
  dormancy (`SetNetDormancy`) stop replicating actors a client can't perceive. Movement replicates via
  `CharacterMovementComponent`, which already does prediction+reconciliation for you.
- RepNotify vs Multicast, GAS/Network Prediction notes:
  **[references/unity-and-unreal-netcode.md](references/unity-and-unreal-netcode.md)**.

## Security / anti-cheat basics

- **Validate every client input on the server** — bounds-check movement deltas, cooldowns, line-of-sight,
  and resource costs. Reject the impossible; never assume a well-behaved client.
- **Send a client only what it may know.** Don't replicate enemy positions through walls (wallhack fuel),
  full inventories of others, or hidden RNG seeds — scope with relevancy/visibility.
- Rate-limit and sanity-check RPCs; a client spamming `ServerFire` faster than the weapon allows is caught
  by server-side cooldowns, not client-side ones.
- Encryption/DTLS stops packet tampering on the wire but does **not** stop a modified client — only server
  authority does. Treat anti-cheat as defense in depth, not a product this skill ships.

## Testing multiplayer locally

- **Godot:** enable *Debug → Run Multiple Instances* (2–4 windows) to host+join on one machine.
- **Unity:** *Multiplayer Play Mode* (or ParrelSync) runs several virtual players from one project;
  Network Simulator injects latency/loss.
- **Unreal:** PIE *Number of Players* + *Net Mode* (Play As Listen Server / Client), and *Net PktLag* /
  packet-emulation console vars to fake latency.
- Always test **with simulated latency and packet loss**, not just on localhost — localhost hides every
  prediction/reconciliation bug. Test the client path, not only the host's.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Writing net code before the topology is chosen | Authority and cost model change everything downstream | Pick dedicated / listen / P2P first, and make the *same code* run on server and listen host |
| Trusting a client-reported result (health, position, score, hit) | That is the cheat surface, and lag looks identical to cheating | Clients send intent only; the server validates and owns all gameplay state |
| RPCing state that must stay consistent | A dropped unreliable event desyncs that client permanently | Replicate nouns (state), RPC verbs (events) — replicated values self-correct |
| Ownership/authority left implicit | The #1 cause of "works for the host, breaks for the client" | Set authority/ownership explicitly on spawn |
| Forgetting the listen-server host is also a client | Authority-only logic double-executes on the host | Guard it behind `is_server()` / `HasAuthority()` |
| Making the owning client wait a full RTT for its own input | Movement feels sluggish and unresponsive | Predict locally + reconcile; snapshot-interpolate remote entities |
| Client-side hit detection for hitscan | Trivially spoofed, and unfair to the higher-ping shooter | Server-side lag compensation: rewind to the shooter's render time |
| Tying simulation to render FPS | Sim diverges between machines at different frame rates | Fixed timestep on the sim, interpolate on the render |
| Replicating everything, every tick, to everyone | Melts bandwidth and leaks wallhack fuel | Scope by relevancy/visibility and send rate; rate-limit RPCs |
| Testing only on localhost | 0 ms RTT masks the exact desync/rubber-band bugs players will hit | Inject latency + packet loss across instances, exercising the client path |
| Emitting UNet/HLAPI, Godot 3.x `master`/`puppet`/`rset`, or `Tick`-polled Unreal replication | Removed or legacy — it will not compile or will silently underperform | The current APIs in the version contract above |
