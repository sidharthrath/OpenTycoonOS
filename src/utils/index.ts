import { DAYS_PER_WEEK, WEEKS_PER_QUARTER, QUARTERS_PER_YEAR } from '../clock/constants.js';

// ─── Math utilities ─────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Interpolate a value on a piecewise-linear curve.
 * Curve points must be sorted by x ascending: [[x0, y0], [x1, y1], ...]
 */
export function interpolateCurve(x: number, curve: readonly [number, number][]): number {
  if (curve.length === 0) return 0;
  if (x <= curve[0][0]) return curve[0][1];
  if (x >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];

  for (let i = 1; i < curve.length; i++) {
    if (x <= curve[i][0]) {
      const [x0, y0] = curve[i - 1];
      const [x1, y1] = curve[i];
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return curve[curve.length - 1][1];
}

/**
 * Softmax-style allocation: convert raw scores into proportional shares.
 * Applies exponent for sharper/softer differentiation.
 */
export function softmax(values: number[], exponent: number = 1.5): number[] {
  const powered = values.map(v => Math.pow(Math.max(0, v), exponent));
  const total = powered.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  return powered.map(v => v / total);
}

// ─── Formatting utilities ───────────────────────────────────

export function formatNumber(n: number, decimals: number = 1): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(decimals)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(decimals)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(decimals)}K`;
  return `${sign}${abs.toFixed(decimals)}`;
}

export function formatMoney(n: number, decimals: number = 1): string {
  return `$${formatNumber(n, decimals)}`;
}

export function formatUsers(n: number): string {
  return formatNumber(n, 1);
}

/**
 * Format a total-days count as "Y{y} Q{q} W{w}".
 * Matches the AI Tycoon convention: 7-day weeks, 13-week quarters, 4-quarter years.
 */
export function formatDay(totalDays: number): string {
  const y = Math.floor(totalDays / (DAYS_PER_WEEK * WEEKS_PER_QUARTER * QUARTERS_PER_YEAR)) + 1;
  const remaining = totalDays % (DAYS_PER_WEEK * WEEKS_PER_QUARTER * QUARTERS_PER_YEAR);
  const q = Math.floor(remaining / (DAYS_PER_WEEK * WEEKS_PER_QUARTER)) + 1;
  const weekRemaining = remaining % (DAYS_PER_WEEK * WEEKS_PER_QUARTER);
  const w = Math.floor(weekRemaining / DAYS_PER_WEEK) + 1;
  return `Y${y}Q${q}W${w}`;
}

export function formatPercent(n: number, decimals: number = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}
