import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExchangePointService } from './exchange-point.service';
import { EXCHANGE_POINT_REPOSITORY } from './interfaces/exchange-point-repository.interface';
import { StubExchangePointRepository } from './repositories/stub-exchange-point.repository';

describe('ExchangePointService', () => {
  let service: ExchangePointService;
  let repository: StubExchangePointRepository;
  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubExchangePointRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangePointService,
        {
          provide: EXCHANGE_POINT_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<ExchangePointService>(ExchangePointService);
  });

  describe('getExchangeHistory', () => {
    it('출금 내역을 반환한다', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'pending',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      const result = await service.getExchangeHistory(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        createdAt: '2025-01-01T00:00:00Z',
        amount: -5000,
        status: 'pending',
      });
    });

    it('내역이 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getExchangeHistory(userId);
      expect(result).toEqual([]);
    });
  });

  describe('requestExchange', () => {
    it('출금 신청에 성공한다', async () => {
      repository.setTotalPoints(userId, 10000);

      const result = await service.requestExchange(userId, 5000);

      expect(result).toEqual({ success: true, id: 1 });
    });

    it('금액이 1000 미만이면 BadRequestException', async () => {
      repository.setTotalPoints(userId, 10000);

      await expect(service.requestExchange(userId, 500)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('금액이 0이면 BadRequestException', async () => {
      repository.setTotalPoints(userId, 10000);

      await expect(service.requestExchange(userId, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('잔액이 부족하면 BadRequestException', async () => {
      repository.setTotalPoints(userId, 3000);

      await expect(service.requestExchange(userId, 5000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('잔액과 동일한 금액은 출금 가능하다', async () => {
      repository.setTotalPoints(userId, 5000);

      const result = await service.requestExchange(userId, 5000);

      expect(result).toEqual({ success: true, id: 1 });
    });
  });

  describe('cancelExchange', () => {
    it('pending 상태 출금을 취소한다', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'pending',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      const result = await service.cancelExchange(userId, 1);

      expect(result).toEqual({ success: true });
    });

    it('존재하지 않는 출금이면 NotFoundException', async () => {
      await expect(service.cancelExchange(userId, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('pending이 아닌 출금은 취소 불가', async () => {
      repository.setExchanges(userId, [
        {
          id: 1,
          user_id: userId,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'done',
          created_at: '2025-01-01T00:00:00Z',
          additional_data: null,
        },
      ]);

      await expect(service.cancelExchange(userId, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('id가 없으면 BadRequestException', async () => {
      await expect(service.cancelExchange(userId, 0)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
