// TycoonOS — Capability Vectors (rival R&D progression + release cadence)
// Lifted + generalized from ai-tycoon's competitor benchmark progression
// (competitors.ts:90-198). Pure functions, zero deps.

/** A rival's capability scores by dimension. Dimensions are game-defined. */
export type CapabilityVector = Record<string, number>;

/** Per-rival profile: independent growth + how aggressively to chase the leader. */
export interface CapabilityProfile {
  /**
   * Independent baseline at the given progress (0-1).
   * The competitor's own R&D trajectory absent any leader-chasing.
   */
  independentAt: (progress: number) => CapabilityVector;

  /**
   * Per-dimension copy aggression (0-1). 0.9 → match 90% of leader on this
   * dimension; 0.3 → barely chase. Models priorities + capability ceilings.
   */
  copyWeights: CapabilityVector;
}

export interface ProgressOptions {
  /** 0-1 — overall campaign progress (e.g., clock.year / maxYears). */
  progress: number;
  /**
   * 0-1 — cash factor; values below 1 scale the *independent baseline* down.
   * Models "this rival can't afford to keep up with their own R&D plan."
   * Default 1 (no constraint).
   */
  cashFactor?: number;
}

export interface ReleaseCadenceConfig {
  /** Days between releases under normal conditions. */
  baseDays: number;
  /**
   * Days subtracted per 0.10 of leader market share above 0.30. Default 5.
   * Models "rival accelerates when threatened by player dominance."
   */
  speedupPerLeaderShare?: number;
  /** Below this many days of runway, the rival slows releases. Default 90. */
  cashStrainRunwayDays?: number;
  /** Days added to interval when cash-strained. Default 30. */
  cashStrainPenaltyDays?: number;
  /**
   * Random jitter window in days (0-N). Default 0 = fully deterministic.
   * Set non-zero to avoid every rival shipping on the exact same cadence.
   */
  jitterDays?: number;
}

/**
 * One step of capability progression. Returns a NEW vector — doesn't mutate.
 *
 * Algorithm per dimension:
 *   independent = profile.independentAt(progress)[dim] × cashFactor
 *   reactive    = leader[dim] × profile.copyWeights[dim]    (skipped if no leader)
 *   new[dim]    = max(current[dim], independent, reactive)
 *
 * The `max` against current ensures capabilities never regress — once gained,
 * they stay. Cash strain slows future *gains* but doesn't erase prior progress.
 */
export function progressCapabilities(
  current: CapabilityVector,
  leader: CapabilityVector | null,
  profile: CapabilityProfile,
  options: ProgressOptions,
): CapabilityVector {
  const cashFactor = options.cashFactor ?? 1;
  const independentRaw = profile.independentAt(Math.max(0, Math.min(1, options.progress)));
  const result: CapabilityVector = {};

  // Walk the union of all known dimensions.
  const dims = new Set<string>([
    ...Object.keys(current),
    ...Object.keys(independentRaw),
    ...Object.keys(profile.copyWeights),
    ...(leader ? Object.keys(leader) : []),
  ]);

  for (const dim of dims) {
    const cur = current[dim] ?? 0;
    const indep = (independentRaw[dim] ?? 0) * cashFactor;
    const reactive = leader && profile.copyWeights[dim]
      ? (leader[dim] ?? 0) * profile.copyWeights[dim]
      : 0;
    result[dim] = Math.max(cur, indep, reactive);
  }

  return result;
}

/** Mean across all non-zero dimensions. Returns 0 if vector is empty/all-zero. */
export function averageCapability(v: CapabilityVector): number {
  const values = Object.values(v).filter((x) => x > 0);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Strongest dimension + its score. Returns null on empty vector. */
export function bestDimension(v: CapabilityVector): { dimension: string; score: number } | null {
  let best: { dimension: string; score: number } | null = null;
  for (const [dim, score] of Object.entries(v)) {
    if (best === null || score > best.score) best = { dimension: dim, score };
  }
  return best;
}

/**
 * Decide whether the rival should ship a new release this tick.
 *
 * Effective interval = baseDays
 *                    − speedup × max(0, (leaderShare − 0.30) / 0.10)
 *                    + (cash-strain penalty if runway < threshold)
 *                    ± random jitter
 *
 * Returns true when daysSinceLastRelease ≥ effectiveInterval. Stateless —
 * the game owns the counter; this is just the comparison.
 */
export function shouldRelease(
  daysSinceLastRelease: number,
  leaderShare: number,
  runwayDays: number,
  config: ReleaseCadenceConfig,
  rng: () => number = Math.random,
): boolean {
  const speedup = config.speedupPerLeaderShare ?? 5;
  const strainThreshold = config.cashStrainRunwayDays ?? 90;
  const strainPenalty = config.cashStrainPenaltyDays ?? 30;
  const jitter = config.jitterDays ?? 0;

  let interval = config.baseDays;
  if (leaderShare > 0.30) {
    interval -= speedup * ((leaderShare - 0.30) / 0.10);
  }
  if (runwayDays < strainThreshold) {
    interval += strainPenalty;
  }
  if (jitter > 0) {
    interval += (rng() * 2 - 1) * jitter;
  }
  // Floor at 7 days to prevent degenerate "releases every tick" if numbers go wild.
  interval = Math.max(7, interval);

  return daysSinceLastRelease >= interval;
}
