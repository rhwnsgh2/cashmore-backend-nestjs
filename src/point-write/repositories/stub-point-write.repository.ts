import type { IPointWriteRepository } from '../point-write-repository.interface';

export interface InsertedPointAction {
  id: number;
  userId: string;
  amount: number;
  type: string;
  status: string;
  additionalData: Record<string, unknown>;
}

interface BalanceRow {
  totalPoint: number;
  lastPointActionId: number;
}

export class StubPointWriteRepository implements IPointWriteRepository {
  private insertedActions: InsertedPointAction[] = [];
  private balances = new Map<string, BalanceRow>();
  private nextId = 1;

  async insertPointAction(
    userId: string,
    amount: number,
    type: string,
    status: string,
    additionalData: Record<string, unknown>,
  ): Promise<{ id: number }> {
    const id = this.nextId++;
    this.insertedActions.push({
      id,
      userId,
      amount,
      type,
      status,
      additionalData,
    });
    return { id };
  }

  async upsertBalance(
    userId: string,
    delta: number,
    newPointActionId: number,
  ): Promise<void> {
    const existing = this.balances.get(userId);
    if (existing) {
      // atomic increment
      this.balances.set(userId, {
        totalPoint: existing.totalPoint + delta,
        lastPointActionId: Math.max(
          existing.lastPointActionId,
          newPointActionId,
        ),
      });
      return;
    }

    // lazy first write: SUM all actions for this user
    const sum = this.insertedActions
      .filter((a) => a.userId === userId)
      .reduce((acc, a) => acc + a.amount, 0);
    this.balances.set(userId, {
      totalPoint: sum,
      lastPointActionId: newPointActionId,
    });
  }

  getInsertedActions(): InsertedPointAction[] {
    return this.insertedActions;
  }

  getBalance(userId: string): BalanceRow | undefined {
    return this.balances.get(userId);
  }

  clear(): void {
    this.insertedActions = [];
    this.balances.clear();
    this.nextId = 1;
  }
}
