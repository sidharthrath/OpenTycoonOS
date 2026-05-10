// TycoonOS — Inventory + production (factory-capacity) asset model
// Generic physical-goods production scaffolding: factories with fixed capacity,
// SKU inventory on hand, obsolescence write-downs. Games wire their unit-sale
// flow to pull from inventory; this module owns the producer-side of goods.
//
// Composes cleanly with tycoonos/revenue-models/unit-sale on the sales side —
// produce (here) adds units to inventory, sellFromInventory deducts them and
// returns revenue line items that unit-sale records.

import type { TickPhase, TickContext } from '../../tick/index.js';

// ─── Types ───────────────────────────────────────────────────────────────

/** A production facility. Contributes units/tick split across assigned SKUs. */
export interface FactoryState {
  id: string;
  name: string;
  /** Total units-per-tick this factory can produce across all allocated SKUs. */
  capacity: number;
  /** Flat per-tick operating cost in game currency. */
  upkeepPerTick: number;
  /**
   * Production allocation as shares of capacity per SKU. Shares should sum to
   * ≤ 1; any under-allocation is idle capacity. The engine doesn't enforce
   * `sum ≤ 1` — callers should normalize.
   */
  allocations: FactoryAllocation[];
}

/** One SKU's share of a factory's capacity. */
export interface FactoryAllocation {
  skuId: string;
  /** Share of capacity, 0–1. */
  share: number;
  /** Cost-per-unit COGS for this SKU. Games set this; production records it. */
  costPerUnit: number;
}

/** A bucket of units of one SKU sitting in inventory. */
export interface InventoryLot {
  skuId: string;
  units: number;
  /** Sum of per-unit COGS × units — used for obsolescence write-downs. */
  totalCostBasis: number;
  /** Age in days, increments by `ageInventory`. */
  ageDays: number;
}

/** Per-game-state inventory slice. */
export interface InventoryState {
  factories: FactoryState[];
  /** Lots keyed by SKU id. One lot per SKU (merged on production). */
  lots: Record<string, InventoryLot>;
  /** Dollar value of write-downs this tick (cleared each tick by inventoryResetPhase). */
  lastTickWriteDowns: number;
  /** All-time cumulative write-downs. */
  cumulativeWriteDowns: number;
  /** Dollar value of upkeep paid this tick (cleared each tick). */
  lastTickUpkeep: number;
  /** All-time cumulative upkeep paid. */
  cumulativeUpkeep: number;
}

// ─── Factory helpers ────────────────────────────────────────────────────

export function createFactory(input: {
  id: string;
  name: string;
  capacity: number;
  upkeepPerTick: number;
  allocations?: FactoryAllocation[];
}): FactoryState {
  return {
    id: input.id,
    name: input.name,
    capacity: input.capacity,
    upkeepPerTick: input.upkeepPerTick,
    allocations: input.allocations ?? [],
  };
}

/** Total capacity across all factories — the "shipments per tick" ceiling. */
export function totalCapacity(state: InventoryState): number {
  let total = 0;
  for (const f of state.factories) total += f.capacity;
  return total;
}

/** Total upkeep across all factories per tick. */
export function totalUpkeepPerTick(state: InventoryState): number {
  let total = 0;
  for (const f of state.factories) total += f.upkeepPerTick;
  return total;
}

// ─── Inventory lot helpers ──────────────────────────────────────────────

export function unitsOnHand(state: InventoryState, skuId: string): number {
  return state.lots[skuId]?.units ?? 0;
}

/** Total units across all lots. */
export function totalUnitsOnHand(state: InventoryState): number {
  let total = 0;
  for (const skuId of Object.keys(state.lots)) total += state.lots[skuId].units;
  return total;
}

/**
 * Add `units` of `skuId` to inventory with the given per-unit cost. Merges into
 * existing lot (weighted-average cost basis) or creates a new one.
 */
export function addToInventory(
  state: InventoryState,
  skuId: string,
  units: number,
  costPerUnit: number,
): void {
  if (units <= 0) return;
  const addedCost = units * costPerUnit;
  const existing = state.lots[skuId];
  if (existing) {
    existing.units += units;
    existing.totalCostBasis += addedCost;
    // Age resets toward 0 as fresh stock dilutes — weighted by units.
    const weightedAge = (existing.ageDays * (existing.units - units) + 0 * units) / existing.units;
    existing.ageDays = Math.max(0, weightedAge);
  } else {
    state.lots[skuId] = { skuId, units, totalCostBasis: addedCost, ageDays: 0 };
  }
}

/**
 * Pull `requested` units of `skuId` from inventory. Returns actually deducted
 * units (capped at on-hand) and the COGS for those units. Mutates the lot.
 *
 * Games wire this to unit-sale: compute desired sales from demand, call
 * `sellFromInventory`, then `recordSale` with the returned units + COGS.
 */
export function sellFromInventory(
  state: InventoryState,
  skuId: string,
  requested: number,
): { unitsSold: number; cogsTotal: number } {
  const lot = state.lots[skuId];
  if (!lot || lot.units <= 0 || requested <= 0) {
    return { unitsSold: 0, cogsTotal: 0 };
  }
  const unitsSold = Math.min(lot.units, requested);
  // Average cost-basis from the lot.
  const avgCost = lot.units > 0 ? lot.totalCostBasis / lot.units : 0;
  const cogsTotal = avgCost * unitsSold;
  lot.units -= unitsSold;
  lot.totalCostBasis -= cogsTotal;
  // Clean up empty lots to keep `lots` tidy.
  if (lot.units <= 0) {
    delete state.lots[skuId];
  }
  return { unitsSold, cogsTotal };
}

// ─── Production + aging + write-downs ───────────────────────────────────

/**
 * Run one tick of production for one factory: produce `capacity × share` units
 * of each allocated SKU, adding to inventory. Mutates state. Returns the total
 * units produced across all SKUs (for reporting).
 */
export function produceFromFactory(state: InventoryState, factory: FactoryState): number {
  let produced = 0;
  for (const alloc of factory.allocations) {
    const units = factory.capacity * alloc.share;
    if (units <= 0) continue;
    addToInventory(state, alloc.skuId, units, alloc.costPerUnit);
    produced += units;
  }
  return produced;
}

/** Run one tick of production across all factories. */
export function produceAll(state: InventoryState): number {
  let total = 0;
  for (const f of state.factories) total += produceFromFactory(state, f);
  return total;
}

/**
 * Increment `ageDays` on every lot by `days`. Call at tick start. Cheap;
 * no allocations.
 */
export function ageInventory(state: InventoryState, days: number = 1): void {
  for (const key of Object.keys(state.lots)) {
    state.lots[key].ageDays += days;
  }
}

/**
 * Write down lots older than `obsoleteAfterDays`. Subtracts remaining
 * `totalCostBasis` from a game's cash ledger (caller handles) and zeros the
 * lot. Returns the total written down this call.
 *
 * Also writes down lots explicitly listed in `obsoleteSkuIds` (games use this
 * to write down inventory for SKUs that have been superseded — e.g., a flagship
 * that got replaced in Q4 sinks its remaining stock).
 */
export function writeDownObsolete(
  state: InventoryState,
  config: {
    obsoleteAfterDays?: number;
    obsoleteSkuIds?: readonly string[];
  } = {},
): number {
  const { obsoleteAfterDays, obsoleteSkuIds } = config;
  let written = 0;
  for (const key of Object.keys(state.lots)) {
    const lot = state.lots[key];
    const tooOld = obsoleteAfterDays !== undefined && lot.ageDays >= obsoleteAfterDays;
    const explicitly = obsoleteSkuIds?.includes(lot.skuId) ?? false;
    if (tooOld || explicitly) {
      written += lot.totalCostBasis;
      delete state.lots[key];
    }
  }
  state.lastTickWriteDowns += written;
  state.cumulativeWriteDowns += written;
  return written;
}

// ─── State init ─────────────────────────────────────────────────────────

export function createInventoryState(): InventoryState {
  return {
    factories: [],
    lots: {},
    lastTickWriteDowns: 0,
    cumulativeWriteDowns: 0,
    lastTickUpkeep: 0,
    cumulativeUpkeep: 0,
  };
}

/** Add a factory. Convenience wrapper. */
export function addFactory(state: InventoryState, factory: FactoryState): void {
  state.factories.push(factory);
}

/**
 * Reset per-tick aggregates (write-downs, upkeep). Call at tick start — pairs
 * with unitSaleResetPhase's pattern.
 */
export function resetTickAggregates(state: InventoryState): void {
  state.lastTickWriteDowns = 0;
  state.lastTickUpkeep = 0;
}

/**
 * Apply factory upkeep for one tick. Accumulates into state.lastTickUpkeep +
 * state.cumulativeUpkeep. Games read `lastTickUpkeep` into their
 * `financialPhase` `getBurn` callback alongside unit-sale COGS.
 */
export function applyUpkeep(state: InventoryState): number {
  const upkeep = totalUpkeepPerTick(state);
  state.lastTickUpkeep += upkeep;
  state.cumulativeUpkeep += upkeep;
  return upkeep;
}

// ─── TickPhase factories ────────────────────────────────────────────────

/**
 * Reset-at-tick-start phase. Pairs with `unitSaleResetPhase`; put both
 * FIRST after clockPhase so sellFromInventory + production + upkeep can
 * accumulate freshly.
 */
export function inventoryResetPhase<S>(getInventoryState: (s: S) => InventoryState): TickPhase<S> {
  return (state) => {
    resetTickAggregates(getInventoryState(state));
  };
}

/**
 * Production + aging + upkeep phase.
 *
 * Runs per tick:
 *   1. `ageInventory(daysPerTick)`
 *   2. `produceAll` — every factory produces its allocated SKUs
 *   3. `applyUpkeep` — factory opex lands on lastTickUpkeep
 *
 * Obsolescence write-downs are NOT done here automatically — games decide when
 * to call `writeDownObsolete` (e.g., at a product launch that supersedes a SKU,
 * or annually as part of a year-end phase).
 */
export interface ProductionPhaseConfig<S> {
  getInventoryState: (s: S) => InventoryState;
  daysPerTick?: number;
}

export function productionPhase<S>(config: ProductionPhaseConfig<S>): TickPhase<S> {
  const daysPerTick = config.daysPerTick ?? 1;
  return (state) => {
    const inv = config.getInventoryState(state);
    ageInventory(inv, daysPerTick);
    produceAll(inv);
    applyUpkeep(inv);
  };
}

// Re-export TickContext for convenience (not used directly here, but games
// composing phases may want it).
export type { TickContext };
