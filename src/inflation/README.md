# inflation — Cost drift helpers

**Status:** IMPLEMENTED (v0.1)
**Used by:** any game with time-varying costs, prices, or quantities

Generic helpers for time-indexed drift. Two distinct models, pick based on your cadence:

| Helper | Indexed by | Semantics | Use when |
|---|---|---|---|
| `getCostInflation(rate, year)` | Game year (1, 2, 3...) | Annual compound | Annual step-change budgets, content licensing rates that jump at renewal |
| `linearGrowth(base, rate, days)` | Day counter | Linear interpolation | Continuous per-day drift — catalog sizes, wages, market rates |

Use whichever matches your design intent. Compound feels "step-change at year boundaries"; linear feels "smooth curve between annual anchors."

## Public API

```ts
import {
  getCostInflation,
  inflateRange,
  linearGrowth,
  INFLATION_RATES,
} from 'opentycoonos/inflation';
```

### Functions

| Function | Purpose |
|---|---|
| `getCostInflation(annualRate, year)` | Compound multiplier; `(1 + rate)^(year - 1)` |
| `inflateRange([min, max], annualRate, year)` | Apply compound multiplier to a tuple, preserving spread |
| `linearGrowth(base, ratePerYear, daysElapsed)` | `base × (1 + rate × days / 364)` — linear per-day |

### Constants

`INFLATION_RATES`: common real-world rates (content 3.5%, hardware 2%, labor 4%, etc.) for quick calibration.

## Examples

```ts
// Compound: licensing fees jump at yearly renewal
const currentLicenseFee = BASE_FEE * getCostInflation(INFLATION_RATES.content, state.clock.year);

// Linear: catalog grows smoothly each tick
const currentCatalog = linearGrowth(
  label.baseCatalogHours,
  label.catalogGrowthPerYear,
  state.clock.totalDays,
);

// Linear: market rate drift for unsigned suppliers
const currentMarketRate = linearGrowth(
  supplier.baseRate,
  supplier.rateInflationPerYear,
  state.clock.totalDays,
);
```

## Design notes

- **Pure functions.** No state, no mutation.
- **Compound and linear DON'T converge** at year boundaries. At year 10 with 5% annual: compound = 1.629×, linear = 1.500×. Close but not identical — pick intentionally.
- **`year` is 1-indexed** for compound (Year 1 = multiplier 1.0, Year 2 = 1 + rate, etc.). Mirrors how humans talk about "Year 1 costs."
- **`daysElapsed` is 0-indexed** for linear (Day 0 = base value). Mirrors `tycoonos/clock`'s `totalDays`.
