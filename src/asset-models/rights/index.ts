// TycoonOS — Rights / asset-ownership income
//
// Models the economics of owning an asset that other market actors keep using:
// labels collecting royalties from platforms, publishers collecting catalog
// fees, patents collecting license fees, franchise owners collecting royalties,
// or suppliers earning margin from competitors. Games supply the usage and
// the two relevant rates; the engine keeps gross, payout cost, and net honest.

/** One external-usage line for a rights-bearing asset. */
export interface RightsUsageLine {
  /** Game-defined asset id. Optional if caller only needs totals. */
  assetId?: string;
  /** Unit label is game-defined: streams, listen-hours, vehicles, seats, etc. */
  units: number;
  /** Rate charged to the external actor per unit of usage. */
  grossRatePerUnit: number;
  /** Owner's underlying payout / operating cost per unit of usage. */
  payoutRatePerUnit: number;
}

export interface RightsAssetAggregate {
  units: number;
  gross: number;
  cost: number;
  net: number;
}

export interface RightsIncomeSummary {
  units: number;
  gross: number;
  cost: number;
  net: number;
  /** Net / gross, clamped to 0 when gross is zero. */
  spread: number;
  byAsset: Record<string, RightsAssetAggregate>;
}

export function emptyRightsIncomeSummary(): RightsIncomeSummary {
  return {
    units: 0,
    gross: 0,
    cost: 0,
    net: 0,
    spread: 0,
    byAsset: {},
  };
}

/**
 * Compute rights-holder economics from usage lines.
 *
 * The module intentionally does not assume a fixed margin. A major label, a
 * long-tail aggregator, a patent portfolio, and a franchise system can all
 * have very different pass-through economics.
 */
export function computeRightsIncome(lines: readonly RightsUsageLine[]): RightsIncomeSummary {
  const summary = emptyRightsIncomeSummary();
  for (const line of lines) {
    if (line.units <= 0) continue;
    const gross = line.units * line.grossRatePerUnit;
    const cost = line.units * line.payoutRatePerUnit;
    const net = gross - cost;

    summary.units += line.units;
    summary.gross += gross;
    summary.cost += cost;
    summary.net += net;

    if (line.assetId) {
      const existing = summary.byAsset[line.assetId] ?? { units: 0, gross: 0, cost: 0, net: 0 };
      existing.units += line.units;
      existing.gross += gross;
      existing.cost += cost;
      existing.net += net;
      summary.byAsset[line.assetId] = existing;
    }
  }
  summary.spread = summary.gross > 0 ? summary.net / summary.gross : 0;
  return summary;
}

/** Combine multiple rights summaries into one total. */
export function combineRightsIncome(summaries: readonly RightsIncomeSummary[]): RightsIncomeSummary {
  const lines: RightsUsageLine[] = [];
  const combined = emptyRightsIncomeSummary();

  for (const summary of summaries) {
    combined.units += summary.units;
    combined.gross += summary.gross;
    combined.cost += summary.cost;
    combined.net += summary.net;
    for (const [assetId, aggregate] of Object.entries(summary.byAsset)) {
      lines.push({
        assetId,
        units: aggregate.units,
        grossRatePerUnit: aggregate.units > 0 ? aggregate.gross / aggregate.units : 0,
        payoutRatePerUnit: aggregate.units > 0 ? aggregate.cost / aggregate.units : 0,
      });
    }
  }

  combined.spread = combined.gross > 0 ? combined.net / combined.gross : 0;
  combined.byAsset = computeRightsIncome(lines).byAsset;
  return combined;
}
