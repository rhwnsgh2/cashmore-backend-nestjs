import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DividendService } from './dividend.service';
import { DIVIDEND_REPOSITORY } from './interfaces/dividend-repository.interface';
import { StubDividendRepository } from './repositories/stub-dividend.repository';

describe('DividendService', () => {
  let service: DividendService;
  let repository: StubDividendRepository;

  beforeEach(async () => {
    repository = new StubDividendRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DividendService,
        {
          provide: DIVIDEND_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<DividendService>(DividendService);
  });

  describe('getSimulateData', () => {
    beforeEach(() => {
      repository.clear();
    });

    it('영수증 유저 분포 데이터를 반환한다', async () => {
      repository.setSimulateResult({
        distribution: [
          { receiptCount: 1, userCount: 50 },
          { receiptCount: 2, userCount: 30 },
          { receiptCount: 5, userCount: 10 },
        ],
        totalUsers: 90,
        totalReceipts: 120,
      });

      const result = await service.getSimulateData('2026', '1');

      expect(result.distribution).toHaveLength(3);
      expect(result.distribution[0]).toEqual({
        receiptCount: 1,
        userCount: 50,
      });
      expect(result.totalUsers).toBe(90);
      expect(result.totalReceipts).toBe(120);
    });

    it('데이터가 없으면 빈 분포와 0을 반환한다', async () => {
      const result = await service.getSimulateData('2026', '1');

      expect(result.distribution).toHaveLength(0);
      expect(result.totalUsers).toBe(0);
      expect(result.totalReceipts).toBe(0);
    });

    it('year가 없으면 BadRequestException을 던진다', async () => {
      await expect(service.getSimulateData('', '1')).rejects.toThrow(
        'year와 month 파라미터가 필요합니다.',
      );
    });

    it('month가 없으면 BadRequestException을 던진다', async () => {
      await expect(service.getSimulateData('2026', '')).rejects.toThrow(
        'year와 month 파라미터가 필요합니다.',
      );
    });

    it('유효하지 않은 month 값이면 BadRequestException을 던진다', async () => {
      await expect(service.getSimulateData('2026', '13')).rejects.toThrow(
        '유효하지 않은 year 또는 month 값입니다.',
      );
    });

    it('유효하지 않은 year 값이면 BadRequestException을 던진다', async () => {
      await expect(service.getSimulateData('abc', '1')).rejects.toThrow(
        '유효하지 않은 year 또는 month 값입니다.',
      );
    });

    it('month가 0이면 BadRequestException을 던진다', async () => {
      await expect(service.getSimulateData('2026', '0')).rejects.toThrow(
        '유효하지 않은 year 또는 month 값입니다.',
      );
    });

    it('12월인 경우 다음해 1월로 endDate를 계산한다', async () => {
      repository.setSimulateResult({
        distribution: [{ receiptCount: 1, userCount: 10 }],
        totalUsers: 10,
        totalReceipts: 10,
      });

      const result = await service.getSimulateData('2025', '12');

      expect(result.totalUsers).toBe(10);
    });

    it('한 자리 month를 올바르게 처리한다', async () => {
      repository.setSimulateResult({
        distribution: [{ receiptCount: 3, userCount: 20 }],
        totalUsers: 20,
        totalReceipts: 60,
      });

      const result = await service.getSimulateData('2026', '2');

      expect(result.totalUsers).toBe(20);
      expect(result.totalReceipts).toBe(60);
    });
  });
});
