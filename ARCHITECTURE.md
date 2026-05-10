# Architecture

TycoonOS is built around one principle:

> **Tycoon games are compositions of capability modules. Each module does one thing. Games import what they need.**

No game-type inheritance, no "Service" vs "Goods" base classes. Just capability modules that compose.

## The three-axis core

Every game must pick one option from each of three axes:

### 1. Revenue model (how money comes in)

| Option | Characteristic | Example games |
|---|---|---|
| `subscription` | recurring MRR, churn, LTV | streaming, AI SaaS, social, news paywall, bank deposits |
| `transaction` | per-unit events (ride, sale, query) | AV, airline, metro, rental, payment processor |
| `unit-sale` | discrete products w/ COGS + margin | EV, consumer electronics, fashion, pharma |

Some games use hybrids (AV has transaction revenue + subscription for fleet partners).

### 2. Asset model (what capital is deployed)

| Option | Characteristic | Example games |
|---|---|---|
| *(none)* | no physical assets | streaming (just IP), social network, search |
| `inventory` | stockable goods, COGS | EV, consumer electronics, retail, CPG |
| `fleet` | mobile capital assets | AV, airline, rental, cruise, logistics |
| `infrastructure` | fixed capital, long-lived | metro, telecom, utility, solar, shipping |

### 3. Market topology (how users relate)

| Option | Characteristic | Example games |
|---|---|---|
| `segmented` | demographic buckets | streaming, AI, social, SaaS, news |
| `geographic` | regional markets w/ rollout | EV, retail, banking, insurance |
| `network` | graph of nodes + edges | airline, metro, telecom, logistics |

Games can **compose multiple topologies** — a telecom game uses `geographic` (region rollout) + `network` (coverage creates connectivity value).

## Cross-cutting capabilities

Orthogonal to the 3-axis core, these modules are composable across any game shape:

| Capability | Always needed? | Used by |
|---|---|---|
| `core/` (clock, finance, research, tick, types, utils) | **Yes** | Every game |
| `game-blueprints/` (generator composition primitives) | Yes (for generated games) | One-prompt game creation and researched game synthesis |
| `game-generator/` (blueprint-to-skeleton planner) | Yes (for generated games) | File tree, state, actions, rivals, screens, saves |
| `sim-harness/` (headless generated-game validation) | Yes (for generated games) | Tick runs, probes, invariants, balance smoke tests |
| `integration-recipes/` (standard module handoffs) | Yes (for generated games) | Funnel→market, market→revenue, revenue→accounting, rivals→market |
| `ui-blueprints/` (screen generation primitives) | Yes (for generated games) | Dashboard, market, operations, finance, rivals, timeline, debug |
| `research-blueprint/` (research-to-blueprint workflow) | Yes (for generated games) | Structured findings, gaps, primitive synthesis |
| `accounting/` (statements, debt, dilution, depreciation, solvency) | Optional | Capital-heavy and finance-sensitive games |
| `save-system/` (versioned persistence + migrations + slots) | **Yes** | Every game |
| `competition/` (competitor AI, dynamic pricing, auction, recognition, specific-releases) | Yes | Every game |
| `competition/rival-sim/` (rival cadence, health, pressure, decisions) | Yes | Every game with active rivals |
| `competition/rival-adapters/` (rival offers, economics, pricing, investment) | Yes | Every game with simulated rivals |
| `market-engine/` (demand resolution contract) | Yes | Every game with customers choosing among offers |
| `customer-funnel/` (pre-market awareness + consideration) | Yes | Every game where demand should not appear from raw market size |
| `press/` (trade headlines + newspaper) | Yes (recommended) | Every game |
| `inflation/` | Yes (recommended) | Any game with multi-year time span |
| `scoring/` (game-over + archetypes) | Yes | Every game |
| `perks/` (milestone unlocks) | Optional | Progression-oriented games |
| `reputation/` (brand + incidents) | Optional | Physical-goods, capital-asset, regulated |
| `events/` (random/scheduled events) | Optional | All games benefit |
| `seasonality/` | Optional | Goods, hospitality, airlines |
| `political/` (regulation, subsidies, elections) | Optional | Regulated industries |

## Specialist modules (v0.5+)

Capability modules needed for specific game shapes but not the core 70%:

| Module | When you need it |
|---|---|
| `marketplace/` | Two-sided platforms — food delivery, Amazon, dating |
| `pipeline/` | Sequential probabilistic gates — pharma, real estate dev, aerospace cert |
| `roster/` | Talent-driven — film studio, sports team, law firm, agency |
| `perishable/` | Time-bound inventory — airline seat, hotel room, event ticket |
| `ranking/` | Ongoing prestige tiers — university, hotel stars, Michelin |
| `loyalty/` | Accumulated customer value — airline miles, hotel points |
| `balance-sheet/` | Asset-liability management — bank, insurance, REIT |
| `commodities/` | External price shocks — oil & gas, shipping, airlines, mining |

## How a game is built

For generated games, start with `game-blueprints/`: research specializes the domain, while blueprint primitives select the reusable TycoonOS internals, state slices, tick phases, player actions, rival actions, UI surfaces, balancing defaults, and validation checks. Then `game-generator/` turns the composed blueprint into a concrete skeleton plan for files, state, actions, rivals, screens, starter data, and saves.

A generated game should eventually live at `games/<game-name>/` with:

```
game-name/
├── src/
│   ├── domain/            ← game-specific types + data (genres, SKUs, tech-tree, etc.)
│   ├── engine/            ← thin glue: TycoonOS compositions + game-specific phases
│   ├── hooks/             ← state store, game loop
│   └── ui/                ← game-specific React components
└── package.json           ← deps include 'opentycoonos'
```

Game's `engine/` imports from TycoonOS:

```ts
// game-name/src/engine/tick.ts
import { composeTick, clockPhase, financialPhase } from 'opentycoonos/tick';
import { runFunnelPhase, createFunnelMarketPools } from 'opentycoonos/customer-funnel';
import { resolveMarket } from 'opentycoonos/market-engine';
import { segmentedMarketSharePhase } from 'opentycoonos/market-topology/segmented';
import { subscriptionRevenuePhase } from 'opentycoonos/revenue-models/subscription';
import { competitorAIPhase } from 'opentycoonos/competition';
import { pressPhase } from 'opentycoonos/press';
import { eventsPhase } from 'opentycoonos/events';

import { myCustomGamePhase } from './custom-phase';

export const gameTick = composeTick([
  clockPhase({ maxYears: 10 }),
  runFunnelPhase(...),     // domain activities -> aware/considering audiences
  segmentedMarketSharePhase,
  subscriptionRevenuePhase,
  competitorAIPhase,
  pressPhase,
  eventsPhase,
  myCustomGamePhase,   // game-specific layer
  financialPhase(...),
]);
```

Result: game's engine code is ~200-500 LOC of composition + game-specific logic. Everything else is TycoonOS.

## Generics-first type design

Modules use generic types so each game plugs in its own domain shape:

```ts
// tycoonos/revenue-models/subscription
interface SubscriptionGameState<TContent, TSegment extends string> {
  library: TContent[];
  tiers: Record<TierKey, TierState>;
  subscribers: Record<TSegment, Record<TierKey, number>>;
  // ...
}

// a streaming-style game plugs in ContentItem + 'casual'|'binge'|'premium'
// AI-tycoon plugs in AIModel + 'hobbyist'|'prosumer'|'enterprise'
```

## Current layout (v0.1.0-alpha)

```
src/
├── clock/                 ✅ IMPLEMENTED (from tycoon-engine)
├── financial/             ✅ IMPLEMENTED
├── accounting/            ✅ IMPLEMENTED — statements, debt, dilution, solvency
├── research/              ✅ IMPLEMENTED
├── tick/                  ✅ IMPLEMENTED
├── types/                 ✅ IMPLEMENTED
├── utils/                 ✅ IMPLEMENTED
├── save-system/           ✅ IMPLEMENTED — versioned persistence + slots
├── game-blueprints/       ✅ IMPLEMENTED — generator primitives, composition, validation
├── game-generator/        ✅ IMPLEMENTED — blueprint-to-skeleton planner
├── sim-harness/           ✅ IMPLEMENTED — headless tick runner + invariant checks
├── integration-recipes/   ✅ IMPLEMENTED — standard module handoff recipes
├── ui-blueprints/         ✅ IMPLEMENTED — screen, KPI, control, navigation plans
├── research-blueprint/    ✅ IMPLEMENTED — research findings → blueprint synthesis
├── scoring/               ✅ IMPLEMENTED
├── market/                ↩️  COMPAT — re-exports market-topology/segmented
├── product/               ↩️  COMPAT — older subscription helpers; prefer revenue-models/subscription
├── competitor/            ↩️  COMPAT — older competitor helpers; prefer competition/*
├── newspaper/             ↩️  COMPAT — older newspaper helpers; prefer press/
├── infrastructure/        ↩️  COMPAT — older contract/spot helpers; prefer asset-models/infrastructure + commodities
│
├── inflation/             ✅ NEW v0.1 (extracted from streaming)
├── press/                 ✅ NEW v0.1 (partial — extracted from streaming)
├── market-topology/
│   ├── segmented/         ✅ IMPLEMENTED — segment growth, scoring, stickiness, WTP, composite keys
│   ├── geographic/        ✅ IMPLEMENTED — regional rollout + entry gates
│   └── network/           ✅ IMPLEMENTED — shared-capacity topology
├── competition/           ✅ v0.1 partial — dynamic-pricing, company-sim, rival-sim, rival-adapters
├── market-engine/         ✅ v0.1 — generic demand resolver
├── customer-funnel/       ✅ v0.1 — pre-market exposure, awareness, consideration
├── asset-models/
│   ├── fleet/             ✅ v0.3 — mobile capital capacity + maintenance
│   └── infrastructure/    ✅ v0.4 — fixed capital + outages
├── revenue-models/
│   └── transaction/       ✅ v0.3 — per-event revenue
├── marketplace/           ✅ v0.5 — two-sided matching
├── balance-sheet/         ✅ v0.5 — asset-liability management
│
└── remaining planned      📋 political/, ranking/, roster/, competition/specific-releases/
```

## Module conventions

1. Each module has an `index.ts` that re-exports its public API
2. Each module has a `README.md` describing purpose, status, intended exports
3. Modules must be **pure-function where possible** (Immer-draft compatible)
4. **Zero runtime dependencies** — games bring their own React, Zustand, etc.
5. Generics over interfaces — let games supply their domain shapes
6. Use `TickPhase<S>` pattern for anything that runs in the tick loop
