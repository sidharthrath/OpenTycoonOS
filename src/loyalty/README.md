# Loyalty — Multi-tier accumulated value

**Status:** IMPLEMENTED (alpha.25)
**Used by:** airline (miles), hotel (points), coffee (punches), credit cards (cashback tiers), retail (rewards), fintech (status)

Members earn points per transaction; status tiers grant willingness-to-pay boost + churn reduction. The engine tracks deferred-liability (unredeemed points × expected redemption rate × point value) and aggregate per-tier counts. Games supply earn rules + tier benefits + co-brand revenue accrual.

The deferred liability is the program's open secret: real loyalty programs accrue billions in liabilities the airline owes back. United's MileagePlus is valued north of $20B partly because that liability is also a moat.

## Public API

```ts
import {
  LoyaltyTierDef,
  LoyaltyProgramDef,
  LoyaltyState,
  createLoyaltyState,
  loyaltyResetPhase,
  enrollMembers,
  recordEarnings,
  recordRedemption,
  recordCoBrandRevenue,
  rebalanceTiers,
  programWtpMultiplier,
  programChurnMultiplier,
  totalDeferredLiability,
  memberMixByTier,
  tierForPoints,
} from 'opentycoonos/loyalty';
```

## Pattern

1. **Define program** with tier ladder (e.g. `[base, silver, gold, platinum]`), earn rates, point value at redemption.
2. **`createLoyaltyState(def)`** at game start.
3. **Enroll members** as they sign up: `enrollMembers(state, def, count)`.
4. **Each transaction**: `recordEarnings(state, def, tierId, dollars)` — accrues points + bumps the deferred-liability cost line for the tick.
5. **Each tick**: `rebalanceTiers(state, def, { avgQualifyingPointsByTier })` to promote/demote.
6. **Game decides redemptions**: `recordRedemption(state, tierId, points, revenue)` when a member burns points for a perk.
7. **Co-brand revenue**: `recordCoBrandRevenue(state, amount)` for credit-card partner payments.
8. **Modulate fares + churn**: multiply by `programWtpMultiplier(state, def)` / `programChurnMultiplier(state, def)`.

## Why aggregate, not per-member

Real airline programs have millions of members. Tracking each as an individual record is expensive and unnecessary — the macro behavior (X% are gold, average gold member earns Y points/mo, deferred liability = Z) is what drives the economics. Per-tier aggregates handle this for ~30 LOC of state per tier.

## Composes with

- `revenue-models/subscription` — loyalty modifies churn + WTP for subscribed members.
- `revenue-models/transaction` — earnings are recorded per transaction.
- `financial` — `lastTickEarnLiabilityCost` flows into your burn aggregator (it's a real cost — you're owing miles).
- `competition/capability-vectors` — rivals' loyalty-program quality can be a capability dimension.

## Out of scope

- Per-member ledgers (use the aggregate model — sufficient for tycoon-scale).
- Award-availability inventory (when miles can be redeemed for what).
- Cross-program transfers (Marriott→Delta etc.).
- Status-match promotions (game can wire as a one-shot enrollment bump).
