# Godot 3 → 4.x migration ban-list (full table)

Godot 4 is a hard break from 3.x. The engine ships a project converter, but it does **not** catch
everything — and an agent generating fresh code must simply never emit the left column. Use this as
the authoritative reference when porting or reviewing.

## Won't-parse renames (hard errors)

| Godot 3 | Godot 4.x | Note |
| --- | --- | --- |
| `yield(obj, "signal")` | `await obj.signal` | Coroutines are now `await`; the function must not need `yield`'s return-value trick. |
| `yield(get_tree().create_timer(1),"timeout")` | `await get_tree().create_timer(1.0).timeout` | |
| `onready var` | `@onready var` | Annotation. |
| `export var` / `export(int) var` | `@export var` / `@export_range(...) var` | Typed annotations replace the `export(Type)` hint syntax. |
| `tool` | `@tool` | Must be the first line. |
| `remote`/`master`/`puppet func` | `@rpc(...)` annotations | Networking model changed entirely. |
| `setget set_fn, get_fn` | `set(v): ...` / `get: ...` inline accessors | |

## Node / class renames

| Godot 3 | Godot 4.x |
| --- | --- |
| `Spatial` | `Node3D` |
| `KinematicBody` / `KinematicBody2D` | `CharacterBody3D` / `CharacterBody2D` |
| `Area` | `Area3D` |
| `RigidBody` / `StaticBody` | `RigidBody3D` / `StaticBody3D` |
| `Sprite` | `Sprite2D` |
| `Sprite3D` | `Sprite3D` (unchanged) |
| `AnimatedSprite` | `AnimatedSprite2D` |
| `CollisionShape` | `CollisionShape3D` |
| `Camera` | `Camera3D` |
| `Light2D` (old) / `Light` | `PointLight2D` / `DirectionalLight2D` / `OmniLight3D` etc. |
| `Viewport` (as node) | `SubViewport` (embedded) |
| `YSort` (node) | `y_sort_enabled` property on `Node2D`/`CanvasItem` |
| `ARVROrigin` / `ARVRCamera` | `XROrigin3D` / `XRCamera3D` |
| `Reference` | `RefCounted` |
| `TileMap` | `TileMapLayer` (one per layer; `TileMap` deprecated 4.3+) |

## Method / API changes

| Godot 3 | Godot 4.x |
| --- | --- |
| `scene.instance()` | `scene.instantiate()` |
| `move_and_slide(velocity, up_direction)` | set `velocity` property → `move_and_slide()` (no args) |
| `move_and_slide_with_snap(...)` | set `floor_snap_length` → `move_and_slide()` |
| `connect("sig", obj, "method", [args])` | `obj.sig.connect(method.bind(args))` (Callable) |
| `disconnect("sig", obj, "method")` | `obj.sig.disconnect(method)` |
| `emit_signal("sig", a)` | `sig.emit(a)` (string form still exists but prefer the property) |
| `is_connected("sig", obj, "m")` | `sig.is_connected(m)` |
| `call_deferred("method", a)` | `method.bind(a).call_deferred()` or `call_deferred("method", a)` |
| `File.new()` + `open()` | `FileAccess.open(path, FileAccess.READ)` |
| `Directory.new()` | `DirAccess.open(path)` / `DirAccess.dir_exists_absolute(...)` |
| `OS.get_ticks_msec()` | `Time.get_ticks_msec()` |
| `OS.get_datetime()` | `Time.get_datetime_dict_from_system()` |
| `PoolByteArray` / `PoolStringArray` / `PoolVector2Array` | `PackedByteArray` / `PackedStringArray` / `PackedVector2Array` |
| `Tween` node + `interpolate_property` | `var t := create_tween(); t.tween_property(node, "position", target, 0.5)` |
| `rand_range(a, b)` | `randf_range(a, b)` (float) / `randi_range(a, b)` (int) |
| `deg2rad` / `rad2deg` | `deg_to_rad` / `rad_to_deg` |
| `stepify(x, s)` | `snapped(x, s)` |
| `.empty()` | `.is_empty()` |
| `get_node("Path")` still valid | prefer `%UniqueName` for refactor-safety |
| `KEY_*` / input constants mostly renamed | check `Key`, `MouseButton` enums |

## Silent behavior changes (compile clean, act wrong)

- **`Array.slice(begin, end, step, deep)`** — `end` is **exclusive** in Godot 4 (was inclusive in 3).
  `[10,20,30,40].slice(1,3)` → `[20,30]`.
- **`Camera2D.zoom`** — meaning **inverted**. Larger value = zoom **in**. `zoom = Vector2(2,2)`
  magnifies 2×; in Godot 3 that zoomed out. To zoom out now, use values **below** 1.
- **Y-sort** is a property (`y_sort_enabled`), not a node — porting a `YSort` parent silently loses
  sorting unless you set the property.
- **Physics interpolation / gravity** — read gravity via `get_gravity()` (2D/3D) or
  `ProjectSettings`; the old default constants changed.
- **Signal argument order** on some built-in signals changed; verify against the 4.x docs, don't
  assume the 3.x signature.
- **`_ready`/`_process` no longer auto-call the base** — you must `super()` when extending a script
  that defines them.
- **Integer division** with typed ints truncates as expected; mixing float/int in Godot 4 follows
  stricter typed rules — annotate to avoid surprises.

## Porting workflow

1. Open the Godot 3 project in Godot 4 → run the built-in **Project Converter** (backs up first).
2. Fix red parse errors top-down (renames above).
3. Search the codebase for each string-form `connect(`, `yield(`, `.instance()`, `File.new`,
   `Directory.new`, `Pool*Array`, `move_and_slide(` with args — the converter misses some.
4. Fix the silent-breakers deliberately (slice bounds, Camera2D zoom, y-sort) — tests or a manual
   pass, since nothing errors.
5. Re-open every scene once; a converter-mangled `.tscn` fails loudly in the editor.
