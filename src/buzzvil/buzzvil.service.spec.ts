import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { BuzzvilService } from './buzzvil.service';
import { BuzzvilApiService } from './buzzvil-api.service';
import { AuthService } from '../auth/auth.service';
import { BUZZVIL_REPOSITORY } from './interfaces/buzzvil-repository.interface';
import { StubBuzzvilRepository } from './repositories/stub-buzzvil.repository';
import { PostbackBodyDto } from './dto/postback.dto';

describe('BuzzvilService', () => {
  let service: BuzzvilService;
  let stubRepository: StubBuzzvilRepository;
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
    stubRepository = new StubBuzzvilRepository();
    mockAuthService = {
      getUserIdByAuthId: vi.fn().mockResolvedValue('user-uuid-123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuzzvilService,
        { provide: BuzzvilApiService, useValue: {} },
        { provide: AuthService, useValue: mockAuthService },
        { provide: BUZZVIL_REPOSITORY, useValue: stubRepository },
      ],
    }).compile();

    service = module.get<BuzzvilService>(BuzzvilService);
  });

  describe('handlePostback', () => {
    it('정상 포스트백 → 저장 + OK 반환', async () => {
      const result = await service.handlePostback(buildPostbackDto());

      expect(result).toEqual({ message: 'OK' });

      const saved = stubRepository.getAll();
      expect(saved).toHaveLength(1);
      expect(saved[0].user_id).toBe('user-uuid-123');
      expect(saved[0].type).toBe('BUZZVIL_REWARD');
      expect(saved[0].status).toBe('done');
    });

    it('Buzzvil 포인트를 그대로 적립한다', async () => {
      await service.handlePostback(buildPostbackDto({ point: '100' }));

      const saved = stubRepository.getAll();
      expect(saved[0].point_amount).toBe(100);
    });

    it('additional_data에 모든 필드가 저장된다', async () => {
      await service.handlePostback(buildPostbackDto());

      const ad = stubRepository.getAll()[0].additional_data;
      expect(ad.transaction_id).toBe('txn-001');
      expect(ad.campaign_id).toBe(10075328);
      expect(ad.action_type).toBe('l');
      expect(ad.revenue_type).toBe('cpc');
      expect(ad.title).toBe('11번가 신선밥상');
      expect(ad.unit_id).toBe('321273326536299');
      expect(ad.event_at).toBe(1700000000);
    });

    it('중복 transaction_id → ConflictException', async () => {
      await service.handlePostback(buildPostbackDto());

      await expect(
        service.handlePostback(buildPostbackDto()),
      ).rejects.toThrow(ConflictException);
    });

    it('탈퇴 유저 (매핑 실패) → 200 반환, 저장 안 함', async () => {
      mockAuthService.getUserIdByAuthId.mockResolvedValue(null);

      const result = await service.handlePostback(buildPostbackDto());

      expect(result).toEqual({ message: 'OK' });
      expect(stubRepository.getAll()).toHaveLength(0);
    });
  });

  describe('getRewardStatus', () => {
    it('적립됨 → { credited: true, point }', async () => {
      await service.handlePostback(buildPostbackDto());

      const result = await service.getRewardStatus(
        'user-uuid-123',
        10075328,
      );
      expect(result).toEqual({ credited: true, point: 100 });
    });

    it('미적립 → { credited: false }', async () => {
      const result = await service.getRewardStatus(
        'user-uuid-123',
        99999,
      );
      expect(result).toEqual({ credited: false });
    });
  });
});
