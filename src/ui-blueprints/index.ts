// TycoonOS — UI Blueprints
// Generator-facing UI primitives for playable management-game screens.

import type { BlueprintId, BlueprintModuleId, GameBlueprint } from '../game-blueprints/index.js';
import type { GameSkeleton, GeneratedScreen } from '../game-generator/index.js';

export type UiPrimitiveId =
  | 'operator-dashboard'
  | 'market-map'
  | 'operations-board'
  | 'finance-screen'
  | 'rival-board'
  | 'timeline-events'
  | 'decision-modal'
  | 'sim-inspector';

export type UiControlKind = 'button' | 'icon-button' | 'segmented-control' | 'slider' | 'stepper' | 'toggle' | 'menu' | 'tabs' | 'table' | 'chart';
export type UiDensity = 'compact' | 'balanced' | 'spacious';

export interface UiKpiSpec {
  id: BlueprintId;
  label: string;
  source: string;
  format: 'number' | 'money' | 'percent' | 'days' | 'text';
}

export interface UiControlSpec {
  id: BlueprintId;
  kind: UiControlKind;
  label: string;
  purpose: string;
}

export interface UiSectionSpec {
  id: BlueprintId;
  title: string;
  purpose: string;
  kpis: readonly UiKpiSpec[];
  controls: readonly UiControlSpec[];
}

export interface UiPrimitive {
  id: UiPrimitiveId;
  name: string;
  purpose: string;
  fitsSurfaceIds: readonly string[];
  modules: readonly BlueprintModuleId[];
  sections: readonly UiSectionSpec[];
  responsiveNotes: readonly string[];
  emptyStates: readonly string[];
}

export interface UiPlanScreen {
  screenId: BlueprintId;
  componentName: string;
  primitiveId: UiPrimitiveId;
  label: string;
  density: UiDensity;
  sections: readonly UiSectionSpec[];
  primaryActions: readonly BlueprintId[];
  reads: readonly BlueprintId[];
}

export interface UiNavigationItem {
  id: BlueprintId;
  label: string;
  screenId: BlueprintId;
  priority: number;
}

export interface UiGenerationPlan {
  title: string;
  density: UiDensity;
  navigation: readonly UiNavigationItem[];
  screens: readonly UiPlanScreen[];
  globalKpis: readonly UiKpiSpec[];
  responsiveRules: readonly string[];
  implementationNotes: readonly string[];
}

export const UI_PRIMITIVES: readonly UiPrimitive[] = [
  primitive('operator-dashboard', 'Operator Dashboard', 'At-a-glance business health and next decision surface.', ['dashboard', 'overview', 'home'], ['financial', 'accounting'], [
    section('kpis', 'Key Metrics', 'Cash, revenue, demand, utilization, and runway.', [
      kpi('cash', 'Cash', 'accounting.cash', 'money'),
      kpi('runway', 'Runway', 'financial.runway', 'days'),
      kpi('last-tick-revenue', 'Revenue', 'lastTick.revenue', 'money'),
      kpi('market-share', 'Share', 'market.servedShare', 'percent'),
    ], []),
    section('next-up', 'Next Up', 'First-session goal and most urgent pressure.', [], [
      control('primary-action', 'button', 'Primary action', 'Advance the most important next decision.'),
    ]),
  ]),
  primitive('market-map', 'Market Map', 'Demand, funnel, segments, regions, offers, and rival pressure.', ['market', 'growth', 'demand'], ['customer-funnel', 'market-engine'], [
    section('funnel', 'Funnel', 'Reach, awareness, consideration, and market demand.', [
      kpi('aware', 'Aware', 'funnel.uniqueAware', 'number'),
      kpi('considering', 'Considering', 'funnel.uniqueConsidering', 'number'),
      kpi('served-demand', 'Served demand', 'market.servedDemand', 'number'),
    ], [
      control('segment-filter', 'segmented-control', 'Segment', 'Switch market segment.'),
      control('region-filter', 'menu', 'Region', 'Choose geography.'),
    ]),
    section('offers', 'Offers', 'Visible player and rival offers with price/quality/capacity.', [], [
      control('offer-table', 'table', 'Offers', 'Compare offers and served demand.'),
    ]),
  ]),
  primitive('operations-board', 'Operations Board', 'Capacity, assets, inventory, scheduling, and service constraints.', ['operations', 'network', 'asset', 'inventory', 'capacity', 'load-calendar'], ['asset-models/fleet', 'asset-models/infrastructure', 'asset-models/inventory', 'perishable'], [
    section('capacity', 'Capacity', 'Available capacity, utilization, bottlenecks, expiry risk.', [
      kpi('utilization', 'Utilization', 'operations.utilization', 'percent'),
      kpi('unmet-demand', 'Unmet demand', 'market.unmetDemand', 'number'),
    ], [
      control('capacity-table', 'table', 'Capacity table', 'Inspect capacity by asset/route/product.'),
      control('rebalance', 'button', 'Rebalance', 'Move capacity to a target.'),
    ]),
  ]),
  primitive('finance-screen', 'Finance Screen', 'Cashflow, accounting statements, capex, debt, dilution, and solvency.', ['finance', 'capital', 'balance-sheet'], ['accounting', 'financial', 'balance-sheet'], [
    section('statements', 'Statements', 'Income, cashflow, balance sheet, and solvency.', [
      kpi('net-income', 'Net income', 'accounting.netIncome', 'money'),
      kpi('solvency', 'Solvency', 'accounting.solvencyStatus', 'text'),
      kpi('debt', 'Debt', 'accounting.debt', 'money'),
    ], [
      control('statement-tabs', 'tabs', 'Statements', 'Switch financial statement.'),
      control('raise-capital', 'button', 'Raise capital', 'Open financing decision.'),
    ]),
  ]),
  primitive('rival-board', 'Rival Board', 'Competitor offers, health, pressure, recent actions, and investment intent.', ['rival', 'competitor', 'competition'], ['competition/rival-sim', 'competition/rival-adapters'], [
    section('rivals', 'Rivals', 'Rival health, capacity, pricing, and actions.', [
      kpi('rival-count', 'Rivals', 'rivals.count', 'number'),
      kpi('rival-pressure', 'Pressure', 'rivals.pressure', 'percent'),
    ], [
      control('rival-table', 'table', 'Rivals', 'Inspect rival state.'),
    ]),
  ]),
  primitive('timeline-events', 'Timeline and Events', 'News, events, milestones, shocks, and player decisions over time.', ['timeline', 'events', 'press', 'news'], ['events', 'press'], [
    section('timeline', 'Timeline', 'Chronological log of important simulation events.', [], [
      control('event-feed', 'table', 'Event feed', 'Scan and filter events.'),
    ]),
  ]),
  primitive('decision-modal', 'Decision Modal', 'Focused action UI for high-stakes choices with tradeoffs and projected consequences.', ['decision', 'modal', 'action'], ['accounting'], [
    section('decision', 'Decision', 'Inputs, tradeoffs, projected effects, and confirmation.', [], [
      control('amount', 'slider', 'Amount', 'Choose a budget/quantity.'),
      control('confirm', 'button', 'Confirm', 'Apply the decision.'),
    ]),
  ]),
  primitive('sim-inspector', 'Simulation Inspector', 'Debug-only probes, invariants, tick state, and generated-game validation.', ['debug', 'sim', 'inspector'], ['sim-harness'], [
    section('probes', 'Probes', 'Headless sim metrics and invariant results.', [], [
      control('probe-table', 'table', 'Probes', 'Inspect probe trends and issues.'),
    ]),
  ]),
] as const;

export function createUiGenerationPlan(
  blueprint: GameBlueprint,
  skeleton?: GameSkeleton,
  density: UiDensity = 'balanced',
): UiGenerationPlan {
  const generatedScreens = skeleton?.screens ?? blueprint.uiSurfaces.map(surface => ({
    id: surface.id,
    componentName: `${pascalCase(surface.id)}Screen`,
    label: surface.label,
    purpose: surface.purpose,
    priority: surface.priority,
    reads: [] as readonly BlueprintId[],
    primaryActions: [] as readonly BlueprintId[],
    source: surface,
  } satisfies GeneratedScreen));
  const screens = generatedScreens.map(screen => createPlanScreen(screen, density));
  return {
    title: blueprint.title,
    density,
    navigation: screens.map((screen, index) => ({
      id: screen.screenId,
      label: screen.label,
      screenId: screen.screenId,
      priority: index,
    })),
    screens,
    globalKpis: defaultGlobalKpis(blueprint),
    responsiveRules: [
      'Primary gameplay starts on the dashboard or most important operational surface; no landing page.',
      'Mobile uses bottom tabs for primary screens and a sheet for decisions.',
      'Desktop uses a left nav plus dense tables/charts where useful.',
      'Debug surfaces are hidden behind an explicit developer toggle.',
    ],
    implementationNotes: [
      'Use icon buttons for tool actions and clear text buttons only for major commands.',
      'Keep dashboard dense and scannable; avoid marketing-page hero layouts.',
      'Every primary action should show projected cash/demand/capacity consequences before confirm.',
    ],
  };
}

export function matchUiPrimitive(screen: GeneratedScreen | { id: string; label: string; purpose: string }): UiPrimitive {
  const searchable = `${screen.id} ${screen.label} ${screen.purpose}`.toLowerCase();
  return UI_PRIMITIVES.find(primitive => primitive.fitsSurfaceIds.some(term => searchable.includes(term))) ?? UI_PRIMITIVES[0];
}

function createPlanScreen(screen: GeneratedScreen, density: UiDensity): UiPlanScreen {
  const primitive = matchUiPrimitive(screen);
  return {
    screenId: screen.id,
    componentName: screen.componentName,
    primitiveId: primitive.id,
    label: screen.label,
    density,
    sections: primitive.sections,
    primaryActions: screen.primaryActions,
    reads: screen.reads,
  };
}

function defaultGlobalKpis(blueprint: GameBlueprint): UiKpiSpec[] {
  const kpis = [
    kpi('cash', 'Cash', 'accounting.cash', 'money'),
    kpi('goal', 'Goal', blueprint.firstSessionGoal ?? 'firstSession.goal', 'text'),
  ];
  if (blueprint.modules.required.includes('market-engine')) kpis.push(kpi('demand', 'Demand', 'market.servedDemand', 'number'));
  if (blueprint.modules.required.includes('accounting')) kpis.push(kpi('solvency', 'Solvency', 'accounting.solvencyStatus', 'text'));
  return kpis;
}

function primitive(
  id: UiPrimitiveId,
  name: string,
  purpose: string,
  fitsSurfaceIds: readonly string[],
  modules: readonly BlueprintModuleId[],
  sections: readonly UiSectionSpec[],
): UiPrimitive {
  return {
    id,
    name,
    purpose,
    fitsSurfaceIds,
    modules,
    sections,
    responsiveNotes: [],
    emptyStates: [],
  };
}

function section(
  id: BlueprintId,
  title: string,
  purpose: string,
  kpis: readonly UiKpiSpec[],
  controls: readonly UiControlSpec[],
): UiSectionSpec {
  return { id, title, purpose, kpis, controls };
}

function kpi(id: BlueprintId, label: string, source: string, format: UiKpiSpec['format']): UiKpiSpec {
  return { id, label, source, format };
}

function control(id: BlueprintId, kind: UiControlKind, label: string, purpose: string): UiControlSpec {
  return { id, kind, label, purpose };
}

function pascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
