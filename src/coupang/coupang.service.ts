import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { generateHmac } from './utils/hmac-generator';
import type { GoldBoxProductDto } from './dto/goldbox-product.dto';
import type { ICoupangVisitRepository } from './interfaces/coupang-visit-repository.interface';
import { COUPANG_VISIT_REPOSITORY } from './interfaces/coupang-visit-repository.interface';
import type { IPointWriteService } from '../point-write/point-write.interface';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';

const COUPANG_DOMAIN = 'https://api-gateway.coupang.com';
const GOLDBOX_PATH =
  '/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox';
const GOLDBOX_QUERY = 'subId=AF6906631&imageSize=140x140';

const CACHE_KEY = 'coupang:goldbox:products';
const CACHE_TTL = 86400; // 24시간

interface GoldBoxItem {
  productId: number;
  productName: string;
  productImage: string;
  productPrice: number;
  productUrl: string;
  categoryName: string;
  keyword: string;
  rank: number;
  isRocket: boolean;
  isFreeShipping: boolean;
  badge: string | null;
  discountRate?: number;
  originalPrice?: number;
}

interface GoldBoxApiResponse {
  rCode: string;
  rMessage: string;
  data: GoldBoxItem[];
}

@Injectable()
export class CoupangService {
  private readonly logger = new Logger(CoupangService.name);
  private readonly redis: Redis;
  private readonly accessKey: string;
  private readonly secretKey: string;

  constructor(
    private configService: ConfigService,
    @Inject(COUPANG_VISIT_REPOSITORY)
    private visitRepository: ICoupangVisitRepository,
    @Inject(POINT_WRITE_SERVICE)
    private pointWriteService: IPointWriteService,
  ) {
    this.redis = Redis.fromEnv();
    this.accessKey = this.configService.get<string>('coupang.accessKey') ?? '';
    this.secretKey = this.configService.get<string>('coupang.secretKey') ?? '';
  }

  async getGoldBoxProducts(): Promise<GoldBoxProductDto[]> {
    const cached = await this.redis.get<GoldBoxProductDto[]>(CACHE_KEY);
    if (cached) {
      return cached;
    }

    const items = await this.fetchGoldBox();
    if (!items || items.length === 0) {
      return [];
    }

    const products = items.slice(0, 10).map((item) => {
      let discountText = '특가';
      if (item.discountRate) {
        discountText = `${item.discountRate}%`;
      } else if (item.badge) {
        const discountMatch = item.badge.match(/(\d+)%/);
        if (discountMatch) {
          discountText = `${discountMatch[0]}`;
        }
      }

      return {
        id: item.productId.toString(),
        name: item.productName,
        discount: discountText,
        price: `${item.productPrice.toLocaleString()}원`,
        image: item.productImage,
        link: item.productUrl,
      };
    });

    await this.redis.setex(CACHE_KEY, CACHE_TTL, products);

    return products;
  }

  async recordVisit(
    userId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const existing = await this.visitRepository.findTodayVisit(userId);

    if (existing) {
      return { success: false, message: 'Already received' };
    }

    await this.pointWriteService.addPoint({
      userId,
      amount: 10,
      type: 'COUPANG_VISIT',
      additionalData: {},
    });

    return { success: true };
  }

  private async fetchGoldBox(): Promise<GoldBoxItem[]> {
    const method = 'GET';
    const url = `${GOLDBOX_PATH}?${GOLDBOX_QUERY}`;

    const authorization = generateHmac(
      method,
      url,
      this.secretKey,
      this.accessKey,
    );

    try {
      const response = await fetch(`${COUPANG_DOMAIN}${url}`, {
        method,
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API Error: ${errorData.message || response.statusText}`,
        );
      }

      const data: GoldBoxApiResponse = await response.json();

      if (data.rCode !== '0') {
        throw new Error(`API Error: ${data.rMessage}`);
      }

      return data.data;
    } catch (error) {
      this.logger.error('Error fetching Coupang GoldBox:', error);
      return [];
    }
  }
}
