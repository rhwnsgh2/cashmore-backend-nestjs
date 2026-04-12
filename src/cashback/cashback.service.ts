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
    const [claimCashback, exchangeAmount, legacyExchangeAmount] =
      await Promise.all([
        this.cashbackRepository.sumCompletedClaimCashback(userId),
        this.cashbackRepository.sumCashExchangeDone(userId),
        this.safeSumLegacyExchangePointToCash(userId),
      ]);

    if (legacyExchangeAmount !== null && legacyExchangeAmount !== exchangeAmount) {
      const message = `[CashExchangeMigration] sumExchangePointToCash mismatch userId=${userId} ${JSON.stringify(
        {
          legacy: legacyExchangeAmount,
          new: exchangeAmount,
          diff: legacyExchangeAmount - exchangeAmount,
        },
      )}`;
      this.logger.warn(message);
      void this.slackService.reportBugToSlack(`🚨 ${message}`);
    }

    return { receivedCashback: claimCashback + exchangeAmount };
  }

  private async safeSumLegacyExchangePointToCash(
    userId: string,
  ): Promise<number | null> {
    try {
      return await this.cashbackRepository.sumExchangePointToCash(userId);
    } catch (error) {
      this.logger.error(
        `[CashExchangeMigration] sumExchangePointToCash legacy read failed userId=${userId}`,
        error,
      );
      void this.slackService.reportBugToSlack(
        `🚨 [CashExchangeMigration] sumExchangePointToCash legacy read failed userId=${userId} error=${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async compareCashbackListExchangesAsync(
    userId: string,
    cashExchanges: RawCashExchange[],
  ): Promise<void> {
    const exchangesWithPointActionId = cashExchanges.filter(
      (ce) => ce.point_action_id !== null,
    );
    if (exchangesWithPointActionId.length === 0) {
      return;
    }

    const ids = exchangesWithPointActionId.map(
      (ce) => ce.point_action_id as number,
    );

    let legacyByPointActionId: RawPointAction[];
    try {
      legacyByPointActionId =
        await this.cashbackRepository.findPointActionsByIds(ids);
    } catch (error) {
      this.logger.error(
        `[CashExchangeMigration] findPointActionsByIds failed userId=${userId}`,
        error,
      );
      void this.slackService.reportBugToSlack(
        `🚨 [CashExchangeMigration] findPointActionsByIds failed userId=${userId} error=${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    const legacyMap = new Map<number, RawPointAction>();
    for (const pa of legacyByPointActionId) {
      legacyMap.set(pa.id, pa);
    }

    const mismatches: Array<{
      pointActionId: number;
      reason: string;
    }> = [];

    for (const ce of exchangesWithPointActionId) {
      const pointActionId = ce.point_action_id as number;
      const legacyItem = legacyMap.get(pointActionId);
      if (!legacyItem) {
        mismatches.push({
          pointActionId,
          reason: 'missing_in_point_actions',
        });
        continue;
      }
      if (Math.abs(legacyItem.point_amount ?? 0) !== Number(ce.amount)) {
        mismatches.push({
          pointActionId,
          reason: 'amount_mismatch',
        });
      }
      if ((legacyItem.status ?? '') !== ce.status) {
        mismatches.push({
          pointActionId,
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
      this.cashbackRepository.findCashExchangesPaged(userId, cursor, limit),
    ]);

    // 비교는 응답 후 비동기로 (fire-and-forget)
    // cash_exchanges 결과의 point_action_id로 point_actions 조회 → 1:1 비교
    void this.compareCashbackListExchangesAsync(userId, cashExchanges);

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

      // cash_exchanges (point_actions의 EXCHANGE_POINT_TO_CASH를 대체)
      // 응답 형식은 기존(pointAction-...)과 호환 유지: point_action_id를 id로 사용
      ...cashExchanges
        .filter((item) => item.point_action_id !== null)
        .map((item) => ({
          id: `pointAction-${item.point_action_id as number}`,
          type: 'exchangePointToCash' as const,
          createdAt: item.created_at,
          amount: -Number(item.amount),
          status: item.status,
          data: null,
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
