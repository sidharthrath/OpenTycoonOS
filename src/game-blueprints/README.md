# game-blueprints — Blueprint Primitives for Game Generation

**Status:** IMPLEMENTED `0.1.0-alpha.31`

Blueprint primitives are the construction grammar above TycoonOS modules. Research should still make every game specific, but these primitives keep one-prompt game generation from reinventing the same scaffolding every time.

## Goal

Given:

> "I'm making a game about this, for this audience, on this platform."

The generator should be able to:

1. Select 1-3 blueprint primitives.
2. Compose TycoonOS modules.
3. Produce a coherent state model, tick order, actions, rival behavior, screens, balancing defaults, and research questions.
4. Validate that the game has demand, money, rival, save/load, UI, and failure-mode loops.

## Included Primitives

- `subscription-catalog-business`
- `perishable-capacity-business`
- `capital-asset-network-business`
- `physical-goods-launch-business`
- `two-sided-marketplace-business`
- `regulated-expansion-business`
- `asset-liability-finance-business`
- `pipeline-r-and-d-business`

## Core API

```ts
import {
  selectBlueprintPrimitives,
  composeGameBlueprint,
  validateGameBlueprint,
} from 'opentycoonos/game-blueprints';

const matches = selectBlueprintPrimitives({
  idea: 'premium but accessible airline turnaround game in India',
  audience: 'mobile tycoon players',
  platform: 'iPad',
});

const blueprint = composeGameBlueprint({
  title: 'Sahyadri Air Clean Slate',
  idea: 'Mumbai-rooted airline turnaround',
  audience: 'mobile tycoon players',
  platform: 'iPad',
  primitiveIds: [
    'perishable-capacity-business',
    'capital-asset-network-business',
    'regulated-expansion-business',
  ],
  firstSessionGoal: 'Turn one loss-making route into a profitable flagship route.',
});

const validation = validateGameBlueprint(blueprint);
```

## Design Notes

Research creates the domain blueprint. This module provides reusable blueprint primitives.

For example:

- Airline = `perishable-capacity-business` + `capital-asset-network-business` + `regulated-expansion-business`
- Bank = `asset-liability-finance-business` + `regulated-expansion-business` + `geographic` composition
- Food delivery = `two-sided-marketplace-business` + `regulated/geographic` specialisation
- Streaming = `subscription-catalog-business`

The primitive does not decide the soul of the game. It prevents the generator from forgetting core internals such as `customer-funnel`, `market-engine`, `rival-sim`, `accounting`, and `save-system`.

## Maintenance Rule

When a TycoonOS module changes the way generated games should be composed, update this module in the same commit:

- Add the module to relevant primitive `requiredModules` or `optionalModules`.
- Add or adjust state slices, tick phases, actions, UI surfaces, or validation rules.
- Keep `GAME_BLUEPRINT_PRIMITIVES` aligned with `ARCHITECTURE.md` and `ROADMAP.md`.
