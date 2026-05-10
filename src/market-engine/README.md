# `market-engine`

Generic market clearing for TycoonOS games.

## Status

`0.1.0-alpha.26` — first solid engine-level resolver. This module is intentionally domain-blind: games define offers, demand pools, gates, and scoring; TycoonOS resolves demand consistently and returns explainable diagnostics.

## Why This Exists

The older engine had useful market-adjacent bricks: product competition, use-case gates, geographic state, network capacity, pricing response, company simulation, perishable inventory. What was missing was the middle layer every game kept reinventing:

```
demand pool -> eligibility gates -> scored offers -> allocation -> capacity clamp -> unmet demand diagnostics
```

This module owns that loop.

## Core Concepts

- `MarketOffer` — a product, route, service tier, vehicle service, SKU, contract option, or any other thing customers can choose.
- `MarketPool` — a demand bucket such as a segment, region, use case, cabin bucket, walk-up flow, renewal pool, or enterprise contract pool.
- `scoreOffer` — game-owned scoring. TycoonOS does not know what quality, OTP, catalog depth, latency, or brand mean.
- `isEligible` — hard gates. A non-licensed region, over-budget product, missing capability, wrong cabin, or no route can get zero share.
- `capacity` — max demand an offer can serve across all pools in this resolution.
- `MarketResult` — served demand, actual unmet demand, per-owner/offer summaries, per-pool allocations, and score diagnostics.

## Example

```ts
import { resolveMarket, type MarketOffer, type MarketPool } from 'opentycoonos/market-engine';

type Attrs = { quality: number; brand: number };

const offers: MarketOffer<Attrs>[] = [
  { id: 'player-phone', ownerId: 'player', price: 399, capacity: 1200, attrs: { quality: 72, brand: 28 } },
  { id: 'rival-flagship', ownerId: 'rival-a', price: 799, attrs: { quality: 84, brand: 78 } },
];

const pools: MarketPool<Attrs>[] = [
  {
    id: 'value-buyers',
    demand: 5000,
    budgetCap: 450,
    scoreOffer: (offer) => ({
      score: offer.attrs.quality * 0.35 + (100 - (offer.price ?? 0) / 4.5) * 0.5 + offer.attrs.brand * 0.15,
      components: { quality: offer.attrs.quality, brand: offer.attrs.brand },
    }),
  },
];

const result = resolveMarket(offers, pools, { sharpness: 1.6 });
```

## Design Rules

- The engine does not mutate game state. Games consume `MarketResult` and decide how to apply sales, churn, waitlists, loyalty, revenue, cost, or press.
- Capacity is shared across pools in the order pools are supplied. If priority matters, order pools intentionally.
- Demand that cannot be served is explicit as `unmetDemand`; it should never silently disappear.
- Owner/offer summaries use `unmetPreferredDemand` for demand they would have won before capacity constraints; market and pool results use `unmetDemand` for demand nobody served.
- Score components are optional but strongly encouraged for UI/debug panels.
- Use `ownerBoosts` and `incumbencyBoost` for loyalty, lock-in, brand inertia, or local advantage. Use hard gates for true impossibilities.

## Relationships

- `market-topology/product-competition` and `market-topology/use-case-matrix` remain useful lower-level/simple helpers.
- `market-engine` is the preferred clean-slate resolver for new games.
- `revenue-models/pricing` can produce price demand/churn factors that feed into `scoreOffer` or pool demand.
- `market-topology/network`, `perishable`, and `asset-models/inventory` can produce offer capacities.
