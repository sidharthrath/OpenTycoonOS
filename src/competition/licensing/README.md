# licensing — Time-bounded exclusivity at fixed cost

**Status:** IMPLEMENTED (v0.2)
**Used by:** streaming (iconic podcast licenses), SaaS (enterprise contracts), any time-bounded exclusive arrangement that auto-renews or lapses

Real-world licensing is **not** a public bidding war. It's a private negotiation at a fixed annual cost with a contract term. When the term ends, the incumbent typically auto-renews at an inflated rate — unless they DROP the deal, in which case the license returns to market for other platforms to race-sign.

Distinct from:
- **`auction/`** — public escalating bid wars (spectrum, exclusive talent bids).
- **`acquisitions/`** — permanent one-shot M&A (buy the company).

## When to use

- The real mechanic is "pay fixed $X/year for Y years, auto-renews unless I drop."
- Cost scales by renegotiation (inflation), not by bidding wars.
- Incumbent has realistic right-of-first-refusal on renewal.

If your mechanic is escalating public bids, use `auction`. If it's permanent asset transfer, use `acquisitions`.

## Public API

```ts
import {
  createLicenseState,
  trySign,
  dropLicense,
  undropLicense,
  availableOffers,
  activeFor,
  licensePhase,
  dailyLicenseBurn,
  type LicenseOffer,
  type ActiveLicense,
  type LicenseState,
  type LicensePhaseConfig,
} from 'opentycoonos/competition/licensing';
```

### Types

```ts
interface LicenseOffer<TPayload> {
  id: string;
  name: string;
  description: string;
  annualCost: number;
  termYears: number;
  costInflationPerRenewal: number;  // 1.5 = 50% increase per renewal
  availableFromDay: number | null;
  availableUntilDay: number | null;
  payload: TPayload;  // game-defined
}

interface ActiveLicense<TPayload> {
  offerId: string;
  offerSnapshot: LicenseOffer<TPayload>;
  holderId: string;
  startDay: number;
  expiresDay: number;
  currentAnnualCost: number;
  renewalCount: number;
  dropped: boolean;  // holder opted out of auto-renewal
}
```

### Functions

| Function | Purpose |
|---|---|
| `trySign(state, gs, offerId, holderId, day, cashCheck)` | Sign an available offer — returns the ActiveLicense or null |
| `dropLicense(state, offerId)` | Holder signals they won't renew at expiration |
| `undropLicense(state, offerId)` | Cancel a drop (change of mind before expiration) |
| `availableOffers(state, day)` | Currently signable offers for UI |
| `activeFor(state, offerId)` | Get active license by offerId |
| `dailyLicenseBurn(state, actorId)` | Daily pro-rata cost across all actor's active licenses |
| `licensePhase(config)` | `TickPhase<S>` — runs rivals + auto-withdraws + renewals |

## Lifecycle

```
OFFER → (signed) → ACTIVE → expiresDay arrives:
                     ├─ not dropped + can pay: auto-renew at inflated cost
                     └─ dropped OR can't pay: expire + offer re-opens at inflated cost
                        ├─ someone signs → new ACTIVE at inflated cost
                        └─ windowed withdraw → offer withdraws forever
```

## Example — streaming iconic shows

```ts
type StreamLicensePayload = {
  genre: string;
  supplyContribution: number;
  qualityScore: number;
};

// Define offers
const OFFERS: LicenseOffer<StreamLicensePayload>[] = [
  {
    id: 'joe-rogue',
    name: 'The Joe Rogue Experience',
    description: 'Long-form flagship',
    annualCost: 80_000_000,
    termYears: 3,
    costInflationPerRenewal: 2.0, // $80M → $160M on renewal (real Rogan)
    availableFromDay: 365,
    availableUntilDay: 730,
    payload: { genre: 'long-form', supplyContribution: 400, qualityScore: 10 },
  },
  // ...
];

// Compose phase
composeTick<GameState>([
  licensePhase<GameState, StreamLicensePayload>({
    getLicenseState: (s) => s.licenses,
    getRivalIds: (s) => s.rivals.map((r) => r.id),
    hasCash: (s, actorId, cost) =>
      actorId === 'player'
        ? s.finances.cash >= cost
        : s.rivals.find((r) => r.id === actorId)?.cashReserves ?? 0 >= cost,
    rivalSignStrategy: (s, offer, rivalId) => {
      const rival = s.rivals.find((r) => r.id === rivalId);
      if (!rival) return false;
      // Archetype-driven probability to sign
      const cashHealth = Math.min(1, rival.cashReserves / (offer.annualCost * 5));
      return Math.random() < 0.002 * rival.archetype.talentAggressiveness * cashHealth;
    },
    onSign: (state, license) => {
      // Deduct upfront year's cost, apply payload
      if (license.holderId === 'player') {
        state.finances.cash -= license.currentAnnualCost;
        state.playerPodcastSupplyByGenre[license.offerSnapshot.payload.genre] += license.offerSnapshot.payload.supplyContribution;
      } else {
        // rival cash + supply updates
      }
    },
    onRenewal: (state, license) => {
      // Deduct new year's upfront cost
      if (license.holderId === 'player') state.finances.cash -= license.currentAnnualCost;
    },
    onExpire: (state, license) => {
      // Remove payload effect from former holder
      if (license.holderId === 'player') {
        state.playerPodcastSupplyByGenre[license.offerSnapshot.payload.genre] -= license.offerSnapshot.payload.supplyContribution;
      }
    },
  }),
]);
```

Player actions (UI):

```ts
const signed = trySign(s.licenses, s, 'joe-rogue', 'player', s.clock.totalDays, (gs, cost) => gs.finances.cash >= cost);
if (signed) config.onSign(s, signed);

// Player wants to drop at next expiration
dropLicense(s.licenses, 'joe-rogue');
```

## Design notes

- **Fixed cost, not bidding**: matches real deal flow. Platforms negotiate quietly.
- **Auto-renewal is default**: incumbents benefit from inertia (real-world pattern).
- **Drop explicitly**: player must opt out; otherwise cost creeps up.
- **Inflation per renewal**: customize per-offer. Rogan 2×; mid-tier 1.5×.
- **Withdraw vs expire**: `withdrawnOn` covers "nobody signed in time"; expire covers "contract ended, holder didn't renew."
- **Engine doesn't know payload semantics**: game's `onSign/onRenewal/onExpire` callbacks handle all state mutations.

## Composing with other modules

- **pipeline/**: licensed shows may appear as licensed-source pipeline slots.
- **product-competition / use-case-matrix**: licensed content affects competitive scoring as content supply.
- **acquisitions/**: complementary — acquisitions are permanent, licensing is time-bounded.
