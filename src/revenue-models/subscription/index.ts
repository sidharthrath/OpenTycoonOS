// TycoonOS — Subscription revenue model
// Per-tier subscriber pools, monthly churn, MRR + LTV math. Pure functions,
// zero deps. Game decides who joins; engine handles bookkeeping. See README.

import type { TickPhase } from '../../tick/index.js';

/** A subscription tier's economics. Game-defined ids ('free', 'pro', etc.). */
export interface TierConfig {
  id: string;
  name: string;
  /** Price per month in game currency. 0 = free tier. */
  pricePerMonth: number;
  /**
   * Base monthly churn rate (0-1). Fraction of subscribers who leave each
   * month under nominal conditions. Game can scale with a runtime modifier.
   */
  baseChurnRate: number;
  /** Variable serving cost per subscriber per month (CDN, support, etc.). */
  costPerSubPerMonth: number;
}

/** Live state for one tier — subscribers + this-tick / cumulative deltas. */
export interface TierState {
  tierId: string;
  /** Current subscriber count. Fractional during proportional churn/upgrades. */
  subscribers: number;
  lastTickAcquired: number;
  lastTickChurned: number;
  cumulativeAcquired: number;
  cumulativeChurned: number;
}

/** Top-level state. Place one on your game state. */
export interface SubscriptionState {
  tiers: Record<string, TierState>;
  /** All-time totals across all tiers. */
  cumulativeRevenue: number;
  cumulativeCosts: number;
  /** Aggregates since last reset; pipe into financialPhase. */
  lastTickRevenue: number;
  lastTickCosts: number;
}

/** Init state with one TierState per supplied config; subscribers all 0. */
export function createSubscriptionState(configs: readonly TierConfig[]): SubscriptionState {
  const tiers: Record<string, TierState> = {};
  for (const cfg of configs) {
    tiers[cfg.id] = {
      tierId: cfg.id,
      subscribers: 0,
      lastTickAcquired: 0,
      lastTickChurned: 0,
      cumulativeAcquired: 0,
      cumulativeChurned: 0,
    };
  }
  return {
    tiers,
    cumulativeRevenue: 0,
    cumulativeCosts: 0,
    lastTickRevenue: 0,
    lastTickCosts: 0,
  };
}

/**
 * Add `n` new subscribers to a tier. Updates subscribers + last-tick +
 * cumulative acquisition counters. No-op if `n <= 0` or tier unknown.
 */
export function recordAcquisitions(
  state: SubscriptionState,
  tierId: string,
  n: number,
): void {
  if (n <= 0) return;
  const tier = state.tiers[tierId];
  if (!tier) return;
  tier.subscribers += n;
  tier.lastTickAcquired += n;
  tier.cumulativeAcquired += n;
}

/**
 * Drop subscribers proportionally to per-tier monthly churn, scaled to
 * `daysInTick` and optionally multiplied by `modifier` (0-1 = better than
 * nominal, >1 = worse). Updates last-tick + cumulative churn counters.
 *
 * Monthly → daily conversion: 1 − (1 − monthly) ^ (1/30). Compounds correctly
 * for multi-day ticks (passing daysInTick=1 vs daysInTick=30 yields ~same
 * end-of-month attrition).
 */
export function applyChurn(
  state: SubscriptionState,
  configs: readonly TierConfig[],
  daysInTick: number,
  modifier: number = 1,
): void {
  if (daysInTick <= 0) return;
  const safeModifier = Math.max(0, modifier);
  for (const cfg of configs) {
    const tier = state.tiers[cfg.id];
    if (!tier || tier.subscribers <= 0) continue;
    const monthlyRate = Math.max(0, Math.min(1, cfg.baseChurnRate * safeModifier));
    if (monthlyRate <= 0) continue;
    const dailyRate = 1 - Math.pow(1 - monthlyRate, 1 / 30);
    const periodRate = 1 - Math.pow(1 - dailyRate, daysInTick);
    const lost = tier.subscribers * periodRate;
    tier.subscribers -= lost;
    tier.lastTickChurned += lost;
    tier.cumulativeChurned += lost;
  }
}

/**
 * Accrue revenue + variable costs for `daysInTick` at current subscriber
 * counts. Adds to last-tick AND cumulative aggregates.
 *
 * Call AFTER applyChurn so churners don't get charged for their final period.
 */
export function accrueRevenue(
  state: SubscriptionState,
  configs: readonly TierConfig[],
  daysInTick: number,
): void {
  if (daysInTick <= 0) return;
  const periodFraction = daysInTick / 30;
  for (const cfg of configs) {
    const tier = state.tiers[cfg.id];
    if (!tier || tier.subscribers <= 0) continue;
    const revenue = tier.subscribers * cfg.pricePerMonth * periodFraction;
    const costs = tier.subscribers * cfg.costPerSubPerMonth * periodFraction;
    state.lastTickRevenue += revenue;
    state.lastTickCosts += costs;
    state.cumulativeRevenue += revenue;
    state.cumulativeCosts += costs;
  }
}

/**
 * Move `n` subs from one tier to another WITHOUT counting churn/acquisition.
 * Use when subs level up; preserves funnel math. No-op if `n <= 0`, either
 * tier unknown, or `from` doesn't have enough subs (clamped to available).
 */
export function upgrade(
  state: SubscriptionState,
  fromTierId: string,
  toTierId: string,
  n: number,
): void {
  if (n <= 0) return;
  const from = state.tiers[fromTierId];
  const to = state.tiers[toTierId];
  if (!from || !to) return;
  const moved = Math.min(n, from.subscribers);
  if (moved <= 0) return;
  from.subscribers -= moved;
  to.subscribers += moved;
}

/** Mirror of upgrade — same semantics, different name for readability. */
export function downgrade(
  state: SubscriptionState,
  fromTierId: string,
  toTierId: string,
  n: number,
): void {
  upgrade(state, fromTierId, toTierId, n);
}

/**
 * Zero last-tick aggregates (revenue, costs, per-tier acquired/churned).
 * Cumulative totals untouched. Call at tick start.
 */
export function resetTickAggregates(state: SubscriptionState): void {
  state.lastTickRevenue = 0;
  state.lastTickCosts = 0;
  for (const tier of Object.values(state.tiers)) {
    tier.lastTickAcquired = 0;
    tier.lastTickChurned = 0;
  }
}

/**
 * TickPhase factory — resets last-tick aggregates at the start of a tick.
 * Place after `clockPhase` and before any phase that records acquisitions
 * or accrues revenue.
 */
export function subscriptionResetPhase<S>(
  getSubscriptionState: (s: S) => SubscriptionState,
): TickPhase<S> {
  return (state) => {
    resetTickAggregates(getSubscriptionState(state));
  };
}

// ─── Analysis helpers ────────────────────────────────────────────────────

/**
 * Weighted average revenue per user across all tiers (per month).
 * Returns 0 if no subscribers. Free-tier subs count in the denominator and
 * pull ARPU down — that's correct ("blended ARPU").
 */
export function arpuPerMonth(
  state: SubscriptionState,
  configs: readonly TierConfig[],
): number {
  const total = totalSubscribers(state);
  if (total <= 0) return 0;
  let revenue = 0;
  for (const cfg of configs) {
    const tier = state.tiers[cfg.id];
    if (!tier) continue;
    revenue += tier.subscribers * cfg.pricePerMonth;
  }
  return revenue / total;
}

/**
 * Lifetime value for one tier: (price − cost) / monthlyChurn.
 *
 * Returns Infinity if churn is 0 (subs never leave). Returns 0 if margin
 * is non-positive (you lose money per sub regardless of retention).
 */
export function ltvPerTier(
  config: TierConfig,
  churnRateOverride?: number,
): number {
  const churn = churnRateOverride ?? config.baseChurnRate;
  if (churn <= 0) return Infinity;
  const margin = config.pricePerMonth - config.costPerSubPerMonth;
  if (margin <= 0) return 0;
  return margin / churn;
}

/** Sum of subscribers across all tiers. */
export function totalSubscribers(state: SubscriptionState): number {
  let n = 0;
  for (const tier of Object.values(state.tiers)) n += tier.subscribers;
  return n;
}

/**
 * Monthly recurring revenue at current subscriber counts. Snapshot only —
 * doesn't change state. Useful for HUD ("MRR: $X").
 */
export function totalRevenuePerMonth(
  state: SubscriptionState,
  configs: readonly TierConfig[],
): number {
  let revenue = 0;
  for (const cfg of configs) {
    const tier = state.tiers[cfg.id];
    if (!tier) continue;
    revenue += tier.subscribers * cfg.pricePerMonth;
  }
  return revenue;
}

export interface TierProfitability {
  tierId: string;
  subscribers: number;
  arpuPerMonth: number;          // avg revenue per user / month (from tier price + any extras game supplies)
  cogsPerMonth: number;          // avg cost per user / month
  marginPerMonth: number;        // arpu - cogs
  monthlyTotalRevenue: number;   // subscribers × arpu
  monthlyTotalCogs: number;      // subscribers × cogs
  monthlyTotalMargin: number;    // revenue - cogs
}

/**
 * Per-tier profitability breakdown — snapshot. Game-friendly helper for
 * "which tier is making money?" HUDs. Accepts tier-specific cost overrides
 * since games typically have tier-variable costs (ads served, music
 * royalties scaled by engagement, etc.) beyond the baseline
 * `costPerSubPerMonth` in TierConfig.
 *
 * @param perSubCostsByTier — map from tierId → extra per-sub monthly cost.
 *   Added to config.costPerSubPerMonth to form cogsPerMonth. Default 0.
 * @param perSubRevenueByTier — map from tierId → extra per-sub monthly
 *   revenue (e.g. ad revenue for free tier). Added to config.pricePerMonth
 *   to form arpuPerMonth. Default 0.
 */
export function perTierProfitability(
  state: SubscriptionState,
  configs: readonly TierConfig[],
  perSubCostsByTier: Record<string, number> = {},
  perSubRevenueByTier: Record<string, number> = {},
): TierProfitability[] {
  const out: TierProfitability[] = [];
  for (const cfg of configs) {
    const tier = state.tiers[cfg.id];
    if (!tier) continue;
    const extraCost = perSubCostsByTier[cfg.id] ?? 0;
    const extraRev = perSubRevenueByTier[cfg.id] ?? 0;
    const arpu = cfg.pricePerMonth + extraRev;
    const cogs = cfg.costPerSubPerMonth + extraCost;
    const margin = arpu - cogs;
    out.push({
      tierId: cfg.id,
      subscribers: tier.subscribers,
      arpuPerMonth: arpu,
      cogsPerMonth: cogs,
      marginPerMonth: margin,
      monthlyTotalRevenue: tier.subscribers * arpu,
      monthlyTotalCogs: tier.subscribers * cogs,
      monthlyTotalMargin: tier.subscribers * margin,
    });
  }
  return out;
}
