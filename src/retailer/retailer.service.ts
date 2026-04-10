import { Inject, Injectable } from '@nestjs/common';
import type { IRetailerRepository } from './interfaces/retailer-repository.interface';
import { RETAILER_REPOSITORY } from './interfaces/retailer-repository.interface';

export type RetailerCategory = 'cafe' | 'restaurant' | 'bar';

export interface RetailerBasic {
  id: number;
  title: string;
  address: string;
  lat: number;
  lng: number;
  category: RetailerCategory;
  isPartner: boolean;
  customCashbackText: string;
  keywords: string[];
  isVisible: boolean;
  createdAt: string;
  logoUrl: string | null;
  thumbnailUrl: string | null;
}

function mapCategory(category: string): RetailerCategory {
  if (category === '카페') return 'cafe';
  if (category === '주점') return 'bar';
  return 'restaurant';
}

@Injectable()
export class RetailerService {
  constructor(
    @Inject(RETAILER_REPOSITORY)
    private repository: IRetailerRepository,
  ) {}

  async getRetailersCashback(): Promise<
    { retailerId: number; cashbackPercent: number; type: string; reason: string }[]
  > {
    const [locations, cashbackRates] = await Promise.all([
      this.repository.findVisibleLocations(),
      this.repository.findBaseCashbackRates(),
    ]);

    const rateMap = new Map<number, { minRate: number; maxRate: number }>();
    for (const rate of cashbackRates) {
      rateMap.set(rate.location_id, {
        minRate: rate.min_rate,
        maxRate: rate.max_rate,
      });
    }

    return locations.map((location) => {
      const settings = rateMap.get(location.id);
      return {
        retailerId: location.id,
        cashbackPercent: settings?.maxRate ?? 0.2,
        type: 'default',
        reason: '기본 캐시백',
      };
    });
  }

  async getRetailers(): Promise<RetailerBasic[]> {
    const [locations, images] = await Promise.all([
      this.repository.findVisibleLocations(),
      this.repository.findLocationImages(),
    ]);

    // 각 location의 첫 번째 이미지만 매핑
    const thumbnailMap = new Map<number, string>();
    for (const img of images) {
      if (!thumbnailMap.has(img.location_id)) {
        thumbnailMap.set(img.location_id, img.image_url);
      }
    }

    return locations.map((item) => {
      const [lng, lat] = item.location.coordinates;

      return {
        id: item.id,
        title: item.title,
        address: item.address,
        lat,
        lng,
        category: mapCategory(item.category),
        isPartner: item.is_partner,
        customCashbackText: item.custom_cashback_text,
        keywords: item.keywords,
        isVisible: item.is_visible,
        createdAt: item.created_at,
        logoUrl: item.logo_url,
        thumbnailUrl: thumbnailMap.get(item.id) || null,
      };
    });
  }
}
