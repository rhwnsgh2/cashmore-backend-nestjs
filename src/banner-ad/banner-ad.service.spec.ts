import { Test, TestingModule } from '@nestjs/testing';
import { BannerAdService } from './banner-ad.service';
import { BANNER_AD_REPOSITORY } from './interfaces/banner-ad-repository.interface';
import { StubBannerAdRepository } from './repositories/stub-banner-ad.repository';

describe('BannerAdService', () => {
  let service: BannerAdService;
  let repository: StubBannerAdRepository;

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubBannerAdRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BannerAdService,
        { provide: BANNER_AD_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<BannerAdService>(BannerAdService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('getActiveBanners', () => {
    it('활성 배너가 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getActiveBanners('main');
      expect(result).toEqual([]);
    });

    it('활성 배너 목록을 camelCase로 매핑하여 반환한다', async () => {
      repository.setAds([
        {
          id: 100,
          title: '테스트 배너',
          image_url: 'https://cdn.example.com/banner1.png',
          click_url: 'https://link.example.com/promo1',
          placement: 'main',
          priority: 10,
        },
      ]);

      const result = await service.getActiveBanners('main');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 100,
        imageUrl: 'https://cdn.example.com/banner1.png',
        clickUrl: 'https://link.example.com/promo1',
        placement: 'main',
      });
    });

    it('우선순위순으로 정렬하여 반환한다', async () => {
      repository.setAds([
        {
          id: 200,
          title: '낮은 우선순위',
          image_url: 'https://cdn.example.com/banner2.png',
          click_url: 'https://link.example.com/promo2',
          placement: 'main',
          priority: 100,
        },
        {
          id: 100,
          title: '높은 우선순위',
          image_url: 'https://cdn.example.com/banner1.png',
          click_url: 'https://link.example.com/promo1',
          placement: 'main',
          priority: 10,
        },
      ]);

      const result = await service.getActiveBanners('main');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(100);
      expect(result[1].id).toBe(200);
    });

    it('요청한 placement에 해당하는 배너만 반환한다', async () => {
      repository.setAds([
        {
          id: 100,
          title: 'main 배너',
          image_url: 'https://cdn.example.com/banner1.png',
          click_url: 'https://link.example.com/promo1',
          placement: 'main',
          priority: 10,
        },
        {
          id: 200,
          title: 'footer 배너',
          image_url: 'https://cdn.example.com/banner2.png',
          click_url: 'https://link.example.com/promo2',
          placement: 'footer',
          priority: 10,
        },
      ]);

      const result = await service.getActiveBanners('main');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(100);
    });
  });

  describe('trackImpression', () => {
    it('노출 이벤트를 기록하고 성공을 반환한다', async () => {
      const result = await service.trackImpression(100, userId);

      expect(result).toEqual({ success: true });
      expect(repository.getEvents()).toEqual([
        { adId: 100, userId, eventType: 'impression' },
      ]);
    });

    it('노출 시 일별 집계도 증가한다', async () => {
      await service.trackImpression(100, userId);
      await service.trackImpression(100, userId);

      const today = new Date().toISOString().slice(0, 10);
      const stat = repository.getDailyStat(100, today);
      expect(stat.impressions).toBe(2);
      expect(stat.clicks).toBe(0);
    });
  });

  describe('trackClick', () => {
    it('클릭 이벤트를 기록하고 성공을 반환한다', async () => {
      const result = await service.trackClick(100, userId);

      expect(result).toEqual({ success: true });
      expect(repository.getEvents()).toEqual([
        { adId: 100, userId, eventType: 'click' },
      ]);
    });

    it('클릭 시 일별 집계도 증가한다', async () => {
      await service.trackClick(100, userId);

      const today = new Date().toISOString().slice(0, 10);
      const stat = repository.getDailyStat(100, today);
      expect(stat.impressions).toBe(0);
      expect(stat.clicks).toBe(1);
    });
  });
});
