# seasonality — Calendar-based multipliers

**Status:** IMPLEMENTED (v0.1, pulled from v0.2 roadmap)
**Used by:** any game with meaningful calendar rhythms — consumer hardware (Q4 holiday), retail (holiday + back-to-school), airline (summer peak), brewery (summer peak), hotel (regional seasons), coaching (exam windows)

Pure-function module. Games define calendar phases (date windows with named multipliers); the module provides helpers to look up which multipliers are active on a given month. No runtime state, no tick phase — seasonality is a read model games consult from their own phases.

## Public API

```ts
import {
  SeasonalPhase,
  SeasonalityConfig,
  currentMonth,
  phaseIsActiveInMonth,
  phasesForMonth,
  modifierForMonth,
  modifiersForMonth,
  modifierForClock,
  activePhaseNames,
} from 'opentycoonos/seasonality';
```

### Types

```ts
interface SeasonalPhase<TMod extends string = string> {
  id: string;
  name: string;
  description?: string;
  startMonth: number;      // 1-12
  endMonth: number;        // 1-12; if < startMonth, wraps (e.g. 11→1 = Nov-Dec-Jan)
  modifiers: Partial<Record<TMod, number>>;   // multipliers, ~1.0 is neutral
}

interface SeasonalityConfig<TMod extends string = string> {
  phases: readonly SeasonalPhase<TMod>[];
  defaultValue?: number;   // fallback when no phase supplies a key. Default 1.0.
}
```

### Functions

| Function | Purpose |
|---|---|
| `currentMonth(clock)` | Derive month 1-12 from GameClock.totalDays |
| `phaseIsActiveInMonth(phase, month)` | Window check, handles wrap-around |
| `phasesForMonth(config, month)` | All phases active this month |
| `modifierForMonth(config, month, key)` | One modifier's active multiplier (stacks by product) |
| `modifiersForMonth(config, month)` | All active modifiers as a Partial<Record> |
| `modifierForClock(config, clock, key)` | Convenience: month derived from clock |
| `activePhaseNames(config, clock)` | Array of active phase names for UI chips |

## Example (Shenzhen Phone Tycoon)

```ts
import type { SeasonalityConfig } from 'opentycoonos/seasonality';

type PhoneSeasonMod = 'demand' | 'supply';

export const phoneSeasonality: SeasonalityConfig<PhoneSeasonMod> = {
  phases: [
    {
      id: 'q4-holiday',
      name: 'Holiday Quarter',
      description: 'Gift-buying surge. Peak demand for flagships.',
      startMonth: 10,
      endMonth: 12,
      modifiers: { demand: 1.3 },
    },
    {
      id: 'cny-lull',
      name: 'Chinese New Year',
      description: 'Factories slow; supply dips.',
      startMonth: 1,
      endMonth: 2,
      modifiers: { supply: 0.85 },
    },
  ],
};

// In a tick phase:
const demandMult = modifierForClock(phoneSeasonality, state.clock, 'demand');
const supplyMult = modifierForClock(phoneSeasonality, state.clock, 'supply');
const effectiveDemand = Math.round(baseDemand * demandMult);
const effectiveCapacity = Math.round(totalCapacity(state.inventory) * supplyMult);
```

## Design notes

- **No state.** Phase definitions are const; active modifiers are a pure function of the current month. Nothing to persist, nothing to tick.
- **Multipliers stack by product.** If two overlapping phases each specify `demand`, their multipliers multiply (1.3 × 1.1 = 1.43). Keeps the math associative and intuitive.
- **Wrap-around supported.** `startMonth: 11, endMonth: 2` ≡ Nov-Dec-Jan-Feb. No need to split into two phases for winter.
- **Game-defined modifier keys.** The `TMod` generic is a string-literal union games pick. `'demand' | 'supply'` for phone, `'tourism' | 'snowfall'` for hotel, `'exam-pressure' | 'enrollment'` for coaching.
- **Defaults neutral.** When no phase covers the current month for a key, the multiplier is 1.0 (or whatever `defaultValue` overrides). Games can layer seasonality without needing exhaustive coverage.
- **Month derivation is approximate.** The engine calendar is 364 days/year, 91 days/quarter. `currentMonth()` divides by 364/12 ≈ 30.33 days, so month boundaries don't perfectly align with quarter boundaries. Close enough for demand-curve purposes; games needing strict fiscal-month math can compute their own.

## Out of scope

- **Per-region seasonality.** A Southern-Hemisphere airline wants opposite-seasons of a Northern one. For now, games maintain separate SeasonalityConfigs per region and read the right one.
- **Event-driven seasons.** Things like "the monsoon arrived early this year" fire through `events/`, not here. Seasonality is the predictable baseline; events are the surprises.
- **Multi-year cycles.** No support for "Olympic year only." Games use `events/` with `cadence: 'yearly'` + eligibility checks for that.

## Evidence

Shenzhen Phone Tycoon's GDD §4 "Annual rhythm" — Q4 holiday flagship launches, Q1 CNY supply lull. Same shape serves any future game with calendar seasonality.
