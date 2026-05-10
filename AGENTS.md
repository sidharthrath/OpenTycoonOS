# AGENTS.md

This repository is optimized for coding agents that are building tycoon or management simulation games.

## Agent Entry Points

Read these first, in order:

1. `README.md` — what OpenTycoonOS is and how to install it.
2. `docs/AGENT_GUIDE.md` — how to choose modules for a new game.
3. `docs/module-catalog.json` — machine-readable module index.
4. `ARCHITECTURE.md` — deeper model of how modules compose.
5. The README for any selected module under `src/<module>/README.md`.

## Build Rules

- The package name is `opentycoonos`.
- Core code lives in `src/`.
- Do not add React, React Native, rendering, asset loading, or platform APIs to `src/`.
- Game-specific content belongs in downstream games, not in OpenTycoonOS modules.
- Prefer typed, pure helpers and explicit state transitions.
- Keep public exports aligned across `package.json`, `tsup.config.ts`, and `src/index.ts`.
- After code changes, run `npm run build` and `npm run typecheck`.

## Game-Building Flow

For a new game, start by choosing:

- Revenue model: `subscription`, `transaction`, `unit-sale`, `ads`, `pricing`, or a hybrid.
- Asset model: `inventory`, `fleet`, `infrastructure`, `rights`, `multi-tier-production`, or none.
- Market topology: `segmented`, `geographic`, `network`, `product-competition`, or `use-case-matrix`.
- Cross-cutting systems: `accounting`, `save-system`, `competition`, `customer-funnel`, `market-engine`, `events`, `press`, `reputation`, `seasonality`.

Use `game-blueprints`, `research-blueprint`, `game-generator`, `integration-recipes`, `ui-blueprints`, and `sim-harness` when generating a new baseline from research.

## Do Not

- Do not copy a full game into this repo.
- Do not hardcode industry-specific facts in reusable modules.
- Do not hide market allocation, revenue recognition, or rival decisions behind opaque magic numbers.
- Do not skip documentation for a new public module.
