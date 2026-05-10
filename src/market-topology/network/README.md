# market-topology/network — Shared capacity topology

Use this when a game has capacity that must be routed or allocated before it becomes sellable: LEO broadband, telecom coverage, airline routes, metro lines, logistics corridors, cloud regions, utilities, and other infrastructure networks.

The module deliberately does not know what a "satellite", "tower", "gate", "route", or "server" is. Games provide:

- raw capacity;
- transfer/backhaul capacity;
- relay or routing efficiency;
- local sinks with allocation weights, local caps, and demand.

## Core API

- `computeUsableCapacity(input)` — converts raw capacity into usable + stranded capacity after transfer and relay bottlenecks.
- `allocateNetworkCapacity(totalCapacity, sinks)` — weighted allocation into local sinks, with local caps and redistribution of unused capacity.
- `normalizeNetworkWeights(sinks)` — UI helper for showing allocation shares.
- `networkHeadroomTarget(currentDemand, utilization)` — planning helper for how much capacity to build next.

## Why This Exists

Orbital Networks showed the reusable pattern: global capacity is not enough. Players need to understand which local areas can actually consume that capacity, which ones are capped by gateways/backhaul, and how much capacity is stranded.

Keep demand, pricing, and product scoring in the game or in `product-competition` / `use-case-matrix`; this module only handles capacity flow.
