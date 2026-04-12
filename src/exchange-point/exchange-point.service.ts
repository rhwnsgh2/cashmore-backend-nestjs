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
import type { IExchangePointRepository } from './interfaces/exchange-point-repository.interface';
import { EXCHANGE_POINT_REPOSITORY } from './interfaces/exchange-point-repository.interface';
import type { ICashExchangeRepository } from './interfaces/cash-exchange-repository.interface';
import { CASH_EXCHANGE_REPOSITORY } from './interfaces/cash-exchange-repository.interface';

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

export interface SearchExchangeItem {
  id: number;
  userId: string;
  status: string;
  amount: number;
  createdAt: string;
  email: string;
  confirmedAt: string | null;
}

export interface SearchExchangesResult {
  exchangePoints: SearchExchangeItem[];
  pendingAccountInfo: PendingAccountInfoItem[];
  accountInfoName: AccountInfoNameItem[];
}

export interface CashExchangeDetailPointAction {
  id: number;
  pointAmount: number;
  role: 'deduct' | 'restore';
  status: string;
  createdAt: string;
  additionalData: Record<string, unknown> | null;
}

export interface CashExchangeDetailResult {
  id: number;
  userId: string;
  amount: number;
  status: string;
  reason: string | null;
  pointActionId: number | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pointActions: CashExchangeDetailPointAction[];
  netAmount: number;
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

  async searchByEmail(email: string): Promise<SearchExchangesResult> {
    if (!email || email.length < 3) {
      throw new BadRequestException('이메일은 3자 이상 입력해주세요.');
    }

    // 1. 이메일로 유저 검색 (최대 10명)
    const users = await this.userRepository.searchByEmail(email, 10);

    if (users.length === 0) {
      return {
        exchangePoints: [],
        pendingAccountInfo: [],
        accountInfoName: [],
      };
    }

    const userIds = users.map((u) => u.id);
    const userMap = new Map(users.map((u) => [u.id, u]));

    // 2. 해당 유저들의 출금 내역 조회 (최대 100건)
    const exchanges = await this.cashExchangeRepository.findByUserIds(
      userIds,
      100,
    );

    const exchangePoints: SearchExchangeItem[] = exchanges.map((e) => ({
      id: e.point_action_id ?? e.id,
      userId: e.user_id,
      status: e.status,
      amount: Number(e.amount),
      createdAt: e.created_at,
      email: userMap.get(e.user_id)?.email ?? '',
      confirmedAt: e.confirmed_at,
    }));

    // 3. 계좌 정보 조회
    const pendingUserIds = Array.from(
      new Set(
        exchanges.filter((e) => e.status === 'pending').map((e) => e.user_id),
      ),
    );
    const uniqueUserIds = Array.from(new Set(exchanges.map((e) => e.user_id)));

    const [pendingAccountInfo, accountInfoName] = await Promise.all([
      pendingUserIds.length > 0
        ? this.accountInfoService.getBulkAccountInfo(pendingUserIds)
        : Promise.resolve([]),
      uniqueUserIds.length > 0
        ? this.accountInfoService.getBulkAccountInfoName(uniqueUserIds)
        : Promise.resolve([]),
    ]);

    return {
      exchangePoints,
      pendingAccountInfo,
      accountInfoName,
    };
  }

  async getCashExchangeDetail(id: number): Promise<CashExchangeDetailResult> {
    const cashExchange = await this.cashExchangeRepository.findById(id);

    if (!cashExchange) {
      throw new NotFoundException('Cash exchange not found');
    }

    // 관련 point_actions 조회 (deduct + restore)
    let pointActions: CashExchangeDetailPointAction[] = [];
    let netAmount = 0;

    if (cashExchange.point_action_id !== null) {
      const related = await this.exchangePointRepository.findRelatedToExchange(
        cashExchange.point_action_id,
      );

      pointActions = related.map((pa) => {
        const isOriginal = pa.id === cashExchange.point_action_id;
        return {
          id: pa.id,
          pointAmount: pa.point_amount,
          role: isOriginal ? ('deduct' as const) : ('restore' as const),
          status: pa.status,
          createdAt: pa.created_at,
          additionalData: pa.additional_data,
        };
      });

      netAmount = pointActions.reduce((sum, p) => sum + p.pointAmount, 0);
    }

    return {
      id: cashExchange.id,
      userId: cashExchange.user_id,
      amount: Number(cashExchange.amount),
      status: cashExchange.status,
      reason: cashExchange.reason,
      pointActionId: cashExchange.point_action_id,
      confirmedAt: cashExchange.confirmed_at,
      cancelledAt: cashExchange.cancelled_at,
      rejectedAt: cashExchange.rejected_at,
      createdAt: cashExchange.created_at,
      updatedAt: cashExchange.updated_at,
      pointActions,
      netAmount,
    };
  }

  async getExchangeHistory(userId: string): Promise<ExchangePointResponse[]> {
    const cashExchanges =
      await this.cashExchangeRepository.findByUserId(userId);

    return cashExchanges
      .filter((ce) => ce.point_action_id !== null)
      .map((ce) => ({
        id: ce.point_action_id as number,
        createdAt: ce.created_at,
        amount: -Number(ce.amount),
        status: ce.status,
      }));
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

    // Phase 3.1: status='done'으로 INSERT (네이버페이 패턴)
    // - 신청 즉시 차감 (잔액 영향 동일)
    // - point_actions는 mutable status 머신이 아닌 append-only 원장
    // - 출금의 진짜 상태(pending/done/cancelled/rejected)는 cash_exchanges에서 관리
    const result = await this.exchangePointRepository.insertExchangeRequest({
      user_id: userId,
      type: 'EXCHANGE_POINT_TO_CASH',
      point_amount: -amount,
      status: 'done',
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

    // 검증 source: cash_exchanges
    const cashExchange =
      await this.cashExchangeRepository.findByPointActionId(id);

    if (!cashExchange) {
      throw new NotFoundException('Exchange request not found');
    }

    if (cashExchange.user_id !== userId) {
      throw new NotFoundException('Exchange request not found');
    }

    if (cashExchange.status !== 'pending') {
      throw new BadRequestException('Can only cancel pending requests');
    }

    // Phase 3.2: 복원 행 INSERT (네이버페이 패턴)
    // - 원본 deduct 행은 그대로 (status='done', -amount)
    // - 새 복원 행 INSERT (status='done', +amount)
    // - net = 0 → 잔액 복원
    await this.exchangePointRepository.insertRestoreAction({
      user_id: userId,
      amount: Number(cashExchange.amount),
      original_point_action_id: id,
      reason: 'cancelled',
    });

    // cash_exchanges 상태 업데이트
    await this.cashExchangeRepository.updateStatus(id, 'cancelled', {
      cancelled_at: new Date().toISOString(),
    });

    return { success: true };
  }

  async approveExchanges(
    ids: number[],
  ): Promise<{ success: boolean; count: number }> {
    // 검증 source: cash_exchanges (point_actions.id == cash_exchanges.point_action_id)
    const cashExchanges =
      await this.cashExchangeRepository.findByPointActionIds(ids);
    const pendingCashExchanges = cashExchanges.filter(
      (ce) => ce.status === 'pending',
    );

    if (pendingCashExchanges.length === 0) {
      throw new BadRequestException('No pending exchanges found');
    }

    const pendingIds = pendingCashExchanges
      .map((ce) => ce.point_action_id)
      .filter((id): id is number => id !== null);

    // 알림용 데이터 (point_amount는 음수로 변환)
    const pendingExchanges = pendingCashExchanges
      .filter((ce) => ce.point_action_id !== null)
      .map((ce) => ({
        id: ce.point_action_id as number,
        user_id: ce.user_id,
        point_amount: -Number(ce.amount),
      }));

    // Phase 3.3: point_actions UPDATE 제거
    // - 신청 시점에 이미 status='done'으로 INSERT됨
    // - 승인은 cash_exchanges 상태만 변경하면 됨

    // cash_exchanges 일괄 상태 업데이트
    const confirmedAt = new Date().toISOString();
    await this.cashExchangeRepository.updateStatusBulk(pendingIds, 'done', {
      confirmed_at: confirmedAt,
    });

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
    // 검증 source: cash_exchanges
    const cashExchange =
      await this.cashExchangeRepository.findByPointActionId(id);

    if (!cashExchange) {
      throw new NotFoundException('Exchange request not found');
    }

    if (cashExchange.status !== 'pending') {
      throw new BadRequestException('Can only reject pending requests');
    }

    // Phase 3.4: 복원 행 INSERT (네이버페이 패턴)
    await this.exchangePointRepository.insertRestoreAction({
      user_id: cashExchange.user_id,
      amount: Number(cashExchange.amount),
      original_point_action_id: id,
      reason: `rejected_${reason}`,
    });

    // cash_exchanges 상태 업데이트
    await this.cashExchangeRepository.updateStatus(id, 'rejected', {
      rejected_at: new Date().toISOString(),
      reason,
    });

    // 푸시 알림
    try {
      await this.fcmService.pushNotification(
        cashExchange.user_id,
        '계좌 번호가 올바르지 않습니다.',
        '계좌 정보를 확인해주세요.',
      );
    } catch (error) {
      this.logger.error(
        `Push notification failed for user=${cashExchange.user_id}`,
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
