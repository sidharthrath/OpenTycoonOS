# acquisitions — Race-to-buy M&A targets

**Status:** IMPLEMENTED (v0.2)
**Used by:** games with strategic M&A dynamics — streaming (podcast networks, ad-tech), manufacturing (supplier buyouts), SaaS (plugin/integration acquisitions), retail (regional chain rollups)

Unlike `auction/`, which models **public bidding wars**, this module models **private M&A**: targets have fixed ask prices and windowed availability. Players + rivals race to close first. No bidding — just timing.

Games define the concrete effect of an acquisition via an `onAcquire` callback that transforms the target's `payload` into state mutations.

## When to use (vs auction)

- **Acquisitions**: fixed price, windowed availability, first-come-first-served, permanent asset transfer. Real-world M&A is more like this than like an auction (Spotify-Gimlet, Spotify-Findaway, etc. weren't public bidding wars).
- **Auction**: escalating competitive bidding, multiple participants drive price up, single winner at close. Better for public contract bids (spectrum licenses, exclusive talent contracts).

If your mechanic is "racing for a fixed-price deal," use acquisitions. If "highest bidder wins after escalation," use auction.

## Public API

```ts
import {
  createAcquisitionState,
  tryAcquire,
  withdrawTarget,
  availableTargets,
  isAvailable,
  acquisitionPhase,
  type AcquisitionTarget,
  type AcquisitionState,
  type AcquisitionPhaseConfig,
} from 'opentycoonos/competition/acquisitions';
```

### Types

```ts
interface AcquisitionTarget<TPayload = unknown> {
  id: string;
  name: string;
  description: string;
  askPrice: number;
  availableFromDay: number | null;   // null = available from start
  availableUntilDay: number | null;  // null = never expires
  payload: TPayload;                 // game interprets in onAcquire
}

interface AcquisitionState<TPayload> {
  targets: AcquisitionTarget<TPayload>[];
  acquiredBy: Record<string, string>;  // targetId → acquirerId
  withdrawnOn: Record<string, number>; // targetId → day withdrawn
}
```

### Functions

| Function | Purpose |
|---|---|
| `createAcquisitionState()` | Init empty state |
| `isAvailable(target, state, day)` | Is target available right now? |
| `availableTargets(state, day)` | All active targets for UI rendering |
| `tryAcquire(state, gameState, id, acquirer, day, cashCheck)` | Attempt acquisition; returns true on success |
| `withdrawTarget(state, id, day)` | Mark as withdrawn (typically auto on expiration) |
| `acquisitionPhase(config)` | `TickPhase<S>` — runs rival attempts + auto-withdraws expired targets |

## Wiring example

```ts
// Game-specific payload shape
type StreamCoPayload =
  | { kind: 'podcast_network'; podcasts: CommissionedPodcast[] }
  | { kind: 'tech_unlock'; techNodeId: string }
  | { kind: 'label_buyout'; labelId: string };

// Compose into tick
composeTick<StreamGameState>([
  // ...
  acquisitionPhase<StreamGameState, StreamCoPayload>({
    getAcquisitionState: (s) => s.acquisitions,
    getRivalIds: (s) => s.rivals.map((r) => r.id),
    hasCash: (s, actorId, amount) => {
      if (actorId === 'player') return s.finances.cash >= amount;
      const rival = s.rivals.find((r) => r.id === actorId);
      return rival ? rival.cashReserves >= amount : false;
    },
    rivalAttemptStrategy: (s, target, rivalId) => {
      const rival = s.rivals.find((r) => r.id === rivalId);
      if (!rival) return false;
      // Archetype-driven: premium rivals want prestige acquisitions,
      // value rivals pass, etc.
      return rival.cashReserves > target.askPrice * 3 &&
             Math.random() < rival.archetype.talentAggressiveness * 0.1;
    },
    onAcquire: (state, target, acquirerId) => {
      // Deduct cash (engine doesn't do it)
      if (acquirerId === 'player') state.finances.cash -= target.askPrice;
      else {
        const rival = state.rivals.find((r) => r.id === acquirerId);
        if (rival) rival.cashReserves -= target.askPrice;
      }
      // Apply payload effect by kind
      const p = target.payload;
      switch (p.kind) {
        case 'podcast_network': {
          for (const pod of p.podcasts) {
            // Spawn owned launched-podcast slot
            state.pipeline.slots.push({ ...pod, owner: acquirerId });
          }
          break;
        }
        case 'tech_unlock':
          if (acquirerId === 'player') state.tech.unlocked.push(p.techNodeId);
          break;
        case 'label_buyout':
          if (acquirerId === 'player') state.catalog.signedLabels.push(p.labelId);
          break;
      }
      // Headline
      pushHeadline(state, {
        headline: `${target.name} acquired`,
        body: `${acquirerId === 'player' ? 'You' : acquirerId} acquired ${target.name} for $${target.askPrice}.`,
        kind: 'bidding',
        owner: acquirerId,
      });
    },
    onWithdraw: (state, target) => {
      pushHeadline(state, {
        headline: `${target.name} withdraws from market`,
        body: 'Negotiation window closed.',
        kind: 'market',
      });
    },
  }),
]);
```

Player actions (UI):

```ts
// In an action handler
const ok = tryAcquire(
  state.acquisitions,
  state,
  'target-wildcrime-media',
  'player',
  state.clock.totalDays,
  (s, amt) => s.finances.cash >= amt,
);
if (ok) {
  config.onAcquire(state, target, 'player');  // apply effects
}
```

## Design notes

- **Rival attempts are probabilistic** per tick. Over a target's window (e.g. 180 days), a 5%/day rival attempt rate means ~99.5% chance someone else acquires it if they can afford it — creates real urgency.
- **First-come-first-served** — whoever acquires first gets the target. No outbidding.
- **Window expiration without buyer** — `onWithdraw` fires, target is gone forever. Forces timely decisions.
- **Payload is game-defined** — engine has zero opinion on what an acquisition DOES. Add new payload kinds as the game expands.
- **No state for "in negotiation"** — keeping it simple. Real M&A has due-diligence / closing periods; game abstracts that away.

## Composing with other modules

- **auction/** — complementary: use for competitive bidding on time-bounded exclusivity (licensing), use acquisitions for private fixed-price M&A (network buyouts).
- **pipeline/** — when payload is "spawn owned content," write to pipeline.slots directly.
- **content-slate/** — auto-commission works independently; acquired content doesn't flow through the slate.
- **market-topology/product-competition** — acquired assets change the player's competitive profile downstream (more podcasts in supply, labels signed, etc.).
