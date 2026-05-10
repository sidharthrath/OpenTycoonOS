# asset-models/multi-tier-production — Owned + contracted + spot capacity allocator

**Status:** IMPLEMENTED (v0.2)
**Used by:** games where the player can produce / fulfill from multiple sources with different cost-vs-flexibility trade-offs

The "three-tier capacity" pattern lifted from ai-tycoon's compute market:

| Tier | Capex | Variable cost | Flexibility |
|---|---|---|---|
| **Owned** | High (factories, DCs, fleets) | Lowest per-unit | Stuck with capacity even if demand drops |
| **Contracted** | Medium (multi-month commitments) | Medium per-unit | Termination penalties; predictable rate |
| **Spot** | None | Highest per-unit (often dynamic) | Pay only for what you use |

Real economic decision: do you build factories (capex now, cheap forever), sign with a contract manufacturer (medium cost, no capex), or scramble for spot capacity at 2× the cost? `multi-tier-production` handles the allocation; the game decides the tier mix.

This is **separate from** `asset-models/inventory`. Inventory tracks batches sitting on the shelf with COGS + spoilage. multi-tier-production decides *which source produces the next unit*. They compose: each tier could feed into a single inventory pool.

## When to use

- Player has multiple production sources with different cost structures.
- You want fixed-vs-variable cost decisions to matter (the "build vs buy vs rent" trilemma).
- Spot prices should respond to availability (real markets do this — see `spotPriceMultiplier`).

If you only have one production source, just use `asset-models/inventory`.

## Public API

```ts
import {
  ProductionTierKind,
  ProductionTier,
  FulfillmentResult,
  fulfillDemand,
  spotPriceMultiplier,
  headroomMultiplier,
} from 'opentycoonos/asset-models/multi-tier-production';
```

### Types

```ts
type ProductionTierKind = 'owned' | 'contracted' | 'spot';

interface ProductionTier {
  /** What kind of capacity this is — for UI breakdown. */
  kind: ProductionTierKind;
  /** Optional human label — "Shenzhen Factory 1", "Foxconn contract", etc. */
  label?: string;
  /** Units producible this tick. */
  capacityPerTick: number;
  /** Variable cost per unit produced. */
  costPerUnit: number;
  /**
   * Fixed cost per tick whether or not the tier is used. Capex amortization,
   * staff retainers, lease payments. Spot tiers usually have 0 here.
   */
  fixedCostPerTick: number;
}

interface FulfillmentResult {
  /** Total units produced across all tiers (≤ demand). */
  unitsProduced: number;
  /** Total cost: sum of all variable + fixed costs for this tick. */
  totalCost: number;
  /** Per-tier breakdown for UI / logging. */
  perTier: Array<{
    kind: ProductionTierKind;
    label?: string;
    unitsProduced: number;
    variableCost: number;
    fixedCost: number;
  }>;
  /** Demand the tiers couldn't cover (≥ 0). */
  unmetDemand: number;
}
```

### Functions

| Function | Purpose |
|---|---|
| `fulfillDemand(tiers, demandUnits)` | Allocate demand cheapest-first; return per-tier result |
| `spotPriceMultiplier(availability)` | Convert spot pool availability (0-1) → cost multiplier (0.6×–5×) |
| `headroomMultiplier(utilization)` | How much over current demand to plan capacity for (1.2×–1.8×) |

## Allocation algorithm

`fulfillDemand` allocates **cheapest-first by `costPerUnit`**:

1. Sort tiers ascending by `costPerUnit`.
2. Pull from the cheapest tier up to its `capacityPerTick`.
3. Move to the next tier; repeat until demand is met or all tiers exhausted.
4. **Fixed costs accrue from every tier**, regardless of whether it produced anything (capex / leases don't pause when demand dips).

Owned tiers usually win the cheapest-first sort because their `costPerUnit` is low — but their `fixedCostPerTick` is high, which is the trade-off the player should feel.

## Spot price curve

```ts
const PRICE_CURVE: [availability, multiplier][] = [
  [1.00, 0.60],  // glut — 40% off baseline
  [0.80, 0.70],
  [0.60, 0.85],
  [0.40, 1.00],  // baseline
  [0.25, 1.50],
  [0.15, 2.50],
  [0.05, 3.50],
  [0.00, 5.00],  // shortage — 5× baseline
];
```

`spotPriceMultiplier(availability)` interpolates linearly between these points. Game updates the spot tier's `costPerUnit` each tick from this. Lifted directly from ai-tycoon's `compute-market.ts:16-39`.

## Headroom planning

`headroomMultiplier(utilization)` returns the safety factor for capacity-planning logic:

```ts
> 80% utilized → 1.8× target  (build aggressively before you choke)
> 60%          → 1.5×
> 40%          → 1.3×
otherwise      → 1.2×
```

Use it when deciding "how much new capacity should I commission?" Multiply current demand × `headroomMultiplier(currentUtilization)` to get the target.

## Wiring

```ts
import { fulfillDemand, spotPriceMultiplier } from 'opentycoonos/asset-models/multi-tier-production';

const tiers: ProductionTier[] = [
  { kind: 'owned',      label: 'Shenzhen Line 1', capacityPerTick: 3000, costPerUnit: 80, fixedCostPerTick: 25_000 },
  { kind: 'contracted', label: 'Foxconn deal',     capacityPerTick: 2000, costPerUnit: 110, fixedCostPerTick: 8_000 },
  { kind: 'spot',       label: 'Spot mfg',         capacityPerTick: 5000, costPerUnit: 180 * spotPriceMultiplier(0.4), fixedCostPerTick: 0 },
];

const { unitsProduced, totalCost, perTier, unmetDemand } = fulfillDemand(tiers, demandUnits);
state.cash -= totalCost;
state.inventory.units += unitsProduced;
```

## Design notes

- **Pure function.** No state, no mutation. Call every tick.
- **Allocation is greedy.** No LP, no shadow pricing — cheapest-first is what real ops teams roughly do anyway.
- **Fixed costs always accrue.** Even unused owned capacity costs you. That's the realism.
- **Spot ≠ infinite.** Spot tiers have a `capacityPerTick` cap too. Game updates this from a shared pool model if it wants supply scarcity.
- **No tier ordering required.** The allocator sorts internally.

## Out of scope

- Multi-good production (different products competing for shared capacity). For that, run multiple `fulfillDemand` calls and split capacity beforehand, or compose with `revenue-models/unit-sale`.
- Lead times on capex (own factories take months to build). Game tracks "pending" tiers that flip to active later — not the engine's job.
- Termination penalties for breaking contracted tiers. Game owns that lifecycle.

## Evidence

Lifted from `ai-tycoon/src/engine/compute-market.ts`:
- `getSpotPriceMultiplier` (lines 16-39) → `spotPriceMultiplier`
- `headroomMultiplier` (lines 44-49) → identical
- The `dcCost + contractCost + spotCost` allocation pattern (e.g. competitors.ts:144-148) → generalized into `fulfillDemand`.
