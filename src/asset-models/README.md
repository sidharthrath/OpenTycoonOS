# Asset Models

Games pick **0 or 1** asset model (services often have none; physical-goods + capital-asset games pick one).

## Submodules

| Module | Status | Used by |
|---|---|---|
| `inventory/` | IMPLEMENTED | EV, consumer electronics, fashion, retail, CPG |
| `fleet/` | IMPLEMENTED | AV, airline, rental cars, cruise, logistics, rideshare |
| `infrastructure/` | IMPLEMENTED | metro, telecom, utility, solar, shipping, cloud |

## What these share

All three track **capital deployed** → affects balance sheet, depreciation, opex. Differences:

| | inventory | fleet | infrastructure |
|---|---|---|---|
| Mobility | turnover (sell) | moving units (rides) | fixed |
| Time-horizon | months | years | decades |
| Failure mode | obsolete/spoil | crash/wear | maintenance/outage |
| Capacity metric | stock level | utilization % | availability |

## Implemented Scope

- `inventory/` — factories, capacity allocations, lots, COGS, upkeep, aging, and obsolescence write-downs.
- `fleet/` — unit-level mobile assets, capacity, utilization, condition, maintenance, downtime, lease cost, opex, depreciation, and book value.
- `infrastructure/` — fixed long-lived assets, capacity, condition decay, outages, repair cost, upkeep, depreciation, and book value.

## Key design constraint

Asset-model output feeds `revenue-models/` (what you sell) and `core/financial/` (how much capex is deployed). Games compose: `inventory` + `unit-sale` is the classic physical-goods shape.
