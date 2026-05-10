// TycoonOS — Content Slate (auto-commissioned content pipeline).
// CEO-style strategy: player sets budget + allocation + risk profile; engine
// auto-commissions content each cadence. Pairs with `pipeline/` for the
// lifecycle; game-side `onCommission` spawns the actual pipeline slot.

import type { TickPhase } from '../tick/index.js';

/**
 * Player-configurable content-production strategy. Game persists this on
 * its own state slot.
 */
export interface ContentSlateStrategy<TSlot extends string = string> {
  /** Master ON/OFF. When false, slate does nothing. */
  enabled: boolean;
  /** Annual budget in game currency. Use `Infinity` for no cap. */
  annualBudget: number;
  /**
   * Raw weights per slot type (genre, category, etc.). Engine normalizes to
   * a probability distribution at commission time. Zero-weight slots never
   * get picked; higher-weight slots pick more often.
   */
  allocationWeights: Record<TSlot, number>;
  /**
   * 0 = prestige / few-big-bets (bias commission costs toward the top of the
   * range); 1 = volume / many-small (bias toward the bottom). Default 0.5
   * produces balanced sampling.
   */
  riskProfile: number;
  /** Spend accumulator for current year (reset annually). */
  yearToDateSpend: number;
  /** Spend accumulator for current quarter (reset every 91 days). */
  quarterToDateSpend: number;
  /** Day the current year started (reference for yearly rollover). */
  yearStartedDay: number;
  /** Day the current quarter started (reference for quarterly rollover). */
  quarterStartedDay: number;
}

/** Cadence + queue constraints. Cost-sampling range is optional. */
export interface SlateConstraints {
  /** Soft cap on in-flight commissions. Slate skips if queue is full. */
  maxInFlight: number;
  /** Max commissions fired in one slate-phase call. */
  maxPerTick: number;
  /** Slate fires every N ticks. 1 = daily, 7 = weekly. */
  cadenceTicks: number;
  /**
   * Optional: if BOTH min and max are provided, engine samples a cost per
   * commission via risk-biased range and passes it as `request.sampledCost`.
   * If omitted, game drives cost entirely (ignore sampledCost in callback).
   */
  minCostPerCommission?: number;
  maxCostPerCommission?: number;
}

/** One commission the slate wants to fire. Game decides how to handle it. */
export interface CommissionRequest<TSlot extends string = string> {
  slot: TSlot;
  /**
   * Quarterly budget remaining RIGHT NOW. Game should self-gate cost ≤ this.
   * Engine trusts game's returned cost; it does not auto-reject.
   */
  availableBudget: number;
  /**
   * Cost sampled by engine via risk-biased range. Present only if SlateConstraints
   * includes both minCostPerCommission and maxCostPerCommission. Game may use
   * this as a spending target or ignore it entirely.
   */
  sampledCost?: number;
}

/** Outcome of the game's commission decision. */
export interface SlateCommissionOutcome {
  /** Actual cost to charge to QTD/YTD counters (and presumably to game cash). */
  cost: number;
}

export interface SlatePhaseConfig<S, TSlot extends string = string> {
  getStrategy: (state: S) => ContentSlateStrategy<TSlot>;
  getCash: (state: S) => number;
  getInFlightCount: (state: S) => number;
  getDay: (state: S) => number;
  constraints: SlateConstraints;
  /**
   * Game callback — decide whether + how to fire this commission.
   *
   *   null → rejected (breaks the per-tick loop)
   *   { cost } → accepted; game has ALREADY mutated state (spawned pipeline
   *              slot, deducted cash, etc.). Engine charges `cost` to slate's
   *              QTD/YTD counters.
   *
   * The game is responsible for:
   *   - Self-gating against `request.availableBudget` and its own cash.
   *   - Mutating the game state (commissioning, cash deduction).
   *   - Reporting the actual charged cost (may differ from request.sampledCost).
   */
  onCommission: (state: S, request: CommissionRequest<TSlot>) => SlateCommissionOutcome | null;
  /** Optional RNG for deterministic tests. Default Math.random. */
  rng?: () => number;
}

// ─── Constructors ────────────────────────────────────────────────────────

export interface CreateStrategyInput<TSlot extends string = string> {
  allocationWeights: Record<TSlot, number>;
  annualBudget?: number;
  riskProfile?: number;
  enabled?: boolean;
}

export function createContentSlateStrategy<TSlot extends string>(
  input: CreateStrategyInput<TSlot>,
): ContentSlateStrategy<TSlot> {
  return {
    enabled: input.enabled ?? false,
    annualBudget: input.annualBudget ?? 10_000_000,
    allocationWeights: { ...input.allocationWeights },
    riskProfile: input.riskProfile ?? 0.5,
    yearToDateSpend: 0,
    quarterToDateSpend: 0,
    yearStartedDay: 0,
    quarterStartedDay: 0,
  };
}

// ─── Phase factories ────────────────────────────────────────────────────

const DAYS_PER_QUARTER = 91; // matches tycoonos/clock 364-day-year convention (364/4=91)
const DAYS_PER_YEAR = 364;

/**
 * Per-tick rollover: resets QTD/YTD spend counters at quarter + year
 * boundaries. Independent from slatePhase so games can reset even without
 * the slate enabled (e.g., manual-only runs still need yearly budget cap).
 */
export function slateBudgetResetPhase<S, TSlot extends string = string>(
  getStrategy: (state: S) => ContentSlateStrategy<TSlot>,
  getDay: (state: S) => number,
): TickPhase<S> {
  return (state) => {
    const strategy = getStrategy(state);
    const day = getDay(state);
    if (day - strategy.quarterStartedDay >= DAYS_PER_QUARTER) {
      strategy.quarterToDateSpend = 0;
      strategy.quarterStartedDay = day;
    }
    if (day - strategy.yearStartedDay >= DAYS_PER_YEAR) {
      strategy.yearToDateSpend = 0;
      strategy.yearStartedDay = day;
    }
  };
}

/**
 * Slate firing phase. Runs every `cadenceTicks` ticks. On each firing,
 * commissions up to `maxPerTick` slots, drawing genres/categories from the
 * player's allocation weights and cost from a risk-biased range.
 */
export function slatePhase<S, TSlot extends string = string>(
  config: SlatePhaseConfig<S, TSlot>,
): TickPhase<S> {
  const rng = config.rng ?? Math.random;
  return (state) => {
    const strategy = config.getStrategy(state);
    if (!strategy.enabled) return;
    const day = config.getDay(state);

    // Cadence gate — only fire every `cadenceTicks` days (relative to year start)
    if ((day - strategy.yearStartedDay) % config.constraints.cadenceTicks !== 0) return;

    // Pro-rata quarter budget
    const quarterBudget = strategy.annualBudget / 4;
    const quarterProgress = Math.min(
      1,
      Math.max(0, (day - strategy.quarterStartedDay) / DAYS_PER_QUARTER),
    );
    const allowedQuarterToDate = quarterBudget * quarterProgress;
    let availableNow = allowedQuarterToDate - strategy.quarterToDateSpend;
    if (availableNow <= 0) return;

    const hasCostSampling =
      config.constraints.minCostPerCommission !== undefined &&
      config.constraints.maxCostPerCommission !== undefined;

    let commissionsFired = 0;
    while (commissionsFired < config.constraints.maxPerTick) {
      if (config.getInFlightCount(state) >= config.constraints.maxInFlight) break;

      const slot = pickWeighted(strategy.allocationWeights, rng);
      if (slot === null) break;

      const sampledCost = hasCostSampling
        ? sampleCost(
            config.constraints.minCostPerCommission!,
            config.constraints.maxCostPerCommission!,
            strategy.riskProfile,
            rng,
          )
        : undefined;

      const outcome = config.onCommission(state, {
        slot,
        availableBudget: availableNow,
        sampledCost,
      });
      if (outcome === null) break;

      strategy.quarterToDateSpend += outcome.cost;
      strategy.yearToDateSpend += outcome.cost;
      availableNow -= outcome.cost;
      commissionsFired += 1;
    }
  };
}

// ─── Analysis helpers ────────────────────────────────────────────────────

export function remainingQuarterBudget<TSlot extends string>(
  strategy: ContentSlateStrategy<TSlot>,
  day: number,
): number {
  const quarterBudget = strategy.annualBudget / 4;
  const progress = Math.min(1, Math.max(0, (day - strategy.quarterStartedDay) / DAYS_PER_QUARTER));
  const allowed = quarterBudget * progress;
  return Math.max(0, allowed - strategy.quarterToDateSpend);
}

export function remainingYearBudget<TSlot extends string>(
  strategy: ContentSlateStrategy<TSlot>,
): number {
  return Math.max(0, strategy.annualBudget - strategy.yearToDateSpend);
}

// ─── Internal helpers ────────────────────────────────────────────────────

/**
 * Weighted random pick from {slot: weight} map. Returns null if all weights
 * are zero or missing.
 */
function pickWeighted<TSlot extends string>(
  weights: Record<TSlot, number>,
  rng: () => number,
): TSlot | null {
  let total = 0;
  const entries = Object.entries(weights) as [TSlot, number][];
  for (const [, w] of entries) {
    if (w > 0) total += w;
  }
  if (total <= 0) return null;
  let r = rng() * total;
  for (const [slot, w] of entries) {
    if (w <= 0) continue;
    r -= w;
    if (r <= 0) return slot;
  }
  // Fallback for floating-point edge case
  return entries.find(([, w]) => w > 0)?.[0] ?? null;
}

/**
 * Risk-profile-biased cost sampler. Returns cost in [minCost, maxCost].
 *
 * riskProfile 0 (prestige) → target ~75% of range + jitter
 * riskProfile 1 (volume)   → target ~20% of range + jitter
 * Jitter ±15% of the range, clamped to [5%, 95%] of the range.
 */
function sampleCost(
  min: number,
  max: number,
  riskProfile: number,
  rng: () => number,
): number {
  const risk = Math.max(0, Math.min(1, riskProfile));
  const target = 0.75 - risk * 0.55;
  const jitter = (rng() - 0.5) * 0.30;
  const fraction = Math.max(0.05, Math.min(0.95, target + jitter));
  return min + (max - min) * fraction;
}
