import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PointController } from './point.controller';
import { PointService } from './point.service';
import { POINT_REPOSITORY } from './interfaces/point-repository.interface';
import { StubPointRepository } from './repositories/stub-point.repository';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('PointController', () => {
  let controller: PointController;
  let repository: StubPointRepository;

  beforeEach(async () => {
    repository = new StubPointRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PointController],
      providers: [
        PointService,
        {
          provide: POINT_REPOSITORY,
          useValue: repository,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PointController>(PointController);
  });

  describe('GET /point/total', () => {
    beforeEach(() => {
      repository.clear();
    });

    it('인증된 userId로 포인트 정보를 반환한다', async () => {
      const userId = 'test-user-id';

      repository.setPointActions(userId, [
        {
          id: 1,
          type: 'EVERY_RECEIPT',
          created_at: '2024-01-01',
          point_amount: 5000,
          status: 'done',
        },
      ]);

      repository.setMonthlyEarnedPoints(userId, [{ earned_points: 1000 }]);

      const result = await controller.getPointTotal(userId);

      expect(result).toHaveProperty('totalPoint', 5000);
      expect(result).toHaveProperty('expiringPoints', 1000);
      expect(result).toHaveProperty('expiringDate');
    });
  });
});
