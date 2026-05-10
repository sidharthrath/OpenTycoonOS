// TycoonOS — Competition
// All competitor-related mechanics. v0.1 scope:
//   - dynamic-pricing (extracted from streaming)
// Planned for v0.1 completion:
//   - competitor (archetype-based AI state + reactive behaviors)
//   - specific-releases (tracked competitor product releases w/ metadata)
//   - auction (generic bidding wars framework)
//   - recognition (yearly awards / rankings ceremonies)
//
// Most of this already exists in fragmented form across streaming-tycoon +
// tycoon-engine's competitor/ folder. v0.1 task: consolidate and generalize.

export * from './dynamic-pricing.js';
export * from './company-sim/index.js';
export * from './rival-sim/index.js';
export * from './rival-adapters/index.js';
