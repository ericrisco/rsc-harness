# Godot 4.x high-level multiplayer

The high-level API sits on top of `MultiplayerPeer` and gives you three moving parts: **transport**
(`ENetMultiplayerPeer`), **events** (`@rpc`), and **state** (`MultiplayerSynchronizer` +
`MultiplayerSpawner`). Authority is per-node, set with `set_multiplayer_authority()`.

Everything here is Godot 4.x. Godot 3.x used `master`/`puppet`/`remote`/`remotesync` keywords, `rset`,
and `NetworkedMultiplayerENet` — **all gone**; never emit them.

## Transport & connection

```gdscript
const PORT := 9999
const MAX_PLAYERS := 8

func host() -> void:
    var peer := ENetMultiplayerPeer.new()
    var err := peer.create_server(PORT, MAX_PLAYERS)
    if err != OK: push_error("host failed: %s" % err); return
    multiplayer.multiplayer_peer = peer

func join(ip := "127.0.0.1") -> void:
    var peer := ENetMultiplayerPeer.new()
    peer.create_client(ip, PORT)
    multiplayer.multiplayer_peer = peer

func _ready() -> void:
    multiplayer.peer_connected.connect(_on_peer_connected)     # server-side: a client joined
    multiplayer.peer_disconnected.connect(_on_peer_disconnected)
    multiplayer.connected_to_server.connect(_on_connected)     # client-side
    multiplayer.server_disconnected.connect(_on_server_gone)
```

Useful `multiplayer` (SceneMultiplayer) members: `is_server()`, `get_unique_id()` (1 == server),
`get_remote_sender_id()` (valid only inside an RPC body), `multiplayer_peer`.

## RPCs — the `@rpc` annotation

Params are optional and **order-free**. Signature: mode, sync, transfer mode, channel.

- **mode**: `"authority"` (default — only the node's multiplayer authority may invoke it on remotes) or
  `"any_peer"` (any client may invoke it — use this for client→server intent, then validate).
- **sync**: `"call_remote"` (default) or `"call_local"` (also run on the caller).
- **transfer**: `"unreliable"` (default), `"unreliable_ordered"`, or `"reliable"`.
- **channel**: an int, and it must be the **last** argument.

```gdscript
# Client asks the server to fire. any_peer + call_local so the host's own call runs too.
@rpc("any_peer", "call_local", "reliable")
func request_fire(target: Vector3) -> void:
    if not multiplayer.is_server(): return          # authority gate
    var shooter := multiplayer.get_remote_sender_id()
    if not _can_fire(shooter): return               # server-side cooldown / validation
    _apply_shot(shooter, target)                    # server mutates authoritative state

# Server → everyone, cosmetic only. Unreliable is fine for FX.
@rpc("authority", "call_local", "unreliable")
func play_muzzle_fx(at: Vector3) -> void:
    _spawn_fx(at)

# Invoking: rpc() = all peers; rpc_id(peer, ...) = one peer; rpc_id(1, ...) = the server.
func _on_fire_pressed(target: Vector3) -> void:
    rpc_id(1, "request_fire", target)               # client sends intent to server
```

Both sides must declare the **same** `@rpc` annotation on a function with the same name/path, or the call
is rejected. A missing/mismatched annotation is the usual "my RPC does nothing" cause.

## Authority

```gdscript
# On spawn, give the owning peer authority over its input node; server keeps authority over stats.
func setup(owner_peer_id: int) -> void:
    $Input.set_multiplayer_authority(owner_peer_id)      # recursive=true by default
    # $Stats stays under server authority (peer id 1)

func _physics_process(delta: float) -> void:
    if $Input.is_multiplayer_authority():                # only the owner reads local input
        var dir := Input.get_vector("left","right","up","down")
        rpc_id(1, "submit_input", dir)                   # send intent to server
```

`set_multiplayer_authority(id, recursive := true)` sets it on the node (and children). Check with
`is_multiplayer_authority()`; read with `get_multiplayer_authority()`. Authority drives who a
`MultiplayerSynchronizer` streams *from* and who may call `"authority"`-mode RPCs.

## State — MultiplayerSynchronizer

Add a `MultiplayerSynchronizer` node, assign it a **replication config** (`SceneReplicationConfig`, edited
in the inspector: list the properties to sync, e.g. `position`, `rotation`, and per-property spawn vs sync).
It streams those properties **from the node's authority to the other peers** every replication interval.

- `replication_interval` — how often synced properties are sent (throttle to save bandwidth).
- `delta_interval` — for delta-synced properties.
- Visibility: `set_visibility_for(peer_id, visible)`, `public_visibility`, `update_visibility()` — scope
  who receives a given synchronizer (relevancy / anti-wallhack).

Because it is authority-driven, an owner-authoritative synchronizer trusts the client's position — fine for
co-op, risky for competitive. For server-authoritative movement, keep authority on the server and have the
client send input via RPC (see prediction-and-latency.md).

## Spawning — MultiplayerSpawner

`MultiplayerSpawner` replicates *instancing*. Point its `spawn_path` at the parent node, register spawnable
scenes with `add_spawnable_scene("res://player.tscn")`, and when the authority instances a child under that
path (or you call `spawn(data)`), the same instance appears on every peer — including late joiners, which is
the big win over manually RPC-ing spawns.

```gdscript
@onready var spawner := $MultiplayerSpawner

func _ready() -> void:
    spawner.spawn_function = _spawn_player     # optional custom factory

func _on_peer_connected(id: int) -> void:      # server only
    if multiplayer.is_server():
        spawner.spawn(id)                      # data passed to spawn_function on every peer

func _spawn_player(peer_id: int) -> Node:
    var p := preload("res://player.tscn").instantiate()
    p.name = str(peer_id)
    p.setup(peer_id)
    return p
```

## Gotchas

- Server (peer 1) is also a client on a listen host — always gate authority logic behind `is_server()`.
- `get_remote_sender_id()` is only meaningful *inside* an RPC; it returns 0 outside one.
- Node paths must match across peers for RPCs/synchronizers to resolve — spawn via `MultiplayerSpawner` so
  names line up, and set `name` deterministically (e.g. the peer id).
- Reliable RPCs are ordered per channel and cost more; keep FX/heartbeats unreliable, keep state changes
  reliable or (better) replicated.
