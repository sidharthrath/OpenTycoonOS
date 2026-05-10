// TycoonOS — Engagement allocation.
// Given multiple content categories with different supply signals, distribute
// per-sub engagement hours across them with optional per-category caps.
// Pairs with multi-tier-production for "hours allocated × cost-of-serve" math.

/** A content category competing for user engagement hours. */
export interface EngagementCategory {
  id: string;
  /**
   * Supply signal — game-defined unit of "how much content you have here".
   * Catalog hours, # items, $ invested — pick a unit and stay consistent.
   */
  supplySignal: number;
  /** Per-sub per-month cap on hours this category can attract. */
  capPerSubPerMonth: number;
}

/** Per-call allocation profile (typically per-tier). */
export interface EngagementProfile {
  totalHoursPerSubPerMonth: number;
  /**
   * Power-curve exponent (default 1.2). >1 = winner-take-most;
   * 1.0 = linear; <1 = flatter, smaller categories punch up.
   */
  sharpness?: number;
}

export interface EngagementOptions {
  subscribers: number;
  daysInTick: number;
}

export interface EngagementResult {
  hoursByCategory: Record<string, number>;
  totalHours: number;
}

const DEFAULT_SHARPNESS = 1.2;

/**
 * Allocate engagement hours across categories. Pure — no state, no mutation.
 *
 * Algorithm:
 *   weight_i = supplySignal_i ^ sharpness
 *   share_i  = weight_i / Σ weight
 *   desired_i = share_i × totalHours × subscribers × daysInTick/30
 *   cap_i    = capPerSubPerMonth × subscribers × daysInTick/30
 *   hours_i  = min(desired_i, cap_i)
 *
 * Excess (above-cap) demand does NOT redistribute to other categories — it
 * vanishes. That models "users won't listen to 200hr of audiobooks even if
 * audiobooks dominate supply" without an artificial overflow.
 */
export function allocateEngagement(
  categories: readonly EngagementCategory[],
  profile: EngagementProfile,
  options: EngagementOptions,
): EngagementResult {
  const hoursByCategory: Record<string, number> = {};
  if (categories.length === 0 || options.subscribers <= 0 || options.daysInTick <= 0) {
    return { hoursByCategory, totalHours: 0 };
  }

  const sharpness = profile.sharpness ?? DEFAULT_SHARPNESS;
  const periodFraction = options.daysInTick / 30;
  const totalHoursAvailable = profile.totalHoursPerSubPerMonth * options.subscribers * periodFraction;

  // Step 1: weights
  const weights: number[] = categories.map((c) => Math.pow(Math.max(0, c.supplySignal), sharpness));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  if (totalWeight <= 0) {
    return { hoursByCategory, totalHours: 0 };
  }

  // Step 2 + 3: share → desired, capped
  let totalAllocated = 0;
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const share = weights[i] / totalWeight;
    const desired = share * totalHoursAvailable;
    const cap = cat.capPerSubPerMonth * options.subscribers * periodFraction;
    const allocated = Math.min(desired, cap);
    hoursByCategory[cat.id] = allocated;
    totalAllocated += allocated;
  }

  return { hoursByCategory, totalHours: totalAllocated };
}

/** Sum of all category hours. Mirror of `result.totalHours`. */
export function totalHoursAllocated(result: EngagementResult): number {
  return result.totalHours;
}

/** Hours per category as a fraction of total (0-1). 0s for empty result. */
export function shareByCategory(result: EngagementResult): Record<string, number> {
  const out: Record<string, number> = {};
  if (result.totalHours <= 0) {
    for (const id of Object.keys(result.hoursByCategory)) out[id] = 0;
    return out;
  }
  for (const [id, hours] of Object.entries(result.hoursByCategory)) {
    out[id] = hours / result.totalHours;
  }
  return out;
}

// ─── Engagement → loyalty ──────────────────────────────────────────────

export interface EngagementLoyaltyConfig {
  /** Loyalty multiplier at zero engagement. Typically 1.0. */
  baseBonus: number;
  /** Loyalty multiplier when engagement saturates. Typically 1.3–1.6. */
  maxBonus: number;
  /** Hours/sub/month at which engagement is considered saturated. */
  fullEngagementHours: number;
}

/**
 * Habit-forming users stay. Maps per-sub monthly engagement hours to a
 * loyalty multiplier for the market engine's `loyaltyBoosts`.
 *
 * Linear interpolation between `baseBonus` and `maxBonus`, clamped. Pass the
 * result to `competeForSegment`'s `loyaltyBoosts` keyed by platform/ownerId.
 * Low engagement → barely-sticky users; saturated engagement → hard-won
 * habit lock-in.
 */
export function loyaltyFromEngagement(
  hoursPerSubPerMonth: number,
  config: EngagementLoyaltyConfig,
): number {
  const ratio = Math.max(0, Math.min(1, hoursPerSubPerMonth / config.fullEngagementHours));
  return config.baseBonus + (config.maxBonus - config.baseBonus) * ratio;
}

// ─── Breadth multiplier ────────────────────────────────────────────────

/**
 * A single "breadth term" — one content type / supplier / category whose
 * presence lifts overall engagement.
 */
export interface BreadthTerm {
  /** Current signal value (e.g., coverage %, supply count). */
  signal: number;
  /** Max lift this term contributes at full saturation. 0.30 = +30%. */
  weight: number;
  /**
   * Value of `signal` at which the term saturates (contributes its full
   * `weight`). Defaults to 1 (i.e., signal is already normalized 0-1).
   * Useful when signals are unbounded (supply counts) — saturationPoint
   * says "treat anything ≥ X as maxed."
   */
  saturationPoint?: number;
}

/**
 * Multiplier ∈ [1, 1 + Σ weights]. Each term is normalized against its
 * saturationPoint (or clamped to [0,1] if no saturation is given), scaled
 * by its weight, and summed onto a baseline of 1.
 *
 * Use for "more breadth = more engagement" dynamics:
 *   - Streaming: music + podcast + audiobook → listener hours/sub multiplier.
 *   - Supply chain: supplier diversity → throughput multiplier.
 *   - Research: tech breadth → productivity multiplier.
 *
 * Games pick the terms + weights; engine does the math.
 */
export function breadthMultiplier(terms: readonly BreadthTerm[]): number {
  let mult = 1;
  for (const t of terms) {
    const cap = t.saturationPoint ?? 1;
    const normalized = cap > 0 ? Math.max(0, Math.min(1, t.signal / cap)) : 0;
    mult += normalized * t.weight;
  }
  return mult;
}
