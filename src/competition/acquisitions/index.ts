// TycoonOS — Acquisitions (race-to-buy M&A)
//
// Unlike the auction module, which models public bidding wars, this module
// models private M&A: targets have a fixed ask price and an availability
// window. Player OR rivals can acquire when funds + timing allow. First
// actor to close the deal wins. No bidding — just racing.
//
// The engine tracks targets + who acquired what. Games wire the concrete
// effect via an `onAcquire` callback, which transforms the target's
// `payload` into game-state mutations (spawn owned content, unlock tech,
// sign a label, etc.).
//
// Lifted from Spotify/Apple/Amazon-style podcast-network + ad-tech + creator-
// platform acquisitions. Reusable for any game where strategic M&A is a
// real-world dynamic: manufacturing (buy a supplier), SaaS (buy a plugin
// maker), retail (buy a regional chain), auto (buy a startup for tech).

import type { TickPhase } from '../../tick/index.js';

/**
 * A potential acquisition target. `payload` is game-defined — the game's
 * `onAcquire` callback interprets it to apply concrete effects.
 *
 * Availability is windowed: before `availableFromDay`, target is hidden;
 * after `availableUntilDay`, target disappears (withdrawn from market /
 * "too late to negotiate").
 */
export interface AcquisitionTarget<TPayload = unknown> {
  id: string;
  name: string;
  description: string;
  /** Fixed ask price in game currency. No negotiation in this model. */
  askPrice: number;
  /** Day target becomes available for acquisition. Null = available from game start. */
  availableFromDay: number | null;
  /** Day target disappears from market if unbought. Null = never expires. */
  availableUntilDay: number | null;
  /** Game-defined — transformed on acquire via onAcquire callback. */
  payload: TPayload;
}

/** Container held on game state. Tracks all known targets + who got what. */
export interface AcquisitionState<TPayload = unknown> {
  /** All targets — includes active, pending, withdrawn, acquired. */
  targets: AcquisitionTarget<TPayload>[];
  /** targetId → acquirerId (owner who bought it). */
  acquiredBy: Record<string, string>;
  /** targetId → day withdrawn (target expired without being bought). */
  withdrawnOn: Record<string, number>;
}

export function createAcquisitionState<TPayload = unknown>(): AcquisitionState<TPayload> {
  return { targets: [], acquiredBy: {}, withdrawnOn: {} };
}

// ─── Query helpers ──────────────────────────────────────────────────────

/** Is the target currently available to acquire? */
export function isAvailable<TPayload>(
  target: AcquisitionTarget<TPayload>,
  state: AcquisitionState<TPayload>,
  currentDay: number,
): boolean {
  if (state.acquiredBy[target.id]) return false;
  if (state.withdrawnOn[target.id] !== undefined) return false;
  if (target.availableFromDay !== null && currentDay < target.availableFromDay) return false;
  if (target.availableUntilDay !== null && currentDay > target.availableUntilDay) return false;
  return true;
}

/** Currently-available targets for rendering in UI. */
export function availableTargets<TPayload>(
  state: AcquisitionState<TPayload>,
  currentDay: number,
): AcquisitionTarget<TPayload>[] {
  return state.targets.filter((t) => isAvailable(t, state, currentDay));
}

// ─── Acquire / withdraw ─────────────────────────────────────────────────

/**
 * Attempt to acquire a target. Returns true if successful, false if not
 * (already acquired / withdrawn / not yet available / not enough cash).
 * Mutates state: marks acquiredBy, does NOT deduct cash or apply payload
 * effects — game does that via onAcquire callback.
 */
export function tryAcquire<TPayload, S>(
  state: AcquisitionState<TPayload>,
  gameState: S,
  targetId: string,
  acquirerId: string,
  currentDay: number,
  cashCheck: (gs: S, amount: number) => boolean,
): boolean {
  const target = state.targets.find((t) => t.id === targetId);
  if (!target) return false;
  if (!isAvailable(target, state, currentDay)) return false;
  if (!cashCheck(gameState, target.askPrice)) return false;
  state.acquiredBy[targetId] = acquirerId;
  return true;
}

/** Mark target as withdrawn (e.g., window expired). */
export function withdrawTarget<TPayload>(
  state: AcquisitionState<TPayload>,
  targetId: string,
  day: number,
): void {
  if (state.acquiredBy[targetId]) return;
  if (state.withdrawnOn[targetId] !== undefined) return;
  state.withdrawnOn[targetId] = day;
}

// ─── Tick phase ─────────────────────────────────────────────────────────

export interface AcquisitionPhaseConfig<S, TPayload = unknown> {
  getAcquisitionState: (state: S) => AcquisitionState<TPayload>;
  /**
   * Check if the acquirer has enough cash. Game supplies since cash
   * representation varies (player.finances.cash vs rival.cashReserves).
   */
  hasCash: (state: S, acquirerId: string, amount: number) => boolean;
  /**
   * Decide whether a rival attempts to acquire this target this tick.
   * Null / false → skip. Return true → rival acquires (engine runs
   * cashCheck + mutates state + calls onAcquire).
   */
  rivalAttemptStrategy?: (state: S, target: AcquisitionTarget<TPayload>, rivalId: string) => boolean;
  /** IDs of rivals to consider attempting each tick. */
  getRivalIds: (state: S) => string[];
  /**
   * Fires when ANYONE (player or rival) successfully acquires a target.
   * Game transforms the payload into concrete effects (deduct cash,
   * spawn content, unlock tech, sign deals, etc.).
   */
  onAcquire: (state: S, target: AcquisitionTarget<TPayload>, acquirerId: string) => void;
  /** Called once when a target's window expires without being bought. */
  onWithdraw?: (state: S, target: AcquisitionTarget<TPayload>) => void;
}

/**
 * Compose the acquisition tick phase:
 *   1. For each available target: let rivals attempt (via strategy).
 *   2. For each target whose window just closed: mark withdrawn + fire onWithdraw.
 *
 * The player acquires via an action-triggered `tryAcquire` call from the UI
 * (not from this phase).
 */
export function acquisitionPhase<S extends { clock: { totalDays: number } }, TPayload = unknown>(
  config: AcquisitionPhaseConfig<S, TPayload>,
): TickPhase<S> {
  return (state) => {
    const day = state.clock.totalDays;
    const acqState = config.getAcquisitionState(state);
    const rivalIds = config.getRivalIds(state);

    for (const target of acqState.targets) {
      // Already acquired / withdrawn — skip
      if (acqState.acquiredBy[target.id]) continue;
      if (acqState.withdrawnOn[target.id] !== undefined) continue;

      // Window expired?
      if (target.availableUntilDay !== null && day > target.availableUntilDay) {
        withdrawTarget(acqState, target.id, day);
        if (config.onWithdraw) config.onWithdraw(state, target);
        continue;
      }

      // Not yet in window
      if (target.availableFromDay !== null && day < target.availableFromDay) continue;

      // Rivals consider acquiring
      if (config.rivalAttemptStrategy) {
        for (const rivalId of rivalIds) {
          const willAttempt = config.rivalAttemptStrategy(state, target, rivalId);
          if (!willAttempt) continue;
          if (!config.hasCash(state, rivalId, target.askPrice)) continue;
          acqState.acquiredBy[target.id] = rivalId;
          config.onAcquire(state, target, rivalId);
          break; // target is gone, next
        }
      }
    }
  };
}
