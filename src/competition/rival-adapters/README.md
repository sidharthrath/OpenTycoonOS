# Rival Adapters — Standard Rival Integration

**Status:** IMPLEMENTED `0.1.0-alpha.28`

`rival-sim` owns cadence, pressure, health, and action orchestration. This module provides the reusable glue that lets rivals participate in the rest of TycoonOS without each game writing the same adapter code.

## What It Connects

- Rival-owned `market-engine` offers.
- Market results into rival economics.
- Shared pricing policies.
- Capacity expansion decisions.
- Funding decisions.
- Market-entry decisions.
- Optional balance-sheet spread income/cost.

## Core API

```ts
const offers = buildRivalOffers(state, {
  getRivals: (s) => s.rivals,
  getTemplates: (_, rival) => rival.meta.routes,
  getPrice: (_, rival, route) => rival.meta.prices[route.id],
  getCapacity: (_, rival, route) => rival.meta.capacity[route.id],
});

const model = simpleRivalOperatingModel({
  getMarketResult: (s) => s.market,
  getPricePerUnit: (_, rival) => rival.meta.avgPrice,
  getVariableCostPerUnit: (_, rival) => rival.meta.unitCost,
  getCapacity: (_, rival) => rival.meta.capacity,
  pricing: createYourPricingConfig(),
  capacityInvestment: createYourCapacityConfig(),
  funding: {},
});
```

The engine decides when a rival should reprice, add capacity, enter a market, or raise funding. The game still owns domain mutation, for example whether adding capacity means leasing aircraft, buying GPUs, opening stores, or building towers.
