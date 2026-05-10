import type { ScoringDimension, EndGameScore } from '../types/scoring.js';

/**
 * Calculate end-game score from configurable weighted dimensions.
 *
 * Each game defines its own scoring dimensions with weights and compute functions.
 * The engine applies the weights and returns a total + per-dimension breakdown.
 *
 * @param dimensions - Game-defined scoring dimensions
 * @param state - Game state to score
 * @param ownershipMultiplier - Applied to final score (e.g. player's ownership fraction)
 */
export function calculateEndGameScore<S>(
  dimensions: ScoringDimension<S>[],
  state: S,
  ownershipMultiplier: number = 1.0,
): EndGameScore {
  const breakdown: Record<string, number> = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const dim of dimensions) {
    const raw = dim.compute(state);
    const clamped = Math.min(100, Math.max(0, raw));
    breakdown[dim.name] = Math.round(clamped);
    weightedSum += clamped * dim.weight;
    totalWeight += dim.weight;
  }

  const normalized = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const total = Math.round(normalized * ownershipMultiplier);

  return { total, breakdown };
}

// ─── Probabilistic outcome ─────────────────────────────────────────────

export interface RolledOutcomeConfig {
  /** Center of the distribution. Investment-scaled in games. */
  mean: number;
  /** Standard deviation — controls variance. */
  stdev: number;
  /** Hard floor; result never drops below. */
  min: number;
  /** Hard ceiling; result never exceeds. */
  max: number;
  /** Deterministic RNG for tests. Default Math.random. */
  rng?: () => number;
}

/**
 * Roll an outcome from a normal-ish distribution clamped to [min, max].
 *
 * Uses a Box–Muller transform for the normal; cheap + good-enough for
 * game purposes (not cryptographic).
 *
 * The "money buys probability, not certainty" pattern — investment tilts
 * the distribution's mean; variance captures randomness. Good for:
 *   - critical reception of a launched product (film, podcast, album)
 *   - drug-trial phase success
 *   - hire quality
 *   - feature-launch reception
 *
 * Example:
 *   rolledOutcome({ mean: 7.2, stdev: 1.2, min: 4, max: 10 })
 *   → prestige podcast launch: mostly 5-9, rarely 10, rarely below 5.
 */
export function rolledOutcome(config: RolledOutcomeConfig): number {
  const rng = config.rng ?? Math.random;
  // Box–Muller: two uniforms → one standard-normal
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const raw = config.mean + z * config.stdev;
  return Math.max(config.min, Math.min(config.max, raw));
}

/**
 * Assign an archetype based on score profile.
 *
 * @param breakdown - Per-dimension scores from calculateEndGameScore
 * @param archetypes - Game-defined archetype rules: name → condition function
 * @param fallback - Default archetype if no rules match
 */
export function assignArchetype(
  breakdown: Record<string, number>,
  archetypes: { name: string; condition: (scores: Record<string, number>) => boolean }[],
  fallback: string = 'survivor',
): string {
  for (const { name, condition } of archetypes) {
    if (condition(breakdown)) return name;
  }
  return fallback;
}
