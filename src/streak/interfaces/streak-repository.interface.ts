export interface Streak {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  continuous_count: number;
}

export interface IStreakRepository {
  findStreaks(userId: string, days?: number): Promise<Streak[]>;
}

export const STREAK_REPOSITORY = Symbol('STREAK_REPOSITORY');
