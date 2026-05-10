# Balance Sheet — Asset-Liability Management

**Status:** IMPLEMENTED `0.1.0-alpha.27`
**Used by:** bank, insurance, hedge fund, REIT, pension fund

Financial institutions make money on the SPREAD between assets + liabilities, not product sales.
This module adds asset-liability duration matching, risk ratios, capital ratios, stress tests, and annual spread income.

## Core API

```ts
const sheet = createBalanceSheet({
  cash: 100,
  assets: [{ id: 'loan-book', type: 'loans', value: 900, yieldRate: 0.09 }],
  liabilities: [{ id: 'deposits', type: 'deposits', value: 750, costRate: 0.04 }],
});

const snapshot = balanceSheetSnapshot(sheet);
const stressed = stressBalanceSheet(sheet, { assetHaircut: 0.08, liabilityRunoff: 0.12 });
```

## What It Models

- Assets, liabilities, cash, and retained earnings.
- Equity, risk-weighted assets, capital ratio, net interest spread.
- Annual net interest income and period accrual.
- Duration gap and stress-test insolvency/liquidity pressure.
