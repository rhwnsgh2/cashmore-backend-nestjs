import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CoupangService } from './coupang.service';
import { COUPANG_VISIT_REPOSITORY } from './interfaces/coupang-visit-repository.interface';
import { StubCoupangVisitRepository } from './repositories/stub-coupang-visit.repository';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { PointWriteService } from '../point-write/point-write.service';
import { StubPointWriteRepository } from '../point-write/repositories/stub-point-write.repository';

// Redis mock
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  set: vi.fn(),
};

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => mockRedis,
  },
}));

// fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CoupangService', () => {
  let service: CoupangService;
  let stubVisitRepo: StubCoupangVisitRepository;
  let stubPointWriteRepo: StubPointWriteRepository;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    stubPointWriteRepo = new StubPointWriteRepository();
    stubVisitRepo = new StubCoupangVisitRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoupangService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const config: Record<string, string> = {
                'coupang.accessKey': 'test-access-key',
                'coupang.secretKey': 'test-secret-key',
              };
              return config[key];
            },
          },
        },
        {
          provide: COUPANG_VISIT_REPOSITORY,
          useValue: stubVisitRepo,
        },
        {
          provide: POINT_WRITE_SERVICE,
          useFactory: () => new PointWriteService(stubPointWriteRepo),
        },
      ],
    }).compile();

    service = module.get<CoupangService>(CoupangService);
  });

  describe('getGoldBoxProducts', () => {
    it('캐시된 데이터가 있으면 캐시를 반환한다', async () => {
      const cachedProducts = [
        {
          id: '1',
          name: '테스트 상품',
          discount: '30%',
          price: '10,000원',
          image: 'https://img.com/1.jpg',
          link: 'https://link.com/1',
        },
      ];
      mockRedis.get.mockResolvedValue(cachedProducts);

      const result = await service.getGoldBoxProducts();

      expect(result).toEqual(cachedProducts);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('캐시가 없으면 API를 호출하고 결과를 캐시한다', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          rCode: '0',
          rMessage: 'OK',
          data: [
            {
              productId: 123,
              productName: '테스트 상품',
              productImage: 'https://img.com/1.jpg',
              productPrice: 15000,
              productUrl: 'https://link.com/1',
              categoryName: '전자',
              keyword: '가전',
              rank: 1,
              isRocket: true,
              isFreeShipping: true,
              badge: null,
              discountRate: 25,
            },
          ],
        }),
      });

      const result = await service.getGoldBoxProducts();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '123',
        name: '테스트 상품',
        discount: '25%',
        price: '15,000원',
        image: 'https://img.com/1.jpg',
        link: 'https://link.com/1',
      });
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'coupang:goldbox:products',
        86400,
        result,
      );
    });

    it('discountRate 없고 badge에 할인율이 있으면 badge에서 추출한다', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          rCode: '0',
          rMessage: 'OK',
          data: [
            {
              productId: 456,
              productName: '뱃지 상품',
              productImage: 'https://img.com/2.jpg',
              productPrice: 20000,
              productUrl: 'https://link.com/2',
              categoryName: '패션',
              keyword: '의류',
              rank: 1,
              isRocket: false,
              isFreeShipping: false,
              badge: '최대 40% 할인',
            },
          ],
        }),
      });

      const result = await service.getGoldBoxProducts();

      expect(result[0].discount).toBe('40%');
    });

    it('할인 정보가 없으면 "특가"를 표시한다', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          rCode: '0',
          rMessage: 'OK',
          data: [
            {
              productId: 789,
              productName: '할인없는 상품',
              productImage: 'https://img.com/3.jpg',
              productPrice: 30000,
              productUrl: 'https://link.com/3',
              categoryName: '기타',
              keyword: '기타',
              rank: 1,
              isRocket: false,
              isFreeShipping: false,
              badge: null,
            },
          ],
        }),
      });

      const result = await service.getGoldBoxProducts();

      expect(result[0].discount).toBe('특가');
    });

    it('API 에러 시 빈 배열을 반환한다', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.getGoldBoxProducts();

      expect(result).toEqual([]);
    });

    it('최대 10개 상품만 반환한다', async () => {
      mockRedis.get.mockResolvedValue(null);
      const items = Array.from({ length: 15 }, (_, i) => ({
        productId: i + 1,
        productName: `상품 ${i + 1}`,
        productImage: `https://img.com/${i + 1}.jpg`,
        productPrice: 10000 * (i + 1),
        productUrl: `https://link.com/${i + 1}`,
        categoryName: '카테고리',
        keyword: '키워드',
        rank: i + 1,
        isRocket: false,
        isFreeShipping: false,
        badge: null,
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          rCode: '0',
          rMessage: 'OK',
          data: items,
        }),
      });

      const result = await service.getGoldBoxProducts();

      expect(result).toHaveLength(10);
    });

    it('API 응답이 빈 배열이면 빈 배열을 반환하고 캐시하지 않는다', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          rCode: '0',
          rMessage: 'OK',
          data: [],
        }),
      });

      const result = await service.getGoldBoxProducts();

      expect(result).toEqual([]);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('recordVisit', () => {
    const userId = 'user-1';

    it('처음 방문 시 포인트를 지급하고 success: true를 반환한다', async () => {
      const result = await service.recordVisit(userId);

      expect(result).toEqual({ success: true });
    });

    it('10P를 지급한다', async () => {
      await service.recordVisit(userId);

      const visits = stubVisitRepo.getInsertedVisits();
      expect(visits).toHaveLength(1);
      expect(visits[0].pointAmount).toBe(10);
    });

    it('오늘 이미 받았으면 success: false와 Already received 메시지를 반환한다', async () => {
      await service.recordVisit(userId);

      const result = await service.recordVisit(userId);

      expect(result).toEqual({ success: false, message: 'Already received' });
    });

    it('다른 유저는 독립적으로 포인트를 받을 수 있다', async () => {
      await service.recordVisit('user-A');
      const result = await service.recordVisit('user-B');

      expect(result).toEqual({ success: true });
    });

    it('이미 받은 유저도 다른 유저의 방문에 영향을 주지 않는다', async () => {
      await service.recordVisit('user-A');
      await service.recordVisit('user-A'); // 중복

      const result = await service.recordVisit('user-B');
      expect(result).toEqual({ success: true });

      const userBVisits = stubVisitRepo
        .getInsertedVisits()
        .filter((v) => v.userId === 'user-B');
      expect(userBVisits).toHaveLength(1);
      expect(userBVisits[0].pointAmount).toBe(10);
    });

    it('성공 시 coupang_visits에 행이 생성된다', async () => {
      await service.recordVisit(userId);

      const visits = stubVisitRepo.getInsertedVisits();
      expect(visits).toHaveLength(1);
      expect(visits[0].userId).toBe(userId);
      expect(visits[0].pointAmount).toBe(10);
    });

    it('point_actions의 additional_data에 coupang_visit_id가 들어간다', async () => {
      await service.recordVisit(userId);

      const actions = stubPointWriteRepo.getInsertedActions();
      const visitAction = actions.find((a) => a.type === 'COUPANG_VISIT');
      const visits = stubVisitRepo.getInsertedVisits();

      expect(visitAction?.additionalData).toEqual({
        coupang_visit_id: visits[0].id,
      });
    });

    it('이미 받은 경우 coupang_visits에 추가 행이 생기지 않는다', async () => {
      await service.recordVisit(userId);
      await service.recordVisit(userId);

      const visits = stubVisitRepo.getInsertedVisits();
      expect(visits).toHaveLength(1);
    });
  });

  describe('getTodayVisitStatus', () => {
    const userId = 'user-1';

    it('오늘 방문 기록이 없으면 hasVisitedToday: false를 반환한다', async () => {
      const result = await service.getTodayVisitStatus(userId);

      expect(result).toEqual({ hasVisitedToday: false });
    });

    it('오늘 방문 기록이 있으면 hasVisitedToday: true를 반환한다', async () => {
      await service.recordVisit(userId);

      const result = await service.getTodayVisitStatus(userId);

      expect(result).toEqual({ hasVisitedToday: true });
    });

    it('다른 유저의 방문 기록은 영향을 주지 않는다', async () => {
      await service.recordVisit('user-A');

      const result = await service.getTodayVisitStatus('user-B');

      expect(result).toEqual({ hasVisitedToday: false });
    });

    it('point_actions만 있고 coupang_visits에 없으면 false (백필 누락 케이스)', async () => {
      await stubPointWriteRepo.insertPointAction(
        userId,
        10,
        'COUPANG_VISIT',
        'done',
        {},
      );

      const result = await service.getTodayVisitStatus(userId);

      expect(result).toEqual({ hasVisitedToday: false });
    });

    it('같은 날짜에 v2로 여러 행이 쌓여 있어도 true를 반환한다', async () => {
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      stubVisitRepo.seedVisit({
        userId,
        createdAtDate: today,
        pointAmount: 7,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      });
      stubVisitRepo.seedVisit({
        userId,
        createdAtDate: today,
        pointAmount: 7,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      });

      const result = await service.getTodayVisitStatus(userId);

      expect(result).toEqual({ hasVisitedToday: true });
    });
  });

  describe('KST 날짜 변환', () => {
    const userId = 'user-1';

    it('insertVisit에 전달되는 date는 KST YYYY-MM-DD 형식이다', async () => {
      await service.recordVisit(userId);

      const visits = stubVisitRepo.getInsertedVisits();
      expect(visits).toHaveLength(1);
      expect(visits[0].createdAtDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // 현재 시각의 KST 날짜와 일치
      const expectedKstDate = new Date(Date.now() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      expect(visits[0].createdAtDate).toBe(expectedKstDate);
    });

    it('같은 KST 날짜에 호출하면 같은 createdAtDate가 된다', async () => {
      await service.recordVisit('user-A');
      await service.recordVisit('user-B');

      const visits = stubVisitRepo.getInsertedVisits();
      expect(visits).toHaveLength(2);
      expect(visits[0].createdAtDate).toBe(visits[1].createdAtDate);
    });
  });

  describe('recordVisitV2 (10시간 쿨다운)', () => {
    const userId = 'user-1';

    it('첫 방문이면 7P를 지급하고 success: true를 반환한다', async () => {
      const result = await service.recordVisitV2(userId);

      expect(result).toEqual({ success: true });

      const visits = stubVisitRepo.getInsertedVisits();
      expect(visits).toHaveLength(1);
      expect(visits[0].pointAmount).toBe(7);
    });

    it('마지막 방문으로부터 10시간이 안 지났으면 거부한다', async () => {
      const sixHoursAgo = new Date(
        Date.now() - 6 * 60 * 60 * 1000,
      ).toISOString();
      stubVisitRepo.seedVisit({
        userId,
        createdAtDate: sixHoursAgo.slice(0, 10),
        pointAmount: 7,
        createdAt: sixHoursAgo,
      });

      const result = await service.recordVisitV2(userId);

      expect(result).toEqual({
        success: false,
        message: 'Cooldown not passed',
      });
      expect(stubVisitRepo.getInsertedVisits()).toHaveLength(1);
    });

    it('마지막 방문으로부터 정확히 10시간이 지나면 받을 수 있다', async () => {
      const tenHoursAgo = new Date(
        Date.now() - 10 * 60 * 60 * 1000,
      ).toISOString();
      stubVisitRepo.seedVisit({
        userId,
        createdAtDate: tenHoursAgo.slice(0, 10),
        pointAmount: 7,
        createdAt: tenHoursAgo,
      });

      const result = await service.recordVisitV2(userId);

      expect(result).toEqual({ success: true });
      expect(stubVisitRepo.getInsertedVisits()).toHaveLength(2);
    });

    it('10시간 - 1초 경과면 거부 (경계값)', async () => {
      const justUnder = new Date(
        Date.now() - (10 * 60 * 60 * 1000 - 1000),
      ).toISOString();
      stubVisitRepo.seedVisit({
        userId,
        createdAtDate: justUnder.slice(0, 10),
        pointAmount: 7,
        createdAt: justUnder,
      });

      const result = await service.recordVisitV2(userId);

      expect(result.success).toBe(false);
    });

    it('하루에 여러 번 받을 수 있다 (같은 날짜 중복 insert 허용)', async () => {
      const elevenHoursAgo = new Date(
        Date.now() - 11 * 60 * 60 * 1000,
      ).toISOString();
      const today = elevenHoursAgo.slice(0, 10);
      stubVisitRepo.seedVisit({
        userId,
        createdAtDate: today,
        pointAmount: 7,
        createdAt: elevenHoursAgo,
      });

      const result = await service.recordVisitV2(userId);

      expect(result).toEqual({ success: true });
    });

    it('point_actions에 7P + COUPANG_VISIT 타입이 기록된다', async () => {
      await service.recordVisitV2(userId);

      const actions = stubPointWriteRepo.getInsertedActions();
      const visitAction = actions.find((a) => a.type === 'COUPANG_VISIT');
      expect(visitAction?.amount).toBe(7);

      const visits = stubVisitRepo.getInsertedVisits();
      expect(visitAction?.additionalData).toEqual({
        coupang_visit_id: visits[0].id,
      });
    });

    it('다른 유저의 최근 방문은 영향을 주지 않는다', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      stubVisitRepo.seedVisit({
        userId: 'user-A',
        createdAtDate: oneHourAgo.slice(0, 10),
        pointAmount: 7,
        createdAt: oneHourAgo,
      });

      const result = await service.recordVisitV2('user-B');

      expect(result).toEqual({ success: true });
    });

    it('동시 호출 시 락을 획득하지 못한 요청은 거부된다', async () => {
      mockRedis.set.mockResolvedValueOnce(null);

      const result = await service.recordVisitV2(userId);

      expect(result).toEqual({
        success: false,
        message: 'Cooldown not passed',
      });
      expect(stubVisitRepo.getInsertedVisits()).toHaveLength(0);
      expect(stubPointWriteRepo.getInsertedActions()).toHaveLength(0);
    });

    it('락 키는 userId 기반이고 NX + 5초 TTL로 설정된다', async () => {
      await service.recordVisitV2(userId);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `coupang:visit:v2:lock:${userId}`,
        '1',
        { nx: true, ex: 5 },
      );
    });

    it('Redis 장애 시 fail-open으로 진행되어 보상이 지급된다', async () => {
      mockRedis.set.mockRejectedValueOnce(
        new Error('redis connection refused'),
      );

      const result = await service.recordVisitV2(userId);

      expect(result).toEqual({ success: true });
      expect(stubVisitRepo.getInsertedVisits()).toHaveLength(1);
    });

    it('두 번째 동시 호출은 락에서 막혀 쿨다운 체크조차 도달하지 않는다', async () => {
      const findSpy = vi.spyOn(stubVisitRepo, 'findLatestByUserId');
      mockRedis.set.mockResolvedValueOnce(null);

      await service.recordVisitV2(userId);

      expect(findSpy).not.toHaveBeenCalled();
    });
  });

  describe('getVisitStatusV2', () => {
    const userId = 'user-1';

    it('방문 이력이 없으면 canVisit: true, 모든 시각은 null', async () => {
      const result = await service.getVisitStatusV2(userId);

      expect(result).toEqual({
        canVisit: true,
        lastVisitedAt: null,
        nextAvailableAt: null,
        remainingSeconds: 0,
      });
    });

    it('쿨다운 중이면 canVisit: false와 남은 시간을 반환한다', async () => {
      const threeHoursAgo = new Date(
        Date.now() - 3 * 60 * 60 * 1000,
      ).toISOString();
      stubVisitRepo.seedVisit({
        userId,
        createdAtDate: threeHoursAgo.slice(0, 10),
        pointAmount: 7,
        createdAt: threeHoursAgo,
      });

      const result = await service.getVisitStatusV2(userId);

      expect(result.canVisit).toBe(false);
      expect(result.lastVisitedAt).toBe(threeHoursAgo);
      expect(result.nextAvailableAt).not.toBeNull();
      // 약 7시간 남음 (오차 5초 허용)
      expect(result.remainingSeconds).toBeGreaterThan(7 * 3600 - 5);
      expect(result.remainingSeconds).toBeLessThanOrEqual(7 * 3600);
    });

    it('쿨다운 경과 후면 canVisit: true, remainingSeconds 0', async () => {
      const twelveHoursAgo = new Date(
        Date.now() - 12 * 60 * 60 * 1000,
      ).toISOString();
      stubVisitRepo.seedVisit({
        userId,
        createdAtDate: twelveHoursAgo.slice(0, 10),
        pointAmount: 7,
        createdAt: twelveHoursAgo,
      });

      const result = await service.getVisitStatusV2(userId);

      expect(result.canVisit).toBe(true);
      expect(result.lastVisitedAt).toBe(twelveHoursAgo);
      expect(result.remainingSeconds).toBe(0);
    });

    it('여러 방문 중 가장 최근 방문이 기준이 된다', async () => {
      const twentyHoursAgo = new Date(
        Date.now() - 20 * 60 * 60 * 1000,
      ).toISOString();
      const twoHoursAgo = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      ).toISOString();

      stubVisitRepo.seedVisit({
        userId,
        createdAtDate: twentyHoursAgo.slice(0, 10),
        pointAmount: 7,
        createdAt: twentyHoursAgo,
      });
      stubVisitRepo.seedVisit({
        userId,
        createdAtDate: twoHoursAgo.slice(0, 10),
        pointAmount: 7,
        createdAt: twoHoursAgo,
      });

      const result = await service.getVisitStatusV2(userId);

      expect(result.canVisit).toBe(false);
      expect(result.lastVisitedAt).toBe(twoHoursAgo);
    });
  });

  describe('insertVisit DB 에러 처리', () => {
    const userId = 'user-1';

    it('insertVisit가 일반 DB 에러를 throw해도 Already received로 응답한다', async () => {
      const originalInsert = stubVisitRepo.insertVisit.bind(stubVisitRepo);
      stubVisitRepo.insertVisit = async () => {
        throw new Error('connection reset by peer');
      };

      const result = await service.recordVisit(userId);

      expect(result).toEqual({ success: false, message: 'Already received' });
      expect(stubPointWriteRepo.getInsertedActions()).toHaveLength(0);

      stubVisitRepo.insertVisit = originalInsert;
    });
  });
});
