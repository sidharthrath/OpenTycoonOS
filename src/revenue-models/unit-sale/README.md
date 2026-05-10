# revenue-models/unit-sale — Discrete unit sales

**Status:** IMPLEMENTED (v0.1, promoted from v0.2 roadmap slot to satisfy Shenzhen Phone Tycoon)
**Used by:** games with discrete-unit revenue — EV, consumer electronics, fashion, craft brewery, game studio, etc.

Records discrete unit sales (phones shipped, cars sold, games released) with per-product aggregates, cumulative totals, and last-tick slices that pipe cleanly into `financialPhase`.

## Public API

```ts
import {
  UnitSaleState,
  UnitSaleLine,
  UnitSaleProductAggregate,
  createUnitSaleState,
  recordSale,
  recordSales,
  resetTickAggregates,
  grossProfit,
  grossMargin,
  lastTickNet,
  unitSaleResetPhase,
} from 'opentycoonos/revenue-models/unit-sale';
```

### Types

```ts
interface UnitSaleLine {
  productId: string;        // SKU, model key, tier name — game's choice
  units: number;
  pricePerUnit: number;
  costPerUnit: number;      // COGS per unit (variable cost only)
}

interface UnitSaleState {
  cumulativeUnits: number;
  cumulativeRevenue: number;
  cumulativeCOGS: number;
  lastTickUnits: number;
  lastTickRevenue: number;
  lastTickCOGS: number;
  byProduct: Record<string, UnitSaleProductAggregate>;
}
```

### Functions

| Function | Purpose |
|---|---|
| `createUnitSaleState()` | Fresh zeroed state |
| `recordSale(state, line)` | Record one sale; updates cumulative, last-tick, and per-product slices |
| `recordSales(state, lines)` | Bulk version |
| `resetTickAggregates(state)` | Zero just the last-tick fields. Call at tick start |
| `grossProfit(state)` | All-time revenue − COGS |
| `grossMargin(state)` | All-time gross margin, 0-1 (0 if no revenue) |
| `lastTickNet(state)` | Last-tick revenue − COGS |
| `unitSaleResetPhase(getState)` | `TickPhase<S>` that resets at tick start |

## Wiring into a tick

```ts
import { composeTick, clockPhase, financialPhase } from 'opentycoonos/tick';
import { unitSaleResetPhase, recordSale } from 'opentycoonos/revenue-models/unit-sale';

const productionPhase: TickPhase<State> = (state) => {
  const unitsThisTick = /* computed from factory capacity, demand, etc. */;
  recordSale(state.unitSales, {
    productId: 'phone-flagship',
    units: unitsThisTick,
    pricePerUnit: 580,
    costPerUnit: 320,
  });
};

const gameTick = composeTick<State>([
  clockPhase({ maxYears: 10 }),
  unitSaleResetPhase(s => s.unitSales),  // reset last-tick at start
  productionPhase,                        // record sales
  perkPhase({ ... }),
  financialPhase(
    { minOwnership: 0.1 },
    s => s.unitSales.lastTickRevenue,     // cash in
    s => s.unitSales.lastTickCOGS + otherOpex(s),  // cash out
  ),
]);
```

Order matters:
1. **Reset** (unitSaleResetPhase) — zero last-tick fields
2. **Record** (game-specific phase) — populate them
3. **Settle** (financialPhase) — read them into cash flow

## Design notes

- **Zero opinion on product shape.** `productId` is a string. The game decides whether it's a SKU, a tier, a genre, or a route.
- **Per-product aggregates are cumulative only.** `byProduct[id]` never resets — it's all-time. For per-tick per-product breakdowns, games compute inline.
- **Fractional units allowed.** `units: number` (not int). Lets games express e.g. "0.4 boxes of yield" from a production line without rounding pain.
- **Costs are variable only.** `costPerUnit` is COGS per-unit. Fixed opex (rent, salaries, marketing) is the game's responsibility, typically piped into `financialPhase`'s `getBurn` alongside `lastTickCOGS`.
- **No warranty / service-tail tracking yet.** Deferred to v0.3 when `perishable/` and `loyalty/` land. Games that need warranty reserves can compute inline for now.

## Out of scope

- **Returns / refunds.** If a game needs them, model as negative-unit sales (e.g. `{units: -5, price, cost}`). If this becomes common, we'll add a first-class `recordReturn` helper.
- **Multi-currency.** State is single-currency; games handle FX at their boundary.
- **Taxes.** Handled by the game at the financialPhase level if needed.
- **Deferred revenue.** Unit sales recognize on the tick they're recorded. Games needing revenue-recognition schedules (e.g. warranty-tail amortization) can maintain a separate deferred-revenue state and burn it off gradually.

## Evidence

Extracted directly from Shenzhen Phone Tycoon's need for cumulative phone-unit sales + per-tier breakdown + clean integration with financialPhase. The 3-level state design (cumulative + last-tick + per-product) mirrors what ai-tycoon's compute-market.ts does informally.
