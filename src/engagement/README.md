# engagement — Engagement allocation, loyalty, and breadth multipliers

**Status:** IMPLEMENTED (v0.2)
**Used by:** any game where users have a finite engagement budget (hours/month) split across multiple content categories whose supply you can grow

Three related helpers:
1. **`allocateEngagement`** — splits a total engagement budget across categories by supply (softmax).
2. **`loyaltyFromEngagement`** — maps measured engagement hours to a loyalty multiplier for the market engine's `loyaltyBoosts` (habit-formed users stay).
3. **`breadthMultiplier`** — maps content-breadth signals to an engagement-budget multiplier (more breadth → more hours consumed).

Original purpose: the "if I have more podcasts, listeners shift hours from music to podcasts" pattern. Generalized from the Spotify-shape margin mechanic — but applies to any platform where:
- Users have bounded total engagement (X hours/month per tier)
- That engagement gets split across content categories based on supply
- Different categories have different cost-of-serve
- More breadth grows the budget (via `breadthMultiplier`) + retention (via `loyaltyFromEngagement`)

## When to use

- Multiple content categories competing for user attention (music vs podcasts vs audiobooks; short-form vs long-form video; news vs entertainment vs sports).
- Content supply differs per category and you want supply to *attract* hours.
- Different categories have different cost structures (per-play royalties vs flat licensing vs zero variable cost).

If your game just has total time and one cost-per-play, skip this — multiply outside.

## Public API

```ts
import {
  EngagementCategory,
  EngagementProfile,
  EngagementOptions,
  EngagementResult,
  allocateEngagement,
  totalHoursAllocated,
  shareByCategory,
} from 'opentycoonos/engagement';
```

### Types

```ts
interface EngagementCategory {
  id: string;
  /**
   * Supply signal — how much content you have in this category.
   * Game-defined. Could be: hours of catalog, # of items, $ invested.
   * Higher = more pull on listener-hours.
   */
  supplySignal: number;
  /**
   * Per-sub per-month cap on hours this category can absorb.
   * Reflects "even with unlimited supply, no one listens to 200hr/month of audiobooks."
   */
  capPerSubPerMonth: number;
}

interface EngagementProfile {
  /** Total hours per sub per month available across all categories. */
  totalHoursPerSubPerMonth: number;
  /**
   * Power-curve exponent on supply signal when allocating share.
   * 1.0 = linear; 1.5+ = winner-take-most (popular categories pull harder).
   * Default 1.2.
   */
  sharpness?: number;
}

interface EngagementOptions {
  subscribers: number;
  daysInTick: number;
}

interface EngagementResult {
  /** Allocated engagement hours by category for this tick. */
  hoursByCategory: Record<string, number>;
  /** Sum across categories. */
  totalHours: number;
}
```

### Functions

| Function | Purpose |
|---|---|
| `allocateEngagement(categories, profile, options)` | Allocate `subscribers × hours × days/30` across categories |
| `totalHoursAllocated(result)` | Sum of all category hours |
| `shareByCategory(result)` | Hours per category as a fraction of total (0-1) |
| `loyaltyFromEngagement(hoursPerSubPerMonth, config)` | Map engagement to loyalty multiplier (1.0–maxBonus) |
| `breadthMultiplier(terms)` | Map content-breadth terms to engagement-budget multiplier |

### Breadth multiplier

```ts
interface BreadthTerm {
  signal: number;
  weight: number;
  saturationPoint?: number;  // optional; default 1 (ratio already normalized)
}

breadthMultiplier([
  { signal: musicCoverage,     weight: 0.50 },                   // 0-1 coverage
  { signal: podcastSupply,     weight: 0.40, saturationPoint: 300 },  // unbounded supply
  { signal: audiobookCoverage, weight: 0.25 },                   // 0-1 coverage
]) → 1 + Σ normalized × weight   // max = 1 + Σ weights
```

Each term normalizes against its `saturationPoint` (or clamped to [0,1] if no saturation given), scales by weight, sums onto baseline 1.

**Use for:** "more breadth = more performance" dynamics — streaming engagement, supply-chain throughput diversity, R&D productivity from tech coverage, etc.

### Engagement → loyalty

```ts
loyaltyFromEngagement(
  state.lastTickHoursPerSubMonthly,
  { baseBonus: 1.05, maxBonus: 1.35, fullEngagementHours: 120 },
) → multiplier between baseBonus and maxBonus
```

Habit-formed users stay. Pass the result as `loyaltyBoosts` to the market engine's `competeForSegment` for per-platform incumbent inertia.

## How allocation works

For each category:

1. Compute `weight_i = supplySignal_i ^ sharpness`.
2. `share_i = weight_i / Σ weight_j`.
3. `desiredHours_i = share_i × totalHours × subscribers × daysInTick / 30`.
4. `cap_i = capPerSubPerMonth × subscribers × daysInTick / 30`.
5. `hours_i = min(desiredHours_i, cap_i)`.

Caps prevent unrealistic allocation (a category can't absorb more hours than its cap regardless of supply). Excess "demand" beyond a cap doesn't redistribute — it just doesn't get listened to (player loses potential cost-of-serve / ad-revenue).

## Wiring with `multi-tier-production`

This module pairs perfectly with `multi-tier-production` for cost-of-serve modeling. Engagement says *how many hours per category*; multi-tier-production says *what does each hour cost*:

```ts
import { allocateEngagement } from 'opentycoonos/engagement';
import { fulfillDemand } from 'opentycoonos/asset-models/multi-tier-production';

// Step 1: how many hours land in each category?
const engagement = allocateEngagement(
  [
    { id: 'music', supplySignal: state.catalog.musicSize, capPerSubPerMonth: 60 },
    { id: 'podcast', supplySignal: state.catalog.podcastSize, capPerSubPerMonth: 30 },
  ],
  { totalHoursPerSubPerMonth: 80, sharpness: 1.2 },
  { subscribers: state.subscriptions.tiers.pro.subscribers, daysInTick: 1 },
);

// Step 2: cost-of-serve for music hours pulls from per-play royalty pool
const musicHours = engagement.hoursByCategory.music ?? 0;
const musicPlays = musicHours * AVG_PLAYS_PER_HOUR;
const musicCost = fulfillDemand(
  [
    // Music = pure spot tier (per-play royalty, no fixed)
    { kind: 'spot', capacityPerTick: Infinity, costPerUnit: 0.005, fixedCostPerTick: 0 },
  ],
  musicPlays,
);

// Podcasts = mostly owned (originals) + contracted (licensed exclusives)
const podcastHours = engagement.hoursByCategory.podcast ?? 0;
const podcastCost = fulfillDemand(
  [
    { kind: 'owned', capacityPerTick: state.catalog.ownedPodcastHours, costPerUnit: 0, fixedCostPerTick: state.catalog.ownedPodcastDailyAmortization },
    { kind: 'contracted', capacityPerTick: state.catalog.licensedPodcastHours, costPerUnit: 0, fixedCostPerTick: state.catalog.licensedPodcastDailyAmortization },
  ],
  podcastHours,
);
```

This is **the Spotify squeeze in three lines.** Adding more podcasts (raising `state.catalog.podcastSize`) shifts engagement hours away from music, lowering per-play royalty cost. The strategic question becomes "how aggressively do I invest in podcast supply to relieve music margin pressure?"

## Design notes

- **Pure functions.** No state, no mutation. Pass categories + profile per tick.
- **Caps are crucial.** Without them, supply alone determines allocation, and one over-stocked category gobbles all hours. Real users have category-specific tolerance.
- **Sharpness > 1 makes leaders pull harder.** Spotify-shape: discovery + algorithm rewards have sharpness > 1; egalitarian platforms (Bandcamp) closer to 1.
- **`subscribers` is the multiplier.** Different tiers can have different profiles — call `allocateEngagement` once per tier.
- **`totalHoursPerSubPerMonth` is per-tier behavior.** Pro subs typically 2-3× free subs. Game owns the per-tier number.

## Out of scope

- Hour-budget growth over time (e.g., users discover the platform and listen more in month 6 than month 1). Game can dynamically scale `totalHoursPerSubPerMonth`.
- Cross-tier substitution (free users upgrading to pro because they hit ad limits). Game owns the funnel logic; this module just allocates *given* the tier mix.
- Recommendation-quality boost (better algorithm = users listen more). Bake into `totalHoursPerSubPerMonth` based on game's algo investment.
- Per-day-of-week / per-hour-of-day patterns. Out of scope; modify daysInTick or scale supply signal.

## Evidence

Built directly from the Spotify-shape margin pattern — adding podcasts shifts hours off per-play music royalties. Generalizes to any platform where supply attracts engagement and engagement → cost. Useful for: streaming (music/podcast/video), social (short-form/long-form/live), news (sports/politics/entertainment), gaming (multiplayer/single-player/spectator).
