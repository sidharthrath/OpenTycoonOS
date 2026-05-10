// TycoonOS — Infrastructure asset model
// Fixed long-lived assets: depots, factories, routes, stations, towers, ports,
// warehouses, plants, terminals, data centers. Models capacity, condition,
// upkeep, outages, depreciation, repair, and book value.

import type { TickPhase } from '../../tick/index.js';

export type InfrastructureStatus = 'active' | 'outage' | 'retired';

export interface InfrastructureAssetDef<TType extends string = string> {
  typeId: TType;
  name?: string;
  capacityPerTick: number;
  buildCost: number;
  upkeepPerTick?: number;
  depreciationPerTick?: number;
  usefulLifeTicks?: number;
  conditionDecayPerTick?: number;
  outageRisk?: number;
  outageDurationTicks?: number;
  repairCostPerConditionPoint?: number;
}

export interface InfrastructureAsset<TType extends string = string> {
  id: string;
  typeId: TType;
  ageTicks: number;
  condition: number;
  status: InfrastructureStatus;
  bookValue: number;
  remainingOutageTicks: number;
}

export interface InfrastructureState<TType extends string = string> {
  assets: Record<string, InfrastructureAsset<TType>>;
  lastTickCapacity: number;
  lastTickOutageCount: number;
  lastTickUpkeep: number;
  lastTickDepreciation: number;
  lastTickRepairCost: number;
  cumulativeUpkeep: number;
  cumulativeDepreciation: number;
  cumulativeRepairCost: number;
}

export interface BuildInfrastructureInput<TType extends string = string> {
  id: string;
  typeId: TType;
  condition?: number;
  ageTicks?: number;
  bookValue?: number;
}

export interface InfrastructureTickOptions {
  rng?: () => number;
}

export function createInfrastructureState<TType extends string = string>(): InfrastructureState<TType> {
  return {
    assets: {},
    lastTickCapacity: 0,
    lastTickOutageCount: 0,
    lastTickUpkeep: 0,
    lastTickDepreciation: 0,
    lastTickRepairCost: 0,
    cumulativeUpkeep: 0,
    cumulativeDepreciation: 0,
    cumulativeRepairCost: 0,
  };
}

export function buildInfrastructure<TType extends string>(
  state: InfrastructureState<TType>,
  defs: Record<TType, InfrastructureAssetDef<TType>>,
  input: BuildInfrastructureInput<TType>,
): InfrastructureAsset<TType> {
  const def = defs[input.typeId];
  const asset: InfrastructureAsset<TType> = {
    id: input.id,
    typeId: input.typeId,
    ageTicks: Math.max(0, input.ageTicks ?? 0),
    condition: clamp01(input.condition ?? 1),
    status: 'active',
    bookValue: Math.max(0, input.bookValue ?? def.buildCost),
    remainingOutageTicks: 0,
  };
  state.assets[asset.id] = asset;
  return asset;
}

export function retireInfrastructure<TType extends string>(
  state: InfrastructureState<TType>,
  assetId: string,
): boolean {
  const asset = state.assets[assetId];
  if (!asset || asset.status === 'retired') return false;
  asset.status = 'retired';
  asset.bookValue = 0;
  asset.remainingOutageTicks = 0;
  return true;
}

export function infrastructureCapacity<TType extends string>(
  state: InfrastructureState<TType>,
  defs: Record<TType, InfrastructureAssetDef<TType>>,
): number {
  let total = 0;
  for (const asset of Object.values(state.assets)) {
    if (asset.status !== 'active') continue;
    total += defs[asset.typeId].capacityPerTick * clamp01(asset.condition);
  }
  return total;
}

export function infrastructureBookValue<TType extends string>(
  state: InfrastructureState<TType>,
): number {
  let total = 0;
  for (const asset of Object.values(state.assets)) {
    if (asset.status !== 'retired') total += Math.max(0, asset.bookValue);
  }
  return total;
}

export function repairInfrastructure<TType extends string>(
  state: InfrastructureState<TType>,
  defs: Record<TType, InfrastructureAssetDef<TType>>,
  assetId: string,
  conditionPoints: number,
): number {
  const asset = state.assets[assetId];
  if (!asset || asset.status === 'retired') return 0;
  const def = defs[asset.typeId];
  const restore = Math.max(0, conditionPoints);
  const cost = restore * Math.max(0, def.repairCostPerConditionPoint ?? 0);
  asset.condition = clamp01(asset.condition + restore);
  if (asset.status === 'outage' && asset.condition > 0.2) {
    asset.status = 'active';
    asset.remainingOutageTicks = 0;
  }
  state.lastTickRepairCost += cost;
  state.cumulativeRepairCost += cost;
  return cost;
}

export function tickInfrastructure<TType extends string>(
  state: InfrastructureState<TType>,
  defs: Record<TType, InfrastructureAssetDef<TType>>,
  options: InfrastructureTickOptions = {},
): void {
  const rng = options.rng ?? Math.random;
  resetInfrastructureTick(state);

  for (const asset of Object.values(state.assets)) {
    if (asset.status === 'retired') continue;
    const def = defs[asset.typeId];
    asset.ageTicks += 1;
    asset.condition = clamp01(asset.condition - (def.conditionDecayPerTick ?? 0.002));

    const depreciation = depreciationForAsset(asset, def);
    asset.bookValue = Math.max(0, asset.bookValue - depreciation);
    state.lastTickDepreciation += depreciation;
    state.lastTickUpkeep += Math.max(0, def.upkeepPerTick ?? 0);

    if (asset.status === 'outage') {
      asset.remainingOutageTicks = Math.max(0, asset.remainingOutageTicks - 1);
      state.lastTickOutageCount += 1;
      if (asset.remainingOutageTicks === 0 && asset.condition > 0.1) {
        asset.status = 'active';
      }
      continue;
    }

    const outageRisk = Math.max(0, def.outageRisk ?? 0) + Math.max(0, 0.45 - asset.condition) * 0.1;
    if (rng() < outageRisk) {
      asset.status = 'outage';
      asset.remainingOutageTicks = Math.max(1, Math.floor(def.outageDurationTicks ?? 1));
      state.lastTickOutageCount += 1;
      continue;
    }

    state.lastTickCapacity += def.capacityPerTick * clamp01(asset.condition);
  }

  state.cumulativeUpkeep += state.lastTickUpkeep;
  state.cumulativeDepreciation += state.lastTickDepreciation;
}

export function infrastructureResetPhase<S, TType extends string>(
  getInfrastructureState: (state: S) => InfrastructureState<TType>,
): TickPhase<S> {
  return (state) => {
    resetInfrastructureTick(getInfrastructureState(state));
  };
}

export function resetInfrastructureTick<TType extends string>(
  state: InfrastructureState<TType>,
): void {
  state.lastTickCapacity = 0;
  state.lastTickOutageCount = 0;
  state.lastTickUpkeep = 0;
  state.lastTickDepreciation = 0;
  state.lastTickRepairCost = 0;
}

function depreciationForAsset<TType extends string>(
  asset: InfrastructureAsset<TType>,
  def: InfrastructureAssetDef<TType>,
): number {
  if (asset.bookValue <= 0) return 0;
  if (def.depreciationPerTick !== undefined) return Math.max(0, def.depreciationPerTick);
  if (def.usefulLifeTicks !== undefined && def.usefulLifeTicks > 0) {
    return Math.min(asset.bookValue, Math.max(0, def.buildCost / def.usefulLifeTicks));
  }
  return 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
