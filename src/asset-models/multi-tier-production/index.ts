// TycoonOS — Multi-Tier Production (owned + contracted + spot allocator)
// Lifted + generalized from ai-tycoon's compute-market.ts. Pure functions,
// zero deps. See README for evidence + algorithm details.

export type ProductionTierKind = 'owned' | 'contracted' | 'spot';

export interface ProductionTier {
  kind: ProductionTierKind;
  /** Optional human label for UI/logging — "Shenzhen Line 1", "Foxconn deal", etc. */
  label?: string;
  /** Units producible this tick (cap). */
  capacityPerTick: number;
  /** Variable cost per unit produced. */
  costPerUnit: number;
  /**
   * Fixed cost per tick regardless of utilization. Capex amortization, leases,
   * retainers. Spot tiers usually have 0 here.
   */
  fixedCostPerTick: number;
}

export interface FulfillmentResult {
  unitsProduced: number;
  totalCost: number;
  perTier: Array<{
    kind: ProductionTierKind;
    label?: string;
    unitsProduced: number;
    variableCost: number;
    fixedCost: number;
  }>;
  unmetDemand: number;
}

/**
 * Allocate `demandUnits` across `tiers` cheapest-first by `costPerUnit`.
 * Fixed costs accrue from every tier whether it produced or not.
 *
 * Pure: doesn't mutate inputs. Tier order in the input is preserved in the
 * `perTier` output (allocation order is internal).
 */
export function fulfillDemand(
  tiers: ProductionTier[],
  demandUnits: number,
): FulfillmentResult {
  const safeDemand = Math.max(0, demandUnits);

  // Sort indices by cost ascending; we'll allocate via this order but emit
  // perTier in the original input order so the UI is stable.
  const order = tiers
    .map((_, idx) => idx)
    .sort((a, b) => tiers[a].costPerUnit - tiers[b].costPerUnit);

  const perTier = tiers.map((tier) => ({
    kind: tier.kind,
    label: tier.label,
    unitsProduced: 0,
    variableCost: 0,
    fixedCost: tier.fixedCostPerTick,
  }));

  let remaining = safeDemand;
  let unitsProduced = 0;
  for (const idx of order) {
    if (remaining <= 0) break;
    const tier = tiers[idx];
    const take = Math.min(remaining, Math.max(0, tier.capacityPerTick));
    if (take <= 0) continue;
    perTier[idx].unitsProduced = take;
    perTier[idx].variableCost = take * tier.costPerUnit;
    remaining -= take;
    unitsProduced += take;
  }

  const totalCost = perTier.reduce((s, t) => s + t.variableCost + t.fixedCost, 0);

  return {
    unitsProduced,
    totalCost,
    perTier,
    unmetDemand: remaining,
  };
}

// ─── Spot price curve (lifted from ai-tycoon/compute-market.ts:16-39) ─────

const SPOT_PRICE_CURVE: ReadonlyArray<readonly [number, number]> = [
  [1.0, 0.6],
  [0.8, 0.7],
  [0.6, 0.85],
  [0.4, 1.0],
  [0.25, 1.5],
  [0.15, 2.5],
  [0.05, 3.5],
  [0.0, 5.0],
];

/**
 * Convert spot-pool availability (0-1, fraction of pool unused) into a cost
 * multiplier (0.6× at full availability, 5× when nothing's left).
 *
 * Linear interpolation between curve points. Game multiplies its baseline
 * spot cost by this each tick to model dynamic scarcity pricing.
 */
export function spotPriceMultiplier(availability: number): number {
  const a = Math.max(0, Math.min(1, availability));
  for (let i = 0; i < SPOT_PRICE_CURVE.length - 1; i++) {
    const [a1, m1] = SPOT_PRICE_CURVE[i];
    const [a2, m2] = SPOT_PRICE_CURVE[i + 1];
    if (a <= a1 && a >= a2) {
      const t = (a - a2) / (a1 - a2);
      return m2 + (m1 - m2) * t;
    }
  }
  return SPOT_PRICE_CURVE[SPOT_PRICE_CURVE.length - 1][1];
}

// ─── Headroom planning (lifted from ai-tycoon/compute-market.ts:44-49) ────

/**
 * Capacity-planning safety factor based on current utilization. Multiply
 * current demand by this to get a target capacity that leaves room for
 * spikes / growth without over-building when slack is plentiful.
 *
 *   > 80% utilized → 1.8× target  (build aggressively)
 *   > 60%          → 1.5×
 *   > 40%          → 1.3×
 *   otherwise      → 1.2×
 */
export function headroomMultiplier(utilization: number): number {
  if (utilization > 0.80) return 1.8;
  if (utilization > 0.60) return 1.5;
  if (utilization > 0.40) return 1.3;
  return 1.2;
}
