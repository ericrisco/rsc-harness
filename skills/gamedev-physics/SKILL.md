---
name: gamedev-physics
description: "Use when working with a game engine's physics — rigid bodies, colliders, collision layers/masks, character controllers, joints, forces vs impulses, raycasts/shapecasts, or when physics is unstable. Triggers: \"my character falls through the floor\", \"bullet tunnels through walls at high speed\", \"rigidbody jitters / vibrates / explodes\", \"objects that should collide pass through each other\", \"which collision layer and mask do I set\", \"kinematic vs dynamic body\", \"move_and_slide / CharacterBody\", \"AddForce vs impulse vs setting velocity\", \"physics in FixedUpdate or _physics_process\", \"slope and step detection\", \"trigger / Area overlap not firing\", Godot RigidBody/StaticBody/CharacterBody/Area, Unity Rigidbody/Collider/CharacterController, Unreal Chaos/collision presets. NOT rendering, materials, or visual jitter from shaders (use gamedev-shaders); NOT AI navigation, pathfinding, or navmesh (use gamedev-pathing)."
tags: [physics, collision, rigidbody, character-controller, colliders]
recommends: [godot, unity, unreal, gamedev-pathing]
profiles: [full]
origin: risco
---

# Game physics & collision

Make bodies collide, move, and stay stable across Godot, Unity, and Unreal. This skill owns the
mental model (body types, colliders, layers/masks, character controllers, joints, queries,
determinism) and maps every concept onto each engine's real API. When physics "feels broken" —
jitter, tunneling, sinking, ghost collisions — the cause is almost always one of: wrong body type,
a layer/mask mismatch, or moving/integrating outside the fixed physics tick. Check those first.

## Version contract — read first (never emit these)

| Engine | Target | Banned / deprecated | Use instead |
| --- | --- | --- | --- |
| **Godot** | 4.x | `move_and_slide(velocity, up, ...)` with arguments (that is Godot 3) | Godot 4 `move_and_slide()` takes **no args**; set the `velocity` property first |
| Godot | 4.x | `KinematicBody2D/3D`, `RayShape`, `WorldMarginShape`, `linear_velocity *= delta` before `move_and_slide()` | `CharacterBody2D/3D`, `SeparationRayShape2D/3D`, `WorldBoundaryShape2D/3D`; `move_and_slide()` is already delta-scaled |
| **Unity** | Unity 6 (6000.x) | `Rigidbody.velocity` / `Rigidbody2D.velocity`, `rb.drag`, `rb.angularDrag` | `linearVelocity` (+ `linearVelocityX/Y`), `linearDamping`, `angularDamping`; new `AddForceX/Y` |
| Unity | Unity 6 | moving a dynamic `Rigidbody` from `Update`; `transform.position =` on a physics body | move in `FixedUpdate`; use `MovePosition`/`AddForce`, never write `transform` on a simulated body |
| **Unreal** | UE5 (Chaos) | any PhysX/APEX API, `bUseAsyncScene`, `NvCloth` | Chaos is the only physics backend in UE5; use `UPrimitiveComponent` physics + `PhysicsConstraintComponent` |

If you are unsure a symbol exists in the user's exact version, say so instead of inventing it.

## When to use / When NOT to use

**Use when:** designing which body type a thing should be; something falls through, sinks into, or
passes through geometry; a rigid body jitters, drifts, or launches; setting up collision
layers/masks/channels; building or fixing a character/player controller; adding joints; casting
rays/shapes or overlap tests; or physics behaves differently at different frame rates.

**When NOT to use (delegate):**
- Visual-only wobble, shader/vertex animation, material or lighting issues → **gamedev-shaders**.
- AI moving along a path, navmesh, A*, steering, avoidance → **gamedev-pathing** (physics only
  *executes* the move; pathing decides *where*).
- Deep, engine-specific project setup / editor / build questions → **godot**, **unity**, **unreal**.
- Netcode, lockstep sync, server-authoritative movement → **gamedev-multiplayer** (this skill gives
  you the *deterministic fixed-tick* foundation multiplayer builds on).

## 1. Body types — pick before you touch anything

Three categories exist in every engine; choosing wrong is the root of most bugs.

- **Static** — never moves, infinite mass, cheap. Level geometry, walls, floors. Do **not** move a
  static body every frame; the broadphase caches it. If it must move, it is not static.
- **Kinematic / character** — moved *by you* (code/animation), pushes dynamics but is not pushed by
  them, ignores forces and gravity unless you add them. Players, moving platforms, doors, elevators.
- **Dynamic (rigid)** — fully simulated: gravity, forces, impulses, collision response. Crates,
  ragdolls, debris, vehicles. You influence it with forces/impulses, never by writing its transform.

**Move each the right way:**

| | Static | Kinematic / character | Dynamic |
| --- | --- | --- | --- |
| Godot | `StaticBody2D/3D` (leave still) | `CharacterBody2D/3D` + `move_and_slide()`; `AnimatableBody2D/3D` for platforms (set `sync_to_physics`) | `RigidBody2D/3D` (`apply_impulse`, `apply_force`) |
| Unity | Collider, no Rigidbody (or `Rigidbody2D` bodyType Static) | `CharacterController.Move()`, or `Rigidbody.isKinematic=true` + `MovePosition` in `FixedUpdate` | `Rigidbody` (`AddForce`) |
| Unreal | `Static`/`Movable` mobility, Simulate Physics off | `Character` + `CharacterMovementComponent`; movable component moved by code | Simulate Physics on (`SetSimulatePhysics(true)`) |

A Godot `RigidBody` can be temporarily frozen: set `freeze = true` with `freeze_mode =
FREEZE_MODE_KINEMATIC` to move it by transform without waking the solver wrongly. Prefer
`AnimatableBody` for a permanent kinematic mover.

## 2. Colliders / shapes

Collider ≠ visual mesh. Give every body a **separate, simpler** collision shape.

- **Primitives** (box, sphere/circle, capsule) — cheapest and most stable. Prefer a **capsule** for
  characters (rounded ends slide over steps and seams). Use these whenever possible.
- **Convex hull** — dynamic bodies can use a convex approximation; a concave prop needs **multiple
  convex pieces** (a compound), not one concave hull.
- **Concave / trimesh** — exact triangle mesh, but **static-only** in every engine. A moving
  concave-mesh collider is a top cause of tunneling and solver blowups. Never put a trimesh on a
  dynamic body.
- **Compound** — several child shapes on one body. Godot: multiple `CollisionShape` children. Unity:
  multiple `Collider` components. Unreal: multiple primitives / a body setup.
- **Triggers / areas** — detect overlap, **no physical response**. Godot `Area2D/3D` (signals
  `body_entered` / `area_entered`); Unity collider `Is Trigger` (`OnTriggerEnter/Stay/Exit`); Unreal
  set response to **Overlap** + `Generate Overlap Events` (`OnComponentBeginOverlap`). Use for
  pickups, damage zones, checkpoints, sensors.

## 3. Collision layers & masks — the #1 confusion

**Layer = "what I am." Mask = "what I scan for."** They are separate bit sets.

- **Godot:** two bodies interact when **one's `collision_mask` includes the other's
  `collision_layer`** — it is an **OR**, so detection can be asymmetric (A sees B without B seeing
  A). Keep them symmetric unless you deliberately want one-way detection. An `Area`'s `mask` decides
  what it detects; its `layer` decides what detects *it*.
- **Unity:** GameObject **Layers** + the **Layer Collision Matrix** (Project Settings → Physics)
  decide which layer pairs collide. Raycasts/overlaps take a `LayerMask` argument. Toggle a pair at
  runtime with `Physics.IgnoreLayerCollision`.
- **Unreal:** **Object Type** (channel) = what I am; per-channel **Response** = Block / Overlap /
  Ignore. Package as a reusable **Collision Preset**. Trace channels (Visibility, Camera) are for
  queries; object channels are for physical collision.

Full worked examples (player/enemy/pickup/wall, bit math, one-way platforms) →
`references/layers-and-masks.md`.

## 4. Character controllers

Two philosophies — decide up front, don't mix:

- **Kinematic character** (recommended for most players): you compute velocity and move via a
  sweeping helper that resolves collisions and slides. Precise, snappy, no solver fighting. Godot
  `CharacterBody`, Unity `CharacterController`, Unreal `CharacterMovementComponent`.
- **Dynamic (rigidbody) character**: physical pushing/being-pushed for free, but needs high friction
  or a physics material, angular constraints (freeze rotation), and tuning to stop tipping/sliding.

Godot 4 (2D — the 3D version is identical with `Vector3` and `get_gravity()`):

```gdscript
extends CharacterBody2D

const SPEED := 300.0
const JUMP_VELOCITY := -400.0

func _physics_process(delta: float) -> void:
    if not is_on_floor():
        velocity += get_gravity() * delta        # accumulate accel: scale by delta
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = JUMP_VELOCITY
    var dir := Input.get_axis("move_left", "move_right")
    velocity.x = dir * SPEED if dir else move_toward(velocity.x, 0.0, SPEED)
    move_and_slide()                              # Godot 4: NO args, uses `velocity`, already delta-scaled
```

`is_on_floor()` / `is_on_wall()`, `floor_max_angle` (slope limit), `floor_snap_length` (stick to
ground on ramps/stairs), and `up_direction` handle ground/slope/step behavior. `get_gravity()` is
Godot 4.3+; on older 4.x read `ProjectSettings` gravity. Full per-engine controllers (Unity
`CharacterController` + custom gravity, Unreal movement modes, ground detection, slopes, steps,
moving platforms) → `references/character-controllers.md`.

## 5. Joints/constraints & how to apply motion

**Joints** connect two bodies with a constraint. Godot: `PinJoint`, `HingeJoint3D`, `SliderJoint3D`,
`Generic6DOFJoint3D`, `DampedSpringJoint2D`. Unity: `HingeJoint`, `FixedJoint`, `SpringJoint`,
`ConfigurableJoint`, `CharacterJoint`. Unreal: `PhysicsConstraintComponent` (one 6-DOF constraint
covers hinge/slider/ball). Keep connected bodies' **mass ratios close** — a heavy body chained to a
light one is the classic joint-explosion.

**Force vs impulse vs direct velocity** (apply all in the fixed tick):

| Want | Use | Godot | Unity | Unreal |
| --- | --- | --- | --- | --- |
| Continuous push (thrust, wind), mass-scaled | **Force** | `apply_central_force` | `AddForce(f, Force)` | `AddForce` |
| Instant kick (jump, explosion, hit), mass-scaled | **Impulse** | `apply_central_impulse` | `AddForce(f, Impulse)` | `AddImpulse` |
| Instant velocity change, **ignoring mass** | mass-independent impulse | set `linear_velocity` | `AddForce(f, VelocityChange)` | `SetPhysicsLinearVelocity` |

Setting velocity directly on a *dynamic* body teleports its momentum and can fight the solver — fine
for character/kinematic bodies, use sparingly on dynamics (prefer forces/impulses).

## 6. Queries — raycasts, shapecasts, overlaps

Run queries from the **fixed physics tick** so results match the simulated state.

- **Godot:** get `get_world_2d().direct_space_state` (or 3d), build
  `PhysicsRayQueryParameters2D/3D` / `PhysicsShapeQueryParameters2D/3D`, call `intersect_ray`,
  `intersect_shape`, `cast_motion`. Node helpers: `RayCast2D/3D`, `ShapeCast2D/3D`. Queries respect
  `collision_mask`.
- **Unity:** `Physics.Raycast`, `SphereCast`/`CapsuleCast`, `OverlapSphere`, `CheckSphere` (2D:
  `Physics2D.*`). Always pass a `LayerMask`; prefer non-allocating `RaycastNonAlloc`/`RaycastAll`.
- **Unreal:** `LineTraceSingleByChannel`, `SweepSingleByChannel`, `OverlapMultiByChannel` (and
  `...ByObjectType`). Use a **trace channel**, set the query params (`bTraceComplex`).

Details, snippets, and the tunneling-safe shapecast pattern → `references/determinism-and-queries.md`.

## 7. Determinism & stability

The rules that keep physics from jittering, drifting, or tunneling:

1. **Physics lives in the fixed tick.** Godot `_physics_process(delta)`, Unity `FixedUpdate()`,
   Unreal substepping / async physics tick. Read input in the frame update, *apply* it in the fixed
   tick. Never simulate in the render frame.
2. **Scale by delta.** Multiply forces/accelerations/manual position changes by the tick's `delta` /
   `fixedDeltaTime` — but **not** the output of a helper that already integrates time (Godot
   `move_and_slide()`, Unity `CharacterController.Move` when you pass a per-second velocity).
3. **CCD for fast/thin things.** Small fast projectiles + thin walls tunnel. Enable Continuous
   Collision Detection: Godot `continuous_cd`, Unity `collisionDetectionMode = Continuous*`, Unreal
   `Use CCD`. Enable only on the fast bodies (it costs). Or use a shapecast/raycast-then-move.
4. **Keep mass ratios sane.** Stacks and joints between wildly different masses (100:1+) blow up.
5. **Never scale a collider at runtime**, and never write `transform`/`position` on a dynamic body —
   both corrupt the broadphase and cause explosions or ghost collisions. Move via the API.
6. **Interpolate for smooth visuals** at high frame rates: Godot physics interpolation, Unity
   `Rigidbody.interpolation = Interpolate`. This is visual only — it never changes the simulation.

Deeper: fixed-timestep math, substepping, sleeping, why `transform` writes break things →
`references/determinism-and-queries.md`.

## Guardrails / gotchas

- Falling through a thin floor at speed → CCD off, or moving in the render frame. Fix both.
- A moving platform doesn't carry the player → use a kinematic mover (Godot `AnimatableBody` with
  `sync_to_physics`, Unity kinematic Rigidbody `MovePosition`), not a static body.
- "Ghost" collisions / catching on seams between tiles → merge colliders or use a capsule character.
- Trigger never fires → in Unity a trigger pair needs at least one **Rigidbody**; in Godot the
  Area's `mask` must include the body's `layer`; in Unreal enable Generate Overlap Events on **both**.
- Rigidbody vibrates against the ground → mass ratio, too-soft solver iterations, or you're also
  writing its transform. Stop writing the transform.
- Character launches off ramps → enable floor snapping (`floor_snap_length` / stop-on-slope).

## Related skills

- **godot** / **unity** / **unreal** — engine setup, editor, language, and build specifics.
- **gamedev-pathing** — decides *where* to move; this skill *executes* the move and collisions.
- **gamedev-multiplayer** — builds on the deterministic fixed-tick foundation here.
- **gamedev-shaders** — for visual/material issues that only look like physics.

## Checklist

- [ ] Every moving thing has the right **body type** (static / kinematic / dynamic).
- [ ] Colliders are **primitives/capsules**; no trimesh on a dynamic body; compound = many convex.
- [ ] Layers/masks (or channels/presets) set so exactly the intended pairs collide; triggers use
      overlap/Area, not solid response.
- [ ] All physics motion and queries run in the **fixed tick**; deltas scaled correctly (helper
      output not double-scaled).
- [ ] Forces/impulses/velocity chosen deliberately; no `transform`/`position` writes on dynamics; no
      runtime collider scaling.
- [ ] Fast/thin bodies have **CCD**; character has floor/slope/step handling; mass ratios are sane.
- [ ] Correct API for the stated engine **version** (Godot 4 `move_and_slide()` no args; Unity 6
      `linearVelocity`; UE5 Chaos — no PhysX).
