// TycoonOS — Pricing demand economics
// Pure helpers for recurring service price and upfront unit/hardware price
// response. Games provide reference prices + sensitivities; the engine returns
// demand/churn multipliers without owning the game's market model.

export interface PriceBounds {
  floor?: number;
  ceiling?: number;
}

export interface RecurringPriceDemandInput {
  price: number;
  referencePrice: number;
  /** 0 = insensitive, 1 = normal, >1 = very sensitive. */
  sensitivity: number;
  /** 0-1 competitive pressure; high pressure makes premiums punish harder. */
  competitivePressure?: number;
  /** Extra market/regional sensitivity, 0-1. */
  marketSensitivity?: number;
  /** Demand boost allowed for discounting. Default 1.25. */
  maxDiscountBoost?: number;
  /** Demand floor for extreme overpricing. Default 0.03. */
  minDemandFactor?: number;
}

export interface UpfrontPriceDemandInput {
  price: number;
  referencePrice: number;
  sensitivity: number;
  maxDiscountBoost?: number;
  minDemandFactor?: number;
}

export interface ChurnPenaltyInput {
  price: number;
  referencePrice: number;
  sensitivity: number;
  competitivePressure?: number;
  marketSensitivity?: number;
  maxPenalty?: number;
}

export interface UnitEconomicsInput {
  price: number;
  unitCost: number;
}

export function clampPrice(price: number, bounds: PriceBounds = {}): number {
  const floor = bounds.floor ?? 0;
  const ceiling = bounds.ceiling ?? Infinity;
  return Math.max(floor, Math.min(ceiling, price));
}

export function recurringPriceDemandFactor(input: RecurringPriceDemandInput): number {
  const reference = Math.max(0.000001, input.referencePrice);
  const ratio = Math.max(0, input.price) / reference;
  const sensitivity = Math.max(0, input.sensitivity);
  const pressure = Math.max(0, input.competitivePressure ?? 0);
  const market = Math.max(0, input.marketSensitivity ?? 0);

  if (ratio <= 1) {
    return Math.min(input.maxDiscountBoost ?? 1.25, 1 + (1 - ratio) * sensitivity * 0.42);
  }

  const premium = ratio - 1;
  const competitivePenalty = 1 + pressure * 0.9 + market * 0.35;
  return Math.max(input.minDemandFactor ?? 0.03, 1 - premium * sensitivity * competitivePenalty);
}

export function upfrontPriceDemandFactor(input: UpfrontPriceDemandInput): number {
  const reference = Math.max(0.000001, input.referencePrice);
  const ratio = Math.max(0, input.price) / reference;
  const sensitivity = Math.max(0, input.sensitivity);

  if (ratio <= 1) {
    return Math.min(input.maxDiscountBoost ?? 1.18, 1 + (1 - ratio) * sensitivity * 0.32);
  }

  const premium = ratio - 1;
  return Math.max(input.minDemandFactor ?? 0.03, Math.pow(1 + premium * sensitivity * 1.8, -1.35));
}

export function recurringPriceChurnPenalty(input: ChurnPenaltyInput): number {
  const reference = Math.max(0.000001, input.referencePrice);
  const premium = Math.max(0, Math.max(0, input.price) / reference - 1);
  const pressure = Math.max(0, input.competitivePressure ?? 0);
  const market = Math.max(0, input.marketSensitivity ?? 0);
  const penalty = premium * (0.001 + input.sensitivity * market * 0.003 + pressure * 0.0018);
  return Math.min(input.maxPenalty ?? 0.018, penalty);
}

export function unitMargin(input: UnitEconomicsInput): number {
  return input.price - input.unitCost;
}

export function unitMarginPct(input: UnitEconomicsInput): number {
  if (input.price <= 0) return 0;
  return unitMargin(input) / input.price;
}
