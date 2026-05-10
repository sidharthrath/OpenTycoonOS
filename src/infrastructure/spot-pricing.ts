import { interpolateCurve } from '../utils/index.js';

/**
 * Default spot pricing curve: maps availability (0-1) to price multiplier.
 * When supply is plentiful (availability → 1), price drops to 0.6x base.
 * When supply is scarce (availability → 0), price spikes to 5x base.
 *
 * Games can provide their own curve for different market dynamics.
 */
export const DEFAULT_PRICE_CURVE: readonly [number, number][] = [
  [0.00, 5.00],   // No supply: 5x base price
  [0.10, 3.00],   // Very scarce
  [0.25, 2.00],   // Scarce
  [0.50, 1.20],   // Balanced
  [0.75, 0.90],   // Surplus
  [1.00, 0.60],   // Abundant: 0.6x base price
];

/**
 * Interpolate a price from a supply/demand curve.
 * @param availability - Supply availability (0-1, where 1 = fully available)
 * @param curve - Price curve mapping availability → price multiplier
 */
export function interpolatePriceCurve(
  availability: number,
  curve: readonly [number, number][] = DEFAULT_PRICE_CURVE,
): number {
  return interpolateCurve(availability, curve);
}

/**
 * Calculate spot price given total supply, total demand, base cost per unit, and price curve.
 */
export function getSpotPrice(
  totalSupply: number,
  totalDemand: number,
  baseCostPerUnit: number,
  curve: readonly [number, number][] = DEFAULT_PRICE_CURVE,
): number {
  const availability = totalSupply > 0
    ? Math.max(0, Math.min(1, (totalSupply - totalDemand) / totalSupply))
    : 0;
  const multiplier = interpolatePriceCurve(availability, curve);
  return baseCostPerUnit * multiplier;
}
