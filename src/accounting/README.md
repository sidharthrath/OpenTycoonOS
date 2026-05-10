# Accounting — Statements, Financing, and Solvency

**Status:** IMPLEMENTED `0.1.0-alpha.29`

Accounting primitives for games that need more than cash-in/cash-out. This module complements:

- `financial/` for simple cash, runway, valuation, and fundraising helpers.
- `balance-sheet/` for asset-liability spread games such as banks and insurers.

## What It Models

- Capital assets, book value, useful life, and depreciation.
- Capex flow-through to cashflow and balance sheet.
- Debt raises, interest expense, principal repayment, and debt service.
- Equity raises, post-money dilution, and player ownership.
- Income statement, cashflow statement, and accounting balance sheet.
- Solvency checks: cash, equity, leverage, interest coverage, debt service coverage, and runway.

## Core API

```ts
const accounting = createAccountingState({ cash: 10_000_000 });

raiseDebt(accounting, {
  id: 'term-loan-a',
  type: 'term-loan',
  principal: 5_000_000,
  annualInterestRate: 0.08,
  termTicks: 364 * 5,
});

const statement = applyAccountingPeriod(accounting, {
  revenue: 800_000,
  operatingExpenses: 420_000,
  capitalPurchases: [{
    id: 'depot-1',
    type: 'depot',
    cost: 2_000_000,
    usefulLifeTicks: 364 * 20,
  }],
});

const solvency = checkAccountingSolvency(accounting, {
  maxDebtToAssets: 0.75,
  minInterestCoverage: 2,
});
```

## Design Notes

Games should use this module when finance is part of the play loop: airlines leasing aircraft, telecoms funding towers, banks tracking solvency, or capital-heavy startups balancing dilution against debt.

For arcade/simple games, `financial/` is still enough.
