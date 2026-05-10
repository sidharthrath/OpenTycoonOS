// TycoonOS — Seasonality / calendar-based multipliers
// Pure-function module. Games define calendar phases (Q4 holiday bump, Chinese
// New Year supply lull, summer tourism, monsoon period, etc.) and read the
// active multipliers per month. No TickPhase — seasonality is a read model.
//
// The engine calendar is 364 days/year (see clock/constants.ts). Months are
// approximated as 30.33 days each for seasonality purposes.

import type { GameClock } from '../types/clock.js';

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * One calendar phase — a date window during which a set of named modifiers is
 * active. Games pick their own modifier-key vocabulary (TMod) — e.g.
 * 'demand' | 'supply' | 'marketingEffectiveness' | 'tourism'.
 *
 * @typeParam TMod  string-literal union of modifier keys the game uses
 */
export interface SeasonalPhase<TMod extends string = string> {
  id: string;
  name: string;
  description?: string;
  /** Start month, 1-12. */
  startMonth: number;
  /** End month, 1-12, inclusive. If < startMonth, the window wraps across
   *  the year boundary (e.g. start 11, end 1 = Nov-Dec-Jan). */
  endMonth: number;
  /** Multipliers active during this phase. Typically around 1.0 — values
   *  above 1 amplify, below 1 dampen. Keys are game-defined. */
  modifiers: Partial<Record<TMod, number>>;
}

export interface SeasonalityConfig<TMod extends string = string> {
  phases: readonly SeasonalPhase<TMod>[];
  /**
   * Default multiplier for any modifier key when no phase covers the current
   * month OR no covering phase specifies that key. Default 1.0 (neutral).
   */
  defaultValue?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Approximate month in year (1-12) derived from the game clock. */
export function currentMonth(clock: GameClock): number {
  const dayInYear = clock.totalDays % 364;
  // 364 / 12 ≈ 30.33 days per month
  return Math.min(12, Math.floor(dayInYear / (364 / 12)) + 1);
}

/**
 * Week within the current month (1-4) derived from the game clock.
 * Months are ~30.33 days; the trailing few days of each month are clamped to
 * W4 so the UI stays on a clean 4-week cadence rather than ever showing W5.
 */
export function currentWeekOfMonth(clock: GameClock): number {
  const monthLength = 364 / 12;
  const dayInYear = clock.totalDays % 364;
  const dayInMonth = dayInYear % monthLength;
  return Math.min(4, Math.floor(dayInMonth / 7) + 1);
}

/** Does the given month fall within `phase`'s window? Handles wrap-around. */
export function phaseIsActiveInMonth(phase: SeasonalPhase, month: number): boolean {
  const { startMonth, endMonth } = phase;
  if (startMonth <= endMonth) {
    return month >= startMonth && month <= endMonth;
  }
  // Wraps around year boundary (e.g. Nov-Feb).
  return month >= startMonth || month <= endMonth;
}

/**
 * All phases active in the given month. Multiple phases can overlap; e.g.
 * a "holiday bump" and a "regional monsoon" could both be active.
 */
export function phasesForMonth<TMod extends string>(
  config: SeasonalityConfig<TMod>,
  month: number,
): SeasonalPhase<TMod>[] {
  return config.phases.filter((p) => phaseIsActiveInMonth(p, month));
}

/**
 * Get a specific modifier's multiplier for the given month. Stacks by
 * multiplication if multiple active phases specify the same modifier key.
 *
 * Returns `defaultValue` (1.0 unless overridden) when no active phase supplies this key.
 *
 * @example
 *   modifierForMonth(config, 11, 'demand')  // Nov-Dec: 1.3 × 1.0 = 1.3
 */
export function modifierForMonth<TMod extends string>(
  config: SeasonalityConfig<TMod>,
  month: number,
  modKey: TMod,
): number {
  const defaultValue = config.defaultValue ?? 1.0;
  const active = phasesForMonth(config, month);
  let product = defaultValue;
  let hasAny = false;
  for (const phase of active) {
    const v = phase.modifiers[modKey];
    if (v !== undefined) {
      product = hasAny ? product * v : v;
      hasAny = true;
    }
  }
  return hasAny ? product : defaultValue;
}

/**
 * All modifiers active in the given month, keyed by modifier id. Multiple
 * phases' values are multiplied together for each key.
 */
export function modifiersForMonth<TMod extends string>(
  config: SeasonalityConfig<TMod>,
  month: number,
): Partial<Record<TMod, number>> {
  const active = phasesForMonth(config, month);
  const out: Partial<Record<TMod, number>> = {};
  for (const phase of active) {
    for (const key of Object.keys(phase.modifiers) as TMod[]) {
      const v = phase.modifiers[key];
      if (v === undefined) continue;
      out[key] = out[key] !== undefined ? (out[key] as number) * v : v;
    }
  }
  return out;
}

/** Shorthand: pull the active modifier for a key directly from a clock. */
export function modifierForClock<TMod extends string>(
  config: SeasonalityConfig<TMod>,
  clock: GameClock,
  modKey: TMod,
): number {
  return modifierForMonth(config, currentMonth(clock), modKey);
}

/** Shorthand: the currently active phase names, for UI chips. */
export function activePhaseNames<TMod extends string>(
  config: SeasonalityConfig<TMod>,
  clock: GameClock,
): string[] {
  return phasesForMonth(config, currentMonth(clock)).map((p) => p.name);
}
