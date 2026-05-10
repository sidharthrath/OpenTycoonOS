import { createClock } from '../src/clock/index.js';
import { clockPhase, composeTick, createTickContext, type TickPhase } from '../src/tick/index.js';

interface ServiceGameState {
  clock: ReturnType<typeof createClock>;
  gameOver: boolean;
  gameOverReason: string | null;
  subscribers: number;
  churnRisk: number;
}

const state: ServiceGameState = {
  clock: createClock(1),
  gameOver: false,
  gameOverReason: null,
  subscribers: 1_000,
  churnRisk: 0.02,
};

const subscriberGrowthPhase: TickPhase<ServiceGameState> = (game) => {
  const grossAdds = Math.round(game.subscribers * 0.01);
  const churn = Math.round(game.subscribers * game.churnRisk);
  game.subscribers = Math.max(0, game.subscribers + grossAdds - churn);
};

const tick = composeTick<ServiceGameState>([
  clockPhase({ maxYears: 3 }),
  subscriberGrowthPhase,
]);

const ctx = createTickContext();
tick(state, ctx);

console.log({
  day: state.clock.totalDays,
  subscribers: state.subscribers,
  notifications: ctx.notifications,
});
