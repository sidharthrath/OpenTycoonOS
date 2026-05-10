# research-blueprint — Research to Blueprint Workflow

**Status:** IMPLEMENTED `0.1.0-alpha.36`

Structured workflow for turning domain research into generator-ready blueprint inputs.

Research should not end as prose notes. It should produce findings about audience, domain loop, segments, revenue, assets, constraints, rivals, failure modes, and first-session goals. This module validates those findings and synthesizes a `game-blueprints` composition input.

## Core API

```ts
import {
  createResearchFinding,
  synthesizeResearchBlueprint,
  composeBlueprintFromResearch,
} from 'opentycoonos/research-blueprint';

const brief = {
  title: 'Regional Hotel Tycoon',
  idea: 'Hotel-chain tycoon for iPad',
  audience: 'cozy but realistic management players',
  platform: 'iPad',
  findings: [
    createResearchFinding('domain-loop', 'Rooms expire nightly', 'Use perishable capacity.'),
    createResearchFinding('revenue-model', 'Revenue is room nights plus services', 'Use transaction revenue.'),
    createResearchFinding('customer-segments', 'Business and leisure guests book differently', 'Model separate segments.'),
    createResearchFinding('constraints', 'Location and seasonality dominate occupancy', 'Use geography and seasonality.'),
    createResearchFinding('rivals', 'Rivals discount weak nights', 'Use rival pricing decisions.'),
    createResearchFinding('failure-modes', 'Debt service can overwhelm low occupancy', 'Use accounting solvency.'),
    createResearchFinding('first-session', 'Stabilize one hotel before expanding', 'Set first-session goal.'),
    createResearchFinding('audience', 'Short-session tablet players', 'Use dense but forgiving UI.'),
  ],
};

const synthesis = synthesizeResearchBlueprint(brief);
const blueprint = composeBlueprintFromResearch(brief);
```

## Required Research Sections

- audience
- domain-loop
- customer-segments
- revenue-model
- constraints
- rivals
- failure-modes
- first-session

Optional but recommended:

- assets-capacity

## Design Notes

Research creates the unique game shape. Blueprint primitives provide reusable construction grammar. Low-confidence findings should become generated TODOs or balance assumptions, not hidden facts.
