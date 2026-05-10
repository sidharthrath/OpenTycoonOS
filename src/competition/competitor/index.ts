// TycoonOS — Competitor AI framework
// Generic rival-AI state + archetype-driven strategy weights. The engine provides
// the scaffolding (state shape, archetype presets, orchestration); the game
// provides the per-tick decision logic (prices, launches, etc. are game-specific).
//
// Supersedes the older flat `competitor/` module (still kept for streaming-tycoon
// migration) with a more flexible, domain-agnostic shape.

import type { TickPhase, TickContext } from '../../tick/index.js';

/**
 * Strategy weights that shape a rival's decisions. Games read these in their
 * `tickCompetitor` function to drive actual mutations. All weights are 0–1.
 */
export interface CompetitorArchetype {
  id: string;
  name: string;
  /** Eagerness to undercut on price. High = frequent price cuts. */
  priceAggressiveness: number;
  /** Speed of response to player actions. High = same-tick retaliation. */
  reactivity: number;
  /** Willingness to take risky bets (new products, bold launches, big bids). */
  riskTolerance: number;
  /** How much this rival leans on marketing spend vs product quality. */
  marketingWeight: number;
  /** Willingness to outbid on shared scarce resources (talent, spectrum, etc.). */
  talentAggressiveness: number;
  /** Whether this rival can go bankrupt and exit the game. */
  canGoBankrupt: boolean;
}

/** Brief, UI-friendly record of something a rival just did. Games push these from their tick logic. */
export interface CompetitorAction {
  id: string;
  /** Day the action happened (for UI timelines). */
  day: number;
  /** Short user-facing description. */
  description: string;
  /** Kind tag for press/UI color-coding. */
  kind: 'price-cut' | 'marketing-push' | 'product-launch' | 'poach-attempt' | 'scandal' | 'other';
}

/**
 * Generic competitor state. `TMeta` is the game-specific slice (rival's product
 * lineup, current specs, etc.) that the engine doesn't know about.
 *
 * @typeParam TMeta  game-specific extension fields
 */
export interface CompetitorState<TMeta = Record<string, never>> {
  id: string;
  name: string;
  archetype: CompetitorArchetype;
  /** Market share this rival holds, 0–1. Game-managed. */
  marketShare: number;
  /** Public reputation / brand trust, 0–100. */
  reputation: number;
  /** Approximate liquid cash reserves. Not a full FinancialState — rivals
   *  are lighter-weight than the player. Game manages the number. */
  cashReserves: number;
  /** Whether this rival has exited the game (bankruptcy, acquisition, etc.). */
  isExited: boolean;
  /** Ring buffer of recent actions. Capped at `maxRecentActions` in the state container. */
  recentActions: CompetitorAction[];
  /** Game-specific extension data (product lineup, pricing, etc.). */
  meta: TMeta;
}

// ─── Pre-built archetype presets ────────────────────────────────────────

/**
 * Common archetype presets. Games can import and use directly, copy + tune, or
 * define fully custom archetypes. Values are deliberately spread across the
 * 0.2–0.9 range so they feel meaningfully different when the game's tick logic
 * reads the weights.
 */
export const ARCHETYPES = {
  /** Value-flood strategist. Undercuts aggressively, ships many SKUs, squeezes margins. */
  valueFlood: {
    id: 'value-flood',
    name: 'Value-Flood',
    priceAggressiveness: 0.85,
    reactivity: 0.7,
    riskTolerance: 0.5,
    marketingWeight: 0.4,
    talentAggressiveness: 0.3,
    canGoBankrupt: true,
  } satisfies CompetitorArchetype,

  /** Premium-global incumbent. Heavy R&D, broad lineup, doesn't chase on price. */
  premiumGlobal: {
    id: 'premium-global',
    name: 'Premium-Global',
    priceAggressiveness: 0.2,
    reactivity: 0.5,
    riskTolerance: 0.4,
    marketingWeight: 0.7,
    talentAggressiveness: 0.6,
    canGoBankrupt: false,
  } satisfies CompetitorArchetype,

  /** Marketing-obsessed challenger. Spikes awareness, celebrity endorsements. */
  marketingHeavy: {
    id: 'marketing-heavy',
    name: 'Marketing-Heavy',
    priceAggressiveness: 0.5,
    reactivity: 0.6,
    riskTolerance: 0.6,
    marketingWeight: 0.9,
    talentAggressiveness: 0.5,
    canGoBankrupt: true,
  } satisfies CompetitorArchetype,

  /** Walled-garden premium-only. Ignores lower tiers, ecosystem-heavy, patient. */
  walledGarden: {
    id: 'walled-garden',
    name: 'Walled-Garden',
    priceAggressiveness: 0.1,
    reactivity: 0.3,
    riskTolerance: 0.3,
    marketingWeight: 0.5,
    talentAggressiveness: 0.8,
    canGoBankrupt: false,
  } satisfies CompetitorArchetype,

  /** Scrappy startup — fast, cash-constrained, high variance. */
  scrappyStartup: {
    id: 'scrappy-startup',
    name: 'Scrappy-Startup',
    priceAggressiveness: 0.6,
    reactivity: 0.8,
    riskTolerance: 0.9,
    marketingWeight: 0.5,
    talentAggressiveness: 0.4,
    canGoBankrupt: true,
  } satisfies CompetitorArchetype,
} as const;

// ─── State helpers ──────────────────────────────────────────────────────

export interface CreateCompetitorInput<TMeta> {
  id: string;
  name: string;
  archetype: CompetitorArchetype;
  marketShare?: number;
  reputation?: number;
  cashReserves: number;
  meta: TMeta;
}

/** Create a fresh competitor. Mutable after creation; games tick it per turn. */
export function createCompetitor<TMeta>(input: CreateCompetitorInput<TMeta>): CompetitorState<TMeta> {
  return {
    id: input.id,
    name: input.name,
    archetype: input.archetype,
    marketShare: input.marketShare ?? 0,
    reputation: input.reputation ?? 50,
    cashReserves: input.cashReserves,
    isExited: false,
    recentActions: [],
    meta: input.meta,
  };
}

/**
 * Append an action to the competitor's recent-actions log, capping length.
 * Useful for UI timelines and press-headline triggers.
 */
export function pushCompetitorAction<TMeta>(
  competitor: CompetitorState<TMeta>,
  action: CompetitorAction,
  maxRecent: number = 6,
): void {
  competitor.recentActions.push(action);
  while (competitor.recentActions.length > maxRecent) {
    competitor.recentActions.shift();
  }
}

// ─── Archetype-driven behavior helpers ──────────────────────────────────

/**
 * Coin-flip based on archetype reactivity + the importance of the player's move.
 * Returns true if the competitor should act. Use in `tickCompetitor` functions.
 *
 * @param importance  0–1; how significant the player's move is (e.g. 0.9 for a flagship launch)
 * @param rng         Optional RNG for determinism. Defaults to Math.random.
 */
export function shouldReactToPlayerMove(
  archetype: CompetitorArchetype,
  importance: number,
  rng: () => number = Math.random,
): boolean {
  const threshold = archetype.reactivity * importance;
  return rng() < threshold;
}

/**
 * Compute an aggressive-competitor counter-price based on archetype's
 * price-aggressiveness. Returns a price that's 0%–30% below the player's,
 * scaled by archetype aggressiveness. Clamped to [floor, ceiling].
 */
export function chooseAggressivePrice(
  archetype: CompetitorArchetype,
  playerPrice: number,
  floor: number = 0,
  ceiling: number = Infinity,
): number {
  const undercut = 1 - archetype.priceAggressiveness * 0.3;
  const price = Math.round(playerPrice * undercut);
  return Math.max(floor, Math.min(ceiling, price));
}

// ─── TickPhase factory ──────────────────────────────────────────────────

/**
 * Configuration for `competitorPhase`.
 *
 * @typeParam S      the game's state shape
 * @typeParam TMeta  game-specific competitor meta
 */
export interface CompetitorPhaseConfig<S, TMeta> {
  /** Read all competitors off game state. */
  getCompetitors: (state: S) => CompetitorState<TMeta>[];
  /**
   * Per-competitor tick function. Game provides this — it's where price shifts,
   * product launches, reputation changes, poach attempts happen. Mutates the
   * competitor (and game state if needed). The engine just orchestrates.
   */
  tickCompetitor: (competitor: CompetitorState<TMeta>, state: S, ctx: TickContext) => void;
}

/**
 * Compose a `TickPhase` that invokes the game's per-rival tick function for
 * every non-exited competitor. Drop into `composeTick([...])`.
 *
 * @example
 *   composeTick<State>([
 *     // ...
 *     competitorPhase({
 *       getCompetitors: s => s.rivals,
 *       tickCompetitor: (rival, state, ctx) => {
 *         // game-specific logic — price adjustments, launches, etc.
 *       },
 *     }),
 *     // ...
 *   ]);
 */
export function competitorPhase<S, TMeta>(config: CompetitorPhaseConfig<S, TMeta>): TickPhase<S> {
  return (state, ctx) => {
    const rivals = config.getCompetitors(state);
    for (const rival of rivals) {
      if (rival.isExited) continue;
      config.tickCompetitor(rival, state, ctx);
    }
  };
}
