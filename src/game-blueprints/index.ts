// TycoonOS — Game Blueprints
// Construction grammar for turning researched game ideas into module
// compositions, state slices, tick phases, UI surfaces, and validation checks.

export type BlueprintId = string;
export type BlueprintSeverity = 'info' | 'warning' | 'error';

export type BlueprintPrimitiveId =
  | 'subscription-catalog-business'
  | 'perishable-capacity-business'
  | 'capital-asset-network-business'
  | 'physical-goods-launch-business'
  | 'two-sided-marketplace-business'
  | 'regulated-expansion-business'
  | 'asset-liability-finance-business'
  | 'pipeline-r-and-d-business';

export type BlueprintModuleId =
  | 'accounting'
  | 'asset-models/fleet'
  | 'asset-models/infrastructure'
  | 'asset-models/inventory'
  | 'asset-models/rights'
  | 'balance-sheet'
  | 'commodities'
  | 'competition/rival-adapters'
  | 'competition/rival-sim'
  | 'content-slate'
  | 'customer-funnel'
  | 'engagement'
  | 'events'
  | 'financial'
  | 'game-blueprints'
  | 'game-generator'
  | 'inflation'
  | 'integration-recipes'
  | 'loyalty'
  | 'market-engine'
  | 'market-topology/geographic'
  | 'market-topology/network'
  | 'market-topology/segmented'
  | 'marketplace'
  | 'perishable'
  | 'pipeline'
  | 'political'
  | 'press'
  | 'research'
  | 'research-blueprint'
  | 'reputation'
  | 'revenue-models/ads'
  | 'revenue-models/pricing'
  | 'revenue-models/subscription'
  | 'revenue-models/transaction'
  | 'revenue-models/unit-sale'
  | 'save-system'
  | 'seasonality'
  | 'sim-harness'
  | 'tick';

export interface BlueprintStateSlice {
  id: BlueprintId;
  purpose: string;
  examples: readonly string[];
}

export interface BlueprintTickPhase {
  id: BlueprintId;
  purpose: string;
  after?: readonly BlueprintId[];
  before?: readonly BlueprintId[];
  modules: readonly BlueprintModuleId[];
}

export interface BlueprintAction {
  id: BlueprintId;
  label: string;
  purpose: string;
  modules: readonly BlueprintModuleId[];
}

export interface BlueprintUiSurface {
  id: BlueprintId;
  label: string;
  purpose: string;
  priority: 'primary' | 'secondary' | 'debug';
}

export interface BlueprintBalancingDefault {
  id: BlueprintId;
  purpose: string;
  starterValue: string;
  tuningNotes: string;
}

export interface BlueprintValidationRule {
  id: BlueprintId;
  label: string;
  severity: BlueprintSeverity;
}

export interface GameBlueprintPrimitive {
  id: BlueprintPrimitiveId;
  name: string;
  description: string;
  fits: readonly string[];
  tags: readonly string[];
  playerFantasy: string;
  coreLoop: readonly string[];
  requiredModules: readonly BlueprintModuleId[];
  optionalModules: readonly BlueprintModuleId[];
  stateSlices: readonly BlueprintStateSlice[];
  tickPhases: readonly BlueprintTickPhase[];
  playerActions: readonly BlueprintAction[];
  rivalActions: readonly BlueprintAction[];
  uiSurfaces: readonly BlueprintUiSurface[];
  balancingDefaults: readonly BlueprintBalancingDefault[];
  failureModes: readonly string[];
  researchQuestions: readonly string[];
  validationRules: readonly BlueprintValidationRule[];
}

export interface BlueprintSelectionInput {
  idea: string;
  audience?: string;
  platform?: string;
  desiredTags?: readonly string[];
  requiredModules?: readonly BlueprintModuleId[];
}

export interface BlueprintPrimitiveMatch {
  primitive: GameBlueprintPrimitive;
  score: number;
  reasons: readonly string[];
}

export interface ComposeBlueprintInput {
  id?: BlueprintId;
  title: string;
  idea: string;
  audience: string;
  platform: string;
  primitiveIds: readonly BlueprintPrimitiveId[];
  domainFocus?: readonly string[];
  extraModules?: readonly BlueprintModuleId[];
  firstSessionGoal?: string;
}

export interface GameBlueprint {
  id: BlueprintId;
  title: string;
  idea: string;
  audience: string;
  platform: string;
  primitiveIds: readonly BlueprintPrimitiveId[];
  playerFantasy: string;
  coreLoop: readonly string[];
  modules: {
    required: readonly BlueprintModuleId[];
    optional: readonly BlueprintModuleId[];
  };
  stateSlices: readonly BlueprintStateSlice[];
  tickPhases: readonly BlueprintTickPhase[];
  playerActions: readonly BlueprintAction[];
  rivalActions: readonly BlueprintAction[];
  uiSurfaces: readonly BlueprintUiSurface[];
  balancingDefaults: readonly BlueprintBalancingDefault[];
  failureModes: readonly string[];
  researchQuestions: readonly string[];
  validationRules: readonly BlueprintValidationRule[];
  firstSessionGoal?: string;
  generatorNotes: readonly string[];
}

export interface BlueprintValidationIssue {
  ruleId: BlueprintId;
  severity: BlueprintSeverity;
  message: string;
}

export interface BlueprintValidationResult {
  ok: boolean;
  issues: readonly BlueprintValidationIssue[];
}

const CORE_MODULES: readonly BlueprintModuleId[] = ['tick', 'save-system', 'financial'];
const DEFAULT_FOUNDATION_MODULES: readonly BlueprintModuleId[] = [
  'customer-funnel',
  'market-engine',
  'competition/rival-sim',
  'competition/rival-adapters',
  'accounting',
];

export const GAME_BLUEPRINT_PRIMITIVES: readonly GameBlueprintPrimitive[] = [
  {
    id: 'subscription-catalog-business',
    name: 'Subscription Catalog Business',
    description: 'Recurring customer relationships built around catalog/product breadth, engagement, and churn.',
    fits: ['streaming', 'SaaS', 'AI tools', 'news', 'education apps', 'membership communities'],
    tags: ['subscription', 'catalog', 'engagement', 'recurring', 'digital', 'services'],
    playerFantasy: 'Build a must-have service, fund the catalog/product roadmap, and turn attention into durable recurring revenue.',
    coreLoop: [
      'Fund product or catalog expansion.',
      'Generate awareness and consideration for target segments.',
      'Resolve plan choice through market-engine.',
      'Convert customers into recurring revenue.',
      'Use engagement, churn, rivals, and accounting feedback to adjust the next investment cycle.',
    ],
    requiredModules: [
      'customer-funnel',
      'market-engine',
      'market-topology/segmented',
      'revenue-models/subscription',
      'engagement',
      'content-slate',
      'competition/rival-sim',
      'competition/rival-adapters',
      'accounting',
      'save-system',
    ],
    optionalModules: ['revenue-models/ads', 'revenue-models/pricing', 'press', 'events', 'research', 'reputation'],
    stateSlices: [
      slice('segments', 'Customer segments and reachable populations.', ['casual users', 'premium users', 'enterprise teams']),
      slice('plans', 'Visible subscription products and prices.', ['free', 'plus', 'pro', 'enterprise']),
      slice('catalog', 'Supply that drives engagement and product differentiation.', ['shows', 'models', 'courses', 'features']),
      slice('subscribers', 'Recurring customer pools by segment and plan.', ['active subs', 'trial subs', 'enterprise seats']),
      slice('funnel', 'Pre-market awareness and consideration by owner/segment.', ['aware premium customers', 'considering teams']),
    ],
    tickPhases: [
      phase('slate-investment', 'Convert budget into catalog/product supply.', ['content-slate', 'accounting']),
      phase('funnel', 'Turn domain activities into awareness and consideration.', ['customer-funnel']),
      phase('market-resolution', 'Resolve plan choice among player and rival offers.', ['market-engine']),
      phase('subscription-revenue', 'Book recurring revenue, costs, LTV, and churn.', ['revenue-models/subscription']),
      phase('engagement', 'Convert supply breadth into usage and stickiness signals.', ['engagement']),
      phase('rivals', 'Let rivals price, invest, and adjust capacity/cash.', ['competition/rival-sim', 'competition/rival-adapters']),
      phase('accounting', 'Record opex, investment, revenue, financing, and solvency.', ['accounting']),
    ],
    playerActions: [
      action('commission-slate', 'Commission catalog/product work', 'Allocate budget into content, features, models, or courses.', ['content-slate', 'accounting']),
      action('set-prices', 'Set plan prices', 'Tune conversion, margin, and churn pressure.', ['revenue-models/pricing', 'market-engine']),
      action('target-segment', 'Target a segment', 'Choose where funnel activity concentrates.', ['customer-funnel', 'market-topology/segmented']),
      action('fund-growth', 'Fund growth', 'Raise cash or cut burn to keep runway healthy.', ['accounting', 'financial']),
    ],
    rivalActions: [
      action('rival-price-plan', 'Change plan price', 'Compete for visible demand without hard-coded share changes.', ['competition/rival-adapters', 'market-engine']),
      action('rival-invest-catalog', 'Invest in catalog/product', 'Improve future offer quality through capacity/product investment.', ['competition/rival-sim', 'content-slate']),
    ],
    uiSurfaces: [
      surface('dashboard', 'Operator dashboard', 'MRR, subscribers, runway, engagement, rival pressure.', 'primary'),
      surface('catalog', 'Catalog/product slate', 'Investment pipeline and breadth/freshness decisions.', 'primary'),
      surface('market', 'Market map', 'Segment awareness, consideration, share, and rivals.', 'primary'),
      surface('finance', 'Finance', 'Cash, burn, accounting statements, fundraising, solvency.', 'secondary'),
    ],
    balancingDefaults: [
      balancing('starting-runway', 'Starting runway', '12-18 months', 'Enough time for two investment cycles before pressure hits.'),
      balancing('monthly-churn', 'Baseline churn', '2-6% monthly', 'Tune by audience pain and product substitutability.'),
      balancing('catalog-payback', 'Catalog payback', '2-5 quarters', 'Avoid instant content ROI; make slate timing matter.'),
    ],
    failureModes: [
      'Subscriber growth cannot cover content/product spend.',
      'Rivals outspend the catalog and win consideration.',
      'Churn rises faster than acquisition.',
      'Cash runway runs out before payback.',
    ],
    researchQuestions: [
      'What do customers subscribe for and what alternatives do they compare?',
      'Which segments have different willingness-to-pay or usage intensity?',
      'What investment creates durable differentiation in this domain?',
      'What causes churn or plan switching in the real market?',
    ],
    validationRules: rules('subscription'),
  },
  {
    id: 'perishable-capacity-business',
    name: 'Perishable Capacity Business',
    description: 'Businesses where unsold capacity expires: seats, rooms, tickets, tables, berths, appointments.',
    fits: ['airlines', 'hotels', 'cinemas', 'events', 'restaurants', 'cruises', 'clinics'],
    tags: ['perishable', 'capacity', 'yield', 'transaction', 'hospitality', 'transport', 'airline', 'hotel', 'event'],
    playerFantasy: 'Forecast demand, price capacity, and avoid watching sellable inventory expire unused.',
    coreLoop: [
      'Create dated capacity through assets, inventory, or schedule decisions.',
      'Generate consideration for specific segments/regions/times.',
      'Resolve bookings/sales through market-engine.',
      'Apply yield pricing and expiry losses.',
      'Use load factors, margin, and cashflow to adjust future capacity.',
    ],
    requiredModules: [
      'customer-funnel',
      'market-engine',
      'perishable',
      'revenue-models/transaction',
      'revenue-models/pricing',
      'competition/rival-sim',
      'competition/rival-adapters',
      'accounting',
      'save-system',
    ],
    optionalModules: ['asset-models/fleet', 'asset-models/infrastructure', 'market-topology/geographic', 'seasonality', 'loyalty', 'press', 'events'],
    stateSlices: [
      slice('capacity-batches', 'Dated sellable capacity.', ['flight seats', 'hotel nights', 'show tickets']),
      slice('demand-forecast', 'Expected sales pace and seasonality.', ['booking curve', 'weekend multiplier']),
      slice('pricing', 'Current yield prices and bounds.', ['fare class', 'room rate', 'ticket tier']),
      slice('funnel', 'Awareness and active consideration by segment/time/region.', ['aware leisure travelers', 'considering business guests']),
    ],
    tickPhases: [
      phase('capacity-planning', 'Add or schedule expiring capacity.', ['perishable', 'asset-models/fleet', 'asset-models/infrastructure']),
      phase('funnel', 'Create considering demand from domain-specific activities.', ['customer-funnel']),
      phase('yield-pricing', 'Adjust price against forecast pace and capacity pressure.', ['perishable', 'revenue-models/pricing']),
      phase('market-resolution', 'Resolve customer choice and capacity limits.', ['market-engine']),
      phase('transaction-revenue', 'Record bookings/sales and variable cost.', ['revenue-models/transaction']),
      phase('expiry', 'Expire unsold capacity and report lost revenue.', ['perishable']),
      phase('accounting', 'Record operating results and asset financing.', ['accounting']),
    ],
    playerActions: [
      action('add-capacity', 'Add capacity', 'Schedule seats, rooms, tables, appointments, or tickets.', ['perishable']),
      action('adjust-yield', 'Adjust yield pricing', 'Trade load factor against margin.', ['perishable', 'revenue-models/pricing']),
      action('promote-window', 'Promote a demand window', 'Spend domain-specific activity into the pre-market funnel.', ['customer-funnel']),
      action('invest-service', 'Invest in service reliability', 'Improve future eligibility or score through game-specific mechanics.', ['market-engine', 'accounting']),
    ],
    rivalActions: [
      action('rival-discount-window', 'Discount weak windows', 'React to low utilization through pricing decisions.', ['competition/rival-adapters', 'revenue-models/pricing']),
      action('rival-add-capacity', 'Add rival capacity', 'Increase future supply when cash and demand justify it.', ['competition/rival-sim', 'perishable']),
    ],
    uiSurfaces: [
      surface('load-calendar', 'Load calendar', 'Capacity, booking pace, expiry risk, and price by date.', 'primary'),
      surface('market', 'Market demand', 'Considering demand and competitor offers.', 'primary'),
      surface('operations', 'Operations', 'Assets, schedule, service constraints.', 'primary'),
      surface('finance', 'Finance', 'Cash, margin, debt, capex, solvency.', 'secondary'),
    ],
    balancingDefaults: [
      balancing('forecast-error', 'Forecast error', '10-25%', 'Enough uncertainty to reward adaptive pricing.'),
      balancing('expiry-pain', 'Expiry loss visibility', 'show lost revenue every tick', 'Players need to feel the cost of empty capacity.'),
      balancing('price-elasticity', 'Price elasticity', 'moderate', 'Avoid one obvious price; make segments differ.'),
    ],
    failureModes: [
      'Capacity expires before demand materializes.',
      'Discounting fills capacity but destroys margin.',
      'Fixed asset cost outruns load factor.',
      'Rivals cherry-pick the highest-yield windows.',
    ],
    researchQuestions: [
      'What exactly expires, and on what time horizon?',
      'How far ahead do customers book or decide?',
      'What demand windows are structurally different?',
      'What variable and fixed costs make empty capacity painful?',
    ],
    validationRules: rules('perishable'),
  },
  {
    id: 'capital-asset-network-business',
    name: 'Capital Asset Network Business',
    description: 'Long-lived assets arranged into routes, coverage, nodes, corridors, or service networks.',
    fits: ['airlines', 'hotels', 'metros', 'telecoms', 'logistics', 'utilities', 'broadband', 'charging networks'],
    tags: ['network', 'fleet', 'infrastructure', 'capital', 'coverage', 'route', 'hotel'],
    playerFantasy: 'Build a physical/service network whose shape determines demand, utilization, reliability, and debt pressure.',
    coreLoop: [
      'Choose where to deploy scarce capital.',
      'Translate assets into network coverage or capacity.',
      'Generate consideration only where access exists.',
      'Resolve demand against capacity and rival networks.',
      'Maintain assets, finance expansion, and survive shocks.',
    ],
    requiredModules: [
      'market-topology/network',
      'market-topology/geographic',
      'customer-funnel',
      'market-engine',
      'asset-models/fleet',
      'asset-models/infrastructure',
      'competition/rival-sim',
      'competition/rival-adapters',
      'accounting',
      'save-system',
    ],
    optionalModules: ['commodities', 'inflation', 'events', 'political', 'seasonality', 'perishable', 'revenue-models/transaction'],
    stateSlices: [
      slice('network', 'Nodes, edges, sinks, and usable capacity.', ['routes', 'coverage zones', 'stations', 'backhaul']),
      slice('assets', 'Fleet/infrastructure units and condition.', ['aircraft', 'towers', 'trains', 'depots']),
      slice('geography', 'Entered regions and local constraints.', ['cities', 'states', 'markets']),
      slice('finance', 'Debt, depreciation, maintenance, and solvency.', ['term loans', 'book value', 'interest coverage']),
    ],
    tickPhases: [
      phase('asset-build', 'Buy/build/lease assets and infrastructure.', ['asset-models/fleet', 'asset-models/infrastructure', 'accounting']),
      phase('network-capacity', 'Convert assets into usable network capacity.', ['market-topology/network']),
      phase('funnel', 'Create consideration only in reachable geographies/network zones.', ['customer-funnel', 'market-topology/geographic']),
      phase('market-resolution', 'Resolve demand with capacity constraints.', ['market-engine']),
      phase('operations', 'Tick maintenance, outages, utilization, commodity costs.', ['asset-models/fleet', 'asset-models/infrastructure', 'commodities']),
      phase('rivals', 'Let competitors enter, price, and expand network capacity.', ['competition/rival-sim', 'competition/rival-adapters']),
      phase('accounting', 'Track capex, depreciation, debt service, and solvency.', ['accounting']),
    ],
    playerActions: [
      action('open-node', 'Open a node/region', 'Extend reachable network geography.', ['market-topology/geographic', 'market-topology/network']),
      action('buy-asset', 'Buy or lease asset', 'Increase future service capacity at financing cost.', ['asset-models/fleet', 'accounting']),
      action('build-infrastructure', 'Build infrastructure', 'Create durable capacity with maintenance obligations.', ['asset-models/infrastructure', 'accounting']),
      action('rebalance-capacity', 'Rebalance capacity', 'Shift capacity toward higher-yield sinks.', ['market-topology/network']),
    ],
    rivalActions: [
      action('rival-enter-region', 'Enter region', 'Expand into attractive geographies.', ['competition/rival-adapters', 'market-topology/geographic']),
      action('rival-invest-capacity', 'Invest capacity', 'Add capacity when pressure and cash justify it.', ['competition/rival-adapters', 'asset-models/fleet']),
    ],
    uiSurfaces: [
      surface('network-map', 'Network map', 'Nodes, links, capacity, utilization, unmet demand.', 'primary'),
      surface('asset-ledger', 'Asset ledger', 'Fleet/infrastructure condition, book value, maintenance.', 'primary'),
      surface('market', 'Market', 'Funnel, demand, rivals, regional opportunity.', 'primary'),
      surface('finance', 'Capital stack', 'Debt, depreciation, cashflow, solvency.', 'primary'),
    ],
    balancingDefaults: [
      balancing('asset-payback', 'Asset payback', '3-8 years', 'Long enough that financing and utilization matter.'),
      balancing('maintenance-burden', 'Maintenance burden', '2-8% of asset cost annually', 'Prevents asset hoarding without ops discipline.'),
      balancing('network-effects', 'Network value curve', 'sublinear early, stronger near coverage thresholds', 'Make network shape strategically meaningful.'),
    ],
    failureModes: [
      'Debt-funded expansion outruns utilization.',
      'Network gaps prevent demand from converting.',
      'Maintenance underinvestment causes reliability failures.',
      'Commodity/input shocks collapse route or service economics.',
    ],
    researchQuestions: [
      'What assets create capacity, and what is their useful life?',
      'What geography or network topology makes demand accessible?',
      'Which nodes/routes/coverage areas are strategically important?',
      'What real-world shocks or maintenance cycles constrain operators?',
    ],
    validationRules: rules('network'),
  },
  {
    id: 'physical-goods-launch-business',
    name: 'Physical Goods Launch Business',
    description: 'Design, produce, stock, launch, and sell tangible products through segments and regions.',
    fits: ['EVs', 'phones', 'fashion', 'CPG', 'consumer electronics', 'retail products', 'devices'],
    tags: ['goods', 'inventory', 'unit-sale', 'launch', 'manufacturing', 'retail'],
    playerFantasy: 'Forecast the market, commit production capital, and ship products customers actually want.',
    coreLoop: [
      'Research/design a product or SKU.',
      'Commit production and inventory before demand is certain.',
      'Generate awareness and consideration around launch windows.',
      'Resolve purchases through market-engine.',
      'Manage stockouts, write-downs, margin, and next-cycle improvements.',
    ],
    requiredModules: [
      'asset-models/inventory',
      'revenue-models/unit-sale',
      'customer-funnel',
      'market-engine',
      'market-topology/geographic',
      'market-topology/segmented',
      'seasonality',
      'competition/rival-sim',
      'competition/rival-adapters',
      'accounting',
      'save-system',
    ],
    optionalModules: ['research', 'events', 'press', 'reputation', 'revenue-models/pricing', 'inflation'],
    stateSlices: [
      slice('skus', 'Products/SKUs with quality, cost, price, and positioning.', ['base model', 'pro model', 'seasonal line']),
      slice('inventory', 'Stock on hand, pipeline, COGS, obsolescence.', ['finished units', 'raw materials', 'write-down risk']),
      slice('channels', 'Geographies and sales/distribution access.', ['online', 'stores', 'regional dealers']),
      slice('launch-calendar', 'Release timing and campaign windows.', ['preorder', 'launch week', 'clearance']),
    ],
    tickPhases: [
      phase('product-development', 'Improve or finalize SKUs.', ['research']),
      phase('production', 'Turn budget/capacity into inventory.', ['asset-models/inventory', 'accounting']),
      phase('funnel', 'Launch activities create awareness and consideration.', ['customer-funnel']),
      phase('market-resolution', 'Resolve unit purchases and stockouts.', ['market-engine']),
      phase('unit-sales', 'Book revenue, COGS, gross margin, returns/warranty reserves if modeled.', ['revenue-models/unit-sale']),
      phase('inventory-aging', 'Apply obsolescence, seasonality, and write-downs.', ['asset-models/inventory', 'seasonality']),
      phase('accounting', 'Recognize cashflow, inventory value, and solvency.', ['accounting']),
    ],
    playerActions: [
      action('choose-sku', 'Choose SKU roadmap', 'Decide product specs, cost, price, and target segment.', ['research', 'market-engine']),
      action('set-production', 'Set production run', 'Commit cash into stock before actual demand resolves.', ['asset-models/inventory', 'accounting']),
      action('launch-campaign', 'Launch campaign', 'Push domain-specific reach into the funnel.', ['customer-funnel']),
      action('discount-inventory', 'Discount inventory', 'Clear aging stock while protecting brand/margin mechanics owned by the game.', ['revenue-models/pricing', 'revenue-models/unit-sale']),
    ],
    rivalActions: [
      action('rival-launch-product', 'Launch rival product', 'Introduce an offer with real scoring and inventory constraints.', ['competition/rival-adapters', 'market-engine']),
      action('rival-cut-price', 'Cut price', 'React to excess stock or player pressure.', ['competition/rival-adapters', 'revenue-models/pricing']),
    ],
    uiSurfaces: [
      surface('product-board', 'Product board', 'SKU specs, target segments, readiness, and launch timing.', 'primary'),
      surface('inventory', 'Inventory', 'Stock, production queue, COGS, stockout/write-down risk.', 'primary'),
      surface('market', 'Market', 'Awareness, consideration, competitors, sales by region/segment.', 'primary'),
      surface('finance', 'Finance', 'Cash tied in stock, margin, working capital, solvency.', 'secondary'),
    ],
    balancingDefaults: [
      balancing('production-lead-time', 'Production lead time', '2-8 ticks', 'Forces forecasting rather than instant restocking.'),
      balancing('stockout-penalty', 'Stockout penalty', 'lost sales + future consideration friction', 'Shortages should matter without becoming permanent doom.'),
      balancing('inventory-aging', 'Inventory aging', '5-20% value decay per season', 'Tune by fashion/tech/perishability of goods.'),
    ],
    failureModes: [
      'Overproduction traps cash in unsold inventory.',
      'Underproduction creates stockouts and lost launch momentum.',
      'Rivals launch better products before inventory clears.',
      'Margin collapses under discounts or input inflation.',
    ],
    researchQuestions: [
      'What product attributes drive choice in this category?',
      'How long are production and distribution lead times?',
      'How quickly does inventory become obsolete?',
      'What segments or geographies buy first?',
    ],
    validationRules: rules('goods'),
  },
  {
    id: 'two-sided-marketplace-business',
    name: 'Two-Sided Marketplace Business',
    description: 'Platforms that must balance supply and demand instead of optimizing only one customer pool.',
    fits: ['food delivery', 'ride hailing', 'dating', 'creator platforms', 'job boards', 'B2B marketplaces'],
    tags: ['marketplace', 'two-sided', 'liquidity', 'take-rate', 'platform'],
    playerFantasy: 'Solve liquidity: bring enough of each side together at the right time and place to make the marketplace feel alive.',
    coreLoop: [
      'Acquire or activate both sides of the market.',
      'Balance supply, demand, geography, and incentives.',
      'Match transactions and track liquidity quality.',
      'Tune pricing/take-rate/subsidies against growth and margin.',
      'Let network effects and rival density reshape the next tick.',
    ],
    requiredModules: [
      'marketplace',
      'customer-funnel',
      'market-engine',
      'revenue-models/transaction',
      'market-topology/geographic',
      'competition/rival-sim',
      'competition/rival-adapters',
      'accounting',
      'save-system',
    ],
    optionalModules: ['revenue-models/pricing', 'events', 'press', 'seasonality', 'reputation'],
    stateSlices: [
      slice('demand-side', 'Buyers/riders/customers by segment and region.', ['diners', 'riders', 'employers']),
      slice('supply-side', 'Sellers/drivers/creators/workers by segment and region.', ['restaurants', 'drivers', 'creators']),
      slice('liquidity', 'Match rates, idle supply, unmet demand, wait time.', ['fill rate', 'idle couriers', 'unmatched jobs']),
      slice('unit-economics', 'Take-rate, incentives, CAC, variable cost.', ['commission', 'subsidy', 'delivery cost']),
    ],
    tickPhases: [
      phase('demand-funnel', 'Generate demand-side consideration.', ['customer-funnel']),
      phase('supply-funnel', 'Generate supply-side acquisition/activation through game-specific mechanics.', ['customer-funnel']),
      phase('market-resolution', 'Resolve visible choices where appropriate.', ['market-engine']),
      phase('matching', 'Match supply and demand and report liquidity quality.', ['marketplace']),
      phase('transactions', 'Book GMV, take-rate, fees, and costs.', ['revenue-models/transaction']),
      phase('rivals', 'Rivals enter geographies and rebalance incentives.', ['competition/rival-sim', 'competition/rival-adapters']),
      phase('accounting', 'Track subsidy burn, growth spend, and solvency.', ['accounting']),
    ],
    playerActions: [
      action('subsidize-side', 'Subsidize one side', 'Trade cash burn for liquidity improvement.', ['marketplace', 'accounting']),
      action('open-region', 'Open region', 'Expand geography where both sides can be recruited.', ['market-topology/geographic']),
      action('set-take-rate', 'Set take-rate', 'Balance platform margin against supply participation.', ['revenue-models/transaction', 'marketplace']),
      action('target-side', 'Target side', 'Choose whether scarce spend grows demand or supply.', ['customer-funnel']),
    ],
    rivalActions: [
      action('rival-subsidy', 'Subsidize market side', 'Use cash to steal liquidity.', ['competition/rival-sim', 'marketplace']),
      action('rival-enter-city', 'Enter city', 'Compete in attractive geographies.', ['competition/rival-adapters', 'market-topology/geographic']),
    ],
    uiSurfaces: [
      surface('liquidity-map', 'Liquidity map', 'Supply/demand balance, match rate, wait time by region.', 'primary'),
      surface('unit-economics', 'Unit economics', 'GMV, take-rate, incentives, contribution margin.', 'primary'),
      surface('growth', 'Growth', 'Funnel state for both sides.', 'primary'),
      surface('rivals', 'Rivals', 'Competitor density, subsidies, and market entry.', 'secondary'),
    ],
    balancingDefaults: [
      balancing('liquidity-threshold', 'Liquidity threshold', '60-75% match rate before network effects accelerate', 'Make early cold-start hard but solvable.'),
      balancing('subsidy-burn', 'Subsidy burn', 'meaningful enough to threaten runway', 'Subsidies should be a strategic debt, not free growth.'),
      balancing('take-rate-range', 'Take-rate range', '5-30%', 'Depends on marketplace category and supply power.'),
    ],
    failureModes: [
      'Demand grows without enough supply, creating bad experience.',
      'Supply grows without demand, creating idle churn and subsidy burn.',
      'Take-rate rises too early and weakens participation.',
      'Rivals use deeper cash to create local liquidity moats.',
    ],
    researchQuestions: [
      'What are the two sides, and what makes each side participate?',
      'What geography/time granularity matters for liquidity?',
      'What is the real unit economics stack?',
      'Which side is harder to acquire or retain?',
    ],
    validationRules: rules('marketplace'),
  },
  {
    id: 'regulated-expansion-business',
    name: 'Regulated Expansion Business',
    description: 'Growth constrained by licenses, permits, compliance, public trust, or political calendars.',
    fits: ['banking', 'insurance', 'healthcare', 'telecom', 'airlines', 'utilities', 'education', 'pharma'],
    tags: ['regulated', 'geographic', 'licenses', 'license', 'permits', 'slots', 'compliance', 'political', 'trust'],
    playerFantasy: 'Grow through gates: win permission, maintain trust, and avoid expansion plans collapsing under compliance reality.',
    coreLoop: [
      'Choose target regions or regulated activities.',
      'Invest in license/compliance readiness.',
      'Wait through gates, events, and political cycles.',
      'Operate only where allowed and trusted.',
      'Use approved access to feed funnel and market resolution.',
    ],
    requiredModules: [
      'market-topology/geographic',
      'events',
      'customer-funnel',
      'market-engine',
      'competition/rival-sim',
      'competition/rival-adapters',
      'accounting',
      'save-system',
    ],
    optionalModules: ['political', 'reputation', 'press', 'balance-sheet', 'asset-models/infrastructure'],
    stateSlices: [
      slice('licenses', 'Permissions, gates, expiry, and conditions.', ['route rights', 'banking license', 'spectrum permit']),
      slice('compliance', 'Readiness, audits, violations, and remediation.', ['capital compliance', 'safety audit', 'KYC readiness']),
      slice('regions', 'Entered/locked geographies and local constraints.', ['approved states', 'restricted cities']),
      slice('events', 'Regulatory and political shocks.', ['inspection', 'election', 'policy change']),
    ],
    tickPhases: [
      phase('application', 'Progress license/compliance applications.', ['market-topology/geographic', 'events']),
      phase('regulatory-events', 'Apply audits, shocks, or policy changes.', ['events', 'political']),
      phase('funnel', 'Allow awareness/consideration only where access exists.', ['customer-funnel', 'market-topology/geographic']),
      phase('market-resolution', 'Resolve demand in eligible markets.', ['market-engine']),
      phase('rivals', 'Rivals apply, enter, lobby, or retreat.', ['competition/rival-sim', 'competition/rival-adapters']),
      phase('accounting', 'Record compliance cost and delayed-entry cash pressure.', ['accounting']),
    ],
    playerActions: [
      action('apply-license', 'Apply for license', 'Spend time/cash to unlock region or activity.', ['market-topology/geographic', 'accounting']),
      action('invest-compliance', 'Invest in compliance', 'Reduce failure risk or speed approval.', ['events', 'accounting']),
      action('pause-market', 'Pause risky market', 'Preserve solvency/trust while fixing readiness.', ['events', 'accounting']),
      action('respond-regulator', 'Respond to regulator', 'Choose cost/time/reputation consequences from events.', ['events']),
    ],
    rivalActions: [
      action('rival-apply', 'Apply for market access', 'Contest future region access.', ['competition/rival-adapters', 'market-topology/geographic']),
      action('rival-retreat', 'Retreat from market', 'Exit where regulatory/economic pressure is too high.', ['competition/rival-sim']),
    ],
    uiSurfaces: [
      surface('regulatory-map', 'Regulatory map', 'Regions, license status, gates, and opportunities.', 'primary'),
      surface('compliance', 'Compliance', 'Readiness, audits, incidents, deadlines.', 'primary'),
      surface('market', 'Market', 'Eligible demand and rivals by approved region.', 'secondary'),
      surface('finance', 'Finance', 'Cost of delay, compliance spend, solvency.', 'secondary'),
    ],
    balancingDefaults: [
      balancing('approval-time', 'Approval time', '1-8 quarters', 'Long enough to make sequencing meaningful.'),
      balancing('compliance-cost', 'Compliance cost', 'fixed + scaling with complexity', 'Avoid free expansion into high-value regions.'),
      balancing('event-frequency', 'Regulatory events', 'rare but consequential', 'Too frequent feels arbitrary; too rare feels decorative.'),
    ],
    failureModes: [
      'Expansion spend is locked up before approvals arrive.',
      'Compliance failures block lucrative markets.',
      'Rivals gain licenses first.',
      'A policy shock changes the economics of a region.',
    ],
    researchQuestions: [
      'What permissions are real blockers in this industry?',
      'Who grants approval and how long does it take?',
      'What operating metrics trigger penalties or shutdowns?',
      'How do incumbents defend regulated access?',
    ],
    validationRules: rules('regulated'),
  },
  {
    id: 'asset-liability-finance-business',
    name: 'Asset-Liability Finance Business',
    description: 'Balance-sheet businesses where growth creates solvency, duration, spread, and shock risk.',
    fits: ['banks', 'insurers', 'lenders', 'REITs', 'fintech balance-sheet businesses', 'leasing companies'],
    tags: ['finance', 'balance-sheet', 'spread', 'solvency', 'risk', 'regulated'],
    playerFantasy: 'Grow the balance sheet without letting liquidity, capital ratio, duration, or bad assets break the institution.',
    coreLoop: [
      'Acquire funding/liabilities and originate assets.',
      'Price products to attract customers while preserving spread.',
      'Monitor capital, liquidity, credit/duration risk, and shocks.',
      'Allocate capital toward risk-adjusted growth.',
      'Survive stress while rivals chase yield or deposits.',
    ],
    requiredModules: [
      'balance-sheet',
      'accounting',
      'customer-funnel',
      'market-engine',
      'market-topology/geographic',
      'competition/rival-sim',
      'competition/rival-adapters',
      'events',
      'save-system',
    ],
    optionalModules: ['political', 'reputation', 'press', 'revenue-models/pricing', 'financial'],
    stateSlices: [
      slice('assets', 'Loans, securities, properties, policies, or leased assets.', ['mortgages', 'bonds', 'leases']),
      slice('liabilities', 'Deposits, claims, debt, funding lines.', ['retail deposits', 'insurance reserves']),
      slice('risk', 'Capital ratio, duration gap, credit loss, liquidity.', ['RWA', 'LCR', 'duration gap']),
      slice('products', 'Customer-facing rates/products.', ['deposit account', 'loan product', 'policy']),
    ],
    tickPhases: [
      phase('funnel', 'Create customer consideration for financial products.', ['customer-funnel']),
      phase('market-resolution', 'Resolve deposits/loans/policies against rival offers.', ['market-engine']),
      phase('balance-sheet-accrual', 'Accrue yields, expenses, losses, and capital ratios.', ['balance-sheet']),
      phase('stress-events', 'Apply credit, liquidity, duration, or regulatory shocks.', ['events', 'balance-sheet']),
      phase('rivals', 'Rivals price products and manage capital pressure.', ['competition/rival-sim', 'competition/rival-adapters']),
      phase('accounting', 'Convert spread/risk outcomes into statements and solvency.', ['accounting']),
    ],
    playerActions: [
      action('set-rates', 'Set rates/prices', 'Balance growth against spread and risk.', ['revenue-models/pricing', 'market-engine']),
      action('allocate-assets', 'Allocate assets', 'Choose risk/return mix.', ['balance-sheet']),
      action('raise-capital', 'Raise capital', 'Protect solvency at dilution or cost.', ['accounting']),
      action('tighten-risk', 'Tighten underwriting/risk', 'Trade growth for resilience.', ['balance-sheet']),
    ],
    rivalActions: [
      action('rival-rate-war', 'Rate war', 'Compete for deposits/borrowers through price.', ['competition/rival-adapters', 'market-engine']),
      action('rival-delever', 'Delever', 'Shrink or restructure under capital pressure.', ['competition/rival-sim', 'balance-sheet']),
    ],
    uiSurfaces: [
      surface('balance-sheet', 'Balance sheet', 'Assets, liabilities, equity, risk-weighted assets.', 'primary'),
      surface('market', 'Product market', 'Customer consideration and rival financial products.', 'primary'),
      surface('risk', 'Risk', 'Stress tests, duration, capital, liquidity.', 'primary'),
      surface('finance', 'Statements', 'Accounting, solvency, funding, dilution.', 'secondary'),
    ],
    balancingDefaults: [
      balancing('capital-buffer', 'Capital buffer', '10-15% target capital ratio', 'Tune to genre realism and desired stress level.'),
      balancing('spread-margin', 'Net spread', '1-5%', 'Small changes should matter at scale.'),
      balancing('stress-frequency', 'Stress shocks', 'low frequency, high impact', 'Finance games need legible tail risk.'),
    ],
    failureModes: [
      'Growth consumes capital faster than earnings build it.',
      'Funding costs rise faster than asset yields.',
      'A stress event exposes duration or credit risk.',
      'Regulatory capital breach forces dilution or shrinkage.',
    ],
    researchQuestions: [
      'What are the main assets and liabilities?',
      'What spreads, durations, and capital rules define the business?',
      'What customer products create balance-sheet growth?',
      'What real shocks have historically broken operators?',
    ],
    validationRules: rules('finance'),
  },
  {
    id: 'pipeline-r-and-d-business',
    name: 'Pipeline/R&D Business',
    description: 'Uncertain projects consume cash through gates before producing hits, approvals, or valuable rights.',
    fits: ['pharma', 'biotech', 'aerospace', 'deep tech', 'film studio', 'game studio', 'real estate development'],
    tags: ['pipeline', 'research', 'uncertainty', 'slate', 'rights', 'hits'],
    playerFantasy: 'Build a portfolio of uncertain bets, keep enough cash alive, and turn rare successes into durable advantage.',
    coreLoop: [
      'Choose projects and allocate scarce teams/capital.',
      'Advance projects through probabilistic gates.',
      'Convert successes into products, rights, or market offers.',
      'Use funnel and market-engine only after something reaches the market.',
      'Recycle cash from hits into the next portfolio.',
    ],
    requiredModules: [
      'pipeline',
      'research',
      'accounting',
      'customer-funnel',
      'market-engine',
      'competition/rival-sim',
      'competition/rival-adapters',
      'events',
      'save-system',
    ],
    optionalModules: ['content-slate', 'asset-models/rights', 'revenue-models/unit-sale', 'revenue-models/subscription', 'press', 'political'],
    stateSlices: [
      slice('projects', 'Pipeline projects, stage, probability, cost, and expected value.', ['Phase II drug', 'prototype aircraft', 'film slate']),
      slice('teams', 'Research capacity and specialization.', ['scientists', 'engineers', 'creative teams']),
      slice('rights-products', 'Successful assets that can earn or compete.', ['approved drug', 'movie rights', 'patent']),
      slice('capital-plan', 'Cash burn, financing, and milestone funding.', ['grant', 'equity round', 'partner payment']),
    ],
    tickPhases: [
      phase('project-selection', 'Start or cancel projects.', ['pipeline', 'research']),
      phase('pipeline-progress', 'Advance probabilistic gates and spend budget.', ['pipeline', 'accounting']),
      phase('events', 'Apply trial, regulatory, creative, or technical shocks.', ['events']),
      phase('commercialization', 'Turn successful projects into offers/rights/revenue models.', ['market-engine', 'asset-models/rights']),
      phase('funnel', 'Build pre-market awareness for launched successes.', ['customer-funnel']),
      phase('market-resolution', 'Resolve demand for commercialized products.', ['market-engine']),
      phase('accounting', 'Track burn, funding, capex, revenue, and solvency.', ['accounting']),
    ],
    playerActions: [
      action('start-project', 'Start project', 'Commit cash and capacity to a new bet.', ['pipeline', 'accounting']),
      action('fund-stage', 'Fund stage', 'Advance a project gate at cost and risk.', ['pipeline']),
      action('license-rights', 'License rights', 'Monetize success without operating the full market.', ['asset-models/rights', 'accounting']),
      action('kill-project', 'Kill project', 'Stop bad money from following bad odds.', ['pipeline', 'accounting']),
    ],
    rivalActions: [
      action('rival-start-project', 'Start competing project', 'Contest future markets before demand exists.', ['competition/rival-sim', 'pipeline']),
      action('rival-license', 'License or acquire', 'Convert cash into pipeline shortcuts.', ['competition/rival-adapters', 'asset-models/rights']),
    ],
    uiSurfaces: [
      surface('pipeline', 'Pipeline board', 'Stages, odds, cost, blockers, and expected value.', 'primary'),
      surface('portfolio', 'Portfolio', 'Risk mix, funding runway, concentration.', 'primary'),
      surface('commercial', 'Commercialization', 'Launched products, rights, market demand.', 'secondary'),
      surface('finance', 'Finance', 'Burn, funding, solvency, milestone payments.', 'primary'),
    ],
    balancingDefaults: [
      balancing('success-rate', 'Gate success rate', '5-60% by stage', 'Early gates can be forgiving; late gates should be expensive.'),
      balancing('portfolio-size', 'Viable portfolio size', '3-8 active bets', 'Enough diversification without spreadsheet overload.'),
      balancing('time-to-hit', 'Time to hit', '4-16 ticks', 'Players need meaningful waiting without dead turns.'),
    ],
    failureModes: [
      'Pipeline burns cash before any project pays off.',
      'Portfolio is too concentrated and one failure ends the run.',
      'Rivals commercialize first.',
      'A promising project passes gates but cannot find a market.',
    ],
    researchQuestions: [
      'What are the real project stages and probabilities?',
      'What costs are committed at each gate?',
      'How do successes monetize: direct sales, subscriptions, licensing, rights?',
      'What external approvals or events can reset the odds?',
    ],
    validationRules: rules('pipeline'),
  },
] as const;

export const GAME_BLUEPRINT_PRIMITIVES_BY_ID: Readonly<Record<BlueprintPrimitiveId, GameBlueprintPrimitive>> =
  Object.freeze(GAME_BLUEPRINT_PRIMITIVES.reduce((record, primitive) => {
    record[primitive.id] = primitive;
    return record;
  }, {} as Record<BlueprintPrimitiveId, GameBlueprintPrimitive>));

export function getBlueprintPrimitive(id: BlueprintPrimitiveId): GameBlueprintPrimitive {
  return GAME_BLUEPRINT_PRIMITIVES_BY_ID[id];
}

export function selectBlueprintPrimitives(input: BlueprintSelectionInput): BlueprintPrimitiveMatch[] {
  const haystack = [
    input.idea,
    input.audience ?? '',
    input.platform ?? '',
    ...(input.desiredTags ?? []),
    ...(input.requiredModules ?? []),
  ].join(' ').toLowerCase();

  return GAME_BLUEPRINT_PRIMITIVES
    .map(primitive => {
      const reasons: string[] = [];
      let score = 0;
      for (const tag of primitive.tags) {
        if (matchesTerm(haystack, tag)) {
          score += 3;
          reasons.push(`tag:${tag}`);
        }
      }
      for (const fit of primitive.fits) {
        if (matchesTerm(haystack, fit)) {
          score += 4;
          reasons.push(`fit:${fit}`);
        }
      }
      for (const moduleId of input.requiredModules ?? []) {
        if (primitive.requiredModules.includes(moduleId) || primitive.optionalModules.includes(moduleId)) {
          score += 2;
          reasons.push(`module:${moduleId}`);
        }
      }
      return { primitive, score, reasons };
    })
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score || a.primitive.name.localeCompare(b.primitive.name));
}

export function composeGameBlueprint(input: ComposeBlueprintInput): GameBlueprint {
  const primitives = input.primitiveIds.map(getBlueprintPrimitive);
  const requiredModules = unique([
    ...CORE_MODULES,
    ...DEFAULT_FOUNDATION_MODULES,
    ...primitives.flatMap(primitive => primitive.requiredModules),
    ...(input.extraModules ?? []),
  ]);
  const optionalModules = unique(primitives.flatMap(primitive => primitive.optionalModules))
    .filter(moduleId => !requiredModules.includes(moduleId));
  const domainFocus = input.domainFocus?.length ? input.domainFocus.join(', ') : input.idea;

  return {
    id: input.id ?? slugify(input.title),
    title: input.title,
    idea: input.idea,
    audience: input.audience,
    platform: input.platform,
    primitiveIds: input.primitiveIds,
    playerFantasy: primitives.length === 1
      ? primitives[0].playerFantasy
      : `A ${domainFocus} tycoon that combines ${primitives.map(primitive => primitive.name).join(' + ')}.`,
    coreLoop: unique(primitives.flatMap(primitive => primitive.coreLoop)),
    modules: { required: requiredModules, optional: optionalModules },
    stateSlices: mergeById(primitives.flatMap(primitive => primitive.stateSlices)),
    tickPhases: mergeById(primitives.flatMap(primitive => primitive.tickPhases)),
    playerActions: mergeById(primitives.flatMap(primitive => primitive.playerActions)),
    rivalActions: mergeById(primitives.flatMap(primitive => primitive.rivalActions)),
    uiSurfaces: prioritizeSurfaces(mergeById(primitives.flatMap(primitive => primitive.uiSurfaces))),
    balancingDefaults: mergeById(primitives.flatMap(primitive => primitive.balancingDefaults)),
    failureModes: unique(primitives.flatMap(primitive => primitive.failureModes)),
    researchQuestions: unique([
      `Who is the exact audience for ${input.title}, and what fantasy should the first session deliver?`,
      `What platform constraints matter on ${input.platform}?`,
      ...primitives.flatMap(primitive => primitive.researchQuestions),
    ]),
    validationRules: mergeById(primitives.flatMap(primitive => primitive.validationRules)),
    firstSessionGoal: input.firstSessionGoal,
    generatorNotes: [
      'Use research to specialize names, constants, content, and domain drivers; do not hard-code demand or brand.',
      'Keep TycoonOS modules as the internals and generated game code as thin composition glue.',
      'Run validation before generating UI or balancing numbers.',
    ],
  };
}

export function validateGameBlueprint(blueprint: GameBlueprint): BlueprintValidationResult {
  const issues: BlueprintValidationIssue[] = [];
  const modules = new Set(blueprint.modules.required);

  requireModule(modules, issues, 'save-system', 'save-load', 'Every generated game needs versioned save/load.');
  requireModule(modules, issues, 'customer-funnel', 'pre-market-funnel', 'Demand should pass through awareness/consideration before market resolution.');
  requireModule(modules, issues, 'market-engine', 'market-resolution', 'Customer choice among visible offers needs a market resolver.');
  requireAnyModule(modules, issues, [
    'revenue-models/subscription',
    'revenue-models/transaction',
    'revenue-models/unit-sale',
    'marketplace',
    'balance-sheet',
    'asset-models/rights',
  ], 'money-loop', 'Blueprint needs a clear money loop.');
  requireAnyModule(modules, issues, ['competition/rival-sim', 'competition/rival-adapters'], 'rivals', 'Rivals should be simulated, not decorative.');
  if (!modules.has('accounting') && !modules.has('financial')) {
    issues.push(issue('finance-layer', 'warning', 'Blueprint should include accounting or financial for cash/runway pressure.'));
  }
  if (blueprint.uiSurfaces.filter(surface => surface.priority === 'primary').length < 3) {
    issues.push(issue('ui-surfaces', 'warning', 'Blueprint should define at least three primary UI surfaces.'));
  }
  if (blueprint.playerActions.length < 4) {
    issues.push(issue('player-actions', 'warning', 'Blueprint should expose at least four meaningful player actions.'));
  }
  if (blueprint.failureModes.length < 3) {
    issues.push(issue('failure-modes', 'warning', 'Blueprint needs real failure modes so the sim has teeth.'));
  }
  if (!blueprint.firstSessionGoal) {
    issues.push(issue('first-session-goal', 'info', 'Add a first-session goal before generating a full game.'));
  }

  return {
    ok: !issues.some(item => item.severity === 'error'),
    issues,
  };
}

export function modulesForPrimitive(id: BlueprintPrimitiveId): readonly BlueprintModuleId[] {
  const primitive = getBlueprintPrimitive(id);
  return unique([...primitive.requiredModules, ...primitive.optionalModules]);
}

function rules(prefix: string): readonly BlueprintValidationRule[] {
  return [
    { id: `${prefix}:money-loop`, label: 'Has a money loop', severity: 'error' },
    { id: `${prefix}:demand-loop`, label: 'Has a demand loop before sales', severity: 'error' },
    { id: `${prefix}:rival-loop`, label: 'Rivals participate through simulation', severity: 'warning' },
    { id: `${prefix}:first-session`, label: 'Has a legible first-session goal', severity: 'info' },
  ];
}

function slice(id: BlueprintId, purpose: string, examples: readonly string[]): BlueprintStateSlice {
  return { id, purpose, examples };
}

function phase(id: BlueprintId, purpose: string, modules: readonly BlueprintModuleId[]): BlueprintTickPhase {
  return { id, purpose, modules };
}

function action(id: BlueprintId, label: string, purpose: string, modules: readonly BlueprintModuleId[]): BlueprintAction {
  return { id, label, purpose, modules };
}

function surface(id: BlueprintId, label: string, purpose: string, priority: BlueprintUiSurface['priority']): BlueprintUiSurface {
  return { id, label, purpose, priority };
}

function balancing(id: BlueprintId, purpose: string, starterValue: string, tuningNotes: string): BlueprintBalancingDefault {
  return { id, purpose, starterValue, tuningNotes };
}

function requireModule(
  modules: ReadonlySet<BlueprintModuleId>,
  issues: BlueprintValidationIssue[],
  moduleId: BlueprintModuleId,
  ruleId: BlueprintId,
  message: string,
): void {
  if (!modules.has(moduleId)) issues.push(issue(ruleId, 'error', message));
}

function requireAnyModule(
  modules: ReadonlySet<BlueprintModuleId>,
  issues: BlueprintValidationIssue[],
  moduleIds: readonly BlueprintModuleId[],
  ruleId: BlueprintId,
  message: string,
): void {
  if (!moduleIds.some(moduleId => modules.has(moduleId))) issues.push(issue(ruleId, 'error', message));
}

function issue(ruleId: BlueprintId, severity: BlueprintSeverity, message: string): BlueprintValidationIssue {
  return { ruleId, severity, message };
}

function mergeById<T extends { id: BlueprintId }>(items: readonly T[]): T[] {
  const merged = new Map<BlueprintId, T>();
  for (const item of items) {
    if (!merged.has(item.id)) merged.set(item.id, item);
  }
  return Array.from(merged.values());
}

function prioritizeSurfaces(surfaces: readonly BlueprintUiSurface[]): BlueprintUiSurface[] {
  const weight: Record<BlueprintUiSurface['priority'], number> = { primary: 0, secondary: 1, debug: 2 };
  return [...surfaces].sort((a, b) => weight[a.priority] - weight[b.priority] || a.label.localeCompare(b.label));
}

function unique<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function matchesTerm(haystack: string, term: string): boolean {
  const normalized = term.toLowerCase();
  const variants = normalized.endsWith('s') ? [normalized, normalized.slice(0, -1)] : [normalized, `${normalized}s`];
  return variants.some(variant => new RegExp(`(^|[^a-z0-9])${escapeRegExp(variant)}([^a-z0-9]|$)`).test(haystack));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugify(value: string): BlueprintId {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'game-blueprint';
}
