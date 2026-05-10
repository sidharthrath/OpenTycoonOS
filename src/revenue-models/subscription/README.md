# revenue-models/subscription — Per-tier subscriber pools, churn, MRR

**Status:** IMPLEMENTED (v0.2)
**Used by:** streaming, AI SaaS, social, news paywall, cloud, telecom, banking

The core revenue model for any game where customers commit to a recurring relationship at a price. Tracks per-tier subscriber pools, applies churn proportionally over the tick, accrues revenue + variable costs, and feeds clean per-tick aggregates into `financialPhase`.

The engine **doesn't decide who subscribes** — that's the game's call (via WTP filters, `product-competition` share allocation, marketing pulls, etc.). The engine handles bookkeeping, churn math, and LTV.

## When to use

- Customers pay recurring (monthly, weekly) for ongoing access — not one-shot purchases.
- You have multiple tiers (free / pro / max) with different prices + features.
- Churn is meaningful — you can lose subs as fast as you gain them.
- You want LTV / payback math to drive marketing decisions.

If your game sells discrete units, use `unit-sale` instead. If it's per-transaction (per-ride, per-ticket), wait for `transaction` (planned v0.3) or model it with `unit-sale`.

## Public API

```ts
import {
  TierConfig,
  TierState,
  SubscriptionState,
  createSubscriptionState,
  recordAcquisitions,
  applyChurn,
  accrueRevenue,
  upgrade,
  downgrade,
  resetTickAggregates,
  subscriptionResetPhase,
  arpuPerMonth,
  ltvPerTier,
  totalSubscribers,
  totalRevenuePerMonth,
} from 'opentycoonos/revenue-models/subscription';
```

### Types

```ts
interface TierConfig {
  id: string;                    // 'free' | 'pro' | 'max' | game-defined
  name: string;                  // display
  pricePerMonth: number;         // 0 = free tier (no revenue, still tracked for funnel)
  baseChurnRate: number;         // monthly churn 0-1 under nominal conditions
  costPerSubPerMonth: number;    // variable serving cost (CDN, support, etc.)
}

interface TierState {
  tierId: string;
  subscribers: number;           // fractional OK during proportional churn/upgrades
  lastTickAcquired: number;
  lastTickChurned: number;
  cumulativeAcquired: number;
  cumulativeChurned: number;
}

interface SubscriptionState {
  tiers: Record<string, TierState>;
  cumulativeRevenue: number;
  cumulativeCosts: number;
  lastTickRevenue: number;
  lastTickCosts: number;
}
```

### Functions

| Function | Purpose |
|---|---|
| `createSubscriptionState(configs)` | Init tier states (all subs = 0) |
| `recordAcquisitions(state, tierId, n)` | Add `n` new subs to a tier |
| `applyChurn(state, configs, daysInTick, modifier?)` | Drop subs proportionally to base churn × days; modifier 0-1 (brand discount) |
| `accrueRevenue(state, configs, daysInTick)` | Add `subs × price × days/30` to last-tick + cumulative |
| `upgrade(state, fromId, toId, n)` | Move subs without counting churn/acquisition |
| `downgrade(state, fromId, toId, n)` | Mirror of upgrade |
| `resetTickAggregates(state)` | Zero `lastTick*` slices; called at tick start |
| `subscriptionResetPhase(getter)` | `TickPhase<S>` factory wrapping the reset |
| `arpuPerMonth(state, configs)` | Weighted ARPU across all tiers |
| `ltvPerTier(config, churnOverride?)` | `(price − cost) / monthlyChurn` (Infinity if churn = 0) |
| `totalSubscribers(state)` | Sum across tiers |
| `totalRevenuePerMonth(state, configs)` | MRR projection at current sub count |

## Tick wiring

```ts
import { composeTick, financialPhase } from 'opentycoonos/tick';
import {
  subscriptionResetPhase,
  applyChurn,
  accrueRevenue,
} from 'opentycoonos/revenue-models/subscription';

composeTick<State>([
  clockPhase({ maxYears: 10 }),
  subscriptionResetPhase(s => s.subscriptions),

  // Game's own demand phase: figure out who subscribes this tick.
  // Could use product-competition / WTP / scoring — engine doesn't care.
  (state) => {
    const newPro = computePlayerProAcquisitions(state);
    recordAcquisitions(state.subscriptions, 'pro', newPro);
  },

  // Churn + revenue accrual. Pass daysInTick from your tick context.
  (state, ctx) => {
    const brandModifier = 1 - state.brand.score / 200; // higher brand = less churn
    applyChurn(state.subscriptions, TIER_CONFIGS, 1, brandModifier);
    accrueRevenue(state.subscriptions, TIER_CONFIGS, 1);
  },

  financialPhase(
    { minOwnership: 0.1 },
    s => s.subscriptions.lastTickRevenue,
    s => s.subscriptions.lastTickCosts + otherOpex(s),
  ),
]);
```

## How churn works

`applyChurn(state, configs, daysInTick, modifier?)` converts each tier's `baseChurnRate` (monthly) into a per-day rate via `1 − (1 − monthlyRate) ^ (1/30)`, multiplies by `daysInTick`, applies the optional `modifier` (0-1), and removes that fraction from `subscribers`.

The modifier is for the game's contextual modifiers — brand score, event boosts, network effects. Pass `1.0` (or omit) for nominal churn. Pass `0.5` to halve churn (e.g. brand at 100/100). Pass `2.0` to double it (e.g. PR incident).

`lastTickChurned` and `cumulativeChurned` accumulate the actual subs lost.

## How revenue accrues

`accrueRevenue(state, configs, daysInTick)` walks each tier and adds:

```
revenue = subscribers × pricePerMonth × (daysInTick / 30)
costs   = subscribers × costPerSubPerMonth × (daysInTick / 30)
```

to both `lastTickRevenue/Costs` and `cumulativeRevenue/Costs`. Free tiers contribute revenue 0 but still accrue serving costs.

Per-month math is done *at accrual time* using the current `subscribers` count — so churn applied earlier in the tick reduces revenue immediately. Order matters: typically `applyChurn` then `accrueRevenue` (otherwise you charge churners for their last day).

## Upgrades / downgrades

`upgrade(state, 'free', 'pro', 100)` moves 100 subs from free to pro **without** counting as churn or acquisition. This is the right primitive when a sub levels up — you don't want their per-tier LTV math distorted by counting them as a "new acquisition" of pro tier.

If you want to count it as churn (free) + acquisition (pro), call those two functions instead. The engine doesn't enforce semantics — pick the one that matches how your funnel reports work.

## LTV

`ltvPerTier(config)` returns the canonical formula:

```
LTV = (pricePerMonth − costPerSubPerMonth) / baseChurnRate
```

Pass `churnOverride` to use the game's effective churn (after modifiers). Returns `Infinity` if churn is 0 (subs never leave). Returns 0 if margin is negative (you lose money on every sub).

## Design notes

- **Pure functions, mutates state.** Immer-draft compatible.
- **Free tiers are subscribers, not users.** They count toward `totalSubscribers`. Use them for funnel math (free → pro conversion rate). If you want a separate "users not yet signed up" pool, the game holds that outside this module.
- **Days-in-tick is explicit.** Real-time games may run multiple sim days per real-time tick; engine doesn't assume.
- **No hard tier ordering.** `upgrade` / `downgrade` are symmetric; the engine doesn't know "pro > free." Game owns hierarchy.
- **Trials, intro pricing, annual plans.** Not built in. Game can shadow these via per-cohort tiers (`trial-pro`, `annual-pro`) with their own configs.

## Out of scope

- Content-slate / SKU commissioning (streaming's "annual budget → weekly shows" pattern). Future `pipeline/` module.
- Per-cohort retention curves (subs who joined in Q1 churn differently than Q3 ones). Game can shadow with cohort-specific tiers.
- Family plans, seat-based pricing. Bake into the price + churn config — one "family" sub = 1 tier-state row at a higher price.
- WTP / acquisition math. Use `market-topology/segmented` or `market-topology/product-competition` for that, then call `recordAcquisitions`.

## Evidence

Generalized from streaming-tycoon's tier subscriber pattern (per-tier state, monthly churn rates, LTV math). Generalized further to drop streaming-specific assumptions (no content slate, no per-genre quality scoring, no ad-tier mechanics — all of those layer on top via game logic or future modules).
