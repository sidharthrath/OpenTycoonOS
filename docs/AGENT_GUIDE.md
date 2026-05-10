# Agent Guide

Use this guide when a coding agent is asked to build a tycoon or management simulation game with OpenTycoonOS.

## 1. Classify The Game

Start with the game's real-world operating model.

Choose one or more revenue models:

- `revenue-models/subscription` for recurring users, tiers, churn, and LTV.
- `revenue-models/transaction` for rides, stays, trips, bookings, payments, or other unit events.
- `revenue-models/unit-sale` for sold goods with margin and COGS.
- `revenue-models/ads` for impression or attention monetization.
- `revenue-models/pricing` for price response, caps, floors, and demand factors.

Choose an asset model:

- `asset-models/inventory` for stockable goods.
- `asset-models/fleet` for aircraft, vehicles, ships, robots, or rentals.
- `asset-models/infrastructure` for fixed assets such as towers, stations, plants, or networks.
- `asset-models/rights` for catalogs, patents, publishing rights, franchises, or licenses.
- `asset-models/multi-tier-production` for layered production pipelines.

Choose a market topology:

- `market-topology/segmented` for customer segments.
- `market-topology/geographic` for regions and rollout gates.
- `market-topology/network` for route, coverage, station, telecom, or logistics graphs.
- `market-topology/product-competition` for products competing on attributes.
- `market-topology/use-case-matrix` when products serve multiple jobs-to-be-done.

## 2. Add Cross-Cutting Systems

Most games should consider:

- `tick` and `clock` for the time loop.
- `financial`, `accounting`, and `balance-sheet` for money and solvency.
- `customer-funnel` and `market-engine` for demand formation and allocation.
- `competition`, `competition/rival-sim`, and `competition/rival-adapters` for rivals that behave like companies.
- `events`, `press`, `reputation`, `seasonality`, and `inflation` for long-run texture.
- `save-system` for versioned persistence.

## 3. Generate Or Sketch The Game

For research-driven generation:

1. Capture domain facts with `research-blueprint`.
2. Select reusable primitives with `game-blueprints`.
3. Create a skeleton plan with `game-generator`.
4. Wire modules using `integration-recipes`.
5. Plan screens with `ui-blueprints`.
6. Validate tick behavior with `sim-harness`.

Keep domain data outside OpenTycoonOS. A game about Mumbai hotels, Seoul cosmetics, or Nairobi logistics should store those facts in the game repo.

## 4. Compose A Tick Loop

A typical game tick looks like:

```ts
import { clockPhase, composeTick } from 'opentycoonos/tick';

export const tick = composeTick([
  clockPhase({ maxYears: 10 }),
  // domain input phase
  // funnel phase
  // market allocation phase
  // revenue/accounting phase
  // rival phase
  // events/press phase
]);
```

## 5. Validation Checklist

Before calling a generated game baseline usable, verify:

- At least one player action changes state meaningfully.
- At least one customer/demand metric flows through funnel, market, and revenue.
- At least one rival decision affects the market.
- Cash, revenue, costs, and solvency can be inspected.
- A 1-3 year headless sim run does not collapse immediately unless the game is intentionally difficult.
- Public UI labels come from the game, not from OpenTycoonOS internals.

For a known-good smoke path, run:

```bash
npm run example:minimal
```

## 6. Search Hints For Agents

When searching the repo:

- Search `docs/module-catalog.json` first for module names and import paths.
- Search `src/<module>/README.md` before reading implementation.
- Search `GAMES.md` when mapping an industry to a module set.
- Search `ARCHITECTURE.md` when deciding whether a concept is revenue, asset, market topology, or cross-cutting capability.
