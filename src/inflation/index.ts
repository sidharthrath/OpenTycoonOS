// TycoonOS — Inflation helpers
// Generic cost-rise-over-time patterns. Used by any module that has time-varying costs:
// content licensing, production budgets, fuel, raw materials, wages, etc.

/**
 * Compute a year-indexed inflation multiplier.
 *
 * @param annualRate  e.g. 0.035 for 3.5%/year
 * @param year        1-indexed game year (Year 1 → multiplier = 1.0)
 *
 * Example: getCostInflation(0.035, 5) ≈ 1.15
 */
export function getCostInflation(annualRate: number, year: number): number {
  return Math.pow(1 + annualRate, Math.max(0, year - 1));
}

/**
 * Apply inflation to a cost range tuple [min, max], preserving spread.
 */
export function inflateRange(range: [number, number], annualRate: number, year: number): [number, number] {
  const m = getCostInflation(annualRate, year);
  return [range[0] * m, range[1] * m];
}

/**
 * Day-indexed LINEAR growth/drift. `base × (1 + ratePerYear × daysElapsed / 364)`.
 *
 * Distinct from `getCostInflation` (which compounds annually). Use this when:
 *  - You want continuous per-day drift (not annual step-change).
 *  - "X% added per year" intuition that scales linearly within a year.
 *
 * Typical uses: catalog / inventory growth, market rate drift, wage creep,
 * commodity baseline drift — anything where the rate of change is itself
 * stable and you want a smooth curve between annual anchor points.
 *
 * @param base         Value at day 0.
 * @param ratePerYear  e.g. 0.03 for +3%/year.
 * @param daysElapsed  Day counter from the game's clock (tycoonos/clock).
 *
 * Example: linearGrowth(100, 0.05, 182) ≈ 102.5 (half a year at 5%/yr).
 */
export function linearGrowth(base: number, ratePerYear: number, daysElapsed: number): number {
  return base * (1 + ratePerYear * daysElapsed / 364);
}

/**
 * Common rates across industries. Games pick the one that fits their domain.
 */
export const INFLATION_RATES = {
  content: 0.035,   // streaming / film / games licensing (real industry ~3-4%)
  hardware: 0.02,   // consumer electronics components (historical deflation offset by chip inflation)
  labor: 0.04,      // talent, engineers, creatives
  commodity: 0.03,  // baseline; individual commodities override via events
  energy: 0.025,    // electricity, fuel baseline (large spikes handled by commodity events)
  rent: 0.05,       // commercial real estate
} as const;
