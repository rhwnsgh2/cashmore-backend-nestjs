import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LocationEngagementService } from './location-engagement.service';
import { LOCATION_ENGAGEMENT_REPOSITORY } from './interfaces/location-engagement-repository.interface';
import { StubLocationEngagementRepository } from './repositories/stub-location-engagement.repository';

describe('LocationEngagementService', () => {
  let service: LocationEngagementService;
  let repository: StubLocationEngagementRepository;

  beforeEach(async () => {
    repository = new StubLocationEngagementRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationEngagementService,
        {
          provide: LOCATION_ENGAGEMENT_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<LocationEngagementService>(LocationEngagementService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('getRankings', () => {
    it('최신 데이터가 없으면 NotFoundException을 던진다', async () => {
      await expect(service.getRankings()).rejects.toThrow(NotFoundException);
    });

    it('데이터가 있으면 date, time, rankings를 반환한다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      repository.setRows('2026-04-09', '14:00', [
        {
          sigungu_code: '11010',
          sigungu_name: '서울특별시 종로구',
          today_cumulative_count: 120,
          yesterday_cumulative_count: 100,
        },
      ]);

      const result = await service.getRankings();

      expect(result.date).toBe('2026-04-09');
      expect(result.time).toBe('14:00');
      expect(result.rankings).toHaveLength(1);
      expect(result.myRanking).toBeNull();
    });

    it('yesterday_cumulative_count가 5 미만인 항목은 제외한다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      repository.setRows('2026-04-09', '14:00', [
        {
          sigungu_code: '11010',
          sigungu_name: '서울특별시 종로구',
          today_cumulative_count: 120,
          yesterday_cumulative_count: 100,
        },
        {
          sigungu_code: '11020',
          sigungu_name: '서울특별시 중구',
          today_cumulative_count: 3,
          yesterday_cumulative_count: 4,
        },
      ]);

      const result = await service.getRankings();

      expect(result.rankings).toHaveLength(1);
      expect(result.rankings[0].sigungu_code).toBe('11010');
    });

    it('yesterday_cumulative_count가 정확히 5이면 포함한다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      repository.setRows('2026-04-09', '14:00', [
        {
          sigungu_code: '11010',
          sigungu_name: '서울특별시 종로구',
          today_cumulative_count: 10,
          yesterday_cumulative_count: 5,
        },
      ]);

      const result = await service.getRankings();

      expect(result.rankings).toHaveLength(1);
    });

    it('증가율 내림차순으로 정렬한다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      repository.setRows('2026-04-09', '14:00', [
        {
          sigungu_code: '11010',
          sigungu_name: '서울특별시 종로구',
          today_cumulative_count: 110,
          yesterday_cumulative_count: 100, // +10%
        },
        {
          sigungu_code: '11020',
          sigungu_name: '서울특별시 중구',
          today_cumulative_count: 150,
          yesterday_cumulative_count: 100, // +50%
        },
        {
          sigungu_code: '11030',
          sigungu_name: '서울특별시 용산구',
          today_cumulative_count: 130,
          yesterday_cumulative_count: 100, // +30%
        },
      ]);

      const result = await service.getRankings();

      expect(result.rankings[0].sigungu_code).toBe('11020'); // +50%
      expect(result.rankings[0].rank).toBe(1);
      expect(result.rankings[1].sigungu_code).toBe('11030'); // +30%
      expect(result.rankings[1].rank).toBe(2);
      expect(result.rankings[2].sigungu_code).toBe('11010'); // +10%
      expect(result.rankings[2].rank).toBe(3);
    });

    it('상위 100개까지만 rankings에 포함한다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      const rows = Array.from({ length: 120 }, (_, i) => ({
        sigungu_code: `code-${i}`,
        sigungu_name: `시군구 ${i}`,
        today_cumulative_count: 200 - i,
        yesterday_cumulative_count: 100,
      }));
      repository.setRows('2026-04-09', '14:00', rows);

      const result = await service.getRankings();

      expect(result.rankings).toHaveLength(100);
    });

    it('sigungu_name이 3단어 이상이면 뒤 2단어만 사용한다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      repository.setRows('2026-04-09', '14:00', [
        {
          sigungu_code: '11010',
          sigungu_name: '서울특별시 강남구 역삼동',
          today_cumulative_count: 120,
          yesterday_cumulative_count: 100,
        },
      ]);

      const result = await service.getRankings();

      expect(result.rankings[0].sigungu_name).toBe('강남구 역삼동');
    });

    it('sigungu_name이 2단어면 그대로 사용한다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      repository.setRows('2026-04-09', '14:00', [
        {
          sigungu_code: '11010',
          sigungu_name: '서울특별시 종로구',
          today_cumulative_count: 120,
          yesterday_cumulative_count: 100,
        },
      ]);

      const result = await service.getRankings();

      expect(result.rankings[0].sigungu_name).toBe('서울특별시 종로구');
    });

    it('sigunguCode를 지정하면 myRanking을 반환한다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      repository.setRows('2026-04-09', '14:00', [
        {
          sigungu_code: '11010',
          sigungu_name: '서울특별시 종로구',
          today_cumulative_count: 150,
          yesterday_cumulative_count: 100, // +50%
        },
        {
          sigungu_code: '11020',
          sigungu_name: '서울특별시 중구',
          today_cumulative_count: 110,
          yesterday_cumulative_count: 100, // +10%
        },
      ]);

      const result = await service.getRankings('11020');

      expect(result.myRanking).not.toBeNull();
      expect(result.myRanking!.sigungu_code).toBe('11020');
      expect(result.myRanking!.rank).toBe(2);
    });

    it('sigunguCode에 해당하는 데이터가 없으면 myRanking은 null이다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      repository.setRows('2026-04-09', '14:00', [
        {
          sigungu_code: '11010',
          sigungu_name: '서울특별시 종로구',
          today_cumulative_count: 120,
          yesterday_cumulative_count: 100,
        },
      ]);

      const result = await service.getRankings('99999');

      expect(result.myRanking).toBeNull();
    });

    it('myRanking이 top100 밖에 있어도 찾을 수 있다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      const rows = Array.from({ length: 110 }, (_, i) => ({
        sigungu_code: `code-${i}`,
        sigungu_name: `시군구 ${i}`,
        today_cumulative_count: 300 - i,
        yesterday_cumulative_count: 100,
      }));
      repository.setRows('2026-04-09', '14:00', rows);

      const result = await service.getRankings('code-105');

      expect(result.rankings).toHaveLength(100);
      expect(result.myRanking).not.toBeNull();
      expect(result.myRanking!.sigungu_code).toBe('code-105');
      expect(result.myRanking!.rank).toBe(106);
    });

    it('sigunguCode를 지정하지 않으면 myRanking은 null이다', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      repository.setRows('2026-04-09', '14:00', [
        {
          sigungu_code: '11010',
          sigungu_name: '서울특별시 종로구',
          today_cumulative_count: 120,
          yesterday_cumulative_count: 100,
        },
      ]);

      const result = await service.getRankings();

      expect(result.myRanking).toBeNull();
    });

    it('감소율도 올바르게 정렬한다 (음수 증가율)', async () => {
      repository.setLatestTimestamp({ date: '2026-04-09', time: '14:00' });
      repository.setRows('2026-04-09', '14:00', [
        {
          sigungu_code: '11010',
          sigungu_name: '서울특별시 종로구',
          today_cumulative_count: 80,
          yesterday_cumulative_count: 100, // -20%
        },
        {
          sigungu_code: '11020',
          sigungu_name: '서울특별시 중구',
          today_cumulative_count: 50,
          yesterday_cumulative_count: 100, // -50%
        },
      ]);

      const result = await service.getRankings();

      expect(result.rankings[0].sigungu_code).toBe('11010'); // -20% > -50%
      expect(result.rankings[1].sigungu_code).toBe('11020');
    });
  });
});
