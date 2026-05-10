# revenue-models/ads — Per-impression CPM revenue tracking

**Status:** IMPLEMENTED (v0.2)
**Used by:** any free-tier game where impressions translate to ad revenue

The ad-revenue twin to `subscription`. Free-tier subscribers generate ad impressions; impressions × fill-rate × CPM = revenue. Tracks aggregates per slot + per-tick + cumulative.

## When to use

- Game has a free tier or unsigned visitors who consume content with ads.
- You want CPM-driven revenue, segmentable by ad slot (pre-roll, mid-roll, banner, sponsored playlist, etc.).
- You want the engine to handle bookkeeping; game decides *how many impressions* fired this tick.

If you only have paid users, skip this — `subscription` covers the world.

## Public API

```ts
import {
  AdSlotConfig,
  AdSlotState,
  AdsState,
  createAdsState,
  recordImpressions,
  resetAdsTickAggregates,
  adsResetPhase,
  totalImpressions,
  totalRevenue,
  ecpmBlended,
} from 'opentycoonos/revenue-models/ads';
```

### Types

```ts
interface AdSlotConfig {
  id: string;                // 'pre-roll' | 'mid-roll' | 'banner' | etc.
  name: string;              // display
  cpm: number;               // dollars per 1000 filled impressions
  fillRate: number;          // 0-1 — fraction of impressions actually filled
  costPerImpression?: number;// optional — adtech overhead; defaults to 0
}

interface AdSlotState {
  slotId: string;
  cumulativeImpressions: number;
  cumulativeFilledImpressions: number;
  cumulativeRevenue: number;
  cumulativeCost: number;
  lastTickImpressions: number;
  lastTickRevenue: number;
  lastTickCost: number;
}

interface AdsState {
  slots: Record<string, AdSlotState>;
  cumulativeRevenue: number;
  cumulativeCost: number;
  lastTickRevenue: number;
  lastTickCost: number;
}
```

### Functions

| Function | Purpose |
|---|---|
| `createAdsState(slots)` | Init with one state per slot config |
| `recordImpressions(state, configs, slotId, n)` | Game drives — adds n impressions, computes revenue inline |
| `resetAdsTickAggregates(state)` | Zero last-tick slices |
| `adsResetPhase(getter)` | `TickPhase<S>` factory wrapping the reset |
| `totalImpressions(state)` | Sum of all slot impressions |
| `totalRevenue(state)` | Sum of all slot revenue |
| `ecpmBlended(state)` | Effective CPM across all slots ($/1000 impressions actually run) |

## How impressions become revenue

For each `recordImpressions(state, configs, slotId, n)`:

```
filledImpressions = n × fillRate
revenue           = (filledImpressions / 1000) × cpm
cost              = n × (costPerImpression ?? 0)
```

Both filled and total impressions are tracked separately — `cumulativeFilledImpressions` is the billable count; `cumulativeImpressions` is what users *saw* slots for (matters for fill-rate analysis + quality signaling to advertisers).

CPMs are dynamic — game updates `AdSlotConfig` between ticks for seasonality (Q4 holidays = 1.4× CPM), audience quality (premium-listening time = higher CPM), or macro events (recession = lower CPM).

## Tick wiring

```ts
import { composeTick, financialPhase } from 'opentycoonos/tick';
import { adsResetPhase, recordImpressions } from 'opentycoonos/revenue-models/ads';

composeTick<State>([
  clockPhase({ maxYears: 10 }),
  adsResetPhase(s => s.ads),
  // Game's own engagement / impressions phase
  (state) => {
    const freeTierHours = state.engagement.freeTierHours;
    const adsPerHour = 4;                      // pre-rolls per hour of audio
    const impressionsThisTick = freeTierHours * adsPerHour;
    recordImpressions(state.ads, AD_SLOTS, 'pre-roll', impressionsThisTick);
  },
  financialPhase(
    { minOwnership: 0.1 },
    s => s.ads.lastTickRevenue + s.subscriptions.lastTickRevenue,
    s => s.ads.lastTickCost + s.subscriptions.lastTickCosts + otherOpex(s),
  ),
]);
```

## Design notes

- **Pure functions, mutates state.** Immer-draft compatible.
- **Game owns "how many impressions fired."** Engine doesn't know your engagement model. Pass it in.
- **CPM and fillRate are config-time, dynamic between ticks.** Cap mutability of slot configs in your render layer; the engine reads them on each call.
- **Fill rate of 1.0 is unrealistic.** Real CPM markets fill 70-95% depending on inventory quality; default down for realism.
- **Ad cost is optional.** Most games can ignore (`costPerImpression: 0`) — relevant for games where adtech overhead matters (Twitch, YouTube).

## Out of scope

- Ad-buyer dynamics (which advertisers buy, frequency capping, audience targeting). Game can shadow with custom CPM tweaks.
- Video vs audio vs display split. Just configure separate slots.
- Programmatic vs direct deals. Configure as separate slots with different CPMs.
- Subscription-revenue interaction (ad-tier vs ad-free). Game owns: ad-tier listeners go through ads module, paid through subscription.

## Evidence

Every game that goes "free tier with ads + paid tier without" needs this. Pulled forward to support Stream Co. (music streaming) where the free-tier ad-CPM revenue is half the business model — and Spotify's actual ad revenue is ~13% of group total, so it's not optional.
