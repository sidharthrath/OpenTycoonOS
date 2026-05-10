# integration-recipes — Standard Module Handoffs

**Status:** IMPLEMENTED `0.1.0-alpha.34`

Reusable glue patterns between TycoonOS modules. These recipes tell generated games how modules should hand data to each other instead of inventing one-off wiring.

## Core API

```ts
import {
  createBlueprintIntegrationPlan,
  getIntegrationRecipe,
} from 'opentycoonos/integration-recipes';

const funnelRecipe = getIntegrationRecipe('funnel-to-market');
const plan = createBlueprintIntegrationPlan(blueprint);
```

## Included Recipes

- `funnel-to-market`
- `market-to-subscription`
- `market-to-transaction`
- `market-to-unit-sale`
- `revenue-to-accounting`
- `rivals-to-market`
- `assets-to-capacity`
- `perishable-to-revenue`
- `events-to-funnel-drivers`

## Design Notes

The most important rule: generated games should not bypass the funnel/market/revenue/accounting chain.

Demand should flow:

```text
domain activities -> customer-funnel -> market-engine -> revenue model -> accounting
```

Rivals should flow:

```text
rival-sim -> rival-adapters -> market-engine -> rival economics -> rival-sim
```

Events, press, and reputation memory should become explicit funnel activities or consideration drivers, not a generic hard-coded brand stat.
