# Perks — Milestone unlocks

**Status:** IMPLEMENTED (v0.1)
**Used by:** every game (passive progression layer)

Threshold-based passive bonuses. Once a game-defined condition is met, the perk latches (or stays active while the condition holds) and its effect applies.

Examples across games:
- Coaching Tycoon: `first-air-100` → +20% Premium-tier enrollment
- Shenzhen Phone Tycoon: `first-million-phones` → unlocks earphone category
- Any game: `survive-3-years` → cosmetic badge + 5% awareness bonus

## Public API

```ts
import {
  PerkDef,
  PerkState,
  createPerkState,
  isPerkUnlocked,
  checkPerkTriggers,
  getActivePerkEffects,
  sumEffects,
  productEffects,
  perkPhase,
  PerkPhaseConfig,
} from 'opentycoonos/perks';
```

### Types

```ts
interface PerkDef<S, E = void> {
  id: string;
  name: string;
  description: string;
  trigger: (state: S) => boolean;
  effect: E;
  once?: boolean;  // default true (latches); false = live conditional
}

interface PerkState {
  unlocked: string[];
}
```

### Functions

| Function | Purpose |
|---|---|
| `createPerkState()` | Fresh empty state — put on your game state at init |
| `isPerkUnlocked(perkState, perkId)` | Quick boolean check |
| `checkPerkTriggers(state, defs, perkState)` | Evaluate latching perks; mutates perkState with new unlocks; returns newly-unlocked ids |
| `getActivePerkEffects(state, defs, perkState)` | Returns effect payloads of all active perks (latched + currently-conditional) |
| `sumEffects(effects, extract)` | Additive aggregate helper |
| `productEffects(effects, extract)` | Multiplicative aggregate helper |
| `perkPhase(config)` | `TickPhase<S>` factory — drop into `composeTick([...])` |

### Effect aggregation

The engine doesn't know what your effects mean. You define the shape:

```ts
interface MyEffect {
  awarenessBonus: number;   // additive, stacks to sum
  costMultiplier: number;   // multiplicative, stacks to product
  unlocksHostel: boolean;   // flag, stacks to OR
}

const perks: PerkDef<GameState, MyEffect>[] = [
  {
    id: 'first-100-students',
    name: 'First 100 Students',
    description: '+5% awareness base rate',
    trigger: s => s.totalStudents >= 100,
    effect: { awarenessBonus: 0.05, costMultiplier: 1.0, unlocksHostel: false },
  },
  // ...
];

// In your tick or selector:
const active = getActivePerkEffects(state, perks, state.perks);
const totalAwarenessBonus = sumEffects(active, e => e.awarenessBonus);
const totalCostMultiplier = productEffects(active, e => e.costMultiplier);
const hostelUnlocked = active.some(e => e.unlocksHostel);
```

### Tick-loop integration

`perkPhase` composes into your tick pipeline. It evaluates latching triggers and optionally fires a callback per unlock — perfect for pushing a press headline:

```ts
import { composeTick, clockPhase, financialPhase } from 'opentycoonos/tick';
import { perkPhase } from 'opentycoonos/perks';
import { pushHeadline } from 'opentycoonos/press';

const gameTick = composeTick<GameState>([
  clockPhase({ maxYears: 10 }),
  // ... game-specific phases ...
  perkPhase({
    defs: myPerkDefs,
    getPerkState: s => s.perks,
    onUnlock: (state, def) => pushHeadline(state, {
      headline: `Milestone unlocked: ${def.name}`,
      body: def.description,
      kind: 'milestone',
    }),
  }),
  financialPhase({ minOwnership: 0.1 }, getRevenue, getBurn),
]);
```

Order matters: put `perkPhase` after the phases that move the stats it reads (users, cash, awards, etc.), so triggers evaluate against the post-tick state.

## Design notes

- **`once: true` (default)** = latch. Once triggered, stays unlocked for the run. Stored in `PerkState.unlocked`. Almost all perks are this.
- **`once: false`** = live conditional. Effect applies only while `trigger(state)` returns true. Not stored in state. Use for "while we have ≥ 3 products in market, +5% marketing efficiency" style perks.
- **State shape is minimal on purpose** — just `{ unlocked: string[] }`. Save files stay small; mod-safe if perk ids are stable.
- **Zero opinion on effect shape** — games define it. Some games will have `{ awareness, cost, revenue }`, others will have flag unlocks, others will have function-valued effects. That's fine.
- **Pure-function tests friendly** — no hidden state, all inputs explicit.

## What "once" really means

- `once: true` perks are a one-way door. Trigger fires → latched → effect always applies.
  → If your game design ever wants a perk to be *revokable*, use `once: false`.
- `once: false` perks are two-way. Effect applies iff trigger currently true.
  → Useful for "while you have 10+ stars on the board" style live buffs.
- Mixing is fine — a game can have both styles in the same `defs` array.

## Evidence

Streaming-tycoon shipped with `unlockedPerks: string[]` in `GameState` but never actually wrote to it or read effects from it — perks were designed but never built. This module closes that gap with a generic, game-agnostic design that any TycoonOS game can pick up.

## Out of scope

- **Tiered perks** (e.g. "unlock at 1M → 10M → 100M users for escalating bonuses"): games can model this as multiple separate `PerkDef`s. If the pattern becomes common, we'll add a tiered-perk helper in a later release.
- **Save-file migration** for perks whose ids have changed: games handle at their save-load layer. The engine doesn't version perk ids.
- **UI:** rendered by `downstream UI package`'s `<PerksScreen />` (landing later). This module is pure state/logic.
