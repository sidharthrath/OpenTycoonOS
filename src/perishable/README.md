# Perishable — Time-bound inventory + yield management

**Status:** IMPLEMENTED (alpha.25)
**Used by:** airline (seat), hotel (room-night), event (ticket), cruise (cabin), restaurant (produce), grocery, ride-share surge

Inventory units that EXPIRE if unsold by a deadline. Drives yield-management pricing — price flexes based on actual sales pace vs. a forecast curve. Past expiry, unsold units become a permanent revenue loss tracked in the state.

The doomed-clock pattern: seats after takeoff = $0 forever. Hotel rooms past midnight = $0 forever. Concert tickets past showtime = $0 forever.

## Public API

```ts
import {
  PerishableBatch,
  ForecastCurve,
  PerishableState,
  DEFAULT_BOOKING_CURVE,
  createPerishableState,
  perishableResetPhase,
  perishableTickPhase,
  addBatch,
  applyYieldManagement,
  sellFromBatch,
  sellByProduct,
  expireBatches,
  aggregateLoadFactor,
} from 'opentycoonos/perishable';
```

## Pattern

1. **Game spawns batches** as units become available (e.g. each new flight is a batch with `expiryDay = departureDay`, `initialUnits = seats`, `basePrice = published fare`).
2. **Tick phase**: `perishableTickPhase(getState, getDay, sensitivity)` — expires past-deadline batches, applies yield management to active ones.
3. **Each tick that resolves demand**: `sellByProduct(state, productId, desired, day)` — sells from earliest-expiring batch first (FIFO by expiry), at each batch's `currentPrice`.
4. **Expired batches** accrue `lastTickRevenueLostToExpiry` — feed this into your reputation / forecast loop ("we left $X on the table").

## Yield management

For each active batch:
- Compute `expectedSold = forecastCurve(elapsed/total)` — typical airline curve is S-shaped (slow start, fat middle, sprint at end).
- Compute `actualSold = (initial - remaining) / initial`.
- `delta = actual - expected`. Positive = ahead of pace → raise price. Negative = behind → cut.
- `currentPrice = basePrice × clamp(1 + delta × sensitivity, [minMult, maxMult])`.

`sensitivity` is a tunable knob (default 0.4 = moderate). 0 disables yield management; 0.8 makes prices swing aggressively.

## Composes with

- `revenue-models/transaction` or `unit-sale` — record the actual sale post-`sellByProduct`.
- `events` — fuel-spike events can be modeled as last-minute fare-cap pressure.
- `seasonality` — game can scale `basePrice` per batch to match seasonal demand.

## Out of scope

- Multi-class capacity rebalancing (move seats from eco to business mid-flight) — game-specific.
- Overbooking models (sell more than capacity, take denied-boarding hits) — model in game.
- Group bookings / corporate contracts (negotiated rates outside the YM curve) — game wires its own.
- Per-passenger record (we model demand as aggregate units consumed).
