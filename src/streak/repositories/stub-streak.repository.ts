import {
  IStreakRepository,
  Streak,
} from '../interfaces/streak-repository.interface';

export class StubStreakRepository implements IStreakRepository {
  private streaks = new Map<string, Streak[]>();

  setStreaks(userId: string, streaks: Streak[]): void {
    this.streaks.set(userId, streaks);
  }

  clear(): void {
    this.streaks.clear();
  }

  findStreaks(userId: string, _days?: number): Promise<Streak[]> {
    return Promise.resolve(this.streaks.get(userId) || []);
  }
}
