// TycoonOS — Network capacity topology
// Shared-capacity allocation for games where global/route capacity must be
// turned into local service: telecom, LEO broadband, metro, airline routes,
// cloud regions, logistics corridors, utilities.

export interface UsableCapacityInput {
  /** Raw network production before transfer/backhaul bottlenecks. */
  rawCapacity: number;
  /** Fixed transfer/backhaul capacity, e.g. gateways, depots, interconnects. */
  transferCapacity: number;
  /** Fraction of raw capacity usable without fixed transfer, e.g. relay links. */
  relayFraction?: number;
}

export interface UsableCapacityResult {
  rawCapacity: number;
  usableCapacity: number;
  strandedCapacity: number;
}

export interface NetworkSink<TSink extends string = string> {
  id: TSink;
  /** Whether this sink participates in allocation this tick. Defaults true. */
  active?: boolean;
  /** Relative priority/share target. 0 excludes the sink. */
  allocationWeight: number;
  /** Local max throughput/backhaul cap for this sink. Infinity if omitted. */
  localCapacityCap?: number;
  /** Demand/load trying to use this sink. Optional but useful for UI. */
  demand?: number;
}

export interface NetworkSinkAllocation<TSink extends string = string> {
  id: TSink;
  allocationWeight: number;
  targetShare: number;
  allocatedShare: number;
  allocatedCapacity: number;
  localCapacityCap: number;
  demand: number;
  unmetDemand: number;
  utilization: number;
  cappedByLocalCapacity: boolean;
}

export interface NetworkAllocationResult<TSink extends string = string> {
  totalCapacity: number;
  allocatedCapacity: number;
  strandedCapacity: number;
  allocations: NetworkSinkAllocation<TSink>[];
}

export function computeUsableCapacity(input: UsableCapacityInput): UsableCapacityResult {
  const rawCapacity = Math.max(0, input.rawCapacity);
  const transferCapacity = Math.max(0, input.transferCapacity);
  const relayFraction = Math.max(0, input.relayFraction ?? 0);
  const usableCapacity = Math.min(rawCapacity, transferCapacity + rawCapacity * relayFraction);
  return {
    rawCapacity,
    usableCapacity,
    strandedCapacity: Math.max(0, rawCapacity - usableCapacity),
  };
}

/**
 * Allocate shared capacity across active sinks by weight, respecting each
 * sink's local cap. Unused capacity from capped sinks is redistributed to
 * remaining eligible sinks until no more capacity can be placed.
 */
export function allocateNetworkCapacity<TSink extends string>(
  totalCapacity: number,
  sinks: readonly NetworkSink<TSink>[],
): NetworkAllocationResult<TSink> {
  const safeCapacity = Math.max(0, totalCapacity);
  const active = sinks
    .filter((sink) => sink.active !== false && sink.allocationWeight > 0)
    .map((sink) => ({
      sink,
      remainingCap: Math.max(0, sink.localCapacityCap ?? Infinity),
      allocated: 0,
    }));

  let remainingCapacity = safeCapacity;
  const open = new Set(active.map((_, index) => index));

  while (remainingCapacity > 0.000001 && open.size > 0) {
    const totalWeight = [...open].reduce((sum, index) => sum + active[index].sink.allocationWeight, 0);
    if (totalWeight <= 0) break;

    let placedThisRound = 0;
    for (const index of [...open]) {
      const item = active[index];
      const proposed = remainingCapacity * (item.sink.allocationWeight / totalWeight);
      const placed = Math.min(proposed, item.remainingCap);
      if (placed > 0) {
        item.allocated += placed;
        item.remainingCap -= placed;
        placedThisRound += placed;
      }
      if (item.remainingCap <= 0.000001) open.delete(index);
    }

    if (placedThisRound <= 0.000001) break;
    remainingCapacity -= placedThisRound;
  }

  const activeById = new Map(active.map((item) => [item.sink.id, item]));
  const targetShares = normalizeNetworkWeights(sinks);
  const allocatedCapacity = active.reduce((sum, item) => sum + item.allocated, 0);

  return {
    totalCapacity: safeCapacity,
    allocatedCapacity,
    strandedCapacity: Math.max(0, safeCapacity - allocatedCapacity),
    allocations: sinks.map((sink) => {
      const item = activeById.get(sink.id);
      const allocated = item?.allocated ?? 0;
      const demand = Math.max(0, sink.demand ?? 0);
      const cap = Math.max(0, sink.localCapacityCap ?? Infinity);
      return {
        id: sink.id,
        allocationWeight: Math.max(0, sink.allocationWeight),
        targetShare: targetShares[sink.id],
        allocatedShare: safeCapacity > 0 ? allocated / safeCapacity : 0,
        allocatedCapacity: allocated,
        localCapacityCap: cap,
        demand,
        unmetDemand: Math.max(0, demand - allocated),
        utilization: demand / Math.max(1, allocated),
        cappedByLocalCapacity: Number.isFinite(cap) && allocated >= cap - 0.000001,
      };
    }),
  };
}

export function normalizeNetworkWeights<TSink extends string>(
  sinks: readonly NetworkSink<TSink>[],
): Record<TSink, number> {
  const active = sinks.filter((sink) => sink.active !== false && sink.allocationWeight > 0);
  const total = active.reduce((sum, sink) => sum + sink.allocationWeight, 0);
  return sinks.reduce((record, sink) => {
    record[sink.id] = total > 0 && sink.active !== false ? Math.max(0, sink.allocationWeight) / total : 0;
    return record;
  }, {} as Record<TSink, number>);
}

export function networkHeadroomTarget(currentDemand: number, utilization: number): number {
  const demand = Math.max(0, currentDemand);
  if (utilization > 0.9) return demand * 1.9;
  if (utilization > 0.75) return demand * 1.6;
  if (utilization > 0.55) return demand * 1.35;
  return demand * 1.2;
}
