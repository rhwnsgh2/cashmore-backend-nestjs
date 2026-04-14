import { Inject, Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { IAffiliateRepository } from './interfaces/affiliate-repository.interface';
import { AFFILIATE_REPOSITORY } from './interfaces/affiliate-repository.interface';
import type { IPointWriteService } from '../point-write/point-write.interface';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { SlackService } from '../slack/slack.service';
import type { AffiliateApprovalsResponseDto } from './dto/approvals-response.dto';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @Inject(AFFILIATE_REPOSITORY)
    private affiliateRepository: IAffiliateRepository,
    @Inject(POINT_WRITE_SERVICE)
    private pointWriteService: IPointWriteService,
    private slackService: SlackService,
  ) {}

  async processApprovals(): Promise<AffiliateApprovalsResponseDto> {
    const tomorrowKstUtc = dayjs()
      .tz('Asia/Seoul')
      .add(1, 'day')
      .startOf('day')
      .utc()
      .toISOString();

    const pending =
      await this.affiliateRepository.findPendingApprovals(tomorrowKstUtc);

    if (pending.length === 0) {
      this.logger.log('No pending affiliate approvals for today');
      return { processed: 0, successful: 0, failed: 0, details: [] };
    }

    this.logger.log(`Found ${pending.length} pending affiliate approvals`);

    const details: AffiliateApprovalsResponseDto['details'] = [];
    let totalPaid = 0;

    for (const approval of pending) {
      try {
        await this.pointWriteService.addPoint({
          userId: approval.userId,
          amount: approval.pointAmount,
          type: 'AFFILIATE',
          additionalData: {
            affiliate_callback_id: approval.id,
            merchant_id: approval.merchantId,
          },
        });

        await this.affiliateRepository.markCompleted(
          approval.id,
          new Date().toISOString(),
        );

        details.push({ id: approval.id, success: true });
        totalPaid += approval.pointAmount;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to process affiliate approval ${approval.id}: ${message}`,
        );
        details.push({ id: approval.id, success: false, error: message });
      }
    }

    const successful = details.filter((d) => d.success).length;
    const failed = details.length - successful;

    void this.slackService.reportBugToSlack(
      `어필리에이트 포인트 자동 지급 완료:\n` +
        `- 처리 대상: ${pending.length}건\n` +
        `- 성공: ${successful}건\n` +
        `- 실패: ${failed}건\n` +
        `- 총 지급액: ${totalPaid.toLocaleString()}원`,
    );

    return {
      processed: pending.length,
      successful,
      failed,
      details,
    };
  }
}
