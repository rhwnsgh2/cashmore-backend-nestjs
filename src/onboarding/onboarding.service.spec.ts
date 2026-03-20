import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { ONBOARDING_REPOSITORY } from './interfaces/onboarding-repository.interface';
import { StubOnboardingRepository } from './repositories/stub-onboarding.repository';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let repository: StubOnboardingRepository;

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubOnboardingRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: ONBOARDING_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('getEventStatus', () => {
    it('참여 기록이 없으면 isDuringEvent가 false이다', async () => {
      const result = await service.getEventStatus(userId);

      expect(result).toBe(false);
    });

    it('오늘 참여한 기록이 있으면 isDuringEvent가 true이다', async () => {
      repository.setParticipation(userId, {
        id: '1',
        createdAt: new Date().toISOString(),
      });

      const result = await service.getEventStatus(userId);

      expect(result).toBe(true);
    });

    it('어제 참여한 기록이 있으면 isDuringEvent가 false이다', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      repository.setParticipation(userId, {
        id: '1',
        createdAt: yesterday.toISOString(),
      });

      const result = await service.getEventStatus(userId);

      expect(result).toBe(false);
    });

    it('내일 날짜의 기록이 있으면 isDuringEvent가 false이다', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      repository.setParticipation(userId, {
        id: '1',
        createdAt: tomorrow.toISOString(),
      });

      const result = await service.getEventStatus(userId);

      expect(result).toBe(false);
    });

    it('다른 사용자의 참여 기록은 영향을 주지 않는다', async () => {
      repository.setParticipation('other-user-id', {
        id: '1',
        createdAt: new Date().toISOString(),
      });

      const result = await service.getEventStatus(userId);

      expect(result).toBe(false);
    });
  });
});
