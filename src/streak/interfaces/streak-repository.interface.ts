export interface ReceiptSubmission {
  id: string;
  user_id: string;
  created_at: string;
}

export interface Streak {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  continuous_count: number;
}

export interface IStreakRepository {
  findReceiptSubmissions(userId: string): Promise<ReceiptSubmission[]>;
}

export const STREAK_REPOSITORY = Symbol('STREAK_REPOSITORY');
