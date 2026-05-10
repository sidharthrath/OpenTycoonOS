/**
 * A long-term infrastructure contract.
 * Games use this for compute contracts, CDN peering deals, studio partnerships, etc.
 */
export interface InfraContract {
  id: string;
  /** Day the contract was signed */
  startDay: number;
  /** Contract duration in days */
  durationDays: number;
  /** Units of capacity secured */
  capacityUnits: number;
  /** Rate multiplier vs spot price (e.g. 0.85 = 15% discount) */
  rateMultiplier: number;
  /** Base cost per unit per day at time of signing */
  baseCostPerUnit: number;
}

/**
 * Sign a new contract. Returns the contract object.
 * Game is responsible for adding it to state and deducting any upfront costs.
 */
export function signContract(
  id: string,
  currentDay: number,
  durationDays: number,
  capacityUnits: number,
  rateMultiplier: number,
  baseCostPerUnit: number,
): InfraContract {
  return {
    id,
    startDay: currentDay,
    durationDays,
    capacityUnits,
    rateMultiplier,
    baseCostPerUnit,
  };
}

/** Remove expired contracts. Returns the still-active contracts. */
export function expireContracts(
  contracts: InfraContract[],
  currentDay: number,
): InfraContract[] {
  return contracts.filter(c => currentDay < c.startDay + c.durationDays);
}

/** Get total capacity from active contracts. */
export function getActiveContractCapacity(
  contracts: InfraContract[],
  currentDay: number,
): number {
  return contracts
    .filter(c => currentDay >= c.startDay && currentDay < c.startDay + c.durationDays)
    .reduce((sum, c) => sum + c.capacityUnits, 0);
}

/** Get daily cost of all active contracts. */
export function getContractDailyCost(
  contracts: InfraContract[],
  currentDay: number,
): number {
  return contracts
    .filter(c => currentDay >= c.startDay && currentDay < c.startDay + c.durationDays)
    .reduce((sum, c) => sum + c.capacityUnits * c.baseCostPerUnit * c.rateMultiplier, 0);
}
