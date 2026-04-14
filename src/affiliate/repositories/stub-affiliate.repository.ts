import type {
  IAffiliateRepository,
  PendingAffiliateApproval,
} from '../interfaces/affiliate-repository.interface';

export class StubAffiliateRepository implements IAffiliateRepository {
  private pending: PendingAffiliateApproval[] = [];
  private completed: { id: number; completedAt: string }[] = [];

  setPending(items: PendingAffiliateApproval[]): void {
    this.pending = [...items];
  }

  getCompleted(): { id: number; completedAt: string }[] {
    return this.completed;
  }

  clear(): void {
    this.pending = [];
    this.completed = [];
  }

  findPendingApprovals(
    _beforeDate: string,
  ): Promise<PendingAffiliateApproval[]> {
    return Promise.resolve([...this.pending]);
  }

  markCompleted(id: number, completedAt: string): Promise<void> {
    this.completed.push({ id, completedAt });
    this.pending = this.pending.filter((p) => p.id !== id);
    return Promise.resolve();
  }
}
