import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  IPointWriteService,
  AddPointParams,
  AddPointResult,
} from './point-write.interface';
import type { IPointWriteRepository } from './point-write-repository.interface';
import { POINT_WRITE_REPOSITORY } from './point-write-repository.interface';
import { SlackService } from '../slack/slack.service';

@Injectable()
export class PointWriteService implements IPointWriteService {
  private readonly logger = new Logger(PointWriteService.name);

  constructor(
    @Inject(POINT_WRITE_REPOSITORY)
    private repository: IPointWriteRepository,
    @Optional() private slackService?: SlackService,
  ) {}

  async addPoint(params: AddPointParams): Promise<AddPointResult> {
    const {
      userId,
      amount,
      type,
      status = 'done',
      additionalData = {},
    } = params;

    const result = await this.repository.insertPointAction(
      userId,
      amount,
      type,
      status,
      additionalData,
    );

    // balance 갱신은 best-effort: 실패해도 point_action insert는 유지
    try {
      await this.repository.upsertBalance(userId, amount, result.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `[BALANCE] upsertBalance 실패 userId=${userId} pointActionId=${result.id} delta=${amount} error=${message}`,
      );
      void this.slackService?.reportBugToSlack(
        `⚠️ user_point_balance 갱신 실패\n` +
          `- userId: ${userId}\n` +
          `- pointActionId: ${result.id}\n` +
          `- type: ${type}\n` +
          `- delta: ${amount}\n` +
          `- error: ${message}`,
      );
    }

    return result;
  }
}
