import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CoupangService } from './coupang.service';
import { COUPANG_VISIT_REPOSITORY } from './interfaces/coupang-visit-repository.interface';
import { StubCoupangVisitRepository } from './repositories/stub-coupang-visit.repository';

// Redis mock
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
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

  beforeEach(async () => {
    vi.clearAllMocks();
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

      const visit = await stubVisitRepo.findTodayVisit(userId);
      expect(visit).not.toBeNull();
      expect(visit!.pointAmount).toBe(10);
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

      const visit = await stubVisitRepo.findTodayVisit('user-B');
      expect(visit!.pointAmount).toBe(10);
    });
  });
});
