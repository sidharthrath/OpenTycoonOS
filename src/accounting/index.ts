// TycoonOS — Accounting
// Period statements, capex financing, debt service, dilution, depreciation
// flow-through, cashflow, and solvency checks. This complements `financial`
// (simple cash/runway/funding helpers) and `balance-sheet` (asset-liability
// management for financial institutions).

export type AccountingAssetStatus = 'active' | 'disposed';
export type SolvencyStatus = 'solvent' | 'strained' | 'insolvent';

export interface AccountingAsset<TAsset extends string = string> {
  id: string;
  type: TAsset;
  costBasis: number;
  bookValue: number;
  accumulatedDepreciation: number;
  placedInServiceDay: number;
  usefulLifeTicks: number;
  salvageValue?: number;
  status: AccountingAssetStatus;
}

export interface DebtInstrument<TDebt extends string = string> {
  id: string;
  type: TDebt;
  principal: number;
  outstandingPrincipal: number;
  annualInterestRate: number;
  issuedDay: number;
  principalPaymentPerTick?: number;
  termTicks?: number;
  ticksElapsed: number;
  interestPaid: number;
  principalPaid: number;
}

export interface EquityRound {
  id: string;
  day: number;
  cashRaised: number;
  preMoneyValuation: number;
  equitySold: number;
  playerOwnershipAfter: number;
}

export interface AccountingState<TAsset extends string = string, TDebt extends string = string> {
  cash: number;
  retainedEarnings: number;
  playerOwnership: number;
  assets: Record<string, AccountingAsset<TAsset>>;
  debt: Record<string, DebtInstrument<TDebt>>;
  equityRounds: EquityRound[];
  cumulativeRevenue: number;
  cumulativeOperatingExpenses: number;
  cumulativeDepreciation: number;
  cumulativeInterestExpense: number;
  cumulativeTaxes: number;
  cumulativeCapex: number;
  cumulativeDebtRaised: number;
  cumulativeEquityRaised: number;
  cumulativeDividends: number;
  lastStatement: AccountingStatement | null;
}

export interface CapitalPurchaseInput<TAsset extends string = string> {
  id: string;
  type: TAsset;
  cost: number;
  usefulLifeTicks: number;
  placedInServiceDay?: number;
  salvageValue?: number;
}

export interface DebtRaiseInput<TDebt extends string = string> {
  id: string;
  type: TDebt;
  principal: number;
  annualInterestRate: number;
  issuedDay?: number;
  principalPaymentPerTick?: number;
  termTicks?: number;
}

export interface EquityRaiseInput {
  id: string;
  cashRaised: number;
  preMoneyValuation: number;
  day?: number;
  minPlayerOwnership?: number;
}

export interface DebtServiceResult {
  interestExpense: number;
  principalPaid: number;
  cashPaid: number;
}

export interface EquityRaiseResult {
  success: boolean;
  cashRaised: number;
  equitySold: number;
  playerOwnershipAfter: number;
}

export interface IncomeStatement {
  revenue: number;
  operatingExpenses: number;
  depreciation: number;
  ebit: number;
  interestExpense: number;
  taxes: number;
  netIncome: number;
}

export interface CashflowStatement {
  operatingCashflow: number;
  investingCashflow: number;
  financingCashflow: number;
  netCashflow: number;
  endingCash: number;
  capex: number;
  debtRaised: number;
  equityRaised: number;
  interestPaid: number;
  debtPrincipalPaid: number;
  dividends: number;
}

export interface AccountingBalanceSheet {
  cash: number;
  assetBookValue: number;
  totalAssets: number;
  debt: number;
  equity: number;
  retainedEarnings: number;
  playerOwnership: number;
}

export interface AccountingStatement {
  periodStartDay?: number;
  periodEndDay?: number;
  income: IncomeStatement;
  cashflow: CashflowStatement;
  balanceSheet: AccountingBalanceSheet;
}

export interface AccountingPeriodInput<TAsset extends string = string, TDebt extends string = string> {
  periodStartDay?: number;
  periodEndDay?: number;
  ticks?: number;
  ticksPerYear?: number;
  revenue?: number;
  operatingExpenses?: number;
  taxes?: number;
  capitalPurchases?: readonly CapitalPurchaseInput<TAsset>[];
  debtRaises?: readonly DebtRaiseInput<TDebt>[];
  equityRaises?: readonly EquityRaiseInput[];
  dividends?: number;
}

export interface SolvencyCheckOptions {
  minCash?: number;
  minEquity?: number;
  maxDebtToAssets?: number;
  minInterestCoverage?: number;
  minDebtServiceCoverage?: number;
  nextPeriodDebtService?: number;
  burnPerTick?: number;
  minRunwayTicks?: number;
}

export interface SolvencyCheckResult {
  status: SolvencyStatus;
  reasons: string[];
  cash: number;
  equity: number;
  debt: number;
  debtToAssets: number;
  interestCoverage: number | null;
  debtServiceCoverage: number | null;
  runwayTicks: number | null;
}

export function createAccountingState<TAsset extends string = string, TDebt extends string = string>(
  input: {
    cash: number;
    playerOwnership?: number;
    retainedEarnings?: number;
    assets?: readonly AccountingAsset<TAsset>[];
    debt?: readonly DebtInstrument<TDebt>[];
  },
): AccountingState<TAsset, TDebt> {
  const assets = {} as Record<string, AccountingAsset<TAsset>>;
  const debt = {} as Record<string, DebtInstrument<TDebt>>;
  for (const asset of input.assets ?? []) assets[asset.id] = { ...asset };
  for (const instrument of input.debt ?? []) debt[instrument.id] = { ...instrument };
  return {
    cash: input.cash,
    retainedEarnings: input.retainedEarnings ?? 0,
    playerOwnership: clamp01(input.playerOwnership ?? 1),
    assets,
    debt,
    equityRounds: [],
    cumulativeRevenue: 0,
    cumulativeOperatingExpenses: 0,
    cumulativeDepreciation: 0,
    cumulativeInterestExpense: 0,
    cumulativeTaxes: 0,
    cumulativeCapex: 0,
    cumulativeDebtRaised: 0,
    cumulativeEquityRaised: 0,
    cumulativeDividends: 0,
    lastStatement: null,
  };
}

export function purchaseCapitalAsset<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
  input: CapitalPurchaseInput<TAsset>,
): AccountingAsset<TAsset> {
  const cost = Math.max(0, input.cost);
  const salvageValue = Math.max(0, input.salvageValue ?? 0);
  const asset: AccountingAsset<TAsset> = {
    id: input.id,
    type: input.type,
    costBasis: cost,
    bookValue: cost,
    accumulatedDepreciation: 0,
    placedInServiceDay: input.placedInServiceDay ?? 0,
    usefulLifeTicks: Math.max(1, input.usefulLifeTicks),
    salvageValue,
    status: 'active',
  };
  state.assets[asset.id] = asset;
  state.cash -= cost;
  state.cumulativeCapex += cost;
  return asset;
}

export function raiseDebt<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
  input: DebtRaiseInput<TDebt>,
): DebtInstrument<TDebt> {
  const principal = Math.max(0, input.principal);
  const instrument: DebtInstrument<TDebt> = {
    id: input.id,
    type: input.type,
    principal,
    outstandingPrincipal: principal,
    annualInterestRate: Math.max(0, input.annualInterestRate),
    issuedDay: input.issuedDay ?? 0,
    principalPaymentPerTick: input.principalPaymentPerTick,
    termTicks: input.termTicks,
    ticksElapsed: 0,
    interestPaid: 0,
    principalPaid: 0,
  };
  state.debt[instrument.id] = instrument;
  state.cash += principal;
  state.cumulativeDebtRaised += principal;
  return instrument;
}

export function raiseEquity<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
  input: EquityRaiseInput,
): EquityRaiseResult {
  const cashRaised = Math.max(0, input.cashRaised);
  const preMoneyValuation = Math.max(0, input.preMoneyValuation);
  if (cashRaised <= 0 || preMoneyValuation <= 0) {
    return { success: false, cashRaised: 0, equitySold: 0, playerOwnershipAfter: state.playerOwnership };
  }
  const equitySold = cashRaised / (preMoneyValuation + cashRaised);
  const playerOwnershipAfter = state.playerOwnership * (1 - equitySold);
  if (playerOwnershipAfter < (input.minPlayerOwnership ?? 0)) {
    return { success: false, cashRaised: 0, equitySold: 0, playerOwnershipAfter: state.playerOwnership };
  }

  state.cash += cashRaised;
  state.playerOwnership = playerOwnershipAfter;
  state.cumulativeEquityRaised += cashRaised;
  state.equityRounds.push({
    id: input.id,
    day: input.day ?? 0,
    cashRaised,
    preMoneyValuation,
    equitySold,
    playerOwnershipAfter,
  });
  return { success: true, cashRaised, equitySold, playerOwnershipAfter };
}

export function depreciateAssets<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
  ticks: number = 1,
): number {
  let total = 0;
  const safeTicks = Math.max(0, ticks);
  for (const asset of Object.values(state.assets)) {
    if (asset.status !== 'active') continue;
    const depreciableBase = Math.max(0, asset.costBasis - (asset.salvageValue ?? 0));
    const lifetimeDepreciationRemaining = Math.max(0, depreciableBase - asset.accumulatedDepreciation);
    const depreciation = Math.min(lifetimeDepreciationRemaining, (depreciableBase / asset.usefulLifeTicks) * safeTicks);
    asset.accumulatedDepreciation += depreciation;
    asset.bookValue = Math.max(asset.salvageValue ?? 0, asset.bookValue - depreciation);
    total += depreciation;
  }
  state.cumulativeDepreciation += total;
  return total;
}

export function serviceDebt<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
  ticks: number = 1,
  ticksPerYear: number = 364,
): DebtServiceResult {
  let interestExpense = 0;
  let principalPaid = 0;
  const safeTicks = Math.max(0, ticks);
  const yearFraction = safeTicks / Math.max(1, ticksPerYear);

  for (const instrument of Object.values(state.debt)) {
    if (instrument.outstandingPrincipal <= 0) continue;
    const interest = instrument.outstandingPrincipal * instrument.annualInterestRate * yearFraction;
    const scheduledPrincipal = scheduledPrincipalPayment(instrument, safeTicks);
    const principal = Math.min(instrument.outstandingPrincipal, scheduledPrincipal);
    instrument.outstandingPrincipal -= principal;
    instrument.ticksElapsed += safeTicks;
    instrument.interestPaid += interest;
    instrument.principalPaid += principal;
    interestExpense += interest;
    principalPaid += principal;
  }

  const cashPaid = interestExpense + principalPaid;
  state.cash -= cashPaid;
  state.cumulativeInterestExpense += interestExpense;
  return { interestExpense, principalPaid, cashPaid };
}

export function applyAccountingPeriod<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
  input: AccountingPeriodInput<TAsset, TDebt>,
): AccountingStatement {
  const ticks = Math.max(0, input.ticks ?? 1);
  const ticksPerYear = Math.max(1, input.ticksPerYear ?? 364);
  const debtRaisedBefore = state.cumulativeDebtRaised;
  const equityRaisedBefore = state.cumulativeEquityRaised;
  const capexBefore = state.cumulativeCapex;

  for (const raise of input.debtRaises ?? []) raiseDebt(state, { ...raise, issuedDay: raise.issuedDay ?? input.periodEndDay });
  for (const raise of input.equityRaises ?? []) raiseEquity(state, { ...raise, day: raise.day ?? input.periodEndDay });
  for (const purchase of input.capitalPurchases ?? []) {
    purchaseCapitalAsset(state, { ...purchase, placedInServiceDay: purchase.placedInServiceDay ?? input.periodEndDay });
  }

  const revenue = Math.max(0, input.revenue ?? 0);
  const operatingExpenses = Math.max(0, input.operatingExpenses ?? 0);
  const taxes = Math.max(0, input.taxes ?? 0);
  const dividends = Math.max(0, input.dividends ?? 0);
  const depreciation = depreciateAssets(state, ticks);
  const debtService = serviceDebt(state, ticks, ticksPerYear);
  const ebit = revenue - operatingExpenses - depreciation;
  const netIncome = ebit - debtService.interestExpense - taxes;
  const operatingCashflow = revenue - operatingExpenses - debtService.interestExpense - taxes;
  const capex = state.cumulativeCapex - capexBefore;
  const debtRaised = state.cumulativeDebtRaised - debtRaisedBefore;
  const equityRaised = state.cumulativeEquityRaised - equityRaisedBefore;
  const investingCashflow = -capex;
  const financingCashflow = debtRaised + equityRaised - debtService.principalPaid - dividends;
  const netCashflow = operatingCashflow + investingCashflow + financingCashflow;

  state.cash += revenue - operatingExpenses - taxes - dividends;
  state.retainedEarnings += netIncome - dividends;
  state.cumulativeRevenue += revenue;
  state.cumulativeOperatingExpenses += operatingExpenses;
  state.cumulativeTaxes += taxes;
  state.cumulativeDividends += dividends;

  const statement: AccountingStatement = {
    periodStartDay: input.periodStartDay,
    periodEndDay: input.periodEndDay,
    income: {
      revenue,
      operatingExpenses,
      depreciation,
      ebit,
      interestExpense: debtService.interestExpense,
      taxes,
      netIncome,
    },
    cashflow: {
      operatingCashflow,
      investingCashflow,
      financingCashflow,
      netCashflow,
      endingCash: state.cash,
      capex,
      debtRaised,
      equityRaised,
      interestPaid: debtService.interestExpense,
      debtPrincipalPaid: debtService.principalPaid,
      dividends,
    },
    balanceSheet: accountingBalanceSheet(state),
  };
  state.lastStatement = statement;
  return statement;
}

export function accountingBalanceSheet<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
): AccountingBalanceSheet {
  const assetBookValue = totalAssetBookValue(state);
  const debt = totalDebtOutstanding(state);
  const totalAssets = state.cash + assetBookValue;
  return {
    cash: state.cash,
    assetBookValue,
    totalAssets,
    debt,
    equity: totalAssets - debt,
    retainedEarnings: state.retainedEarnings,
    playerOwnership: state.playerOwnership,
  };
}

export function totalAssetBookValue<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
): number {
  return Object.values(state.assets).reduce((sum, asset) => sum + (asset.status === 'active' ? Math.max(0, asset.bookValue) : 0), 0);
}

export function totalDebtOutstanding<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
): number {
  return Object.values(state.debt).reduce((sum, debt) => sum + Math.max(0, debt.outstandingPrincipal), 0);
}

export function nextDebtServiceDue<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
  ticks: number = 1,
  ticksPerYear: number = 364,
): DebtServiceResult {
  let interestExpense = 0;
  let principalPaid = 0;
  const yearFraction = Math.max(0, ticks) / Math.max(1, ticksPerYear);
  for (const instrument of Object.values(state.debt)) {
    if (instrument.outstandingPrincipal <= 0) continue;
    interestExpense += instrument.outstandingPrincipal * instrument.annualInterestRate * yearFraction;
    principalPaid += Math.min(instrument.outstandingPrincipal, scheduledPrincipalPayment(instrument, ticks));
  }
  return { interestExpense, principalPaid, cashPaid: interestExpense + principalPaid };
}

export function checkAccountingSolvency<TAsset extends string, TDebt extends string>(
  state: AccountingState<TAsset, TDebt>,
  options: SolvencyCheckOptions = {},
): SolvencyCheckResult {
  const sheet = accountingBalanceSheet(state);
  const last = state.lastStatement;
  const debtToAssets = sheet.totalAssets <= 0 ? Infinity : sheet.debt / sheet.totalAssets;
  const interestCoverage = last && last.income.interestExpense > 0
    ? last.income.ebit / last.income.interestExpense
    : null;
  const nextDebtService = options.nextPeriodDebtService ?? nextDebtServiceDue(state).cashPaid;
  const debtServiceCoverage = last && nextDebtService > 0
    ? last.cashflow.operatingCashflow / nextDebtService
    : null;
  const runwayTicks = options.burnPerTick && options.burnPerTick > 0
    ? state.cash / options.burnPerTick
    : null;
  const reasons: string[] = [];

  if (state.cash < (options.minCash ?? 0)) reasons.push('cash-below-minimum');
  if (sheet.equity < (options.minEquity ?? 0)) reasons.push('equity-below-minimum');
  if (debtToAssets > (options.maxDebtToAssets ?? 0.85)) reasons.push('debt-to-assets-too-high');
  if (interestCoverage !== null && interestCoverage < (options.minInterestCoverage ?? 1.5)) reasons.push('interest-coverage-too-low');
  if (debtServiceCoverage !== null && debtServiceCoverage < (options.minDebtServiceCoverage ?? 1.0)) reasons.push('debt-service-coverage-too-low');
  if (runwayTicks !== null && runwayTicks < (options.minRunwayTicks ?? 30)) reasons.push('runway-too-short');

  const insolvent = state.cash < 0 || sheet.equity < 0;
  return {
    status: insolvent ? 'insolvent' : reasons.length > 0 ? 'strained' : 'solvent',
    reasons,
    cash: state.cash,
    equity: sheet.equity,
    debt: sheet.debt,
    debtToAssets,
    interestCoverage,
    debtServiceCoverage,
    runwayTicks,
  };
}

function scheduledPrincipalPayment<TDebt extends string>(
  instrument: DebtInstrument<TDebt>,
  ticks: number,
): number {
  if (instrument.principalPaymentPerTick !== undefined) {
    return Math.max(0, instrument.principalPaymentPerTick) * Math.max(0, ticks);
  }
  if (instrument.termTicks !== undefined && instrument.termTicks > 0) {
    return instrument.principal / instrument.termTicks * Math.max(0, ticks);
  }
  return 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
