# pipeline — Project-commissioning lifecycle (annual budget → slate → launch)

**Status:** IMPLEMENTED (v0.2)
**Used by:** content commissioning (streaming originals), drug pipelines (pharma trials), construction (project portfolio), film slates, podcast originals

The "I commit cash now to a project that takes N days to ship and either launches or fails" pattern. Generalized from streaming-tycoon's content-slate logic.

Tracks: annual budget envelope, in-progress slots with day-by-day cost burn, status transitions (commissioned → in-development → launched / cancelled), spent-this-year accounting that resets at year boundaries.

> **Note on v0.5 plans:** the original sketch for this module was a sequential probabilistic-gates model (pharma trial Phase 1 → 2 → 3, each with pass/fail). That richer model is still on the roadmap as a layer above this one — multi-stage projects can be expressed as multiple sequential `commissionSlot` calls in `onLaunch` callbacks. The v0.2 module here is the lifecycle primitive; the multi-stage gate model can compose on top.

## When to use

- Player commissions multi-tick projects with up-front commitment + daily burn (or fixed cost up front).
- You want budget discipline (annual envelope, can't overcommit).
- Each project's launch is a meaningful event (game fires "the show is live" / "the trial succeeded" headlines).
- Cancellation is a real option with partial cost recovery.

If your "projects" are one-tick decisions (research nodes, perks), use `research` or `perks` instead. This module is for things that take real time + ongoing capital.

## Public API

```ts
import {
  PipelineSlotStatus,
  PipelineSlot,
  PipelineState,
  CommissionInput,
  CancelResult,
  createPipelineState,
  commissionSlot,
  cancelSlot,
  pipelineProgressPhase,
  pipelineBudgetResetPhase,
  remainingBudget,
  inFlightCount,
  countByStatus,
} from 'opentycoonos/pipeline';
```

### Types

```ts
type PipelineSlotStatus = 'commissioned' | 'in-development' | 'launched' | 'cancelled';

interface PipelineSlot<TMeta = unknown> {
  id: string;
  status: PipelineSlotStatus;
  /** Total committed cost. */
  cost: number;
  /** Cash spent so far (incremented per tick during in-development). */
  costSpentSoFar: number;
  /** Days remaining until launch. */
  daysToLaunch: number;
  /** Original total days at commission time. */
  totalDays: number;
  /** Day this slot was commissioned (game day, not real). */
  commissionedDay: number;
  /** Day it launched (or null if still in flight / cancelled). */
  launchedDay: number | null;
  /** Game-defined metadata (genre, length, host, drug-target, etc.). */
  meta: TMeta;
}

interface PipelineState<TMeta = unknown> {
  slots: PipelineSlot<TMeta>[];
  /** Annual budget envelope (game-set; can grow/shrink). */
  annualBudget: number;
  /** Cash spent on commissions this year (resets via budgetResetPhase). */
  spentThisYear: number;
  /** Day the current budget year started. */
  yearStartedDay: number;
}
```

### Functions

| Function | Purpose |
|---|---|
| `createPipelineState(annualBudget)` | Init |
| `commissionSlot(state, input, dayCommissioned)` | Add a new commissioned slot; returns slot id or null if budget blocks |
| `cancelSlot(state, slotId, recoveryRate)` | Cancel; refund (1 − costSpentRatio) × cost × recoveryRate |
| `pipelineProgressPhase(getter, daysPerTick, onLaunch?)` | `TickPhase<S>` — burns daily cost, decrements days, fires onLaunch when slot lands |
| `pipelineBudgetResetPhase(getter)` | `TickPhase<S>` — at year boundary, zeros spentThisYear |
| `remainingBudget(state)` | annualBudget − spentThisYear |
| `inFlightCount(state)` | Slots with status ≠ launched/cancelled |
| `countByStatus(state, status)` | Count by status |

## Tick wiring

```ts
import { composeTick } from 'opentycoonos/tick';
import { pipelineProgressPhase, pipelineBudgetResetPhase, commissionSlot } from 'opentycoonos/pipeline';

composeTick<State>([
  clockPhase({ maxYears: 10 }),
  pipelineBudgetResetPhase(s => s.contentPipeline),
  pipelineProgressPhase(
    s => s.contentPipeline,
    1,                             // daysPerTick
    (state, slot) => {
      // Game's launch handler — add to catalog, fire press, etc.
      state.catalog.podcasts.push({ id: slot.id, ...slot.meta });
      pushHeadline(state, {
        headline: `${slot.meta.title} drops`,
        body: `Your latest original podcast is live.`,
        kind: 'launch',
        owner: 'player',
      });
    },
  ),
  // ... other phases
]);
```

## Commissioning

```ts
const id = commissionSlot(
  state.contentPipeline,
  {
    cost: 8_000_000,
    totalDays: 180,
    meta: { title: 'The Daily Algorithm', host: 'Lin Mei', category: 'tech' },
  },
  state.clock.totalDays,
);
// Returns null if (cost > remainingBudget). Game shows blocked-state in UI.
```

The cost is checked against `annualBudget − spentThisYear`. If insufficient, returns null without mutating. Commissioning *immediately* commits the full cost against the year's budget envelope (you can't commission $20M worth of projects when only $5M remains, even if the actual cash burn is over 180 days).

## Cancellation

`cancelSlot(state, slotId, recoveryRate)` returns:
- `refunded` — cash given back
- `sunk` — cash already burned, lost

`refunded = (cost − costSpentSoFar) × recoveryRate`. The unspent portion can be recovered partially (recoveryRate 0-1 — termination penalties). Already-burned cash is sunk.

Cancelled slots stay in the array with `status: 'cancelled'` for UI/history; if you want them gone, filter your render.

## Daily burn

`pipelineProgressPhase` runs each tick:
1. For each `commissioned` slot → flips to `in-development` (one-time transition).
2. For each `in-development` slot:
   - Burns `cost / totalDays × daysPerTick` from `costSpentSoFar` (bookkeeping; cancellation math reads this).
   - Decrements `daysToLaunch`.
   - On `daysToLaunch ≤ 0` → status='launched', fires `onLaunch(state, slot)`.

**Note:** the engine does NOT deduct cash by default. The `commissionSlot` step commits the budget envelope; you decide how to expense it. Most games: deduct full `cost` from cash at commission time, then `pipelineProgressPhase` only handles status transitions.

## Design notes

- **Annual budget is soft.** Game sets it; engine enforces "can't commission past this." Game can change it mid-year (raised funds → bigger slate).
- **Fiscal year resets at clock.year change.** Detected via day-since-yearStart. Game can override by zeroing `spentThisYear` manually.
- **Meta is freely typed.** Pass any shape — genre, host, target market, trial-phase, building floor count.
- **No quarterly slate planning baked in.** That's a layer above; this module is the lifecycle primitive. Game can model "commission Q1 slate" as 5 commissionSlot calls in a row.
- **Cancellation recovery is game-decided.** Real contracts vary 30-100% recoverable; pass it in.

## Out of scope

- Slate planning UI (annual budget → quarterly buckets → individual commissions). Game owns.
- Multi-stage probabilistic projects (drug trial Phase 1 → 2 → 3 with per-stage pass/fail). Use multiple slots in sequence with onLaunch callbacks; richer engine model on the v0.5 roadmap.
- Production capacity constraints (only N projects concurrently). Add to commissionSlot guard in your game logic.
- Quality / risk scoring of in-flight projects. Bake into meta + your own scoring functions.

## Evidence

Generalized from streaming-tycoon's content-slate commissioning pattern (annual content spend → quarterly slate decisions → individual show launches over 90-180 days). Generalizes to pharma drug-trial pipelines, film slates, podcast originals, and construction project portfolios — anywhere "commit cash now → ship later" is a recurring decision.
