# game-generator — Blueprint-to-Skeleton Planning

**Status:** IMPLEMENTED `0.1.0-alpha.32`

Turns a composed `game-blueprints` blueprint into a structured game skeleton. This module does not write files; it returns the file tree, state slices, tick phases, actions, rival behaviors, screens, starter data, save plan, and acceptance checks a generator can materialize.

## Core API

```ts
import { composeGameBlueprint } from 'opentycoonos/game-blueprints';
import { createGameSkeleton } from 'opentycoonos/game-generator';

const blueprint = composeGameBlueprint({
  title: 'Regional Hotel Tycoon',
  idea: 'A hotel-chain tycoon for short mobile sessions',
  audience: 'cozy but realistic management players',
  platform: 'iPad',
  primitiveIds: ['perishable-capacity-business', 'capital-asset-network-business'],
  firstSessionGoal: 'Open a profitable second property without running out of cash.',
});

const skeleton = createGameSkeleton(blueprint);
```

## What It Generates

- Recommended `games/<slug>/src/...` file tree.
- State slice type plans.
- Tick phase function plans.
- Player action stubs.
- Rival behavior stubs.
- Screen/component plans.
- Starter data seeds.
- Save/load plan.
- Acceptance checks for generated-game QA.

## Design Notes

The engine package stays pure TypeScript and does not create app files directly. A scaffolder, CLI, or agent can use this module as the source of truth for what to generate.
