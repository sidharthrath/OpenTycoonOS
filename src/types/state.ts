import type { GameClock } from './clock.js';
import type { FinancialState } from './financial.js';
import type { ResearchState } from './research.js';
import type { SegmentState } from './market.js';
import type { NewspaperState } from './newspaper.js';
import type { HistorySnapshot } from './history.js';
/**
 * BaseGameState — the root state type that every tycoon game extends.
 *
 * Provides clock, finances, research, market segments, newspaper, and history for free.
 * Games add their domain-specific slices by extending this interface.
 *
 * Example:
 *   interface AITycoonState extends BaseGameState {
 *     models: ModelState[];
 *     computeMarket: ComputeMarketState;
 *   }
 */
export interface BaseGameState {
  companyName: string;
  clock: GameClock;
  finances: FinancialState;
  research: ResearchState;
  segments: Record<string, SegmentState>;
  newspaper: NewspaperState;
  history: { snapshots: HistorySnapshot[] };
  pauseReasons: string[];
  gameOver: boolean;
  gameOverReason: string | null;
}
