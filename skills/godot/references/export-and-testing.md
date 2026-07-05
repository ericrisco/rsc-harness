# Export, testing & GDScript↔C# parity (Godot 4.x)

## GDScript ↔ C# full parity table

C# needs the **.NET (Mono) build** of Godot 4. Members are PascalCase; scripts are `partial` classes
extending the node type; annotations become attributes; signals become source-generated `event`s.

| Concept | GDScript | C# |
| --- | --- | --- |
| Class decl | `extends Node2D` (+ `class_name Foo`) | `public partial class Foo : Node2D` |
| Ready | `func _ready():` | `public override void _Ready()` |
| Physics | `func _physics_process(delta):` (`delta: float`) | `public override void _PhysicsProcess(double delta)` |
| Chain parent | `super()` / `super._ready()` | `base._Ready()` |
| Export | `@export var speed := 300.0` | `[Export] public float Speed { get; set; } = 300f;` |
| Export range | `@export_range(0,1) var v := 0.5` | `[Export(PropertyHint.Range, "0,1")] public float V { get; set; }` |
| Signal decl | `signal hit(dmg: int)` | `[Signal] public delegate void HitEventHandler(int dmg);` |
| Emit | `hit.emit(10)` | `EmitSignal(SignalName.Hit, 10)` |
| Connect | `node.hit.connect(_on_hit)` | `node.Hit += OnHit;` |
| Disconnect | `node.hit.disconnect(_on_hit)` | `node.Hit -= OnHit;` |
| Child (direct) | `$Sprite2D` | `GetNode<Sprite2D>("Sprite2D")` |
| Child (unique) | `%HealthBar` | `GetNode<ProgressBar>("%HealthBar")` |
| onready | `@onready var s := $Sprite2D` | assign in `_Ready()` |
| Preload | `const B := preload("res://b.tscn")` | `GD.Load<PackedScene>("res://b.tscn")` |
| Instance | `B.instantiate()` | `b.Instantiate<Node2D>()` |
| Free | `queue_free()` | `QueueFree()` |
| Print | `print(x)` | `GD.Print(x)` |
| Move | set `velocity` → `move_and_slide()` | set `Velocity` → `MoveAndSlide()` |
| Await signal | `await obj.sig` | `await ToSignal(obj, Node.SignalName.Sig)` |
| Await frame | `await get_tree().process_frame` | `await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame)` |
| Group | `add_to_group("enemies")` | `AddToGroup("enemies")` |
| Random | `randf_range(0,1)` | `GD.RandRange(0,1)` |

C# gotchas: use the generated `SignalName`/`PropertyName`/`MethodName` string caches, not raw
strings; C# `Vector2`/`Vector3` fields can't be mutated through a property getter (copy → mutate →
assign back, like `var v = Velocity; v.X = 1; Velocity = v;`); `[Export]` needs a public
property or field of a Godot-marshalable type.

## GDExtension / C++ (native code)

For CPU-hot systems (procedural gen, heavy sims), write a **GDExtension** with `godot-cpp` instead of
recompiling the engine as a module:

- A `.gdextension` manifest points at the compiled shared lib per platform.
- Classes extend a Godot type and register with `GDREGISTER_CLASS(MyClass)`; expose methods/props via
  `static void _bind_methods()` using `ClassDB::bind_method(...)` and `ADD_PROPERTY(...)`.
- Build with SCons or CMake against the `godot-cpp` bindings; it loads like any resource, no engine
  rebuild. This is native C++ tooling → pair with the `cpp` skill for the build side.

## Testing

Two mature frameworks for Godot 4:

- **GUT 9.x** (Godot Unit Test) — GDScript. Test scripts `extends GutTest`; methods named
  `test_*`; assertions like `assert_eq`, `assert_true`, `assert_signal_emitted`. Install via the
  Asset Library or a git submodule under `addons/gut`.
- **gdUnit4** — GDScript **and** C#, with scene-runner helpers for driving input and awaiting frames;
  ships CI templates and a fluent `assert_that(...)` API.

```gdscript
# test/test_health.gd
extends GutTest

func test_takes_damage() -> void:
    var h := HealthComponent.new()
    h.max_health = 100
    watch_signals(h)
    h.take_damage(30)
    assert_eq(h.current, 70)

func test_emits_died_at_zero() -> void:
    var h := HealthComponent.new()
    watch_signals(h)
    h.take_damage(999)
    assert_signal_emitted(h, "died")
```

Test **behavior through the public surface** (signals, exported state, method results), not private
`_underscore` fields. For node-tree tests, `add_child_autofree(node)` so GUT frees it.

## Headless CI & export

Godot runs without a display via `--headless` — the backbone of CI:

```bash
# Run the GUT suite headless and exit with the pass/fail code
godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://test -ginclude_subdirs -gexit

# gdUnit4 headless
godot --headless -s res://addons/gdUnit4/bin/GdUnitCmdTool.gd -a res://test

# Import/validate assets once (populates .godot/, catches broken resources) — good first CI step
godot --headless --import

# Export a release build for a preset defined in export_presets.cfg
godot --headless --export-release "Linux/X11" build/game.x86_64
godot --headless --export-release "Web" build/index.html
```

- Export **templates** for the matching engine version must be installed on the CI runner.
- Run `--import` before `--export-*` on a clean checkout so `.godot/` is built.
- A green editor open + a passing headless suite + a successful export per target = shippable; deep
  store/signing/platform work belongs to `gamedev-shipping`.
