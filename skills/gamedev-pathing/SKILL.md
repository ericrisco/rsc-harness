---
name: gamedev-pathing
description: "Use when making NPCs, enemies, or units navigate a level — grid vs waypoint vs navmesh, A*/JPS, navmesh baking and agent radius, off-mesh links, steering, RVO crowd avoidance, and flow fields in Godot 4.x, Unity, Unreal. NOT collision response or character controllers (that is gamedev-physics), NOT aggro or difficulty design (that is game-design)."
tags: [pathfinding, navmesh, navigation, steering, a-star]
recommends: [godot, unity, unreal, gamedev-physics]
profiles: [full]
origin: risco
---

# Game AI navigation & pathfinding

Move agents through a level intelligently and per-engine-correctly: pick a world representation,
run the right search, then follow the result with steering + local avoidance. This skill owns the
**navigation stack**; it stops where physics collision response and high-level behaviour design begin.

## Version targets & the API ban-list (read first)

Navigation APIs were renamed hard between engine generations. Emitting an old name compiles into
nothing or silent breakage. Target these versions; never emit the banned column.

| Engine (target) | NEVER emit (deprecated / removed) | Use instead |
| --- | --- | --- |
| **Godot 4.x** | `Navigation` / `NavigationMeshInstance` / `Navigation2D` nodes | `NavigationServer2D/3D` + `NavigationRegion2D/3D` |
| Godot 4.x | `agent.get_next_location()` | `agent.get_next_path_position()` |
| Godot 4.x | `NavigationAgent.set_target_location()` | set the `target_position` property |
| Godot 4.x | reading `velocity` directly when avoidance is on | feed `set_velocity()`, read the `velocity_computed(safe)` signal |
| **Unity (AI Navigation pkg)** | the legacy **Navigation window** static bake, `Navigation Static` flag, built-in `OffMeshLink` component | `NavMeshSurface` (`com.unity.ai.navigation`), `NavMeshLink`, `NavMeshModifier` |
| Unity | `agent.destination = p` then reading a path same frame | `SetDestination(p)`, then gate on `!pathPending && remainingDistance <= stoppingDistance` |
| **Unreal (UE5)** | hand-rolling A* over your own grid for pawns | `AAIController::MoveTo*` over `RecastNavMesh`; BT `MoveTo` task |
| Unreal | expecting a **Static** navmesh to react to spawned geometry | set RecastNavMesh **Runtime Generation = Dynamic** (or Dynamic Modifiers Only) |

## The two-layer mental model (center of gravity)

The single most common navigation bug is collapsing two jobs into one. Keep them separate:

1. **Global pathfinding — *where* to go.** A discrete search (A* / navmesh query) over a static-ish
   representation, run *occasionally* (on new goal, or throttled), returns a **corridor of waypoints**.
2. **Local steering + avoidance — *how* to move this frame.** A cheap per-frame vector: follow the
   corridor, dodge other agents and dynamic obstacles, respect acceleration. Runs *every frame*.

Path for the map, steering for the moment. Symptoms of merging them: re-running A* every frame (CPU
melts), or agents that walk the path but pile into each other (no local avoidance). Every engine's
`NavMeshAgent` / `NavigationAgent` bundles both — know which layer you are configuring.

## Choosing a representation

| Representation | Fits | Cost / caveat |
| --- | --- | --- |
| **Uniform grid** | tile/2D games, RTS, roguelikes, destructible terrain | many nodes; needs path smoothing to avoid staircase paths; JPS accelerates it |
| **Waypoint graph** | sparse hand-placed routes, patrol nets, rails, racing lines | cheap; agents snap to nodes, off-graph space is invisible — brittle for open areas |
| **Navmesh** | 3D and most open 2D worlds; the default for character movement | bake step; represents *walkable surface* as convex polys — fewer nodes, natural paths |

Rule: **navmesh for free-roaming characters, grid for tile-locked/destructible worlds, waypoint graph
only for constrained routes.** Detail & path-smoothing (funnel algorithm) → `references/search-algorithms.md`.

## Search algorithms (essentials)

- **A\*** — the default. Dijkstra + a heuristic `h(n)` that estimates remaining cost. Admissible `h`
  (never *over*-estimates) ⇒ optimal path; use **octile** distance on 8-connected grids, **Euclidean**
  on navmesh/any-angle. `h` must also stay ≤ true edge costs (consistency) to skip re-expansions.
- **Dijkstra** — A* with `h=0`. Use when there is **no single goal** (nearest of many exits) or you need
  the full cost field (see flow fields). Slower than A* to one target.
- **Weighted / greedy** — inflate `h` (`f = g + w·h`, `w>1`) for faster, slightly suboptimal paths when
  frame budget beats optimality.
- **JPS (Jump Point Search)** — A* speedup for **uniform-cost grids only**; skips symmetric paths, often
  10×+ fewer expansions. Not for weighted terrain or navmeshes.
- **Hierarchical / HPA\*** — for **huge maps**: partition into clusters, path cluster-to-cluster, refine
  locally. Reach for it when a single flat A* blows the frame budget or you have thousands of tiles.

Always run search off a **binary-heap open set** and a closed set. Pseudocode, tie-breaking, any-angle
(Theta*), and the funnel string-pull → `references/search-algorithms.md`.

## Navmesh workflow (essentials)

1. **Bake** the walkable surface from level geometry. Key params: **agent radius** (how far the mesh is
   shrunk from walls — the #1 knob), **agent height**, **max step/climb**, **max slope**, cell size.
2. **One navmesh per agent size.** A tank and a rat need different bakes; do not share one mesh and hope.
3. **Regions / areas + costs** — tag surfaces (water, mud, road) with a traversal cost so paths prefer
   roads and avoid hazards, rather than deleting the area outright.
4. **Off-mesh / nav links** — explicit edges for jumps, ladders, teleporters, doors: places agents move
   but no polygon connects. Godot `NavigationLink`, Unity `NavMeshLink`, Unreal `NavLinkProxy`.
5. **Dynamic obstacles** — two tools, do not confuse them:
   - **Carving obstacle** (Unity `NavMeshObstacle` carving, Godot `NavigationObstacle`, Unreal
     `NavModifier`): punches a hole so *global* paths route around a placed prop. Costs a re-carve on move.
   - **Local avoidance** (RVO/ORCA): agents dodge *without* touching the mesh — for other moving agents.
6. **Re-baking** — full rebake is expensive; prefer **tile/partial** rebake or carving for runtime
   changes. Bake offline for static levels. Full param table + per-engine baking → `references/navmesh-workflow.md`.

## Steering & local avoidance (essentials)

Steering = a desired-velocity vector combined and clamped to max force/speed. Primitives:

- **Seek / Flee** — accelerate toward / away from a target point.
- **Arrive** — seek that ramps speed down inside a slowing radius (no overshoot/jitter at the goal).
- **Pursue / Evade** — seek/flee the target's *predicted future* position, not its current one.
- **Wander** — smoothed random heading for idle/ambient motion.
- **Path following** — steer toward a look-ahead point along the A*/navmesh corridor, not the far goal.
- **Flocking** = separation + alignment + cohesion (Reynolds boids) for groups.

Combine either as a **weighted sum** (simple) or **priority/arbitration** (avoidance wins over cohesion).

**Local avoidance (RVO / ORCA):** each agent picks a velocity that is collision-free assuming neighbours
share the burden (*reciprocal* — hence no oscillating "dance"). This is avoidance, **not** collision
*response*: it changes intended velocity *before* moving; the physics/collision solver is a separate,
last-resort backstop (→ [`gamedev-physics`](../gamedev-physics/SKILL.md)). For dense crowds use the
engine's crowd/avoidance system.

**Flow fields** — for **many agents → one (or few) goals** (RTS swarm, tower-defense creeps): run one
**Dijkstra from the goal** over the grid to build a cost/integration field, derive a per-cell direction
vector once, then every agent just samples its cell. O(1) per agent vs one A* each. Full derivation,
boids weights, and RVO intuition → `references/steering-and-avoidance.md`.

## Per-engine mapping

### Godot 4.x (`NavigationAgent3D` — 2D is identical with `2D` suffix)

```gdscript
extends CharacterBody3D
@onready var agent: NavigationAgent3D = $NavigationAgent3D
@export var speed := 4.0

func _ready() -> void:
    agent.avoidance_enabled = true                       # RVO local avoidance
    agent.velocity_computed.connect(_on_velocity_computed)

func set_goal(p: Vector3) -> void:
    agent.target_position = p                            # property, NOT set_target_location()

func _physics_process(_delta: float) -> void:
    if agent.is_navigation_finished():
        return
    var next := agent.get_next_path_position()           # 4.x name (was get_next_location)
    var desired := global_position.direction_to(next) * speed
    agent.set_velocity(desired)                          # feed RVO; result via signal

func _on_velocity_computed(safe: Vector3) -> void:       # only fires while avoidance enabled
    velocity = safe
    move_and_slide()
```

One-off query without an agent: `NavigationServer3D.map_get_path(map_rid, from, to, true)`. Rebake a
region at runtime: `$NavigationRegion3D.bake_navigation_mesh()`. Off-mesh: `NavigationLink3D`. If
avoidance is **off**, skip the signal and `move_and_slide()` with `desired` directly.

### Unity (AI Navigation package + `NavMeshAgent`)

```csharp
using UnityEngine;
using UnityEngine.AI;

[RequireComponent(typeof(NavMeshAgent))]
public class Chaser : MonoBehaviour {
    NavMeshAgent agent;
    void Awake() => agent = GetComponent<NavMeshAgent>();

    public void Chase(Transform target) => agent.SetDestination(target.position);

    public bool ReachedGoal() =>
        !agent.pathPending && agent.remainingDistance <= agent.stoppingDistance
        && (!agent.hasPath || agent.velocity.sqrMagnitude < 0.01f);
}
```

Bake: add a **`NavMeshSurface`** to a scene root and Bake (the legacy Navigation window is gone).
Runtime rebake: `surface.BuildNavMesh()`. Dynamic blockers: **`NavMeshObstacle`** (enable *Carving* for
stationary props, leave off for moving agents so RVO handles them). Off-mesh: **`NavMeshLink`**. Local
avoidance quality: `agent.obstacleAvoidanceType`. Area costs: `agent.SetAreaCost(area, cost)`.

### Unreal (UE5 — `RecastNavMesh` + `AIController` + Behavior Tree / EQS)

1. Drop a **`NavMeshBoundsVolume`** around playable space → a `RecastNavMesh` auto-generates. For
   runtime changes set its **Runtime Generation = Dynamic** (or *Dynamic Modifiers Only*); spawned
   geometry must have collision + **Can Ever Affect Navigation**.
2. Possess the pawn with an **`AAIController`**. Movement:

```cpp
AAIController* AICon = Cast<AAIController>(GetController());
AICon->MoveToActor(TargetActor, /*AcceptanceRadius*/ 50.f);   // or MoveToLocation(FVector)
```

3. **Behavior Tree + Blackboard** for decisions; the **`MoveTo`** task walks the navmesh. **EQS**
   (Environment Query System) picks *where* to go (cover, flank, nearest item) via scored queries.
4. Costs/holes: **`NavModifierVolume`** + `NavArea` classes. Off-mesh: **`NavLinkProxy`**. Crowd
   avoidance: enable the **Detour Crowd** manager (or `DetourCrowdAIController`) for RVO on many agents.

> High-level BT *design* (states, aggro, difficulty) is [`game-design`](../game-design/SKILL.md); this skill wires the BT's
> movement/EQS tasks to navigation, not the decision tree's semantics.

## Anti-patterns

| Anti-pattern | Do instead |
| --- | --- |
| Running a full A* every frame | Path on goal-change (or throttled) and steer between frames — per-frame search melts CPU at scale. |
| One navmesh bake shared by every unit | Radius/height differ; bake per agent size or use agent-type profiles. |
| Baking with a placeholder agent radius | Bake with the real radius — mismatch is the top "stuck in doorways / clipping walls" cause. |
| Treating agents that clip through each other as a physics bug | Missing **local avoidance**; enable RVO/crowd — that is the navigation layer. |
| Expecting RVO to prevent every overlap | Avoidance ≠ collision. Agents can still overlap under pressure; that is expected, not a physics bug. |
| Expecting a **static** bake to see runtime-spawned geometry | Set Dynamic runtime generation / rebake, or add a carving obstacle or nav link. |
| Hand-rolling your own grid A* in Unity/Unreal | Reinvents the built-in navmesh; use `NavMeshAgent` / `AAIController::MoveTo`. |
| 500 zombies each running A* to the player | That's a **flow field**: one Dijkstra from the goal, agents sample cells. |
| Setting `agent.destination` and reading the path the same frame | Path is async (`pathPending`); gate on it before trusting `remainingDistance`. |
| Inflating `h` because a bigger heuristic seems smarter | Over-estimating `h` breaks A* optimality; keep it admissible (or weight it *knowingly*). |
| Trusting a path query that came back empty | Start/end are **off the navmesh** or in disconnected islands — snap to the nearest poly and check reachability first. |
| Assuming an off-mesh link works both ways | Links are **directional and manual** — a jump-down link does not imply a jump-up link. |
| Feeding raw grid paths to the mover | Smooth them (funnel / string-pull) or agents walk visible zig-zag staircases. |

## Related skills

- [`godot`](../godot/SKILL.md) — GDScript/scene specifics; this skill owns the navigation subsystem it plugs into.
- [`unity`](../unity/SKILL.md) — Unity/C# project setup; here for the NavMesh + AI Navigation package details.
- [`unreal`](../unreal/SKILL.md) — UE5/Blueprint/C++; here for RecastNavMesh + AIController/BT/EQS wiring.
- [`gamedev-physics`](../gamedev-physics/SKILL.md) — collision *response*, rigidbodies, character controllers; steering decides intended velocity, physics resolves the contact.
- [`game-design`](../game-design/SKILL.md) — high-level enemy behaviour, aggro, encounter/difficulty design (what the AI *decides*, not how it *moves*).

## Checklist

- [ ] Representation chosen deliberately (navmesh / grid / waypoint) and justified for the world type.
- [ ] Global path and local steering are **separate layers**; A* is not per-frame.
- [ ] Navmesh baked with the correct **agent radius/height/step/slope** (per agent size if they differ).
- [ ] Area costs set for hazards/terrain instead of hard-deleting walkable space.
- [ ] Off-mesh/nav links placed for every jump/ladder/teleport gap (correct direction).
- [ ] Dynamic obstacles handled by carving *or* rebake *or* local avoidance — the right one for each case.
- [ ] Local avoidance / crowd enabled if multiple agents share space; flow field used for many→one-goal.
- [ ] Correct **current** engine APIs (no banned names from the version table); paths validated for reachability.
- [ ] Grid paths smoothed (funnel) so movement isn't staircased.

## Project grounding (02-DOCS + CLAUDE.md)

When this runs in a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) wiki), record
the project's navigation decisions in `02-DOCS/wiki/stack/gamedev-pathing.md` (indexed from
`02-DOCS/wiki/index.md`): engine + version, chosen representation, bake settings (agent sizes, cell
size), avoidance/crowd choice, custom links/areas. Read it first on every use; bump its `Updated` date
when a convention changes. No `02-DOCS/` layer? Skip silently — conventions are *recorded, not gated*.
