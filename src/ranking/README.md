# Ranking — Ongoing prestige tiers

**Status:** PLANNED v0.5
**Used by:** university (Top 10/25/50), law firm, consulting (MBB), hedge fund, hotel (5-star), Michelin

Ongoing external tier (not annual awards) that affects WTP and talent acquisition.

## Exports (planned)
```ts
interface RankingState {
  tier: number;          // 1 = top, higher = worse
  metrics: Record<string, number>;
}
function recomputeRanking(state, peers): void;  // periodic re-rank
function getRankingBoost(rank): number;  // translates to WTP/talent multipliers
```

## Evidence
NEW. Different from `recognition/` (one-time awards) — this is a persistent hierarchy.
