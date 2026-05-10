import { createClock } from '../dist/clock/index.js';
import { clockPhase, composeTick, createTickContext } from '../dist/tick/index.js';

const state = {
  clock: createClock(1),
  gameOver: false,
  gameOverReason: null,
  subscribers: 1_000,
  churnRisk: 0.02,
};

const subscriberGrowthPhase = (game) => {
  const grossAdds = Math.round(game.subscribers * 0.04);
  const churn = Math.round(game.subscribers * game.churnRisk);
  game.subscribers = Math.max(0, game.subscribers + grossAdds - churn);
};

const tick = composeTick([
  clockPhase({ maxYears: 3 }),
  subscriberGrowthPhase,
]);

for (let day = 0; day < 30; day++) {
  tick(state, createTickContext());
}

console.log({
  totalDays: state.clock.totalDays,
  year: state.clock.year,
  quarter: state.clock.quarter,
  week: state.clock.week,
  day: state.clock.day,
  subscribers: state.subscribers,
});
