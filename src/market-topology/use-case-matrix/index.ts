// TycoonOS — Use-Case Matrix
// Compose with `product-competition`: within a segment, subdivide demand
// across multiple use cases, each with its OWN hard eligibility gates,
// budget cap, and scoring function. A product that doesn't pass a use
// case's gates gets 0% of THAT use case even if it dominates other
// use cases in the same segment.
//
// Lifted + generalized from ai-tycoon's 9-product × N-use-case matrix
// (src/engine/market.ts). Applicable to any game where segments have
// heterogeneous needs: streaming (background-listening, lossless,
// commute), SaaS (individual, team, enterprise), retail (everyday,
// specialty, luxury), etc.

import {
  competeForSegment,
  type CompetingProduct,
  type CompetingSegment,
  type CompetitionOptions,
  type ShareResult,
} from '../product-competition/index.js';

/**
 * A use case within a segment — its own eligibility gates + scoring.
 *
 * Multiple use cases typically live within one segment, each capturing a
 * different need (e.g., casuals split across "background music",
 * "commute", "workout"). A product passes each use case's isEligible
 * independently; failing the gate means zero share for THAT use case.
 */
export interface UseCase<TAttrs = unknown, TSegmentId extends string = string> {
  /** Stable id (used in log / analytics / UI display). */
  id: string;
  /**
   * Fraction of each segment that has THIS use case as its primary need.
   * Values per segment typically sum to ≤ 1.0; shortfall is "no strong
   * use-case fit" (unclaimed share of that segment).
   */
  segmentDistribution: Record<TSegmentId, number>;
  /**
   * Hard eligibility check. A product must pass; no soft scoring for
   * missing capabilities. Game decides what gates mean (tech unlocks,
   * content floors, feature flags).
   */
  isEligible: (product: CompetingProduct<TAttrs>) => boolean;
  /**
   * Score function for products that passed isEligible. Higher = better.
   * Per-use-case weights (quality/price/features) typically live here.
   */
  scoreProduct: (product: CompetingProduct<TAttrs>) => number;
  /**
   * Optional max price per segment — products above are excluded from this
   * use case in that segment. Use for realistic budget-ceiling pricing
   * (casuals won't pay enterprise prices for a consumer use case).
   */
  budgetCap?: Record<TSegmentId, number>;
}

export interface UseCaseMatrixOptions extends CompetitionOptions {
  /**
   * Total demand pool for this segment (subscribers, buyers, etc.). Each
   * use case claims its distribution fraction of this pool.
   */
  segmentDemandPool: number;
}

/**
 * Allocate a segment's demand across products by competing within each use
 * case separately and summing results weighted by use-case distribution.
 *
 * Returns a ShareResult where:
 *   - byProduct / byOwner shares are fractions of segmentDemandPool
 *     (summing to ≤ 1.0 × sum of distributions).
 *   - totalDemand is absolute units claimed across all use cases.
 *
 * Shortfall = demand no product served (product gates failed, budgets
 * too high, zero eligible, or sum of distributions < 1.0).
 *
 * Pure — no mutation.
 */
export function competeAcrossUseCases<TAttrs, TSegmentId extends string>(
  products: readonly CompetingProduct<TAttrs>[],
  segmentId: TSegmentId,
  useCases: readonly UseCase<TAttrs, TSegmentId>[],
  options: UseCaseMatrixOptions,
): ShareResult {
  const byProduct = new Map<string, number>();
  const byOwner = new Map<string, number>();
  let totalDemand = 0;

  const { segmentDemandPool, ...competitionOptions } = options;
  if (segmentDemandPool <= 0) {
    return { byProduct, byOwner, totalDemand };
  }

  for (const uc of useCases) {
    const distribution = uc.segmentDistribution[segmentId] ?? 0;
    if (distribution <= 0) continue;

    const ucPool = segmentDemandPool * distribution;
    if (ucPool <= 0) continue;

    const syntheticSegment: CompetingSegment<TAttrs> = {
      id: `${segmentId}:${uc.id}`,
      demandPool: ucPool,
      isEligible: (p) => {
        if (!uc.isEligible(p)) return false;
        const cap = uc.budgetCap?.[segmentId];
        if (cap !== undefined && p.price > cap) return false;
        return true;
      },
      scoreProduct: uc.scoreProduct,
    };

    const result = competeForSegment(
      products as CompetingProduct<TAttrs>[],
      syntheticSegment,
      competitionOptions,
    );

    // Result shares are fractions of ucPool. Weight by distribution to
    // convert to fractions of segmentDemandPool, then aggregate.
    for (const [productId, share] of result.byProduct) {
      byProduct.set(productId, (byProduct.get(productId) ?? 0) + share * distribution);
    }
    for (const [ownerId, share] of result.byOwner) {
      byOwner.set(ownerId, (byOwner.get(ownerId) ?? 0) + share * distribution);
    }
    totalDemand += result.totalDemand;
  }

  return { byProduct, byOwner, totalDemand };
}

/**
 * Per-use-case eligibility introspection. For a single product + segment,
 * returns which use cases it can serve. Useful for UI ("player is eligible
 * for 4 / 10 use cases").
 */
export function eligibleUseCases<TAttrs, TSegmentId extends string>(
  product: CompetingProduct<TAttrs>,
  segmentId: TSegmentId,
  useCases: readonly UseCase<TAttrs, TSegmentId>[],
): string[] {
  return useCases
    .filter((uc) => {
      if (!uc.isEligible(product)) return false;
      const cap = uc.budgetCap?.[segmentId];
      if (cap !== undefined && product.price > cap) return false;
      return true;
    })
    .map((uc) => uc.id);
}
