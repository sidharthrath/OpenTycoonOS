# Infrastructure — Fixed Capital Assets

**Status:** IMPLEMENTED `0.1.0-alpha.27`

Fixed long-lived assets for transport, utilities, telecom, logistics, manufacturing, hospitality, and public-infrastructure games.

## What It Models

- Active, outage, and retired infrastructure assets.
- Capacity per tick, condition decay, outage risk, and outage duration.
- Upkeep, depreciation, repair cost, and book value.
- Repair mechanics that restore condition and can bring assets back online.

## Core API

```ts
const infra = createInfrastructureState<'terminal'>();
buildInfrastructure(infra, defs, { id: 'bom-t1', typeId: 'terminal' });
tickInfrastructure(infra, defs);
const capacity = infrastructureCapacity(infra, defs);
```

Use with `market-topology/network` for route/graph planning and `market-engine` for demand constrained by built capacity.
