// ─── Types ──────────────────────────────────────────────────
export type {
  GameConfig, ConfigValues,
  GameSpeed, GameClock, ClockTickResult,
  FinancialState, ValuationInputs, ValuationParams, BankruptcyStatus, FundraisingResult,
  SegmentState, SegmentGrowthParams, MarketProduct, StickinessParams,
  NodeStatus, ResearchNodeDef, ResearchNodeState, ResearchState, UnlockResult,
  TierEconomics, ChurnParams, AdRevenueParams,
  CompetitorState, CompetitorArchetype,
  HeadlineCandidate, NewspaperEdition, NewspaperState,
  ScoringDimension, EndGameScore,
  HistorySnapshot,
  BaseGameState,
} from './types/index.js';

export { defineGameConfig } from './types/config.js';

// ─── Clock ──────────────────────────────────────────────────
export {
  advanceClock, createClock,
  DAYS_PER_WEEK, WEEKS_PER_QUARTER, QUARTERS_PER_YEAR,
  DAYS_PER_QUARTER, DAYS_PER_YEAR, DAYS_PER_MONTH,
} from './clock/index.js';

// ─── Financial ──────────────────────────────────────────────
export {
  applyDailyFinances, calculateValuation, checkBankruptcy,
  raiseFunding, calculateRunway, createFinancialState,
} from './financial/index.js';

// ─── Accounting ─────────────────────────────────────────────
export {
  createAccountingState,
  purchaseCapitalAsset,
  raiseDebt,
  raiseEquity,
  depreciateAssets,
  serviceDebt,
  applyAccountingPeriod,
  accountingBalanceSheet,
  totalAssetBookValue,
  totalDebtOutstanding,
  nextDebtServiceDue,
  checkAccountingSolvency,
} from './accounting/index.js';
export type {
  AccountingAssetStatus, SolvencyStatus,
  AccountingAsset, DebtInstrument, EquityRound,
  AccountingState, CapitalPurchaseInput, DebtRaiseInput,
  EquityRaiseInput, DebtServiceResult, EquityRaiseResult,
  IncomeStatement, CashflowStatement, AccountingBalanceSheet,
  AccountingStatement, AccountingPeriodInput,
  SolvencyCheckOptions, SolvencyCheckResult,
} from './accounting/index.js';

// ─── Segmented Market Topology ──────────────────────────────
export {
  calculateTargetShares, aggregateShares,
  blendShares,
  growSegment, tickSegments, getAddressableUsers, createSegment,
} from './market-topology/segmented/index.js';

// ─── Market Engine ─────────────────────────────────────────
export {
  resolveMarket,
  resolveMarketPool,
  ownerServedShares,
  offerServedShares,
} from './market-engine/index.js';
export type {
  MarketId,
  MarketGateResult,
  MarketScore,
  MarketScoreResult,
  MarketOffer,
  MarketPool,
  MarketEngineOptions,
  MarketOfferEvaluation,
  MarketAllocation,
  MarketDemandSummary,
  MarketPoolResult,
  MarketResult,
} from './market-engine/index.js';

// ─── Customer Funnel ──────────────────────────────────────
export {
  createFunnelCohort,
  createFunnelState,
  runFunnelPhase,
  summarizeFunnelAudiences,
  createFunnelMarketPools,
  funnelCohortId,
  funnelAudienceId,
} from './customer-funnel/index.js';
export type {
  FunnelId,
  FunnelCohort,
  FunnelState,
  CreateFunnelCohortInput,
  CreateFunnelStateInput,
  FunnelTarget,
  FunnelActivity,
  ConsiderationDriver,
  FunnelPhaseOptions,
  FunnelPhaseInput,
  FunnelCohortDelta,
  FunnelAudienceSummary,
  FunnelPhaseResult,
  FunnelMarketPoolConfig,
} from './customer-funnel/index.js';

// ─── Game Blueprints ──────────────────────────────────────
export {
  GAME_BLUEPRINT_PRIMITIVES,
  GAME_BLUEPRINT_PRIMITIVES_BY_ID,
  getBlueprintPrimitive,
  selectBlueprintPrimitives,
  composeGameBlueprint,
  validateGameBlueprint,
  modulesForPrimitive,
} from './game-blueprints/index.js';
export type {
  BlueprintId,
  BlueprintSeverity,
  BlueprintPrimitiveId,
  BlueprintModuleId,
  BlueprintStateSlice,
  BlueprintTickPhase,
  BlueprintAction,
  BlueprintUiSurface,
  BlueprintBalancingDefault,
  BlueprintValidationRule,
  GameBlueprintPrimitive,
  BlueprintSelectionInput,
  BlueprintPrimitiveMatch,
  ComposeBlueprintInput,
  GameBlueprint,
  BlueprintValidationIssue,
  BlueprintValidationResult,
} from './game-blueprints/index.js';

// ─── Game Generator ───────────────────────────────────────
export {
  createGameSkeleton,
  createFileTree,
  createSavePlan,
} from './game-generator/index.js';
export type {
  GeneratedFileKind,
  GameSkeletonOptions,
  GeneratedFileSpec,
  GeneratedStateField,
  GeneratedStateSlice,
  GeneratedTickPhase,
  GeneratedAction,
  GeneratedRivalBehavior,
  GeneratedScreen,
  GeneratedStarterDataSet,
  GeneratedSavePlan,
  GeneratedAcceptanceCheck,
  GameSkeleton,
} from './game-generator/index.js';

// ─── Simulation Harness ───────────────────────────────────
export {
  runSimulation,
  createNumericProbe,
  finiteMetricInvariant,
  nonNegativeMetricInvariant,
  rangeMetricInvariant,
  trendProbeDelta,
} from './sim-harness/index.js';
export type {
  SimSeverity,
  SimContext,
  SimTickFn,
  SimProbe,
  SimInvariant,
  SimSnapshot,
  SimIssue,
  RunSimulationInput,
  SimulationResult,
  NumericProbeOptions,
} from './sim-harness/index.js';

// ─── Integration Recipes ──────────────────────────────────
export {
  INTEGRATION_RECIPES,
  INTEGRATION_RECIPES_BY_ID,
  getIntegrationRecipe,
  selectIntegrationRecipesForModules,
  createBlueprintIntegrationPlan,
  validateBlueprintIntegrations,
} from './integration-recipes/index.js';
export type {
  IntegrationRecipeId,
  IntegrationEndpoint,
  IntegrationStep,
  IntegrationRecipe,
  IntegrationSelection,
  IntegrationValidationIssue,
  BlueprintIntegrationPlan,
} from './integration-recipes/index.js';

// ─── UI Blueprints ────────────────────────────────────────
export {
  UI_PRIMITIVES,
  createUiGenerationPlan,
  matchUiPrimitive,
} from './ui-blueprints/index.js';
export type {
  UiPrimitiveId,
  UiControlKind,
  UiDensity,
  UiKpiSpec,
  UiControlSpec,
  UiSectionSpec,
  UiPrimitive,
  UiPlanScreen,
  UiNavigationItem,
  UiGenerationPlan,
} from './ui-blueprints/index.js';

// ─── Research Blueprint ───────────────────────────────────
export {
  RESEARCH_BLUEPRINT_CHECKLIST,
  createResearchChecklist,
  synthesizeResearchBlueprint,
  composeBlueprintFromResearch,
  validateResearchBrief,
  findingsFor,
  createResearchFinding,
} from './research-blueprint/index.js';
export type {
  ResearchConfidence,
  ResearchSectionId,
  ResearchSourceNote,
  ResearchFinding,
  ResearchBlueprintBrief,
  ResearchChecklistItem,
  ResearchGap,
  ResearchBlueprintSynthesis,
} from './research-blueprint/index.js';

// ─── Research ───────────────────────────────────────────────
export {
  initializeTree, unlockAvailableNodes, unlockNode,
  getCompletedNodes, getTreeCompletion,
} from './research/index.js';

// ─── Product ────────────────────────────────────────────────
export {
  calculateSubscriptionRevenue, calculateAdRevenue,
  applyChurn, distributeTierUsers, createTier,
} from './product/index.js';

// ─── Competitor ─────────────────────────────────────────────
export {
  tickCompetitorFinances, calculateCompetitorPrice, createCompetitor,
} from './competitor/index.js';

// ─── Infrastructure ─────────────────────────────────────────
export {
  interpolatePriceCurve, getSpotPrice, DEFAULT_PRICE_CURVE,
  signContract, expireContracts, getActiveContractCapacity,
} from './infrastructure/index.js';
export type { InfraContract } from './infrastructure/index.js';

// ─── Network Topology ──────────────────────────────────────
export {
  computeUsableCapacity, allocateNetworkCapacity,
  normalizeNetworkWeights, networkHeadroomTarget,
} from './market-topology/network/index.js';
export type {
  UsableCapacityInput, UsableCapacityResult,
  NetworkSink, NetworkSinkAllocation, NetworkAllocationResult,
} from './market-topology/network/index.js';

// ─── Pricing Economics ─────────────────────────────────────
export {
  clampPrice, recurringPriceDemandFactor, upfrontPriceDemandFactor,
  recurringPriceChurnPenalty, unitMargin, unitMarginPct,
} from './revenue-models/pricing/index.js';
export type {
  PriceBounds, RecurringPriceDemandInput, UpfrontPriceDemandInput,
  ChurnPenaltyInput, UnitEconomicsInput,
} from './revenue-models/pricing/index.js';

// ─── Competitor Company Simulation ─────────────────────────
export {
  createCompany, tickCompany, applyCompanyInvestment, companyRunwayTicks,
} from './competition/company-sim/index.js';
export type {
  CompanyStatus, CompanyOperatingLine, CompanyLineResult,
  CompanyTickSummary, CompanySimState, CreateCompanyInput,
  TickCompanyOptions, CompanyInvestment,
} from './competition/company-sim/index.js';

// ─── Rival Simulation ──────────────────────────────────────
export {
  RIVAL_STRATEGIES,
  createRival,
  tickRivals,
  logRivalAction,
  shouldTakeRivalAction,
} from './competition/rival-sim/index.js';
export type {
  RivalDecisionCadence, RivalHealth, RivalActionKind,
  RivalStrategy, RivalEconomicsSnapshot, RivalAction,
  RivalDecisionContext, RivalPressure, RivalDecision,
  RivalSimState, CreateRivalInput, RivalSimOptions,
  RivalHealthOptions, RivalSimTickSummary,
} from './competition/rival-sim/index.js';

export {
  buildRivalOffers,
  computeRivalEconomicsFromMarket,
  computeRivalPrice,
  createPricingDecision,
  createCapacityInvestmentDecision,
  createFundingDecision,
  createMarketEntryDecision,
  simpleRivalOperatingModel,
  capitalRatioPressure,
} from './competition/rival-adapters/index.js';
export type {
  RivalPricingPolicy,
  RivalOfferTemplate,
  BuildRivalOffersConfig,
  RivalMarketEconomicsConfig,
  RivalPricingInput,
  RivalPricingDecisionConfig,
  RivalCapacityInvestmentConfig,
  RivalFundingDecisionConfig,
  RivalMarketEntryDecisionConfig,
  SimpleRivalOperatingModelConfig,
} from './competition/rival-adapters/index.js';

// ─── Asset Economics ───────────────────────────────────────
export {
  computeRightsIncome, combineRightsIncome, emptyRightsIncomeSummary,
} from './asset-models/rights/index.js';
export type {
  RightsUsageLine, RightsAssetAggregate, RightsIncomeSummary,
} from './asset-models/rights/index.js';

export {
  createFleetState,
  addFleetUnits,
  retireFleetUnit,
  fleetAvailableCapacity,
  fleetBookValue,
  fleetUtilization,
  assignFleetCapacity,
  tickFleet,
  fleetResetPhase,
  resetFleetTick,
} from './asset-models/fleet/index.js';
export type {
  FleetUnitStatus, FleetAssetDef, FleetUnit, FleetState,
  AddFleetUnitsInput, FleetTickOptions, FleetAssignment,
  FleetAssignmentResult,
} from './asset-models/fleet/index.js';

export {
  createInfrastructureState,
  buildInfrastructure,
  retireInfrastructure,
  infrastructureCapacity,
  infrastructureBookValue,
  repairInfrastructure,
  tickInfrastructure,
  infrastructureResetPhase,
  resetInfrastructureTick,
} from './asset-models/infrastructure/index.js';
export type {
  InfrastructureStatus, InfrastructureAssetDef, InfrastructureAsset,
  InfrastructureState, BuildInfrastructureInput, InfrastructureTickOptions,
} from './asset-models/infrastructure/index.js';

// ─── Transaction + Marketplace Economics ───────────────────
export {
  createTransactionState,
  recordTransaction,
  recordTransactions,
  resetTransactionTick,
  transactionResetPhase,
  transactionSummary,
  lastTickTransactionSummary,
  transactionGrossProfit,
  transactionGrossMargin,
} from './revenue-models/transaction/index.js';
export type {
  TransactionInput, TransactionAggregate,
  TransactionState, TransactionSummary,
} from './revenue-models/transaction/index.js';

export {
  matchMarketplace,
  marketplaceLiquidityScore,
  twoSidedBalance,
  networkEffectMultiplier,
  marketplaceTakeRateRevenue,
} from './marketplace/index.js';
export type {
  MarketplaceSide, MarketplaceMatchInput, MarketplaceMatchResult,
} from './marketplace/index.js';

// ─── Balance Sheet Economics ───────────────────────────────
export {
  createBalanceSheet,
  addBalanceSheetAsset,
  addBalanceSheetLiability,
  totalBalanceSheetAssets,
  totalBalanceSheetLiabilities,
  balanceSheetEquity,
  riskWeightedAssets,
  balanceSheetSnapshot,
  applyBalanceSheetAccrual,
  stressBalanceSheet,
  annualAssetYield,
  annualLiabilityExpense,
} from './balance-sheet/index.js';
export type {
  BalanceSheetAsset, BalanceSheetLiability, BalanceSheetState,
  BalanceSheetSnapshot, BalanceSheetStressScenario,
  BalanceSheetStressResult,
} from './balance-sheet/index.js';

// ─── Newspaper ──────────────────────────────────────────────
export {
  generateNewspaper, createEdition, createNewspaperState,
} from './newspaper/index.js';
export type { HeadlineCollector } from './newspaper/index.js';

// ─── Scoring ────────────────────────────────────────────────
export {
  calculateEndGameScore, assignArchetype,
} from './scoring/index.js';

// ─── Tick Composition ───────────────────────────────────────
export {
  composeTick, createTickContext,
  clockPhase, financialPhase, quarterlyPausePhase, historyPhase,
} from './tick/index.js';
export type { TickPhase, TickContext, TickResult } from './tick/index.js';

// ─── Utils ──────────────────────────────────────────────────
export {
  clamp, lerp, interpolateCurve, softmax,
  formatNumber, formatMoney, formatUsers, formatDay, formatPercent,
} from './utils/index.js';

// ─── Save System ───────────────────────────────────────────
export {
  createSaveSystem,
  createSaveEnvelope,
  isSaveEnvelope,
  migrateSaveEnvelope,
  createLocalStorageAdapter,
} from './save-system/index.js';
export type {
  SaveStorage, SaveEnvelope, SaveMigration,
  SaveSlotRecord, SaveSummaryContext, SaveSystemConfig,
  SaveOptions, ManualSaveOptions, LoadSaveFailureReason,
  LoadSaveResult, SaveSystem,
} from './save-system/index.js';
