# Nodes, scenes, scripts & custom Resources (Godot 4.x)

The four building blocks and when each is the right tool. Getting this decomposition right is what
separates a maintainable Godot project from a monolithic scene that nobody can touch.

## The mental model

- **Node** — a live object in the running tree. It has a transform (2D/3D), can render, process,
  collide, receive input. Everything on screen is a node. Pick the most specific typed subclass
  (`Sprite2D`, `Area3D`, `CharacterBody2D`, `Timer`, `AudioStreamPlayer`).
- **Scene** (`.tscn`) — a saved tree of nodes with a designated **root**, instanceable N times. The
  reusable unit of a Godot game. A scene can instance other scenes (composition).
- **Script** (`.gd` / `.cs`) — code attached to one node, giving it behavior. Attach to the scene
  root; treat children as parts the root drives.
- **Resource** (`.tres` / `.res`) — a reference-counted **data** object, not in the tree. Textures,
  audio, materials are Resources; so are your **custom** data classes.

## Composition over inheritance / deep trees

Prefer assembling small scenes over one giant tree or a deep script inheritance chain.

- A `Player` scene = `CharacterBody2D` root + `Sprite2D` + `CollisionShape2D` + `Camera2D` +
  instanced `HealthComponent` + `HurtboxComponent` sub-scenes.
- Behaviors as **components**: a `HealthComponent` (its own scene/script exposing `signal died`) can
  be dropped onto a player, an enemy, or a crate — no shared base class needed.
- Reach for `extends MyBase` only for genuine "is-a" specialization; reach for composed child nodes
  for "has-a" behavior. The latter is the Godot-idiomatic default.

## `class_name` — when to register a global type

```gdscript
class_name HealthComponent extends Node
signal died
@export var max_health := 100
var _current := max_health
```

- Register (`class_name`) reusable scripts and **all** custom Resources — it enables `is`/`as`
  checks, `HealthComponent.new()`, and a proper inspector type/slot.
- Skip it for one-off scene-root scripts that nothing else references by type.
- Names are global and must be unique across the project.

## Custom Resources — typed game data

Use a custom `Resource` instead of loose `Dictionary`/JSON whenever you have structured game data:
stats, items, dialogue lines, wave definitions, ability configs. You get inspector editing, type
safety, `@export` slots, and save/load for free.

```gdscript
# item.gd
class_name Item extends Resource
@export var display_name: String = ""
@export var icon: Texture2D
@export var max_stack: int = 99
@export var value: int = 0
```
```gdscript
# Use it as a typed @export slot on any node:
@export var starting_items: Array[Item] = []

# Create/save/load in code:
var potion := Item.new()
potion.display_name = "Potion"
ResourceSaver.save(potion, "res://data/potion.tres")
var loaded := load("res://data/potion.tres") as Item
```

**Gotcha — shared vs unique**: a Resource assigned in the inspector is **shared by reference** across
all instances by default. If each node must own its copy (e.g. runtime-mutated stats), enable
**Local to Scene** on the resource, or `duplicate()` it in `_ready()`. Otherwise mutating one
enemy's `stats.health` mutates every enemy sharing that `.tres`.

## `preload` vs `load`

| | `preload("res://x")` | `load("res://x")` |
| --- | --- | --- |
| Resolved | parse/compile time | runtime, when the line runs |
| Path | must be a constant literal | can be a variable/computed |
| Use for | assets you always need; breaks fast if the path is wrong | dynamic/optional assets, avoiding circular preloads |
| Returns | the Resource/`PackedScene` | same |

```gdscript
const BULLET := preload("res://bullet.tscn")   # PackedScene, baked in
func shoot() -> void:
    var b := BULLET.instantiate()               # -> a Node
    add_child(b)

# runtime path
var scene := load("res://enemies/%s.tscn" % enemy_id) as PackedScene
```

## Instancing & freeing lifecycle

- `PackedScene.instantiate()` → a detached node; add it with `add_child(node)` (or
  `add_sibling`) to bring it into the tree and trigger `_ready`.
- Free with `queue_free()` (deferred to end of frame — safe during signals/physics). Avoid `free()`
  unless you know the node is out of the tree and not mid-callback.
- After freeing, guard any retained reference with `is_instance_valid(node)` before touching it.
- `add_child(node, true)` forces a readable unique name; useful when spawning many of one scene.

## `.tscn` / `.tres` are strict text — validation rule

Both formats are line-oriented with a header (`[gd_scene load_steps=N format=3 ...]`),
`[ext_resource ...]` / `[sub_resource ...]` blocks, and `[node ...]` / property lines. A wrong
`load_steps` count, a dangling `ExtResource("x")` id, or a malformed `[node]` path makes Godot
refuse to open the file. **Do not machine-generate or hand-edit these beyond trivial value tweaks,
and always open the project in the editor once before relying on a changed scene** — the editor is
the only reliable validator. Build data-Resources in code + `ResourceSaver.save()` instead of
writing `.tres` by hand.
