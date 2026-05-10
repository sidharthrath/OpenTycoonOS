export interface FinancialState {
  cash: number;
  revenuePerDay: number;
  burnRatePerDay: number;
  ownership: number;
  totalRevenueEarned: number;
  fundingRoundsRaised: number;
  valuation: number;
}

export interface ValuationInputs {
  annualRevenue: number;
  marketShare: number;
  /** Game-computed quality score, 0-100 */
  qualityScore: number;
  totalUsers: number;
  /** Minimum valuation floor (e.g. cash on hand) */
  floor: number;
}

export interface ValuationParams {
  revenueMultiple?: number;
  shareBonus?: number;
  qualityBonus?: number;
  userValueEach?: number;
  minValuation?: number;
}

export type BankruptcyStatus = 'ok' | 'needs_funding' | 'bankrupt';

export interface FundraisingResult {
  success: boolean;
  raised: number;
  equitySold: number;
}
