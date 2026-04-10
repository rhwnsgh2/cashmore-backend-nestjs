import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RetailerService } from './retailer.service';
import { RETAILER_REPOSITORY } from './interfaces/retailer-repository.interface';
import { StubRetailerRepository } from './repositories/stub-retailer.repository';

describe('RetailerService', () => {
  let service: RetailerService;
  let repository: StubRetailerRepository;

  beforeEach(async () => {
    repository = new StubRetailerRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetailerService,
        { provide: RETAILER_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<RetailerService>(RetailerService);
  });

  describe('getRetailersCashback', () => {
    it('데이터가 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getRetailersCashback();
      expect(result).toEqual([]);
    });

    it('매장별 base cashback rate를 반환한다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '매장1',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);
      repository.setCashbackRates([
        { location_id: 1, min_rate: 0.05, max_rate: 0.15 },
      ]);

      const result = await service.getRetailersCashback();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        retailerId: 1,
        cashbackPercent: 0.15,
        type: 'default',
        reason: '기본 캐시백',
      });
    });

    it('cashback_rate가 없는 매장은 기본값 0.2를 사용한다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '매장1',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);

      const result = await service.getRetailersCashback();

      expect(result[0].cashbackPercent).toBe(0.2);
    });

    it('여러 매장의 캐시백을 각각 올바르게 반환한다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '매장1',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
        {
          id: 2,
          title: '매장2',
          address: '',
          location: { coordinates: [0, 0] },
          category: '음식점',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);
      repository.setCashbackRates([
        { location_id: 1, min_rate: 0.05, max_rate: 0.15 },
        { location_id: 2, min_rate: 0.1, max_rate: 0.3 },
      ]);

      const result = await service.getRetailersCashback();

      expect(result).toHaveLength(2);
      expect(result[0].cashbackPercent).toBe(0.15);
      expect(result[1].cashbackPercent).toBe(0.3);
    });

    it('is_visible이 false인 매장은 제외한다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '보이는 매장',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
        {
          id: 2,
          title: '숨겨진 매장',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: false,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);

      const result = await service.getRetailersCashback();

      expect(result).toHaveLength(1);
      expect(result[0].retailerId).toBe(1);
    });
  });

  describe('getRetailers', () => {
    it('데이터가 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getRetailers();
      expect(result).toEqual([]);
    });

    it('location_info를 RetailerBasic으로 변환한다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '테스트 매장',
          address: '서울시 강남구',
          location: { coordinates: [127.0, 37.5] },
          category: '카페',
          is_partner: true,
          custom_cashback_text: '최대 20%',
          keywords: ['커피', '디저트'],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: 'https://example.com/logo.png',
        },
      ]);

      const result = await service.getRetailers();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        title: '테스트 매장',
        address: '서울시 강남구',
        lat: 37.5,
        lng: 127.0,
        category: 'cafe',
        isPartner: true,
        customCashbackText: '최대 20%',
        keywords: ['커피', '디저트'],
        isVisible: true,
        createdAt: '2026-01-01T00:00:00Z',
        logoUrl: 'https://example.com/logo.png',
        thumbnailUrl: null,
      });
    });

    it('좌표를 [lng, lat] → { lat, lng }로 변환한다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '매장',
          address: '주소',
          location: { coordinates: [126.978, 37.566] },
          category: '음식점',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);

      const result = await service.getRetailers();

      expect(result[0].lat).toBe(37.566);
      expect(result[0].lng).toBe(126.978);
    });

    it('카테고리를 올바르게 매핑한다 (카페→cafe)', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '카페',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);

      const result = await service.getRetailers();
      expect(result[0].category).toBe('cafe');
    });

    it('카테고리를 올바르게 매핑한다 (주점→bar)', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '주점',
          address: '',
          location: { coordinates: [0, 0] },
          category: '주점',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);

      const result = await service.getRetailers();
      expect(result[0].category).toBe('bar');
    });

    it('카테고리를 올바르게 매핑한다 (기타→restaurant)', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '식당',
          address: '',
          location: { coordinates: [0, 0] },
          category: '음식점',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);

      const result = await service.getRetailers();
      expect(result[0].category).toBe('restaurant');
    });

    it('첫 번째 이미지를 thumbnailUrl로 매핑한다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '매장',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);
      repository.setImages([
        { location_id: 1, image_url: 'https://img1.jpg', priority: 2 },
        { location_id: 1, image_url: 'https://img0.jpg', priority: 1 },
      ]);

      const result = await service.getRetailers();

      expect(result[0].thumbnailUrl).toBe('https://img0.jpg');
    });

    it('이미지가 없으면 thumbnailUrl은 null이다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '매장',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);

      const result = await service.getRetailers();

      expect(result[0].thumbnailUrl).toBeNull();
    });

    it('is_visible이 false인 항목은 제외한다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '보이는 매장',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
        {
          id: 2,
          title: '숨겨진 매장',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: false,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);

      const result = await service.getRetailers();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('보이는 매장');
    });

    it('여러 매장의 이미지를 각각 올바르게 매핑한다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '매장1',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
        {
          id: 2,
          title: '매장2',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);
      repository.setImages([
        { location_id: 1, image_url: 'https://img-a.jpg', priority: 1 },
        { location_id: 2, image_url: 'https://img-b.jpg', priority: 1 },
        { location_id: 1, image_url: 'https://img-a2.jpg', priority: 2 },
      ]);

      const result = await service.getRetailers();

      expect(result[0].thumbnailUrl).toBe('https://img-a.jpg');
      expect(result[1].thumbnailUrl).toBe('https://img-b.jpg');
    });

    it('logo_url이 null이면 null로 반환한다', async () => {
      repository.setLocations([
        {
          id: 1,
          title: '매장',
          address: '',
          location: { coordinates: [0, 0] },
          category: '카페',
          is_partner: false,
          custom_cashback_text: '',
          keywords: [],
          is_visible: true,
          created_at: '2026-01-01T00:00:00Z',
          logo_url: null,
        },
      ]);

      const result = await service.getRetailers();

      expect(result[0].logoUrl).toBeNull();
    });
  });
});
