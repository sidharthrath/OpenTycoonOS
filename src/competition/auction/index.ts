// TycoonOS — Auction / bidding wars framework
// Multi-tick escalating-bid auctions for scarce resources: star engineers,
// spectrum licenses, factory sites, headliner talent, premium slots. Generic
// enough to cover any "player + rivals compete for one thing" dynamic.
//
// Design: auctions are ambient — they run over multiple ticks while the rest of
// the game plays out. Each tick, rivals evaluate whether to raise their bid,
// using a strategy function (default: archetype-driven). The player interacts
// through `placeBid`; the engine orchestrates rival bids via `auctionPhase`.

import type { TickPhase } from '../../tick/index.js';
import type { CompetitorArchetype } from '../competitor/index.js';

/** One participant's stake in an auction. Their maxBid is the strategy cap. */
export interface AuctionParticipant {
  /** Entity id — matches a rival's id or `'player'` for the user. */
  id: string;
  /** Maximum amount this participant will bid. Above this they drop out. */
  maxBid: number;
  /** Optional: their opening bid (if they drive the first bid). */
  openingBid?: number;
}

/** A single bid event. */
export interface Bid {
  participantId: string;
  amount: number;
  /** Absolute game day. */
  day: number;
}

/** Auction status. */
export type AuctionStatus = 'open' | 'closed';

/** One auction instance. */
export interface Auction {
  id: string;
  name: string;
  description: string;
  /** The resource at stake — free-form string id the game interprets (e.g. star-designer-id). */
  resourceId: string;
  /** Currently highest bid amount. */
  currentBid: number;
  /** Currently leading participant id, or null if no bids yet. */
  leader: string | null;
  /** Full bid history, oldest first. */
  bids: Bid[];
  /** Participants still in the auction. Participants drop out when bid > their maxBid. */
  participants: AuctionParticipant[];
  /** Minimum raise above the current bid. */
  minRaise: number;
  status: AuctionStatus;
  /** Day the auction opened. */
  openedDay: number;
  /** Day the auction closed, or null if still open. */
  closedDay: number | null;
  /** Winner id, or null (null = closed with no bidders — shouldn't usually happen). */
  winnerId: string | null;
  /** Auto-close after this many days from openedDay, regardless of activity. */
  maxDurationDays: number;
  /** Days since the last bid raise. Used for "no-activity" auto-close. */
  daysSinceLastRaise: number;
  /** Auto-close if daysSinceLastRaise reaches this. */
  idleDaysToClose: number;
}

/** Container on game state. Holds open + recently closed auctions for UI. */
export interface AuctionState {
  /** All auctions, oldest first. Includes both open and closed. */
  auctions: Auction[];
  /** Cap on total retained auctions. Oldest (closed) roll off. */
  maxRetained: number;
}

export function createAuctionState(maxRetained: number = 12): AuctionState {
  return { auctions: [], maxRetained };
}

// ─── Opening / placing / stepping ───────────────────────────────────────

export interface OpenAuctionInput {
  id: string;
  name: string;
  description: string;
  resourceId: string;
  participants: AuctionParticipant[];
  minRaise: number;
  openingBid?: number;
  openingLeader?: string;
  openedDay: number;
  /** Default 60 days. */
  maxDurationDays?: number;
  /** Default 10 days. Auction closes early if no raises for this long. */
  idleDaysToClose?: number;
}

/** Open a new auction and append it to the state. Mutates. */
export function openAuction(state: AuctionState, input: OpenAuctionInput): Auction {
  const auction: Auction = {
    id: input.id,
    name: input.name,
    description: input.description,
    resourceId: input.resourceId,
    currentBid: input.openingBid ?? 0,
    leader: input.openingLeader ?? null,
    bids:
      input.openingBid && input.openingLeader
        ? [{ participantId: input.openingLeader, amount: input.openingBid, day: input.openedDay }]
        : [],
    participants: input.participants,
    minRaise: input.minRaise,
    status: 'open',
    openedDay: input.openedDay,
    closedDay: null,
    winnerId: null,
    maxDurationDays: input.maxDurationDays ?? 60,
    daysSinceLastRaise: 0,
    idleDaysToClose: input.idleDaysToClose ?? 10,
  };
  state.auctions.push(auction);
  trimRetained(state);
  return auction;
}

/**
 * Place a bid on an open auction. Mutates auction. Returns true if the bid was
 * accepted (high enough, participant is in, auction is open), false otherwise.
 */
export function placeBid(auction: Auction, participantId: string, amount: number, day: number): boolean {
  if (auction.status !== 'open') return false;
  const required = auction.currentBid + auction.minRaise;
  if (amount < required) return false;

  const participant = auction.participants.find((p) => p.id === participantId);
  if (!participant) return false;
  if (amount > participant.maxBid) return false;

  auction.currentBid = amount;
  auction.leader = participantId;
  auction.bids.push({ participantId, amount, day });
  auction.daysSinceLastRaise = 0;
  return true;
}

/**
 * Force-close an auction. Mutates. Sets winnerId to the current leader (or
 * null if no bids happened). Subsequent bids are ignored.
 */
export function closeAuction(auction: Auction, day: number): void {
  if (auction.status === 'closed') return;
  auction.status = 'closed';
  auction.closedDay = day;
  auction.winnerId = auction.leader;
}

/**
 * Advance an auction's idle counter by one day and auto-close if thresholds hit.
 * Mutates. Returns true if the auction transitioned from open → closed in this
 * call (useful for engine orchestration, e.g. firing onClose exactly once).
 */
export function advanceAuctionDay(auction: Auction, day: number): boolean {
  if (auction.status !== 'open') return false;
  auction.daysSinceLastRaise += 1;
  if (
    auction.daysSinceLastRaise >= auction.idleDaysToClose ||
    day - auction.openedDay >= auction.maxDurationDays
  ) {
    closeAuction(auction, day);
    return true;
  }
  return false;
}

function trimRetained(state: AuctionState): void {
  // Trim from the front (oldest). Prefer removing closed entries first.
  while (state.auctions.length > state.maxRetained) {
    const firstClosedIdx = state.auctions.findIndex((a) => a.status === 'closed');
    if (firstClosedIdx >= 0) {
      state.auctions.splice(firstClosedIdx, 1);
    } else {
      state.auctions.shift();
    }
  }
}

// ─── Rival bidding strategy ─────────────────────────────────────────────

export interface ArchetypeBidInput {
  archetype: CompetitorArchetype;
  /** Participant's maxBid from their auction registration. */
  maxBid: number;
  /** Current high bid in the auction. */
  currentBid: number;
  /** Minimum raise. */
  minRaise: number;
}

/**
 * Default archetype-driven bidding strategy for a rival. Returns the amount
 * they would bid right now (must be ≥ currentBid + minRaise), or null to pass.
 *
 * - High talentAggressiveness rivals are more likely to raise and raise higher.
 * - They never go above their maxBid.
 *
 * Games can supply a custom strategy via `AuctionPhaseConfig.rivalBidStrategy`.
 */
export function archetypeDrivenBid(input: ArchetypeBidInput, rng: () => number = Math.random): number | null {
  const { archetype, maxBid, currentBid, minRaise } = input;
  const required = currentBid + minRaise;
  if (required > maxBid) return null;

  // Probability of raising this round scaled by talentAggressiveness.
  const willRaise = rng() < archetype.talentAggressiveness;
  if (!willRaise) return null;

  // Bid size: smaller (close to required) for cautious rivals, larger for aggressive.
  const headroom = maxBid - required;
  const bump = minRaise + headroom * archetype.talentAggressiveness * 0.3 * rng();
  const amount = Math.min(maxBid, Math.round(required + bump));
  return amount;
}

// ─── TickPhase factory ──────────────────────────────────────────────────

export interface AuctionPhaseConfig<S extends { clock: { totalDays: number } }> {
  /** Read AuctionState off game state. */
  getAuctionState: (state: S) => AuctionState;
  /**
   * Decide a rival's bid on a specific auction. Default uses `archetypeDrivenBid`
   * when the participant is a rival, but games can override (e.g. to factor in
   * the rival's cash reserves, reputation, or other state).
   *
   * Return null to pass. Return an amount to bid (engine validates it's high enough).
   *
   * @param participant       the bidding participant
   * @param auction           the auction being stepped
   * @param state             the full game state (for custom logic)
   * @returns amount to bid, or null to pass
   */
  rivalBidStrategy?: (
    participant: AuctionParticipant,
    auction: Auction,
    state: S,
  ) => number | null;
  /** Optional RNG injection for determinism. */
  rng?: () => number;
  /** Called when an auction closes, after winnerId is set. Fire press headlines, transfer the resource, etc. */
  onClose?: (state: S, auction: Auction) => void;
}

/**
 * Compose a `TickPhase` that advances each open auction by one day:
 *   1. Each non-leading rival participant gets a chance to raise (via strategy).
 *   2. `advanceAuctionDay` increments the idle counter and auto-closes if needed.
 *   3. If an auction just closed, `onClose` fires.
 *
 * The player (id === 'player') is NOT bid-on-by the engine — the UI places
 * player bids via `placeBid` before the tick runs (or across ticks).
 *
 * @example
 *   composeTick<State>([
 *     // ...
 *     auctionPhase({
 *       getAuctionState: s => s.auctions,
 *       onClose: (s, auction) => pushHeadline(s, {
 *         headline: `${auction.name} resolved`,
 *         body: `Winner: ${auction.winnerId}. Final bid: $${auction.currentBid}.`,
 *         kind: 'bidding',
 *       }),
 *     }),
 *     // ...
 *   ]);
 */
export function auctionPhase<S extends { clock: { totalDays: number } }>(
  config: AuctionPhaseConfig<S>,
): TickPhase<S> {
  return (state) => {
    const day = state.clock.totalDays;
    const auctionState = config.getAuctionState(state);
    for (const auction of auctionState.auctions) {
      if (auction.status !== 'open') continue;
      // Each non-leading participant may bid (except the player — UI drives player bids).
      for (const participant of auction.participants) {
        if (participant.id === 'player') continue;
        if (auction.leader === participant.id) continue;
        if (auction.currentBid >= participant.maxBid) continue;
        const bid = config.rivalBidStrategy
          ? config.rivalBidStrategy(participant, auction, state)
          : null;
        if (bid !== null) {
          placeBid(auction, participant.id, bid, day);
        }
      }
      // Advance the auction's day counter (may close it).
      const justClosed = advanceAuctionDay(auction, day);
      if (justClosed && config.onClose) {
        config.onClose(state, auction);
      }
    }
  };
}
