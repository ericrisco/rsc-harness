# Prediction, reconciliation & latency hiding

The whole reason netcode is hard: the speed of light. A round trip (RTT) of 60–150 ms is normal, and if the
owning client had to wait a full RTT to see its own movement, the game would feel broken. The techniques
below keep it responsive **without** giving up server authority. This is engine-agnostic theory; the
per-engine references show where the hooks live.

## The authoritative loop (mental model)

1. Client samples input each tick, tags it with a **sequence number**, sends it to the server, and **applies
   it locally immediately** (prediction).
2. Server receives inputs, simulates them on its fixed tick, and produces authoritative state. It stamps each
   state snapshot with the last input sequence number it processed for that client.
3. Client receives the authoritative snapshot, **reconciles**: snap to the server state, then re-apply every
   input *after* the acknowledged sequence number (they haven't reached the server yet).
4. Other (remote) entities are rendered from buffered snapshots, **interpolated** slightly in the past.

Server is always the source of truth. The client only ever *guesses ahead* and gets corrected.

## 1. Client-side prediction

The owning client runs the same movement code the server will run, on the same fixed timestep, the instant it
presses a key — no waiting. Requirements:

- **Deterministic** movement/simulation for the predicted entity (same input + same state → same result).
  This is why `gamedev-physics` determinism matters here.
- A **ring buffer** of unacknowledged inputs (`{seq, dt, input}`), kept until the server acknowledges them.
- Predict only what the client owns (its pawn). Never predict other players — interpolate them instead.

## 2. Server reconciliation

When an authoritative snapshot arrives tagged "processed up to input N":

```
clientState = serverState               # trust the server
discard buffered inputs with seq <= N   # server already applied these
for each remaining buffered input (seq > N):
    clientState = simulate(clientState, input)   # replay the unacknowledged ones
```

If the replayed result matches what the client already had, the correction is invisible. If it diverges (the
server disagreed — lag, a missed collision, a rejected move), the entity snaps: the visible **rubber-band**.
Goal is to *minimize* divergence, not to suppress the correction — hiding a legitimate correction is how you
get players walking through walls on their screen.

- **Smoothing**: for small corrections, blend toward the corrected position over a few frames instead of
  hard-snapping, so a 2 cm disagreement isn't a visible pop. Hard-snap large ones.

## 3. Snapshot interpolation (remote entities)

You receive remote entities' state only every send-tick (e.g. every 50 ms) — rendering the latest packet
directly makes them teleport. Instead, keep a small buffer and render them ~1–2 snapshots **in the past**:

- **Interpolation delay** ≈ 100 ms (2× send interval + jitter margin). Render remote entities at
  `now − delay`, interpolating between the two snapshots that straddle that time.
- Trade-off: everyone else is shown slightly in the past. That is fine and standard.
- **Extrapolation** (dead reckoning) predicts a remote entity forward when a packet is late — cheaper on
  bandwidth but wrong on direction changes; prefer interpolation and only extrapolate briefly to cover a gap.

So on one client, three clocks coexist: **its own pawn** = present (predicted), **remote entities** = past
(interpolated), **the server** = the arbiter reconciling the two.

## 4. Lag compensation (server-side rewind)

For instant/hitscan hits, the shooter aimed at where they *saw* the target — which is `interpolation delay +
½ RTT` in the past. If the server tests the hit against the target's *present* position, the shooter misses
despite a perfect aim. Fix: the server keeps a short **history** of every entity's recent positions and, when
processing a shot, **rewinds** the world to the shooter's view time before testing the hit.

- Store ~1 second of position history per entity (a ring of transforms per tick).
- On a shot: reconstruct positions at `clientRenderTime`, run the trace, then restore.
- Trade-off: the victim can be hit just after ducking behind cover ("shot behind the wall"). This is an
  accepted fairness choice favoring the shooter; cap how far back you rewind to bound the unfairness.

## 5. Tick rate, send rate, netrate

- **Simulation tick** — fixed Hz the server steps the world (20 / 30 / 60+; higher = more precise + more CPU).
- **Send rate / snapshot rate** — how often state goes on the wire; often lower than sim tick, and independent
  of client render FPS. This is the "netrate/updaterate/cmdrate" family in shooters.
- **Client render FPS** — decoupled from both; render via interpolation between fixed-step states.
- Bandwidth ≈ replicated-bytes × send-rate × relevant-peers. Shrink it with relevancy/visibility scoping,
  quantized/delta-compressed fields, and lower send rates for distant or unimportant actors.

**Never run gameplay in a variable `_process`/`Update`/`Tick` on a networked game** — use a fixed timestep
(`_physics_process`, `NetworkUpdate`/`FixedUpdate`, Unreal's fixed sim) so prediction and reconciliation
replay identically on client and server.

## Alternative model: deterministic lockstep / rollback

For fighting games and some RTS: no per-frame state replication at all — every peer runs the identical
deterministic simulation and only **inputs** are exchanged. **Lockstep** waits for all inputs before advancing
(one slow peer stalls everyone). **Rollback** (GGPO-style) predicts absent inputs, then rolls back and
re-simulates when the real inputs arrive — excellent feel, but demands *bit-perfect determinism* (watch
floats, iteration order, RNG) and bounded state you can snapshot/restore cheaply. Choose it only when you can
guarantee that determinism; otherwise the client-server model above is the safer default.

## Checklist for a responsive authoritative game

- [ ] Owning pawn predicted locally on a fixed timestep; inputs buffered with sequence numbers.
- [ ] Server acks the last processed input seq in each snapshot; client replays unacknowledged inputs.
- [ ] Small corrections smoothed, large ones snapped; corrections never fully suppressed.
- [ ] Remote entities interpolated ~100 ms in the past from a snapshot buffer.
- [ ] Hitscan uses server-side rewind bounded to ~1 s of history.
- [ ] Sim tick / send rate / render FPS all decoupled; bandwidth scoped by relevancy.
