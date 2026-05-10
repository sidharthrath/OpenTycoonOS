import type { GameClock } from '../types/clock.js';
import type { FinancialState } from '../types/financial.js';
import { advanceClock } from '../clock/index.js';
import { applyDailyFinances, checkBankruptcy } from '../financial/index.js';

/**
 * Context passed through tick phases. Accumulates notifications and pause reasons.
 * Games can extend this with additional context if needed.
 */
export interface TickContext {
  notifications: string[];
  pauseReasons: string[];
  /** Clock tick result — set by clockPhase, available to subsequent phases */
  isNewWeek: boolean;
  isNewQuarter: boolean;
  isNewYear: boolean;
}

/**
 * A tick phase is a pure function that mutates game state and tick context.
 * If it returns 'halt', the tick stops immediately (for game-over conditions).
 *
 * Phases run sequentially in the order provided to composeTick().
 * They operate on mutable state (Immer drafts when used in a game's store).
 */
export type TickPhase<S> = (state: S, ctx: TickContext) => void | 'halt';

export interface TickResult<S> {
  newState: S;
  shouldPause: boolean;
  pauseReasons: string[];
  notifications: string[];
}

/**
 * Compose a tick function from ordered phases.
 *
 * Call once at module level to build your game's tick function.
 * The returned function expects mutable state (use with Immer's produce in the store).
 *
 * Example:
 *   const gameTick = composeTick([clockPhase({maxYears:10}), myCustomPhase, financialPhase(...)]);
 *   // In store: produce(state, draft => { gameTick(draft, ctx); });
 */
export function composeTick<S>(phases: TickPhase<S>[]): (state: S, ctx: TickContext) => void {
  return (state: S, ctx: TickContext) => {
    for (const phase of phases) {
      const result = phase(state, ctx);
      if (result === 'halt') return;
    }
  };
}

/** Create a fresh tick context. */
export function createTickContext(): TickContext {
  return {
    notifications: [],
    pauseReasons: [],
    isNewWeek: false,
    isNewQuarter: false,
    isNewYear: false,
  };
}

// ─── Built-in Phases ────────────────────────────────────────

/**
 * Built-in phase: advance the game clock by one day.
 * Sets isNewWeek/Quarter/Year on the context for other phases to use.
 * Halts if maxYears exceeded.
 */
export function clockPhase<S extends { clock: GameClock; gameOver: boolean; gameOverReason: string | null }>(
  config: { maxYears: number },
): TickPhase<S> {
  return (state, ctx) => {
    if (state.clock.speed === 0) {
      ctx.pauseReasons.push('manual');
      return 'halt';
    }

    const result = advanceClock(state.clock);
    ctx.isNewWeek = result.isNewWeek;
    ctx.isNewQuarter = result.isNewQuarter;
    ctx.isNewYear = result.isNewYear;

    if (state.clock.year > config.maxYears) {
      state.gameOver = true;
      state.gameOverReason = 'completed';
      ctx.pauseReasons.push('game_complete');
      ctx.notifications.push(`Congratulations! You've completed ${config.maxYears} years.`);
      return 'halt';
    }
  };
}

/**
 * Built-in phase: apply revenue/burn and check for bankruptcy.
 * Games provide functions to compute daily revenue and burn from their state.
 */
export function financialPhase<S extends { finances: FinancialState; gameOver: boolean; gameOverReason: string | null }>(
  config: { minOwnership: number },
  getRevenue: (s: S) => number,
  getBurn: (s: S) => number,
): TickPhase<S> {
  return (state, ctx) => {
    const rev = getRevenue(state);
    const burn = getBurn(state);
    applyDailyFinances(state.finances, rev, burn);

    const status = checkBankruptcy(state.finances, config.minOwnership);
    if (status === 'needs_funding') {
      state.finances.cash = 0;
      ctx.pauseReasons.push('out_of_cash');
      ctx.notifications.push('Running out of cash! Raise funding to continue.');
    } else if (status === 'bankrupt') {
      state.gameOver = true;
      state.gameOverReason = 'bankrupt';
      ctx.pauseReasons.push('bankruptcy');
      ctx.notifications.push('GAME OVER: Ran out of money with no equity left to raise.');
      return 'halt';
    }
  };
}

/**
 * Built-in phase: pause on quarterly report (for newspaper/quarterly review).
 * Games can customize the condition for when to pause.
 */
export function quarterlyPausePhase<S>(
  shouldPause: (state: S, ctx: TickContext) => boolean,
): TickPhase<S> {
  return (state, ctx) => {
    if (shouldPause(state, ctx)) {
      ctx.pauseReasons.push('quarterly_report');
    }
  };
}

/**
 * Built-in phase: record a history snapshot.
 * Games provide a function to extract snapshot data from their state.
 */
export function historyPhase<S extends { history: { snapshots: unknown[] } }>(
  shouldRecord: (state: S, ctx: TickContext) => boolean,
  createSnapshot: (state: S) => unknown,
  maxSnapshots: number = 200,
): TickPhase<S> {
  return (state, ctx) => {
    if (shouldRecord(state, ctx)) {
      state.history.snapshots.push(createSnapshot(state));
      if (state.history.snapshots.length > maxSnapshots) {
        state.history.snapshots = state.history.snapshots.slice(-maxSnapshots);
      }
    }
  };
}
