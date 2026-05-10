# `competition/rival-sim`

Believable competitor operating loop for clean-slate TycoonOS games.

## Status

`0.1.0-alpha.27` — first engine-level rival operating system.

## Purpose

Games should not have to hard-code every rival price cut, expansion, distress response, or asset sale. This module provides the generic loop:

```
economics -> health/runway pressure -> strategy cadence -> game-defined decisions -> action log
```

The game still owns domain facts such as routes, products, licenses, fleet, content, or regions. TycoonOS owns the cadence and pressure mechanics so rivals act like companies instead of background share numbers.

## Public API

- `createRival(input)` — initialize a rival with strategy, cash, health, and game metadata.
- `tickRivals(state, options)` — compute economics, update cash/health, run due decisions, and return summaries.
- `logRivalAction(rival, action)` — append to bounded recent-action log.
- `shouldTakeRivalAction(strategy, pressure, bias, rng?)` — reusable probability helper.
- `RIVAL_STRATEGIES` — presets: `scalePredator`, `premiumIncumbent`, `distressedOperator`, `nicheSpecialist`.

## Design Notes

- `computeEconomics` should be grounded in concrete market results and assets.
- Decisions are game callbacks because the engine should not know what a route, label, vehicle, or SKU is.
- Cadence is explicit: daily drift, monthly pricing, quarterly expansion, yearly big moves.
- Health is derived from runway and net cashflow: healthy, constrained, distressed, restructured, exited.
- The action log is part of the simulation contract; UI and press can show why rivals moved.

## Composes With

- `market-engine` — competitor offers should win or lose real demand.
- `competition/company-sim` — useful accounting primitive for `computeEconomics`.
- `asset-models/fleet`, `asset-models/infrastructure`, `revenue-models/transaction` — concrete operating lines.
- `competition/acquisitions`, `competition/licensing`, `auction` — strategic decision targets.
