// TycoonOS — Simulation Harness
// Headless tick-runner for generated games and engine integrations.

export type SimSeverity = 'info' | 'warning' | 'error';

export interface SimContext {
  tick: number;
  elapsedTicks: number;
}

export type SimTickFn<TState> = (state: TState, context: SimContext) => TState | void;

export interface SimProbe<TState> {
  id: string;
  label?: string;
  read: (state: TState, context: SimContext) => number | boolean | string | null | undefined;
}

export interface SimInvariant<TState> {
  id: string;
  severity: SimSeverity;
  message: string;
  check: (state: TState, snapshot: SimSnapshot, context: SimContext) => boolean;
}

export interface SimSnapshot {
  tick: number;
  metrics: Record<string, number | boolean | string | null>;
}

export interface SimIssue {
  tick: number;
  invariantId: string;
  severity: SimSeverity;
  message: string;
}

export interface RunSimulationInput<TState> {
  initialState: TState;
  ticks: number;
  tick: SimTickFn<TState>;
  probes?: readonly SimProbe<TState>[];
  invariants?: readonly SimInvariant<TState>[];
  cloneState?: (state: TState) => TState;
  stopOnError?: boolean;
  captureEvery?: number;
}

export interface SimulationResult<TState> {
  ok: boolean;
  ticksRun: number;
  finalState: TState;
  snapshots: readonly SimSnapshot[];
  issues: readonly SimIssue[];
  summary: {
    errors: number;
    warnings: number;
    firstErrorTick: number | null;
  };
}

export interface NumericProbeOptions<TState> {
  id: string;
  label?: string;
  read: (state: TState, context: SimContext) => number;
  min?: number;
  max?: number;
  finite?: boolean;
}

export function runSimulation<TState>(input: RunSimulationInput<TState>): SimulationResult<TState> {
  const captureEvery = Math.max(1, input.captureEvery ?? 1);
  let state = input.cloneState ? input.cloneState(input.initialState) : input.initialState;
  const snapshots: SimSnapshot[] = [];
  const issues: SimIssue[] = [];
  let ticksRun = 0;

  for (let tick = 0; tick <= Math.max(0, input.ticks); tick += 1) {
    const context: SimContext = { tick, elapsedTicks: tick };
    const snapshot = readSnapshot(state, context, input.probes ?? []);
    if (tick % captureEvery === 0 || tick === input.ticks) snapshots.push(snapshot);
    collectInvariantIssues(state, snapshot, context, input.invariants ?? [], issues);
    if (input.stopOnError !== false && issues.some(issue => issue.severity === 'error')) {
      return finish(state, snapshots, issues, ticksRun);
    }
    if (tick === input.ticks) break;
    const maybeState = input.tick(state, context);
    if (maybeState !== undefined) state = maybeState;
    ticksRun += 1;
  }

  return finish(state, snapshots, issues, ticksRun);
}

export function createNumericProbe<TState>(options: NumericProbeOptions<TState>): SimProbe<TState> {
  return {
    id: options.id,
    label: options.label,
    read: options.read,
  };
}

export function finiteMetricInvariant<TState>(probeIds: readonly string[] | 'all' = 'all'): SimInvariant<TState> {
  return {
    id: 'finite-metrics',
    severity: 'error',
    message: 'All numeric simulation metrics must stay finite.',
    check: (_state, snapshot) => Object.entries(snapshot.metrics).every(([id, value]) => {
      if (probeIds !== 'all' && !probeIds.includes(id)) return true;
      return typeof value !== 'number' || Number.isFinite(value);
    }),
  };
}

export function nonNegativeMetricInvariant<TState>(
  probeIds: readonly string[],
  severity: SimSeverity = 'error',
): SimInvariant<TState> {
  return {
    id: 'non-negative-metrics',
    severity,
    message: `Metrics should not go negative: ${probeIds.join(', ')}`,
    check: (_state, snapshot) => probeIds.every(id => {
      const value = snapshot.metrics[id];
      return typeof value !== 'number' || value >= 0;
    }),
  };
}

export function rangeMetricInvariant<TState>(
  probeId: string,
  min: number,
  max: number,
  severity: SimSeverity = 'error',
): SimInvariant<TState> {
  return {
    id: `range:${probeId}`,
    severity,
    message: `${probeId} should stay between ${min} and ${max}.`,
    check: (_state, snapshot) => {
      const value = snapshot.metrics[probeId];
      return typeof value !== 'number' || (value >= min && value <= max);
    },
  };
}

export function trendProbeDelta(snapshots: readonly SimSnapshot[], probeId: string): number | null {
  const first = snapshots.find(snapshot => typeof snapshot.metrics[probeId] === 'number');
  const last = [...snapshots].reverse().find(snapshot => typeof snapshot.metrics[probeId] === 'number');
  if (!first || !last) return null;
  return (last.metrics[probeId] as number) - (first.metrics[probeId] as number);
}

function readSnapshot<TState>(
  state: TState,
  context: SimContext,
  probes: readonly SimProbe<TState>[],
): SimSnapshot {
  const metrics: SimSnapshot['metrics'] = {};
  for (const probe of probes) {
    const value = probe.read(state, context);
    metrics[probe.id] = value === undefined ? null : value;
  }
  return { tick: context.tick, metrics };
}

function collectInvariantIssues<TState>(
  state: TState,
  snapshot: SimSnapshot,
  context: SimContext,
  invariants: readonly SimInvariant<TState>[],
  issues: SimIssue[],
): void {
  for (const invariant of invariants) {
    if (!invariant.check(state, snapshot, context)) {
      issues.push({
        tick: context.tick,
        invariantId: invariant.id,
        severity: invariant.severity,
        message: invariant.message,
      });
    }
  }
}

function finish<TState>(
  state: TState,
  snapshots: readonly SimSnapshot[],
  issues: readonly SimIssue[],
  ticksRun: number,
): SimulationResult<TState> {
  const errors = issues.filter(issue => issue.severity === 'error');
  const warnings = issues.filter(issue => issue.severity === 'warning');
  return {
    ok: errors.length === 0,
    ticksRun,
    finalState: state,
    snapshots,
    issues,
    summary: {
      errors: errors.length,
      warnings: warnings.length,
      firstErrorTick: errors[0]?.tick ?? null,
    },
  };
}
