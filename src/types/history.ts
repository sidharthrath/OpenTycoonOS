/** Base history snapshot fields. Games extend with domain-specific metrics. */
export interface HistorySnapshot {
  day: number;
  year: number;
  quarter: number;
  cash: number;
  revenuePerDay: number;
  burnRatePerDay: number;
  valuation: number;
  marketShare: number;
  totalUsers: number;
  /** Games add extra fields via index signature */
  [key: string]: unknown;
}
