# Revenue Models

Every game picks **one** revenue model (or composes multiple for hybrids like AV).

## Submodules

| Module | Status | Used by |
|---|---|---|
| `subscription/` | IMPLEMENTED | streaming, AI SaaS, social, news paywall, cloud, telecom, banking (deposits) |
| `transaction/` | IMPLEMENTED | AV (per-ride), airline, metro, rental, hotel, payment processor |
| `unit-sale/` | IMPLEMENTED | EV, consumer electronics, fashion, craft brewery, pharma |

## Hybrids

Some games compose multiple. AV = `transaction` (per-ride) + optional `subscription` (fleet-management SaaS for partners). Airline = `transaction` (tickets) + `loyalty` (miles program — see `loyalty/` module).

## Implemented Scope

- `subscription/` — tier state, acquisitions, churn, revenue/cost accrual, upgrades/downgrades, ARPU, LTV, and per-tier profitability.
- `transaction/` — event/usage revenue, fees, take rate, variable cost, last-tick/cumulative totals, and line/owner/channel aggregates.
- `unit-sale/` — discrete unit sales, product aggregates, COGS, gross profit, and margin.

## Key design constraint

Revenue-model modules are **additive to state**, not prescriptive about game shape. A game can use `subscription` for its primary economics and layer `transaction` on top for one-time purchases (e.g. rent-to-buy model).
