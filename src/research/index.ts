import type { ResearchState, ResearchNodeDef, ResearchNodeState, UnlockResult } from '../types/research.js';

/**
 * Initialize a research tree from node definitions.
 * Nodes with no prerequisites start as 'available'; all others as 'locked'.
 */
export function initializeTree(allNodes: Record<string, ResearchNodeDef>): ResearchState {
  const nodes: Record<string, ResearchNodeState> = {};

  for (const [nodeId, def] of Object.entries(allNodes)) {
    const prereqsMet = def.prerequisites.length === 0;
    nodes[nodeId] = {
      nodeId,
      status: prereqsMet ? 'available' : 'locked',
      progress: 0,
    };
  }

  return { nodes, totalPointsSpent: 0 };
}

/**
 * Discover newly available nodes whose prerequisites are all completed.
 * Call this after any node completion to cascade unlocks. Mutates state.
 */
export function unlockAvailableNodes(
  state: ResearchState,
  allNodes: Record<string, ResearchNodeDef>,
): void {
  for (const [nodeId, def] of Object.entries(allNodes)) {
    const existing = state.nodes[nodeId];
    // Skip already-known nodes that aren't locked
    if (existing && existing.status !== 'locked') continue;

    const prereqsMet = def.prerequisites.every(
      pre => state.nodes[pre]?.status === 'completed',
    );

    if (prereqsMet) {
      state.nodes[nodeId] = { nodeId, status: 'available', progress: 0 };
    }
  }
}

/**
 * Spend research points and cash to instantly complete a node.
 * Returns whether it succeeded and the resources spent. Mutates state.
 */
export function unlockNode(
  state: ResearchState,
  nodeId: string,
  allNodes: Record<string, ResearchNodeDef>,
  availablePoints: number,
  availableCash: number,
): UnlockResult {
  const node = state.nodes[nodeId];
  const def = allNodes[nodeId];

  if (!node || !def) return { success: false, pointsSpent: 0, cashSpent: 0 };
  if (node.status !== 'available') return { success: false, pointsSpent: 0, cashSpent: 0 };
  if (availablePoints < def.pointCost || availableCash < def.costCash) {
    return { success: false, pointsSpent: 0, cashSpent: 0 };
  }

  node.status = 'completed';
  node.progress = 1;
  state.totalPointsSpent += def.pointCost;

  // Cascade: unlock any nodes whose prerequisites are now met
  unlockAvailableNodes(state, allNodes);

  return { success: true, pointsSpent: def.pointCost, cashSpent: def.costCash };
}

/** Get all completed node IDs. */
export function getCompletedNodes(state: ResearchState): string[] {
  return Object.values(state.nodes)
    .filter(n => n.status === 'completed')
    .map(n => n.nodeId);
}

/** Get the fraction of the tree that's complete (0-1). */
export function getTreeCompletion(state: ResearchState, totalNodes: number): number {
  if (totalNodes <= 0) return 0;
  const completed = Object.values(state.nodes).filter(n => n.status === 'completed').length;
  return completed / totalNodes;
}
