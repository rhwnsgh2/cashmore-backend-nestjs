import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { generateHmac } from './utils/hmac-generator';
import type { GoldBoxProductDto } from './dto/goldbox-product.dto';
import type { ICoupangVisitRepository } from './interfaces/coupang-visit-repository.interface';
import { COUPANG_VISIT_REPOSITORY } from './interfaces/coupang-visit-repository.interface';
import type { IPointWriteService } from '../point-write/point-write.interface';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';

dayjs.extend(utc);
dayjs.extend(timezone);

const COUPANG_DOMAIN = 'https://api-gateway.coupang.com';
const GOLDBOX_PATH =
  '/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox';
const GOLDBOX_QUERY = 'subId=AF6906631&imageSize=140x140';

const CACHE_KEY = 'coupang:goldbox:products';
const CACHE_TTL = 86400; // 24시간

const V2_COOLDOWN_HOURS = 10;
const V2_COOLDOWN_MS = V2_COOLDOWN_HOURS * 60 * 60 * 1000;
const V2_POINT_AMOUNT = 7;

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
    const today = this.getTodayKST();

    const existing = await this.visitRepository.findByUserIdAndDate(
      userId,
      today,
    );
    if (existing) {
      return { success: false, message: 'Already received' };
    }

    let visit;
    try {
      visit = await this.visitRepository.insertVisit(userId, today, 10);
    } catch {
      return { success: false, message: 'Already received' };
    }

    await this.pointWriteService.addPoint({
      userId,
      amount: 10,
      type: 'COUPANG_VISIT',
      additionalData: { coupang_visit_id: visit.id },
    });

    return { success: true };
  }

  async getTodayVisitStatus(
    userId: string,
  ): Promise<{ hasVisitedToday: boolean }> {
    const today = this.getTodayKST();
    const existing = await this.visitRepository.findByUserIdAndDate(
      userId,
      today,
    );
    return { hasVisitedToday: existing !== null };
  }

  async recordVisitV2(
    userId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const latest = await this.visitRepository.findLatestByUserId(userId);
    const now = Date.now();

    if (latest) {
      const elapsed = now - new Date(latest.createdAt).getTime();
      if (elapsed < V2_COOLDOWN_MS) {
        return { success: false, message: 'Cooldown not passed' };
      }
    }

    const today = this.getTodayKST();
    const visit = await this.visitRepository.insertVisit(
      userId,
      today,
      V2_POINT_AMOUNT,
    );

    await this.pointWriteService.addPoint({
      userId,
      amount: V2_POINT_AMOUNT,
      type: 'COUPANG_VISIT',
      additionalData: { coupang_visit_id: visit.id },
    });

    return { success: true };
  }

  async getVisitStatusV2(userId: string): Promise<{
    canVisit: boolean;
    lastVisitedAt: string | null;
    nextAvailableAt: string | null;
    remainingSeconds: number;
  }> {
    const latest = await this.visitRepository.findLatestByUserId(userId);

    if (!latest) {
      return {
        canVisit: true,
        lastVisitedAt: null,
        nextAvailableAt: null,
        remainingSeconds: 0,
      };
    }

    const lastVisitedAt = new Date(latest.createdAt);
    const nextAvailableAt = new Date(lastVisitedAt.getTime() + V2_COOLDOWN_MS);
    const remainingMs = nextAvailableAt.getTime() - Date.now();
    const canVisit = remainingMs <= 0;

    return {
      canVisit,
      lastVisitedAt: lastVisitedAt.toISOString(),
      nextAvailableAt: nextAvailableAt.toISOString(),
      remainingSeconds: canVisit ? 0 : Math.ceil(remainingMs / 1000),
    };
  }

  private getTodayKST(): string {
    return dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
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
