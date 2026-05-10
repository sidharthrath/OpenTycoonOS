// TycoonOS — Events / event bus
// Unified event bus: random daily-chance events, quarterly/yearly scheduled
// events, and game-triggered events. Events mutate state and optionally push
// press headlines.
//
// Design intent: generic enough to cover cultural phenomena (viral review),
// product incidents (battery fire), market shocks (chip shortage), regulatory
// pulses (new tariff), competitor drama, seasonal specials — by a single
// `EventDef<S>` shape, not a parallel taxonomy of event-kind modules.

import type { TickPhase, TickContext } from '../tick/index.js';

/** When an event is considered for firing. */
export type EventCadence =
  /** Evaluated every tick — use with a `chance` roll for random events. */
  | 'tick'
  /** Evaluated only on quarter boundaries (TickContext.isNewQuarter). */
  | 'quarterly'
  /** Evaluated only on year boundaries (TickContext.isNewYear). */
  | 'yearly'
  /** Never auto-fires. Game code calls `fireEvent()` to trigger. */
  | 'triggered';

/**
 * An event definition. `resolve` is where you mutate state and/or push headlines.
 *
 * @typeParam S  the game's state shape
 */
export interface EventDef<S> {
  id: string;
  name: string;
  description: string;
  cadence: EventCadence;
  /** Must return true for the event to be considered. */
  eligibility: (state: S) => boolean;
  /**
   * Probability per consideration, 0–1. Omit for always-fire when eligible.
   * Only consulted for 'tick' / 'quarterly' / 'yearly' cadences.
   */
  chance?: (state: S) => number;
  /** Mutation the event applies to state (Immer-draft compatible). */
  resolve: (state: S) => void;
  /** If true, the event can fire at most once per run. Tracked in EventState.firedOnce. */
  once?: boolean;
}

/** One entry in the event log, for UI timelines + save-file debugging. */
export interface EventLogEntry {
  eventId: string;
  day: number;
  name: string;
  description: string;
}

/** Runtime state carried on the game state. */
export interface EventState {
  /** IDs of `once:true` events that have already fired. */
  firedOnce: string[];
  /** Ring buffer of recent fires, newest last. Capped at `maxLog`. */
  log: EventLogEntry[];
  /** Max entries retained in `log`. */
  maxLog: number;
}

/** Fresh event state with log cap. */
export function createEventState(maxLog: number = 20): EventState {
  return { firedOnce: [], log: [], maxLog };
}

/** Default RNG — games seeking determinism should pass their own. */
const defaultRng = (): number => Math.random();

/**
 * Evaluate all event defs for this tick and fire any that match cadence +
 * eligibility + chance. Mutates `state` via each `def.resolve`, and appends
 * fired events to `eventState.log`. Returns the list of fired event ids.
 *
 * Games wire this via `eventPhase`; calling directly is for tests + manual flow.
 *
 * @typeParam S  the game's state shape (must carry `clock.totalDays`)
 */
export function checkAndFireEvents<S extends { clock: { totalDays: number } }>(
  state: S,
  defs: readonly EventDef<S>[],
  eventState: EventState,
  ctx: TickContext,
  rng: () => number = defaultRng,
): string[] {
  const fired: string[] = [];
  for (const def of defs) {
    if (!isCadenceActive(def.cadence, ctx)) continue;
    if (def.once && eventState.firedOnce.includes(def.id)) continue;
    if (!def.eligibility(state)) continue;
    if (def.chance) {
      const p = def.chance(state);
      if (rng() >= p) continue;
    }
    fireEvent(state, def, eventState);
    fired.push(def.id);
  }
  return fired;
}

/**
 * Force-fire a specific event, bypassing cadence + chance (eligibility still
 * checked). Useful for 'triggered' events, debugging, and testing. Mutates state.
 * Returns true if the event fired, false if eligibility rejected it.
 */
export function fireEvent<S extends { clock: { totalDays: number } }>(
  state: S,
  def: EventDef<S>,
  eventState: EventState,
): boolean {
  if (!def.eligibility(state)) return false;
  if (def.once && eventState.firedOnce.includes(def.id)) return false;
  def.resolve(state);
  if (def.once) {
    eventState.firedOnce.push(def.id);
  }
  eventState.log.push({
    eventId: def.id,
    day: state.clock.totalDays,
    name: def.name,
    description: def.description,
  });
  while (eventState.log.length > eventState.maxLog) {
    eventState.log.shift();
  }
  return true;
}

function isCadenceActive(cadence: EventCadence, ctx: TickContext): boolean {
  switch (cadence) {
    case 'tick':
      return true;
    case 'quarterly':
      return ctx.isNewQuarter;
    case 'yearly':
      return ctx.isNewYear;
    case 'triggered':
      return false;
  }
}

/**
 * Configuration for `eventPhase`.
 *
 * @typeParam S  the game's state shape
 */
export interface EventPhaseConfig<S extends { clock: { totalDays: number } }> {
  defs: readonly EventDef<S>[];
  /** Read the {@link EventState} off the game state. */
  getEventState: (state: S) => EventState;
  /** Optional: inject an RNG for deterministic replays. Defaults to Math.random. */
  rng?: () => number;
  /** Optional: called per fired event, after `resolve`. Good for press/toast hooks. */
  onFire?: (state: S, def: EventDef<S>) => void;
}

/**
 * Compose a `TickPhase` that fires eligible events each tick.
 *
 * @example
 *   composeTick<State>([
 *     clockPhase({ maxYears: 10 }),
 *     unitSaleResetPhase(s => s.unitSales),
 *     productionPhase,
 *     eventPhase({
 *       defs: gameEvents,
 *       getEventState: s => s.events,
 *       onFire: (s, def) => pushHeadline(s, {
 *         headline: def.name, body: def.description, kind: 'incident',
 *       }),
 *     }),
 *     perkPhase({ ... }),
 *     financialPhase(...),
 *   ]);
 */
export function eventPhase<S extends { clock: { totalDays: number } }>(
  config: EventPhaseConfig<S>,
): TickPhase<S> {
  return (state, ctx) => {
    const eventState = config.getEventState(state);
    const fired = checkAndFireEvents(state, config.defs, eventState, ctx, config.rng);
    if (config.onFire && fired.length > 0) {
      for (const id of fired) {
        const def = config.defs.find((d) => d.id === id);
        if (def) config.onFire(state, def);
      }
    }
  };
}
