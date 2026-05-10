# competition/company-sim — Economically coherent rivals

Use this when competitors should be simplified but not fake. Rivals can stay less detailed than the player, but they should still obey comparable economics: revenue, variable cost, fixed cost, capacity, demand, capex, cash, distress, restructures, and exit.

## Core API

- `createCompany(input)` — creates a rival/player-like company with operating lines.
- `tickCompany(company, options)` — computes revenue, costs, utilization, unmet demand, cashflow, and status.
- `applyCompanyInvestment(company, investment)` — spends cash and adds capacity to operating lines.
- `companyRunwayTicks(company)` — UI/helper for distress and runway.

## Why This Exists

Orbital Networks showed that abstract rival pressure is not enough. Games can abstract catalog detail, but the competitors still need real-ish economics. A LEO rival, airline connectivity vendor, mobile operator, or streaming rival should be able to gain users, spend on capacity/content, bleed cash, restructure, or exit based on its own operating model.

This module is intentionally small. Games still decide strategy and market share; the engine keeps the accounting honest.
