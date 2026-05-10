// TycoonOS — Transaction revenue model
// Generic event/usage revenue for businesses that earn per completed action:
// rides, deliveries, bookings, payments, calls, tickets, inspections, trips, or
// marketplace orders. Unlike unit-sale, this supports fees, take rates, and
// channel/owner aggregation without implying a physical SKU.

import type { TickPhase } from '../../tick/index.js';

export interface TransactionInput<TLine extends string = string> {
  lineId: TLine;
  units: number;
  pricePerUnit: number;
  variableCostPerUnit?: number;
  fixedFee?: number;
  platformFeeRate?: number;
  ownerId?: string;
  channelId?: string;
}

export interface TransactionAggregate {
  units: number;
  grossRevenue: number;
  feeRevenue: number;
  netRevenue: number;
  variableCost: number;
}

export interface TransactionState<TLine extends string = string> {
  cumulativeUnits: number;
  cumulativeGrossRevenue: number;
  cumulativeFeeRevenue: number;
  cumulativeNetRevenue: number;
  cumulativeVariableCost: number;
  lastTickUnits: number;
  lastTickGrossRevenue: number;
  lastTickFeeRevenue: number;
  lastTickNetRevenue: number;
  lastTickVariableCost: number;
  byLine: Record<TLine, TransactionAggregate>;
  byOwner: Record<string, TransactionAggregate>;
  byChannel: Record<string, TransactionAggregate>;
}

export interface TransactionSummary {
  units: number;
  grossRevenue: number;
  feeRevenue: number;
  netRevenue: number;
  variableCost: number;
  grossProfit: number;
  grossMargin: number;
}

export function createTransactionState<TLine extends string = string>(): TransactionState<TLine> {
  return {
    cumulativeUnits: 0,
    cumulativeGrossRevenue: 0,
    cumulativeFeeRevenue: 0,
    cumulativeNetRevenue: 0,
    cumulativeVariableCost: 0,
    lastTickUnits: 0,
    lastTickGrossRevenue: 0,
    lastTickFeeRevenue: 0,
    lastTickNetRevenue: 0,
    lastTickVariableCost: 0,
    byLine: {} as Record<TLine, TransactionAggregate>,
    byOwner: {},
    byChannel: {},
  };
}

export function recordTransaction<TLine extends string>(
  state: TransactionState<TLine>,
  input: TransactionInput<TLine>,
): TransactionSummary {
  const units = Math.max(0, input.units);
  const grossRevenue = units * Math.max(0, input.pricePerUnit);
  const feeRevenue = Math.max(0, input.fixedFee ?? 0) + grossRevenue * clampRate(input.platformFeeRate ?? 0);
  const netRevenue = grossRevenue + feeRevenue;
  const variableCost = units * Math.max(0, input.variableCostPerUnit ?? 0);
  const summary = summarizeTransactionValues({
    units,
    grossRevenue,
    feeRevenue,
    netRevenue,
    variableCost,
  });

  state.cumulativeUnits += units;
  state.cumulativeGrossRevenue += grossRevenue;
  state.cumulativeFeeRevenue += feeRevenue;
  state.cumulativeNetRevenue += netRevenue;
  state.cumulativeVariableCost += variableCost;
  state.lastTickUnits += units;
  state.lastTickGrossRevenue += grossRevenue;
  state.lastTickFeeRevenue += feeRevenue;
  state.lastTickNetRevenue += netRevenue;
  state.lastTickVariableCost += variableCost;

  addAggregate(state.byLine, input.lineId, summary);
  if (input.ownerId) addAggregate(state.byOwner, input.ownerId, summary);
  if (input.channelId) addAggregate(state.byChannel, input.channelId, summary);

  return summary;
}

export function recordTransactions<TLine extends string>(
  state: TransactionState<TLine>,
  inputs: readonly TransactionInput<TLine>[],
): TransactionSummary {
  let units = 0;
  let grossRevenue = 0;
  let feeRevenue = 0;
  let netRevenue = 0;
  let variableCost = 0;
  for (const input of inputs) {
    const summary = recordTransaction(state, input);
    units += summary.units;
    grossRevenue += summary.grossRevenue;
    feeRevenue += summary.feeRevenue;
    netRevenue += summary.netRevenue;
    variableCost += summary.variableCost;
  }
  return summarizeTransactionValues({ units, grossRevenue, feeRevenue, netRevenue, variableCost });
}

export function resetTransactionTick<TLine extends string>(state: TransactionState<TLine>): void {
  state.lastTickUnits = 0;
  state.lastTickGrossRevenue = 0;
  state.lastTickFeeRevenue = 0;
  state.lastTickNetRevenue = 0;
  state.lastTickVariableCost = 0;
}

export function transactionResetPhase<S, TLine extends string>(
  getTransactionState: (state: S) => TransactionState<TLine>,
): TickPhase<S> {
  return (state) => {
    resetTransactionTick(getTransactionState(state));
  };
}

export function transactionSummary<TLine extends string>(
  state: TransactionState<TLine>,
): TransactionSummary {
  return summarizeTransactionValues({
    units: state.cumulativeUnits,
    grossRevenue: state.cumulativeGrossRevenue,
    feeRevenue: state.cumulativeFeeRevenue,
    netRevenue: state.cumulativeNetRevenue,
    variableCost: state.cumulativeVariableCost,
  });
}

export function lastTickTransactionSummary<TLine extends string>(
  state: TransactionState<TLine>,
): TransactionSummary {
  return summarizeTransactionValues({
    units: state.lastTickUnits,
    grossRevenue: state.lastTickGrossRevenue,
    feeRevenue: state.lastTickFeeRevenue,
    netRevenue: state.lastTickNetRevenue,
    variableCost: state.lastTickVariableCost,
  });
}

export function transactionGrossProfit(summary: TransactionSummary): number {
  return summary.netRevenue - summary.variableCost;
}

export function transactionGrossMargin(summary: TransactionSummary): number {
  return summary.netRevenue <= 0 ? 0 : transactionGrossProfit(summary) / summary.netRevenue;
}

function summarizeTransactionValues(values: Omit<TransactionSummary, 'grossProfit' | 'grossMargin'>): TransactionSummary {
  const grossProfit = values.netRevenue - values.variableCost;
  const grossMargin = values.netRevenue <= 0 ? 0 : grossProfit / values.netRevenue;
  return { ...values, grossProfit, grossMargin };
}

function addAggregate<TKey extends string>(
  record: Record<TKey, TransactionAggregate>,
  key: TKey,
  summary: TransactionSummary,
): void {
  const existing = record[key];
  if (existing) {
    existing.units += summary.units;
    existing.grossRevenue += summary.grossRevenue;
    existing.feeRevenue += summary.feeRevenue;
    existing.netRevenue += summary.netRevenue;
    existing.variableCost += summary.variableCost;
  } else {
    record[key] = {
      units: summary.units,
      grossRevenue: summary.grossRevenue,
      feeRevenue: summary.feeRevenue,
      netRevenue: summary.netRevenue,
      variableCost: summary.variableCost,
    };
  }
}

function clampRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
