# Steering, local avoidance & flow fields

Depth for the "Steering & local avoidance" section of SKILL.md. Steering is the **local** layer: given a
global path (from A*/navmesh), produce a per-frame velocity that follows it while dodging neighbours. All
formulas below assume a max speed and a max steering force (acceleration clamp).

## The steering model (Reynolds)

Each behaviour returns a **steering force** = `desired_velocity − current_velocity`, clamped to
`max_force`. Apply it as acceleration, integrate velocity (clamped to `max_speed`), integrate position.

```text
steering = clamp(desired - velocity, max_force)
velocity = clamp(velocity + steering, max_speed)
position = position + velocity * dt
```

## Primitives (desired velocity per behaviour)

- **Seek**: `desired = normalize(target - pos) * max_speed`.
- **Flee**: seek negated — `desired = normalize(pos - target) * max_speed`.
- **Arrive**: seek that ramps down inside a slowing radius, so the agent settles instead of orbiting:
  ```text
  to_target = target - pos;  dist = length(to_target)
  speed = (dist < slow_radius) ? max_speed * dist/slow_radius : max_speed
  desired = to_target/dist * speed
  ```
- **Pursue**: seek the target's **predicted** position: `predict = target_pos + target_vel * T`, where
  `T` scales with distance (`T = dist / max_speed`). **Evade** = flee that prediction.
- **Wander**: keep a point on a small circle projected ahead of the agent, jitter it slightly each frame,
  seek it — gives smooth, non-robotic idle motion (unlike raw random which twitches).
- **Obstacle avoidance**: cast a probe (feeler) ahead; if it hits a static obstacle, add a lateral force
  away from the obstacle's center. This is a *steering* dodge, distinct from navmesh carving.

## Combining behaviours

- **Weighted sum**: `total = Σ wᵢ · forceᵢ`, then clamp. Simple; can average into indecision (two forces
  cancel and the agent freezes between them).
- **Priority / arbitration**: evaluate in order (avoidance → separation → path-follow → cohesion) and
  take the first non-trivial force, or accumulate with a running-force budget until clamp is hit. More
  robust for "avoidance must win".

## Path following

Do **not** seek the far goal — seek a moving point along the corridor:

1. Find the point on the path polyline nearest the agent.
2. Advance a **look-ahead** distance along the path from there → target point.
3. **Arrive** at that target; when close to the final waypoint, arrive at the true goal.

Look-ahead too short = the agent hugs corners and jitters; too long = it cuts corners and leaves the
corridor. Tune to roughly one agent radius + a fraction of current speed. Engine agents
(`NavigationAgent.get_next_path_position`, `NavMeshAgent`) do this internally — you feed the corridor,
they hand back the next point.

## Flocking (boids)

Three neighbour-based forces within a perception radius; sum with weights:

- **Separation** — steer away from the average offset to close neighbours (usually the strongest weight;
  prevents overlap).
- **Alignment** — steer toward the average heading of neighbours (group moves as one).
- **Cohesion** — steer toward the average position of neighbours (group stays together).

Typical starting weights: separation 1.5, alignment 1.0, cohesion 1.0 — then tune. Combine with
path-following (the flock follows a global path while holding formation).

## Local avoidance: RVO / ORCA

Reynolds separation is reactive and oscillates in crowds. **Velocity-obstacle** methods are the modern
answer:

- A **velocity obstacle (VO)** for a neighbour is the set of your velocities that would collide with it
  within a time horizon. **RVO** (Reciprocal VO) assumes *both* agents share the avoidance effort, so
  each takes half the correction — this kills the "two agents dance side-to-side" oscillation.
- **ORCA** (Optimal Reciprocal Collision Avoidance) formulates each neighbour as a half-plane constraint
  on your velocity and picks, via linear programming, the collision-free velocity nearest your desired
  one. It scales to dense crowds and is what most engine crowd systems implement.
- Key idea: avoidance adjusts the **intended velocity before you move**. It is *not* collision response
  — the physics solver (see `gamedev-physics`) is the last-resort backstop when agents still overlap
  under pressure. Overlap under crush is expected, not a bug.

**Per-engine:** Godot `NavigationAgent` avoidance (`avoidance_enabled` + `set_velocity` →
`velocity_computed` signal, RVO2-based). Unity `NavMeshAgent.obstacleAvoidanceType` (quality levels,
RVO). Unreal **Detour Crowd** manager / `DetourCrowdAIController` (RVO/ORCA-style for many pawns);
`RVOAvoidance` on `CharacterMovementComponent` for a lighter option.

## Flow fields — many agents, one goal

When hundreds/thousands of agents share a goal (RTS swarm, tower-defense creeps), one A* *per agent* is
wasteful. Build the field once, then every agent samples O(1):

1. **Cost field**: per-cell traversal cost (walls = impassable, terrain = weighted).
2. **Integration field**: run **Dijkstra/BFS from the goal** outward, storing each cell's cheapest total
   cost to reach the goal. (This is why Dijkstra, not A* — you want the whole field, not one path.)
3. **Flow field**: for each cell, store a direction vector pointing to the lowest-cost neighbour.
4. **Per agent, per frame**: sample the flow vector at the agent's cell, use it as the desired direction,
   then layer local avoidance (separation/RVO) so they don't stack.

Rebuild only when the goal or the cost field changes. Multiple goals = seed the Dijkstra from all goal
cells at once (agents flow to the nearest). Flow fields also smooth naturally (bilinear-sample the
vectors across cells).

When to choose it: **many agents → few goals**. For a handful of agents to distinct goals, per-agent A*
or navmesh is simpler and gives better individual paths.

## Combining the two layers (the whole loop)

```text
on new goal:            path = search(start, goal)      # global, occasional
every frame per agent:
    look = lookahead_point(path, pos)                   # follow the corridor
    desired = arrive(look)                              # path following
    desired += separation + rvo(neighbours)             # local avoidance
    velocity = integrate(clamp(desired))                # steer, don't teleport
    move(velocity); resolve_collisions()                # physics backstop
```

Global path answers *where*; steering + avoidance answer *how to move now*; physics is the final contact
resolver. Keep them distinct and each stays cheap and debuggable.
