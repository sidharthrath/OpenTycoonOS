# market-topology/geographic — Regional rollout

**Status:** IMPLEMENTED (v0.1, pulled from v0.2 roadmap)
**Used by:** any game with spatial expansion — consumer hardware, EV, retail, airline, telecom, coaching-chain

Per-region state + entry mechanics. The engine tracks which regions are entered, their entry day, market share, installed base, and cumulative regulatory cost. Games compose regional state with their own demand / pricing / marketing logic.

Complementary to `market-topology/segmented/` — games with both segmented demand AND geographic expansion use them together (segments within each region).

## Public API

```ts
import {
  RegionDef,
  RegionRuntimeState,
  GeographicState,
  EntryBlockReason,
  createGeographicState,
  isEntered,
  enteredRegions,
  totalEnteredPopulation,
  totalEnteredRegCost,
  canEnterRegion,
  enterRegion,
  applyRegulatoryCosts,
} from 'opentycoonos/market-topology/geographic';
```

### Types

```ts
interface RegionDef<TRegion extends string, S = unknown> {
  id: TRegion;
  name: string;
  displayName: string;
  population: number;             // total users in region; scales demand
  priceSensitivity: number;       // 0-1
  regulationCost: number;         // per-tick ongoing
  minCapitalToEnter: number;      // one-time entry fee
  entryGate?: (gameState: S) => boolean;   // custom gate predicate
  description?: string;
}

interface RegionRuntimeState<TRegion extends string> {
  regionId: TRegion;
  entered: boolean;
  enteredOnDay: number | null;
  marketShare: number;            // 0-1, game manages
  installedBase: number;          // game manages
  cumulativeRegCost: number;
}

interface GeographicState<TRegion extends string> {
  regions: Record<TRegion, RegionRuntimeState<TRegion>>;
}
```

### Functions

| Function | Purpose |
|---|---|
| `createGeographicState(defs, homeRegionId?)` | Init. Home region auto-entered on day 0 |
| `isEntered(state, regionId)` | Quick boolean |
| `enteredRegions(state)` | All entered runtime states |
| `totalEnteredPopulation(defs, state)` | Sum population — demand scaling |
| `totalEnteredRegCost(defs, state)` | Per-tick regulatory total |
| `canEnterRegion(defs, state, regionId, gameState, getCash)` | Returns `null` if entry allowed, else a block reason |
| `enterRegion(defs, state, regionId, day)` | Marks entered, returns cost to deduct |
| `applyRegulatoryCosts(defs, state)` | Accumulates reg cost into runtime, returns total |

## Entry gating

`canEnterRegion` checks, in order:
1. Region exists.
2. Not already entered.
3. Cash ≥ `minCapitalToEnter` (via `getCash` accessor — engine is agnostic to finances module).
4. Optional `entryGate(gameState)` passes.

Returns `'already-entered' | 'insufficient-capital' | 'gate-failed' | 'unknown-region'`, or `null` if all checks pass. UI uses the reason to disable buttons with informative labels ("NEED $5M" vs "BRAND ≥ 60 REQUIRED").

## Typical wiring

```ts
import {
  createGeographicState,
  applyRegulatoryCosts,
  canEnterRegion,
  enterRegion,
  totalEnteredPopulation,
  type RegionDef,
} from 'opentycoonos/market-topology/geographic';

type PhoneRegion = 'china' | 'india' | 'sea' | 'europe';

const REGIONS: RegionDef<PhoneRegion, GameState>[] = [
  {
    id: 'china',
    name: 'CN',
    displayName: 'China',
    population: 1_400_000_000,
    priceSensitivity: 0.6,
    regulationCost: 0,
    minCapitalToEnter: 0,
    description: 'Home market. Already entered.',
  },
  {
    id: 'india',
    name: 'IN',
    displayName: 'India',
    population: 1_400_000_000,
    priceSensitivity: 0.85,
    regulationCost: 20,
    minCapitalToEnter: 2_000_000,
    entryGate: (s) => s.brand.score >= 50,
    description: 'Price-sensitive, fiercely competitive.',
  },
  // ... more regions
];

// In state init:
state.geography = createGeographicState(REGIONS, 'china');

// In demand phase:
const baselineMarketSize = REGIONS.find(r => r.id === 'china')!.population;
const enteredPop = totalEnteredPopulation(REGIONS, state.geography);
const demandMultiplier = enteredPop / baselineMarketSize;
const effectiveDemand = baseDemand * demandMultiplier;

// In financial phase getBurn:
const regCost = applyRegulatoryCosts(REGIONS, state.geography);
return unitSales.lastTickCOGS + inventory.lastTickUpkeep + regCost + ...;

// In UI (player-initiated action):
const blockReason = canEnterRegion(REGIONS, state.geography, 'india', state, s => s.finances.cash);
if (blockReason === null) {
  const cost = enterRegion(REGIONS, state.geography, 'india', state.clock.totalDays);
  state.finances.cash -= cost;
  pushHeadline(state, { headline: 'Entered India', ... });
}
```

## Design notes

- **Engine provides the bookkeeping; game drives the strategy.** Population scaling, demand multipliers, per-region pricing, marketing allocation — all game-specific. The engine just tracks who's entered.
- **Home region is first-class.** `createGeographicState(defs, 'china')` marks China as entered on day 0, so games don't need to call `enterRegion` for their starting region.
- **Entry gates compose.** `canEnterRegion` AND's together all checks (existence + cash + gate). Games layering regulatory research gates + capital gates + prerequisite-region gates put all of that into `entryGate`.
- **`getCash` accessor keeps finances decoupled.** Engine doesn't import `financial/`; caller supplies `s => s.finances.cash`. Same pattern as `financialPhase`'s revenue/burn callbacks.
- **No rollout sequencing in the module itself.** If a game wants "India requires China entered first," they bake it into `india.entryGate = (s) => isEntered(s.geography, 'china')`. Engine stays flat.

## Out of scope (v0.1)

- **Per-region pricing.** Games often want different prices per region — layer on top via per-region price overrides in the game's SKU catalog.
- **Per-region marketing budget.** Games track this in their own state.
- **Region-specific rivals.** Games extend `CompetitorState<TMeta>` to indicate which regions each rival operates in.
- **Distance / logistics.** Networks are the job of a future `market-topology/network/` module — this one is flat regions, no edges.

## Evidence

Shenzhen Phone Tycoon's 4-region rollout (China → India → SEA → Europe). Same shape serves future EV Tycoon, Retail Tycoon, Airline MVP — any spatial-expansion tycoon.
