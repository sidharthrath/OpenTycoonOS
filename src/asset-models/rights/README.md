# Rights / Asset-Ownership Income

Use this module when a company owns an asset that other market actors keep using and paying for.

Examples:

- Music labels collecting royalties from streaming rivals.
- Audiobook publishers collecting catalog fees.
- Patent portfolios collecting license fees.
- Franchise owners collecting royalties from operators.
- Strategic suppliers earning gross revenue while paying underlying production cost.

The module does not assume a fixed spread. Games provide both the external gross rate and the owner's payout/operating rate per unit.

```ts
import { computeRightsIncome } from 'opentycoonos/asset-models/rights';

const income = computeRightsIncome([
  {
    assetId: 'major-label',
    units: 1_000_000,
    grossRatePerUnit: 0.004,
    payoutRatePerUnit: 0.00144,
  },
]);

income.gross;  // 4000
income.cost;   // 1440
income.net;    // 2560
income.spread; // 0.64
```
