export type GameSpeed = 0 | 1 | 2 | 3 | 4;

export interface GameClock {
  day: number;
  week: number;
  quarter: number;
  year: number;
  totalDays: number;
  speed: GameSpeed;
  previousSpeed?: GameSpeed;
}

export interface ClockTickResult {
  isNewWeek: boolean;
  isNewQuarter: boolean;
  isNewYear: boolean;
}
