# asset-models/inventory — Factories + stock + obsolescence

**Status:** IMPLEMENTED (v0.1, pulled from v0.2 roadmap)
**Used by:** any game that produces and stocks discrete goods — phones, cars, beer, CPG, fashion

Producer-side of the physical-goods loop. Factories have fixed capacity → allocated across SKUs → production flows into `InventoryState.lots` → games pull from lots via `sellFromInventory` and pipe the COGS into `unit-sale` + `financialPhase`.

## Public API

```ts
import {
  FactoryState,
  FactoryAllocation,
  InventoryLot,
  InventoryState,
  createInventoryState,
  addFactory,
  createFactory,
  totalCapacity,
  totalUpkeepPerTick,
  unitsOnHand,
  totalUnitsOnHand,
  addToInventory,
  sellFromInventory,
  produceFromFactory,
  produceAll,
  ageInventory,
  writeDownObsolete,
  resetTickAggregates,
  applyUpkeep,
  inventoryResetPhase,
  productionPhase,
  type ProductionPhaseConfig,
} from 'opentycoonos/asset-models/inventory';
```

### Types

```ts
interface FactoryState {
  id: string;
  name: string;
  capacity: number;             // units/tick total across allocations
  upkeepPerTick: number;        // flat per-tick opex
  allocations: FactoryAllocation[];
}

interface FactoryAllocation {
  skuId: string;
  share: number;                // 0-1 share of capacity
  costPerUnit: number;          // COGS
}

interface InventoryLot {
  skuId: string;
  units: number;
  totalCostBasis: number;       // for weighted-avg COGS + write-downs
  ageDays: number;              // obsolescence driver
}

interface InventoryState {
  factories: FactoryState[];
  lots: Record<string, InventoryLot>;
  lastTickWriteDowns: number;   // per-tick; cleared by reset phase
  cumulativeWriteDowns: number; // all-time
  lastTickUpkeep: number;       // per-tick; cleared by reset phase
  cumulativeUpkeep: number;     // all-time
}
```

### Standard tick order

```ts
composeTick<State>([
  clockPhase({ maxYears: 10 }),
  inventoryResetPhase(s => s.inventory),
  unitSaleResetPhase(s => s.unitSales),
  productionPhase({ getInventoryState: s => s.inventory, daysPerTick: 1 }),
  // game-specific sales phase uses sellFromInventory → recordSale
  demandPhase,
  // events, perks, etc.
  financialPhase(
    { minOwnership: 0.1 },
    s => s.unitSales.lastTickRevenue,
    s => s.unitSales.lastTickCOGS + s.inventory.lastTickUpkeep + s.inventory.lastTickWriteDowns + otherOpex(s),
  ),
]);
```

The module deliberately splits:
- **reset** (clear per-tick counters)
- **production + aging + upkeep** (add to lots, age them, charge upkeep)
- **sales** (game-specific — pulls from lots via sellFromInventory)
- **write-downs** (game calls `writeDownObsolete` at launch / year-end / as needed)
- **settle** (financialPhase reads aggregates)

### Game-specific demandPhase pattern

The engine doesn't own demand — games compute how many units of each SKU to sell, based on price, segment, marketing, etc. Then:

```ts
const demandPhase: TickPhase<State> = (state) => {
  for (const sku of state.skus) {
    const demand = computeDemandForSku(state, sku); // game's formula
    const { unitsSold, cogsTotal } = sellFromInventory(state.inventory, sku.id, demand);
    if (unitsSold > 0) {
      recordSale(state.unitSales, {
        productId: sku.id,
        units: unitsSold,
        pricePerUnit: sku.price,
        // Use aggregate COGS from the lot's weighted-avg basis:
        costPerUnit: cogsTotal / unitsSold,
      });
    }
  }
};
```

`sellFromInventory` returns `cogsTotal` derived from the lot's weighted-avg cost basis so games don't need to track per-batch COGS themselves.

## Design notes

- **One lot per SKU.** New production merges into the existing lot; the lot's age is a weighted average that dilutes toward 0 as fresh stock arrives. Avoids allocating N lots for N production runs. Games needing strict FIFO can extend.
- **Age is days, not ticks.** `ageInventory(days)` lets games with monthly-cadence ticks age correctly (pass 30 per tick if `DAYS_PER_TICK = 30`).
- **Obsolescence is game-driven.** `writeDownObsolete` is called explicitly by the game (at launch events, year-end cleanup, etc.) — engine doesn't auto-obsolete. Games that want age-based auto-obsolescence pass `obsoleteAfterDays` and call it from their phase.
- **Upkeep vs COGS.** Factory upkeep is flat opex (rent, base wages, utilities). COGS is variable per unit. `financialPhase`'s `getBurn` callback combines both: `lastTickCOGS + lastTickUpkeep + lastTickWriteDowns`.
- **Capacity is the only production gate.** Demand can exceed capacity (player has stockouts); the module allows whatever the game chooses.
- **Allocation shares ≤ 1 is caller's contract.** Engine doesn't renormalize; games either normalize before assignment or tolerate idle capacity.

## Out of scope (v0.1 pull-forward)

- **FIFO / LIFO cost tracking.** Weighted-average only.
- **Raw-material cost curves.** `costPerUnit` is a fixed number passed by the game; dynamic COGS curves (economies of scale, inflation) are the game's responsibility (layer via `inflation/` module).
- **Per-factory per-SKU quality.** Games can layer this via SKU definition or factory meta; the inventory module treats SKUs opaquely.
- **Capacity expansion mechanics.** Games add/upgrade factories by mutating `state.factories` directly.

## Evidence

Shenzhen Phone Tycoon's need for real production rates (replacing the `shipmentsPerTick: 50` stub). Intended to also cover future EV Tycoon, Craft Brewery Tycoon, Consumer Electronics Tycoon — any game where "factories you build + SKUs you stock" is the production loop.
