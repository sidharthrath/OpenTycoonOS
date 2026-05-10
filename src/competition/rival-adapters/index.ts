// TycoonOS — Rival adapters
// Standard glue between rival-sim and the rest of the engine. These helpers let
// rivals own market offers, prices, capacity, finances, and investment behavior
// without each game rebuilding the same integration layer.

import type { BalanceSheetState } from '../../balance-sheet/index.js';
import {
  annualAssetYield,
  annualLiabilityExpense,
  balanceSheetSnapshot,
} from '../../balance-sheet/index.js';
import type { MarketId, MarketOffer, MarketResult } from '../../market-engine/index.js';
import { clampPrice, type PriceBounds } from '../../revenue-models/pricing/index.js';
import type {
  RivalAction,
  RivalDecision,
  RivalDecisionCadence,
  RivalDecisionContext,
  RivalEconomicsSnapshot,
  RivalSimState,
} from '../rival-sim/index.js';
import { shouldTakeRivalAction } from '../rival-sim/index.js';

export type RivalPricingPolicy =
  | 'match-player'
  | 'premium-incumbent'
  | 'low-cost-attacker'
  | 'distressed-discount'
  | 'load-factor-yield';

export interface RivalOfferTemplate<
  TAttrs = unknown,
  TOfferId extends MarketId = MarketId,
  TFlow extends MarketId = MarketId,
> {
  id: TOfferId;
  attrs: TAttrs;
  price?: number;
  capacity?: number;
  availableInFlows?: readonly TFlow[];
}

export interface BuildRivalOffersConfig<
  S,
  TRival extends RivalSimState,
  TAttrs = unknown,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
  TFlow extends MarketId = MarketId,
> {
  getRivals: (state: S) => readonly TRival[];
  getTemplates: (state: S, rival: TRival) => readonly RivalOfferTemplate<TAttrs, TOfferId, TFlow>[];
  getOwnerId?: (rival: TRival) => TOwnerId;
  getPrice?: (state: S, rival: TRival, template: RivalOfferTemplate<TAttrs, TOfferId, TFlow>) => number | undefined;
  getCapacity?: (state: S, rival: TRival, template: RivalOfferTemplate<TAttrs, TOfferId, TFlow>) => number | undefined;
  mapAttrs?: (state: S, rival: TRival, template: RivalOfferTemplate<TAttrs, TOfferId, TFlow>) => TAttrs;
  isActive?: (state: S, rival: TRival, template: RivalOfferTemplate<TAttrs, TOfferId, TFlow>) => boolean;
}

export interface RivalMarketEconomicsConfig<
  S,
  TRival extends RivalSimState,
  TPoolId extends MarketId = MarketId,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
> {
  getMarketResult: (state: S, rival: TRival) => MarketResult<TPoolId, TOfferId, TOwnerId>;
  getOwnerId?: (rival: TRival) => TOwnerId;
  getPricePerUnit: (state: S, rival: TRival) => number;
  getVariableCostPerUnit?: (state: S, rival: TRival) => number;
  getFixedCost?: (state: S, rival: TRival) => number;
  getCapex?: (state: S, rival: TRival) => number;
  getCapacity?: (state: S, rival: TRival) => number;
  getAdditionalRevenue?: (state: S, rival: TRival) => number;
  getAdditionalCost?: (state: S, rival: TRival) => number;
  getBalanceSheet?: (state: S, rival: TRival) => BalanceSheetState;
  balanceSheetFractionOfYear?: number;
}

export interface RivalPricingInput {
  policy: RivalPricingPolicy;
  currentPrice: number;
  playerPrice?: number;
  referencePrice?: number;
  utilization?: number;
  targetUtilization?: number;
  pressure?: number;
  bounds?: PriceBounds;
  strategy?: RivalSimState['strategy'];
}

export interface RivalPricingDecisionConfig<S, TRival extends RivalSimState> {
  id?: string;
  cadence?: RivalDecisionCadence;
  policy: RivalPricingPolicy | ((ctx: RivalDecisionContext<S, TRival>) => RivalPricingPolicy);
  getCurrentPrice: (state: S, rival: TRival) => number;
  setPrice: (state: S, rival: TRival, price: number) => void;
  getPlayerPrice?: (state: S, rival: TRival) => number;
  getReferencePrice?: (state: S, rival: TRival) => number;
  getUtilization?: (state: S, rival: TRival) => number;
  getTargetUtilization?: (state: S, rival: TRival) => number;
  bounds?: PriceBounds | ((state: S, rival: TRival) => PriceBounds);
  minChangePct?: number;
  describe?: (oldPrice: number, newPrice: number, ctx: RivalDecisionContext<S, TRival>) => string;
}

export interface RivalCapacityInvestmentConfig<S, TRival extends RivalSimState> {
  id?: string;
  cadence?: RivalDecisionCadence;
  getCapacity: (state: S, rival: TRival) => number;
  getTargetCapacity?: (state: S, rival: TRival, ctx: RivalDecisionContext<S, TRival>) => number;
  getInvestmentCost: (state: S, rival: TRival, capacityToAdd: number) => number;
  applyInvestment: (state: S, rival: TRival, capacityToAdd: number, cost: number) => void;
  capacityStep?: number | ((state: S, rival: TRival, ctx: RivalDecisionContext<S, TRival>) => number);
  minCapacityPressure?: number;
  maxCashShare?: number;
  describe?: (capacityToAdd: number, cost: number, ctx: RivalDecisionContext<S, TRival>) => string;
}

export interface RivalFundingDecisionConfig<S, TRival extends RivalSimState> {
  id?: string;
  cadence?: RivalDecisionCadence;
  getFundingAmount?: (state: S, rival: TRival, ctx: RivalDecisionContext<S, TRival>) => number;
  applyFunding?: (state: S, rival: TRival, amount: number) => void;
  runwayThresholdTicks?: number;
  minAmount?: number;
  describe?: (amount: number, ctx: RivalDecisionContext<S, TRival>) => string;
}

export interface RivalMarketEntryDecisionConfig<S, TRival extends RivalSimState, TMarketId extends string = string> {
  id?: string;
  cadence?: RivalDecisionCadence;
  getCandidates: (state: S, rival: TRival) => readonly TMarketId[];
  scoreCandidate?: (state: S, rival: TRival, candidate: TMarketId) => number;
  getEntryCost?: (state: S, rival: TRival, candidate: TMarketId) => number;
  enterMarket: (state: S, rival: TRival, candidate: TMarketId, cost: number) => void;
  maxCashShare?: number;
  describe?: (candidate: TMarketId, cost: number, ctx: RivalDecisionContext<S, TRival>) => string;
}

export interface SimpleRivalOperatingModelConfig<S, TRival extends RivalSimState> {
  getMarketResult: RivalMarketEconomicsConfig<S, TRival>['getMarketResult'];
  getPricePerUnit: RivalMarketEconomicsConfig<S, TRival>['getPricePerUnit'];
  getVariableCostPerUnit?: RivalMarketEconomicsConfig<S, TRival>['getVariableCostPerUnit'];
  getFixedCost?: RivalMarketEconomicsConfig<S, TRival>['getFixedCost'];
  getCapacity?: RivalMarketEconomicsConfig<S, TRival>['getCapacity'];
  pricing?: RivalPricingDecisionConfig<S, TRival>;
  capacityInvestment?: RivalCapacityInvestmentConfig<S, TRival>;
  funding?: RivalFundingDecisionConfig<S, TRival>;
}

export function buildRivalOffers<
  S,
  TRival extends RivalSimState,
  TAttrs = unknown,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
  TFlow extends MarketId = MarketId,
>(
  state: S,
  config: BuildRivalOffersConfig<S, TRival, TAttrs, TOfferId, TOwnerId, TFlow>,
): MarketOffer<TAttrs, TOfferId, TOwnerId, TFlow>[] {
  const offers: MarketOffer<TAttrs, TOfferId, TOwnerId, TFlow>[] = [];
  for (const rival of config.getRivals(state)) {
    if (rival.health === 'exited') continue;
    for (const template of config.getTemplates(state, rival)) {
      if (config.isActive && !config.isActive(state, rival, template)) continue;
      offers.push({
        id: template.id,
        ownerId: config.getOwnerId?.(rival) ?? (rival.id as TOwnerId),
        price: config.getPrice?.(state, rival, template) ?? template.price,
        capacity: config.getCapacity?.(state, rival, template) ?? template.capacity,
        availableInFlows: template.availableInFlows,
        attrs: config.mapAttrs?.(state, rival, template) ?? template.attrs,
      });
    }
  }
  return offers;
}

export function computeRivalEconomicsFromMarket<
  S,
  TRival extends RivalSimState,
  TPoolId extends MarketId = MarketId,
  TOfferId extends MarketId = MarketId,
  TOwnerId extends MarketId = MarketId,
>(
  config: RivalMarketEconomicsConfig<S, TRival, TPoolId, TOfferId, TOwnerId>,
): (state: S, rival: TRival) => Omit<RivalEconomicsSnapshot, 'cash' | 'runwayTicks'> {
  return (state, rival) => {
    const ownerId = config.getOwnerId?.(rival) ?? (rival.id as TOwnerId);
    const market = config.getMarketResult(state, rival);
    const ownerSummary = market.byOwner[ownerId];
    const served = ownerSummary?.servedDemand ?? 0;
    const unmet = ownerSummary?.unmetPreferredDemand ?? 0;
    const price = Math.max(0, config.getPricePerUnit(state, rival));
    const variableCostPerUnit = Math.max(0, config.getVariableCostPerUnit?.(state, rival) ?? 0);
    const fixedCost = Math.max(0, config.getFixedCost?.(state, rival) ?? 0);
    const capex = Math.max(0, config.getCapex?.(state, rival) ?? 0);
    const balanceSheetIncome = balanceSheetNetIncome(state, rival, config);
    const revenue = served * price + Math.max(0, config.getAdditionalRevenue?.(state, rival) ?? 0) + balanceSheetIncome.revenue;
    const cost = served * variableCostPerUnit + fixedCost + Math.max(0, config.getAdditionalCost?.(state, rival) ?? 0) + balanceSheetIncome.cost;
    const capacity = Math.max(0, config.getCapacity?.(state, rival) ?? 0);
    return {
      revenue,
      cost,
      capex,
      netCashflow: revenue - cost - capex,
      utilization: capacity <= 0 ? undefined : served / capacity,
      unmetDemand: unmet,
    };
  };
}

export function computeRivalPrice(input: RivalPricingInput): number {
  const current = Math.max(0, input.currentPrice);
  const reference = Math.max(0.000001, input.referencePrice ?? input.playerPrice ?? current);
  const pressure = clamp01(input.pressure ?? 0);
  const aggression = input.strategy?.priceAggression ?? 0.5;
  const marginDiscipline = input.strategy?.marginDiscipline ?? 0.5;
  const utilization = input.utilization ?? 0;
  const targetUtilization = input.targetUtilization ?? 0.82;

  let next = current;
  switch (input.policy) {
    case 'match-player':
      next = input.playerPrice ?? reference;
      break;
    case 'premium-incumbent':
      next = reference * (1.04 + marginDiscipline * 0.16 - pressure * 0.05);
      break;
    case 'low-cost-attacker':
      next = reference * (0.82 - aggression * 0.08 + marginDiscipline * 0.05);
      break;
    case 'distressed-discount':
      next = reference * (0.72 - pressure * 0.12 + marginDiscipline * 0.08);
      break;
    case 'load-factor-yield': {
      const utilizationGap = utilization - targetUtilization;
      next = current * (1 + utilizationGap * 0.22 + marginDiscipline * 0.015 - aggression * 0.01);
      break;
    }
  }
  return clampPrice(next, input.bounds);
}

export function createPricingDecision<S, TRival extends RivalSimState>(
  config: RivalPricingDecisionConfig<S, TRival>,
): RivalDecision<S, TRival> {
  return {
    id: config.id ?? 'rival-pricing',
    cadence: config.cadence ?? 'monthly',
    decide: (ctx) => {
      const oldPrice = Math.max(0, config.getCurrentPrice(ctx.state, ctx.rival));
      const policy = typeof config.policy === 'function' ? config.policy(ctx) : config.policy;
      const bounds = typeof config.bounds === 'function' ? config.bounds(ctx.state, ctx.rival) : config.bounds;
      const newPrice = computeRivalPrice({
        policy,
        currentPrice: oldPrice,
        playerPrice: config.getPlayerPrice?.(ctx.state, ctx.rival),
        referencePrice: config.getReferencePrice?.(ctx.state, ctx.rival),
        utilization: config.getUtilization?.(ctx.state, ctx.rival) ?? ctx.economics?.utilization,
        targetUtilization: config.getTargetUtilization?.(ctx.state, ctx.rival),
        pressure: ctx.pressure.overall,
        bounds,
        strategy: ctx.rival.strategy,
      });
      const minChangePct = config.minChangePct ?? 0.01;
      if (oldPrice > 0 && Math.abs(newPrice - oldPrice) / oldPrice < minChangePct) return null;
      config.setPrice(ctx.state, ctx.rival, newPrice);
      return action(ctx, 'price', config.describe?.(oldPrice, newPrice, ctx) ?? `${ctx.rival.name} reprices from ${fmt(oldPrice)} to ${fmt(newPrice)}`, {
        oldPrice,
        newPrice,
        policy,
      });
    },
  };
}

export function createCapacityInvestmentDecision<S, TRival extends RivalSimState>(
  config: RivalCapacityInvestmentConfig<S, TRival>,
): RivalDecision<S, TRival> {
  return {
    id: config.id ?? 'rival-capacity-investment',
    cadence: config.cadence ?? 'quarterly',
    shouldConsider: (ctx) => ctx.pressure.capacity >= (config.minCapacityPressure ?? 0.45),
    decide: (ctx) => {
      if (!shouldTakeRivalAction(ctx.rival.strategy, ctx.pressure, 'expansionBias')) return null;
      const currentCapacity = Math.max(0, config.getCapacity(ctx.state, ctx.rival));
      const step = typeof config.capacityStep === 'function'
        ? config.capacityStep(ctx.state, ctx.rival, ctx)
        : config.capacityStep ?? Math.max(1, currentCapacity * 0.15);
      const target = config.getTargetCapacity?.(ctx.state, ctx.rival, ctx) ?? currentCapacity + step;
      const capacityToAdd = Math.max(0, target - currentCapacity);
      if (capacityToAdd <= 0) return null;
      const cost = Math.max(0, config.getInvestmentCost(ctx.state, ctx.rival, capacityToAdd));
      const maxCashShare = config.maxCashShare ?? 0.55;
      if (cost > ctx.rival.cash * maxCashShare) return null;
      ctx.rival.cash -= cost;
      config.applyInvestment(ctx.state, ctx.rival, capacityToAdd, cost);
      return action(ctx, 'capacity', config.describe?.(capacityToAdd, cost, ctx) ?? `${ctx.rival.name} adds ${fmt(capacityToAdd)} capacity`, {
        capacityToAdd,
        cost,
      });
    },
  };
}

export function createFundingDecision<S, TRival extends RivalSimState>(
  config: RivalFundingDecisionConfig<S, TRival> = {},
): RivalDecision<S, TRival> {
  return {
    id: config.id ?? 'rival-funding',
    cadence: config.cadence ?? 'monthly',
    shouldConsider: (ctx) => {
      const threshold = config.runwayThresholdTicks ?? 120;
      return ctx.economics?.runwayTicks !== null && (ctx.economics?.runwayTicks ?? Infinity) <= threshold;
    },
    decide: (ctx) => {
      if (!shouldTakeRivalAction(ctx.rival.strategy, ctx.pressure, 'riskTolerance')) return null;
      const amount = Math.max(
        config.minAmount ?? 0,
        config.getFundingAmount?.(ctx.state, ctx.rival, ctx) ?? Math.max(0, Math.abs(ctx.economics?.netCashflow ?? 0) * 180),
      );
      if (amount <= 0) return null;
      if (config.applyFunding) {
        config.applyFunding(ctx.state, ctx.rival, amount);
      } else {
        ctx.rival.cash += amount;
      }
      return action(ctx, 'funding', config.describe?.(amount, ctx) ?? `${ctx.rival.name} raises ${fmt(amount)} in funding`, {
        amount,
      });
    },
  };
}

export function createMarketEntryDecision<S, TRival extends RivalSimState, TMarketId extends string = string>(
  config: RivalMarketEntryDecisionConfig<S, TRival, TMarketId>,
): RivalDecision<S, TRival> {
  return {
    id: config.id ?? 'rival-market-entry',
    cadence: config.cadence ?? 'quarterly',
    shouldConsider: (ctx) => ctx.pressure.strategic > 0.2 || ctx.rival.strategy.expansionBias > 0.45,
    decide: (ctx) => {
      if (!shouldTakeRivalAction(ctx.rival.strategy, ctx.pressure, 'expansionBias')) return null;
      const candidates = [...config.getCandidates(ctx.state, ctx.rival)];
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => (config.scoreCandidate?.(ctx.state, ctx.rival, b) ?? 0) - (config.scoreCandidate?.(ctx.state, ctx.rival, a) ?? 0));
      const candidate = candidates[0];
      const cost = Math.max(0, config.getEntryCost?.(ctx.state, ctx.rival, candidate) ?? 0);
      if (cost > ctx.rival.cash * (config.maxCashShare ?? 0.4)) return null;
      ctx.rival.cash -= cost;
      config.enterMarket(ctx.state, ctx.rival, candidate, cost);
      return action(ctx, 'market-entry', config.describe?.(candidate, cost, ctx) ?? `${ctx.rival.name} enters ${candidate}`, {
        marketId: candidate,
        cost,
      });
    },
  };
}

export function simpleRivalOperatingModel<S, TRival extends RivalSimState>(
  config: SimpleRivalOperatingModelConfig<S, TRival>,
): {
  computeEconomics: (state: S, rival: TRival) => Omit<RivalEconomicsSnapshot, 'cash' | 'runwayTicks'>;
  decisions: RivalDecision<S, TRival>[];
} {
  return {
    computeEconomics: computeRivalEconomicsFromMarket(config),
    decisions: [
      config.pricing ? createPricingDecision(config.pricing) : null,
      config.capacityInvestment ? createCapacityInvestmentDecision(config.capacityInvestment) : null,
      config.funding ? createFundingDecision(config.funding) : null,
    ].filter((decision): decision is RivalDecision<S, TRival> => decision !== null),
  };
}

function balanceSheetNetIncome<S, TRival extends RivalSimState>(
  state: S,
  rival: TRival,
  config: Pick<RivalMarketEconomicsConfig<S, TRival>, 'getBalanceSheet' | 'balanceSheetFractionOfYear'>,
): { revenue: number; cost: number } {
  const sheet = config.getBalanceSheet?.(state, rival);
  if (!sheet) return { revenue: 0, cost: 0 };
  const fraction = Math.max(0, config.balanceSheetFractionOfYear ?? 1 / 364);
  return {
    revenue: annualAssetYield(sheet) * fraction,
    cost: annualLiabilityExpense(sheet) * fraction,
  };
}

export function capitalRatioPressure(sheet: BalanceSheetState, targetCapitalRatio: number): number {
  const snapshot = balanceSheetSnapshot(sheet);
  if (targetCapitalRatio <= 0) return 0;
  return clamp01(1 - snapshot.capitalRatio / targetCapitalRatio);
}

function action<S, TRival extends RivalSimState, TPayload>(
  ctx: RivalDecisionContext<S, TRival>,
  kind: RivalAction['kind'],
  description: string,
  payload: TPayload,
): RivalAction<typeof kind, TPayload> {
  return {
    id: `${ctx.rival.id}-${kind}-${ctx.day}`,
    day: ctx.day,
    kind,
    description,
    payload,
  };
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
