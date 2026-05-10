import type { GameClock, ClockTickResult } from '../types/clock.js';
import { DAYS_PER_WEEK, WEEKS_PER_QUARTER, QUARTERS_PER_YEAR } from './constants.js';

export { DAYS_PER_WEEK, WEEKS_PER_QUARTER, QUARTERS_PER_YEAR, DAYS_PER_QUARTER, DAYS_PER_YEAR, DAYS_PER_MONTH } from './constants.js';

/** Advance the game clock by one day. Mutates the clock (Immer-draft-compatible). */
export function advanceClock(clock: GameClock): ClockTickResult {
  clock.totalDays++;
  clock.day++;

  let isNewWeek = false;
  let isNewQuarter = false;
  let isNewYear = false;

  if (clock.day > DAYS_PER_WEEK) {
    clock.day = 1;
    clock.week++;
    isNewWeek = true;

    if (clock.week > WEEKS_PER_QUARTER) {
      clock.week = 1;
      clock.quarter++;
      isNewQuarter = true;

      if (clock.quarter > QUARTERS_PER_YEAR) {
        clock.quarter = 1;
        clock.year++;
        isNewYear = true;
      }
    }
  }

  return { isNewWeek, isNewQuarter, isNewYear };
}

/** Create a fresh clock starting at Y1 Q1 W1 D1 */
export function createClock(speed: GameClock['speed'] = 0): GameClock {
  return { day: 1, week: 1, quarter: 1, year: 1, totalDays: 0, speed };
}
