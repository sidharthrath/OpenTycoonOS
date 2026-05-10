# reputation — Brand health + incidents + boosts

**Status:** IMPLEMENTED (v0.1, pulled from v0.2 roadmap)
**Used by:** consumer electronics, EV, airline, hotel, bank, pharma — any game where "brand damage is a real risk" OR "a positive viral moment is worth something"

Separate from product-specific quality. A brand's score sits at a baseline (usually 50) and drifts back toward it over time; incidents knock it down, boosts pull it up. Games read the score to modulate demand / WTP / press tone.

## Public API

```ts
import {
  BrandState,
  IncidentRecord,
  IncidentSeverity,
  BoostRecord,
  BoostKind,
  CreateBrandStateInput,
  RecordIncidentInput,
  RecordBoostInput,
  createBrandState,
  recordIncident,
  recordBoost,
  driftToBaseline,
  brandPhase,
  DEFAULT_SEVERITY_DELTA,
  DEFAULT_BOOST_DELTA,
  type BrandPhaseConfig,
} from 'opentycoonos/reputation';
```

### Types

```ts
type IncidentSeverity = 'minor' | 'moderate' | 'major' | 'critical';
type BoostKind = 'award' | 'milestone' | 'press' | 'other';

interface BrandState {
  name: string;
  score: number;          // 0-100, current
  baseline: number;       // usually 50
  recoveryRate: number;   // drift/tick toward baseline
  minScore: number;       // 0
  maxScore: number;       // 100
  lastIncidentDay: number | null;
  incidents: IncidentRecord[];
  boosts: BoostRecord[];
  maxLog: number;
}

interface IncidentRecord {
  id: string;
  day: number;
  severity: IncidentSeverity;
  description: string;
  scoreDelta: number;   // negative
}

interface BoostRecord {
  id: string;
  day: number;
  kind: BoostKind;
  description: string;
  scoreDelta: number;   // positive
}
```

### Functions

| Function | Purpose |
|---|---|
| `createBrandState(input)` | Initializer (name + optional score / baseline / recovery / clamps) |
| `recordIncident(state, input)` | Apply a bad event, update score, log it |
| `recordBoost(state, input)` | Apply a good event, update score, log it |
| `driftToBaseline(state)` | Per-tick drift toward baseline — `brandPhase` wraps this |
| `brandPhase(config)` | `TickPhase<S>` factory — drifts the player's brand (optionally rivals' too) |

### Default severity → score deltas

Tunable per-incident via `scoreDelta`, but the defaults:

| Severity | Default delta |
|---|---|
| `minor` | -2 |
| `moderate` | -5 |
| `major` | -12 |
| `critical` | -25 |

Default boost deltas:

| Kind | Default delta |
|---|---|
| `award` | +4 |
| `milestone` | +2 |
| `press` | +1.5 |
| `other` | +1 |

## Typical wiring

```ts
import { brandPhase, recordIncident, recordBoost } from 'opentycoonos/reputation';
import { pushHeadline } from 'opentycoonos/press';

// In state init:
state.brand = createBrandState({ name: 'My Co.' });

// In an event's resolve:
resolve: (s) => {
  recordIncident(s.brand, {
    day: s.clock.totalDays,
    severity: 'major',
    description: 'Widespread battery-fire reports prompt a voluntary recall.',
  });
  pushHeadline(s, {
    headline: 'Recall announced',
    body: 'Brand trust takes a hit as the company confirms a design flaw.',
    kind: 'incident',
  });
},

// In a recognitionPhase onResult (when player wins an award):
onResult: (s, result) => {
  if (result.placements[0]?.entrantId === 'player') {
    recordBoost(s.brand, {
      day: s.clock.totalDays,
      kind: 'award',
      description: `Won ${result.categoryName}`,
    });
  }
},

// In composeTick:
composeTick<State>([
  // ...
  brandPhase({ getBrandState: s => s.brand }),
  // ...
]);
```

## Design notes

- **Separate from product quality.** Quality is product-specific; brand is company-wide. A phone with bad build quality affects brand over time (through reviews + incidents); brand doesn't equal quality.
- **Defaults + overrides.** `recordIncident` uses default severity deltas; games override per-incident when needed (e.g. "this is a major incident but only -8 in our tuning").
- **Drift is gentle.** Default recovery rate 0.05/tick. At day-tick cadence that's a full 100 points in ~2000 days — meaningfully slow. At monthly cadence (DAYS_PER_TICK=30) the effective drift becomes 1.5/month, so a major incident (-12) takes ~8 months to fully recover. Balance lever.
- **Rival brand is optional.** Games wanting richer rival brand dynamics can carry a BrandState per rival and pass them to `brandPhase` via `getRivalBrandStates`. Lighter games keep a simple `rival.reputation: number`.
- **Log is informational.** Save files carry incidents + boosts for timeline UI. Authoritative state is `score`.

## Out of scope

- **Per-segment perception.** Games wanting "enterprise customers forgive differently from consumers" can layer via their own segment-weighted read of the score.
- **Multi-brand portfolios.** A holding company with sub-brands can maintain one BrandState per sub-brand (since it's name-keyed).
- **Incident probability modeling.** Games use `events/` for "when does an incident happen" — this module just applies the damage.

## Evidence

Shenzhen Phone Tycoon's Brand Trust lever. Prior game designs used ad-hoc numbers (`rival.reputation + player.perks × 3`); this module is the clean replacement. Same shape serves any future game with a brand reputation axis (EV battery fires, airline crashes, bank fraud, pharma withdrawals).
