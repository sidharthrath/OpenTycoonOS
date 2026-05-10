// TycoonOS — Marketplace dynamics
// Two-sided matching for platforms where supply and demand reinforce each other:
// delivery, mobility, lodging, dating, freelance, ticketing, hotel booking,
// payments, app stores, creator markets, and B2B exchanges.

export interface MarketplaceSide {
  units: number;
  quality?: number;
  trust?: number;
}

export interface MarketplaceMatchInput {
  supply: MarketplaceSide;
  demand: MarketplaceSide;
  pricePerMatch: number;
  takeRate?: number;
  maxMatches?: number;
  liquidity?: number;
  networkEffectStrength?: number;
}

export interface MarketplaceMatchResult {
  matches: number;
  unmetDemand: number;
  idleSupply: number;
  demandFillRate: number;
  supplyUtilization: number;
  liquidityScore: number;
  grossMerchandiseValue: number;
  platformRevenue: number;
  supplierRevenue: number;
}

export function matchMarketplace(input: MarketplaceMatchInput): MarketplaceMatchResult {
  const supplyUnits = Math.max(0, input.supply.units);
  const demandUnits = Math.max(0, input.demand.units);
  const maxMatches = Math.max(0, input.maxMatches ?? Infinity);
  const liquidityScore = marketplaceLiquidityScore(input.supply, input.demand, input.liquidity);
  const networkMultiplier = networkEffectMultiplier({
    supplyUnits,
    demandUnits,
    strength: input.networkEffectStrength ?? 0.15,
  });
  const rawMatches = Math.min(supplyUnits, demandUnits, maxMatches) * liquidityScore * networkMultiplier;
  const matches = Math.min(supplyUnits, demandUnits, maxMatches, rawMatches);
  const grossMerchandiseValue = matches * Math.max(0, input.pricePerMatch);
  const platformRevenue = grossMerchandiseValue * clampRate(input.takeRate ?? 0);

  return {
    matches,
    unmetDemand: Math.max(0, demandUnits - matches),
    idleSupply: Math.max(0, supplyUnits - matches),
    demandFillRate: demandUnits <= 0 ? 0 : matches / demandUnits,
    supplyUtilization: supplyUnits <= 0 ? 0 : matches / supplyUnits,
    liquidityScore,
    grossMerchandiseValue,
    platformRevenue,
    supplierRevenue: grossMerchandiseValue - platformRevenue,
  };
}

export function marketplaceLiquidityScore(
  supply: MarketplaceSide,
  demand: MarketplaceSide,
  liquidity: number = 1,
): number {
  const supplyQuality = sideQuality(supply);
  const demandQuality = sideQuality(demand);
  const balance = twoSidedBalance(supply.units, demand.units);
  return clamp01(liquidity) * supplyQuality * demandQuality * balance;
}

export function twoSidedBalance(supplyUnits: number, demandUnits: number): number {
  const supply = Math.max(0, supplyUnits);
  const demand = Math.max(0, demandUnits);
  if (supply <= 0 || demand <= 0) return 0;
  return Math.min(supply, demand) / Math.max(supply, demand);
}

export function networkEffectMultiplier(input: {
  supplyUnits: number;
  demandUnits: number;
  strength?: number;
  referenceScale?: number;
}): number {
  const referenceScale = Math.max(1, input.referenceScale ?? 1_000);
  const strength = Math.max(0, input.strength ?? 0);
  const geometricMean = Math.sqrt(Math.max(0, input.supplyUnits) * Math.max(0, input.demandUnits));
  return 1 + Math.log1p(geometricMean / referenceScale) * strength;
}

export function marketplaceTakeRateRevenue(
  grossMerchandiseValue: number,
  takeRate: number,
): number {
  return Math.max(0, grossMerchandiseValue) * clampRate(takeRate);
}

function sideQuality(side: MarketplaceSide): number {
  return clamp01(side.quality ?? 1) * clamp01(side.trust ?? 1);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampRate(value: number): number {
  return clamp01(value);
}
