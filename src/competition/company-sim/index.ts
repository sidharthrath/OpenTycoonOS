// TycoonOS — Competitor company simulation
// Lightweight but economically coherent rival companies. Games define each
// operating line; this module computes revenue, costs, utilization, cashflow,
// and distress state so competitors are not just abstract pressure fields.

export type CompanyStatus = 'operating' | 'distressed' | 'restructured' | 'exited';

export interface CompanyOperatingLine<TLine extends string = string> {
  id: TLine;
  units: number;
  pricePerUnit: number;
  variableCostPerUnit: number;
  fixedCostPerTick?: number;
  capacityUnits?: number;
  demandUnits?: number;
}

export interface CompanyLineResult<TLine extends string = string> {
  id: TLine;
  unitsServed: number;
  revenue: number;
  variableCost: number;
  fixedCost: number;
  grossProfit: number;
  capacityUnits: number;
  demandUnits: number;
  unmetDemand: number;
  utilization: number;
}

export interface CompanyTickSummary<TLine extends string = string> {
  revenue: number;
  variableCost: number;
  fixedCost: number;
  capex: number;
  netCashflow: number;
  endingCash: number;
  totalDemand: number;
  totalCapacity: number;
  unmetDemand: number;
  utilization: number;
  lineResults: CompanyLineResult<TLine>[];
  status: CompanyStatus;
}

export interface CompanySimState<TLine extends string = string, TMeta = Record<string, never>> {
  id: string;
  name: string;
  cash: number;
  status: CompanyStatus;
  restructureCount: number;
  lastTick: CompanyTickSummary<TLine> | null;
  lines: Record<TLine, CompanyOperatingLine<TLine>>;
  meta: TMeta;
}

export interface CreateCompanyInput<TLine extends string, TMeta> {
  id: string;
  name: string;
  cash: number;
  lines: readonly CompanyOperatingLine<TLine>[];
  meta: TMeta;
  status?: CompanyStatus;
}

export interface TickCompanyOptions {
  capex?: number;
  overheadCost?: number;
  distressCashThreshold?: number;
  restructureCashThreshold?: number;
  restructureInjection?: number;
  exitAfterRestructures?: number;
}

export interface CompanyInvestment<TLine extends string = string> {
  cashCost: number;
  capacityAdditions?: Partial<Record<TLine, number>>;
}

export function createCompany<TLine extends string, TMeta = Record<string, never>>(
  input: CreateCompanyInput<TLine, TMeta>,
): CompanySimState<TLine, TMeta> {
  return {
    id: input.id,
    name: input.name,
    cash: input.cash,
    status: input.status ?? 'operating',
    restructureCount: 0,
    lastTick: null,
    lines: input.lines.reduce((record, line) => {
      record[line.id] = { ...line };
      return record;
    }, {} as Record<TLine, CompanyOperatingLine<TLine>>),
    meta: input.meta,
  };
}

export function tickCompany<TLine extends string, TMeta>(
  company: CompanySimState<TLine, TMeta>,
  options: TickCompanyOptions = {},
): CompanyTickSummary<TLine> {
  if (company.status === 'exited') {
    const summary = emptySummary(company, 'exited');
    company.lastTick = summary;
    return summary;
  }

  const lineResults = Object.values(company.lines).map((lineUnknown) => {
    const line = lineUnknown as CompanyOperatingLine<TLine>;
    const capacity = Math.max(0, line.capacityUnits ?? line.units);
    const demand = Math.max(0, line.demandUnits ?? line.units);
    const unitsServed = Math.max(0, Math.min(line.units, capacity, demand));
    const revenue = unitsServed * line.pricePerUnit;
    const variableCost = unitsServed * line.variableCostPerUnit;
    const fixedCost = Math.max(0, line.fixedCostPerTick ?? 0);
    return {
      id: line.id,
      unitsServed,
      revenue,
      variableCost,
      fixedCost,
      grossProfit: revenue - variableCost - fixedCost,
      capacityUnits: capacity,
      demandUnits: demand,
      unmetDemand: Math.max(0, demand - unitsServed),
      utilization: unitsServed / Math.max(1, capacity),
    };
  });

  const revenue = lineResults.reduce((sum, line) => sum + line.revenue, 0);
  const variableCost = lineResults.reduce((sum, line) => sum + line.variableCost, 0);
  const fixedCost = lineResults.reduce((sum, line) => sum + line.fixedCost, 0) + Math.max(0, options.overheadCost ?? 0);
  const capex = Math.max(0, options.capex ?? 0);
  const netCashflow = revenue - variableCost - fixedCost - capex;
  company.cash += netCashflow;

  const distressThreshold = options.distressCashThreshold ?? 0;
  const restructureThreshold = options.restructureCashThreshold ?? -Infinity;
  const maxRestructures = options.exitAfterRestructures ?? Infinity;
  if (company.cash < restructureThreshold) {
    if (company.restructureCount >= maxRestructures) {
      company.status = 'exited';
    } else {
      company.status = 'restructured';
      company.restructureCount += 1;
      company.cash += Math.max(0, options.restructureInjection ?? 0);
    }
  } else if (company.cash < distressThreshold) {
    company.status = 'distressed';
  } else if (company.status !== 'restructured') {
    company.status = 'operating';
  }

  const totalDemand = lineResults.reduce((sum, line) => sum + line.demandUnits, 0);
  const totalCapacity = lineResults.reduce((sum, line) => sum + line.capacityUnits, 0);
  const summary: CompanyTickSummary<TLine> = {
    revenue,
    variableCost,
    fixedCost,
    capex,
    netCashflow,
    endingCash: company.cash,
    totalDemand,
    totalCapacity,
    unmetDemand: lineResults.reduce((sum, line) => sum + line.unmetDemand, 0),
    utilization: lineResults.reduce((sum, line) => sum + line.unitsServed, 0) / Math.max(1, totalCapacity),
    lineResults,
    status: company.status,
  };
  company.lastTick = summary;
  return summary;
}

export function applyCompanyInvestment<TLine extends string, TMeta>(
  company: CompanySimState<TLine, TMeta>,
  investment: CompanyInvestment<TLine>,
): boolean {
  if (company.status === 'exited' || company.cash < investment.cashCost) return false;
  company.cash -= investment.cashCost;
  for (const [lineId, addition] of Object.entries(investment.capacityAdditions ?? {}) as Array<[TLine, number]>) {
    const line = company.lines[lineId];
    if (!line) continue;
    line.capacityUnits = Math.max(0, (line.capacityUnits ?? line.units) + addition);
  }
  return true;
}

export function companyRunwayTicks<TLine extends string, TMeta>(
  company: CompanySimState<TLine, TMeta>,
): number {
  const burn = -(company.lastTick?.netCashflow ?? 0);
  if (burn <= 0) return Infinity;
  return company.cash / burn;
}

function emptySummary<TLine extends string, TMeta>(
  company: CompanySimState<TLine, TMeta>,
  status: CompanyStatus,
): CompanyTickSummary<TLine> {
  return {
    revenue: 0,
    variableCost: 0,
    fixedCost: 0,
    capex: 0,
    netCashflow: 0,
    endingCash: company.cash,
    totalDemand: 0,
    totalCapacity: 0,
    unmetDemand: 0,
    utilization: 0,
    lineResults: [],
    status,
  };
}
