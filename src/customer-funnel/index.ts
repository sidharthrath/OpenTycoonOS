// TycoonOS — Customer Funnel
// Pre-market demand formation. Games provide domain-specific exposure and
// consideration drivers; the engine turns them into aware/considering cohorts
// and market pools without inventing a generic "brand score".

import type { MarketId, MarketOffer, MarketPool, MarketScoreResult } from '../market-engine/index.js';

export type FunnelId = string;

export interface FunnelCohort<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
  TMeta = unknown,
> {
  id: FunnelId;
  segmentId: TSegmentId;
  ownerId: TOwnerId;
  regionId?: TRegionId;
  /** Reachable audience for this owner inside the segment/region. */
  reachablePopulation: number;
  /** Customers who remember this owner/product exists. */
  aware: number;
  /** Customers actively open to evaluating this owner this tick/window. */
  considering: number;
  /** Generic exposure saturation. Games decide what activities create it. */
  exposureFatigue: number;
  cumulativeExposed: number;
  cumulativeAwarenessGained: number;
  cumulativeConsiderationGained: number;
  lastTickExposed: number;
  lastTickAwarenessGained: number;
  lastTickConsiderationGained: number;
  meta?: TMeta;
}

export interface FunnelState<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
  TMeta = unknown,
> {
  cohorts: Record<FunnelId, FunnelCohort<TSegmentId, TRegionId, TOwnerId, TMeta>>;
  lastResult: FunnelPhaseResult<TSegmentId, TRegionId, TOwnerId, TMeta> | null;
}

export interface CreateFunnelCohortInput<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
  TMeta = unknown,
> {
  id?: FunnelId;
  segmentId: TSegmentId;
  ownerId: TOwnerId;
  regionId?: TRegionId;
  reachablePopulation: number;
  aware?: number;
  considering?: number;
  exposureFatigue?: number;
  meta?: TMeta;
}

export interface CreateFunnelStateInput<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
  TMeta = unknown,
> {
  cohorts?: readonly CreateFunnelCohortInput<TSegmentId, TRegionId, TOwnerId, TMeta>[];
}

export interface FunnelTarget<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
> {
  cohortId?: FunnelId;
  segmentId?: TSegmentId;
  ownerId?: TOwnerId;
  regionId?: TRegionId;
}

export interface FunnelActivity<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
> extends FunnelTarget<TSegmentId, TRegionId, TOwnerId> {
  id?: FunnelId;
  /**
   * Potential unique contacts. If the activity matches multiple cohorts,
   * reach is split by remaining unaware population unless `allocation` is
   * `per-cohort`.
   */
  reach: number;
  /** 0-1+ multiplier from the game-specific activity mechanics. */
  efficiency?: number;
  /** 0-1 share of effective exposure that becomes remembered awareness. */
  memorability?: number;
  /** Optional cost for CAC/payback readouts; accounting remains game-owned. */
  cost?: number;
  /** Split reach across matched cohorts by default to avoid accidental overcounting. */
  allocation?: 'split' | 'per-cohort';
  tags?: readonly string[];
}

export interface ConsiderationDriver<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
> extends FunnelTarget<TSegmentId, TRegionId, TOwnerId> {
  id?: FunnelId;
  /**
   * Signed rate delta applied to aware customers. Positive drivers can come
   * from distribution, sales access, trials, referrals, or category demand.
   * Negative drivers can come from price distrust, service memory, stockouts,
   * regulatory friction, or poor product fit. The engine does not know why.
   */
  pull: number;
  reason?: string;
}

export interface FunnelPhaseOptions {
  /** Share of awareness forgotten per phase. Default: 0.01. */
  awarenessDecayRate?: number;
  /** Share of active consideration that goes stale per phase. Default: 0.25. */
  considerationDecayRate?: number;
  /** Baseline aware -> considering target rate before drivers. Default: 0.02. */
  baseConsiderationRate?: number;
  /** How quickly considering moves toward the target this phase. Default: 0.5. */
  considerationResponsiveness?: number;
  /** Higher values make awareness harder to grow as awareness saturates. Default: 0.5. */
  saturationSensitivity?: number;
  /** How strongly repeated exposure creates generic fatigue. Default: 0.2. */
  fatigueBuildRate?: number;
  /** Share of fatigue that fades per phase. Default: 0.1. */
  fatigueDecayRate?: number;
  /** Maximum exposure-fatigue penalty against effective reach. Default: 0.7. */
  maxFatiguePenalty?: number;
}

export interface FunnelPhaseInput<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
> {
  activities?: readonly FunnelActivity<TSegmentId, TRegionId, TOwnerId>[];
  considerationDrivers?: readonly ConsiderationDriver<TSegmentId, TRegionId, TOwnerId>[];
  options?: FunnelPhaseOptions;
}

export interface FunnelCohortDelta<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
> {
  cohortId: FunnelId;
  segmentId: TSegmentId;
  ownerId: TOwnerId;
  regionId?: TRegionId;
  exposed: number;
  awarenessGained: number;
  awarenessLost: number;
  considerationGained: number;
  considerationLost: number;
  endingAware: number;
  endingConsidering: number;
  activityCost: number;
  driverPull: number;
}

export interface FunnelAudienceSummary<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
> {
  id: FunnelId;
  segmentId: TSegmentId;
  regionId?: TRegionId;
  reachablePopulation: number;
  uniqueAware: number;
  uniqueConsidering: number;
  ownerAwareness: Partial<Record<TOwnerId, number>>;
  ownerConsidering: Partial<Record<TOwnerId, number>>;
  ownerConsideringShares: Partial<Record<TOwnerId, number>>;
}

export interface FunnelPhaseResult<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
  TMeta = unknown,
> {
  cohorts: FunnelCohortDelta<TSegmentId, TRegionId, TOwnerId>[];
  audiences: FunnelAudienceSummary<TSegmentId, TRegionId, TOwnerId>[];
  totalExposed: number;
  totalAwarenessGained: number;
  totalConsidering: number;
  totalActivityCost: number;
  state: FunnelState<TSegmentId, TRegionId, TOwnerId, TMeta>;
}

export interface FunnelMarketPoolConfig<
  TAttrs,
  TPoolId extends MarketId = MarketId,
  TFlow extends MarketId = MarketId,
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
> {
  scoreOffer: (offer: MarketOffer<TAttrs>, pool: MarketPool<TAttrs, TPoolId, TFlow>) => MarketScoreResult;
  attrs?: TAttrs;
  attrsForAudience?: (audience: FunnelAudienceSummary<TSegmentId, TRegionId, TOwnerId>) => TAttrs;
  poolIdForAudience?: (audience: FunnelAudienceSummary<TSegmentId, TRegionId, TOwnerId>) => TPoolId;
  flow?: TFlow;
  budgetCapForAudience?: (audience: FunnelAudienceSummary<TSegmentId, TRegionId, TOwnerId>) => number | undefined;
  /** Strength of owner consideration share as a market-engine ownerBoost. Default: 0.5. */
  ownerBoostStrength?: number;
  minDemand?: number;
}

const DEFAULT_OPTIONS: Required<FunnelPhaseOptions> = {
  awarenessDecayRate: 0.01,
  considerationDecayRate: 0.25,
  baseConsiderationRate: 0.02,
  considerationResponsiveness: 0.5,
  saturationSensitivity: 0.5,
  fatigueBuildRate: 0.2,
  fatigueDecayRate: 0.1,
  maxFatiguePenalty: 0.7,
};

export function createFunnelCohort<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
  TMeta = unknown,
>(
  input: CreateFunnelCohortInput<TSegmentId, TRegionId, TOwnerId, TMeta>,
): FunnelCohort<TSegmentId, TRegionId, TOwnerId, TMeta> {
  const reachablePopulation = Math.max(0, input.reachablePopulation);
  const aware = clamp(input.aware ?? 0, 0, reachablePopulation);
  return {
    id: input.id ?? funnelCohortId(input.ownerId, input.segmentId, input.regionId),
    segmentId: input.segmentId,
    ownerId: input.ownerId,
    regionId: input.regionId,
    reachablePopulation,
    aware,
    considering: clamp(input.considering ?? 0, 0, aware),
    exposureFatigue: clamp01(input.exposureFatigue ?? 0),
    cumulativeExposed: 0,
    cumulativeAwarenessGained: 0,
    cumulativeConsiderationGained: 0,
    lastTickExposed: 0,
    lastTickAwarenessGained: 0,
    lastTickConsiderationGained: 0,
    meta: input.meta,
  };
}

export function createFunnelState<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
  TMeta = unknown,
>(
  input: CreateFunnelStateInput<TSegmentId, TRegionId, TOwnerId, TMeta> = {},
): FunnelState<TSegmentId, TRegionId, TOwnerId, TMeta> {
  const cohorts = {} as Record<FunnelId, FunnelCohort<TSegmentId, TRegionId, TOwnerId, TMeta>>;
  for (const cohort of input.cohorts ?? []) {
    const created = createFunnelCohort(cohort);
    cohorts[created.id] = created;
  }
  return { cohorts, lastResult: null };
}

export function runFunnelPhase<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
  TMeta = unknown,
>(
  state: FunnelState<TSegmentId, TRegionId, TOwnerId, TMeta>,
  input: FunnelPhaseInput<TSegmentId, TRegionId, TOwnerId> = {},
): FunnelPhaseResult<TSegmentId, TRegionId, TOwnerId, TMeta> {
  const options = { ...DEFAULT_OPTIONS, ...input.options };
  const deltas = new Map<FunnelId, FunnelCohortDelta<TSegmentId, TRegionId, TOwnerId>>();

  for (const cohort of Object.values(state.cohorts)) {
    resetLastTick(cohort);
    cohort.exposureFatigue = clamp01(cohort.exposureFatigue * (1 - clamp01(options.fatigueDecayRate)));
    const awarenessLost = cohort.aware * clamp01(options.awarenessDecayRate);
    const considerationLost = cohort.considering * clamp01(options.considerationDecayRate);
    cohort.aware = Math.max(0, cohort.aware - awarenessLost);
    cohort.considering = Math.min(cohort.aware, Math.max(0, cohort.considering - considerationLost));
    deltas.set(cohort.id, createDelta(cohort, { awarenessLost, considerationLost }));
  }

  for (const activity of input.activities ?? []) {
    applyActivity(state, deltas, activity, options);
  }

  for (const cohort of Object.values(state.cohorts)) {
    const delta = requireDelta(deltas, cohort);
    const driverPull = sumDriverPull(cohort, input.considerationDrivers ?? []);
    const targetRate = clamp01(options.baseConsiderationRate + driverPull);
    const targetConsidering = cohort.aware * targetRate;
    const gap = targetConsidering - cohort.considering;
    const adjustment = gap * clamp01(options.considerationResponsiveness);
    if (adjustment >= 0) {
      const gain = Math.min(Math.max(0, cohort.aware - cohort.considering), adjustment);
      cohort.considering += gain;
      cohort.cumulativeConsiderationGained += gain;
      cohort.lastTickConsiderationGained += gain;
      delta.considerationGained += gain;
    } else {
      const loss = Math.min(cohort.considering, Math.abs(adjustment));
      cohort.considering -= loss;
      delta.considerationLost += loss;
    }
    delta.driverPull = driverPull;
    delta.endingAware = cohort.aware;
    delta.endingConsidering = cohort.considering;
  }

  const cohorts = Array.from(deltas.values());
  const result: FunnelPhaseResult<TSegmentId, TRegionId, TOwnerId, TMeta> = {
    cohorts,
    audiences: summarizeFunnelAudiences(state),
    totalExposed: cohorts.reduce((sum, delta) => sum + delta.exposed, 0),
    totalAwarenessGained: cohorts.reduce((sum, delta) => sum + delta.awarenessGained, 0),
    totalConsidering: cohorts.reduce((sum, delta) => sum + delta.endingConsidering, 0),
    totalActivityCost: cohorts.reduce((sum, delta) => sum + delta.activityCost, 0),
    state,
  };
  state.lastResult = result;
  return result;
}

export function summarizeFunnelAudiences<
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
  TMeta = unknown,
>(
  state: FunnelState<TSegmentId, TRegionId, TOwnerId, TMeta>,
): FunnelAudienceSummary<TSegmentId, TRegionId, TOwnerId>[] {
  const groups = new Map<FunnelId, FunnelCohort<TSegmentId, TRegionId, TOwnerId, TMeta>[]>();
  for (const cohort of Object.values(state.cohorts)) {
    const key = funnelAudienceId(cohort.segmentId, cohort.regionId);
    const existing = groups.get(key) ?? [];
    existing.push(cohort);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([id, cohorts]) => {
    const reachablePopulation = Math.max(...cohorts.map(cohort => cohort.reachablePopulation), 0);
    const ownerAwareness = {} as Partial<Record<TOwnerId, number>>;
    const ownerConsidering = {} as Partial<Record<TOwnerId, number>>;
    for (const cohort of cohorts) {
      ownerAwareness[cohort.ownerId] = (ownerAwareness[cohort.ownerId] ?? 0) + cohort.aware;
      ownerConsidering[cohort.ownerId] = (ownerConsidering[cohort.ownerId] ?? 0) + cohort.considering;
    }
    const uniqueAware = independentUnion(reachablePopulation, cohorts.map(cohort => cohort.aware));
    const uniqueConsidering = independentUnion(reachablePopulation, cohorts.map(cohort => cohort.considering));
    const ownerConsideringShares = {} as Partial<Record<TOwnerId, number>>;
    for (const [ownerId, considering] of typedEntries(ownerConsidering)) {
      ownerConsideringShares[ownerId] = uniqueConsidering > 0 ? considering / uniqueConsidering : 0;
    }
    const first = cohorts[0];
    return {
      id,
      segmentId: first.segmentId,
      regionId: first.regionId,
      reachablePopulation,
      uniqueAware,
      uniqueConsidering,
      ownerAwareness,
      ownerConsidering,
      ownerConsideringShares,
    };
  });
}

export function createFunnelMarketPools<
  TAttrs,
  TPoolId extends MarketId = MarketId,
  TFlow extends MarketId = MarketId,
  TSegmentId extends FunnelId = FunnelId,
  TRegionId extends FunnelId = FunnelId,
  TOwnerId extends FunnelId = FunnelId,
>(
  result: FunnelPhaseResult<TSegmentId, TRegionId, TOwnerId> | readonly FunnelAudienceSummary<TSegmentId, TRegionId, TOwnerId>[],
  config: FunnelMarketPoolConfig<TAttrs, TPoolId, TFlow, TSegmentId, TRegionId, TOwnerId>,
): MarketPool<TAttrs, TPoolId, TFlow>[] {
  const audiences: readonly FunnelAudienceSummary<TSegmentId, TRegionId, TOwnerId>[] =
    'audiences' in result ? result.audiences : result;
  const boostStrength = config.ownerBoostStrength ?? 0.5;
  const minDemand = config.minDemand ?? 0;
  return audiences
    .filter(audience => audience.uniqueConsidering > minDemand)
    .map(audience => ({
      id: config.poolIdForAudience?.(audience) ?? (audience.id as TPoolId),
      demand: audience.uniqueConsidering,
      flow: config.flow,
      budgetCap: config.budgetCapForAudience?.(audience),
      ownerBoosts: ownerBoostsFromConsidering(audience, boostStrength),
      attrs: (config.attrsForAudience?.(audience) ?? config.attrs) as TAttrs,
      scoreOffer: config.scoreOffer,
    }));
}

export function funnelCohortId<TOwnerId extends FunnelId, TSegmentId extends FunnelId, TRegionId extends FunnelId>(
  ownerId: TOwnerId,
  segmentId: TSegmentId,
  regionId?: TRegionId,
): FunnelId {
  return regionId === undefined ? `${ownerId}:${segmentId}` : `${ownerId}:${segmentId}:${regionId}`;
}

export function funnelAudienceId<TSegmentId extends FunnelId, TRegionId extends FunnelId>(
  segmentId: TSegmentId,
  regionId?: TRegionId,
): FunnelId {
  return regionId === undefined ? `${segmentId}` : `${segmentId}:${regionId}`;
}

function applyActivity<
  TSegmentId extends FunnelId,
  TRegionId extends FunnelId,
  TOwnerId extends FunnelId,
  TMeta,
>(
  state: FunnelState<TSegmentId, TRegionId, TOwnerId, TMeta>,
  deltas: Map<FunnelId, FunnelCohortDelta<TSegmentId, TRegionId, TOwnerId>>,
  activity: FunnelActivity<TSegmentId, TRegionId, TOwnerId>,
  options: Required<FunnelPhaseOptions>,
): void {
  const cohorts = Object.values(state.cohorts).filter(cohort => matchesTarget(cohort, activity));
  if (cohorts.length === 0) return;
  const totalUnaware = cohorts.reduce((sum, cohort) => sum + Math.max(0, cohort.reachablePopulation - cohort.aware), 0);
  const totalReach = Math.max(0, activity.reach);

  for (const cohort of cohorts) {
    const unaware = Math.max(0, cohort.reachablePopulation - cohort.aware);
    const splitWeight = totalUnaware > 0 ? unaware / totalUnaware : 1 / cohorts.length;
    const allocatedReach = activity.allocation === 'per-cohort' ? totalReach : totalReach * splitWeight;
    const fatiguePenalty = Math.min(options.maxFatiguePenalty, cohort.exposureFatigue * options.maxFatiguePenalty);
    const saturationPenalty = 1 - (cohort.aware / Math.max(1, cohort.reachablePopulation)) * clamp01(options.saturationSensitivity);
    const effectiveReach = Math.max(0, allocatedReach)
      * Math.max(0, activity.efficiency ?? 1)
      * Math.max(0, saturationPenalty)
      * Math.max(0, 1 - fatiguePenalty);
    const awarenessGained = Math.min(unaware, effectiveReach * clamp01(activity.memorability ?? 1));
    const delta = requireDelta(deltas, cohort);
    cohort.aware += awarenessGained;
    cohort.exposureFatigue = clamp01(cohort.exposureFatigue + (effectiveReach / Math.max(1, cohort.reachablePopulation)) * options.fatigueBuildRate);
    cohort.cumulativeExposed += effectiveReach;
    cohort.cumulativeAwarenessGained += awarenessGained;
    cohort.lastTickExposed += effectiveReach;
    cohort.lastTickAwarenessGained += awarenessGained;
    delta.exposed += effectiveReach;
    delta.awarenessGained += awarenessGained;
    delta.activityCost += (activity.cost ?? 0) * (activity.allocation === 'per-cohort' ? 1 : splitWeight);
    delta.endingAware = cohort.aware;
  }
}

function createDelta<
  TSegmentId extends FunnelId,
  TRegionId extends FunnelId,
  TOwnerId extends FunnelId,
  TMeta,
>(
  cohort: FunnelCohort<TSegmentId, TRegionId, TOwnerId, TMeta>,
  initial: Partial<FunnelCohortDelta<TSegmentId, TRegionId, TOwnerId>> = {},
): FunnelCohortDelta<TSegmentId, TRegionId, TOwnerId> {
  return {
    cohortId: cohort.id,
    segmentId: cohort.segmentId,
    ownerId: cohort.ownerId,
    regionId: cohort.regionId,
    exposed: 0,
    awarenessGained: 0,
    awarenessLost: 0,
    considerationGained: 0,
    considerationLost: 0,
    endingAware: cohort.aware,
    endingConsidering: cohort.considering,
    activityCost: 0,
    driverPull: 0,
    ...initial,
  };
}

function requireDelta<
  TSegmentId extends FunnelId,
  TRegionId extends FunnelId,
  TOwnerId extends FunnelId,
  TMeta,
>(
  deltas: Map<FunnelId, FunnelCohortDelta<TSegmentId, TRegionId, TOwnerId>>,
  cohort: FunnelCohort<TSegmentId, TRegionId, TOwnerId, TMeta>,
): FunnelCohortDelta<TSegmentId, TRegionId, TOwnerId> {
  let delta = deltas.get(cohort.id);
  if (!delta) {
    delta = createDelta(cohort);
    deltas.set(cohort.id, delta);
  }
  return delta;
}

function matchesTarget<
  TSegmentId extends FunnelId,
  TRegionId extends FunnelId,
  TOwnerId extends FunnelId,
  TMeta,
>(
  cohort: FunnelCohort<TSegmentId, TRegionId, TOwnerId, TMeta>,
  target: FunnelTarget<TSegmentId, TRegionId, TOwnerId>,
): boolean {
  if (target.cohortId !== undefined && target.cohortId !== cohort.id) return false;
  if (target.segmentId !== undefined && target.segmentId !== cohort.segmentId) return false;
  if (target.ownerId !== undefined && target.ownerId !== cohort.ownerId) return false;
  if (target.regionId !== undefined && target.regionId !== cohort.regionId) return false;
  return true;
}

function sumDriverPull<
  TSegmentId extends FunnelId,
  TRegionId extends FunnelId,
  TOwnerId extends FunnelId,
  TMeta,
>(
  cohort: FunnelCohort<TSegmentId, TRegionId, TOwnerId, TMeta>,
  drivers: readonly ConsiderationDriver<TSegmentId, TRegionId, TOwnerId>[],
): number {
  return drivers.reduce((sum, driver) => matchesTarget(cohort, driver) ? sum + driver.pull : sum, 0);
}

function ownerBoostsFromConsidering<
  TSegmentId extends FunnelId,
  TRegionId extends FunnelId,
  TOwnerId extends FunnelId,
>(
  audience: FunnelAudienceSummary<TSegmentId, TRegionId, TOwnerId>,
  strength: number,
): Partial<Record<MarketId, number>> {
  const boosts: Partial<Record<MarketId, number>> = {};
  const shares = typedEntries(audience.ownerConsideringShares).map(([, share]) => share);
  const averageShare = shares.length > 0 ? shares.reduce((sum, share) => sum + share, 0) / shares.length : 0;
  for (const [ownerId, share] of typedEntries(audience.ownerConsideringShares)) {
    boosts[ownerId] = Math.max(0.01, 1 + (share - averageShare) * strength);
  }
  return boosts;
}

function independentUnion(total: number, counts: readonly number[]): number {
  if (total <= 0) return 0;
  let notReached = 1;
  for (const count of counts) {
    notReached *= 1 - clamp(count / total, 0, 1);
  }
  return total * (1 - notReached);
}

function resetLastTick(cohort: { lastTickExposed: number; lastTickAwarenessGained: number; lastTickConsiderationGained: number }): void {
  cohort.lastTickExposed = 0;
  cohort.lastTickAwarenessGained = 0;
  cohort.lastTickConsiderationGained = 0;
}

function typedEntries<TKey extends string, TValue>(record: Partial<Record<TKey, TValue>>): [TKey, TValue][] {
  return Object.entries(record).filter((entry): entry is [TKey, TValue] => entry[1] !== undefined);
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
