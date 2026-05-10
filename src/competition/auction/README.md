# competition/auction — Bidding wars framework

**Status:** IMPLEMENTED (v0.1)
**Used by:** games with scarce shared resources (talent, spectrum, factory sites, headliners)

Multi-tick ambient auctions. Player + rivals compete over one thing at a time; bids escalate over days or weeks; auto-closes when activity dies or max duration hits.

Generic enough for:
- Star-engineer poaching (Shenzhen Phone Tycoon)
- Star-teacher poaching (Coaching Tycoon)
- Spectrum license auctions (future Telecom Tycoon)
- Headline-act booking (future Music Venue Tycoon)
- Contract bidding (future Defense Tycoon)

## Public API

```ts
import {
  AuctionParticipant,
  Bid,
  Auction,
  AuctionStatus,
  AuctionState,
  OpenAuctionInput,
  AuctionPhaseConfig,
  ArchetypeBidInput,
  createAuctionState,
  openAuction,
  placeBid,
  closeAuction,
  advanceAuctionDay,
  archetypeDrivenBid,
  auctionPhase,
} from 'opentycoonos/competition/auction';
```

### Types

```ts
interface AuctionParticipant {
  id: string;            // rival id or 'player'
  maxBid: number;        // cap; they drop out above this
  openingBid?: number;
}

interface Auction {
  id: string;
  name: string;
  description: string;
  resourceId: string;    // the thing at stake
  currentBid: number;
  leader: string | null;
  bids: Bid[];
  participants: AuctionParticipant[];
  minRaise: number;
  status: 'open' | 'closed';
  openedDay: number;
  closedDay: number | null;
  winnerId: string | null;
  maxDurationDays: number;     // hard auto-close
  daysSinceLastRaise: number;
  idleDaysToClose: number;     // soft auto-close (no activity)
}
```

### Functions

| Function | Purpose |
|---|---|
| `createAuctionState(maxRetained?)` | Fresh state (default 12 retained) |
| `openAuction(state, input)` | Start a new auction; append to state |
| `placeBid(auction, participantId, amount, day)` | Manual bid; returns true if accepted |
| `closeAuction(auction, day)` | Force-close an open auction |
| `advanceAuctionDay(auction, day)` | Increment idle counter; auto-close if threshold |
| `archetypeDrivenBid(input, rng?)` | Default rival bidding strategy using `CompetitorArchetype.talentAggressiveness` |
| `auctionPhase(config)` | `TickPhase<S>` factory — orchestrates rival bids + auto-close |

## Wiring into a tick

```ts
import { composeTick } from 'opentycoonos/tick';
import { auctionPhase, archetypeDrivenBid } from 'opentycoonos/competition/auction';
import { pushHeadline } from 'opentycoonos/press';

composeTick<State>([
  // ...
  auctionPhase({
    getAuctionState: s => s.auctions,
    rivalBidStrategy: (participant, auction, state) => {
      // Look up the rival's archetype and delegate to the helper.
      const rival = state.rivals.find(r => r.id === participant.id);
      if (!rival) return null;
      return archetypeDrivenBid({
        archetype: rival.archetype,
        maxBid: participant.maxBid,
        currentBid: auction.currentBid,
        minRaise: auction.minRaise,
      });
    },
    onClose: (s, auction) => {
      pushHeadline(s, {
        headline: `${auction.name} resolved`,
        body: `Winner: ${auction.winnerId}. Final bid: $${auction.currentBid.toLocaleString()}.`,
        kind: 'bidding',
      });
      // Game logic: transfer the resource, update state, etc.
    },
  }),
  // ...
]);
```

## Player bids

The engine does NOT auto-bid for the player. The UI places player bids by calling `placeBid(auction, 'player', amount, day)` — typically via a modal or a "Match Bid" button. Player bids can happen between ticks; the engine picks up the new currentBid on the next tick and rivals react accordingly.

## Design notes

- **Ambient, not blocking.** Auctions run across many ticks while the rest of the game plays out. No modal required.
- **Rivals drop out silently.** When the current bid exceeds their `maxBid`, they just stop raising. No "out!" event.
- **Two auto-close triggers.** Max duration (hard) + idle days (soft — no raise for N days). Both mutate `auction.status`.
- **`archetypeDrivenBid` is one strategy.** Games can supply their own via `rivalBidStrategy`. The default uses `talentAggressiveness` from `CompetitorArchetype` — higher values → more likely to raise + raise higher.
- **Winner transfer is the game's job.** The engine sets `winnerId`; the game handles "what happens when rival X wins" in `onClose` or elsewhere.

## Out of scope

- **Sealed-bid / blind auctions.** This module models ascending open auctions.
- **Reserve prices / no-sale.** The engine records a winner even if the opening bid was never raised. Games can set a high `openingBid` + specific `openingLeader = ''` to emulate a reserve, or handle via `onClose`.
- **Proxy bidding.** Each tick, each rival bids up to one tick's worth based on strategy. A rival's `maxBid` is the cap; the engine doesn't auto-increment to it in one step.

## Evidence

Designed for Shenzhen Phone Tycoon's star-designer poaching + Coaching Tycoon's teacher-poaching. The archetype-driven rival strategy re-uses `tycoonos/competition/competitor`'s `talentAggressiveness` — no separate strategy profile needed.
