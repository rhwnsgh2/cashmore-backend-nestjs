import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { BuzzvilService } from './buzzvil.service';
import { BuzzvilApiService } from './buzzvil-api.service';
import { AuthService } from '../auth/auth.service';
import { FcmService } from '../fcm/fcm.service';
import { BUZZVIL_REPOSITORY } from './interfaces/buzzvil-repository.interface';
import { StubBuzzvilRepository } from './repositories/stub-buzzvil.repository';
import { PostbackBodyDto } from './dto/postback.dto';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { PointWriteService } from '../point-write/point-write.service';
import { StubPointWriteRepository } from '../point-write/repositories/stub-point-write.repository';

describe('BuzzvilService', () => {
  let service: BuzzvilService;
  let stubRepository: StubBuzzvilRepository;
  let stubPointWriteRepo: StubPointWriteRepository;
  let mockAuthService: { getUserIdByAuthId: ReturnType<typeof vi.fn> };

  const buildPostbackDto = (
    overrides: Partial<PostbackBodyDto> = {},
  ): PostbackBodyDto => ({
    user_id: 'auth-123',
    transaction_id: 'txn-001',
    point: '100',
    unit_id: '321273326536299',
    title: '11번가 신선밥상',
    event_at: '1700000000',
    action_type: 'l',
    revenue_type: 'cpc',
    campaign_id: '10075328',
    ...overrides,
  });

  beforeEach(async () => {
    stubPointWriteRepo = new StubPointWriteRepository();
    stubRepository = new StubBuzzvilRepository(stubPointWriteRepo);
    mockAuthService = {
      getUserIdByAuthId: vi.fn().mockResolvedValue('user-uuid-123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuzzvilService,
        { provide: BuzzvilApiService, useValue: {} },
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: FcmService,
          useValue: { sendRefreshMessage: vi.fn(), sendDataMessage: vi.fn() },
        },
        { provide: BUZZVIL_REPOSITORY, useValue: stubRepository },
        {
          provide: POINT_WRITE_SERVICE,
          useFactory: () => new PointWriteService(stubPointWriteRepo),
        },
      ],
    }).compile();

    service = module.get<BuzzvilService>(BuzzvilService);
  });

  describe('handlePostback', () => {
    it('정상 포스트백 → 저장 + OK 반환', async () => {
      const result = await service.handlePostback(buildPostbackDto());

      expect(result).toEqual({ message: 'OK' });

      const saved = stubPointWriteRepo.getInsertedActions();
      expect(saved).toHaveLength(1);
      expect(saved[0].userId).toBe('user-uuid-123');
      expect(saved[0].type).toBe('BUZZVIL_REWARD');
      expect(saved[0].status).toBe('done');
    });

    it('Buzzvil 포인트를 그대로 적립한다', async () => {
      await service.handlePostback(buildPostbackDto({ point: '100' }));

      const saved = stubPointWriteRepo.getInsertedActions();
      expect(saved[0].amount).toBe(100);
    });

    it('additional_data에 모든 필드가 저장된다', async () => {
      await service.handlePostback(buildPostbackDto());

      const ad = stubPointWriteRepo.getInsertedActions()[0].additionalData;
      expect(ad.transaction_id).toBe('txn-001');
      expect(ad.campaign_id).toBe(10075328);
      expect(ad.action_type).toBe('l');
      expect(ad.revenue_type).toBe('cpc');
      expect(ad.title).toBe('11번가 신선밥상');
      expect(ad.unit_id).toBe('321273326536299');
      expect(ad.event_at).toBe(1700000000);
    });

    it('campaign_id 없는 포스트백 (럭키박스/미션팩) → 정상 저장', async () => {
      const result = await service.handlePostback(
        buildPostbackDto({ campaign_id: undefined }),
      );

      expect(result).toEqual({ message: 'OK' });

      const saved = stubPointWriteRepo.getInsertedActions();
      expect(saved).toHaveLength(1);
      expect(saved[0].additionalData.campaign_id).toBeNull();
    });

    it('중복 transaction_id → ConflictException', async () => {
      await service.handlePostback(buildPostbackDto());

      await expect(service.handlePostback(buildPostbackDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('탈퇴 유저 (매핑 실패) → 200 반환, 저장 안 함', async () => {
      mockAuthService.getUserIdByAuthId.mockResolvedValue(null);

      const result = await service.handlePostback(buildPostbackDto());

      expect(result).toEqual({ message: 'OK' });
      expect(stubPointWriteRepo.getInsertedActions()).toHaveLength(0);
    });
  });

  describe('getRewardStatus', () => {
    it('적립됨 → rewards 배열 + total_point 반환', async () => {
      await service.handlePostback(buildPostbackDto());

      const result = await service.getRewardStatus(
        'user-uuid-123',
        '2020-01-01T00:00:00.000Z',
      );
      expect(result.rewards).toHaveLength(1);
      expect(result.rewards[0]).toEqual({
        campaign_id: 10075328,
        point: 100,
        title: '11번가 신선밥상',
      });
      expect(result.total_point).toBe(100);
    });

    it('여러 건 적립 → 모두 반환 + total_point 합산', async () => {
      await service.handlePostback(buildPostbackDto());
      await service.handlePostback(
        buildPostbackDto({
          transaction_id: 'txn-002',
          campaign_id: '99999',
          point: '50',
          title: '보너스 리워드',
        }),
      );

      const result = await service.getRewardStatus(
        'user-uuid-123',
        '2020-01-01T00:00:00.000Z',
      );
      expect(result.rewards).toHaveLength(2);
      expect(result.total_point).toBe(150);
    });

    it('미적립 → 빈 배열 + total_point 0', async () => {
      const result = await service.getRewardStatus(
        'user-uuid-123',
        '2020-01-01T00:00:00.000Z',
      );
      expect(result).toEqual({ rewards: [], total_point: 0 });
    });
  });
});
