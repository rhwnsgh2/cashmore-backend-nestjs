import {
  IStreakRepository,
  ReceiptSubmission,
} from '../interfaces/streak-repository.interface';

export class StubStreakRepository implements IStreakRepository {
  private submissions = new Map<string, ReceiptSubmission[]>();

  setSubmissions(userId: string, submissions: ReceiptSubmission[]): void {
    this.submissions.set(userId, submissions);
  }

  clear(): void {
    this.submissions.clear();
  }

  findReceiptSubmissions(userId: string): Promise<ReceiptSubmission[]> {
    return Promise.resolve(this.submissions.get(userId) || []);
  }
}
