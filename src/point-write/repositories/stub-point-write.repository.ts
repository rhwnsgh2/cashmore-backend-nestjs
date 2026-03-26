import type { IPointWriteRepository } from '../point-write-repository.interface';

export interface InsertedPointAction {
  id: number;
  userId: string;
  amount: number;
  type: string;
  status: string;
  additionalData: Record<string, unknown>;
}

export class StubPointWriteRepository implements IPointWriteRepository {
  private insertedActions: InsertedPointAction[] = [];
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

  getInsertedActions(): InsertedPointAction[] {
    return this.insertedActions;
  }

  clear(): void {
    this.insertedActions = [];
    this.nextId = 1;
  }
}
