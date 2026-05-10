// TycoonOS — Loyalty programs
//
// Multi-tier accumulated-value programs. Members earn points/miles per
// transaction; status tiers grant willingness-to-pay boost + churn
// reduction. The engine tracks the deferred-liability (unredeemed points)
// and the per-tier member counts; games supply earn rules + tier benefits.
//
// Use cases: airline (miles), hotel (points), coffee (punches), credit
// cards (cashback tiers), retail (rewards), fintech (status).

import type { TickPhase } from '../tick/index.js';

/** Definition of a single status tier. */
export interface LoyaltyTierDef {
  id: string;
  name: string;
  /** Cumulative points required to qualify (within rollingQualifyDays). */
  qualifyingPointsThreshold: number;
  /** Multiplicative WTP / fare premium for this tier. 1.10 = 10% boost. */
  wtpMultiplier: number;
  /** Multiplicative churn reduction. 0.7 = 30% lower churn. */
  churnMultiplier: number;
  /** Bonus points earn rate. 1.5 = 50% bonus on base earn. */
  earnMultiplier: number;
}

/** Top-level loyalty program definition. */
export interface LoyaltyProgramDef {
  id: string;
  /** Tiers sorted ascending by threshold. Engine assumes [base, ..., top]. */
  tiers: LoyaltyTierDef[];
  /** Days over which qualifying points are summed (typical airline: 364). */
  rollingQualifyDays: number;
  /** Base points earned per dollar spent. Tier earnMultiplier stacks on top. */
  basePointsPerDollar: number;
  /** Average value per point at redemption ($). Drives liability accrual. */
  pointValueAtRedemption: number;
}

/** Member counts + balances per tier. Aggregate (not per-member). */
export interface LoyaltyTierState {
  tierId: string;
  members: number;
  /** Total unredeemed points across all members in this tier. */
  outstandingPoints: number;
  /** Lifetime points earned by members currently in this tier. */
  lifetimePointsEarned: number;
}

/** Top-level loyalty program runtime state. */
export interface LoyaltyState {
  programId: string;
  tiers: Record<string, LoyaltyTierState>;
  /** Total members across all tiers. */
  totalMembers: number;
  /** Last-tick aggregates. */
  lastTickPointsEarned: number;
  lastTickPointsRedeemed: number;
  lastTickEarnLiabilityCost: number;
  lastTickRedemptionRevenue: number;
  /** Cumulative co-brand revenue. */
  cumulativeCoBrandRevenue: number;
}

export function createLoyaltyState(def: LoyaltyProgramDef): LoyaltyState {
  const tiers: Record<string, LoyaltyTierState> = {};
  for (const t of def.tiers) {
    tiers[t.id] = {
      tierId: t.id,
      members: 0,
      outstandingPoints: 0,
      lifetimePointsEarned: 0,
    };
  }
  return {
    programId: def.id,
    tiers,
    totalMembers: 0,
    lastTickPointsEarned: 0,
    lastTickPointsRedeemed: 0,
    lastTickEarnLiabilityCost: 0,
    lastTickRedemptionRevenue: 0,
    cumulativeCoBrandRevenue: 0,
  };
}

/** Reset per-tick aggregates. Use as TickPhase. */
export function loyaltyResetPhase<S>(getState: (s: S) => LoyaltyState): TickPhase<S> {
  return (state) => {
    const ls = getState(state);
    ls.lastTickPointsEarned = 0;
    ls.lastTickPointsRedeemed = 0;
    ls.lastTickEarnLiabilityCost = 0;
    ls.lastTickRedemptionRevenue = 0;
  };
}

/**
 * Enroll N new members into the lowest tier. Returns count actually enrolled.
 */
export function enrollMembers(
  state: LoyaltyState,
  def: LoyaltyProgramDef,
  count: number,
): number {
  if (count <= 0 || def.tiers.length === 0) return 0;
  const baseTier = def.tiers[0];
  state.tiers[baseTier.id].members += count;
  state.totalMembers += count;
  return count;
}

/**
 * Find the tier a member should be in given their qualifying points.
 * Walks tiers descending — highest qualifying threshold met wins.
 */
export function tierForPoints(def: LoyaltyProgramDef, qualifyingPoints: number): LoyaltyTierDef {
  for (let i = def.tiers.length - 1; i >= 0; i--) {
    if (qualifyingPoints >= def.tiers[i].qualifyingPointsThreshold) return def.tiers[i];
  }
  return def.tiers[0];
}

/**
 * Record member earnings at the aggregate level. Spreads earnings + lift across
 * the segment of members in `tierId`. Generates points + accrues earn-liability
 * (= points × pointValueAtRedemption × estimatedRedemptionRate, default 70%).
 */
export function recordEarnings(
  state: LoyaltyState,
  def: LoyaltyProgramDef,
  tierId: string,
  totalDollarsSpent: number,
  redemptionRate: number = 0.70,
): { pointsEarned: number; liabilityAccrued: number } {
  const tier = def.tiers.find((t) => t.id === tierId);
  if (!tier) return { pointsEarned: 0, liabilityAccrued: 0 };
  const ts = state.tiers[tierId];
  if (!ts || totalDollarsSpent <= 0) return { pointsEarned: 0, liabilityAccrued: 0 };
  const pointsEarned = totalDollarsSpent * def.basePointsPerDollar * tier.earnMultiplier;
  ts.outstandingPoints += pointsEarned;
  ts.lifetimePointsEarned += pointsEarned;
  state.lastTickPointsEarned += pointsEarned;
  const liabilityAccrued = pointsEarned * def.pointValueAtRedemption * redemptionRate;
  state.lastTickEarnLiabilityCost += liabilityAccrued;
  return { pointsEarned, liabilityAccrued };
}

/**
 * Record a redemption — burns points + recognises revenue (the redemption
 * value to the program is sometimes greater than the cash cost of fulfilling
 * the perk; passing `revenueOnRedemption` lets the game model that).
 */
export function recordRedemption(
  state: LoyaltyState,
  tierId: string,
  pointsBurned: number,
  revenueOnRedemption: number,
): boolean {
  const ts = state.tiers[tierId];
  if (!ts || pointsBurned <= 0 || ts.outstandingPoints < pointsBurned) return false;
  ts.outstandingPoints -= pointsBurned;
  state.lastTickPointsRedeemed += pointsBurned;
  state.lastTickRedemptionRevenue += revenueOnRedemption;
  return true;
}

/**
 * Co-brand credit-card revenue. The bank pays the program for new cards +
 * monthly active spend. Game decides the rates; engine just accumulates.
 */
export function recordCoBrandRevenue(state: LoyaltyState, amount: number): void {
  if (amount <= 0) return;
  state.cumulativeCoBrandRevenue += amount;
  state.lastTickRedemptionRevenue += amount;
}

/**
 * Move members between tiers based on their qualifying-points trajectory.
 * Tier-up: a member crossing into a higher tier moves up immediately.
 * Tier-down: members lose status if their rolling-window earnings fall below
 * threshold. We approximate at the aggregate level by applying `decayFraction`
 * of the previous tier-promotion as the demotion-back rate per tick.
 */
export function rebalanceTiers(
  state: LoyaltyState,
  def: LoyaltyProgramDef,
  options: {
    /** Average rolling qualifying points per member by tier (game supplies). */
    avgQualifyingPointsByTier: Record<string, number>;
    /** Fraction of overshooting members that promote up per tick. 0.01 = 1%/day. */
    promotionRate?: number;
    /** Fraction of demoted members that drop tiers per tick. */
    decayRate?: number;
  },
): void {
  const promote = options.promotionRate ?? 0.01;
  const decay = options.decayRate ?? 0.005;
  // Walk tiers from low to high, promote members whose avg qualifying points
  // already meet the next tier's threshold.
  for (let i = 0; i < def.tiers.length - 1; i++) {
    const fromTier = def.tiers[i];
    const toTier = def.tiers[i + 1];
    const fromState = state.tiers[fromTier.id];
    const avgPts = options.avgQualifyingPointsByTier[fromTier.id] ?? 0;
    if (avgPts >= toTier.qualifyingPointsThreshold && fromState.members > 0) {
      const moving = Math.floor(fromState.members * promote);
      fromState.members -= moving;
      state.tiers[toTier.id].members += moving;
    }
  }
  // Demote members in higher tiers whose avg points have fallen below threshold.
  for (let i = def.tiers.length - 1; i > 0; i--) {
    const tier = def.tiers[i];
    const tierState = state.tiers[tier.id];
    const avgPts = options.avgQualifyingPointsByTier[tier.id] ?? 0;
    if (avgPts < tier.qualifyingPointsThreshold && tierState.members > 0) {
      const moving = Math.floor(tierState.members * decay);
      tierState.members -= moving;
      state.tiers[def.tiers[i - 1].id].members += moving;
    }
  }
}

/**
 * Aggregate WTP + churn multipliers across the program — weighted by member
 * counts. Use these to modulate fare-pricing and base-churn in the game's
 * own pricing/churn logic.
 */
export function programWtpMultiplier(state: LoyaltyState, def: LoyaltyProgramDef): number {
  if (state.totalMembers <= 0) return 1;
  let weighted = 0;
  for (const t of def.tiers) {
    const ts = state.tiers[t.id];
    weighted += (ts?.members ?? 0) * t.wtpMultiplier;
  }
  return weighted / state.totalMembers;
}

export function programChurnMultiplier(state: LoyaltyState, def: LoyaltyProgramDef): number {
  if (state.totalMembers <= 0) return 1;
  let weighted = 0;
  for (const t of def.tiers) {
    const ts = state.tiers[t.id];
    weighted += (ts?.members ?? 0) * t.churnMultiplier;
  }
  return weighted / state.totalMembers;
}

/** Total deferred liability across all tiers ($). */
export function totalDeferredLiability(state: LoyaltyState, def: LoyaltyProgramDef): number {
  let pts = 0;
  for (const ts of Object.values(state.tiers)) pts += ts.outstandingPoints;
  return pts * def.pointValueAtRedemption * 0.70; // 70% expected redemption rate
}

/** Member share by tier. UI helper. */
export function memberMixByTier(state: LoyaltyState): Record<string, number> {
  const out: Record<string, number> = {};
  if (state.totalMembers <= 0) {
    for (const id of Object.keys(state.tiers)) out[id] = 0;
    return out;
  }
  for (const ts of Object.values(state.tiers)) {
    out[ts.tierId] = ts.members / state.totalMembers;
  }
  return out;
}
