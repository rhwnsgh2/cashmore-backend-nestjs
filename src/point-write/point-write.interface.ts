export interface AddPointParams {
  userId: string;
  amount: number;
  type: string;
  status?: string;
  additionalData?: Record<string, unknown>;
}

export interface AddPointResult {
  id: number;
}

export interface IPointWriteService {
  addPoint(params: AddPointParams): Promise<AddPointResult>;
}

export const POINT_WRITE_SERVICE = Symbol('POINT_WRITE_SERVICE');
