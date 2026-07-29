---
name: godot
description: "Use when writing, reviewing, or debugging Godot 4.x games in GDScript or C# — scenes, nodes, custom Resources, autoload/EventBus signals, typed GDScript, CharacterBody2D/3D movement, GUT/gdUnit4 — or porting Godot 3 APIs to 4. NOT Unity/Unreal (that is `unity`/`unreal`), NOT `.gdshader` code (`gamedev-shaders`), NOT GDExtension C++ tooling (`cpp`)."
tags: [godot, gdscript, game-dev, csharp, godot4]
recommends: [gamedev-shaders, gamedev-multiplayer, gamedev-physics, gamedev-pathing, gamedev-shipping, game-design, cpp]
profiles: [full]
origin: risco
---

# Godot 4.x (GDScript + C#)

Build 2D and 3D the way the engine is designed: scenes as reusable units, composition over deep node
trees, signals for decoupling, static typing for speed and safety. GDScript (typed) is primary; C#
parity snippets sit beside it.

## Version contract — read first

**This is Godot 4.x. Never emit Godot 3 APIs.** Godot 4 renamed core nodes, moved annotations
behind `@`, replaced `yield` with `await`, and switched signal/file/tween APIs. A Godot 3 snippet
will not even parse in 4.x. Before writing or accepting any line, check it against this ban-list:

| Never (Godot 3) | Always (Godot 4.x) |
| --- | --- |
| `yield(timer, "timeout")` | `await timer.timeout` |
| `onready var x = ...` | `@onready var x = ...` |
| `export var hp = 3` | `@export var hp := 3` |
| `tool` (script mode line) | `@tool` (annotation, first line) |
| `KinematicBody` / `KinematicBody2D` | `CharacterBody3D` / `CharacterBody2D` |
| `Spatial` | `Node3D` |
| `Area` / `RigidBody` / `StaticBody` | `Area3D` / `RigidBody3D` / `StaticBody3D` |
| `Sprite` | `Sprite2D` |
| `scene.instance()` | `scene.instantiate()` |
| `move_and_slide(velocity, UP)` (positional) | set `velocity` property, then `move_and_slide()` — **no args** |
| `connect("hit", self, "_on_hit")` | `node.hit.connect(_on_hit)` (Callable) |
| `File.new()` / `Directory.new()` | `FileAccess.open(...)` / `DirAccess.open(...)` |
| standalone `Tween` node + `interpolate_property` | `create_tween()` → `tween.tween_property(...)` |
| `OS.get_ticks_msec` for gameplay timing | `Time.get_ticks_msec()` (OS timing moved to `Time`) |
| `PoolByteArray` / `PoolVector2Array` | `PackedByteArray` / `PackedVector2Array` |

**Lifecycle overrides must chain the parent** with `super()` (Godot 3 called it implicitly; Godot 4
does not). If you override `_ready`, `_process`, `_init`, etc. in a script that `extends` another
script defining them, call `super()` / `super._ready()` or the base logic silently never runs.

**Silent-breakers** (compile fine, behave wrong — the dangerous class):

- `Array.slice(begin, end)` — `end` is now **exclusive** (was inclusive in Godot 3). `[1,2,3,4].slice(1,3)` → `[2,3]`.
- `Camera2D.zoom` is **inverted** vs Godot 3: a **larger** zoom now means zoomed **in** (magnified). `Vector2(2,2)` = 2× magnification, not half.
- `TileMap` is **deprecated** → use one `TileMapLayer` node per layer (since 4.3).
- Angles are radians; `_process(delta)` delta is a `float` (GDScript) / `double` (C#) in **seconds**.

Full table with every rename → `references/godot3-to-4-traps.md`.

## Project & scene organization

- The **scene** (`.tscn`) is the reusable unit — a self-contained tree you instance many times
  (a Player, a Bullet, a HUD). Prefer **composition**: small scenes/nodes assembled, not one
  60-node monolith. If a subtree has its own behavior, make it its own scene.
- One responsibility per script. Attach behavior to the scene's **root**; child nodes are parts.
- `class_name Foo` registers a global type usable in the inspector and as `Foo.new()`. Use it for
  reusable scripts and custom Resources; skip it for one-off scene scripts.
- **Files**: `snake_case.gd` / `snake_case.tscn` for scenes and scripts; `PascalCase` for node
  names in the tree and for `class_name`. Group by feature (`player/`, `enemy/`, `ui/`), not by type.

## Nodes vs scenes vs scripts vs custom Resources

| You need | Use |
| --- | --- |
| A thing in the tree that renders / moves / collides / processes | a **Node** (typed subclass) |
| A reusable, instanceable bundle of nodes | a **scene** (`.tscn`) |
| Behavior attached to a node | a **script** (`.gd` / `.cs`) |
| Pure data (stats, items, dialogue, level config) with no place in the tree | a **custom `Resource`** (`.tres`) |

Custom `Resource`s are Godot's typed, savable, inspector-editable data objects — reach for them
instead of loose Dictionaries or JSON for game data. See `references/nodes-scenes-resources.md`.

```gdscript
class_name EnemyStats extends Resource
@export var max_health: int = 30
@export var speed: float = 120.0
@export var loot_table: Array[ItemDrop] = []
```

## Autoloads / singletons + EventBus

Register a script or scene as an **autoload** (Project → Project Settings → Globals/Autoload) to get
one always-present instance reachable by name from anywhere. Use it for cross-cutting state (save
game, audio, run config) — not as a dumping ground.

The **EventBus** pattern decouples unrelated systems: an autoload that owns only signals. Emitters
and listeners never reference each other, just the bus.

```gdscript
# event_bus.gd  (autoload named "Events")
extends Node
signal enemy_died(position: Vector2, xp: int)
signal score_changed(new_score: int)
```
```gdscript
# emitter                              # listener (anywhere)
Events.enemy_died.emit(global_position, 10)
Events.enemy_died.connect(_on_enemy_died)
```

Keep gameplay logic in nodes; let the bus carry the *notification*, not the behavior.

## Node access & lifecycle

- `_init()` runs at construction (no tree, no `@onready` yet). `_ready()` runs once the node and
  all children are in the tree — do node wiring here.
- `@onready var x = $Path` defers the assignment to `_ready`, so the child exists. Never grab
  children in `_init`.
- **Prefer unique names**: mark a node **Unique Name in Owner** (`%`) and access `%HealthBar`
  instead of the fragile, refactor-breaking `get_node("../../UI/HealthBar")`. `$Foo` is fine for a
  direct child — `get_node`/`$` on a missing path returns `null` and errors.
- Cache node lookups in `@onready` vars; don't call `get_node` every frame.
- **Freeing**: call `queue_free()` (safe, end of frame), not `free()` mid-signal. Guard reused refs
  with `is_instance_valid(node)`.
- Never busy-wait; `await get_tree().create_timer(1.0).timeout` or `await` a signal.

```gdscript
extends CharacterBody2D
@onready var sprite: Sprite2D = $Sprite2D
@onready var health_bar: ProgressBar = %HealthBar   # unique name, position-independent

func _ready() -> void:
    super()                       # chain the parent's _ready if the base defines one
    health_bar.value = 100
```

## Signals

Signals are Godot's decoupling primitive. In Godot 4 you connect a **Callable**, not strings.

- **Declare** with typed params; **name in the past tense** for facts that happened
  (`health_depleted`, `item_collected`), present-tense imperative only for requests.
- **Connect**: `node.signal_name.connect(_on_thing)` — a direct method reference, checked at parse
  time. Add `CONNECT_ONE_SHOT` for auto-disconnect after one fire.
- **Disconnect discipline**: a connection to a node that gets freed is cleaned up automatically, but
  connections you make to *long-lived* objects (autoloads, the bus) from a short-lived node must be
  disconnected in `_exit_tree()`, or use `CONNECT_ONE_SHOT`, to avoid calls into freed instances.

```gdscript
signal health_depleted
signal health_changed(current: int, max: int)

func take_damage(amount: int) -> void:
    _health -= amount
    health_changed.emit(_health, _max_health)
    if _health <= 0:
        health_depleted.emit()
```

## @export / @tool (inspector config)

`@export` exposes a variable in the Inspector so designers tune it without touching code. Use ranges,
groups, and typed exports so the inspector gives real widgets and validation.

```gdscript
@export var title: String = "Level 1"
@export_range(0.0, 1.0, 0.05) var volume := 0.8
@export_group("Movement")
@export var speed: float = 300.0
@export var jump_velocity: float = -400.0
@export var projectile: PackedScene           # drag a .tscn in the inspector
@export var stats: EnemyStats                 # a custom Resource slot
```

`@tool` at the top of a script runs it **in the editor** too — for gizmos, procedural previews, or
validating exported data. Guard runtime-only code with `if Engine.is_editor_hint(): return`.

## Static (typed) GDScript

Type everything. Typed GDScript is faster (the VM skips dynamic dispatch) and catches errors at parse
time. Use `:=` when the type is inferable, `: Type` when it isn't, and avoid `Variant`/untyped.

```gdscript
var speed: float = 300.0          # explicit
var dir := Vector2.ZERO           # inferred
var enemies: Array[Enemy] = []    # typed array

func distance_to(target: Node2D) -> float:
    return global_position.distance_to(target.global_position)

func _on_body_entered(body: Node) -> void:
    var enemy := body as Enemy     # safe cast → null if wrong type, no crash
    if enemy:
        enemy.take_damage(10)
```

Naming: `snake_case` vars/funcs/signals, `PascalCase` types/`class_name`/nodes, `CONSTANT_CASE`
consts, tabs for indent, lines < 100 cols. Cheat-sheet → `references/gdscript-style.md`.

## `_process` vs `_physics_process`

- `_physics_process(delta)` — **fixed** tick (default 60 Hz), the same every step. All movement,
  `move_and_slide()`, forces, and collision-dependent logic go here.
- `_process(delta)` — runs **once per rendered frame** (variable rate). Use for visuals, UI, and
  non-physics polish.
- **Always scale rate-based change by `delta`** so behavior is framerate-independent. `move_and_slide()`
  and `move_and_collide()` already fold in `delta` internally — do **not** multiply the velocity you
  hand them by `delta` again.

## Resources & data — `.tres` / `.tscn` are strict text formats

`.tscn` and `.tres` are line-oriented text with a strict header/section grammar. **Do not hand-edit
them past trivial value tweaks, and never launch on a file you hand-authored without validating** —
one bad `ext_resource` id, `[node]` line, or `load_steps` count corrupts the whole scene and Godot
refuses to open it. Prefer editing through the editor or building Resources in code and `ResourceSaver.save()`.

- **`preload("res://x.tscn")`** resolves at **parse/compile** time — the dependency is baked in; use
  for assets you always need.
- **`load("res://x.tscn")`** resolves at **runtime** — use for dynamic/optional paths (and to avoid
  circular preloads). Both return a `PackedScene`; call `.instantiate()` to get a node.

## 2D / 3D bodies quickstart

The move-anything-controllable body is `CharacterBody2D` / `CharacterBody3D`. The Godot 4 flow is:
**write the `velocity` property, then call `move_and_slide()` with no arguments.**

```gdscript
extends CharacterBody2D
@export var speed: float = 300.0
@export var jump_velocity: float = -400.0

func _physics_process(delta: float) -> void:
    if not is_on_floor():
        velocity += get_gravity() * delta        # get_gravity(): project-configured vector
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = jump_velocity
    var dir := Input.get_axis("move_left", "move_right")
    velocity.x = dir * speed
    move_and_slide()                             # NO args in Godot 4 — reads the velocity property
```

3D is identical with `CharacterBody3D`, `Vector3`, and an X/Z input plane; body/area suffixes are
`3D`. Deeper body/physics tuning → `gamedev-physics`.

## Language parity — GDScript ↔ C#

Same engine, same nodes; C# uses PascalCase members, `partial` classes, and attributes. Signals
become C# `event`s (generated by source-gen). C# support requires the **.NET (Mono) build** of Godot.

```gdscript
# GDScript
extends Node
signal health_depleted
@export var speed: float = 300.0

func _ready() -> void:
    health_depleted.connect(_on_depleted)
    health_depleted.emit()

func _on_depleted() -> void:
    print("dead")
```
```csharp
// C# — same node, .NET build
using Godot;

public partial class Player : Node
{
    [Signal] public delegate void HealthDepletedEventHandler();
    [Export] public float Speed { get; set; } = 300.0f;

    public override void _Ready()
    {
        base._Ready();                       // chain the parent (== super())
        HealthDepleted += OnDepleted;        // connect via the generated event
        EmitSignal(SignalName.HealthDepleted);
    }

    private void OnDepleted() => GD.Print("dead");
}
```

`move_and_slide()`→`MoveAndSlide()`, `$Node`→`GetNode<T>("Node")`, `%Node`→`GetNode<T>("%Node")`,
`preload`→`GD.Load<T>(...)`. Full parity table → `references/export-and-testing.md`.

**GDExtension / C++**: for hot native code, build a `godot-cpp` GDExtension (`.gdextension` file,
`GDREGISTER_CLASS`, `_bind_methods()`) rather than a Godot module — no engine recompile, and it loads
like any other library. That is native-tooling territory → pair with `cpp`.

## Export & testing

- **Test with GUT 9.x** (GDScript, `extends GutTest`) or **gdUnit4** (GDScript + C#). Put tests
  under `test/` or `res://tests/`; assert behavior, not private state.
- **Run headless in CI**: `godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://test -gexit`
  (GUT). Export via templates: `godot --headless --export-release "Linux/X11" build/game.x86_64`.
- Validate a project before shipping: open in the editor once (catches broken `.tscn`/`.tres`),
  then export-check per platform. Details → `references/export-and-testing.md`.

## Hand off to

Mechanics, loops, and feel *before* you script them → [`game-design`](../game-design/SKILL.md).
`.gdshader` / visual shaders → [`gamedev-shaders`](../gamedev-shaders/SKILL.md). Joints, RigidBody
tuning, deep collision layers → [`gamedev-physics`](../gamedev-physics/SKILL.md). NavigationAgent,
A*, steering → [`gamedev-pathing`](../gamedev-pathing/SKILL.md). `MultiplayerSynchronizer`/RPC/netcode
→ [`gamedev-multiplayer`](../gamedev-multiplayer/SKILL.md). Store builds, signing, platform export at
scale → [`gamedev-shipping`](../gamedev-shipping/SKILL.md). The GDExtension / `godot-cpp` native side
and its CMake/build tooling → [`cpp`](../cpp/SKILL.md).
