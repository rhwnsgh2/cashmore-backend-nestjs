import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { IUserModalRepository } from '../user-modal/interfaces/user-modal-repository.interface';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { FcmService } from '../fcm/fcm.service';
import type { IUserRepository } from '../user/interfaces/user-repository.interface';
import { USER_REPOSITORY } from '../user/interfaces/user-repository.interface';
import { AccountInfoService } from '../account-info/account-info.service';
import { SlackService } from '../slack/slack.service';
import type { IExchangePointRepository } from './interfaces/exchange-point-repository.interface';
import { EXCHANGE_POINT_REPOSITORY } from './interfaces/exchange-point-repository.interface';
import type {
  CashExchange,
  ICashExchangeRepository,
} from './interfaces/cash-exchange-repository.interface';
import { CASH_EXCHANGE_REPOSITORY } from './interfaces/cash-exchange-repository.interface';
import type { ExchangePoint } from './interfaces/exchange-point-repository.interface';

export interface ExchangePointResponse {
  id: number;
  createdAt: string;
  amount: number;
  status: string;
}

export interface PendingExchangeItem {
  id: number;
  userId: string;
  status: string;
  amount: number;
  createdAt: string;
  email: string;
  confirmedAt: string | null;
}

export interface PendingAccountInfoItem {
  userId: string;
  accountBank: string;
  accountNumber: string;
  accountUserName: string;
}

export interface AccountInfoNameItem {
  userId: string;
  accountBank: string;
  accountUserName: string;
}

export interface GetPendingWithAccountInfoResult {
  exchangePoints: PendingExchangeItem[];
  pendingAccountInfo: PendingAccountInfoItem[];
  accountInfoName: AccountInfoNameItem[];
}

@Injectable()
export class ExchangePointService {
  private readonly logger = new Logger(ExchangePointService.name);

  constructor(
    @Inject(EXCHANGE_POINT_REPOSITORY)
    private exchangePointRepository: IExchangePointRepository,
    @Inject(CASH_EXCHANGE_REPOSITORY)
    private cashExchangeRepository: ICashExchangeRepository,
    @Inject(USER_MODAL_REPOSITORY)
    private userModalRepository: IUserModalRepository,
    @Inject(USER_REPOSITORY)
    private userRepository: IUserRepository,
    private accountInfoService: AccountInfoService,
    private fcmService: FcmService,
    private slackService: SlackService,
  ) {}

  async getPendingWithAccountInfo(): Promise<GetPendingWithAccountInfoResult> {
    // 1. pending 건 조회
    const pendingExchanges =
      await this.cashExchangeRepository.findByStatus('pending');

    if (pendingExchanges.length === 0) {
      return {
        exchangePoints: [],
        pendingAccountInfo: [],
        accountInfoName: [],
      };
    }

    // 2. user 정보 bulk 조회 (is_banned 필터용 + email)
    const userIds = Array.from(new Set(pendingExchanges.map((e) => e.user_id)));
    const users = await this.userRepository.findBulkByUserIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    // 3. is_banned 유저 제외
    const filteredExchanges = pendingExchanges.filter((e) => {
      const user = userMap.get(e.user_id);
      return user && !user.is_banned;
    });

    const filteredUserIds = Array.from(
      new Set(filteredExchanges.map((e) => e.user_id)),
    );

    // 4. 계좌 정보 조회 (한 번만 조회 후 두 응답 형태로 분리)
    const pendingAccountInfo =
      await this.accountInfoService.getBulkAccountInfo(filteredUserIds);

    const accountInfoName = pendingAccountInfo.map((info) => ({
      userId: info.userId,
      accountBank: info.accountBank,
      accountUserName: info.accountUserName,
    }));

    // 5. 응답 조립
    const exchangePoints: PendingExchangeItem[] = filteredExchanges.map(
      (e) => ({
        id: e.point_action_id ?? e.id,
        userId: e.user_id,
        status: e.status,
        amount: Number(e.amount),
        createdAt: e.created_at,
        email: userMap.get(e.user_id)?.email ?? '',
        confirmedAt: e.confirmed_at,
      }),
    );

    return {
      exchangePoints,
      pendingAccountInfo,
      accountInfoName,
    };
  }

  async getExchangeHistory(userId: string): Promise<ExchangePointResponse[]> {
    const [cashExchanges, legacy] = await Promise.all([
      this.cashExchangeRepository.findByUserId(userId),
      this.safeFindLegacyExchangesByUserId(userId),
    ]);

    if (legacy !== null) {
      this.compareExchangeHistory(userId, legacy, cashExchanges);
    }

    // 응답: cash_exchanges를 source로, 기존 응답 형식 유지
    // - id: point_action_id (호환성)
    // - amount: 음수로 변환 (point_actions와 동일)
    return cashExchanges
      .filter((ce) => ce.point_action_id !== null)
      .map((ce) => ({
        id: ce.point_action_id as number,
        createdAt: ce.created_at,
        amount: -Number(ce.amount),
        status: ce.status,
      }));
  }

  private async safeFindLegacyExchangesByUserId(
    userId: string,
  ): Promise<ExchangePoint[] | null> {
    try {
      return await this.exchangePointRepository.findByUserId(userId);
    } catch (error) {
      this.logger.error(
        `[CashExchangeMigration] point_actions read failed userId=${userId}`,
        error,
      );
      void this.slackService.reportBugToSlack(
        `🚨 [CashExchangeMigration] getExchangeHistory legacy read failed userId=${userId} error=${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private compareExchangeHistory(
    userId: string,
    legacy: ExchangePoint[],
    cashExchanges: CashExchange[],
  ): void {
    // legacy의 id(point_actions.id)와 cash_exchanges의 point_action_id를 매칭
    const legacyMap = new Map(legacy.map((e) => [e.id, e]));
    const newMap = new Map<number, CashExchange>();
    for (const ce of cashExchanges) {
      if (ce.point_action_id !== null) {
        newMap.set(ce.point_action_id, ce);
      }
    }

    const mismatches: Array<{
      pointActionId: number | null;
      reason: string;
      legacy?: { status: string; amount: number };
      new?: { status: string; amount: number };
    }> = [];

    for (const [id, legacyItem] of legacyMap) {
      const newItem = newMap.get(id);
      if (!newItem) {
        mismatches.push({
          pointActionId: id,
          reason: 'missing_in_cash_exchanges',
          legacy: {
            status: legacyItem.status,
            amount: legacyItem.point_amount,
          },
        });
        continue;
      }
      if (legacyItem.status !== newItem.status) {
        mismatches.push({
          pointActionId: id,
          reason: 'status_mismatch',
          legacy: {
            status: legacyItem.status,
            amount: legacyItem.point_amount,
          },
          new: { status: newItem.status, amount: Number(newItem.amount) },
        });
      }
      if (Math.abs(legacyItem.point_amount) !== Number(newItem.amount)) {
        mismatches.push({
          pointActionId: id,
          reason: 'amount_mismatch',
          legacy: {
            status: legacyItem.status,
            amount: legacyItem.point_amount,
          },
          new: { status: newItem.status, amount: Number(newItem.amount) },
        });
      }
    }

    for (const [pointActionId, ce] of newMap) {
      if (!legacyMap.has(pointActionId)) {
        mismatches.push({
          pointActionId,
          reason: 'missing_in_point_actions',
          new: { status: ce.status, amount: Number(ce.amount) },
        });
      }
    }

    if (mismatches.length === 0) {
      return;
    }

    const details = {
      legacyCount: legacy.length,
      newCount: cashExchanges.length,
      mismatches: mismatches.slice(0, 10),
    };
    const message = `[CashExchangeMigration] getExchangeHistory mismatch userId=${userId} ${JSON.stringify(details)}`;
    this.logger.warn(message);
    void this.slackService.reportBugToSlack(`🚨 ${message}`);
  }

  async requestExchange(
    userId: string,
    amount: number,
  ): Promise<{ success: boolean; id: number }> {
    if (!amount || amount < 1000) {
      throw new BadRequestException('Invalid amount. Minimum is 1000');
    }

    const totalPoints =
      await this.exchangePointRepository.getTotalPoints(userId);

    if (totalPoints < amount) {
      throw new BadRequestException('Insufficient points');
    }

    const result = await this.exchangePointRepository.insertExchangeRequest({
      user_id: userId,
      type: 'EXCHANGE_POINT_TO_CASH',
      point_amount: -amount,
      status: 'pending',
    });

    try {
      await this.cashExchangeRepository.insert({
        user_id: userId,
        amount,
        point_action_id: result.id,
      });
    } catch (error) {
      this.logger.error(
        `cash_exchanges dual-write failed for point_action_id=${result.id}`,
        error,
      );
    }

    return { success: true, id: result.id };
  }

  async cancelExchange(
    userId: string,
    id: number,
  ): Promise<{ success: boolean }> {
    if (!id) {
      throw new BadRequestException('Missing id parameter');
    }

    const exchange = await this.exchangePointRepository.findById(id, userId);

    if (!exchange) {
      throw new NotFoundException('Exchange request not found');
    }

    if (exchange.status !== 'pending') {
      throw new BadRequestException('Can only cancel pending requests');
    }

    await this.exchangePointRepository.cancelExchangeRequest(id, userId);

    try {
      await this.cashExchangeRepository.updateStatus(id, 'cancelled', {
        cancelled_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `cash_exchanges dual-write cancel failed for point_action_id=${id}`,
        error,
      );
    }

    return { success: true };
  }

  async approveExchanges(
    ids: number[],
  ): Promise<{ success: boolean; count: number }> {
    const exchanges = await this.exchangePointRepository.findByIds(ids);
    const pendingExchanges = exchanges.filter((e) => e.status === 'pending');

    if (pendingExchanges.length === 0) {
      throw new BadRequestException('No pending exchanges found');
    }

    const pendingIds = pendingExchanges.map((e) => e.id);

    await this.exchangePointRepository.approveExchangeRequests(pendingIds);

    // dual-write: cash_exchanges 일괄 상태 업데이트
    const confirmedAt = new Date().toISOString();
    try {
      await this.cashExchangeRepository.updateStatusBulk(pendingIds, 'done', {
        confirmed_at: confirmedAt,
      });
    } catch (error) {
      this.logger.error(
        `cash_exchanges dual-write approve failed for ${pendingIds.length} ids`,
        error,
      );
    }

    // 알림은 30초 후 비동기로 처리
    setTimeout(() => {
      void this.sendApproveNotifications(pendingExchanges);
    }, 30000);

    return { success: true, count: pendingIds.length };
  }

  async rejectExchange(
    id: number,
    reason: string = 'invalid_account_number',
  ): Promise<{ success: boolean }> {
    const exchanges = await this.exchangePointRepository.findByIds([id]);

    if (exchanges.length === 0) {
      throw new NotFoundException('Exchange request not found');
    }

    const exchange = exchanges[0];

    if (exchange.status !== 'pending') {
      throw new BadRequestException('Can only reject pending requests');
    }

    await this.exchangePointRepository.rejectExchangeRequest(id, reason);

    // dual-write: cash_exchanges 상태 업데이트
    try {
      await this.cashExchangeRepository.updateStatus(id, 'rejected', {
        rejected_at: new Date().toISOString(),
        reason,
      });
    } catch (error) {
      this.logger.error(
        `cash_exchanges dual-write reject failed for point_action_id=${id}`,
        error,
      );
    }

    // 푸시 알림
    try {
      await this.fcmService.pushNotification(
        exchange.user_id,
        '계좌 번호가 올바르지 않습니다.',
        '계좌 정보를 확인해주세요.',
      );
    } catch (error) {
      this.logger.error(
        `Push notification failed for user=${exchange.user_id}`,
        error,
      );
    }

    return { success: true };
  }

  private async sendApproveNotifications(
    exchanges: { id: number; user_id: string; point_amount: number }[],
  ): Promise<void> {
    for (const exchange of exchanges) {
      try {
        await this.userModalRepository.createModal(
          exchange.user_id,
          'exchange_point_to_cash',
          { amount: exchange.point_amount },
        );
        await this.fcmService.pushNotification(
          exchange.user_id,
          '🔵 포인트 출금 완료!',
          '지금 바로 출금 내역을 확인해보세요',
        );
      } catch (error) {
        this.logger.error(
          `Notification failed for user=${exchange.user_id}`,
          error,
        );
      }
    }
  }
}
