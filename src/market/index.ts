// Compatibility shim for older games.
// New games should import from `tycoonos/market-topology/segmented`.
export {
  aggregateShares,
  blendShares,
  calculateTargetShares,
  createSegment,
  getAddressableUsers,
  growSegment,
  tickSegments,
} from '../market-topology/segmented/index.js';
