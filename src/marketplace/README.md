# Marketplace — Two-sided Platform Dynamics

**Status:** IMPLEMENTED `0.1.0-alpha.27`
**Used by:** food delivery, Amazon, dating, Airbnb, Uber, talent agency, hotel booking, payment processor

Separate supply-side and demand-side pools. Matching determines completed transactions; take-rate drives platform revenue.

## Core API

```ts
const result = matchMarketplace({
  supply: { units: 120, quality: 0.9 },
  demand: { units: 180, trust: 0.8 },
  pricePerMatch: 22,
  takeRate: 0.18,
});
```

## What It Models

- Supply/demand balance and fill rate.
- Liquidity friction from quality/trust.
- Network-effect multiplier from two-sided scale.
- GMV, platform revenue, supplier revenue, unmet demand, and idle supply.

Use `transaction` to record completed matches into game finances.
