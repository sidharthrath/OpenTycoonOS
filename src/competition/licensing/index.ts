// TycoonOS — Licensing (fixed-cost, time-bounded, auto-renewing exclusivity)
//
// Real-world licensing is NOT a bidding war. It's a private negotiation at a
// fixed ask price. When the contract ends, the incumbent typically
// auto-renews at an inflated rate unless they DROP the deal, in which case
// the license returns to market for other platforms to race-sign.
//
// This is distinct from `auction/` (public escalating bid wars) and from
// `acquisitions/` (permanent one-shot M&A). Shared DNA with acquisitions —
// fixed ask, race-to-sign — plus contract duration + auto-renewal + RoFR.
//
// Streaming-industry analogs: Spotify-Rogan ($250M/3.5yr then $250M renewal),
// Spotify-Call Her Daddy ($60M/3yr, lost to SiriusXM at renewal),
// Michelle Obama Spotify (~$20M/2yr, did NOT renew), Dax Shepard Amazon/Wondery.
// Also applicable to any time-bounded exclusive deal: SaaS enterprise
// contracts, stadium naming rights, exclusive content licensing, etc.

import type { TickPhase } from '../../tick/index.js';

/** A license on offer. Fixed ask price. Term in years. */
export interface LicenseOffer<TPayload = unknown> {
  id: string;
  name: string;
  description: string;
  /** Annual cost for current contract. Inflates on renewal via costInflationPerRenewal. */
  annualCost: number;
  /** Contract length in years. */
  termYears: number;
  /** Multiplier applied to annualCost each renewal. 1.5 = 50% increase. */
  costInflationPerRenewal: number;
  /** Day the offer first appears on market. Null = from game start. */
  availableFromDay: number | null;
  /**
   * Day the offer withdraws from market if still unsigned. Null = never
   * withdraws. Once signed, the offer stays in state.signedBy indefinitely
   * (active license tracks its fate from there).
   */
  availableUntilDay: number | null;
  /** Game-defined — transformed on sign via onSign callback. */
  payload: TPayload;
}

/** An active license contract currently held by some platform. */
export interface ActiveLicense<TPayload = unknown> {
  offerId: string;
  /** Snapshot of the offer at sign-time (payload may be needed later on transfer). */
  offerSnapshot: LicenseOffer<TPayload>;
  holderId: string;
  startDay: number;
  expiresDay: number;
  /** Current annual cost — inflates at renewal. */
  currentAnnualCost: number;
  renewalCount: number;
  /**
   * Holder has signaled they'll DROP at expiration (won't auto-renew).
   * At expiresDay, the license ends + the offer re-enters the market for
   * others to sign at the inflated rate.
   */
  dropped: boolean;
}

/** Container on game state. */
export interface LicenseState<TPayload = unknown> {
  offers: LicenseOffer<TPayload>[];
  /** Currently-held contracts. */
  active: ActiveLicense<TPayload>[];
  /** offerId → day withdrawn (offer expired without being signed). */
  withdrawnOn: Record<string, number>;
}

export function createLicenseState<TPayload = unknown>(): LicenseState<TPayload> {
  return { offers: [], active: [], withdrawnOn: {} };
}

// ─── Query helpers ──────────────────────────────────────────────────────

/** Is the offer currently signable (in window, not already held, not withdrawn)? */
export function isAvailable<TPayload>(
  offer: LicenseOffer<TPayload>,
  state: LicenseState<TPayload>,
  currentDay: number,
): boolean {
  if (state.active.some((a) => a.offerId === offer.id)) return false;
  if (state.withdrawnOn[offer.id] !== undefined) return false;
  if (offer.availableFromDay !== null && currentDay < offer.availableFromDay) return false;
  if (offer.availableUntilDay !== null && currentDay > offer.availableUntilDay) return false;
  return true;
}

export function availableOffers<TPayload>(
  state: LicenseState<TPayload>,
  currentDay: number,
): LicenseOffer<TPayload>[] {
  return state.offers.filter((o) => isAvailable(o, state, currentDay));
}

/** Find the active license for this offer (if any). */
export function activeFor<TPayload>(
  state: LicenseState<TPayload>,
  offerId: string,
): ActiveLicense<TPayload> | undefined {
  return state.active.find((a) => a.offerId === offerId);
}

// ─── Sign / drop ────────────────────────────────────────────────────────

/**
 * Sign an available offer. Returns the ActiveLicense on success, null otherwise.
 * Mutates state. Engine caller is responsible for cash deduction via onSign.
 */
export function trySign<TPayload, S>(
  state: LicenseState<TPayload>,
  gameState: S,
  offerId: string,
  holderId: string,
  currentDay: number,
  cashCheck: (gs: S, annualCost: number) => boolean,
): ActiveLicense<TPayload> | null {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) return null;
  if (!isAvailable(offer, state, currentDay)) return null;
  if (!cashCheck(gameState, offer.annualCost)) return null;

  const license: ActiveLicense<TPayload> = {
    offerId: offer.id,
    offerSnapshot: { ...offer },
    holderId,
    startDay: currentDay,
    expiresDay: currentDay + offer.termYears * 364,
    currentAnnualCost: offer.annualCost,
    renewalCount: 0,
    dropped: false,
  };
  state.active.push(license);
  return license;
}

/** Holder opts to drop the license at next expiration. */
export function dropLicense<TPayload>(
  state: LicenseState<TPayload>,
  offerId: string,
): boolean {
  const lic = state.active.find((a) => a.offerId === offerId);
  if (!lic) return false;
  lic.dropped = true;
  return true;
}

/** Un-drop (player changes mind before expiration). */
export function undropLicense<TPayload>(
  state: LicenseState<TPayload>,
  offerId: string,
): boolean {
  const lic = state.active.find((a) => a.offerId === offerId);
  if (!lic) return false;
  lic.dropped = false;
  return true;
}

// ─── Tick phase ─────────────────────────────────────────────────────────

export interface LicensePhaseConfig<S, TPayload = unknown> {
  getLicenseState: (state: S) => LicenseState<TPayload>;
  /** Rivals considered as potential signers of available offers. */
  getRivalIds: (state: S) => string[];
  /** Cash-check for sign attempts + auto-renewals. */
  hasCash: (state: S, actorId: string, annualCost: number) => boolean;
  /**
   * Rival decides whether to sign an available offer this tick.
   * Null / false = pass. True = attempt (engine runs cashCheck + signs + fires onSign).
   */
  rivalSignStrategy?: (state: S, offer: LicenseOffer<TPayload>, rivalId: string) => boolean;
  /**
   * Fired when any actor (player or rival) signs an offer for the first time.
   * Game should: deduct upfront annual cost, apply payload effect (spawn
   * content, etc.), push headlines.
   */
  onSign: (state: S, license: ActiveLicense<TPayload>) => void;
  /**
   * Fired when incumbent auto-renews at expiration. Annual cost has already
   * been inflated on the license. Game should: deduct new year's upfront cost,
   * push headline, maybe refresh payload state.
   */
  onRenewal: (state: S, license: ActiveLicense<TPayload>) => void;
  /**
   * Fired when a license ends without renewal (holder dropped, or couldn't
   * afford renewal). Game should: remove payload effect from former holder,
   * push headline. The offer re-enters the market and will appear in
   * available offers again.
   */
  onExpire: (state: S, license: ActiveLicense<TPayload>) => void;
  /**
   * Optional: fired when an unsigned offer's availableUntilDay passes.
   * Offer is marked withdrawn and won't be available again.
   */
  onWithdraw?: (state: S, offer: LicenseOffer<TPayload>) => void;
}

/**
 * Compose the licensing tick phase:
 *   1. For each available offer: rivals may attempt to sign.
 *   2. For each offer whose window expired: mark withdrawn + fire onWithdraw.
 *   3. For each active license at expiresDay:
 *      - If NOT dropped + holder can pay renewal: inflate cost, reset
 *        expiresDay, increment renewalCount, fire onRenewal.
 *      - Otherwise: remove from active list, fire onExpire. Offer's
 *        availableFromDay is reset to now + inflated annualCost so it
 *        re-enters market.
 *
 * Player actions (sign / drop) are triggered from UI via `trySign`/`dropLicense`
 * before this phase runs.
 */
export function licensePhase<S extends { clock: { totalDays: number } }, TPayload = unknown>(
  config: LicensePhaseConfig<S, TPayload>,
): TickPhase<S> {
  return (state) => {
    const day = state.clock.totalDays;
    const licState = config.getLicenseState(state);
    const rivalIds = config.getRivalIds(state);

    // ── 1. Rivals consider signing available offers ─────────────────
    for (const offer of licState.offers) {
      if (!isAvailable(offer, licState, day)) continue;
      if (!config.rivalSignStrategy) continue;
      for (const rivalId of rivalIds) {
        const willAttempt = config.rivalSignStrategy(state, offer, rivalId);
        if (!willAttempt) continue;
        const signed = trySign(licState, state, offer.id, rivalId, day, (gs, cost) =>
          config.hasCash(gs, rivalId, cost),
        );
        if (signed) {
          config.onSign(state, signed);
          break;
        }
      }
    }

    // ── 2. Auto-withdraw unsigned offers past window ────────────────
    for (const offer of licState.offers) {
      if (licState.active.some((a) => a.offerId === offer.id)) continue;
      if (licState.withdrawnOn[offer.id] !== undefined) continue;
      if (offer.availableUntilDay !== null && day > offer.availableUntilDay) {
        licState.withdrawnOn[offer.id] = day;
        if (config.onWithdraw) config.onWithdraw(state, offer);
      }
    }

    // ── 3. Process expirations + renewals ───────────────────────────
    // Iterate a copy since we may splice active licenses.
    for (const license of [...licState.active]) {
      if (day < license.expiresDay) continue;

      if (!license.dropped && config.hasCash(state, license.holderId, license.currentAnnualCost * license.offerSnapshot.costInflationPerRenewal)) {
        // Auto-renew: inflate cost, extend term
        license.currentAnnualCost *= license.offerSnapshot.costInflationPerRenewal;
        license.renewalCount += 1;
        license.startDay = day;
        license.expiresDay = day + license.offerSnapshot.termYears * 364;
        config.onRenewal(state, license);
      } else {
        // Expire — holder dropped OR can't afford renewal
        const idx = licState.active.indexOf(license);
        if (idx >= 0) licState.active.splice(idx, 1);
        config.onExpire(state, license);

        // Re-list offer at inflated cost so market can pick it up
        const offer = licState.offers.find((o) => o.id === license.offerId);
        if (offer) {
          offer.annualCost = license.currentAnnualCost * license.offerSnapshot.costInflationPerRenewal;
          offer.availableFromDay = day;
          // availableUntilDay stays unchanged (or game can refresh via onExpire)
          delete licState.withdrawnOn[offer.id];
        }
      }
    }
  };
}

// ─── Ongoing cost helper ────────────────────────────────────────────────

/** Daily pro-rata cost for an actor across all their active licenses. */
export function dailyLicenseBurn<TPayload>(
  state: LicenseState<TPayload>,
  actorId: string,
): number {
  let daily = 0;
  for (const lic of state.active) {
    if (lic.holderId !== actorId) continue;
    daily += lic.currentAnnualCost / 364;
  }
  return daily;
}
