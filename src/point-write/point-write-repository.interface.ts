export interface IPointWriteRepository {
  insertPointAction(
    userId: string,
    amount: number,
    type: string,
    status: string,
    additionalData: Record<string, unknown>,
  ): Promise<{ id: number }>;

  upsertBalance(
    userId: string,
    delta: number,
    newPointActionId: number,
  ): Promise<void>;
}

export const POINT_WRITE_REPOSITORY = Symbol('POINT_WRITE_REPOSITORY');
