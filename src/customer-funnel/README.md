# customer-funnel — Pre-Market Awareness and Consideration

**Status:** IMPLEMENTED `0.1.0-alpha.30`

Pre-market demand formation for games that should not jump straight from market size to sales. This module answers:

> Of the reachable population, who knows this owner/product exists, and who is actively considering the category this tick?

It deliberately does **not** model a generic brand or reputation score. Games provide domain-specific drivers from their actual mechanics: routes served, catalog hits, uptime, press reach, referrals, sales access, pricing trust, delays, stockouts, or anything else the game can justify.

## What It Models

- Owner-specific awareness cohorts by segment and optional region.
- Exposure activities with reach, efficiency, memorability, saturation, fatigue, and cost readouts.
- Awareness decay and consideration staleness.
- Signed consideration drivers without hard-coded brand semantics.
- Segment/region audience summaries.
- `market-engine` pool creation from considering audiences.

## What It Does Not Model

- Post-purchase retention, churn, habit, or reactivation.
- Product choice among visible offers. Use `market-engine`.
- Revenue or CAC accounting. Pipe activity cost into `accounting/` or the game's finance phase.
- Universal brand/reputation. Use domain systems or `reputation/` only as event memory when useful.

## Core API

```ts
const funnel = createFunnelState({
  cohorts: [
    { ownerId: 'player', segmentId: 'premium', regionId: 'mumbai', reachablePopulation: 1_000_000 },
    { ownerId: 'rival-a', segmentId: 'premium', regionId: 'mumbai', reachablePopulation: 1_000_000 },
  ],
});

const result = runFunnelPhase(funnel, {
  activities: [
    {
      ownerId: 'player',
      segmentId: 'premium',
      regionId: 'mumbai',
      reach: 80_000,
      efficiency: 0.8,
      memorability: 0.35,
      cost: 120_000,
    },
  ],
  considerationDrivers: [
    { ownerId: 'player', segmentId: 'premium', regionId: 'mumbai', pull: 0.04, reason: 'airport-presence' },
    { ownerId: 'rival-a', segmentId: 'premium', regionId: 'mumbai', pull: 0.02, reason: 'incumbent-distribution' },
  ],
});

const pools = createFunnelMarketPools(result, {
  scoreOffer: (offer) => offer.attrs.quality,
  attrsForAudience: audience => ({ segmentId: audience.segmentId, regionId: audience.regionId }),
});
```

## Design Notes

Awareness is owner-specific, but demand is not handed directly to that owner. `createFunnelMarketPools` aggregates owner-level consideration into segment/region pools and passes owner consideration shares as `ownerBoosts` to `market-engine`. That keeps competitors in the arena while still giving visible/known owners a realistic advantage.

The module is cohort-based on purpose. Cohorts are inspectable, cheap to save, and easier to balance than individual customers, while still preserving memory through awareness, consideration, fatigue, and cumulative exposure.
