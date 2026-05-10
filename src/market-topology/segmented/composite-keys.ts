// TycoonOS — Composite owner+tier keys for unified N-product market share.
// Pattern: market-share maps like { "player|standard": 0.34, "streamMax|adSupported": 0.12 }

const SEP = '|';

export function makeCompositeKey(owner: string, variant: string): string {
  return `${owner}${SEP}${variant}`;
}

export function parseCompositeKey<V extends string>(
  key: string,
  validVariants: readonly V[],
): { owner: string; variant: V } | null {
  const [owner, variant] = key.split(SEP);
  if (!owner || !variant) return null;
  if (!(validVariants as readonly string[]).includes(variant)) return null;
  return { owner, variant: variant as V };
}

/**
 * Remove all composite-key entries for a given owner from a shares map.
 * Used when a competitor goes bankrupt — their orphaned shares must be stripped
 * and the remaining shares renormalized to sum to 1.
 */
export function stripOwnerFromShares(
  shares: Record<string, number>,
  owner: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  let remainingTotal = 0;
  for (const [k, v] of Object.entries(shares)) {
    if (k.startsWith(owner + SEP)) continue;
    result[k] = v;
    remainingTotal += v;
  }
  if (remainingTotal > 0) {
    for (const k of Object.keys(result)) result[k] /= remainingTotal;
  }
  return result;
}
