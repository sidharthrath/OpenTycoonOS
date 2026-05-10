export type { GameConfig, ConfigValues } from './config.js';
export { defineGameConfig } from './config.js';

export type { GameSpeed, GameClock, ClockTickResult } from './clock.js';

export type {
  FinancialState,
  ValuationInputs,
  ValuationParams,
  BankruptcyStatus,
  FundraisingResult,
} from './financial.js';

export type {
  SegmentState,
  SegmentGrowthParams,
  MarketProduct,
  StickinessParams,
} from './market.js';

export type {
  NodeStatus,
  ResearchNodeDef,
  ResearchNodeState,
  ResearchState,
  UnlockResult,
} from './research.js';

export type {
  TierEconomics,
  ChurnParams,
  AdRevenueParams,
} from './product.js';

export type {
  CompetitorState,
  CompetitorArchetype,
} from './competitor.js';

export type {
  HeadlineCandidate,
  NewspaperEdition,
  NewspaperState,
} from './newspaper.js';

export type {
  ScoringDimension,
  EndGameScore,
} from './scoring.js';

export type { HistorySnapshot } from './history.js';

export type { BaseGameState } from './state.js';
