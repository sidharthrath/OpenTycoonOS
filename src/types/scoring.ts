export interface ScoringDimension<S = unknown> {
  name: string;
  weight: number;
  /** Compute score for this dimension (0-100) */
  compute: (state: S) => number;
}

export interface EndGameScore {
  total: number;
  breakdown: Record<string, number>;
  /** Game-defined archetype based on score profile (e.g. 'frontier_lab', 'content_king') */
  archetype?: string;
}
