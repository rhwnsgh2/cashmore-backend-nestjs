import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { IExchangePointRepository } from './interfaces/exchange-point-repository.interface';
import { EXCHANGE_POINT_REPOSITORY } from './interfaces/exchange-point-repository.interface';

export interface ExchangePointResponse {
  id: number;
  createdAt: string;
  amount: number;
  status: string;
}

@Injectable()
export class ExchangePointService {
  constructor(
    @Inject(EXCHANGE_POINT_REPOSITORY)
    private exchangePointRepository: IExchangePointRepository,
  ) {}

  async getExchangeHistory(userId: string): Promise<ExchangePointResponse[]> {
    const exchanges =
      await this.exchangePointRepository.findByUserId(userId);

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

    return { success: true };
  }
}
