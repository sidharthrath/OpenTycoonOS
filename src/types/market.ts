export interface SegmentState {
  totalPopulation: number;
  awarenessRate: number;
  adoptionRate: number;
}

export interface SegmentGrowthParams {
  populationGrowth: number;
  awarenessGrowth: number;
  adoptionGrowth: number;
  maxAwareness?: number;
  maxAdoption?: number;
}

/** A product entry for market share calculation. Game fills these in with its own scoring. */
export interface MarketProduct {
  /** Who owns this product: 'player' or a competitor name */
  owner: string;
  /** Which tier this product belongs to */
  tier: string;
  /** Game-computed quality/value score (0+). Higher = more market share. */
  score: number;
  /** Monthly price (0 for free tier) */
  price: number;
  /** Whether this product qualifies for the current use-case/segment */
  qualified: boolean;
}

export interface StickinessParams {
  /** How often users reconsider their choice (fraction per day, default 1/30) */
  reEvalRate?: number;
  /** What fraction of reconsidering users actually switch (default 0.3) */
  switchRate?: number;
  /** Per-owner lock-in multiplier. Higher = harder to leave. Default 1.0 for all. */
  lockInMultipliers?: Record<string, number>;
}
