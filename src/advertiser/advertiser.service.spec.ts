import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { AdvertiserService } from './advertiser.service';
import { ADVERTISER_REPOSITORY } from './interfaces/advertiser-repository.interface';
import { StubAdvertiserRepository } from './repositories/stub-advertiser.repository';

describe('AdvertiserService', () => {
  let service: AdvertiserService;
  let repository: StubAdvertiserRepository;

  beforeEach(async () => {
    repository = new StubAdvertiserRepository();

    const module = await Test.createTestingModule({
      providers: [
        AdvertiserService,
        { provide: ADVERTISER_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get(AdvertiserService);
  });

  describe('getStats', () => {
    it('일별 통계를 CTR과 함께 반환한다', async () => {
      repository.setStats([
        {
          ad_id: 1,
          ad_title: '프로모션 A',
          stat_date: '2026-04-10',
          impressions: 1000,
          clicks: 50,
        },
        {
          ad_id: 2,
          ad_title: '프로모션 B',
          stat_date: '2026-04-10',
          impressions: 2000,
          clicks: 30,
        },
      ]);

      const result = await service.getStats(1, '2026-04-10', '2026-04-10');

      expect(result.stats).toHaveLength(2);
      expect(result.stats[0]).toEqual({
        adId: 1,
        adTitle: '프로모션 A',
        date: '2026-04-10',
        impressions: 1000,
        clicks: 50,
        ctr: 5.0,
      });
      expect(result.stats[1]).toEqual({
        adId: 2,
        adTitle: '프로모션 B',
        date: '2026-04-10',
        impressions: 2000,
        clicks: 30,
        ctr: 1.5,
      });
    });

    it('노출이 0인 경우 CTR은 0을 반환한다', async () => {
      repository.setStats([
        {
          ad_id: 1,
          ad_title: '프로모션 A',
          stat_date: '2026-04-10',
          impressions: 0,
          clicks: 0,
        },
      ]);

      const result = await service.getStats(1, '2026-04-10', '2026-04-10');

      expect(result.stats[0].ctr).toBe(0);
    });

    it('통계가 없는 경우 빈 배열을 반환한다', async () => {
      repository.setStats([]);

      const result = await service.getStats(1, '2026-04-10', '2026-04-10');

      expect(result.stats).toEqual([]);
    });

    it('startDate/endDate가 없으면 기본값으로 최근 7일을 사용한다', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      repository.setStats([
        {
          ad_id: 1,
          ad_title: '프로모션 A',
          stat_date: today,
          impressions: 500,
          clicks: 25,
        },
        {
          ad_id: 1,
          ad_title: '프로모션 A',
          stat_date: sevenDaysAgo,
          impressions: 300,
          clicks: 10,
        },
      ]);

      const result = await service.getStats(1);

      expect(result.stats).toHaveLength(2);
    });

    it('날짜 범위 밖의 통계는 제외된다', async () => {
      repository.setStats([
        {
          ad_id: 1,
          ad_title: '프로모션 A',
          stat_date: '2026-04-05',
          impressions: 100,
          clicks: 5,
        },
        {
          ad_id: 1,
          ad_title: '프로모션 A',
          stat_date: '2026-04-10',
          impressions: 200,
          clicks: 10,
        },
        {
          ad_id: 1,
          ad_title: '프로모션 A',
          stat_date: '2026-04-15',
          impressions: 300,
          clicks: 15,
        },
      ]);

      const result = await service.getStats(1, '2026-04-08', '2026-04-12');

      expect(result.stats).toHaveLength(1);
      expect(result.stats[0].date).toBe('2026-04-10');
    });

    it('CTR은 소수점 둘째 자리까지 반올림한다', async () => {
      repository.setStats([
        {
          ad_id: 1,
          ad_title: '프로모션 A',
          stat_date: '2026-04-10',
          impressions: 3,
          clicks: 1,
        },
      ]);

      const result = await service.getStats(1, '2026-04-10', '2026-04-10');

      // 1/3 = 33.333...% → 33.33%
      expect(result.stats[0].ctr).toBe(33.33);
    });

    it('결과는 날짜 내림차순, 같은 날짜면 광고 ID 오름차순으로 정렬된다', async () => {
      repository.setStats([
        {
          ad_id: 2,
          ad_title: 'B',
          stat_date: '2026-04-09',
          impressions: 100,
          clicks: 5,
        },
        {
          ad_id: 1,
          ad_title: 'A',
          stat_date: '2026-04-10',
          impressions: 200,
          clicks: 10,
        },
        {
          ad_id: 1,
          ad_title: 'A',
          stat_date: '2026-04-09',
          impressions: 150,
          clicks: 8,
        },
        {
          ad_id: 2,
          ad_title: 'B',
          stat_date: '2026-04-10',
          impressions: 300,
          clicks: 15,
        },
      ]);

      const result = await service.getStats(1, '2026-04-09', '2026-04-10');

      expect(result.stats.map((s) => `${s.date}:${s.adId}`)).toEqual([
        '2026-04-10:1',
        '2026-04-10:2',
        '2026-04-09:1',
        '2026-04-09:2',
      ]);
    });
  });
});
