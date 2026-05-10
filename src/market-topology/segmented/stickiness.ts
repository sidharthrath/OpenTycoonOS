import type { StickinessParams } from '../../types/market.js';

/**
 * Blend current market shares toward target shares with stickiness.
 *
 * Users do not switch instantly: they reconsider periodically, only a fraction
 * switch, and lock-in multipliers can make it harder to leave some owners.
 */
export function blendShares(
  current: Record<string, number>,
  target: Record<string, number>,
  params: StickinessParams = {},
): Record<string, number> {
  const {
    reEvalRate = 1 / 30,
    switchRate = 0.3,
    lockInMultipliers = {},
  } = params;

  const baseBlend = reEvalRate * switchRate;
  const allOwners = new Set([...Object.keys(current), ...Object.keys(target)]);
  const result: Record<string, number> = {};

  for (const owner of allOwners) {
    const prev = current[owner] || 0;
    const tgt = target[owner] || 0;
    const lockIn = lockInMultipliers[owner] || 1.0;
    const blend = baseBlend / lockIn;
    result[owner] = prev + (tgt - prev) * blend;
  }

  const total = Object.values(result).reduce((sum, value) => sum + value, 0);
  if (total > 0) {
    for (const owner of Object.keys(result)) {
      result[owner] /= total;
    }
  }

  return result;
}
