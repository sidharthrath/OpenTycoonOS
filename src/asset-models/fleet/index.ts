// TycoonOS — Fleet asset model
// Generic mobile/capital fleet economics: capacity, utilization, depreciation,
// leases, maintenance, downtime, and retirement. Suitable for aircraft,
// robotaxis, trucks, ships, hotel rooms, ride-share vehicles, or any asset pool
// that turns owned/leased units into sellable capacity.

import type { TickPhase } from '../../tick/index.js';

export type FleetUnitStatus = 'available' | 'maintenance' | 'retired';

export interface FleetAssetDef<TType extends string = string> {
  typeId: TType;
  name?: string;
  capacityPerTick: number;
  purchasePrice?: number;
  leaseCostPerTick?: number;
  operatingCostPerTick?: number;
  variableCostPerCapacityUnit?: number;
  maintenanceCostPerTick?: number;
  depreciationPerTick?: number;
  usefulLifeTicks?: number;
  baseDowntimeRate?: number;
  conditionDecayPerTick?: number;
  maintenanceRestore?: number;
}

export interface FleetUnit<TType extends string = string> {
  id: string;
  typeId: TType;
  ageTicks: number;
  condition: number;
  status: FleetUnitStatus;
  leased: boolean;
  bookValue: number;
  remainingMaintenanceTicks: number;
}

export interface FleetState<TType extends string = string> {
  units: Record<string, FleetUnit<TType>>;
  lastTickCapacity: number;
  lastTickDowntimeUnits: number;
  lastTickLeaseCost: number;
  lastTickOperatingCost: number;
  lastTickMaintenanceCost: number;
  lastTickDepreciation: number;
  cumulativeLeaseCost: number;
  cumulativeOperatingCost: number;
  cumulativeMaintenanceCost: number;
  cumulativeDepreciation: number;
}

export interface AddFleetUnitsInput<TType extends string = string> {
  typeId: TType;
  count: number;
  startIndex?: number;
  idPrefix?: string;
  leased?: boolean;
  condition?: number;
  ageTicks?: number;
  bookValue?: number;
}

export interface FleetTickOptions {
  rng?: () => number;
  maintenanceConditionThreshold?: number;
  maintenanceTicks?: number;
  maintenanceCostMultiplier?: number;
}

export interface FleetAssignment<TType extends string = string> {
  unitId: string;
  typeId: TType;
  capacityAssigned: number;
  variableCost: number;
}

export interface FleetAssignmentResult<TType extends string = string> {
  demand: number;
  assignedCapacity: number;
  unmetDemand: number;
  variableCost: number;
  assignments: FleetAssignment<TType>[];
}

export function createFleetState<TType extends string = string>(): FleetState<TType> {
  return {
    units: {},
    lastTickCapacity: 0,
    lastTickDowntimeUnits: 0,
    lastTickLeaseCost: 0,
    lastTickOperatingCost: 0,
    lastTickMaintenanceCost: 0,
    lastTickDepreciation: 0,
    cumulativeLeaseCost: 0,
    cumulativeOperatingCost: 0,
    cumulativeMaintenanceCost: 0,
    cumulativeDepreciation: 0,
  };
}

export function addFleetUnits<TType extends string>(
  state: FleetState<TType>,
  defs: Record<TType, FleetAssetDef<TType>>,
  input: AddFleetUnitsInput<TType>,
): FleetUnit<TType>[] {
  const def = defs[input.typeId];
  const units: FleetUnit<TType>[] = [];
  const count = Math.max(0, Math.floor(input.count));
  const prefix = input.idPrefix ?? input.typeId;
  const startIndex = input.startIndex ?? Object.keys(state.units).length;
  for (let index = 0; index < count; index += 1) {
    const unit: FleetUnit<TType> = {
      id: `${prefix}-${startIndex + index + 1}`,
      typeId: input.typeId,
      ageTicks: Math.max(0, input.ageTicks ?? 0),
      condition: clamp01(input.condition ?? 1),
      status: 'available',
      leased: input.leased ?? false,
      bookValue: Math.max(0, input.bookValue ?? (input.leased ? 0 : def.purchasePrice ?? 0)),
      remainingMaintenanceTicks: 0,
    };
    state.units[unit.id] = unit;
    units.push(unit);
  }
  return units;
}

export function retireFleetUnit<TType extends string>(
  state: FleetState<TType>,
  unitId: string,
): boolean {
  const unit = state.units[unitId];
  if (!unit || unit.status === 'retired') return false;
  unit.status = 'retired';
  unit.bookValue = 0;
  unit.remainingMaintenanceTicks = 0;
  return true;
}

export function fleetAvailableCapacity<TType extends string>(
  state: FleetState<TType>,
  defs: Record<TType, FleetAssetDef<TType>>,
): number {
  let total = 0;
  for (const unit of Object.values(state.units)) {
    if (unit.status !== 'available') continue;
    total += defs[unit.typeId].capacityPerTick * clamp01(unit.condition);
  }
  return total;
}

export function fleetBookValue<TType extends string>(state: FleetState<TType>): number {
  let total = 0;
  for (const unit of Object.values(state.units)) {
    if (unit.status !== 'retired') total += Math.max(0, unit.bookValue);
  }
  return total;
}

export function fleetUtilization<TType extends string>(
  assignedCapacity: number,
  state: FleetState<TType>,
  defs: Record<TType, FleetAssetDef<TType>>,
): number {
  return assignedCapacity / Math.max(1, fleetAvailableCapacity(state, defs));
}

export function assignFleetCapacity<TType extends string>(
  state: FleetState<TType>,
  defs: Record<TType, FleetAssetDef<TType>>,
  demand: number,
): FleetAssignmentResult<TType> {
  let remaining = Math.max(0, demand);
  let assignedCapacity = 0;
  let variableCost = 0;
  const assignments: FleetAssignment<TType>[] = [];

  for (const unit of Object.values(state.units)) {
    if (unit.status !== 'available' || remaining <= 0) continue;
    const def = defs[unit.typeId];
    const available = Math.max(0, def.capacityPerTick * clamp01(unit.condition));
    const capacityAssigned = Math.min(remaining, available);
    const lineCost = capacityAssigned * Math.max(0, def.variableCostPerCapacityUnit ?? 0);
    assignedCapacity += capacityAssigned;
    variableCost += lineCost;
    remaining -= capacityAssigned;
    assignments.push({
      unitId: unit.id,
      typeId: unit.typeId,
      capacityAssigned,
      variableCost: lineCost,
    });
  }

  return {
    demand: Math.max(0, demand),
    assignedCapacity,
    unmetDemand: Math.max(0, remaining),
    variableCost,
    assignments,
  };
}

export function tickFleet<TType extends string>(
  state: FleetState<TType>,
  defs: Record<TType, FleetAssetDef<TType>>,
  options: FleetTickOptions = {},
): void {
  const rng = options.rng ?? Math.random;
  const maintenanceThreshold = options.maintenanceConditionThreshold ?? 0.35;
  const maintenanceTicks = Math.max(1, Math.floor(options.maintenanceTicks ?? 1));
  const maintenanceCostMultiplier = Math.max(0, options.maintenanceCostMultiplier ?? 1);

  resetFleetTick(state);

  for (const unit of Object.values(state.units)) {
    if (unit.status === 'retired') continue;
    const def = defs[unit.typeId];
    unit.ageTicks += 1;

    const depreciation = depreciationForUnit(unit, def);
    unit.bookValue = Math.max(0, unit.bookValue - depreciation);
    state.lastTickDepreciation += depreciation;
    state.lastTickLeaseCost += unit.leased ? Math.max(0, def.leaseCostPerTick ?? 0) : 0;
    state.lastTickOperatingCost += Math.max(0, def.operatingCostPerTick ?? 0);

    if (unit.status === 'maintenance') {
      unit.remainingMaintenanceTicks = Math.max(0, unit.remainingMaintenanceTicks - 1);
      state.lastTickMaintenanceCost += Math.max(0, def.maintenanceCostPerTick ?? 0) * maintenanceCostMultiplier;
      if (unit.remainingMaintenanceTicks === 0) {
        unit.condition = clamp01(unit.condition + (def.maintenanceRestore ?? 0.25));
        unit.status = 'available';
      }
      continue;
    }

    unit.condition = clamp01(unit.condition - (def.conditionDecayPerTick ?? 0.01));
    const downtimeRisk = Math.max(0, def.baseDowntimeRate ?? 0) + Math.max(0, maintenanceThreshold - unit.condition) * 0.2;
    if (unit.condition <= maintenanceThreshold || rng() < downtimeRisk) {
      unit.status = 'maintenance';
      unit.remainingMaintenanceTicks = maintenanceTicks;
      state.lastTickDowntimeUnits += 1;
      continue;
    }

    state.lastTickCapacity += def.capacityPerTick * clamp01(unit.condition);
  }

  state.cumulativeDepreciation += state.lastTickDepreciation;
  state.cumulativeLeaseCost += state.lastTickLeaseCost;
  state.cumulativeOperatingCost += state.lastTickOperatingCost;
  state.cumulativeMaintenanceCost += state.lastTickMaintenanceCost;
}

export function fleetResetPhase<S, TType extends string>(
  getFleetState: (state: S) => FleetState<TType>,
): TickPhase<S> {
  return (state) => {
    resetFleetTick(getFleetState(state));
  };
}

export function resetFleetTick<TType extends string>(state: FleetState<TType>): void {
  state.lastTickCapacity = 0;
  state.lastTickDowntimeUnits = 0;
  state.lastTickLeaseCost = 0;
  state.lastTickOperatingCost = 0;
  state.lastTickMaintenanceCost = 0;
  state.lastTickDepreciation = 0;
}

function depreciationForUnit<TType extends string>(
  unit: FleetUnit<TType>,
  def: FleetAssetDef<TType>,
): number {
  if (unit.leased || unit.bookValue <= 0) return 0;
  if (def.depreciationPerTick !== undefined) return Math.max(0, def.depreciationPerTick);
  if (def.usefulLifeTicks !== undefined && def.usefulLifeTicks > 0) {
    return Math.min(unit.bookValue, Math.max(0, (def.purchasePrice ?? unit.bookValue) / def.usefulLifeTicks));
  }
  return 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
