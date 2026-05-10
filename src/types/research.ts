export type NodeStatus = 'locked' | 'available' | 'in_progress' | 'completed';

/** Definition of a research node. Games extend this with domain-specific fields. */
export interface ResearchNodeDef {
  id: string;
  name: string;
  pillar: string;
  prerequisites: string[];
  pointCost: number;
  costCash: number;
  /** Ongoing monthly cost once unlocked (e.g. data subscriptions) */
  monthlyCost?: number;
  icon?: string;
  flavorText?: string;
  /** Games attach arbitrary extra data here (benchmark affinities, genre boosts, etc.) */
  [key: string]: unknown;
}

export interface ResearchNodeState {
  nodeId: string;
  status: NodeStatus;
  progress: number;
}

export interface ResearchState {
  nodes: Record<string, ResearchNodeState>;
  totalPointsSpent: number;
}

export interface UnlockResult {
  success: boolean;
  pointsSpent: number;
  cashSpent: number;
}
