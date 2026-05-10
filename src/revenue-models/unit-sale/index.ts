// TycoonOS — Unit-sale revenue model
// Tracks discrete unit sales (phones shipped, cars sold, beers poured) with
// per-product aggregates, cumulative totals, and last-tick slices that pipe
// cleanly into `financialPhase`'s `getRevenue` / `getBurn` callbacks.
//
// Zero opinion on what a "product" is. Games identify products by any string id
// (SKU, model code, tier key, genre name, etc.). The module just counts units,
// multiplies by prices + costs, and keeps the math honest.

import type { TickPhase } from '../../tick/index.js';

/**
 * One line item — records that `units` of `productId` sold at `pricePerUnit`
 * with `costPerUnit` COGS. Aggregate multiple lines per tick if the game sells
 * across multiple products.
 */
export interface UnitSaleLine {
  /** Game-defined product id (SKU, model key, tier name, etc.). */
  productId: string;
  /** Number of units sold in this line. Can be fractional for partial-unit flows. */
  units: number;
  /** Price per unit in game currency. */
  pricePerUnit: number;
  /** Cost of goods per unit (variable cost). Does not include fixed opex. */
  costPerUnit: number;
}

/**
 * Per-product cumulative tally. Useful for reporting (ranking products by
 * revenue, etc.) and for per-tier analysis (flagship vs mid vs budget).
 */
export interface UnitSaleProductAggregate {
  units: number;
  revenue: number;
  cogs: number;
}

/**
 * Runtime state. Put one of these on your game state; the engine reads and
 * mutates through `recordSale` / `resetTickAggregates`.
 */
export interface UnitSaleState {
  /** All-time totals across all products. */
  cumulativeUnits: number;
  cumulativeRevenue: number;
  cumulativeCOGS: number;
  /**
   * Amounts recorded *since last reset*. Games should reset at tick start
   * (see `unitSaleResetPhase`) and wire the last-tick figures into
   * `financialPhase`'s revenue/burn callbacks.
   */
  lastTickUnits: number;
  lastTickRevenue: number;
  lastTickCOGS: number;
  /** Per-product cumulative breakdown. */
  byProduct: Record<string, UnitSaleProductAggregate>;
}

/** Create fresh state with all counters at zero. */
export function createUnitSaleState(): UnitSaleState {
  return {
    cumulativeUnits: 0,
    cumulativeRevenue: 0,
    cumulativeCOGS: 0,
    lastTickUnits: 0,
    lastTickRevenue: 0,
    lastTickCOGS: 0,
    byProduct: {},
  };
}

/**
 * Record a single sale line. Mutates state (Immer-draft compatible).
 * Updates both cumulative totals and last-tick aggregates, plus the per-product
 * slice in `byProduct`.
 */
export function recordSale(state: UnitSaleState, line: UnitSaleLine): void {
  const revenue = line.units * line.pricePerUnit;
  const cogs = line.units * line.costPerUnit;

  state.cumulativeUnits += line.units;
  state.cumulativeRevenue += revenue;
  state.cumulativeCOGS += cogs;

  state.lastTickUnits += line.units;
  state.lastTickRevenue += revenue;
  state.lastTickCOGS += cogs;

  const existing = state.byProduct[line.productId];
  if (existing) {
    existing.units += line.units;
    existing.revenue += revenue;
    existing.cogs += cogs;
  } else {
    state.byProduct[line.productId] = { units: line.units, revenue, cogs };
  }
}

/**
 * Record multiple sale lines in one call. Convenient when a tick produces
 * a full SKU-sales table at once.
 */
export function recordSales(state: UnitSaleState, lines: readonly UnitSaleLine[]): void {
  for (const line of lines) recordSale(state, line);
}

/**
 * Zero the last-tick aggregates. Call at the START of each tick so
 * `lastTickRevenue` / `lastTickCOGS` reflect only the current tick's activity.
 * Cumulative totals are untouched.
 */
export function resetTickAggregates(state: UnitSaleState): void {
  state.lastTickUnits = 0;
  state.lastTickRevenue = 0;
  state.lastTickCOGS = 0;
}

/** All-time gross profit (cumulativeRevenue − cumulativeCOGS). */
export function grossProfit(state: UnitSaleState): number {
  return state.cumulativeRevenue - state.cumulativeCOGS;
}

/**
 * All-time gross margin (0–1). Returns 0 when no revenue has been recorded
 * (avoids division-by-zero; callers display as "—" when `cumulativeRevenue` is 0).
 */
export function grossMargin(state: UnitSaleState): number {
  if (state.cumulativeRevenue <= 0) return 0;
  return grossProfit(state) / state.cumulativeRevenue;
}

/** Last-tick net (revenue − COGS). Useful for per-tick P&L readouts. */
export function lastTickNet(state: UnitSaleState): number {
  return state.lastTickRevenue - state.lastTickCOGS;
}

/**
 * TickPhase factory — resets last-tick aggregates at the start of a tick.
 * Place FIRST in your composeTick(...) (after clockPhase) so sales recorded
 * by later phases hit a fresh slate, and `financialPhase` reads
 * only-this-tick totals.
 *
 * @example
 *   composeTick<State>([
 *     clockPhase({ maxYears: 10 }),
 *     unitSaleResetPhase(s => s.unitSales),
 *     productionPhase,              // records sales via recordSale()
 *     perkPhase({ ... }),
 *     financialPhase(
 *       { minOwnership: 0.1 },
 *       s => s.unitSales.lastTickRevenue,
 *       s => s.unitSales.lastTickCOGS + otherOpex(s),
 *     ),
 *   ]);
 */
export function unitSaleResetPhase<S>(getUnitSaleState: (s: S) => UnitSaleState): TickPhase<S> {
  return (state) => {
    resetTickAggregates(getUnitSaleState(state));
  };
}
