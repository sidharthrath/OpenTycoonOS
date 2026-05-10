# Roadmap

Version-by-version plan. Each release is a cohesive capability bundle that unlocks a new class of games.

## v0.1 — Services foundation (2 sessions)

**Goal:** replace everything streaming-tycoon and AI-tycoon currently need from `tycoon-engine`, with cleaner architecture.

### Modules to complete

- `core/` (already seeded):
  - Refactor flat layout → move clock/, financial/, research/, tick/, types/, utils/, scoring/ under `src/core/*` (optional; can leave flat)
  - `save-system/` ✅ — versioned envelopes, migrations, autosave/manual slots
  - `accounting/` ✅ — statements, debt, dilution, depreciation flow-through, solvency checks
  - `game-blueprints/` ✅ — generator-facing primitive catalog, composition helpers, validation checks
  - `game-generator/` ✅ — blueprint-to-skeleton planner for generated game structure
  - `sim-harness/` ✅ — headless generated-game tick runner, probes, invariants
  - `integration-recipes/` ✅ — standard module handoffs for generated games
  - `ui-blueprints/` ✅ — screen, KPI, control, navigation primitives for generated games
  - `research-blueprint/` ✅ — structured research findings to blueprint synthesis
- `market-topology/segmented/`:
  - Move `src/market/*` helpers into this folder (`calculateTargetShares`, `aggregateShares`, `blendShares`, `tickSegments`) ✅
  - WTP helpers ✅ (already extracted)
  - Composite-key helpers ✅ (already extracted)
  - Generic use-case framework ✅ via `market-topology/use-case-matrix`
  - Document the 9-product (or N×M) competition pattern ✅ via `market-engine` + `use-case-matrix`
- `market-engine/` ✅:
  - Generic demand resolver for clean-slate games
  - Hard gates, scoring, flow visibility, owner/incumbent boosts
  - Shared capacity constraints and explicit unmet-demand diagnostics
- `customer-funnel/` ✅:
  - Pre-market exposure, awareness, and consideration cohorts
  - Domain-provided activities and drivers; no generic hard-coded brand score
  - Market-pool handoff into `market-engine`
- `revenue-models/subscription/`:
  - `TierState`, `TierConfig` types
  - Churn helpers (per-tier monthly rates, research-reducible)
  - Slate auto-commissioning helper (annual budget → quarterly pro-rate → weekly execution)
  - LTV computation
- `competition/`:
  - `competitor/` — archetype-based state + reactive AI helpers
  - `rival-sim/` ✅ — stateful rival cadence, health, pressure, and decision simulation
  - `rival-adapters/` ✅ — standard offers, economics, pricing, capacity, funding, and market-entry glue
  - `specific-releases/` — track competitor-released products
  - `auction/` — generic bidding wars framework
  - `recognition/` — generic awards/ceremony framework
  - `dynamic-pricing/` ✅ (already extracted, needs integration tests)
- `press/` ✅ (already extracted)
- `perks/` — milestone-unlock framework
- `inflation/` ✅ (already extracted)
- `events/` — basic event-bus framework (full impl in v0.2)

### Migration validation

- Validate modules against small public examples and headless simulation harnesses.
- Keep historical/private game prototypes out of the public repository; extract only reusable primitives and generic examples.

### Exit criteria

- `npm run build` passes cleanly
- All v0.1 modules have typed public APIs with JSDoc
- README in each module is up-to-date
- Composition example in `examples/` showing a minimal subscription-style game tick loop

---

## v0.2 — Goods + geographic (2 sessions)

**Goal:** unlock physical-goods games (EV, consumer electronics, fashion).

### Modules to complete

- `asset-models/inventory/`:
  - `Inventory<SKU>` state
  - Production queue with capacity constraints
  - COGS accounting
  - Obsolescence write-downs
- `revenue-models/unit-sale/`:
  - Unit transaction tracking
  - Margin + revenue recognition
  - Warranty / service tail (optional)
- `market-topology/geographic/`:
  - `Region` type (population, regulation, pricing level)
  - Rollout sequencing (with regulatory gates)
  - Per-region market share
- `reputation/`:
  - `BrandState` + incident/recovery dynamics
- `events/`:
  - Full event-bus with phenomena, launches, incidents, shocks
- `seasonality/`:
  - Calendar-based multipliers for goods/hospitality

### Exit criteria

Mentally compose an EV-tycoon or consumer-electronics-tycoon using v0.1 + v0.2 modules.

---

## v0.3 — Fleet + transactions (2 sessions)

**Goal:** unlock capital-asset games (AV, rental, cruise, hotel single-location).

### Modules to complete

- `revenue-models/transaction/`:
  - Per-unit-event revenue ✅
  - Fees, take-rate, variable cost, line/owner/channel aggregates ✅
  - Dynamic pricing per transaction (surge, yield mgmt) via `revenue-models/pricing`
- `asset-models/fleet/`:
  - Fleet state (utilization, depreciation, maintenance) ✅
  - Per-asset economics ✅
- `perishable/`:
  - Time-bound inventory (empty seats, empty rooms)
  - Yield management integration
- `loyalty/`:
  - Accumulated customer value
  - Tier-based retention
- Enhanced `events/incidents/` — safety events, recalls

### Exit criteria

Mentally compose an AV-tycoon, airline MVP, or hotel-chain-tycoon.

---

## v0.4 — Networks + infrastructure + political (2-3 sessions)

**Goal:** unlock infrastructure + transport games (metro, telecom, airline, utility).

### Modules to complete

- `market-topology/network/`:
  - Graph of nodes + edges (cities, stations, routes)
  - Connectivity scoring (network-effect amplification)
  - Shortest-path / topology metrics
- `asset-models/infrastructure/`:
  - Fixed long-lived capital ✅
  - Decades-long depreciation schedules ✅
  - Maintenance + outage mechanics ✅
- `political/`:
  - Subsidies + regulation + approval ratings
  - Election cycles
- Route-specific economics (per-edge demand, frequency/capacity mgmt)
- `commodities/` basic hooks (fuel, electricity)

### Exit criteria

Mentally compose an airline, metro, or telecom game using v0.1-0.4.

---

## v0.5 — Specialists (2-3 sessions)

**Goal:** cover the remaining 15-20% of real-industry shapes.

### Modules to complete

- `marketplace/` ✅ — two-sided platform dynamics (food delivery, Amazon, dating)
- `pipeline/` — sequential probabilistic gates (pharma trials, aerospace cert)
- `roster/` — individual talent/partner entities (studios, agencies, sports)
- `ranking/` — ongoing prestige tiers (universities, Michelin stars)
- `balance-sheet/` ✅ — asset-liability management (bank, insurance, REIT)
- `commodities/` full — external price shocks + hedging
- `asset-models/rights/` — owned catalogs, patents, publishers, labels, and franchise royalties that earn from third-party usage
- Geographic `density/` effects — clustering benefit for retail chains

### Exit criteria

Can mentally compose any game from [GAMES.md](./GAMES.md) using TycoonOS.

---

## Post-v0.5 — Platform

If the portfolio grows beyond ~10 games:

- Scenario/campaign framework (multi-year arcs, win/lose conditions)
- Save/load format versioning (cross-release compatibility) ✅ core primitive shipped; game migrations still owned by games
- `npx create-tycoon-game` scaffolder
- Published to npm
- Shared design-system package (tycoonos-ui) with common components

## Clean-slate game plan

Existing prototypes are not migration targets. New games should start from `research-blueprint -> game-blueprints -> game-generator -> integration-recipes -> ui-blueprints -> sim-harness`, then live in separate game repositories once the generated baseline is coherent.

## Cadence

Not tied to calendar time — ship v0.N when the modules in that version are complete + integration-tested. Aim for 1-2 sessions per version to avoid scope creep. Prefer many small releases over one big one.
