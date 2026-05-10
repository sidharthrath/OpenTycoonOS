import type { SegmentGrowthParams, SegmentState } from '../../types/market.js';

/** Grow a single segment's population by its growth rate. Returns new population. */
export function growSegment(population: number, rate: number): number {
  return Math.max(0, population * (1 + rate));
}

/**
 * Tick all segments: grow population, awareness, and adoption.
 * Mutates the segments record. Call once per day or at the game's tick interval.
 */
export function tickSegments(
  segments: Record<string, SegmentState>,
  growth: Record<string, SegmentGrowthParams>,
): void {
  for (const [segId, seg] of Object.entries(segments)) {
    const g = growth[segId];
    if (!g) continue;

    seg.totalPopulation = growSegment(seg.totalPopulation, g.populationGrowth);

    const maxAwareness = g.maxAwareness ?? 0.95;
    const maxAdoption = g.maxAdoption ?? 0.80;

    seg.awarenessRate = Math.min(maxAwareness, seg.awarenessRate + g.awarenessGrowth);
    seg.adoptionRate = Math.min(maxAdoption, seg.adoptionRate + g.adoptionGrowth);
  }
}

/** Get the addressable market, aware adopted users, for a segment. */
export function getAddressableUsers(segment: SegmentState): number {
  return Math.floor(segment.totalPopulation * segment.awarenessRate * segment.adoptionRate);
}

/** Create initial segment state. */
export function createSegment(population: number, awareness: number, adoption: number): SegmentState {
  return { totalPopulation: population, awarenessRate: awareness, adoptionRate: adoption };
}
