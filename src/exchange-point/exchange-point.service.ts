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
    private fcmService: FcmService,
  ) {}

  async getExchangeHistory(userId: string): Promise<ExchangePointResponse[]> {
    const exchanges = await this.exchangePointRepository.findByUserId(userId);

    return exchanges.map((e) => ({
      id: e.id,
      createdAt: e.created_at,
      amount: e.point_amount,
      status: e.status,
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

    // dual-write: cash_exchanges 상태 업데이트
    const confirmedAt = new Date().toISOString();
    for (const id of pendingIds) {
      try {
        await this.cashExchangeRepository.updateStatus(id, 'done', {
          confirmed_at: confirmedAt,
        });
      } catch (error) {
        this.logger.error(
          `cash_exchanges dual-write approve failed for point_action_id=${id}`,
          error,
        );
      }
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
