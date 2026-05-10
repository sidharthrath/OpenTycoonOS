// TycoonOS — Perishable inventory + yield management
//
// Inventory units that EXPIRE if unsold by a deadline. Drives yield-management
// pricing (price flexes with days-to-expiry × current load). The engine
// handles the doomed-clock book-keeping; games supply the demand signal.
//
// Use cases: airline (seat), hotel (room-night), event (ticket), cruise
// (cabin), restaurant (produce), grocery (perishables).

import type { TickPhase } from '../tick/index.js';

/** A batch of perishable units that share an expiry day + price curve. */
export interface PerishableBatch {
  id: string;
  /** Domain label e.g. 'route:bom-del:flight-3:eco'. */
  productId: string;
  /** Day from which units become sellable. */
  availableFromDay: number;
  /** Day after which any remaining units expire (lost forever). */
  expiryDay: number;
  /** Initial unit count. */
  initialUnits: number;
  /** Currently unsold units. */
  remainingUnits: number;
  /** Reference price set at batch creation — yield management adjusts vs. this. */
  basePrice: number;
  /** Current asking price after yield management. */
  currentPrice: number;
  /** Forecast curve point [0..1] of fraction-sold-by-day-fraction-elapsed. */
  forecastCurve?: ForecastCurve;
}

/** Sales-progress benchmark — "by 50% of selling window, expect 60% sold". */
export interface ForecastCurve {
  /** Pairs of [fractionElapsed (0-1), expectedFractionSold (0-1)]. Monotone increasing. */
  points: Array<[number, number]>;
}

/** Default S-curve forecast: typical airline booking-curve shape. */
export const DEFAULT_BOOKING_CURVE: ForecastCurve = {
  points: [
    [0.00, 0.00],
    [0.25, 0.10],
    [0.50, 0.30],
    [0.75, 0.65],
    [0.90, 0.85],
    [1.00, 1.00],
  ],
};

/** Top-level perishable state — list of active batches. */
export interface PerishableState {
  batches: PerishableBatch[];
  nextBatchId: number;
  /** Per-tick aggregates. */
  lastTickUnitsSold: number;
  lastTickRevenue: number;
  lastTickUnitsExpired: number;
  lastTickRevenueLostToExpiry: number;
}

export function createPerishableState(): PerishableState {
  return {
    batches: [],
    nextBatchId: 1,
    lastTickUnitsSold: 0,
    lastTickRevenue: 0,
    lastTickUnitsExpired: 0,
    lastTickRevenueLostToExpiry: 0,
  };
}

/** Reset per-tick aggregates. Use as TickPhase. */
export function perishableResetPhase<S>(getState: (s: S) => PerishableState): TickPhase<S> {
  return (state) => {
    const ps = getState(state);
    ps.lastTickUnitsSold = 0;
    ps.lastTickRevenue = 0;
    ps.lastTickUnitsExpired = 0;
    ps.lastTickRevenueLostToExpiry = 0;
  };
}

/** Add a new batch to the state. Returns the assigned batch id. */
export function addBatch(
  state: PerishableState,
  input: {
    productId: string;
    availableFromDay: number;
    expiryDay: number;
    initialUnits: number;
    basePrice: number;
    forecastCurve?: ForecastCurve;
  },
): string {
  const id = `batch-${state.nextBatchId++}`;
  state.batches.push({
    id,
    productId: input.productId,
    availableFromDay: input.availableFromDay,
    expiryDay: input.expiryDay,
    initialUnits: input.initialUnits,
    remainingUnits: input.initialUnits,
    basePrice: input.basePrice,
    currentPrice: input.basePrice,
    forecastCurve: input.forecastCurve ?? DEFAULT_BOOKING_CURVE,
  });
  return id;
}

/**
 * Yield-management price step. For each active batch, compute the expected
 * fraction sold (from forecast curve) vs. actual fraction sold; flex price
 * by `sensitivity` either direction.
 *
 * Sensitivity ~ 0.4 means "20% above forecast pace → 8% price hike". 0 means
 * no yield management (price stays at basePrice).
 */
export function applyYieldManagement(
  state: PerishableState,
  day: number,
  sensitivity: number = 0.4,
  maxPriceMultiplier: number = 1.6,
  minPriceMultiplier: number = 0.5,
): void {
  for (const b of state.batches) {
    if (b.remainingUnits <= 0) continue;
    if (day < b.availableFromDay || day > b.expiryDay) continue;
    const total = b.expiryDay - b.availableFromDay;
    if (total <= 0) continue;
    const elapsed = (day - b.availableFromDay) / total;
    const expectedSoldFrac = interpolateCurve(b.forecastCurve!, elapsed);
    const actualSoldFrac = (b.initialUnits - b.remainingUnits) / b.initialUnits;
    // Positive delta = ahead of pace → raise price. Negative = behind → drop.
    const delta = actualSoldFrac - expectedSoldFrac;
    const mult = clamp(1 + delta * sensitivity, minPriceMultiplier, maxPriceMultiplier);
    b.currentPrice = b.basePrice * mult;
  }
}

/**
 * Consume `desired` units from a batch at its `currentPrice`. Returns actual
 * units sold + revenue. Mutates batch.remainingUnits + state aggregates.
 */
export function sellFromBatch(
  state: PerishableState,
  batchId: string,
  desired: number,
): { unitsSold: number; revenue: number } {
  const b = state.batches.find((x) => x.id === batchId);
  if (!b || desired <= 0 || b.remainingUnits <= 0) return { unitsSold: 0, revenue: 0 };
  const sold = Math.min(desired, b.remainingUnits);
  b.remainingUnits -= sold;
  const revenue = sold * b.currentPrice;
  state.lastTickUnitsSold += sold;
  state.lastTickRevenue += revenue;
  return { unitsSold: sold, revenue };
}

/**
 * Aggregate sale across batches matching a productId. Sells from the
 * earliest-expiring batch first (FIFO by expiryDay).
 */
export function sellByProduct(
  state: PerishableState,
  productId: string,
  desired: number,
  day: number,
): { unitsSold: number; revenue: number; blendedPrice: number } {
  if (desired <= 0) return { unitsSold: 0, revenue: 0, blendedPrice: 0 };
  // Active batches for this product, FIFO by expiry
  const candidates = state.batches
    .filter(
      (b) =>
        b.productId === productId &&
        b.remainingUnits > 0 &&
        day >= b.availableFromDay &&
        day <= b.expiryDay,
    )
    .sort((a, b) => a.expiryDay - b.expiryDay);

  let remaining = desired;
  let totalSold = 0;
  let totalRevenue = 0;
  for (const b of candidates) {
    if (remaining <= 0) break;
    const { unitsSold, revenue } = sellFromBatch(state, b.id, remaining);
    totalSold += unitsSold;
    totalRevenue += revenue;
    remaining -= unitsSold;
  }
  const blendedPrice = totalSold > 0 ? totalRevenue / totalSold : 0;
  return { unitsSold: totalSold, revenue: totalRevenue, blendedPrice };
}

/**
 * Expire any batches past their expiry day. Removes them from state and
 * accrues `lastTickRevenueLostToExpiry` (= remainingUnits × basePrice).
 */
export function expireBatches(state: PerishableState, day: number): void {
  const stillActive: PerishableBatch[] = [];
  for (const b of state.batches) {
    if (day > b.expiryDay) {
      state.lastTickUnitsExpired += b.remainingUnits;
      state.lastTickRevenueLostToExpiry += b.remainingUnits * b.basePrice;
    } else {
      stillActive.push(b);
    }
  }
  state.batches = stillActive;
}

/** TickPhase factory wiring expiry + yield-management. */
export function perishableTickPhase<S>(
  getState: (s: S) => PerishableState,
  getDay: (s: S) => number,
  yieldSensitivity: number = 0.4,
): TickPhase<S> {
  return (state) => {
    const day = getDay(state);
    const ps = getState(state);
    expireBatches(ps, day);
    applyYieldManagement(ps, day, yieldSensitivity);
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Aggregate load factor (units sold / total available) across active batches matching a filter. */
export function aggregateLoadFactor(
  state: PerishableState,
  day: number,
  filter?: (b: PerishableBatch) => boolean,
): number {
  let sold = 0;
  let initial = 0;
  for (const b of state.batches) {
    if (day < b.availableFromDay || day > b.expiryDay) continue;
    if (filter && !filter(b)) continue;
    sold += b.initialUnits - b.remainingUnits;
    initial += b.initialUnits;
  }
  return initial > 0 ? sold / initial : 0;
}

function interpolateCurve(curve: ForecastCurve, x: number): number {
  if (x <= curve.points[0][0]) return curve.points[0][1];
  if (x >= curve.points[curve.points.length - 1][0]) return curve.points[curve.points.length - 1][1];
  for (let i = 1; i < curve.points.length; i++) {
    if (x <= curve.points[i][0]) {
      const [x0, y0] = curve.points[i - 1];
      const [x1, y1] = curve.points[i];
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return curve.points[curve.points.length - 1][1];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
