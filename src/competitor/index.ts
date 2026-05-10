import type { CompetitorState, CompetitorArchetype } from '../types/competitor.js';
import { applyDailyFinances, checkBankruptcy, raiseFunding } from '../financial/index.js';

export type { CompetitorArchetype } from '../types/competitor.js';

/**
 * Tick a competitor's finances: apply revenue/burn, check bankruptcy,
 * trigger fundraising if needed.
 *
 * Mutates the competitor state. Returns what happened.
 */
export function tickCompetitorFinances(
  competitor: CompetitorState,
  dailyRevenue: number,
  dailyBurn: number,
  archetype: CompetitorArchetype,
): { bankrupt: boolean; fundraised: boolean } {
  if (competitor.isBankrupt) return { bankrupt: true, fundraised: false };

  applyDailyFinances(competitor.finances, dailyRevenue, dailyBurn);

  // Check if competitor needs to fundraise
  if (competitor.finances.cash < archetype.fundraiseThreshold && competitor.finances.cash > 0) {
    const amount = archetype.fundraiseThreshold * 3;
    const result = raiseFunding(competitor.finances, amount, 0.05);
    if (result.success) {
      return { bankrupt: false, fundraised: true };
    }
  }

  // Check bankruptcy
  const status = checkBankruptcy(competitor.finances, 0.05);
  if (status === 'bankrupt' && archetype.canGoBankrupt) {
    competitor.isBankrupt = true;
    return { bankrupt: true, fundraised: false };
  }

  return { bankrupt: false, fundraised: false };
}

/**
 * Calculate a competitor's pricing for a tier based on archetype and market context.
 * More aggressive competitors price lower relative to the player.
 */
export function calculateCompetitorPrice(
  playerPrice: number,
  archetype: CompetitorArchetype,
  minPrice: number = 0,
  maxPrice: number = Infinity,
): number {
  const undercut = 1 - archetype.priceAggressiveness * 0.3;
  const price = Math.round(playerPrice * undercut);
  return Math.max(minPrice, Math.min(maxPrice, price));
}

/** Create initial competitor state. */
export function createCompetitor(
  name: string,
  archetype: 'startup' | 'incumbent',
  startingCash: number,
  initialPricing: Record<string, number>,
): CompetitorState {
  return {
    name,
    archetype,
    finances: {
      cash: startingCash,
      revenuePerDay: 0,
      burnRatePerDay: 0,
      ownership: 1.0,
      totalRevenueEarned: 0,
      fundingRoundsRaised: 0,
      valuation: startingCash * 2,
    },
    pricing: initialPricing,
    marketShare: 0,
    totalUsers: 0,
    isBankrupt: false,
  };
}
