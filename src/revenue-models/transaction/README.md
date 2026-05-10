# Transaction — Usage/Event Revenue

**Status:** IMPLEMENTED `0.1.0-alpha.27`

Generic revenue accounting for businesses where each completed action earns money: rides, bookings, deliveries, tickets, payments, route legs, inspections, API calls, or reservations.

## What It Models

- Units × price revenue.
- Optional fixed fees and platform/take-rate fees.
- Variable cost per completed transaction.
- Last-tick and cumulative totals.
- Aggregates by transaction line, owner, and channel.

## Core API

```ts
const tx = createTransactionState<'ride'>();
recordTransaction(tx, {
  lineId: 'ride',
  units: 250,
  pricePerUnit: 18,
  variableCostPerUnit: 9,
});
```

Use this after `market-engine`, `marketplace`, `fleet`, or `perishable` resolves served demand.
