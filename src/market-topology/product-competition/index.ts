// TycoonOS — Product Competition (multi-product per-segment share allocation)
// Lifted + generalized from ai-tycoon's 9-product market scoring (market.ts:264-290).
// Pure functions, zero deps.

/**
 * Visibility of a product across different market flows.
 *
 * - 'both' (default): visible in all flows
 * - 'new-only': only new-acquisition flow — e.g., intro trials,
 *   first-month-free offers, new-customer discounts
 * - 'existing-only': only reconsideration flow — e.g., annual upsell,
 *   loyalty tiers, win-back offers, upgrade promos for current subs
 */
export type ProductVisibility = 'both' | 'new-only' | 'existing-only';

/** A product competing for share. Game-defined attributes via TAttrs. */
export interface CompetingProduct<TAttrs = unknown> {
  /** Unique product id. */
  id: string;
  /** Owner — 'player' or rival id. Used for owner-level aggregation. */
  ownerId: string;
  /** Visible price (whatever unit the customer sees). */
  price: number;
  /** Free-form, game-defined attribute payload. */
  attrs: TAttrs;
  /**
   * Which flows this product appears in. Default 'both'.
   * Set to 'existing-only' for upsells (annual plans, loyalty tiers) that
   * should only be offered to existing subscribers on reconsideration.
   * Set to 'new-only' for intro offers (free trial months, etc.).
   */
  visibility?: ProductVisibility;
}

/** A demand pool with eligibility + scoring rules. */
export interface CompetingSegment<TAttrs = unknown> {
  id: string;
  /** Demand to allocate across qualifying products (units, $, MAUs — game's pick). */
  demandPool: number;
  /** Optional pre-filter; products that fail are excluded from this segment. */
  isEligible?: (product: CompetingProduct<TAttrs>) => boolean;
  /** Score 0-100. Higher = more attractive. Game owns the blend. */
  scoreProduct: (product: CompetingProduct<TAttrs>) => number;
}

export interface ShareResult {
  /** Product id → share (0-1) of this segment's demandPool. */
  byProduct: Map<string, number>;
  /** Owner id → total share (0-1). */
  byOwner: Map<string, number>;
  /** Awarded share × demandPool, summed over all products. */
  totalDemand: number;
}

export interface MarketResult {
  /** Product id → total demand across all segments. */
  byProduct: Map<string, number>;
  /** Owner id → total demand across all segments. */
  byOwner: Map<string, number>;
  /** Per-segment results for drill-down. */
  bySegment: Map<string, ShareResult>;
}

/**
 * Which market flow this call represents. Controls which products
 * (by `visibility`) participate.
 */
export type MarketFlow = 'acquisition' | 'reconsideration' | 'both';

export interface CompetitionOptions {
  /**
   * Power-curve exponent applied to scores before normalizing. Default 1.5.
   * 1.0 = linear (everyone gets some share); 2.0+ = winner-take-most.
   */
  sharpness?: number;
  /**
   * Per-owner score multiplier applied BEFORE sharpness. Models incumbent
   * inertia — users renewing / re-evaluating an existing service favor
   * their current provider because switching costs are real (data, setup,
   * habit, re-learning). Typical 1.15-1.30 for consumer renewals, higher
   * (1.5+) for sticky enterprise SaaS. Omit or pass {} for no boost.
   *
   * Each eligible product's score becomes:
   *   score × (loyaltyBoosts[ownerId] ?? 1)
   * then raised to `sharpness` and normalized to shares.
   */
  loyaltyBoosts?: Record<string, number>;
  /**
   * Market flow this call represents. Filters products by their
   * `visibility`:
   *   - flow 'acquisition': includes 'both' + 'new-only'
   *   - flow 'reconsideration': includes 'both' + 'existing-only'
   *   - flow 'both' (default): includes all
   */
  flow?: MarketFlow;
}

const DEFAULT_SHARPNESS = 1.5;
const MIN_SCORE = 0.01;

/**
 * Allocate one segment's demand across products that qualify.
 * Pure: doesn't mutate inputs.
 */
export function competeForSegment<TAttrs>(
  products: CompetingProduct<TAttrs>[],
  segment: CompetingSegment<TAttrs>,
  options: CompetitionOptions = {},
): ShareResult {
  const sharpness = options.sharpness ?? DEFAULT_SHARPNESS;
  const byProduct = new Map<string, number>();
  const byOwner = new Map<string, number>();

  // Flow-based visibility filter — drop products that don't match the current flow
  const flow = options.flow ?? 'both';
  const visibilityFilter = (p: CompetingProduct<TAttrs>): boolean => {
    const vis = p.visibility ?? 'both';
    if (vis === 'both') return true;
    if (flow === 'both') return true;
    if (flow === 'acquisition' && vis === 'new-only') return true;
    if (flow === 'reconsideration' && vis === 'existing-only') return true;
    return false;
  };

  const visibilityPassed = products.filter(visibilityFilter);
  const eligible = segment.isEligible
    ? visibilityPassed.filter((p) => segment.isEligible!(p))
    : visibilityPassed.slice();

  if (eligible.length === 0 || segment.demandPool <= 0) {
    return { byProduct, byOwner, totalDemand: 0 };
  }

  // Step 1: raw scored values, with optional loyalty boost, with floor.
  const loyalty = options.loyaltyBoosts;
  const scored = eligible.map((p) => {
    const raw = segment.scoreProduct(p);
    const boost = loyalty?.[p.ownerId] ?? 1;
    const floored = Math.max(MIN_SCORE, raw * boost);
    const weighted = Math.pow(floored, sharpness);
    return { product: p, weighted };
  });

  const totalWeight = scored.reduce((s, e) => s + e.weighted, 0);
  if (totalWeight <= 0) {
    return { byProduct, byOwner, totalDemand: 0 };
  }

  // Step 2: normalize → share, then accumulate by product + owner.
  let totalDemand = 0;
  for (const { product, weighted } of scored) {
    const share = weighted / totalWeight;
    byProduct.set(product.id, share);
    byOwner.set(product.ownerId, (byOwner.get(product.ownerId) ?? 0) + share);
    totalDemand += share * segment.demandPool;
  }

  return { byProduct, byOwner, totalDemand };
}

/**
 * Run `competeForSegment` against every segment and aggregate per-product +
 * per-owner totals across the whole market.
 *
 * The aggregated totals are in *demand units* (segment.demandPool units),
 * not shares — they're directly usable as "units this product moved this tick".
 */
export function competeForMarket<TAttrs>(
  products: CompetingProduct<TAttrs>[],
  segments: CompetingSegment<TAttrs>[],
  options: CompetitionOptions = {},
): MarketResult {
  const byProduct = new Map<string, number>();
  const byOwner = new Map<string, number>();
  const bySegment = new Map<string, ShareResult>();

  for (const segment of segments) {
    const result = competeForSegment(products, segment, options);
    bySegment.set(segment.id, result);
    for (const [productId, share] of result.byProduct) {
      const demand = share * segment.demandPool;
      byProduct.set(productId, (byProduct.get(productId) ?? 0) + demand);
    }
    for (const [ownerId, share] of result.byOwner) {
      const demand = share * segment.demandPool;
      byOwner.set(ownerId, (byOwner.get(ownerId) ?? 0) + demand);
    }
  }

  return { byProduct, byOwner, bySegment };
}
