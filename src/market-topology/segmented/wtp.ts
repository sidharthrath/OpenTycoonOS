// TycoonOS — Willingness-to-pay helpers for segmented markets.
// Extracted from streaming-tycoon's budget-cap system (which was ported from AI Tycoon).

export interface UseCaseLike {
  id: string;
  priceSensitivity: number; // 0 = insensitive, 1 = very sensitive
}

/**
 * Per-segment base WTP (monthly, in whatever currency your game uses).
 * Games set their own numbers based on the economics they want.
 */
export type SegmentWTP = Record<string, number>;

/**
 * Compute a use-case-specific WTP cap for a segment, with yearly inflation growth.
 *
 * caseSensitivityAdjust lowers the cap for high-sensitivity use cases (e.g. background viewing
 * won't pay much even for a rich segment).
 */
export function getBudgetCap(
  baseWTP: SegmentWTP,
  segment: string,
  useCase: UseCaseLike,
  year: number,
  annualGrowth: number = 0.04,
): number {
  const base = baseWTP[segment] ?? 10;
  const sensitivityAdjust = 1.0 - useCase.priceSensitivity * 0.5; // range [0.5, 1.0]
  const yearGrowth = Math.pow(1 + annualGrowth, Math.max(0, year - 1));
  return base * sensitivityAdjust * yearGrowth;
}

/**
 * Soft multiplier for products priced above cap. Products qualify (don't hard-filter) but
 * their appeal decays exponentially — captures "I'd pay $X but $Y is a stretch" behavior.
 *
 * softness: 0 = hard cutoff (multiplier → 0 quickly), 1 = gentle (multiplier ~= 1/ratio)
 * Default 0.4 = moderately firm (ratio=1.5 → ~0.5, ratio=2 → ~0.25)
 */
export function wtpMultiplier(price: number, cap: number, softness: number = 0.4): number {
  if (price <= cap) return 1.0;
  const ratio = price / cap;
  return Math.pow(1 / ratio, 2 * (1 - softness) + 1);
}
