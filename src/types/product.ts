export interface TierEconomics {
  /** Tier identifier (e.g. 'free', 'pro', 'max') */
  tier: string;
  /** Monthly subscription price (0 for free/ad-supported) */
  price: number;
  /** Current user count on this tier */
  users: number;
  /** Daily revenue from this tier */
  revenuePerDay: number;
  /** Daily cost to serve this tier */
  costPerDay: number;
}

export interface ChurnParams {
  /** Base monthly churn rate (e.g. 0.025 = 2.5%) */
  baseRate: number;
  /** Per-tier churn modifier (lower = less churn). E.g. { free: 0.5, pro: 0.8, max: 0.4 } */
  tierModifiers?: Record<string, number>;
}

export interface AdRevenueParams {
  /** Base ad rate per user interaction */
  baseRate: number;
  /** Annual growth rate for ad rates */
  annualGrowth?: number;
  /** Per-segment value multiplier (e.g. professionals worth more than casual) */
  segmentValues?: Record<string, number>;
}
