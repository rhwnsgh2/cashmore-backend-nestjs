import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  ICashbackRepository,
  RawCashExchange,
  RawPointAction,
} from './interfaces/cashback-repository.interface';
import {
  CASHBACK_REPOSITORY,
  POINT_ACTION_TYPE_MAP,
  type CashbackItem,
  type CashbackListResult,
} from './interfaces/cashback-repository.interface';
import { SlackService } from '../slack/slack.service';

const DEFAULT_LIMIT = 20;

@Injectable()
export class CashbackService {
  private readonly logger = new Logger(CashbackService.name);

  constructor(
    @Inject(CASHBACK_REPOSITORY)
    private cashbackRepository: ICashbackRepository,
    private slackService: SlackService,
  ) {}

  async getReceivedCashback(
    userId: string,
  ): Promise<{ receivedCashback: number }> {
    const [claimCashback, exchangeAmount, newExchangeAmount] =
      await Promise.all([
        this.cashbackRepository.sumCompletedClaimCashback(userId),
        this.cashbackRepository.sumExchangePointToCash(userId),
        this.safeSumCashExchangeDone(userId),
      ]);

    if (newExchangeAmount !== null && newExchangeAmount !== exchangeAmount) {
      const message = `[CashExchangeMigration] sumExchangePointToCash mismatch userId=${userId} ${JSON.stringify(
        {
          legacy: exchangeAmount,
          new: newExchangeAmount,
          diff: exchangeAmount - newExchangeAmount,
        },
      )}`;
      this.logger.warn(message);
      void this.slackService.reportBugToSlack(`🚨 ${message}`);
    }

    return { receivedCashback: claimCashback + exchangeAmount };
  }

  private async safeSumCashExchangeDone(
    userId: string,
  ): Promise<number | null> {
    try {
      return await this.cashbackRepository.sumCashExchangeDone(userId);
    } catch (error) {
      this.logger.error(
        `[CashExchangeMigration] sumCashExchangeDone read failed userId=${userId}`,
        error,
      );
      void this.slackService.reportBugToSlack(
        `🚨 [CashExchangeMigration] sumCashExchangeDone read failed userId=${userId} error=${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async safeFindCashExchanges(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawCashExchange[] | null> {
    try {
      return await this.cashbackRepository.findCashExchanges(
        userId,
        cursor,
        limit,
      );
    } catch (error) {
      this.logger.error(
        `[CashExchangeMigration] findCashExchanges read failed userId=${userId}`,
        error,
      );
      void this.slackService.reportBugToSlack(
        `🚨 [CashExchangeMigration] findCashExchanges read failed userId=${userId} error=${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private compareCashbackList(
    userId: string,
    pointActions: RawPointAction[],
    cashExchanges: RawCashExchange[],
  ): void {
    // legacy: pointActions에서 EXCHANGE_POINT_TO_CASH만 추출
    const legacyExchanges = pointActions.filter(
      (a) => a.type === 'EXCHANGE_POINT_TO_CASH',
    );

    // 같은 페이지 안의 EXCHANGE_POINT_TO_CASH 행 개수와 amount 합계로 비교
    if (legacyExchanges.length !== cashExchanges.length) {
      const message = `[CashExchangeMigration] cashbackList count mismatch userId=${userId} ${JSON.stringify(
        {
          legacyCount: legacyExchanges.length,
          newCount: cashExchanges.length,
        },
      )}`;
      this.logger.warn(message);
      void this.slackService.reportBugToSlack(`🚨 ${message}`);
      return;
    }

    // 매핑: legacy.id ↔ cashExchange.point_action_id
    const newMap = new Map<number, RawCashExchange>();
    for (const ce of cashExchanges) {
      if (ce.point_action_id !== null) {
        newMap.set(ce.point_action_id, ce);
      }
    }

    const mismatches: Array<{
      pointActionId: number;
      reason: string;
    }> = [];

    for (const legacy of legacyExchanges) {
      const newItem = newMap.get(legacy.id);
      if (!newItem) {
        mismatches.push({
          pointActionId: legacy.id,
          reason: 'missing_in_cash_exchanges',
        });
        continue;
      }
      if (Math.abs(legacy.point_amount ?? 0) !== Number(newItem.amount)) {
        mismatches.push({
          pointActionId: legacy.id,
          reason: 'amount_mismatch',
        });
      }
      if ((legacy.status ?? '') !== newItem.status) {
        mismatches.push({
          pointActionId: legacy.id,
          reason: 'status_mismatch',
        });
      }
    }

    if (mismatches.length > 0) {
      const message = `[CashExchangeMigration] cashbackList mismatch userId=${userId} ${JSON.stringify(
        {
          mismatches: mismatches.slice(0, 10),
        },
      )}`;
      this.logger.warn(message);
      void this.slackService.reportBugToSlack(`🚨 ${message}`);
    }
  }

  async getCashbackList(
    userId: string,
    cursor: string | null,
    limit: number = DEFAULT_LIMIT,
  ): Promise<CashbackListResult> {
    const [
      everyReceipts,
      pointActions,
      stepRewards,
      affiliateData,
      attendances,
      claims,
      naverPayExchanges,
      cashExchanges,
    ] = await Promise.all([
      this.cashbackRepository.findEveryReceipts(userId, cursor, limit),
      this.cashbackRepository.findPointActions(userId, cursor, limit),
      this.cashbackRepository.findStepRewards(userId, cursor, limit),
      this.cashbackRepository.findAffiliateData(userId, cursor, limit),
      this.cashbackRepository.findAttendances(userId, cursor, limit),
      this.cashbackRepository.findClaims(userId, cursor, limit),
      this.cashbackRepository.findNaverPayExchanges(userId, cursor, limit),
      this.safeFindCashExchanges(userId, cursor, limit),
    ]);

    if (cashExchanges !== null) {
      this.compareCashbackList(userId, pointActions, cashExchanges);
    }

    // attendance는 point_actions 매칭이 필요
    let attendancePointActions: Awaited<
      ReturnType<ICashbackRepository['findAttendancePointActions']>
    > = [];
    if (attendances.length > 0) {
      attendancePointActions =
        await this.cashbackRepository.findAttendancePointActions(userId);
    }

    const allItems = [
      // every_receipt
      ...everyReceipts.map((item) => ({
        id: `everyReceipt-${item.id}`,
        type: 'everyReceipt' as const,
        createdAt: item.created_at,
        amount: item.point || 0,
        status: item.status ?? undefined,
        data: { imageUrl: item.image_url },
      })),

      // point_actions
      ...pointActions.map((item) => ({
        id: `pointAction-${item.id}`,
        type: POINT_ACTION_TYPE_MAP[item.type] || ('invitationReward' as const),
        createdAt: item.created_at,
        amount: item.point_amount || 0,
        status: item.status ?? undefined,
        data: item.additional_data,
      })),

      // step_rewards
      ...stepRewards.map((item) => ({
        id: `stepReward-${item.id}`,
        type: 'stepReward' as const,
        createdAt: item.created_at,
        amount: item.point_amount || 0,
        data: { stepCount: item.step_count },
      })),

      // affiliate_callback_data
      ...affiliateData.map((item) => ({
        id: `affiliate-${item.id}-${item.created_at}`,
        type: 'affiliateCashback' as const,
        createdAt:
          item.status === 'completed' ? item.approval_date! : item.created_at,
        amount: item.point_amount || 0,
        status: item.status ?? undefined,
        data: {
          approvalDate: item.approval_date,
          instantAmount: item.instant_amount,
          prepaymentMetadata: item.prepayment_metadata,
          merchantId: item.data?.merchant_id,
          productName: item.data?.product_name,
        },
      })),

      // attendance
      ...attendances.map((item) => {
        const matchedPoint = attendancePointActions.find(
          (p) =>
            p.additional_data?.attendance_id === item.id &&
            p.type === 'ATTENDANCE',
        );
        return {
          id: `attendance-${item.id}`,
          type: 'attendance' as const,
          createdAt: item.created_at,
          amount: matchedPoint?.point_amount || 0,
          data: { attendanceDate: item.created_at_date },
        };
      }),

      // naver_pay_exchanges
      ...naverPayExchanges.map((item) => ({
        id: `naverPayExchange-${item.id}`,
        type: 'exchangePointToNaverpay' as const,
        createdAt: item.created_at,
        amount: -item.cashmore_point,
        status: item.status,
        data: { naverpayPoint: item.naverpay_point },
      })),

      // claim (location_info.title이 있는 것만)
      ...claims
        .filter((item) => item.location_info?.title)
        .map((item) => ({
          id: `claim-${item.id}`,
          type: 'claim' as const,
          createdAt: item.created_at,
          amount: item.cashback_amount || 0,
          status: item.status ?? undefined,
          data: { title: item.location_info!.title },
        })),
    ];

    // created_at 내림차순 정렬
    allItems.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // 페이지네이션
    const hasMore = allItems.length > limit;
    const items = allItems.slice(0, limit);
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt : null;

    return { items: items as CashbackItem[], nextCursor };
  }
}
