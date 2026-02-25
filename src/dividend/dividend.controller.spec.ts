import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { DividendController } from './dividend.controller';
import { DividendService } from './dividend.service';
import { DIVIDEND_REPOSITORY } from './interfaces/dividend-repository.interface';
import { StubDividendRepository } from './repositories/stub-dividend.repository';

describe('DividendController', () => {
  let controller: DividendController;
  let repository: StubDividendRepository;

  beforeEach(async () => {
    repository = new StubDividendRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DividendController],
      providers: [
        DividendService,
        {
          provide: DIVIDEND_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    controller = module.get<DividendController>(DividendController);
  });

  describe('GET /dividend/simulate', () => {
    const validApiKey = 'ohuuho0611^';

    beforeEach(() => {
      repository.clear();
    });

    it('올바른 API 키로 시뮬레이션 데이터를 반환한다', async () => {
      repository.setSimulateResult({
        distribution: [
          { receiptCount: 1, userCount: 50 },
          { receiptCount: 2, userCount: 30 },
        ],
        totalUsers: 80,
        totalReceipts: 110,
      });

      const result = await controller.getSimulateData(
        validApiKey,
        '2026',
        '1',
      );

      expect(result.distribution).toHaveLength(2);
      expect(result.totalUsers).toBe(80);
      expect(result.totalReceipts).toBe(110);
    });

    it('API 키가 없으면 UnauthorizedException을 던진다', async () => {
      await expect(
        controller.getSimulateData('', '2026', '1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('잘못된 API 키면 UnauthorizedException을 던진다', async () => {
      await expect(
        controller.getSimulateData('wrong-key', '2026', '1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
