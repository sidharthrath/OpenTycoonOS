# revenue-models/pricing — Price response helpers

Use this for games where price changes should affect demand and churn, but the game still owns the market model.

## Core API

- `clampPrice(price, bounds)` — floor/ceiling helper.
- `recurringPriceDemandFactor(input)` — demand multiplier for monthly/recurring service prices.
- `upfrontPriceDemandFactor(input)` — demand multiplier for hardware, setup fees, cars, phones, tickets, or other upfront prices.
- `recurringPriceChurnPenalty(input)` — incremental churn from recurring price premiums.
- `unitMargin()` / `unitMarginPct()` — small UI/accounting helpers.

## Lessons

Orbital Networks exposed why this belongs in the engine: service price and terminal price are separate economic levers. A terminal sticker price should not move internal terminal cost, and a monthly service premium should hurt more in competitive, price-sensitive markets than in enterprise or aviation-style contracts.
