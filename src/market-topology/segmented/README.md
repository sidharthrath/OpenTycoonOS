# Segmented — Demographic/Psychographic Markets

**Status:** IMPLEMENTED `0.1.0-alpha.28`

Segmented market topology for games where demand is split into user/customer groups: casual vs premium streamers, hobbyist vs enterprise AI users, budget vs luxury shoppers, free vs paid social users.

## What It Models

- Segment population, awareness, adoption, and addressable users.
- Product share scoring with softmax-style target shares.
- Use-case share aggregation.
- Sticky movement from current share toward target share.
- Willingness-to-pay budget caps and price multipliers.
- Composite owner/variant keys for multi-product competition.

## Core API

```ts
import {
  createSegment,
  tickSegments,
  calculateTargetShares,
  aggregateShares,
  blendShares,
  getBudgetCap,
  wtpMultiplier,
} from 'opentycoonos/market-topology/segmented';
```

For richer N-product x M-use-case eligibility gates, compose this module with `market-topology/use-case-matrix` or the newer `market-engine` demand resolver.
