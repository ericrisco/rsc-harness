# Character controllers — kinematic vs dynamic, per engine

A "character controller" is the code that turns intent (move left, jump) into collision-resolved
motion. Two approaches; pick one and commit.

## Kinematic vs dynamic — the trade

| | Kinematic character | Dynamic (rigidbody) character |
| --- | --- | --- |
| Motion | you set velocity, a sweep resolves it | forces/impulses, solver resolves it |
| Feel | precise, snappy, fully authored | physical, momentum-y, harder to make crisp |
| Pushed by physics | no (you handle it) | yes, for free |
| Pushes dynamics | yes | yes |
| Gravity | you add it manually | automatic |
| Typical use | platformers, shooters, most players | ragdoll-ish, vehicles, physics puzzles |
| Pain points | you re-implement gravity/slopes/steps | tipping, sliding, jitter — needs constraints + friction |

Default to **kinematic** for a controllable character. Reach for dynamic only when physical
interaction *is* the gameplay.

## Godot 4 — CharacterBody (kinematic)

`CharacterBody2D/3D` exposes a `velocity` property and `move_and_slide()`, which sweeps by
`velocity` (already delta-scaled) and slides along surfaces.

```gdscript
extends CharacterBody3D

const SPEED := 5.0
const JUMP_VELOCITY := 4.5

func _physics_process(delta: float) -> void:
    if not is_on_floor():
        velocity += get_gravity() * delta          # get_gravity() is 4.3+; else read ProjectSettings
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = JUMP_VELOCITY
    var input := Input.get_vector("left", "right", "up", "down")
    var dir := (transform.basis * Vector3(input.x, 0, input.y)).normalized()
    velocity.x = dir.x * SPEED
    velocity.z = dir.z * SPEED
    move_and_slide()
```

Tuning knobs on the node:
- `up_direction` — defines "up" for floor/wall/ceiling classification (default `Vector3.UP`).
- `floor_max_angle` — steepest slope treated as floor (radians; default 45°). Steeper = wall.
- `floor_snap_length` — pulls the body to the ground while descending ramps/stairs (kills
  launch-off-ramp and airborne-on-stairs). Requires `floor_stop_on_slope` behavior tuning.
- `is_on_floor()` / `is_on_wall()` / `is_on_ceiling()`, `get_floor_normal()`,
  `get_slide_collision_count()` + `get_slide_collision(i)` to inspect what was hit.
- `move_and_collide(motion)` — lower-level single sweep returning a `KinematicCollision`; use when
  you want full manual control (custom slide, wall-jump math).

For one-off exact motion (dashes, kinematic bodies not needing slide) use `move_and_collide`.

## Unity 6 — CharacterController (kinematic) and the dynamic alternative

`CharacterController` is a built-in kinematic capsule with sweeping `Move`. It handles steps and
slopes via `stepOffset` and `slopeLimit`; it does **not** apply gravity — you do.

```csharp
[RequireComponent(typeof(CharacterController))]
public class Player : MonoBehaviour {
    public float speed = 6f, jumpVelocity = 5f, gravity = -20f;
    CharacterController cc;
    Vector3 vel;               // world-space velocity we integrate ourselves

    void Awake() => cc = GetComponent<CharacterController>();

    void Update() {            // CharacterController is kinematic: Update is fine
        if (cc.isGrounded && vel.y < 0f) vel.y = -2f;               // keep grounded
        Vector3 wish = transform.right * Input.GetAxis("Horizontal")
                     + transform.forward * Input.GetAxis("Vertical");
        if (cc.isGrounded && Input.GetButtonDown("Jump")) vel.y = jumpVelocity;
        vel.y += gravity * Time.deltaTime;                          // integrate gravity
        cc.Move((wish * speed + Vector3.up * vel.y) * Time.deltaTime);
    }
}
```

Key fields: `isGrounded`, `slopeLimit` (max walkable slope), `stepOffset` (max step height),
`skinWidth` (small penetration tolerance — keep ~10% of radius; too small causes jitter),
`center`/`radius`/`height`. `Move` returns `CollisionFlags`; hook `OnControllerColliderHit` to push
dynamic rigidbodies.

**Dynamic rigidbody character** instead: `Rigidbody` with `freezeRotation = true` (or constrain
X/Z rotation), a high-friction physics material, movement via `AddForce`/target-velocity in
`FixedUpdate`, and a grounded raycast. More physical, more tuning.

## Unreal (UE5) — Character + CharacterMovementComponent

`ACharacter` bundles a capsule + `UCharacterMovementComponent` (CMC), a sophisticated kinematic
controller. It sweeps, handles Walking / Falling / Swimming / Flying **movement modes**, and applies
its own gravity scale.

- **Input → movement:** `AddMovementInput(WorldDirection, ScaleValue)`; jump via `Jump()` /
  `StopJumping()` (`ACharacter` overrides).
- **Slopes/steps:** CMC `MaxStepHeight`, `SetWalkableFloorAngle` / `GetWalkableFloorAngle`,
  `MaxWalkSpeed`, `GravityScale`, `JumpZVelocity`, `AirControl`.
- **Ground state:** `Movement->IsMovingOnGround()`, `IsFalling()`; `CurrentFloor` holds the hit.
- Moving platforms are handled by CMC's base-relative movement when the character stands on a
  movable primitive set as its movement base.

For non-Character pawns you can drive a movable component manually or add a `PawnMovementComponent`.

## Ground detection, slopes, steps, moving platforms — the recurring problems

- **Ground detection** must be robust: a single downward ray can miss on ledges. Use the built-in
  `is_on_floor()` / `isGrounded` / `IsMovingOnGround()` where possible; if rolling your own, use a
  short **shapecast** (capsule/sphere) slightly wider than the character, not a thin ray.
- **Slopes:** set the max-walkable-angle knob so steep slopes read as walls; add slide-down on
  too-steep surfaces if desired. Project intended velocity onto the floor plane to avoid bumpy speed
  on ramps.
- **Steps/stairs:** rely on `stepOffset` / `MaxStepHeight` / `floor_snap_length`. A capsule collider
  climbs small steps far more smoothly than a box.
- **Moving platforms:** the platform must be a **kinematic mover** that reports motion (Godot
  `AnimatableBody` with `sync_to_physics = true`; Unity kinematic `Rigidbody.MovePosition` in
  `FixedUpdate`; Unreal movable primitive as movement base). A **static** body will not carry a
  character. For a kinematic character on a moving platform, add the platform's per-tick delta to the
  character before moving, or parent to the platform's motion.
