# Commodities — External price shocks + hedging

**Status:** IMPLEMENTED (alpha.25)
**Used by:** airline (jet fuel), shipping (bunker fuel), EV (batteries), restaurant (food), brewery (grain), mining (copper/lithium), utilities (gas)

External price series the player can't control. Random walk with shock events. Hedge contracts let the player lock a fixed price for volume + duration; settlements happen daily as the player consumes. The engine keeps the spot/hedge spread honest so games don't have to wire it.

## Public API

```ts
import {
  CommodityDef,
  CommodityState,
  CommoditiesMarket,
  HedgeContract,
  HedgeBook,
  createCommoditiesMarket,
  createHedgeBook,
  spotPrice,
  tickCommodityPrices,
  commoditiesPricePhase,
  signHedge,
  consumeAtBlendedPrice,
  hedgeCoverage,
  pruneExpiredHedges,
} from 'opentycoonos/commodities';
```

## Pattern

1. **Define commodities** the game cares about — `CommodityDef[]` with base price, daily volatility, shock probability, mean-reversion target.
2. **Create market state** at game start with `createCommoditiesMarket(defs)`.
3. **Add the price phase** to your tick: `commoditiesPricePhase(getMarket, getDefs, rng?)`.
4. **Player buys hedges** via `signHedge(book, market, { commodityId, volume, startDay, durationDays, premiumRatePerYear })`.
5. **Each tick that consumes the commodity**: call `consumeAtBlendedPrice(book, market, id, volumeUsed, day)` — returns `{ totalCost, blendedRate, hedgedVolume, spotVolume }`.

## Why hedge?

Without hedging, the player rides spot every tick. A 30% fuel-price spike hits the next day's P&L. With hedging, the player pays an up-front premium to lock a price for volume × duration; if spot rises above strike, the hedge wins. If spot falls, the hedge loses (you paid more than you needed to).

The premium is game-defined — typical airline fuel hedges run 3-8% of notional per year. Games that want hedging to be a real strategic decision should price premiums to roughly equal the expected long-run gain (so hedging is risk-management, not free money).

## Composes with

- `financial` — feed `consumeAtBlendedPrice().totalCost` into your tick's burn aggregator.
- `events` — shock events can fire your existing event system if you want narrative ("Brent spikes 18% on Strait of Hormuz tensions").
- `tick` — `commoditiesPricePhase` slots into `composeTick`.

## Out of scope

- Forward curves / futures pricing models (we approximate with a flat strike).
- Option-style hedges (only fixed-strike, fixed-volume contracts).
- Cross-commodity correlations (jet fuel doesn't follow brent automatically — game decides).
