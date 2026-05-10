# competition/capability-vectors — Independent + reactive competitor R&D progression

**Status:** IMPLEMENTED (v0.2)
**Used by:** games where rivals have personalities (strengths / weaknesses) that progress over time and react to the leader

The "rival capability vector" pattern lifted from ai-tycoon. Each rival has a vector of capability scores by dimension — `{ camera: 60, battery: 40, design: 70 }` for phones, `{ language: 80, code: 50, safety: 90 }` for AI, `{ throughput: 70, sla: 60, latency: 40 }` for hosting, etc.

Each tick (or release cycle), capabilities advance two ways:
1. **Independently** — each rival has a baseline growth profile (their own R&D investment).
2. **Reactively** — they observe the leader and pull toward the leader's strengths, weighted per dimension by how much they care / can afford to chase.

Plus a **release-cadence helper**: when should a rival actually ship a new product, given pressure from the leader and their own cash runway?

## When to use

- You have 2-N rivals competing on multiple capability dimensions.
- Each rival should feel different (one's a fast scrappy startup, another's a slow incumbent).
- You want rivals to react to the player — chase strengths, get scared into faster releases — without scripting per-rival.

If your rivals just have a single "strength" number, this is overkill. Use `competition/competitor` archetypes instead.

## Public API

```ts
import {
  CapabilityVector,
  CapabilityProfile,
  ProgressOptions,
  ReleaseCadenceConfig,
  progressCapabilities,
  averageCapability,
  bestDimension,
  shouldRelease,
} from 'opentycoonos/competition/capability-vectors';
```

### Types

```ts
/** A rival's capability scores. Keys are dimension ids defined by the game. */
type CapabilityVector = Record<string, number>;

interface CapabilityProfile {
  /**
   * Independent baseline at progress 0..1. The competitor's own R&D
   * trajectory absent any leader-chasing. Returns score per dimension.
   */
  independentAt: (progress: number) => CapabilityVector;

  /**
   * Per-dimension copy aggression (0-1).
   *   0.9 → match 90% of leader on this dim (strength they care about)
   *   0.5 → match 50% (moderate)
   *   0.2 → barely chase (weakness or low priority)
   */
  copyWeights: CapabilityVector;
}

interface ProgressOptions {
  /** 0-1 — campaign progress (e.g., year/maxYears). */
  progress: number;
  /** 0-1 — cash factor; <1 slows growth proportionally. Default 1. */
  cashFactor?: number;
}

interface ReleaseCadenceConfig {
  /** Days between releases under normal conditions. */
  baseDays: number;
  /**
   * Subtract this many days per 0.1 of leader market share above 0.30.
   * Models "rival speeds up when threatened." Default 5.
   */
  speedupPerLeaderShare?: number;
  /** Below this runway, slow releases. Default 90 days. */
  cashStrainRunwayDays?: number;
  /** Add this many days when cash-strained. Default 30. */
  cashStrainPenaltyDays?: number;
  /** Random jitter in days (0-N). Default 0 = deterministic. */
  jitterDays?: number;
}
```

### Functions

| Function | Purpose |
|---|---|
| `progressCapabilities(current, leader, profile, options)` | Compute new vector after one progression step |
| `averageCapability(v)` | Mean of all dimensions (for headline scores) |
| `bestDimension(v)` | Strongest dim + its score (for "they're great at X" copy) |
| `shouldRelease(daysSinceLast, leaderShare, runwayDays, config, rng?)` | Boolean — should the rival ship this tick? |

## Wiring

```ts
import { progressCapabilities, shouldRelease } from 'opentycoonos/competition/capability-vectors';

const novaMindProfile: CapabilityProfile = {
  independentAt: (p) => ({
    camera: 25 + p * 50,
    battery: 20 + p * 40,
    design: 30 + p * 35,
    reliability: 15 + p * 30,
  }),
  copyWeights: {
    camera: 0.85,      // strong copyer
    battery: 0.55,
    design: 0.75,
    reliability: 0.30, // weak — doesn't prioritize this
  },
};

// Per release-cycle (not every tick — only when shouldRelease returns true):
if (shouldRelease(daysSinceLast, playerShare, runwayDays, { baseDays: 250 })) {
  rival.capabilities = progressCapabilities(
    rival.capabilities,
    playerCapabilities,         // or null if no observable leader
    novaMindProfile,
    { progress: state.clock.year / 10, cashFactor: rival.cash > 0 ? 1 : 0.5 },
  );
  // → game emits a "NovaMind released a new phone" headline + recomputes scoring
}
```

## Design notes

- **Pure functions.** Nothing mutates. `progressCapabilities` returns a new vector; cadence + queries don't touch state.
- **Independent vs reactive is `Math.max(...)`.** A competitor's score on a dim is the better of (their own progression, leader_score × copyWeight). They can't be dragged below their independent floor by a weak leader, but they can be pulled up.
- **Dimensions are game-owned.** The engine doesn't know what "camera" or "language" means; it just walks the keys.
- **Cash factor scales the independent baseline.** A cash-strapped rival progresses slower regardless of leader pressure.
- **Cadence is separate from progression.** Use `shouldRelease` to decide *when*; call `progressCapabilities` *only when shipping*.

## Out of scope

- Capacity / production. See `asset-models/multi-tier-production` for that.
- Pricing strategy. See `competition/dynamic-pricing` for cost-floor + repricing.
- Long-term tech research trees. See `research/` modules.

## Evidence

Lifted from `ai-tycoon/src/engine/competitors.ts:90-198`:
- `getNovaMindIndependentBenchmarks` / `getTitanCorpIndependentBenchmarks` → generalized into `independentAt`.
- The `Math.max(independent, playerBest × ratio)` pattern → generalized into per-dim `copyWeights`.
- The `nmInterval` cadence logic with `playerShare` accelerator + cash slowdown → generalized into `shouldRelease`.
