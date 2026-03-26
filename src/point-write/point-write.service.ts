import { Inject, Injectable } from '@nestjs/common';
import type {
  IPointWriteService,
  AddPointParams,
  AddPointResult,
} from './point-write.interface';
import type { IPointWriteRepository } from './point-write-repository.interface';
import { POINT_WRITE_REPOSITORY } from './point-write-repository.interface';

@Injectable()
export class PointWriteService implements IPointWriteService {
  constructor(
    @Inject(POINT_WRITE_REPOSITORY)
    private repository: IPointWriteRepository,
  ) {}

  async addPoint(params: AddPointParams): Promise<AddPointResult> {
    const { userId, amount, type, status = 'done', additionalData = {} } = params;

    const result = await this.repository.insertPointAction(
      userId,
      amount,
      type,
      status,
      additionalData,
    );

    return result;
  }
}
