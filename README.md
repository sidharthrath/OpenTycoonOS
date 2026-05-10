# OpenTycoonOS

Composable TypeScript primitives for building tycoon and management simulation games.

OpenTycoonOS is an alpha-stage engine toolkit for games about running systems: airlines, streaming platforms, factories, hotels, marketplaces, banks, utilities, restaurants, studios, and other businesses where the fun comes from tradeoffs over time.

It is not a complete game engine with rendering, assets, or a UI. It gives you the reusable simulation layer: clocks, tick phases, markets, funnels, revenue models, accounting, competitors, asset models, save envelopes, events, blueprints, and scenario scaffolding.

## Status

`0.1.0-alpha` — useful for experiments, prototypes, and engine contributors. APIs may change while the module boundaries settle.

The current package builds to ESM, CommonJS, and TypeScript declarations.

## Install

```bash
npm install opentycoonos
```

Until the package is published to npm, install directly from GitHub:

```bash
npm install github:sidharthrath/OpenTycoonOS
```

## Quick Example

```ts
import { createClock } from 'opentycoonos/clock';
import { composeTick, createTickContext, clockPhase } from 'opentycoonos/tick';

interface GameState {
  clock: ReturnType<typeof createClock>;
  gameOver: boolean;
  gameOverReason: string | null;
  customers: number;
}

const state: GameState = {
  clock: createClock(1),
  gameOver: false,
  gameOverReason: null,
  customers: 100,
};

const growCustomers = (s: GameState) => {
  s.customers += 5;
};

const tick = composeTick<GameState>([
  clockPhase({ maxYears: 3 }),
  growCustomers,
]);

tick(state, createTickContext());
```

See [`examples/minimal-service-game.ts`](./examples/minimal-service-game.ts) for a slightly fuller example.

Run the minimal example:

```bash
npm run example:minimal
```

## What Is Included

- Tick loop primitives and game clock helpers
- Finance, accounting, balance-sheet, and save-system modules
- Market topology for segmented, geographic, network, product, and use-case-driven demand
- Revenue models for subscriptions, ads, transactions, unit sales, and pricing
- Competition primitives for rivals, auctions, licensing, acquisitions, recognition, and company economics
- Asset models for inventory, fleet, rights, infrastructure, and multi-tier production
- Specialist modules for loyalty, perishable capacity, commodities, pipelines, marketplaces, events, press, reputation, and engagement
- Research, game-blueprint, integration, UI-blueprint, and sim-harness helpers for generating game baselines

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) explains the composable-capability model.
- [`ROADMAP.md`](./ROADMAP.md) tracks module maturity.
- [`GAMES.md`](./GAMES.md) sketches how different tycoon games can be composed from the modules.
- [`CHANGELOG.md`](./CHANGELOG.md) preserves the early alpha history.

## For Coding Agents

OpenTycoonOS includes agent-facing files so AI coding tools can find the right primitives quickly:

- [`AGENTS.md`](./AGENTS.md) gives repository-specific instructions.
- [`llms.txt`](./llms.txt) is a compact LLM index.
- [`docs/AGENT_GUIDE.md`](./docs/AGENT_GUIDE.md) explains how to select modules for a new game.
- [`docs/module-catalog.json`](./docs/module-catalog.json) lists modules, import paths, source files, and docs in machine-readable form.

If you are asking an agent to build a game, point it at `docs/AGENT_GUIDE.md` first.

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
```

## Contributing

OpenTycoonOS is early and still opinionated. The best contributions are small, typed, documented primitives that can serve several game genres rather than one bespoke game.

Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull request.

## License

MIT
