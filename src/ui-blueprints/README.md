# ui-blueprints — UI Generation Primitives

**Status:** IMPLEMENTED `0.1.0-alpha.35`

Generator-facing UI primitives for playable tycoon games. These are not React components; they are structured screen, section, KPI, control, navigation, and responsive plans that a generator can turn into app UI.

## Core API

```ts
import { createUiGenerationPlan } from 'opentycoonos/ui-blueprints';

const ui = createUiGenerationPlan(blueprint, skeleton, 'balanced');
```

## Included Primitives

- `operator-dashboard`
- `market-map`
- `operations-board`
- `finance-screen`
- `rival-board`
- `timeline-events`
- `decision-modal`
- `sim-inspector`

## Design Notes

Generated games should open into the actual playable experience, not a landing page. UI plans prioritize dense, scannable management surfaces: dashboard, market, operations, finance, rivals, timeline, and debug inspector.

The UI plan keeps domain naming flexible while standardizing interaction patterns: KPI strips, tables, charts, segmented controls, sliders, menus, tabs, and decision confirmations.
