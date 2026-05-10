# Market Topology

Every game picks **one** topology for how users relate to each other.

## Submodules

| Module | Status | Used by |
|---|---|---|
| `segmented/` | IMPLEMENTED | streaming, AI, social, SaaS, news — any segmented demographic market |
| `geographic/` | IMPLEMENTED | EV, consumer electronics, retail chains, banking, insurance — any game with regional rollout |
| `network/` | IMPLEMENTED | airline, metro, telecom, logistics, LEO broadband — any game where shared capacity must become local service |

## When to pick which

- **Segmented** — users bucket into demographic groups (casual/binge/premium, hobbyist/prosumer/enterprise). Works for subscription + some goods. Default choice if your game is about psychographic targeting.
- **Geographic** — each region is its own market with population + regulation + price level. Use for anything rolled out city-by-city or country-by-country.
- **Network** — value comes from edges between nodes (routes, connections). Metcalfe's-law games. Can compose WITH `geographic` (nodes = cities, edges = routes).

## Composition example

A **telecom game** could use `geographic` (launch in regions) + `network` (cell-tower coverage creates connectivity value) simultaneously. A **metro game** uses `network` only (plus `infrastructure/`). An **EV game** uses `geographic` only.

## Implemented Scope

- `segmented/` — segment population/awareness/adoption, addressable users, softmax target shares, use-case share aggregation, stickiness, WTP caps, and composite keys.
- `geographic/` — regional rollout, entry gates, entered-region state, population totals, and regulatory costs.
- `network/` — shared capacity allocation into local/service sinks, headroom, and stranded capacity.

`tycoonos/market` remains as a backwards-compatible shim for older imports. New games should import segmented helpers from `tycoonos/market-topology/segmented`.
