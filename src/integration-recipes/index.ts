// TycoonOS — Integration Recipes
// Standard glue patterns between modules so generated games do not invent
// different handoffs for the same engine relationships.

import type { BlueprintModuleId, GameBlueprint } from '../game-blueprints/index.js';

export type IntegrationRecipeId =
  | 'funnel-to-market'
  | 'market-to-subscription'
  | 'market-to-transaction'
  | 'market-to-unit-sale'
  | 'revenue-to-accounting'
  | 'rivals-to-market'
  | 'assets-to-capacity'
  | 'perishable-to-revenue'
  | 'events-to-funnel-drivers';

export interface IntegrationEndpoint {
  moduleId: BlueprintModuleId;
  owns: string;
  emits?: readonly string[];
  consumes?: readonly string[];
}

export interface IntegrationStep {
  id: string;
  purpose: string;
  reads: readonly BlueprintModuleId[];
  writes: readonly BlueprintModuleId[];
  output: string;
}

export interface IntegrationRecipe {
  id: IntegrationRecipeId;
  name: string;
  purpose: string;
  requiredModules: readonly BlueprintModuleId[];
  optionalModules: readonly BlueprintModuleId[];
  endpoints: readonly IntegrationEndpoint[];
  steps: readonly IntegrationStep[];
  generatedFiles: readonly string[];
  validationChecks: readonly string[];
  notes: readonly string[];
}

export interface IntegrationSelection {
  recipe: IntegrationRecipe;
  matchedModules: readonly BlueprintModuleId[];
  missingRequiredModules: readonly BlueprintModuleId[];
}

export interface IntegrationValidationIssue {
  recipeId: IntegrationRecipeId;
  severity: 'warning' | 'error';
  message: string;
}

export interface BlueprintIntegrationPlan {
  blueprintId: string;
  recipes: readonly IntegrationRecipe[];
  issues: readonly IntegrationValidationIssue[];
}

export const INTEGRATION_RECIPES: readonly IntegrationRecipe[] = [
  {
    id: 'funnel-to-market',
    name: 'Customer Funnel to Market Engine',
    purpose: 'Turn owner/segment awareness and consideration into market-engine demand pools.',
    requiredModules: ['customer-funnel', 'market-engine'],
    optionalModules: ['market-topology/segmented', 'market-topology/geographic'],
    endpoints: [
      endpoint('customer-funnel', 'Pre-market awareness/consideration cohorts.', ['FunnelPhaseResult', 'FunnelAudienceSummary']),
      endpoint('market-engine', 'Choice among visible offers.', [], ['MarketPool[]']),
    ],
    steps: [
      step('run-funnel', 'Run domain activities and consideration drivers.', ['customer-funnel'], ['customer-funnel'], 'FunnelPhaseResult'),
      step('create-pools', 'Aggregate considering audiences into segment/region demand pools.', ['customer-funnel'], ['market-engine'], 'MarketPool[]'),
      step('resolve-market', 'Resolve demand against player and rival offers.', ['market-engine'], ['market-engine'], 'MarketResult'),
    ],
    generatedFiles: ['src/engine/funnel.ts', 'src/engine/market.ts'],
    validationChecks: [
      'No raw market-size demand should enter market-engine directly.',
      'Owner consideration may boost visibility, but should not grant guaranteed demand.',
    ],
    notes: ['Use `createFunnelMarketPools` as the default handoff.'],
  },
  {
    id: 'market-to-subscription',
    name: 'Market Engine to Subscription Revenue',
    purpose: 'Turn served acquisition/renewal demand into subscriber changes and recurring revenue.',
    requiredModules: ['market-engine', 'revenue-models/subscription'],
    optionalModules: ['engagement', 'loyalty', 'revenue-models/pricing'],
    endpoints: [
      endpoint('market-engine', 'Served demand by offer/owner/pool.', ['MarketResult']),
      endpoint('revenue-models/subscription', 'Subscriber pools, churn, revenue, and LTV.', [], ['acquisitions', 'plan changes']),
    ],
    steps: [
      step('read-served-demand', 'Read served demand by subscription offer.', ['market-engine'], ['revenue-models/subscription'], 'recordAcquisitions input'),
      step('apply-subscription', 'Apply acquisitions, churn, and recurring revenue.', ['revenue-models/subscription'], ['revenue-models/subscription'], 'Subscription tick summary'),
    ],
    generatedFiles: ['src/engine/subscription.ts'],
    validationChecks: [
      'Do not count targetDemand as revenue; only servedDemand can become subscribers.',
      'Churn/retention should remain post-market, not inside customer-funnel.',
    ],
    notes: ['Use this for subscription catalog games and recurring SaaS/service plans.'],
  },
  {
    id: 'market-to-transaction',
    name: 'Market Engine to Transaction Revenue',
    purpose: 'Turn served demand into per-event transactions, fees, take-rate, and variable cost.',
    requiredModules: ['market-engine', 'revenue-models/transaction'],
    optionalModules: ['marketplace', 'perishable', 'revenue-models/pricing'],
    endpoints: [
      endpoint('market-engine', 'Served demand by offer/owner/pool.', ['MarketResult']),
      endpoint('revenue-models/transaction', 'Transaction lines and aggregates.', [], ['TransactionInput[]']),
    ],
    steps: [
      step('map-allocations', 'Map market allocations to transaction lines.', ['market-engine'], ['revenue-models/transaction'], 'TransactionInput[]'),
      step('record-transactions', 'Book revenue, fees, and variable cost.', ['revenue-models/transaction'], ['revenue-models/transaction'], 'TransactionSummary'),
    ],
    generatedFiles: ['src/engine/transactions.ts'],
    validationChecks: ['Transactions should preserve offerId, ownerId, poolId, and channel when available.'],
    notes: ['Use after perishable capacity, marketplace matching, route sales, ride bookings, and unit events.'],
  },
  {
    id: 'market-to-unit-sale',
    name: 'Market Engine to Unit Sales',
    purpose: 'Turn served demand into discrete unit sales constrained by inventory and price.',
    requiredModules: ['market-engine', 'revenue-models/unit-sale'],
    optionalModules: ['asset-models/inventory', 'revenue-models/pricing'],
    endpoints: [
      endpoint('market-engine', 'Served demand by SKU/product offer.', ['MarketResult']),
      endpoint('revenue-models/unit-sale', 'Units sold, COGS, gross margin.', [], ['unit sale lines']),
    ],
    steps: [
      step('cap-by-stock', 'Clamp served demand to available inventory where inventory exists.', ['market-engine', 'asset-models/inventory'], ['revenue-models/unit-sale'], 'sellable units'),
      step('record-unit-sales', 'Book unit sales and COGS.', ['revenue-models/unit-sale'], ['revenue-models/unit-sale'], 'Unit sale summary'),
    ],
    generatedFiles: ['src/engine/unitSales.ts'],
    validationChecks: ['Stockouts should create unmet demand or future funnel friction, not silent sales.'],
    notes: ['Use for physical goods and product-launch games.'],
  },
  {
    id: 'revenue-to-accounting',
    name: 'Revenue Models to Accounting',
    purpose: 'Move revenue, variable costs, capex, financing, taxes, and opex into statements and solvency.',
    requiredModules: ['accounting'],
    optionalModules: ['financial', 'revenue-models/subscription', 'revenue-models/transaction', 'revenue-models/unit-sale', 'balance-sheet'],
    endpoints: [
      endpoint('revenue-models/transaction', 'Revenue/cost summaries.', ['revenue summary']),
      endpoint('accounting', 'Income, cashflow, balance sheet, solvency.', [], ['AccountingPeriodInput']),
    ],
    steps: [
      step('collect-economics', 'Collect revenue, operating expenses, capex, taxes, debt, and equity events.', ['financial'], ['accounting'], 'AccountingPeriodInput'),
      step('apply-period', 'Apply accounting period and read solvency.', ['accounting'], ['accounting'], 'AccountingStatement'),
    ],
    generatedFiles: ['src/engine/accounting.ts'],
    validationChecks: [
      'Revenue should not update cash in one system and accounting again in another.',
      'Capex should flow through cashflow and depreciation, not immediate expense only.',
    ],
    notes: ['Generated games should pick either simple financial or full accounting as the source of cash truth.'],
  },
  {
    id: 'rivals-to-market',
    name: 'Rival Simulation to Market Offers',
    purpose: 'Let rivals own offers, pricing, capacity, funding, and investment instead of using decorative market-share numbers.',
    requiredModules: ['competition/rival-sim', 'competition/rival-adapters', 'market-engine'],
    optionalModules: ['accounting', 'asset-models/fleet', 'asset-models/infrastructure', 'balance-sheet'],
    endpoints: [
      endpoint('competition/rival-sim', 'Rival strategy, cadence, pressure, health.', ['RivalDecision[]']),
      endpoint('competition/rival-adapters', 'Offer, pricing, economics, investment glue.', ['MarketOffer[]', 'RivalEconomicsSnapshot']),
      endpoint('market-engine', 'Demand resolution against player/rival offers.', [], ['MarketOffer[]']),
    ],
    steps: [
      step('build-offers', 'Build rival-owned market offers from rival state.', ['competition/rival-adapters'], ['market-engine'], 'MarketOffer[]'),
      step('resolve-market', 'Resolve player and rival offers together.', ['market-engine'], ['market-engine'], 'MarketResult'),
      step('compute-economics', 'Convert market result into rival economics snapshots.', ['market-engine', 'competition/rival-adapters'], ['competition/rival-sim'], 'RivalEconomicsSnapshot'),
      step('tick-rivals', 'Let rivals make pricing, funding, entry, and capacity decisions.', ['competition/rival-sim'], ['competition/rival-adapters'], 'RivalDecision[]'),
    ],
    generatedFiles: ['src/engine/rivals.ts'],
    validationChecks: ['Rivals should affect demand through offers and capacity, not direct share assignment.'],
    notes: ['Use this by default for generated games with competitors.'],
  },
  {
    id: 'assets-to-capacity',
    name: 'Assets to Market Capacity',
    purpose: 'Convert fleet/infrastructure/inventory/network assets into capacity constraints before market resolution.',
    requiredModules: ['market-engine'],
    optionalModules: ['asset-models/fleet', 'asset-models/infrastructure', 'asset-models/inventory', 'market-topology/network'],
    endpoints: [
      endpoint('asset-models/fleet', 'Available mobile capacity.', ['capacity']),
      endpoint('asset-models/infrastructure', 'Fixed capacity and condition.', ['capacity']),
      endpoint('market-engine', 'Offer capacity constraints.', [], ['offer.capacity']),
    ],
    steps: [
      step('compute-capacity', 'Compute usable capacity from assets/network.', ['asset-models/fleet', 'asset-models/infrastructure', 'market-topology/network'], ['market-engine'], 'capacity by offer'),
      step('assign-capacity', 'Attach capacity to market offers before resolution.', ['market-engine'], ['market-engine'], 'MarketOffer[]'),
    ],
    generatedFiles: ['src/engine/capacity.ts'],
    validationChecks: ['Capacity must be computed before market-engine runs.'],
    notes: ['Use for fleet, infrastructure, network, hotel rooms, seats, depots, routes, towers.'],
  },
  {
    id: 'perishable-to-revenue',
    name: 'Perishable Capacity to Revenue',
    purpose: 'Sell expiring capacity, apply yield pricing, and account for lost revenue from expiry.',
    requiredModules: ['perishable', 'revenue-models/transaction'],
    optionalModules: ['market-engine', 'revenue-models/pricing', 'seasonality'],
    endpoints: [
      endpoint('perishable', 'Dated capacity batches, yield price, expiry.', ['sellable units', 'expired units']),
      endpoint('revenue-models/transaction', 'Booked transactions and variable cost.', [], ['TransactionInput[]']),
    ],
    steps: [
      step('yield-price', 'Apply yield management before demand resolution.', ['perishable', 'revenue-models/pricing'], ['market-engine'], 'priced offers'),
      step('sell-capacity', 'Sell from perishable batches according to served demand.', ['market-engine', 'perishable'], ['revenue-models/transaction'], 'TransactionInput[]'),
      step('expire-leftovers', 'Expire old batches and surface lost revenue.', ['perishable'], ['perishable'], 'expiry report'),
    ],
    generatedFiles: ['src/engine/perishable.ts'],
    validationChecks: ['Expired capacity should be visible in sim reports; otherwise the player cannot learn.'],
    notes: ['Use for seats, rooms, appointment slots, event tickets, and time-window capacity.'],
  },
  {
    id: 'events-to-funnel-drivers',
    name: 'Events and Press to Funnel Drivers',
    purpose: 'Turn events, press, and reputation memory into domain-specific funnel activities/drivers without magic brand numbers.',
    requiredModules: ['customer-funnel'],
    optionalModules: ['events', 'press', 'reputation'],
    endpoints: [
      endpoint('events', 'Incidents, shocks, launches, policy changes.', ['event log']),
      endpoint('press', 'Public attention and headlines.', ['reach signals']),
      endpoint('customer-funnel', 'Exposure activities and consideration drivers.', [], ['FunnelActivity[]', 'ConsiderationDriver[]']),
    ],
    steps: [
      step('translate-events', 'Translate concrete events into reach/pull/fatigue changes.', ['events', 'press', 'reputation'], ['customer-funnel'], 'FunnelActivity[] + ConsiderationDriver[]'),
      step('run-funnel', 'Apply translated drivers through normal funnel math.', ['customer-funnel'], ['customer-funnel'], 'FunnelPhaseResult'),
    ],
    generatedFiles: ['src/engine/funnelDrivers.ts'],
    validationChecks: ['Do not pass a generic brand score. Translate mechanics into explicit reach/pull drivers.'],
    notes: ['This keeps brand/reputation as event memory, not a hard-coded demand lever.'],
  },
] as const;

export const INTEGRATION_RECIPES_BY_ID: Readonly<Record<IntegrationRecipeId, IntegrationRecipe>> =
  Object.freeze(INTEGRATION_RECIPES.reduce((record, recipe) => {
    record[recipe.id] = recipe;
    return record;
  }, {} as Record<IntegrationRecipeId, IntegrationRecipe>));

export function getIntegrationRecipe(id: IntegrationRecipeId): IntegrationRecipe {
  return INTEGRATION_RECIPES_BY_ID[id];
}

export function selectIntegrationRecipesForModules(modules: readonly BlueprintModuleId[]): IntegrationSelection[] {
  const moduleSet = new Set(modules);
  return INTEGRATION_RECIPES
    .map(recipe => {
      const matchedModules = recipe.requiredModules.filter(moduleId => moduleSet.has(moduleId));
      const missingRequiredModules = recipe.requiredModules.filter(moduleId => !moduleSet.has(moduleId));
      return { recipe, matchedModules, missingRequiredModules };
    })
    .filter(selection => selection.matchedModules.length > 0)
    .sort((a, b) => a.missingRequiredModules.length - b.missingRequiredModules.length || b.matchedModules.length - a.matchedModules.length);
}

export function createBlueprintIntegrationPlan(blueprint: GameBlueprint): BlueprintIntegrationPlan {
  const modules = blueprint.modules.required;
  const selections = selectIntegrationRecipesForModules(modules)
    .filter(selection => selection.missingRequiredModules.length === 0);
  const recipes = selections.map(selection => selection.recipe);
  return {
    blueprintId: blueprint.id,
    recipes,
    issues: validateBlueprintIntegrations(blueprint, recipes),
  };
}

export function validateBlueprintIntegrations(
  blueprint: GameBlueprint,
  recipes: readonly IntegrationRecipe[] = createBlueprintIntegrationPlan(blueprint).recipes,
): IntegrationValidationIssue[] {
  const issues: IntegrationValidationIssue[] = [];
  const recipeIds = new Set(recipes.map(recipe => recipe.id));
  const moduleSet = new Set(blueprint.modules.required);

  requireRecipe(recipeIds, issues, 'funnel-to-market', 'error', 'Generated games need a standard customer-funnel to market-engine handoff.');
  if (moduleSet.has('revenue-models/subscription')) requireRecipe(recipeIds, issues, 'market-to-subscription', 'error', 'Subscription games need a market-to-subscription handoff.');
  if (moduleSet.has('revenue-models/transaction')) requireRecipe(recipeIds, issues, 'market-to-transaction', 'warning', 'Transaction games should map market allocations into transaction lines.');
  if (moduleSet.has('revenue-models/unit-sale')) requireRecipe(recipeIds, issues, 'market-to-unit-sale', 'warning', 'Unit-sale games should map market allocations into sellable units.');
  if (moduleSet.has('accounting')) requireRecipe(recipeIds, issues, 'revenue-to-accounting', 'warning', 'Accounting games should define one revenue-to-accounting cash truth.');
  if (moduleSet.has('competition/rival-sim')) requireRecipe(recipeIds, issues, 'rivals-to-market', 'warning', 'Rivals should connect to market offers and economics.');
  if (moduleSet.has('perishable')) requireRecipe(recipeIds, issues, 'perishable-to-revenue', 'warning', 'Perishable games should route expiry and yield into revenue.');

  return issues;
}

function endpoint(
  moduleId: BlueprintModuleId,
  owns: string,
  emits: readonly string[] = [],
  consumes: readonly string[] = [],
): IntegrationEndpoint {
  return { moduleId, owns, emits, consumes };
}

function step(
  id: string,
  purpose: string,
  reads: readonly BlueprintModuleId[],
  writes: readonly BlueprintModuleId[],
  output: string,
): IntegrationStep {
  return { id, purpose, reads, writes, output };
}

function requireRecipe(
  recipeIds: ReadonlySet<IntegrationRecipeId>,
  issues: IntegrationValidationIssue[],
  recipeId: IntegrationRecipeId,
  severity: IntegrationValidationIssue['severity'],
  message: string,
): void {
  if (!recipeIds.has(recipeId)) issues.push({ recipeId, severity, message });
}
