# competition/competitor — Generic rival AI framework

**Status:** IMPLEMENTED (v0.1)
**Used by:** every game with named rivals (most games)

Generic rival-AI state + archetype-driven strategy weights. The engine provides
the scaffolding; the game provides the per-tick decision logic.

## Why a separate module from the legacy flat `competitor/`?

The legacy `competitor/` module (still present for streaming-tycoon's migration)
assumes a tiered-pricing model with `pricing: Record<string, number>` — too
specific to streaming / SaaS / subscription games. This module is shape-agnostic:
each rival carries a game-defined `meta: TMeta` slice plus engine-provided
archetype weights + a few common fields (marketShare, reputation, cash).

## Public API

```ts
import {
  CompetitorArchetype,
  CompetitorState,
  CompetitorAction,
  CompetitorPhaseConfig,
  ARCHETYPES,
  createCompetitor,
  pushCompetitorAction,
  shouldReactToPlayerMove,
  chooseAggressivePrice,
  competitorPhase,
} from 'opentycoonos/competition/competitor';
```

### Types

```ts
interface CompetitorArchetype {
  id: string;
  name: string;
  priceAggressiveness: number;   // 0-1
  reactivity: number;            // 0-1
  riskTolerance: number;         // 0-1
  marketingWeight: number;       // 0-1
  talentAggressiveness: number;  // 0-1
  canGoBankrupt: boolean;
}

interface CompetitorState<TMeta = {}> {
  id: string;
  name: string;
  archetype: CompetitorArchetype;
  marketShare: number;     // 0-1
  reputation: number;      // 0-100
  cashReserves: number;
  isExited: boolean;
  recentActions: CompetitorAction[];
  meta: TMeta;
}
```

### Pre-built archetypes

Import `ARCHETYPES` for ready-to-use strategy profiles:

| Archetype | Price-aggr | React | Risk | Marketing | Talent | Can exit |
|---|---|---|---|---|---|---|
| `valueFlood` | 0.85 | 0.7 | 0.5 | 0.4 | 0.3 | ✓ |
| `premiumGlobal` | 0.2 | 0.5 | 0.4 | 0.7 | 0.6 | ✗ |
| `marketingHeavy` | 0.5 | 0.6 | 0.6 | 0.9 | 0.5 | ✓ |
| `walledGarden` | 0.1 | 0.3 | 0.3 | 0.5 | 0.8 | ✗ |
| `scrappyStartup` | 0.6 | 0.8 | 0.9 | 0.5 | 0.4 | ✓ |

Games can import directly, copy + tune, or define fully custom archetypes.

### Helpers

- `createCompetitor(input)` — factory; defaults marketShare=0, reputation=50.
- `pushCompetitorAction(comp, action, maxRecent=6)` — append to recent-actions log, cap.
- `shouldReactToPlayerMove(archetype, importance, rng?)` — coin-flip gated by reactivity × importance.
- `chooseAggressivePrice(archetype, playerPrice, floor?, ceiling?)` — price undercut scaled by archetype aggressiveness.
- `competitorPhase(config)` — `TickPhase<S>` factory; orchestrates per-rival ticks.

## Wiring into a tick

```ts
import { composeTick } from 'opentycoonos/tick';
import { competitorPhase, pushCompetitorAction } from 'opentycoonos/competition/competitor';

const tickRival = (rival, state, ctx) => {
  // game-specific logic — price shifts, launches, etc.
  if (shouldReactToPlayerMove(rival.archetype, 0.8)) {
    // react to something
    pushCompetitorAction(rival, {
      id: `react-${ctx.totalDays}`,
      day: state.clock.totalDays,
      description: `${rival.name} undercuts your flagship`,
      kind: 'price-cut',
    });
  }
};

composeTick<State>([
  // ...
  competitorPhase({
    getCompetitors: s => s.rivals,
    tickCompetitor: tickRival,
  }),
  // ...
]);
```

## Design notes

- **Engine provides scaffolding, game provides decisions.** The engine can't know how a rival phone OEM decides to launch vs. how a rival coaching center decides to poach a teacher. It just calls the game's tick function per rival.
- **Archetypes are read-only strategy signals.** Games don't mutate archetype weights mid-run — they mutate the state the archetype influences.
- **`isExited` is terminal.** Once a rival exits (bankruptcy, acquisition), `competitorPhase` skips them. If a game wants comebacks, maintain state manually.
- **`cashReserves` is approximate.** Rivals don't carry full `FinancialState` — they're cheaper to simulate than the player. Games can promote to full finances if needed.

## Out of scope

- **Actual rival-to-rival interactions** (alliances, mergers). Games model if needed.
- **Rival save-file versioning.** Engine doesn't version archetype ids; games handle.
- **UI for rival watch screens.** Rendered by `downstream UI package` (not yet shipped).

## Evidence

Synthesized from streaming-tycoon's competitor logic + ai-tycoon's `competitors.ts` + Shenzhen Phone Tycoon's need for 4 reactive rivals with archetype-differentiated behavior. The archetype-weight model (rather than a monolithic rival class) mirrors how streaming-tycoon discriminates between "Netflix-type" and "Disney+-type" rivals.
