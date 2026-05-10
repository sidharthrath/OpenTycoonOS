# sim-harness — Headless Simulation Checks

**Status:** IMPLEMENTED `0.1.0-alpha.33`

Generic tick-runner for generated games and module integrations. It runs a game state forward, records probes, checks invariants, and returns structured issues.

## Core API

```ts
import {
  runSimulation,
  finiteMetricInvariant,
  nonNegativeMetricInvariant,
} from 'opentycoonos/sim-harness';

const result = runSimulation({
  initialState: { cash: 1_000, demand: 0 },
  ticks: 100,
  tick: state => {
    state.cash -= 10;
    state.demand += 5;
  },
  probes: [
    { id: 'cash', read: state => state.cash },
    { id: 'demand', read: state => state.demand },
  ],
  invariants: [
    finiteMetricInvariant(),
    nonNegativeMetricInvariant(['demand']),
  ],
});
```

## Use It For

- Generated-game smoke checks.
- 100-1,000 tick balance runs.
- Detecting NaN/Infinity, negative impossible metrics, runaway loops, and early insolvency.
- Comparing tuning presets by probe trends.

The harness is intentionally state-shape agnostic. Games expose probes; the harness judges those probes.
