// TycoonOS — External commodity prices + hedging
//
// External price series the player can't control. Random walk with
// occasional shocks. Hedge contracts let the player lock a price for a
// volume + duration; the hedge pays out vs spot at settlement.
//
// Use cases: jet fuel (airline), bunker fuel (shipping), batteries (EV),
// produce (restaurant), copper/lithium (mining), grain (brewery).

import type { TickPhase } from '../tick/index.js';

/** A commodity tracked in the market. */
export interface CommodityDef {
  id: string;
  /** Human label e.g. "Jet Fuel", "WTI Crude". */
  name: string;
  /** Display unit e.g. "gal", "bbl", "tonne". */
  unit: string;
  /** Starting spot price in dollars per unit. */
  basePrice: number;
  /** Daily random-walk volatility as fraction of price. e.g. 0.012 = 1.2%/day std. */
  dailyVolatility: number;
  /** Daily probability of a discrete shock event. e.g. 0.002 ≈ once per 500 days. */
  shockProbabilityPerDay: number;
  /** Shock magnitude bounds (multiplicative). e.g. [0.8, 1.5] = -20% to +50%. */
  shockMagnitudeRange: [number, number];
  /** Long-term mean-reversion target relative to basePrice. 1.0 = revert to base. */
  meanReversionTarget?: number;
  /** Strength of mean reversion (0 = pure random walk; 0.05 = strong pull). */
  meanReversionStrength?: number;
}

/** Per-commodity runtime state. */
export interface CommodityState {
  commodityId: string;
  /** Current spot price ($/unit). */
  spotPrice: number;
  /** Last-tick percentage change (informational, for UI). */
  lastTickPctChange: number;
  /** Days since the most recent shock event. */
  daysSinceShock: number;
}

/** Top-level commodities market state. */
export interface CommoditiesMarket {
  commodities: Record<string, CommodityState>;
}

/** A hedge contract — locks a fixed price for a volume over a duration. */
export interface HedgeContract {
  id: string;
  commodityId: string;
  /** Locked price ($/unit) the holder pays/receives. */
  strikePrice: number;
  /** Total volume hedged (in commodity units). */
  totalVolume: number;
  /** Volume already settled (consumed by the holder). */
  consumedVolume: number;
  /** Day the contract starts producing settlements. */
  startDay: number;
  /** Day the contract expires (no more settlements). */
  expiryDay: number;
  /** Premium paid up-front. */
  premiumPaid: number;
  /** Pay-as-go (mark-to-market) settlements accrued so far. */
  cumulativeSettlement: number;
}

/** State holding all hedge contracts. */
export interface HedgeBook {
  contracts: HedgeContract[];
  nextContractId: number;
}

export function createCommoditiesMarket(defs: readonly CommodityDef[]): CommoditiesMarket {
  const out: CommoditiesMarket = { commodities: {} };
  for (const d of defs) {
    out.commodities[d.id] = {
      commodityId: d.id,
      spotPrice: d.basePrice,
      lastTickPctChange: 0,
      daysSinceShock: 9999,
    };
  }
  return out;
}

export function createHedgeBook(): HedgeBook {
  return { contracts: [], nextContractId: 1 };
}

/** Get the current spot price for a commodity. */
export function spotPrice(market: CommoditiesMarket, id: string): number {
  return market.commodities[id]?.spotPrice ?? 0;
}

/**
 * Tick all commodity prices forward one day. Random walk + shock check.
 * Caller injects a deterministic RNG for reproducibility (seedable).
 */
export function tickCommodityPrices(
  market: CommoditiesMarket,
  defs: readonly CommodityDef[],
  rng: () => number = Math.random,
): void {
  for (const def of defs) {
    const state = market.commodities[def.id];
    if (!state) continue;

    let price = state.spotPrice;
    const previous = price;

    // Random walk (Box-Muller approx via two uniforms)
    const u1 = Math.max(1e-9, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    price *= 1 + z * def.dailyVolatility;

    // Shock event check
    if (rng() < def.shockProbabilityPerDay) {
      const [lo, hi] = def.shockMagnitudeRange;
      const mult = lo + (hi - lo) * rng();
      price *= mult;
      state.daysSinceShock = 0;
    } else {
      state.daysSinceShock += 1;
    }

    // Mean reversion pull
    const mrStrength = def.meanReversionStrength ?? 0;
    if (mrStrength > 0) {
      const target = def.basePrice * (def.meanReversionTarget ?? 1);
      price = price + (target - price) * mrStrength * 0.01;
    }

    // Floor at 10% of base — commodity prices don't go to zero
    price = Math.max(def.basePrice * 0.1, price);

    state.spotPrice = price;
    state.lastTickPctChange = previous > 0 ? (price - previous) / previous : 0;
  }
}

/** TickPhase factory for the random-walk price step. */
export function commoditiesPricePhase<S>(
  getMarket: (s: S) => CommoditiesMarket,
  getDefs: (s: S) => readonly CommodityDef[],
  rng?: () => number,
): TickPhase<S> {
  return (state) => {
    tickCommodityPrices(getMarket(state), getDefs(state), rng);
  };
}

// ─── Hedge contracts ──────────────────────────────────────────────────────

/**
 * Sign a hedge contract at the current spot. Premium = volatility-priced
 * insurance — the game decides the formula via `premiumRate` (e.g. 0.04 of
 * notional per year).
 */
export function signHedge(
  book: HedgeBook,
  market: CommoditiesMarket,
  input: {
    commodityId: string;
    volume: number;
    startDay: number;
    durationDays: number;
    /** Premium as fraction of notional (volume × strike) per year. */
    premiumRatePerYear: number;
  },
): { contract: HedgeContract; premium: number } | null {
  const spot = spotPrice(market, input.commodityId);
  if (spot <= 0 || input.volume <= 0 || input.durationDays <= 0) return null;
  const yearsCovered = input.durationDays / 364;
  const notional = input.volume * spot;
  const premium = notional * input.premiumRatePerYear * yearsCovered;
  const contract: HedgeContract = {
    id: `hedge-${book.nextContractId++}`,
    commodityId: input.commodityId,
    strikePrice: spot,
    totalVolume: input.volume,
    consumedVolume: 0,
    startDay: input.startDay,
    expiryDay: input.startDay + input.durationDays,
    premiumPaid: premium,
    cumulativeSettlement: 0,
  };
  book.contracts.push(contract);
  return { contract, premium };
}

/**
 * Consume hedge volume against today's actual usage. Returns the effective
 * blended rate across hedged + unhedged volume.
 *
 * Hedged volume settles at strikePrice (regardless of spot). The contract
 * accumulates a mark-to-market gain/loss = (spot - strike) × consumed. That
 * is informational; cash already changed hands at strike rate.
 */
export function consumeAtBlendedPrice(
  book: HedgeBook,
  market: CommoditiesMarket,
  commodityId: string,
  totalVolume: number,
  day: number,
): { totalCost: number; blendedRate: number; hedgedVolume: number; spotVolume: number } {
  const spot = spotPrice(market, commodityId);
  let remaining = totalVolume;
  let hedgedVolume = 0;
  let hedgedCost = 0;

  // Active contracts only, FIFO consumption
  for (const c of book.contracts) {
    if (c.commodityId !== commodityId) continue;
    if (day < c.startDay || day > c.expiryDay) continue;
    if (remaining <= 0) break;

    // Spread the remaining contract volume evenly over remaining days
    const daysRemaining = Math.max(1, c.expiryDay - day + 1);
    const dailyAllowance = (c.totalVolume - c.consumedVolume) / daysRemaining;
    const take = Math.min(remaining, dailyAllowance);
    if (take <= 0) continue;

    hedgedVolume += take;
    hedgedCost += take * c.strikePrice;
    c.consumedVolume += take;
    c.cumulativeSettlement += take * (spot - c.strikePrice);
    remaining -= take;
  }

  const spotCost = remaining * spot;
  const totalCost = hedgedCost + spotCost;
  const blendedRate = totalVolume > 0 ? totalCost / totalVolume : spot;
  return { totalCost, blendedRate, hedgedVolume, spotVolume: remaining };
}

/** Active fraction of needs covered for a commodity at a given day. UI helper. */
export function hedgeCoverage(
  book: HedgeBook,
  commodityId: string,
  day: number,
  expectedDailyVolume: number,
): number {
  if (expectedDailyVolume <= 0) return 0;
  let covered = 0;
  for (const c of book.contracts) {
    if (c.commodityId !== commodityId) continue;
    if (day < c.startDay || day > c.expiryDay) continue;
    const daysRemaining = Math.max(1, c.expiryDay - day + 1);
    const dailyAllowance = (c.totalVolume - c.consumedVolume) / daysRemaining;
    covered += dailyAllowance;
  }
  return Math.min(1, covered / expectedDailyVolume);
}

/** Drop expired contracts from the book. Returns count removed. */
export function pruneExpiredHedges(book: HedgeBook, day: number): number {
  const before = book.contracts.length;
  book.contracts = book.contracts.filter((c) => c.expiryDay >= day);
  return before - book.contracts.length;
}
