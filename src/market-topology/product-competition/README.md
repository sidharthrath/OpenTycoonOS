# market-topology/product-competition — Multi-product per-segment share allocation

**Status:** IMPLEMENTED (v0.2)
**Used by:** any game where multiple products compete for share inside one or more customer segments

The "9-product market" pattern lifted from ai-tycoon. Given a list of products + a list of segments, allocate each segment's demand across the products that qualify, weighted by a game-defined score function.

This is the missing piece for games where rivals' products should actually steal share from the player based on quality / price / features — not just exist as background flavor.

## When to use

- Multiple competing products (player + rivals, or many of the player's own SKUs) chasing one demand pool.
- Each segment values different attributes — pros care about specs, consumers care about price.
- You want share allocation, not just "did they buy?" — i.e. softmax-style competition.

If your game has one product per company and a single overall demand number, you don't need this.

## Public API

```ts
import {
  CompetingProduct,
  CompetingSegment,
  ShareResult,
  MarketResult,
  competeForSegment,
  competeForMarket,
} from 'opentycoonos/market-topology/product-competition';
```

### Types

```ts
interface CompetingProduct<TAttrs = unknown> {
  id: string;            // unique product id
  ownerId: string;       // 'player' or rival id — used for owner-level aggregation
  price: number;         // visible price (what the customer pays)
  attrs: TAttrs;         // free-form, game-defined
}

interface CompetingSegment<TAttrs = unknown> {
  id: string;
  demandPool: number;    // units / dollars / monthly subs — your pick

  /** Optional eligibility filter; products that fail are excluded from this segment. */
  isEligible?: (product: CompetingProduct<TAttrs>) => boolean;

  /** Score a product 0-100. The game owns the formula. */
  scoreProduct: (product: CompetingProduct<TAttrs>) => number;
}

interface ShareResult {
  /** Product id → share (0-1) of this segment's demandPool. */
  byProduct: Map<string, number>;
  /** Owner id → total share (0-1). Sum of all their products' shares. */
  byOwner: Map<string, number>;
  /** Sum of awarded shares × demandPool. ≤ demandPool. */
  totalDemand: number;
}

interface MarketResult {
  /** Product id → total demand summed across all segments. */
  byProduct: Map<string, number>;
  /** Owner id → total demand summed across all segments. */
  byOwner: Map<string, number>;
  /** Per-segment results for drill-down UI / debugging. */
  bySegment: Map<string, ShareResult>;
}
```

### Functions

| Function | Purpose |
|---|---|
| `competeForSegment(products, segment, opts?)` | Allocate one segment's demand across qualifying products |
| `competeForMarket(products, segments, opts?)` | Run `competeForSegment` for each segment + aggregate |

Both take `{ sharpness?: number }` (default 1.5). Higher sharpness = winners take more disproportionate share. ai-tycoon uses 1.5; raise for "winner take all" markets, lower for "everyone gets something."

## How scoring works

Per segment, for each eligible product:

1. `scoreProduct(product)` returns a 0-100 raw score (game-defined: quality + price + features blend).
2. Engine applies `Math.pow(max(0.01, score), sharpness)` to amplify spread.
3. Shares normalize to 1.0 across all eligible products.
4. Each product's share × `segment.demandPool` is its allocated demand from this segment.

The game owns scoring entirely — engine doesn't know what "quality" or "feature" means. Pass any blend you want.

## Wiring

```ts
import { competeForMarket } from 'opentycoonos/market-topology/product-competition';

const products = [
  ...playerDevices.map(d => ({
    id: d.id, ownerId: 'player', price: d.pricePerUnit, attrs: { quality: d.quality, tier: d.tier },
  })),
  ...rivals.flatMap(r => r.devices.map(d => ({
    id: d.id, ownerId: r.id, price: d.pricePerUnit, attrs: { quality: d.quality, tier: d.tier },
  }))),
];

const segments = [
  {
    id: 'budget',
    demandPool: 50_000,  // units/day this segment will absorb
    isEligible: p => p.price <= 300,                 // budget cap
    scoreProduct: p => 0.4 * (p.attrs as any).quality + 0.6 * priceScore(p.price, 300),
  },
  // ... more segments
];

const result = competeForMarket(products, segments);
// result.byProduct.get('player-device-1') = units of demand allocated to that SKU
```

## Design notes

- **Pure function.** No state, no mutation. Call it every tick (or quarterly — your cadence).
- **Game owns scoring.** The engine doesn't pretend to know consumer preferences. You pass a function.
- **Empty/zero-score products get zero share.** Score functions returning ≤ 0 are clamped at 0.01 internally (so they get a sliver) — pre-filter via `isEligible` if you want them dropped completely.
- **`demandPool` units are yours.** Could be units/day, dollars/month, monthly active users — pick one, stay consistent.
- **No price floors here.** Use eligibility filters (`p.price <= budgetCap`) to model "this segment won't pay more than X."

## Out of scope

- Cross-segment substitution (a pro buying down to a prosumer product). Handle by overlapping eligibility.
- Multi-tier discounts on the same product. Define one CompetingProduct per tier.
- Brand / loyalty switching costs. Bake into `scoreProduct`.
- Network effects. Pass a multiplier through `attrs` and use it in the score.

## Common recipes

### Perpetual reconsideration (subscription + platform games)

The killer pattern this module enables: every active subscriber periodically re-evaluates their choice, with a loyalty bonus favoring their current provider. Replaces the need for separate churn + upgrade mechanics; both emerge from scoring.

For each segment, each tick:

```ts
// Reconsideration probability per sub per tick (1/60 ≈ avg every 2 months)
const RATE = 1 / 60;

// For each incumbent owner with subs in this segment:
for (const incumbent of activeOwners) {
  const pool = incumbentSubsInSegment × RATE;
  if (pool <= 0) continue;

  // Run market with loyalty bonus on the incumbent
  const result = competeForSegment(allTierProducts, segment, {
    loyaltyBoosts: { [incumbent]: 1.15 },  // 15% stickiness
  });

  // Allocate pool across result:
  //   → same platform same tier      = retained
  //   → same platform different tier = organic tier migration (up or down)
  //   → rival platform               = churn to competitor
  for (const [productId, share] of result.byProduct) {
    moveSubs(incumbent_bucket, productId_bucket, share × pool);
  }
}
```

**Why this beats separate mechanics:**
- Churn is no longer a hardcoded per-tier rate — it's "the user picked a rival this month"
- Upgrades are no longer a special probability — they're "the user picked a different tier same platform"
- Rivals become real competitive threats, not background drift
- Price changes / catalog shifts / brand pain / new tech features all immediately affect subscriber movement via scoring

**Loyalty bonus calibration** (how sticky users feel):
- Consumer subscriptions (Netflix, Spotify): 1.10-1.20
- Annual plan renewals: 1.25-1.30 (already committed 12 months)
- Enterprise SaaS: 1.50-2.00 (deep ops dependency)
- Utility-grade services (carriers, insurance): 1.30-1.50

Tune via playtest.

### Existing-user upsell products (annual plans, loyalty tiers, add-ons)

Some products only make sense to offer to *existing* subscribers — annual upgrades from monthly, add-on bundles, win-back offers, premium support tiers. New users shouldn't see them (they haven't earned the option yet, or the product doesn't apply).

Use `product.visibility: 'existing-only'` + `competeForSegment(..., { flow: 'reconsideration' })`:

```ts
const products = [
  { id: 'player-free', ownerId: 'player', price: 0, visibility: 'both', attrs: {...} },
  { id: 'player-pro', ownerId: 'player', price: 10, visibility: 'both', attrs: {...} },
  { id: 'player-pro-annual', ownerId: 'player', price: 8.5, visibility: 'existing-only', attrs: {...} },
];

// New users shopping — annual invisible
competeForSegment(products, segment, { flow: 'acquisition' });

// Existing subs reconsidering — annual visible with loyalty boost
competeForSegment(products, segment, {
  flow: 'reconsideration',
  loyaltyBoosts: { player: 1.15 },
});
```

Mirror pattern: `visibility: 'new-only'` for intro offers (free-first-month trials, new-customer discounts) — only visible to freshly-considering users.

### Product discontinuation (lock-then-reconsider)

When a product is removed from the market (tier disabled, plan phased out), users don't instantly vanish — they're on a billing cycle. Real behavior: **continue paying/being served until the end of their current billing period, then force-drain through reconsideration at that moment.**

```ts
// Game-side state: when was this product disabled?
state.productDisabledOn.proPlan = currentDay;

// Each tick: check if billing cycle has elapsed since disable
if (disabledOn !== null && currentDay - disabledOn >= billingCycleDays) {
  const forceDrainPool = totalSubsOnDisabledProduct;

  // Force-reconsideration: everyone on this product at once
  const result = competeForSegment(remainingProducts, segment, {
    loyaltyBoosts: { [platformId]: 1.15 },
    flow: 'reconsideration',
  });
  allocateWinners(result, forceDrainPool);
  // Mark as drained so we don't re-run
  state.productDisabledOn.proPlan = null;
}
```

This supersedes AI-tycoon's instant-churn-to-zero pattern, which broke realism (you can't force paid customers to cancel mid-billing-cycle). Applies to: telecom plans phasing out, SaaS tier deprecations, gym membership retirements, airline fare-class withdrawals.

Billing cycles to use: 30d for monthly subscriptions, 364d for annual (or use existing cohort maturity — same thing), 730d for 2-year enterprise SaaS contracts, etc.

### One-off product-competition (consumer goods, launch events)

Simpler use: products compete once per tick for new demand. No loyalty (every buyer is fresh). Examples: smartphone units sold per day, ride bookings, concert tickets. Use `competeForMarket(products, segments)` with no `loyaltyBoosts`.

### Renewal-only competition (contract end events)

Cohort-based: a batch of users reaches contract maturity, all of them reconsider at once. Use `competeForSegment` with high `loyaltyBoosts` (1.25+). Examples: annual subscriptions at year-end, lease renewals, insurance renewals.

## Evidence

Lifted from `ai-tycoon/src/engine/market.ts:264-290` (the 9-product per-segment scoring loop). Generalized: dropped AI-specific use-case gates (the game's own `isEligible` covers that), dropped the hard-coded company list, made attributes generic. Perpetual-reconsideration recipe added based on Stream Co.'s universal-market design (every sub periodically re-enters the market instead of hardcoded churn + upgrade rates).
