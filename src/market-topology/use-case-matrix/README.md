# use-case-matrix — Segments × use cases competition

**Status:** IMPLEMENTED (v0.2)
**Used by:** any game where segments have heterogeneous needs with hard eligibility gates — streaming (background vs lossless vs commute), SaaS (individual vs team vs enterprise), retail (everyday vs luxury)

Composes with [`product-competition/`](../product-competition/README.md). Within a segment, demand is split across use cases; each use case has its **own hard eligibility gates**, budget ceiling, and scoring function. A product that fails a use case's gates gets **0%** of that use case — not a soft penalty.

Lifted + generalized from ai-tycoon's 9-product × 12-use-case matrix pattern.

## When to use

- Segments are too blunt — one "casuals" weighting doesn't capture that some casuals want commute listening and others want workout playlists.
- Tech unlocks should be gates, not bonuses — e.g., "no spatial-audio tech → ineligible for spatial use case."
- Different use cases have genuinely different price ceilings (same customer pays $10/mo for background chat, $300/mo for enterprise workflow).

If your game has no sub-need heterogeneity, stick with plain `competeForSegment`.

## Public API

```ts
import {
  competeAcrossUseCases,
  eligibleUseCases,
  type UseCase,
  type UseCaseMatrixOptions,
} from 'opentycoonos/market-topology/use-case-matrix';
```

### Types

```ts
interface UseCase<TAttrs, TSegmentId extends string = string> {
  id: string;
  /** Fraction of each segment that has THIS need. Sum across UCs ≤ 1.0. */
  segmentDistribution: Record<TSegmentId, number>;
  /** HARD gate — fails = 0% share for THIS use case. */
  isEligible: (product: CompetingProduct<TAttrs>) => boolean;
  /** Per-UC scoring — typically uses UC-specific weights. */
  scoreProduct: (product: CompetingProduct<TAttrs>) => number;
  /** Optional per-segment price ceiling for this UC. */
  budgetCap?: Record<TSegmentId, number>;
}

interface UseCaseMatrixOptions extends CompetitionOptions {
  segmentDemandPool: number;
}
```

### Functions

| Function | Purpose |
|---|---|
| `competeAcrossUseCases(products, segmentId, useCases, options)` | Per-UC competition; aggregates to a ShareResult weighted by UC distribution |
| `eligibleUseCases(product, segmentId, useCases)` | Which UCs the product can serve (UI: "eligible for 4/10 use cases") |

## Algorithm

For each use case:
1. Pool = `segmentDemandPool × uc.segmentDistribution[segment]` (skip if 0).
2. Build synthetic `CompetingSegment` with uc.scoreProduct + uc.isEligible + budgetCap.
3. Call `competeForSegment` → shares within THIS uc (fractions of ucPool).
4. Weight shares back by `distribution` to get fractions of segmentDemandPool.
5. Sum into aggregated result.

Shortfall (demand unclaimed by any product) = remainder after subtracting `totalDemand` from `segmentDemandPool`. Happens when: all products fail gates, budgets too high, distributions don't sum to 1.0.

## Example — streaming

```ts
const USE_CASES: UseCase<TierProductAttrs, StreamSegment>[] = [
  {
    id: 'lossless',
    segmentDistribution: { casual: 0.02, 'music-heads': 0.35, 'podcast-natives': 0.03 },
    isEligible: (p) => p.attrs.hasHiFiTech === true,        // tech gate
    scoreProduct: (p) =>
      0.60 * p.attrs.audioQualityScore
      + 0.30 * p.attrs.catalogScore
      + 0.10 * priceScore(p.price),
    budgetCap: { casual: 15, 'music-heads': 20, 'podcast-natives': 12 },
  },
  // ... 9 more use cases
];

const result = competeAcrossUseCases(
  products,
  'music-heads',
  USE_CASES,
  { segmentDemandPool: 150_000, sharpness: 2 },
);
// result.byProduct[p].share = fraction of segmentDemandPool allocated
```

## Design notes

- **Hard gates are the whole point.** Soft scoring doesn't force strategic tech choices. If you want strategic depth, make capabilities gate use cases.
- **Per-UC scoring weights matter.** Enterprise use cases might weight features 50%, price 15%; consumer use cases inverted.
- **Distribution > 1.0 is allowed** but shares will overlap (a sub in multiple UCs). For clean modeling, keep sum ≤ 1.0.
- **Shortfall as signal**: if 40% of a segment is unclaimed (totalDemand / pool = 0.6), that's actionable — player gains by building capabilities to serve those UCs.
- **Same product competes in multiple UCs** — each UC scores it independently. A hi-fi-tier Pro product might win "lossless" use case but tie on "background music" where quality doesn't matter.
