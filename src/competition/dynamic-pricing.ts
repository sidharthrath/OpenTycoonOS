// TycoonOS — Competitor dynamic pricing.
// Generic "reprice based on player + cost floor + aggressiveness" helper.
// Extracted from streaming-tycoon, generalized for any game with priced tiers.

export interface DynamicPricingInput {
  currentPrice: number;
  playerPrice: number;
  costFloor: number;
  maxPrice: number;
  /** 0 = conservative (incumbent), 1 = aggressive (startup) */
  aggressiveness: number;
  /** Competitor's cash position for healthy-drift decision */
  cashHealthy: boolean;
  /** Player market share — if big, competitor reacts harder */
  playerMarketShare: number;
}

/**
 * Decide a new price given current price, player behavior, cost floor, aggressiveness.
 * Returns the new price (may equal currentPrice if no move).
 */
export function repriceAgainstPlayer(input: DynamicPricingInput): number {
  const {
    currentPrice, playerPrice, costFloor, maxPrice,
    aggressiveness, cashHealthy, playerMarketShare,
  } = input;

  const cutMax = 0.04 + aggressiveness * 0.08;    // 0.04-0.12
  const raiseMax = 0.03 + aggressiveness * 0.04;  // 0.03-0.07
  const playerIsBig = playerMarketShare > 0.15;

  // Reactive: player winning AND cheaper → undercut
  if (playerIsBig && playerPrice < currentPrice) {
    const target = Math.max(costFloor, currentPrice * (1 - cutMax * (0.5 + Math.random() * 0.5)));
    return Math.round(target);
  }
  // Reactive: player priced high → catch upside
  if (playerPrice > currentPrice * 1.1) {
    const target = Math.min(maxPrice, currentPrice * (1 + raiseMax * (0.3 + Math.random() * 0.7)));
    return Math.round(target);
  }
  // Drift: healthy competitors raise occasionally, hurting ones trim
  if (cashHealthy && Math.random() < 0.2) {
    return Math.min(maxPrice, Math.round(currentPrice * 1.02));
  }
  if (!cashHealthy && Math.random() < 0.4) {
    return Math.max(costFloor, Math.round(currentPrice * 0.97));
  }
  return currentPrice;
}
