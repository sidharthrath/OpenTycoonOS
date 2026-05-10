import type {
  FinancialState,
  ValuationInputs,
  ValuationParams,
  BankruptcyStatus,
  FundraisingResult,
} from '../types/financial.js';

/** Apply one day of revenue and burn to finances. Mutates state. */
export function applyDailyFinances(
  finances: FinancialState,
  dailyRevenue: number,
  dailyBurn: number,
): void {
  finances.revenuePerDay = dailyRevenue;
  finances.burnRatePerDay = dailyBurn;
  finances.totalRevenueEarned += dailyRevenue;
  finances.cash += dailyRevenue - dailyBurn;
}

/**
 * Calculate entity valuation.
 * Formula: (annualRevenue × revenueMultiple) + share bonus + quality bonus + user bonus
 * Matches the AI Tycoon pattern but with configurable params.
 */
export function calculateValuation(
  inputs: ValuationInputs,
  params: ValuationParams = {},
): number {
  const {
    revenueMultiple = 15,
    shareBonus = 0.3,
    qualityBonus = 0.3,
    userValueEach = 10,
    minValuation = 5_000_000,
  } = params;

  const base = inputs.annualRevenue * revenueMultiple;
  const share = inputs.marketShare * inputs.annualRevenue * shareBonus;
  const quality = (inputs.qualityScore / 100) * Math.max(base, 1_000_000) * qualityBonus;
  const users = inputs.totalUsers * userValueEach;

  return Math.round(Math.max(minValuation, inputs.floor, base + share + quality + users));
}

/** Check if a company is bankrupt, needs funding, or is fine. */
export function checkBankruptcy(
  finances: FinancialState,
  minOwnership: number = 0.05,
): BankruptcyStatus {
  if (finances.cash > 0) return 'ok';
  if (finances.ownership > minOwnership) return 'needs_funding';
  return 'bankrupt';
}

/**
 * Raise funding by selling equity at current valuation.
 * Ownership dilution is subtractive (selling 10% = lose 10 percentage points).
 */
export function raiseFunding(
  finances: FinancialState,
  amount: number,
  minOwnership: number = 0.05,
): FundraisingResult {
  if (finances.valuation <= 0) {
    return { success: false, raised: 0, equitySold: 0 };
  }

  const equitySold = amount / finances.valuation;
  if (finances.ownership - equitySold < minOwnership) {
    return { success: false, raised: 0, equitySold: 0 };
  }

  finances.cash += amount;
  finances.ownership -= equitySold;
  finances.valuation += amount;
  finances.fundingRoundsRaised++;

  return { success: true, raised: amount, equitySold };
}

/** Calculate runway in days based on current burn rate. Returns Infinity if profitable. */
export function calculateRunway(finances: FinancialState): number {
  const netBurn = finances.burnRatePerDay - finances.revenuePerDay;
  if (netBurn <= 0) return Infinity;
  return Math.max(0, Math.floor(finances.cash / netBurn));
}

/** Create initial financial state with given starting cash. */
export function createFinancialState(startingCash: number, ownership: number = 1.0): FinancialState {
  return {
    cash: startingCash,
    revenuePerDay: 0,
    burnRatePerDay: 0,
    ownership,
    totalRevenueEarned: 0,
    fundingRoundsRaised: 0,
    valuation: startingCash * 2,
  };
}
