// TycoonOS — Rival Simulation
// A domain-agnostic operating system for believable competitors. Games provide
// the strategy callbacks; the engine owns cadence, cash/runway pressure,
// action logging, and repeatable decision orchestration.

export type RivalDecisionCadence = 'daily' | 'monthly' | 'quarterly' | 'yearly';
export type RivalHealth = 'healthy' | 'constrained' | 'distressed' | 'restructured' | 'exited';
export type RivalActionKind =
  | 'price'
  | 'capacity'
  | 'market-entry'
  | 'market-exit'
  | 'investment'
  | 'asset-sale'
  | 'funding'
  | 'incident'
  | 'other';

export interface RivalStrategy {
  id: string;
  name: string;
  /** 0-1. Chases low prices and market share. */
  priceAggression: number;
  /** 0-1. Defends contested markets/capacity. */
  defensiveBias: number;
  /** 0-1. Enters new markets, buys assets, signs deals. */
  expansionBias: number;
  /** 0-1. Prefers margin/runway over growth. */
  marginDiscipline: number;
  /** 0-1. Accepts volatile bets. */
  riskTolerance: number;
  /** 0-1. Speed of response to player/market pressure. */
  reactivity: number;
}

export interface RivalEconomicsSnapshot {
  revenue: number;
  cost: number;
  capex?: number;
  netCashflow: number;
  cash: number;
  runwayTicks: number | null;
  utilization?: number;
  unmetDemand?: number;
}

export interface RivalAction<TKind extends string = RivalActionKind, TPayload = unknown> {
  id: string;
  day: number;
  kind: TKind;
  description: string;
  payload?: TPayload;
}

export interface RivalDecisionContext<S, TRival extends RivalSimState = RivalSimState> {
  day: number;
  cadence: RivalDecisionCadence;
  state: S;
  rival: TRival;
  economics: RivalEconomicsSnapshot | null;
  pressure: RivalPressure;
}

export interface RivalPressure {
  /** 0-1. Overall pressure derived from health, losses, low runway, and unmet demand. */
  overall: number;
  /** 0-1. Cash/runway pressure. */
  runway: number;
  /** 0-1. Operating loss pressure. */
  losses: number;
  /** 0-1. High utilization / capacity shortage pressure. */
  capacity: number;
  /** 0-1. Market-share or strategic pressure supplied by the game. */
  strategic: number;
}

export interface RivalDecision<S, TRival extends RivalSimState = RivalSimState> {
  id: string;
  cadence: RivalDecisionCadence;
  /**
   * Optional gate. Return false when the rival should skip this decision.
   * Use for affordability, geography, licensing, or market-specific checks.
   */
  shouldConsider?: (ctx: RivalDecisionContext<S, TRival>) => boolean;
  /**
   * Mutate game/rival state. Return an action to log, an array of actions, or
   * null when the decision elects not to act.
   */
  decide: (ctx: RivalDecisionContext<S, TRival>) => RivalAction | RivalAction[] | null | void;
}

export interface RivalSimState<TMeta = unknown> {
  id: string;
  name: string;
  strategy: RivalStrategy;
  cash: number;
  health: RivalHealth;
  restructureCount: number;
  lastEconomics: RivalEconomicsSnapshot | null;
  daysSinceDecision: Record<RivalDecisionCadence, number>;
  recentActions: RivalAction[];
  meta: TMeta;
}

export interface CreateRivalInput<TMeta> {
  id: string;
  name: string;
  strategy: RivalStrategy;
  cash: number;
  meta: TMeta;
  health?: RivalHealth;
}

export interface RivalSimOptions<S, TRival extends RivalSimState = RivalSimState> {
  getRivals: (state: S) => TRival[];
  getDay: (state: S) => number;
  /**
   * Game computes revenue/cost/capex from concrete market results and assets.
   * The engine applies net cashflow and derives health.
   */
  computeEconomics: (state: S, rival: TRival) => Omit<RivalEconomicsSnapshot, 'cash' | 'runwayTicks'> & Partial<Pick<RivalEconomicsSnapshot, 'cash' | 'runwayTicks'>>;
  decisions: readonly RivalDecision<S, TRival>[];
  strategicPressure?: (state: S, rival: TRival) => number;
  health?: RivalHealthOptions;
  maxRecentActions?: number;
  rng?: () => number;
}

export interface RivalHealthOptions {
  constrainedRunwayTicks?: number;
  distressedRunwayTicks?: number;
  restructureRunwayTicks?: number;
  restructureInjection?: number;
  exitAfterRestructures?: number;
  canExit?: boolean;
}

export interface RivalSimTickSummary {
  rivalId: string;
  health: RivalHealth;
  economics: RivalEconomicsSnapshot;
  pressure: RivalPressure;
  actions: RivalAction[];
}

const CADENCE_DAYS: Record<RivalDecisionCadence, number> = {
  daily: 1,
  monthly: 30,
  quarterly: 91,
  yearly: 364,
};

export const RIVAL_STRATEGIES = {
  scalePredator: {
    id: 'scale-predator',
    name: 'Scale Predator',
    priceAggression: 0.82,
    defensiveBias: 0.78,
    expansionBias: 0.72,
    marginDiscipline: 0.35,
    riskTolerance: 0.55,
    reactivity: 0.82,
  },
  premiumIncumbent: {
    id: 'premium-incumbent',
    name: 'Premium Incumbent',
    priceAggression: 0.22,
    defensiveBias: 0.70,
    expansionBias: 0.42,
    marginDiscipline: 0.82,
    riskTolerance: 0.32,
    reactivity: 0.48,
  },
  distressedOperator: {
    id: 'distressed-operator',
    name: 'Distressed Operator',
    priceAggression: 0.88,
    defensiveBias: 0.35,
    expansionBias: 0.12,
    marginDiscipline: 0.18,
    riskTolerance: 0.72,
    reactivity: 0.76,
  },
  nicheSpecialist: {
    id: 'niche-specialist',
    name: 'Niche Specialist',
    priceAggression: 0.34,
    defensiveBias: 0.55,
    expansionBias: 0.38,
    marginDiscipline: 0.68,
    riskTolerance: 0.46,
    reactivity: 0.42,
  },
} as const satisfies Record<string, RivalStrategy>;

export function createRival<TMeta>(input: CreateRivalInput<TMeta>): RivalSimState<TMeta> {
  return {
    id: input.id,
    name: input.name,
    strategy: input.strategy,
    cash: input.cash,
    health: input.health ?? 'healthy',
    restructureCount: 0,
    lastEconomics: null,
    daysSinceDecision: { daily: 0, monthly: 0, quarterly: 0, yearly: 0 },
    recentActions: [],
    meta: input.meta,
  };
}

export function tickRivals<S, TRival extends RivalSimState>(
  state: S,
  options: RivalSimOptions<S, TRival>,
): RivalSimTickSummary[] {
  const summaries: RivalSimTickSummary[] = [];
  const day = options.getDay(state);
  for (const rival of options.getRivals(state)) {
    if (rival.health === 'exited') {
      const economics = rival.lastEconomics ?? {
        revenue: 0,
        cost: 0,
        capex: 0,
        netCashflow: 0,
        cash: rival.cash,
        runwayTicks: null,
      };
      summaries.push({
        rivalId: rival.id,
        health: rival.health,
        economics,
        pressure: emptyPressure(),
        actions: [],
      });
      continue;
    }

    const rawEconomics = options.computeEconomics(state, rival);
    rival.cash = rawEconomics.cash ?? rival.cash + rawEconomics.netCashflow;
    const economics: RivalEconomicsSnapshot = {
      ...rawEconomics,
      cash: rival.cash,
      runwayTicks: rawEconomics.runwayTicks ?? inferRunwayTicks(rival.cash, rawEconomics.netCashflow),
    };
    rival.lastEconomics = economics;
    updateRivalHealth(rival, economics, options.health);
    tickCadenceCounters(rival);

    const pressure = computeRivalPressure(
      economics,
      options.strategicPressure?.(state, rival) ?? 0,
      options.health,
    );
    const actions = runDueDecisions(state, rival, day, economics, pressure, options);
    summaries.push({ rivalId: rival.id, health: rival.health, economics, pressure, actions });
  }
  return summaries;
}

export function logRivalAction<TMeta>(
  rival: RivalSimState<TMeta>,
  action: RivalAction,
  maxRecentActions = 8,
): void {
  rival.recentActions.push(action);
  while (rival.recentActions.length > maxRecentActions) rival.recentActions.shift();
}

export function shouldTakeRivalAction(
  strategy: RivalStrategy,
  pressure: RivalPressure,
  bias: keyof Pick<RivalStrategy, 'priceAggression' | 'defensiveBias' | 'expansionBias' | 'marginDiscipline' | 'riskTolerance' | 'reactivity'>,
  rng: () => number = Math.random,
): boolean {
  const base = strategy[bias];
  const threshold = Math.max(0, Math.min(0.98, base * 0.55 + pressure.overall * 0.35 + strategy.reactivity * 0.10));
  return rng() < threshold;
}

function runDueDecisions<S, TRival extends RivalSimState>(
  state: S,
  rival: TRival,
  day: number,
  economics: RivalEconomicsSnapshot,
  pressure: RivalPressure,
  options: RivalSimOptions<S, TRival>,
): RivalAction[] {
  const actions: RivalAction[] = [];
  const rng = options.rng ?? Math.random;
  for (const decision of options.decisions) {
    const interval = CADENCE_DAYS[decision.cadence];
    if (rival.daysSinceDecision[decision.cadence] < interval) continue;
    const ctx: RivalDecisionContext<S, TRival> = {
      day,
      cadence: decision.cadence,
      state,
      rival,
      economics,
      pressure,
    };
    if (decision.shouldConsider && !decision.shouldConsider(ctx)) continue;
    if (!shouldRunCadence(rival.strategy, decision.cadence, pressure, rng)) continue;
    const decided = decision.decide(ctx);
    const emitted = Array.isArray(decided) ? decided : decided ? [decided] : [];
    for (const action of emitted) {
      logRivalAction(rival, action, options.maxRecentActions);
      actions.push(action);
    }
    rival.daysSinceDecision[decision.cadence] = 0;
  }
  return actions;
}

function shouldRunCadence(strategy: RivalStrategy, cadence: RivalDecisionCadence, pressure: RivalPressure, rng: () => number): boolean {
  if (cadence === 'daily') return true;
  const threshold = Math.max(0.05, Math.min(1, strategy.reactivity * 0.55 + pressure.overall * 0.35 + 0.10));
  return rng() < threshold;
}

function tickCadenceCounters<TMeta>(rival: RivalSimState<TMeta>): void {
  rival.daysSinceDecision.daily += 1;
  rival.daysSinceDecision.monthly += 1;
  rival.daysSinceDecision.quarterly += 1;
  rival.daysSinceDecision.yearly += 1;
}

function updateRivalHealth<TMeta>(
  rival: RivalSimState<TMeta>,
  economics: RivalEconomicsSnapshot,
  options: RivalHealthOptions = {},
): void {
  const constrained = options.constrainedRunwayTicks ?? 364;
  const distressed = options.distressedRunwayTicks ?? 120;
  const restructure = options.restructureRunwayTicks ?? 45;
  const runway = economics.runwayTicks;
  if (runway === null || economics.netCashflow >= 0) {
    if (rival.health !== 'restructured') rival.health = 'healthy';
    return;
  }

  if (runway <= restructure) {
    const maxRestructures = options.exitAfterRestructures ?? 2;
    if ((options.canExit ?? true) && rival.restructureCount >= maxRestructures) {
      rival.health = 'exited';
      return;
    }
    rival.health = 'restructured';
    rival.restructureCount += 1;
    rival.cash += Math.max(0, options.restructureInjection ?? Math.abs(economics.netCashflow) * 90);
    return;
  }
  if (runway <= distressed) {
    rival.health = 'distressed';
  } else if (runway <= constrained) {
    rival.health = 'constrained';
  } else {
    rival.health = 'healthy';
  }
}

function computeRivalPressure(
  economics: RivalEconomicsSnapshot,
  strategicPressure: number,
  options: RivalHealthOptions = {},
): RivalPressure {
  const constrained = options.constrainedRunwayTicks ?? 364;
  const distressed = options.distressedRunwayTicks ?? 120;
  const runway = economics.runwayTicks === null
    ? 0
    : Math.max(0, Math.min(1, 1 - economics.runwayTicks / constrained));
  const losses = economics.netCashflow >= 0
    ? 0
    : Math.max(0, Math.min(1, Math.abs(economics.netCashflow) / Math.max(1, economics.revenue)));
  const capacity = Math.max(
    0,
    Math.min(
      1,
      Math.max(
        economics.utilization === undefined ? 0 : (economics.utilization - 0.75) / 0.25,
        economics.unmetDemand === undefined ? 0 : economics.unmetDemand / Math.max(1, economics.revenue),
      ),
    ),
  );
  const strategic = Math.max(0, Math.min(1, strategicPressure));
  return {
    runway,
    losses,
    capacity,
    strategic,
    overall: Math.max(runway, losses, capacity, strategic, economics.runwayTicks !== null && economics.runwayTicks <= distressed ? 0.8 : 0),
  };
}

function inferRunwayTicks(cash: number, netCashflow: number): number | null {
  if (netCashflow >= 0) return null;
  return Math.max(0, cash / Math.abs(netCashflow));
}

function emptyPressure(): RivalPressure {
  return { overall: 0, runway: 0, losses: 0, capacity: 0, strategic: 0 };
}
