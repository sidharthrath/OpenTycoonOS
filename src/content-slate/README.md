# content-slate — Auto-commissioned content pipeline driven by player strategy

**Status:** IMPLEMENTED (v0.2)
**Used by:** streaming platforms (auto podcast production), pharma (drug pipeline slates), film/TV studio slates, construction project portfolios, tech R&D slates, law-firm case rosters

The "CEOs set strategy, not individual greenlights" pattern. Player configures an annual budget, per-slot allocation weights, and risk profile. The engine auto-commissions content each cadence (daily/weekly) respecting constraints (max in-flight, max per tick). Paces spending pro-rata against the quarterly budget envelope.

Composes cleanly with [`pipeline/`](../pipeline/README.md) — slate is the *auto-trigger*; pipeline is the *lifecycle*. Game-side `onCommission` callback receives `{ slot, cost }` and spawns a pipeline slot (or whatever the game uses).

## When to use

- Content production should feel strategic, not micro-managed — "set it and forget it" mode for routine greenlighting
- Player-facing strategy has 3-4 coherent levers: budget, allocation across categories, risk profile (prestige vs volume)
- Manual "tentpole" commissions can coexist (game chooses whether to offer)

Real-world analog: Netflix doesn't greenlight every show personally. CEO sets "$15B content budget, 60% global, 30% English prestige, 10% anime." Execs fill in the rest.

If your game has low-cadence, hand-crafted content decisions (Shenzhen's 1-2 phone designs/year), this module is overkill — just use manual commissions.

## Public API

```ts
import {
  ContentSlateStrategy,
  SlateConstraints,
  CommissionRequest,
  createContentSlateStrategy,
  slatePhase,
  slateBudgetResetPhase,
  remainingQuarterBudget,
  remainingYearBudget,
} from 'opentycoonos/content-slate';
```

### Types

```ts
/** Player-configurable strategy. Game persists this on its state. */
interface ContentSlateStrategy<TSlot extends string = string> {
  enabled: boolean;                          // master ON/OFF
  annualBudget: number;                      // $0 or Infinity
  allocationWeights: Record<TSlot, number>;  // raw weights per slot (engine normalizes)
  riskProfile: number;                       // 0 = prestige/few-big, 1 = volume/many-small
  yearToDateSpend: number;
  quarterToDateSpend: number;
  yearStartedDay: number;
  quarterStartedDay: number;
}

interface SlateConstraints {
  maxInFlight: number;               // e.g. 12 — soft cap on production queue
  maxPerTick: number;                // e.g. 3 — how many commissions per slate firing
  cadenceTicks: number;              // slate fires every N ticks (1 daily, 7 weekly)
  // Optional: if BOTH are set, engine samples a risk-biased cost per commission
  // and passes it as `sampledCost`. Omit for game-driven cost.
  minCostPerCommission?: number;
  maxCostPerCommission?: number;
}

interface CommissionRequest<TSlot extends string = string> {
  slot: TSlot;
  /** Quarterly budget remaining right now. Game self-gates. */
  availableBudget: number;
  /** Populated only if SlateConstraints has min/max cost. Game may use as target. */
  sampledCost?: number;
}

interface SlateCommissionOutcome {
  /** Actual cost to charge to slate counters. */
  cost: number;
}
```

### Two cost-driver modes

**Engine-sampled cost** (streaming-tycoon-style): set `min/maxCostPerCommission`. Engine samples a cost via risk-biased range; game uses `request.sampledCost` as the commission target, returns `{ cost: sampledCost }` on acceptance.

**Game-driven cost** (Stream Co. podcast-slate style): omit cost range. Game derives cost from its own rich mix (e.g., tier × host × format weights). Game self-gates against `request.availableBudget` + game cash, returns `{ cost: gameComputedCost }` on acceptance.

Either way, the `onCommission` callback is responsible for mutating game state (spawning pipeline slot, deducting cash). Engine only tracks slate QTD/YTD counters.

### Functions

| Function | Purpose |
|---|---|
| `createContentSlateStrategy({ allocationWeights, ... })` | Init state with defaults |
| `slatePhase(config)` | `TickPhase<S>` — runs every `cadenceTicks`; commissions up to `maxPerTick` via game-supplied `onCommission` |
| `slateBudgetResetPhase(getStrategy, getDay)` | `TickPhase<S>` — rolls over quarter + year counters |
| `remainingQuarterBudget(strategy, day)` | Cash left in current quarter (pro-rated) |
| `remainingYearBudget(strategy)` | Total year budget minus ytd-spend |

## Wiring

```ts
import { composeTick } from 'opentycoonos/tick';
import { slatePhase, slateBudgetResetPhase, createContentSlateStrategy } from 'opentycoonos/content-slate';
import { commissionSlot } from 'opentycoonos/pipeline';

// State init
state.podcastSlate = createContentSlateStrategy<PodcastGenre>({
  allocationWeights: { 'true-crime': 2, news: 2, comedy: 1.5, ... },
  annualBudget: 20_000_000,
  riskProfile: 0.3, // slight lean toward prestige
});

// Tick composition
composeTick<State>([
  clockPhase({ maxYears: 10 }),
  slateBudgetResetPhase(s => s.podcastSlate, s => s.clock.totalDays),
  pipelineProgressPhase(s => s.contentPipeline, 1, onPodcastLaunch),

  // Slate auto-commission
  slatePhase({
    getStrategy: s => s.podcastSlate,
    getCash: s => s.finances.cash,
    getInFlightCount: s => s.contentPipeline.slots.filter(x => x.status !== 'launched').length,
    getDay: s => s.clock.totalDays,
    constraints: {
      maxInFlight: 12,
      maxPerTick: 3,
      minCostPerCommission: 500_000,
      maxCostPerCommission: 15_000_000,
      cadenceTicks: 7, // weekly slate
    },
    onCommission: (state, { slot, cost }) => {
      // Game decides HOW to spawn the commission. Here: pipeline slot with genre meta.
      state.finances.cash -= cost;
      const id = commissionSlot(state.contentPipeline, {
        cost,
        totalDays: 90 + Math.random() * 30,
        meta: { genre: slot, title: generateTitle(slot) },
      }, state.clock.totalDays);
      return id !== null;
    },
  }),

  // ... other phases
]);
```

## How the algorithm works

Per slate firing (every `cadenceTicks`):

1. **Skip conditions** — strategy disabled, cadence miss, year-start not initialized, etc.
2. **Compute this-tick budget**:
   ```
   quarterBudget = annualBudget / 4
   quarterPortion = (day - quarterStartedDay) / 91   (fraction of quarter elapsed)
   availableQuarterToDate = quarterBudget × quarterPortion - quarterToDateSpend
   ```
   Pro-rates linearly. Slate trying to catch up if under-budget; skips if over-budget for the pace.
3. **Commission loop** — up to `maxPerTick`:
   - Break if `inFlightCount >= maxInFlight`
   - Pick a slot via weighted random from `allocationWeights`
   - Sample a cost:
     ```
     target = 0.75 - riskProfile × 0.55   (prestige 0.75; volume 0.20 of the range)
     fraction = clamp(target + rng*0.30 - 0.15, 0.05, 0.95)
     cost = minCostPerCommission + (maxCostPerCommission - minCostPerCommission) × fraction
     ```
     Prestige slates bias high-cost/prestige pieces; volume slates bias low-cost/frequent.
   - Break if `cost > availableQuarterToDate` or `cost > cash`
   - Call `onCommission(state, { slot, cost })` — game spawns whatever it wants
   - If accepted, increment `quarterToDateSpend`, `yearToDateSpend`, decrement `availableQuarterToDate`, count toward `maxPerTick`

Budget-reset phase runs independently: at day 91 marks → reset `quarterToDateSpend`; at day 364 → reset `yearToDateSpend`.

## Coexistence with manual commissions

The slate is opt-in; manual commissions still work. Game typically offers:
- **Slate panel** — annual budget slider + per-slot allocation sliders + risk profile + ON/OFF
- **Tentpole panel** — manual commission button for one-off flagship bets (no budget cap; may exceed slate strategy)

Both feed the same production pipeline.

## Design notes

- **Pure functions, state-mutation compatible.** Immer-draft friendly.
- **Budget pacing is pro-rata per quarter**, not per tick — protects against spiky early-quarter over-commissioning (slate targets linear burn).
- **Risk profile biases SIZE of each commission**, not the commissioning frequency. Frequency is controlled by `maxPerTick`.
- **Slot is game-typed** (`TSlot extends string`) — pass your genre/category/type ids and you get type-safe allocation weights.
- **Game-supplied `onCommission` does the actual work** — spawn a pipeline slot, queue a project, produce a SKU. Engine stays genre-agnostic.
- **Returns `false` from `onCommission`** to signal commission refusal (e.g., game decided not to greenlight this particular genre right now) — slate skips without charging budget.

## Out of scope

- **Season / quarterly slate planning UI.** Game owns UI; this is pure logic.
- **Multi-stage commissions** (pilots → full series greenlight). Chain via `pipeline.onLaunch` callbacks spawning new slate commissions.
- **Taste / quality scoring of slate output.** Game's `onCommission` handles; slate doesn't evaluate.
- **Per-cohort ROI tracking.** Game tracks separately if needed.

## Evidence

Generalized from streaming-tycoon's `slateExecutionPhase` (see `/streaming-tycoon/src/engine/phases.ts` in the legacy repo). That version was streaming-specific: `ContentStrategy` with `genreAllocation`, `seriesShare`, fixed series/film cost ranges. Generalized here to game-defined slot types (`TSlot`), single cost range + risk-biased sampling, configurable cadence. Composes with `pipeline/` rather than embedding lifecycle logic.

Designed to serve Stream Co. auto podcast production (primary) and future pharma/film/R&D games (portfolio use).
