import type { TierEconomics, ChurnParams, AdRevenueParams } from '../types/product.js';
import { DAYS_PER_MONTH } from '../clock/constants.js';

/**
 * Calculate subscription revenue for a tier (per day).
 * Monthly price is divided by 30 to get daily revenue.
 */
export function calculateSubscriptionRevenue(users: number, monthlyPrice: number): number {
  if (monthlyPrice <= 0 || users <= 0) return 0;
  return (users * monthlyPrice) / DAYS_PER_MONTH;
}

/**
 * Calculate ad revenue for a free/ad-supported tier (per day).
 * Revenue = users × daily interactions × ad rate × segment value multiplier
 */
export function calculateAdRevenue(
  users: number,
  dailyInteractions: number,
  params: AdRevenueParams,
  segment?: string,
): number {
  if (users <= 0 || dailyInteractions <= 0) return 0;
  const segValue = (segment && params.segmentValues?.[segment]) || 1.0;
  return users * dailyInteractions * params.baseRate * segValue;
}

/**
 * Apply daily churn to user count. Returns the new user count after churn.
 * Monthly churn rate is converted to daily: dailyChurn = 1 - (1 - monthlyRate)^(1/30)
 */
export function applyChurn(
  users: number,
  tier: string,
  params: ChurnParams,
): number {
  if (users <= 0) return 0;

  const tierMod = params.tierModifiers?.[tier] ?? 1.0;
  const monthlyChurn = params.baseRate * tierMod;
  const dailyChurn = 1 - Math.pow(1 - monthlyChurn, 1 / DAYS_PER_MONTH);

  return Math.max(0, Math.round(users * (1 - dailyChurn)));
}

/**
 * Distribute new users across tiers based on share fractions.
 * Returns per-tier user deltas (can be negative for declining tiers).
 */
export function distributeTierUsers(
  totalUsers: number,
  tierShares: Record<string, number>,
  currentTierUsers: Record<string, number>,
  blendRate: number = 0.1,
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const [tier, targetShare] of Object.entries(tierShares)) {
    const targetUsers = Math.round(totalUsers * targetShare);
    const current = currentTierUsers[tier] || 0;
    // Blend toward target rather than snapping
    result[tier] = Math.round(current + (targetUsers - current) * blendRate);
  }

  return result;
}

/** Create an initial TierEconomics for a given tier. */
export function createTier(tier: string, price: number): TierEconomics {
  return { tier, price, users: 0, revenuePerDay: 0, costPerDay: 0 };
}
