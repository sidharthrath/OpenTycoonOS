// TycoonOS — Market Engine
// Generic demand resolution for tycoon games. Games provide domain-specific
// offers, pools, eligibility gates, and scoring. The engine handles the
// repeatable market-clearing loop: gate -> score -> allocate -> capacity cap
// -> diagnostics.

export type MarketId = string;

export type MarketGateResult =
  | boolean
  | {
      eligible: boolean;
      reason?: string;
    };

export interface MarketScore {
  /** Higher is better. Scores are normalized only relative to other offers in the same pool. */
  score: number;
  /** Optional explainability payload for UI/debug panels. */
  components?: Record<string, number>;
  /** Optional text notes for debug/readout surfaces. */
  notes?: readonly string[];
}

export type MarketScoreResult = number | MarketScore;

export interface MarketOffer<
  TAttrs = unknown,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
  TFlow extends MarketId = MarketId,
> {
  /** Stable id for this offer/product/route/service/tier. */
  id: TOfferId;
  /** Stable id for the actor that owns the offer: player, rival id, city authority, etc. */
  ownerId: TOwnerId;
  /** Customer-facing price in the unit the game cares about. Used by budget caps if set. */
  price?: number;
  /** Max demand units this offer can serve this market tick across all pools. Omit for uncapped. */
  capacity?: number;
  /** Restrict offer to specific market flows such as acquisition, renewal, or walk-up. */
  availableInFlows?: readonly TFlow[];
  /** Domain payload read by game-provided gates and scoring functions. */
  attrs: TAttrs;
}

export interface MarketPool<
  TAttrs = unknown,
  TPoolId extends MarketId = MarketId,
  TFlow extends MarketId = MarketId,
> {
  /** Stable id for this demand pool: segment, region, use case, cabin bucket, etc. */
  id: TPoolId;
  /** Demand units to resolve. Games decide whether units mean customers, rides, seats, devices, or dollars. */
  demand: number;
  /** Flow for visibility filtering. Omit to use the resolver's default flow. */
  flow?: TFlow;
  /** Optional price ceiling. Offers above this price are ineligible for this pool. */
  budgetCap?: number;
  /** Owner-specific score multipliers for this pool. Useful for loyalty, incumbent inertia, or local brand. */
  ownerBoosts?: Partial<Record<MarketId, number>>;
  /** Optional incumbent owner. If set, `incumbencyBoost` applies to that owner. */
  incumbentOwnerId?: MarketId;
  /** Optional incumbent score multiplier. Defaults to the resolver option if present, otherwise 1. */
  incumbencyBoost?: number;
  /** Hard gate. Return false or `{ eligible:false, reason }` to remove an offer from this pool. */
  isEligible?: (offer: MarketOffer<TAttrs>, pool: MarketPool<TAttrs, TPoolId, TFlow>) => MarketGateResult;
  /** Domain scoring. The engine does not know what the score means. */
  scoreOffer: (offer: MarketOffer<TAttrs>, pool: MarketPool<TAttrs, TPoolId, TFlow>) => MarketScoreResult;
}

export interface MarketEngineOptions<TFlow extends MarketId = MarketId> {
  /**
   * Power applied to boosted scores before allocation.
   * 1 = proportional. 2+ = winner-take-more. Default: 1.5.
   */
  sharpness?: number;
  /** Minimum positive score before exponentiation. Default: 0.01. */
  scoreFloor?: number;
  /** Default flow used when a pool does not specify one. */
  flow?: TFlow;
  /** Global owner score multipliers. Pool-level boosts multiply with these. */
  ownerBoosts?: Partial<Record<MarketId, number>>;
  /** Global multiplier applied when `pool.incumbentOwnerId` matches an offer owner. */
  incumbencyBoost?: number;
  /** Set false to leave demand unmet when a preferred offer is capacity-capped. Default: true. */
  redistributeCappedDemand?: boolean;
  /** Safety bound for iterative capacity redistribution. Default: 12. */
  maxRedistributionPasses?: number;
}

export interface MarketOfferEvaluation<
  TPoolId extends MarketId = MarketId,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
> {
  poolId: TPoolId;
  offerId: TOfferId;
  ownerId: TOwnerId;
  eligible: boolean;
  ineligibleReason?: string;
  rawScore: number;
  boostedScore: number;
  weightedScore: number;
  remainingCapacityBeforePool: number;
  components?: Record<string, number>;
  notes?: readonly string[];
}

export interface MarketAllocation<
  TPoolId extends MarketId = MarketId,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
> {
  poolId: TPoolId;
  offerId: TOfferId;
  ownerId: TOwnerId;
  /** Demand this offer would receive before capacity constraints. */
  targetDemand: number;
  /** Demand actually served after capacity constraints and redistribution. */
  servedDemand: number;
  /** Positive when this offer was preferred but could not serve all target demand. */
  unmetPreferredDemand: number;
  /** Served demand divided by pool demand. */
  shareOfPool: number;
  /** True when this offer exhausted its available capacity during this pool. */
  cappedByCapacity: boolean;
}

export interface MarketDemandSummary {
  /** Demand this owner/offer would receive before capacity constraints. */
  targetDemand: number;
  /** Demand this owner/offer actually served. */
  servedDemand: number;
  /** Positive when this owner/offer was preferred but could not serve all target demand. */
  unmetPreferredDemand: number;
}

export interface MarketPoolResult<
  TPoolId extends MarketId = MarketId,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
> {
  poolId: TPoolId;
  demand: number;
  servedDemand: number;
  unmetDemand: number;
  allocations: MarketAllocation<TPoolId, TOfferId, TOwnerId>[];
  evaluations: MarketOfferEvaluation<TPoolId, TOfferId, TOwnerId>[];
  byOffer: Record<TOfferId, MarketDemandSummary>;
  byOwner: Record<TOwnerId, MarketDemandSummary>;
}

export interface MarketResult<
  TPoolId extends MarketId = MarketId,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
> {
  totalDemand: number;
  servedDemand: number;
  unmetDemand: number;
  pools: MarketPoolResult<TPoolId, TOfferId, TOwnerId>[];
  byOffer: Record<TOfferId, MarketDemandSummary>;
  byOwner: Record<TOwnerId, MarketDemandSummary>;
}

interface Candidate<
  TPoolId extends MarketId,
  TOfferId extends MarketId,
  TOwnerId extends MarketId,
> {
  poolId: TPoolId;
  offerId: TOfferId;
  ownerId: TOwnerId;
  rawScore: number;
  boostedScore: number;
  weightedScore: number;
  remainingCapacityBeforePool: number;
  components?: Record<string, number>;
  notes?: readonly string[];
}

const DEFAULT_SHARPNESS = 1.5;
const DEFAULT_SCORE_FLOOR = 0.01;
const DEFAULT_MAX_REDISTRIBUTION_PASSES = 12;
const EPSILON = 0.000001;

/**
 * Resolve many pools against a shared offer set. Offer capacity is shared
 * across pools in the order pools are supplied, so games can model priority
 * explicitly by ordering urgent pools first.
 */
export function resolveMarket<
  TAttrs,
  TPoolId extends MarketId = MarketId,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
  TFlow extends MarketId = MarketId,
>(
  offers: readonly MarketOffer<TAttrs, TOfferId, TOwnerId, TFlow>[],
  pools: readonly MarketPool<TAttrs, TPoolId, TFlow>[],
  options: MarketEngineOptions<TFlow> = {},
): MarketResult<TPoolId, TOfferId, TOwnerId> {
  const remainingCapacity = createCapacityLedger(offers);
  const poolResults: MarketPoolResult<TPoolId, TOfferId, TOwnerId>[] = [];
  const byOffer = {} as Record<TOfferId, MarketDemandSummary>;
  const byOwner = {} as Record<TOwnerId, MarketDemandSummary>;
  let totalDemand = 0;
  let servedDemand = 0;

  for (const pool of pools) {
    const result = resolveMarketPool(offers, pool, options, remainingCapacity);
    poolResults.push(result);
    totalDemand += result.demand;
    servedDemand += result.servedDemand;
    mergeSummaryRecord(byOffer, result.byOffer);
    mergeSummaryRecord(byOwner, result.byOwner);
  }

  return {
    totalDemand,
    servedDemand,
    unmetDemand: Math.max(0, totalDemand - servedDemand),
    pools: poolResults,
    byOffer,
    byOwner,
  };
}

/**
 * Resolve a single pool. If `remainingCapacity` is supplied, it is mutated so
 * multiple pool resolutions can share the same capacity ledger.
 */
export function resolveMarketPool<
  TAttrs,
  TPoolId extends MarketId = MarketId,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
  TFlow extends MarketId = MarketId,
>(
  offers: readonly MarketOffer<TAttrs, TOfferId, TOwnerId, TFlow>[],
  pool: MarketPool<TAttrs, TPoolId, TFlow>,
  options: MarketEngineOptions<TFlow> = {},
  remainingCapacity: Record<MarketId, number> = createCapacityLedger(offers),
): MarketPoolResult<TPoolId, TOfferId, TOwnerId> {
  const demand = Math.max(0, pool.demand);
  const evaluations: MarketOfferEvaluation<TPoolId, TOfferId, TOwnerId>[] = [];
  const candidates: Candidate<TPoolId, TOfferId, TOwnerId>[] = [];
  const flow = pool.flow ?? options.flow;

  for (const offer of offers) {
    const capacityBefore = capacityFor(remainingCapacity, offer.id);
    const visible = isOfferVisible(offer, flow);
    const budgetOk = pool.budgetCap === undefined || (offer.price ?? 0) <= pool.budgetCap;
    const gate = visible && budgetOk ? normalizeGate(pool.isEligible?.(offer, pool) ?? true) : false;
    const eligible = typeof gate === 'boolean' ? gate : gate.eligible;
    const ineligibleReason = eligible
      ? undefined
      : typeof gate === 'boolean'
        ? visible
          ? 'budget-cap'
          : 'flow'
        : gate.reason;

    if (!eligible || demand <= 0 || capacityBefore <= EPSILON) {
      evaluations.push({
        poolId: pool.id,
        offerId: offer.id,
        ownerId: offer.ownerId,
        eligible: false,
        ineligibleReason: capacityBefore <= EPSILON && eligible ? 'capacity-exhausted' : ineligibleReason,
        rawScore: 0,
        boostedScore: 0,
        weightedScore: 0,
        remainingCapacityBeforePool: capacityBefore,
      });
      continue;
    }

    const score = normalizeScore(pool.scoreOffer(offer, pool));
    const rawScore = Math.max(0, finite(score.score));
    const boostedScore = rawScore * ownerBoostFor(offer.ownerId, pool, options);
    const weightedScore = Math.pow(Math.max(options.scoreFloor ?? DEFAULT_SCORE_FLOOR, boostedScore), options.sharpness ?? DEFAULT_SHARPNESS);
    const candidate: Candidate<TPoolId, TOfferId, TOwnerId> = {
      poolId: pool.id,
      offerId: offer.id,
      ownerId: offer.ownerId,
      rawScore,
      boostedScore,
      weightedScore,
      remainingCapacityBeforePool: capacityBefore,
      components: score.components,
      notes: score.notes,
    };
    candidates.push(candidate);
    evaluations.push({
      ...candidate,
      eligible: true,
    });
  }

  const allocations = allocateCandidates(candidates, demand, remainingCapacity, options);
  const byOffer = {} as Record<TOfferId, MarketDemandSummary>;
  const byOwner = {} as Record<TOwnerId, MarketDemandSummary>;
  let servedDemand = 0;

  for (const allocation of allocations) {
    servedDemand += allocation.servedDemand;
    addSummary(byOffer, allocation.offerId, allocation.targetDemand, allocation.servedDemand);
    addSummary(byOwner, allocation.ownerId, allocation.targetDemand, allocation.servedDemand);
  }

  return {
    poolId: pool.id,
    demand,
    servedDemand,
    unmetDemand: Math.max(0, demand - servedDemand),
    allocations,
    evaluations,
    byOffer,
    byOwner,
  };
}

/** Return only the served-demand share by owner. Useful for high-level UI. */
export function ownerServedShares<TOwnerId extends MarketId>(
  byOwner: Record<TOwnerId, MarketDemandSummary>,
): Record<TOwnerId, number> {
  const total = (Object.values(byOwner) as MarketDemandSummary[])
    .reduce((sum: number, line) => sum + line.servedDemand, 0);
  const shares = {} as Record<TOwnerId, number>;
  for (const [ownerId, line] of Object.entries(byOwner) as Array<[TOwnerId, MarketDemandSummary]>) {
    shares[ownerId] = total > 0 ? line.servedDemand / total : 0;
  }
  return shares;
}

/** Return only the served-demand share by offer. Useful for product/route tables. */
export function offerServedShares<TOfferId extends MarketId>(
  byOffer: Record<TOfferId, MarketDemandSummary>,
): Record<TOfferId, number> {
  const total = (Object.values(byOffer) as MarketDemandSummary[])
    .reduce((sum: number, line) => sum + line.servedDemand, 0);
  const shares = {} as Record<TOfferId, number>;
  for (const [offerId, line] of Object.entries(byOffer) as Array<[TOfferId, MarketDemandSummary]>) {
    shares[offerId] = total > 0 ? line.servedDemand / total : 0;
  }
  return shares;
}

function allocateCandidates<
  TPoolId extends MarketId,
  TOfferId extends MarketId,
  TOwnerId extends MarketId,
>(
  candidates: readonly Candidate<TPoolId, TOfferId, TOwnerId>[],
  demand: number,
  remainingCapacity: Record<MarketId, number>,
  options: MarketEngineOptions,
): MarketAllocation<TPoolId, TOfferId, TOwnerId>[] {
  if (demand <= 0 || candidates.length === 0) return [];

  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weightedScore, 0);
  if (totalWeight <= 0) return [];

  const targetByOffer = new Map<TOfferId, number>();
  for (const candidate of candidates) {
    targetByOffer.set(candidate.offerId, demand * (candidate.weightedScore / totalWeight));
  }

  const servedByOffer = new Map<TOfferId, number>();
  const cappedByOffer = new Set<TOfferId>();
  const redistribute = options.redistributeCappedDemand ?? true;
  const active = new Set(candidates.map((_, index) => index));
  let remainingDemand = demand;
  let passes = 0;
  const maxPasses = options.maxRedistributionPasses ?? DEFAULT_MAX_REDISTRIBUTION_PASSES;

  while (remainingDemand > EPSILON && active.size > 0 && passes < maxPasses) {
    passes += 1;
    const activeWeight = [...active].reduce((sum, index) => sum + candidates[index].weightedScore, 0);
    if (activeWeight <= 0) break;

    let servedThisPass = 0;
    for (const index of [...active]) {
      const candidate = candidates[index];
      const desired = remainingDemand * (candidate.weightedScore / activeWeight);
      const capacityLeft = capacityFor(remainingCapacity, candidate.offerId);
      const served = Math.min(desired, capacityLeft);
      if (served > EPSILON) {
        servedByOffer.set(candidate.offerId, (servedByOffer.get(candidate.offerId) ?? 0) + served);
        if (Number.isFinite(capacityLeft)) {
          remainingCapacity[candidate.offerId] = Math.max(0, capacityLeft - served);
        }
        servedThisPass += served;
      }
      if (served + EPSILON < desired || capacityFor(remainingCapacity, candidate.offerId) <= EPSILON) {
        cappedByOffer.add(candidate.offerId);
        active.delete(index);
      }
    }

    remainingDemand -= servedThisPass;
    if (!redistribute || servedThisPass <= EPSILON) break;
    if (servedThisPass >= remainingDemand + servedThisPass - EPSILON) break;
  }

  return candidates.map((candidate) => {
    const targetDemand = targetByOffer.get(candidate.offerId) ?? 0;
    const servedDemand = servedByOffer.get(candidate.offerId) ?? 0;
    return {
      poolId: candidate.poolId,
      offerId: candidate.offerId,
      ownerId: candidate.ownerId,
      targetDemand,
      servedDemand,
      unmetPreferredDemand: Math.max(0, targetDemand - servedDemand),
      shareOfPool: demand > 0 ? servedDemand / demand : 0,
      cappedByCapacity: cappedByOffer.has(candidate.offerId),
    };
  });
}

function createCapacityLedger<TAttrs, TOfferId extends MarketId, TOwnerId extends MarketId, TFlow extends MarketId>(
  offers: readonly MarketOffer<TAttrs, TOfferId, TOwnerId, TFlow>[],
): Record<MarketId, number> {
  const ledger: Record<MarketId, number> = {};
  for (const offer of offers) {
    ledger[offer.id] = offer.capacity === undefined ? Infinity : Math.max(0, offer.capacity);
  }
  return ledger;
}

function capacityFor(remainingCapacity: Record<MarketId, number>, offerId: MarketId): number {
  return remainingCapacity[offerId] ?? Infinity;
}

function isOfferVisible<TAttrs, TOfferId extends MarketId, TOwnerId extends MarketId, TFlow extends MarketId>(
  offer: MarketOffer<TAttrs, TOfferId, TOwnerId, TFlow>,
  flow: TFlow | undefined,
): boolean {
  if (!flow || !offer.availableInFlows || offer.availableInFlows.length === 0) return true;
  return offer.availableInFlows.includes(flow);
}

function normalizeGate(result: MarketGateResult): MarketGateResult {
  if (typeof result === 'boolean') return result;
  return {
    eligible: Boolean(result.eligible),
    reason: result.reason,
  };
}

function normalizeScore(result: MarketScoreResult): MarketScore {
  if (typeof result === 'number') return { score: result };
  return {
    score: result.score,
    components: result.components,
    notes: result.notes,
  };
}

function ownerBoostFor<TAttrs, TPoolId extends MarketId, TFlow extends MarketId>(
  ownerId: MarketId,
  pool: MarketPool<TAttrs, TPoolId, TFlow>,
  options: MarketEngineOptions<TFlow>,
): number {
  const globalBoost = options.ownerBoosts?.[ownerId] ?? 1;
  const poolBoost = pool.ownerBoosts?.[ownerId] ?? 1;
  const incumbentBoost = pool.incumbentOwnerId === ownerId
    ? pool.incumbencyBoost ?? options.incumbencyBoost ?? 1
    : 1;
  return Math.max(0, globalBoost * poolBoost * incumbentBoost);
}

function addSummary<TKey extends MarketId>(
  record: Record<TKey, MarketDemandSummary>,
  key: TKey,
  targetDemand: number,
  servedDemand: number,
): void {
  const existing = record[key] ?? { targetDemand: 0, servedDemand: 0, unmetPreferredDemand: 0 };
  existing.targetDemand += targetDemand;
  existing.servedDemand += servedDemand;
  existing.unmetPreferredDemand = Math.max(0, existing.targetDemand - existing.servedDemand);
  record[key] = existing;
}

function mergeSummaryRecord<TKey extends MarketId>(
  target: Record<TKey, MarketDemandSummary>,
  source: Record<TKey, MarketDemandSummary>,
): void {
  for (const [key, line] of Object.entries(source) as Array<[TKey, MarketDemandSummary]>) {
    addSummary(target, key, line.targetDemand, line.servedDemand);
  }
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
