import type { FinancialState } from './financial.js';

/** Generic competitor state. Games extend with domain-specific fields. */
export interface CompetitorState {
  name: string;
  /** Archetype: 'startup' (cash-constrained, fast) or 'incumbent' (resource-rich, slow) */
  archetype: 'startup' | 'incumbent';
  finances: FinancialState;
  /** Per-tier pricing */
  pricing: Record<string, number>;
  /** Overall market share (0-1) */
  marketShare: number;
  /** Total users across all tiers */
  totalUsers: number;
  /** Whether this competitor has gone bankrupt */
  isBankrupt: boolean;
  /** Game-specific extension data */
  [key: string]: unknown;
}

export interface CompetitorArchetype {
  /** How aggressively the competitor undercuts on price (0-1) */
  priceAggressiveness: number;
  /** Base quality growth rate per day */
  qualityGrowthRate: number;
  /** How quickly competitor responds to player threats (0-1, higher = faster) */
  reactivity: number;
  /** Minimum cash before triggering fundraise */
  fundraiseThreshold: number;
  /** Whether this competitor can go bankrupt */
  canGoBankrupt: boolean;
}
