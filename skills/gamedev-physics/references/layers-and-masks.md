# Collision layers & masks — the filtering that trips everyone up

The single most common physics bug that is not a crash: "these two things should collide and they
don't," or "this ghost trigger fires on everything." Both are filtering. The concept is universal;
only the words change.

**Layer = what I *am*. Mask = what I *scan for*.** They are independent bit sets. A body being in
layer 3 says nothing about what it collides with — that is the mask's job.

## Godot 4

Two properties on every `CollisionObject2D/3D` (StaticBody, RigidBody, CharacterBody, Area):

- `collision_layer` — the layer bits this body occupies (what it *is*).
- `collision_mask` — the layer bits this body scans (what it *looks for*).

**The rule:** a contact is registered when **either** body's `collision_mask` intersects the
other's `collision_layer`. It is an **OR**, which is why detection can be *asymmetric* — body A can
detect body B even if B does not scan for A. This is deliberate (one-way triggers, sensors) but is
also the classic footgun. **Keep layer/mask symmetric for solid collisions** unless you truly want
one-way behavior.

For an `Area2D/3D`, the split matters: the Area's **mask** determines which bodies/areas it
*detects* (fires `body_entered` / `area_entered`); the Area's **layer** determines whether something
else can detect the Area. A detector-only Area often has a mask set and layer cleared.

Name your layers in **Project Settings → Layer Names → 2D/3D Physics** so the inspector shows
"player / enemy / world / pickup" instead of bare numbers. Set bits from code with the helpers, not
raw math:

```gdscript
set_collision_layer_value(2, true)   # I am on layer 2
set_collision_mask_value(1, true)    # I scan layer 1
set_collision_mask_value(3, true)    # ...and layer 3
```

Bits are 1-indexed in these helpers; the raw `collision_layer` int is a bitmask (layer 1 = value 1,
layer 2 = value 2, layer 3 = value 4, ...). `collision_layer = 0b101` means layers 1 and 3.

## Unity 6

Physics filtering is layer-pair based, not per-object masks:

1. Assign each GameObject a **Layer** (Inspector top-right; define names in Tags & Layers). Physics
   layers are the same 32 layers used everywhere.
2. **Project Settings → Physics → Layer Collision Matrix** (and Physics 2D separately) is a
   checkbox grid: an unticked cell means those two layers **never** collide or trigger. This is the
   global filter.
3. Toggle a single pair at runtime: `Physics.IgnoreLayerCollision(layerA, layerB, true)` — or
   `Physics.IgnoreCollision(colliderA, colliderB)` for two specific colliders.

Queries take a **`LayerMask`** argument, which is a *different* use of the same layers — it says
which layers the ray/overlap considers:

```csharp
// Build a mask from names, then raycast only against Ground + Enemy.
int mask = LayerMask.GetMask("Ground", "Enemy");
if (Physics.Raycast(origin, dir, out RaycastHit hit, 50f, mask)) { /* ... */ }
```

A `LayerMask` is a bitfield: `1 << layerIndex`. Combine with `|`, exclude with `~`. A common mistake
is passing a layer *index* where a *mask* is expected — always shift or use `LayerMask.GetMask`.

## Unreal (UE5, Chaos)

Two axes per primitive component, configured via **Collision Presets** (Details → Collision):

- **Object Type** — the single channel this component *is* (WorldStatic, WorldDynamic, Pawn,
  PhysicsBody, or a custom object channel). This is "what I am."
- **Collision Responses** — for every channel, one of **Block / Overlap / Ignore**. This is "how I
  react to each kind of thing."

For two components to physically **block**, *both* must respond Block to the other's object type. For
an **overlap** event, at least one responds Overlap (and the other not Ignore) and **Generate
Overlap Events** is enabled on both. Bundle a configuration into a named **Collision Preset**
(Project Settings → Collision) so a whole class of actors shares it — e.g. a `Trigger` preset that
overlaps Pawns and ignores everything else.

**Trace channels** (Visibility, Camera, or custom) are a *separate* set used only by line/shape
traces, distinct from object channels used for physical collision. A common error is tracing on an
object channel or vice versa.

```cpp
// Custom object channel example (defined in DefaultEngine.ini as ECC_GameTraceChannel1).
Comp->SetCollisionObjectType(ECC_Pawn);
Comp->SetCollisionResponseToAllChannels(ECR_Ignore);
Comp->SetCollisionResponseToChannel(ECC_WorldStatic, ECR_Block);
Comp->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
Comp->SetGenerateOverlapEvents(true);
```

## Worked example — player / enemy / pickup / wall

Desired: player and enemies collide with walls and each other; the pickup collides with nothing but
detects the player touching it.

| Thing | Godot layer | Godot mask | Unity layer / matrix | Unreal preset |
| --- | --- | --- | --- | --- |
| Wall | World | (none needed) | World; collides with Player, Enemy | BlockAll |
| Player | Player | World, Enemy, Pickup | Player; collides World, Enemy | Pawn (blocks World/Pawn) |
| Enemy | Enemy | World, Player, Enemy | Enemy; collides World, Player, Enemy | Pawn |
| Pickup (Area/Trigger) | Pickup | Player | Pickup; **only** Player pair ticked, `IsTrigger` | Custom `Pickup`: overlap Pawn, ignore all else |

The pickup is a **trigger/Area**: it scans only for the Player layer and produces an overlap event,
never a solid collision.

## Debug checklist when a collision "doesn't happen"

- Do the layer/mask bits actually overlap? (Godot: is one body's mask covering the other's layer?)
- Unity: is the pair ticked in the **Layer Collision Matrix**, and did you use 2D matrix for 2D?
- Unity trigger: is there a **Rigidbody** on at least one of the two objects? Trigger events need one.
- Unreal: are **both** set to Block (for solid) or is Generate Overlap Events on **both** (for overlap)?
- Query returns nothing: are you passing a **mask/channel** that includes the target? Passing a raw
  layer index instead of a shifted mask silently matches the wrong layer.
- One-way collision you did not intend → Godot asymmetric mask; make it symmetric.
