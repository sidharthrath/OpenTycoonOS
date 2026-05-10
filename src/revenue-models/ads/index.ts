// TycoonOS — Ad-revenue model.
// Per-slot, CPM-driven impression bookkeeping. Game decides how many
// impressions fired this tick; engine handles revenue + cost math + aggregates.

import type { TickPhase } from '../../tick/index.js';

/** Configuration for one ad slot — game-defined, dynamic between ticks. */
export interface AdSlotConfig {
  id: string;
  name: string;
  /** Dollars per 1000 *filled* impressions. */
  cpm: number;
  /** 0-1 — fraction of impressions actually filled by an advertiser. */
  fillRate: number;
  /** Optional adtech / serving overhead per impression. Defaults to 0. */
  costPerImpression?: number;
}

/** Per-slot state — cumulative + last-tick aggregates. */
export interface AdSlotState {
  slotId: string;
  cumulativeImpressions: number;
  cumulativeFilledImpressions: number;
  cumulativeRevenue: number;
  cumulativeCost: number;
  lastTickImpressions: number;
  lastTickRevenue: number;
  lastTickCost: number;
}

/** Top-level state. Place one on your game state. */
export interface AdsState {
  slots: Record<string, AdSlotState>;
  cumulativeRevenue: number;
  cumulativeCost: number;
  lastTickRevenue: number;
  lastTickCost: number;
}

/** Init state with one AdSlotState per supplied config. */
export function createAdsState(configs: readonly AdSlotConfig[]): AdsState {
  const slots: Record<string, AdSlotState> = {};
  for (const cfg of configs) {
    slots[cfg.id] = {
      slotId: cfg.id,
      cumulativeImpressions: 0,
      cumulativeFilledImpressions: 0,
      cumulativeRevenue: 0,
      cumulativeCost: 0,
      lastTickImpressions: 0,
      lastTickRevenue: 0,
      lastTickCost: 0,
    };
  }
  return {
    slots,
    cumulativeRevenue: 0,
    cumulativeCost: 0,
    lastTickRevenue: 0,
    lastTickCost: 0,
  };
}

/**
 * Record `n` ad impressions for a slot. Mutates state. Computes inline:
 *   filled = n × fillRate
 *   revenue = filled × cpm / 1000
 *   cost = n × (costPerImpression ?? 0)
 *
 * No-op if `n <= 0`, slot unknown, or config missing for the slot id.
 */
export function recordImpressions(
  state: AdsState,
  configs: readonly AdSlotConfig[],
  slotId: string,
  n: number,
): void {
  if (n <= 0) return;
  const slot = state.slots[slotId];
  const cfg = configs.find((c) => c.id === slotId);
  if (!slot || !cfg) return;

  const filled = n * Math.max(0, Math.min(1, cfg.fillRate));
  const revenue = (filled / 1000) * Math.max(0, cfg.cpm);
  const cost = n * (cfg.costPerImpression ?? 0);

  slot.cumulativeImpressions += n;
  slot.cumulativeFilledImpressions += filled;
  slot.cumulativeRevenue += revenue;
  slot.cumulativeCost += cost;
  slot.lastTickImpressions += n;
  slot.lastTickRevenue += revenue;
  slot.lastTickCost += cost;

  state.cumulativeRevenue += revenue;
  state.cumulativeCost += cost;
  state.lastTickRevenue += revenue;
  state.lastTickCost += cost;
}

/** Zero last-tick aggregates (per-slot + top-level). Cumulative untouched. */
export function resetAdsTickAggregates(state: AdsState): void {
  state.lastTickRevenue = 0;
  state.lastTickCost = 0;
  for (const slot of Object.values(state.slots)) {
    slot.lastTickImpressions = 0;
    slot.lastTickRevenue = 0;
    slot.lastTickCost = 0;
  }
}

/** TickPhase factory — resets last-tick aggregates at tick start. */
export function adsResetPhase<S>(getAdsState: (s: S) => AdsState): TickPhase<S> {
  return (state) => {
    resetAdsTickAggregates(getAdsState(state));
  };
}

// ─── Analysis helpers ────────────────────────────────────────────────────

/** Sum of cumulative impressions across all slots. */
export function totalImpressions(state: AdsState): number {
  let n = 0;
  for (const slot of Object.values(state.slots)) n += slot.cumulativeImpressions;
  return n;
}

/** Sum of cumulative revenue across all slots. (Mirror of state.cumulativeRevenue.) */
export function totalRevenue(state: AdsState): number {
  return state.cumulativeRevenue;
}

/**
 * Effective CPM blended across all slots ($/1000 actually-filled impressions).
 * Returns 0 when no impressions have been recorded.
 */
export function ecpmBlended(state: AdsState): number {
  let filled = 0;
  let revenue = 0;
  for (const slot of Object.values(state.slots)) {
    filled += slot.cumulativeFilledImpressions;
    revenue += slot.cumulativeRevenue;
  }
  if (filled <= 0) return 0;
  return (revenue / filled) * 1000;
}
