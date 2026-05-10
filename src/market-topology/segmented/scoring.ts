import type { MarketProduct } from '../../types/market.js';
import { softmax } from '../../utils/index.js';

/**
 * Calculate target market shares from scored products.
 *
 * Takes a list of products with owner, score, and qualified flag, then returns
 * target share per owner. Uses softmax with configurable exponent for sharper
 * differentiation at higher exponents.
 */
export function calculateTargetShares(
  products: MarketProduct[],
  scoreExponent: number = 1.5,
): Record<string, number> {
  const qualified = products.filter((p) => p.qualified && p.score > 0);
  if (qualified.length === 0) return {};

  const scores = qualified.map((p) => p.score);
  const shares = softmax(scores, scoreExponent);

  const result: Record<string, number> = {};
  for (let i = 0; i < qualified.length; i += 1) {
    const owner = qualified[i].owner;
    result[owner] = (result[owner] || 0) + shares[i];
  }
  return result;
}

/**
 * Aggregate per-use-case shares into overall shares for a segment.
 * Weights determine how much each use case matters to final segment share.
 */
export function aggregateShares(
  useCaseShares: { shares: Record<string, number>; weight: number }[],
): Record<string, number> {
  const totalWeight = useCaseShares.reduce((sum, uc) => sum + uc.weight, 0);
  if (totalWeight <= 0) return {};

  const result: Record<string, number> = {};
  for (const { shares, weight } of useCaseShares) {
    const w = weight / totalWeight;
    for (const [owner, share] of Object.entries(shares)) {
      result[owner] = (result[owner] || 0) + share * w;
    }
  }
  return result;
}
