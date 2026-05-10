// TycoonOS — Project-commissioning pipeline.
// Generalized from streaming-tycoon's content-slate logic. Commission a
// project for upfront cost + N days of development; on launch, fire game
// callback; on cancel, refund proportionally. Annual budget envelope.

import type { TickPhase } from '../tick/index.js';

export type PipelineSlotStatus = 'commissioned' | 'in-development' | 'launched' | 'cancelled';

/** A single in-flight (or finished) project. Game-defined metadata via TMeta. */
export interface PipelineSlot<TMeta = unknown> {
  id: string;
  status: PipelineSlotStatus;
  cost: number;
  costSpentSoFar: number;
  daysToLaunch: number;
  totalDays: number;
  commissionedDay: number;
  launchedDay: number | null;
  meta: TMeta;
}

/** Top-level state. Place one on your game state per pipeline. */
export interface PipelineState<TMeta = unknown> {
  slots: PipelineSlot<TMeta>[];
  /** Annual budget envelope. Game can adjust as fundraising / strategy shifts. */
  annualBudget: number;
  /** Cash committed to slots this fiscal year. */
  spentThisYear: number;
  /** Day the current budget year started. */
  yearStartedDay: number;
}

export interface CommissionInput<TMeta = unknown> {
  cost: number;
  totalDays: number;
  meta: TMeta;
}

export interface CancelResult {
  refunded: number;
  sunk: number;
}

/** Init a fresh pipeline with the given annual budget. */
export function createPipelineState<TMeta = unknown>(annualBudget: number): PipelineState<TMeta> {
  return {
    slots: [],
    annualBudget,
    spentThisYear: 0,
    yearStartedDay: 0,
  };
}

/** Days in a tycoonos calendar year — matches `tycoonos/clock`. */
const DAYS_PER_YEAR = 364;

/**
 * Commission a new project. Returns the new slot id, or null if the cost
 * exceeds remaining annual budget (game shows blocked state).
 *
 * Mutates state: appends slot + adds cost to spentThisYear. Does NOT touch
 * cash — game owns when to expense (typically deduct full `cost` from cash
 * at commission, then this module only handles status transitions).
 */
export function commissionSlot<TMeta>(
  state: PipelineState<TMeta>,
  input: CommissionInput<TMeta>,
  dayCommissioned: number,
): string | null {
  if (input.cost <= 0 || input.totalDays <= 0) return null;
  if (state.spentThisYear + input.cost > state.annualBudget) return null;

  const id = `slot-${dayCommissioned}-${state.slots.length}`;
  state.slots.push({
    id,
    status: 'commissioned',
    cost: input.cost,
    costSpentSoFar: 0,
    daysToLaunch: input.totalDays,
    totalDays: input.totalDays,
    commissionedDay: dayCommissioned,
    launchedDay: null,
    meta: input.meta,
  });
  state.spentThisYear += input.cost;
  return id;
}

/**
 * Cancel an in-flight slot. Returns the refund + sunk-cost split:
 *   refunded = (cost − costSpentSoFar) × recoveryRate
 *   sunk     = costSpentSoFar
 *
 * Mutates state: status='cancelled'; daysToLaunch frozen; budget envelope
 * NOT credited back (the year's commitment was made; the recovery is cash
 * back to the player but not to the year's spending bucket).
 *
 * Returns { refunded: 0, sunk: 0 } if the slot is unknown or already
 * launched/cancelled.
 */
export function cancelSlot<TMeta>(
  state: PipelineState<TMeta>,
  slotId: string,
  recoveryRate: number,
): CancelResult {
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot) return { refunded: 0, sunk: 0 };
  if (slot.status === 'launched' || slot.status === 'cancelled') {
    return { refunded: 0, sunk: 0 };
  }
  const safeRecovery = Math.max(0, Math.min(1, recoveryRate));
  const unspent = Math.max(0, slot.cost - slot.costSpentSoFar);
  const refunded = unspent * safeRecovery;
  slot.status = 'cancelled';
  return { refunded, sunk: slot.costSpentSoFar };
}

/**
 * TickPhase factory: progresses every in-flight slot.
 *
 * Each tick:
 *   - Commissioned → in-development (one-time transition).
 *   - In-development: burns proportional cost into costSpentSoFar, decrements
 *     daysToLaunch by `daysPerTick`. On reaching 0, status='launched',
 *     onLaunch(state, slot) fires (game adds to catalog, pushes press, etc.).
 *
 * The engine does NOT deduct cash here. Most games deduct full cost at
 * commission time; the per-tick burn is bookkeeping (so cancellation math
 * works correctly).
 */
export function pipelineProgressPhase<S, TMeta = unknown>(
  getPipelineState: (s: S) => PipelineState<TMeta>,
  daysPerTick: number,
  onLaunch?: (state: S, slot: PipelineSlot<TMeta>) => void,
): TickPhase<S> {
  return (state) => {
    const pipeline = getPipelineState(state);
    for (const slot of pipeline.slots) {
      if (slot.status === 'commissioned') {
        slot.status = 'in-development';
      }
      if (slot.status !== 'in-development') continue;
      const burn = (slot.cost / slot.totalDays) * daysPerTick;
      slot.costSpentSoFar = Math.min(slot.cost, slot.costSpentSoFar + burn);
      slot.daysToLaunch -= daysPerTick;
      if (slot.daysToLaunch <= 0) {
        slot.daysToLaunch = 0;
        slot.status = 'launched';
        slot.launchedDay = state ? extractDayFromState(state) : null;
        if (onLaunch) onLaunch(state, slot);
      }
    }
  };
}

/**
 * TickPhase factory: at year boundary, zero spentThisYear so the new year's
 * envelope is full again. Detects boundary via clock.year change.
 */
export function pipelineBudgetResetPhase<S, TMeta = unknown>(
  getPipelineState: (s: S) => PipelineState<TMeta>,
  getDay: (s: S) => number = defaultGetDay,
): TickPhase<S> {
  return (state) => {
    const pipeline = getPipelineState(state);
    const day = getDay(state);
    const yearsSinceStart = Math.floor((day - pipeline.yearStartedDay) / DAYS_PER_YEAR);
    if (yearsSinceStart >= 1) {
      pipeline.spentThisYear = 0;
      pipeline.yearStartedDay = day;
    }
  };
}

// ─── Analysis helpers ────────────────────────────────────────────────────

/** Cash still allowed for new commissions this year. */
export function remainingBudget<TMeta>(state: PipelineState<TMeta>): number {
  return Math.max(0, state.annualBudget - state.spentThisYear);
}

/** Slots in flight (commissioned or in-development). */
export function inFlightCount<TMeta>(state: PipelineState<TMeta>): number {
  return state.slots.filter((s) => s.status === 'commissioned' || s.status === 'in-development').length;
}

/** Slots with the given status. */
export function countByStatus<TMeta>(
  state: PipelineState<TMeta>,
  status: PipelineSlotStatus,
): number {
  return state.slots.filter((s) => s.status === status).length;
}

// ─── Internal helpers ────────────────────────────────────────────────────

/**
 * Best-effort default: if game state has `clock.totalDays`, use it. Otherwise
 * games can pass their own `getDay` accessor to `pipelineBudgetResetPhase`.
 */
function defaultGetDay(state: unknown): number {
  if (state && typeof state === 'object' && 'clock' in state) {
    const clock = (state as { clock?: { totalDays?: number } }).clock;
    if (clock && typeof clock.totalDays === 'number') return clock.totalDays;
  }
  return 0;
}

function extractDayFromState(state: unknown): number | null {
  const day = defaultGetDay(state);
  return day || null;
}
