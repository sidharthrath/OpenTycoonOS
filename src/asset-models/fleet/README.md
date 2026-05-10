# Fleet — Mobile Asset Capacity

**Status:** IMPLEMENTED `0.1.0-alpha.27`

Generic fleet economics for aircraft, ships, trucks, robotaxis, rental cars, hotel rooms, or any pool of owned/leased units that turns capital into sellable capacity.

## What It Models

- Unit-level assets with `available`, `maintenance`, and `retired` status.
- Capacity per tick, condition decay, downtime risk, maintenance restore.
- Lease cost, operating cost, variable cost, depreciation, and book value.
- Demand assignment against available fleet capacity.

## Core API

```ts
const fleet = createFleetState<'a320'>();
addFleetUnits(fleet, defs, { typeId: 'a320', count: 3 });
tickFleet(fleet, defs);
const allocation = assignFleetCapacity(fleet, defs, 420);
```

Use with `market-engine` when offers have capacity constraints, and with `transaction` or `perishable` when each unit of served demand becomes revenue.
