# GDScript style & formatting cheat-sheet (Godot 4.x)

Mirrors the official GDScript style guide. When in doubt, run the editor's built-in formatter
(Ctrl/Cmd+Shift+I) and `gdformat` (from `gdtoolkit`) in CI.

## Naming

| Thing | Case | Example |
| --- | --- | --- |
| File (script/scene) | `snake_case` | `player_controller.gd`, `main_menu.tscn` |
| `class_name` / type | `PascalCase` | `class_name EnemyStats` |
| Node name in tree | `PascalCase` | `HealthBar`, `AttackTimer` |
| Variable / function | `snake_case` | `var max_health`, `func take_damage()` |
| Signal | `snake_case`, past tense | `signal health_depleted` |
| Constant | `CONSTANT_CASE` | `const MAX_SPEED := 400.0` |
| Enum type / members | `PascalCase` / `CONSTANT_CASE` | `enum State { IDLE, RUN }` |
| Private (convention) | leading underscore | `var _internal_timer` |
| Virtual/lifecycle | leading underscore | `_ready`, `_process`, `_on_body_entered` |

## Formatting

- **Tabs** for indentation (not spaces). Editor default.
- Lines **< 100 columns**.
- One space around binary operators (`a + b`, `x := 1`), none inside call parens.
- Two blank lines between functions at top level; one inside classes as needed.
- Prefer `:=` (inferred) when the RHS makes the type obvious; `: Type =` when it does not.

## Typed by default

```gdscript
var speed: float = 300.0          # explicit annotation
var dir := Vector2.ZERO           # inferred
var slots: Array[Item] = []       # typed collection
const GRAVITY := 980.0

func heal(amount: int) -> void:   # typed params AND return
    _health = mini(_health + amount, _max_health)

func find_target() -> Node2D:     # return type declared
    return get_tree().get_first_node_in_group("player")
```

- Declare `-> void` on functions that return nothing; declare the real type otherwise.
- Use `as` for safe downcasts: `var e := body as Enemy` → `null` on mismatch (no crash).
- Avoid untyped `var x` and `Variant` params — they disable the compiler's checks and the VM's
  typed fast paths.

## Script layout order (recommended top-to-bottom)

1. `@tool` (if any) — must be the very first line.
2. `class_name` then `extends` (or `extends` alone).
3. `## docstring` comment.
4. `signal` declarations.
5. `enum` / `const`.
6. `@export` vars, then plain member vars, then `@onready` vars.
7. Built-in virtuals: `_init`, `_ready`, `_process`, `_physics_process`, `_input`, …
8. Public methods, then private (`_underscore`) methods, then signal handlers (`_on_*`).

```gdscript
@tool
class_name Turret extends Node2D
## Auto-aiming turret; @export the fire rate in the inspector.

signal fired(at: Vector2)

const MAX_RANGE := 600.0
enum Mode { IDLE, TRACKING }

@export var fire_rate := 2.0
var _cooldown := 0.0
@onready var muzzle: Marker2D = %Muzzle

func _physics_process(delta: float) -> void:
    _cooldown = maxf(_cooldown - delta, 0.0)

func _on_area_entered(_area: Area2D) -> void:
    pass
```

## Common built-in math helpers (Godot 4 names)

`absf/absi`, `minf/mini`, `maxf/maxi`, `clampf/clampi`, `snappedf`, `lerpf`, `move_toward`,
`deg_to_rad` / `rad_to_deg`, `randf_range`, `randi_range`. The unsuffixed `abs/min/max/clamp` still
work on Variants but the typed suffixed forms are faster and clearer.
