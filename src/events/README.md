# Events — Random + scheduled game events

**Status:** IMPLEMENTED (v0.1, promoted from v0.2 roadmap slot)
**Used by:** every game

Unified event bus for any discrete moment that mutates state:
- Cultural phenomena (streaming: viral breakout; phone: viral review)
- Product incidents (battery fire, recall, overheating)
- Market shocks (chip shortage, supply-chain disruption, commodity spike)
- Regulatory pulses (new tariff, right-to-repair rule, export control)
- Competitor drama (rival slashes prices, rival poaches engineer)
- Seasonal specials (holiday-quarter sales bump)

One `EventDef<S>` shape handles them all — no parallel taxonomy of event-kind modules.

## Public API

```ts
import {
  EventDef,
  EventCadence,
  EventState,
  EventLogEntry,
  createEventState,
  checkAndFireEvents,
  fireEvent,
  eventPhase,
  type EventPhaseConfig,
} from 'opentycoonos/events';
```

### Types

```ts
type EventCadence = 'tick' | 'quarterly' | 'yearly' | 'triggered';

interface EventDef<S> {
  id: string;
  name: string;
  description: string;
  cadence: EventCadence;
  eligibility: (state: S) => boolean;
  chance?: (state: S) => number;   // 0-1 prob; omit for always-fire when eligible
  resolve: (state: S) => void;     // mutation
  once?: boolean;                  // fire at most once per run
}

interface EventState {
  firedOnce: string[];
  log: EventLogEntry[];
  maxLog: number;
}
```

### Functions

| Function | Purpose |
|---|---|
| `createEventState(maxLog?)` | Fresh event state (default cap = 20 entries) |
| `checkAndFireEvents(state, defs, eventState, ctx, rng?)` | Evaluate + fire eligible events; returns fired ids |
| `fireEvent(state, def, eventState)` | Force-fire one event (bypass cadence + chance) — for 'triggered' events + tests |
| `eventPhase(config)` | `TickPhase<S>` factory — drops into `composeTick(...)` |

## Cadence semantics

- **`'tick'`** — every tick, considered. Typical for random market events. Use `chance` to gate.
- **`'quarterly'`** — only considered on ticks where `ctx.isNewQuarter === true`. Use for fiscal-quarter events (earnings reports, seasonal bumps).
- **`'yearly'`** — only on `ctx.isNewYear`. Use for annual awards, fiscal-year close, tax events.
- **`'triggered'`** — never auto-fires. Game code calls `fireEvent(state, def, eventState)` when a condition the event-bus can't know about is met (e.g. player clicks a button, a specific press headline cascades).

Put perspective on chance: at `cadence: 'tick'` with `chance: 0.01` (1%), the event fires roughly once every 100 ticks — ~3 times per in-game year at daily ticks, or roughly once per year at monthly ticks.

## Wiring into a tick

```ts
import { composeTick, clockPhase, financialPhase } from 'opentycoonos/tick';
import { eventPhase } from 'opentycoonos/events';
import { pushHeadline } from 'opentycoonos/press';

composeTick<State>([
  clockPhase({ maxYears: 10 }),
  unitSaleResetPhase(s => s.unitSales),
  productionPhase,
  eventPhase({
    defs: gameEvents,
    getEventState: s => s.events,
    onFire: (s, def) => pushHeadline(s, {
      headline: def.name,
      body: def.description,
      kind: 'incident',
    }),
  }),
  perkPhase({ ... }),
  financialPhase(...),
]);
```

Order matters: put `eventPhase` after production so a "chip shortage" can mutate state visibly, BUT before `perkPhase` if your events are supposed to also feed perk triggers, OR after `perkPhase` if they're independent. Most games: `eventPhase` after `productionPhase`, before `perkPhase`.

## Example event defs

```ts
const events: EventDef<State>[] = [
  // A random market shock — 2% chance each tick, only in years 2+
  {
    id: 'chip-shortage',
    name: 'Global Chip Shortage',
    description: 'Supply tightens. Per-unit COGS up 20% for 6 months.',
    cadence: 'tick',
    eligibility: s => s.clock.year >= 2 && !s.activeModifiers.chipShortage,
    chance: () => 0.02,
    resolve: s => {
      s.activeModifiers.chipShortage = { ticksRemaining: 180, cogsMultiplier: 1.2 };
    },
    once: true,   // only once per run
  },
  // Always-fires annual awards event
  {
    id: 'year-end-rankings',
    name: 'Annual Rankings Published',
    description: 'Trade press ranks the top consumer-hardware brands.',
    cadence: 'yearly',
    eligibility: () => true,
    resolve: s => computeAndRecordRankings(s),
  },
];
```

## Design notes

- **Stateless event definitions.** Defs are const; state lives on EventState + whatever mutations `resolve` makes. Same pattern as perks.
- **RNG injection.** Games can pass their own `rng: () => number` for deterministic replays / save-file debugging. Default: `Math.random`.
- **Log is informational, not authoritative.** Save files should carry `EventState` (including log) so timelines survive reloads. Games compute derived state (active modifiers, etc.) from `resolve`, not from the log.
- **Cadence is the blunt instrument.** For richer scheduling ("fire in Q3 of year 5"), use `cadence: 'tick'` + game-specific eligibility check `s => s.clock.year === 5 && s.clock.quarter === 3`.
- **No event-kind taxonomy.** "Incident" / "phenomenon" / "scandal" is a UI / press concern (handled by `pushHeadline({ kind: ... })` inside `resolve` or `onFire`). The bus doesn't care.

## Out of scope (v0.1)

- **Event chains** — e.g. "Chip shortage triggers price spike which triggers rival price cut." For now, games cascade by having `resolve` push state that other events' `eligibility` checks read.
- **Multi-tick duration events** — `resolve` fires once; duration is the game's responsibility (e.g. maintain a `ticksRemaining` counter and decrement each tick in a game-specific phase).
- **Player choice events** — "Should you accept the partnership?" requires a modal. Out of scope; games can implement by pausing the tick and reading a response via their own state.
- **Weighted random selection from a pool** — if a game has 50 events and wants "pick one of these weighted by recency" rather than "roll dice on each," the game layers that logic on top.

## Evidence

Extracted from streaming-tycoon's cultural-phenomena pattern (always-on weighted random events) + AI-tycoon's supply-shock pattern (one-shot triggered events) + Shenzhen Phone Tycoon's need for both + annual rankings. Generalized.
