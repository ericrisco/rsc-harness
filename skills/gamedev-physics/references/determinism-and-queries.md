# Determinism, stability & queries

Most "my physics is unstable" reports reduce to running simulation in the wrong loop, scaling by the
wrong delta, or tunneling. This is the fix list plus the query APIs.

## The fixed timestep — where physics must live

Engines separate the **render frame** (variable rate, once per drawn image) from the **physics tick**
(fixed rate, e.g. 60 Hz). The solver assumes a constant `dt`; feeding it a variable frame time makes
behavior frame-rate-dependent — the same jump reaches different heights at 30 vs 144 fps.

| Engine | Fixed-tick callback | Rate setting |
| --- | --- | --- |
| Godot 4 | `_physics_process(delta)` | `Engine.physics_ticks_per_second` / Project Settings → Physics → Physics Ticks per Second (default 60) |
| Unity 6 | `FixedUpdate()` | `Time.fixedDeltaTime` / Project Settings → Time → Fixed Timestep |
| Unreal | Chaos **substepping** / Async Physics Tick | Project Settings → Physics → Substepping (`Max Substep Delta Time`, `Max Substeps`) |

**Pattern:** poll input in the frame update (`_process` / `Update` / `Tick`), cache intent, then
*apply* forces/velocity and run physics queries in the fixed tick. Never move a physics body or read
physics state from the render frame.

In Unreal, enabling **Substepping** lets the solver take several fixed sub-steps within a long frame,
keeping constraints stable at low fps; for hard determinism use the Chaos async physics tick, which
runs your callback at a fixed rate off the game thread.

## Scale by delta — but not twice

- Manual position changes, accelerations, and continuous forces you integrate yourself: multiply by
  the tick delta (`delta` / `fixedDeltaTime`).
- Helpers that already integrate time: do **not** delta-scale their input. Godot `move_and_slide()`
  takes a per-second `velocity` and applies the timestep internally. Unity `CharacterController.Move`
  expects a per-*frame* displacement, so you pass `velocity * Time.deltaTime` (velocity is per
  second) — the classic mistake is forgetting the delta there while double-applying it elsewhere.
- Gravity done by hand: `velocity += gravity * delta` each tick (gravity is an acceleration).

## Interpolation — smooth visuals without touching the sim

At frame rates above the tick rate, rendering the raw physics position looks choppy. Turn on
interpolation to render an in-between pose; it is **purely visual** and never alters the simulation.

- Godot 4: physics interpolation (Project Settings → Physics → Common → Physics Interpolation, plus
  per-node where applicable).
- Unity: `Rigidbody.interpolation = RigidbodyInterpolation.Interpolate` (or `Extrapolate`).
- Unreal: interpolation handled by the movement/render sync; async physics results are interpolated.

## Tunneling & CCD

A fast body moving more than its own thickness per tick can pass fully through a thin collider before
any overlap is tested (discrete collision). Fixes, cheapest first:

1. Make the wall/collider thicker than the fastest per-tick travel, or the projectile bigger.
2. Enable **Continuous Collision Detection** on the *fast* body only (it is expensive):
   - Godot: `continuous_cd` (RigidBody2D: Disabled / Cast Ray / Cast Shape; RigidBody3D: on/off).
   - Unity: `Rigidbody.collisionDetectionMode = Continuous` / `ContinuousDynamic` /
     `ContinuousSpeculative`.
   - Unreal: **Use CCD** on the body instance.
3. For bullets, prefer a **raycast/shapecast-then-move**: sweep from last position to next, and if it
   hits, resolve at the hit point. This is more reliable than CCD for very small, very fast objects.

## Other stability rules

- **Mass ratios:** keep interacting/jointed bodies within ~10:1 (100:1 blows up). Very light bodies
  under very heavy ones jitter or get ejected.
- **Never scale a collider at runtime.** Scaling the transform of a body with a collider (especially
  non-uniform scale) corrupts the shape and broadphase — swap the shape or size the shape resource
  instead.
- **Never write `transform`/`position`/`rotation` on a dynamic (simulated) body.** It teleports past
  the solver, producing explosions, missed contacts, and ghost collisions. Move dynamics with
  forces/impulses/velocity; move kinematics with the provided API (`MovePosition`,
  `move_and_slide`, `SetWorldLocation` with sweep).
- **Sleeping:** resting bodies sleep to save CPU and stop micro-jitter. Applying a force or a query
  may need to wake them (`RigidBody.sleeping = false`, `Rigidbody.WakeUp()`); don't fight the sleep
  system with tiny constant forces.
- **Solver iterations:** if stacks/joints sag or jitter, raise solver iteration counts (Project/
  physics settings) before hacking masses.

## Queries — raycast, shapecast, overlap

Run queries in the fixed tick so they see the simulated state, and filter by layer/mask/channel.

**Godot 4** — via the space state (works in `_physics_process`):

```gdscript
var space := get_world_3d().direct_space_state
var q := PhysicsRayQueryParameters3D.create(from, to)
q.collision_mask = 0b0001                    # only scan layer 1
q.exclude = [self]                           # ignore ourselves
var hit := space.intersect_ray(q)            # {} if nothing; else position, normal, collider, ...
```

Shape sweep: `PhysicsShapeQueryParameters3D` + `intersect_shape` (overlap) or `cast_motion` (how far
a shape can move before hitting). Node helpers `RayCast2D/3D` and `ShapeCast2D/3D` update every tick.

**Unity 6:**

```csharp
int mask = LayerMask.GetMask("Ground");
if (Physics.Raycast(origin, dir, out RaycastHit hit, dist, mask)) { /* hit.point, hit.normal */ }
if (Physics.SphereCast(origin, radius, dir, out RaycastHit sh, dist, mask)) { /* swept */ }
Collider[] hits = Physics.OverlapSphere(center, radius, mask);   // overlap test
bool blocked = Physics.CheckSphere(center, radius, mask);        // cheap boolean
```

Use `RaycastNonAlloc` / `OverlapSphereNonAlloc` in hot paths to avoid garbage. 2D equivalents live on
`Physics2D` (`Raycast`, `OverlapCircle`, `CircleCast`).

**Unreal (UE5):**

```cpp
FHitResult Hit;
FCollisionQueryParams Params(NAME_None, /*bTraceComplex=*/false, this);
bool bHit = GetWorld()->LineTraceSingleByChannel(
    Hit, Start, End, ECC_Visibility, Params);          // trace channel
GetWorld()->SweepSingleByChannel(                      // shapecast
    Hit, Start, End, FQuat::Identity, ECC_Pawn,
    FCollisionShape::MakeSphere(30.f), Params);
TArray<FOverlapResult> Overlaps;                       // overlap test
GetWorld()->OverlapMultiByChannel(
    Overlaps, Center, FQuat::Identity, ECC_WorldDynamic,
    FCollisionShape::MakeBox(FVector(50)), Params);
```

Use `...ByObjectType` variants to query by object channels, `...ByChannel` for trace channels. Set
`bTraceComplex = true` only when you need per-triangle precision (costly).
