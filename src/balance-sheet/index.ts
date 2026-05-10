// TycoonOS — Balance sheet / asset-liability management
// For games where the business earns on spread, risk, duration, leverage, and
// capital structure rather than simple product sales.

export interface BalanceSheetAsset<TAsset extends string = string> {
  id: string;
  type: TAsset;
  value: number;
  yieldRate?: number;
  riskWeight?: number;
  durationYears?: number;
}

export interface BalanceSheetLiability<TLiability extends string = string> {
  id: string;
  type: TLiability;
  value: number;
  costRate?: number;
  durationYears?: number;
}

export interface BalanceSheetState<
  TAsset extends string = string,
  TLiability extends string = string,
> {
  assets: Record<string, BalanceSheetAsset<TAsset>>;
  liabilities: Record<string, BalanceSheetLiability<TLiability>>;
  cash: number;
  retainedEarnings: number;
}

export interface BalanceSheetSnapshot {
  assets: number;
  liabilities: number;
  equity: number;
  riskWeightedAssets: number;
  capitalRatio: number;
  weightedAssetYield: number;
  weightedLiabilityCost: number;
  netInterestSpread: number;
  netInterestIncomePerYear: number;
  durationGapYears: number;
}

export interface BalanceSheetStressScenario {
  assetHaircut?: number;
  liabilityRunoff?: number;
  rateShock?: number;
  creditLossRate?: number;
}

export interface BalanceSheetStressResult extends BalanceSheetSnapshot {
  lossAbsorbed: number;
  liquidityNeeded: number;
  insolvent: boolean;
}

export function createBalanceSheet<
  TAsset extends string = string,
  TLiability extends string = string,
>(input: {
  assets?: readonly BalanceSheetAsset<TAsset>[];
  liabilities?: readonly BalanceSheetLiability<TLiability>[];
  cash?: number;
  retainedEarnings?: number;
} = {}): BalanceSheetState<TAsset, TLiability> {
  const state: BalanceSheetState<TAsset, TLiability> = {
    assets: {},
    liabilities: {},
    cash: Math.max(0, input.cash ?? 0),
    retainedEarnings: input.retainedEarnings ?? 0,
  };
  for (const asset of input.assets ?? []) state.assets[asset.id] = { ...asset };
  for (const liability of input.liabilities ?? []) state.liabilities[liability.id] = { ...liability };
  return state;
}

export function addBalanceSheetAsset<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
  asset: BalanceSheetAsset<TAsset>,
): void {
  state.assets[asset.id] = { ...asset, value: Math.max(0, asset.value) };
}

export function addBalanceSheetLiability<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
  liability: BalanceSheetLiability<TLiability>,
): void {
  state.liabilities[liability.id] = { ...liability, value: Math.max(0, liability.value) };
}

export function totalBalanceSheetAssets<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
): number {
  return state.cash + sumValues(Object.values(state.assets));
}

export function totalBalanceSheetLiabilities<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
): number {
  return sumValues(Object.values(state.liabilities));
}

export function balanceSheetEquity<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
): number {
  return totalBalanceSheetAssets(state) - totalBalanceSheetLiabilities(state) + state.retainedEarnings;
}

export function riskWeightedAssets<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
): number {
  let total = 0;
  for (const asset of Object.values(state.assets)) {
    total += Math.max(0, asset.value) * Math.max(0, asset.riskWeight ?? 1);
  }
  return total;
}

export function balanceSheetSnapshot<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
): BalanceSheetSnapshot {
  const assets = totalBalanceSheetAssets(state);
  const liabilities = totalBalanceSheetLiabilities(state);
  const equity = balanceSheetEquity(state);
  const rwa = riskWeightedAssets(state);
  const annualAssetIncome = annualAssetYield(state);
  const annualLiabilityCost = annualLiabilityExpense(state);
  return {
    assets,
    liabilities,
    equity,
    riskWeightedAssets: rwa,
    capitalRatio: rwa <= 0 ? 0 : equity / rwa,
    weightedAssetYield: assets <= 0 ? 0 : annualAssetIncome / assets,
    weightedLiabilityCost: liabilities <= 0 ? 0 : annualLiabilityCost / liabilities,
    netInterestSpread: assets <= 0 || liabilities <= 0 ? 0 : annualAssetIncome / assets - annualLiabilityCost / liabilities,
    netInterestIncomePerYear: annualAssetIncome - annualLiabilityCost,
    durationGapYears: weightedAssetDuration(state) - weightedLiabilityDuration(state),
  };
}

export function applyBalanceSheetAccrual<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
  fractionOfYear: number,
): number {
  const income = balanceSheetSnapshot(state).netInterestIncomePerYear * Math.max(0, fractionOfYear);
  state.cash += income;
  state.retainedEarnings += income;
  return income;
}

export function stressBalanceSheet<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
  scenario: BalanceSheetStressScenario,
): BalanceSheetStressResult {
  const assetHaircut = clampRate(scenario.assetHaircut ?? 0);
  const liabilityRunoff = clampRate(scenario.liabilityRunoff ?? 0);
  const creditLossRate = clampRate(scenario.creditLossRate ?? 0);
  const rateShock = scenario.rateShock ?? 0;
  const stressed = createBalanceSheet({
    assets: Object.values(state.assets).map((asset) => ({
      ...asset,
      value: asset.value * (1 - assetHaircut - creditLossRate),
      yieldRate: Math.max(0, (asset.yieldRate ?? 0) + rateShock),
    })),
    liabilities: Object.values(state.liabilities).map((liability) => ({
      ...liability,
      value: liability.value * (1 - liabilityRunoff),
      costRate: Math.max(0, (liability.costRate ?? 0) + rateShock),
    })),
    cash: state.cash,
    retainedEarnings: state.retainedEarnings,
  });
  const before = balanceSheetSnapshot(state);
  const after = balanceSheetSnapshot(stressed);
  const liquidityNeeded = totalBalanceSheetLiabilities(state) * liabilityRunoff;
  return {
    ...after,
    lossAbsorbed: Math.max(0, before.equity - after.equity),
    liquidityNeeded,
    insolvent: after.equity < 0 || state.cash < liquidityNeeded,
  };
}

export function annualAssetYield<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
): number {
  let total = 0;
  for (const asset of Object.values(state.assets)) {
    total += Math.max(0, asset.value) * Math.max(0, asset.yieldRate ?? 0);
  }
  return total;
}

export function annualLiabilityExpense<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
): number {
  let total = 0;
  for (const liability of Object.values(state.liabilities)) {
    total += Math.max(0, liability.value) * Math.max(0, liability.costRate ?? 0);
  }
  return total;
}

function weightedAssetDuration<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
): number {
  const assets = Object.values(state.assets);
  const total = sumValues(assets);
  if (total <= 0) return 0;
  return assets.reduce((sum, asset) => sum + Math.max(0, asset.value) * Math.max(0, asset.durationYears ?? 0), 0) / total;
}

function weightedLiabilityDuration<TAsset extends string, TLiability extends string>(
  state: BalanceSheetState<TAsset, TLiability>,
): number {
  const liabilities = Object.values(state.liabilities);
  const total = sumValues(liabilities);
  if (total <= 0) return 0;
  return liabilities.reduce((sum, liability) => sum + Math.max(0, liability.value) * Math.max(0, liability.durationYears ?? 0), 0) / total;
}

function sumValues(items: readonly { value: number }[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
}

function clampRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
