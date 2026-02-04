import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { WatchedAdService } from './watched-ad.service';
import { WATCHED_AD_REPOSITORY } from './interfaces/watched-ad-repository.interface';
import { StubWatchedAdRepository } from './repositories/stub-watched-ad.repository';

describe('WatchedAdService', () => {
  let service: WatchedAdService;
  let repository: StubWatchedAdRepository;

  beforeEach(async () => {
    repository = new StubWatchedAdRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchedAdService,
        {
          provide: WATCHED_AD_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<WatchedAdService>(WatchedAdService);
  });

  describe('getWatchedAdStatus', () => {
    const userId = 'test-user-id';

    beforeEach(() => {
      repository.clear();
    });

    it('광고를 시청하지 않은 경우 false를 반환한다', async () => {
      const result = await service.getWatchedAdStatus(userId);

      expect(result).toBe(false);
    });

    it('광고를 시청한 경우 true를 반환한다', async () => {
      repository.setStatus(userId, true);

      const result = await service.getWatchedAdStatus(userId);

      expect(result).toBe(true);
    });
  });

  describe('setWatchedAdStatus', () => {
    const userId = 'test-user-id';

    beforeEach(() => {
      repository.clear();
    });

    it('광고 시청 완료를 기록하고 success: true를 반환한다', async () => {
      const result = await service.setWatchedAdStatus(userId);

      expect(result).toEqual({ success: true });
    });

    it('광고 시청 기록 후 상태를 조회하면 true를 반환한다', async () => {
      await service.setWatchedAdStatus(userId);

      const status = await service.getWatchedAdStatus(userId);

      expect(status).toBe(true);
    });
  });
});
