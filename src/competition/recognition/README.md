# competition/recognition — Awards + rankings framework

**Status:** IMPLEMENTED (v0.1)
**Used by:** games with annual awards, rankings, or ceremonies

Generic ceremony mechanic. Games define award categories + scoring functions; the module handles cadence-based firing, ranking, history, and press integration.

Same shape works for:
- "Phone of the Year" / "Best Camera" / "Best Budget" (Shenzhen Phone)
- "Best Coaching Center" / "Best Teacher in Subject X" (Coaching Tycoon)
- "Studio of the Year" / "GOTY by Genre" (future Studio Tycoon)
- Annual industry power rankings

## Public API

```ts
import {
  AwardCategoryDef,
  AwardPlacement,
  AwardResult,
  RecognitionState,
  CeremonyCadence,
  createRecognitionState,
  computeAwards,
  recordAwards,
  latestCeremony,
  hasEverWon,
  recognitionPhase,
} from 'opentycoonos/competition/recognition';
```

### Types

```ts
interface AwardCategoryDef<S, TEntrant> {
  id: string;
  name: string;
  description?: string;
  getEntrants: (state: S) => readonly TEntrant[];
  scoreEntrant: (entrant: TEntrant, state: S) => number;
  entrantLabel: (entrant: TEntrant) => string;
  entrantId: (entrant: TEntrant) => string;
  topN?: number;      // default 1 — how many placements to record
}

interface AwardResult {
  categoryId: string;
  categoryName: string;
  day: number;
  placements: AwardPlacement[];   // rank 1, 2, 3...
}

interface RecognitionState {
  history: AwardResult[];
  maxHistory: number;
}
```

### Functions

| Function | Purpose |
|---|---|
| `createRecognitionState(maxHistory?)` | Fresh state (default cap 20) |
| `computeAwards(state, categories)` | Pure — evaluate + rank, no mutation |
| `recordAwards(state, results)` | Append to history with cap |
| `latestCeremony(state)` | Most recent day's results (or null) |
| `hasEverWon(state, entrantId, categoryId?)` | Has this entrant ever placed #1? |
| `recognitionPhase(config)` | `TickPhase<S>` factory; fires on cadence |

### Ceremony cadence

- `'yearly'` (default) — fires when `ctx.isNewYear === true`
- `'quarterly'` — fires on `ctx.isNewQuarter`
- `'triggered'` — never auto-fires; game calls `computeAwards` + `recordAwards` directly

## Wiring into a tick

```ts
import { composeTick } from 'opentycoonos/tick';
import { recognitionPhase } from 'opentycoonos/competition/recognition';
import { pushHeadline } from 'opentycoonos/press';

const categories = [
  {
    id: 'phone-of-the-year',
    name: 'Phone of the Year',
    getEntrants: s => s.rivals.concat([playerAsEntrant(s)]),
    scoreEntrant: e => e.reputation + (e.meta?.qualityScore ?? 50) * 0.5,
    entrantLabel: e => e.name,
    entrantId: e => e.id,
    topN: 3,
  },
];

composeTick<State>([
  // ...
  recognitionPhase({
    categories,
    getRecognitionState: s => s.recognition,
    onResult: (s, result) => pushHeadline(s, {
      headline: `${result.categoryName}: ${result.placements[0].entrantLabel}`,
      body: `Announced at the annual ceremony. Score: ${Math.round(result.placements[0].score)}.`,
      kind: 'awards',
    }),
  }),
  // ...
]);
```

## Design notes

- **Pure `computeAwards` first.** Let UI previews + tests call `computeAwards` without mutating anything. `recordAwards` is the separate side-effect step.
- **Entrant pool is game-provided.** The engine doesn't know rivals from products from teachers — `getEntrants` returns whatever's eligible for this category.
- **Ties broken by order.** If two entrants tie on score, the one earlier in `getEntrants`'s return order wins. Games can add tiebreakers by offsetting scores within the scoring function (e.g. `+entrant.reputation * 0.0001`).
- **Day stamp grouping.** `latestCeremony` groups by day (not ceremony id), so yearly awards all share one day and render together.
- **Scoring lives in the game.** Rivals scoring high on "best camera" use different metrics than "best budget." The game puts that logic in `scoreEntrant`.
- **History is the authoritative log.** UI reads from `recognitionState.history`. The engine doesn't maintain a separate "latest winners" flag — compute via `latestCeremony`.

## Out of scope

- **Multi-ceremony years** (e.g. Best Phone twice a year): use a separate phase or `'quarterly'` cadence.
- **Weighted voting / fan votes**: games can bake into `scoreEntrant`.
- **Award-driven UI/UX** (ceremony cutscene, envelope reveal): handled by the shell + game, not the engine.

## Evidence

Shenzhen Phone Tycoon wants annual "Phone of the Year" with multiple sub-categories (Best Flagship / Best Camera / Best Budget / Best Design). Coaching Tycoon wants annual academy rankings. The shape is identical — this module generalizes.
