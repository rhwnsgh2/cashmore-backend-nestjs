import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Redis } from '@upstash/redis';
import { SMARTCON_CONFIG } from '../smartcon/smartcon.constants';
import {
  GIFTICON_PRODUCT_REPOSITORY,
  type IGifticonProductRepository,
  type CatalogItem,
  type GifticonProductRow,
  type VisibleProduct,
} from './interfaces/gifticon-product-repository.interface';
import {
  SMARTCON_GOODS_REPOSITORY,
  type ISmartconGoodsRepository,
} from '../smartcon/interfaces/smartcon-goods-repository.interface';

const VISIBLE_CACHE_KEY = 'gifticon:visible-products';
const VISIBLE_CACHE_TTL_SECONDS = 60;

@Injectable()
export class GifticonService {
  private readonly logger = new Logger(GifticonService.name);
  // 테스트 환경에선 캐시 우회 (테스트 간 격리 보장).
  private readonly redis: Redis | null;

  constructor(
    @Inject(GIFTICON_PRODUCT_REPOSITORY)
    private productRepository: IGifticonProductRepository,
    @Inject(SMARTCON_GOODS_REPOSITORY)
    private smartconGoodsRepository: ISmartconGoodsRepository,
  ) {
    this.redis = process.env.NODE_ENV === 'test' ? null : Redis.fromEnv();
  }

  /** 어드민 — 전체 카탈로그 (큐레이션 상태 포함). */
  async listCatalogForAdmin(
    eventId: string = SMARTCON_CONFIG.eventId,
  ): Promise<CatalogItem[]> {
    return this.productRepository.listCatalog(eventId);
  }

  /** 사용자 — 노출 ON 상품만. Redis 60초 캐시. */
  async listVisible(
    eventId: string = SMARTCON_CONFIG.eventId,
  ): Promise<VisibleProduct[]> {
    // 기본 eventId일 때만 캐시 (다른 eventId는 디버그 용도라 캐시 불필요)
    // 테스트 환경(redis=null)에선도 캐시 우회.
    if (!this.redis || eventId !== SMARTCON_CONFIG.eventId) {
      return this.productRepository.listVisible(eventId);
    }

    try {
      const cached = await this.redis.get<VisibleProduct[]>(VISIBLE_CACHE_KEY);
      if (cached) return cached;
    } catch (error) {
      this.logger.warn(
        `Redis get failed for ${VISIBLE_CACHE_KEY}, fallback to DB`,
        error instanceof Error ? error.message : String(error),
      );
    }

    const fresh = await this.productRepository.listVisible(eventId);

    try {
      await this.redis.setex(
        VISIBLE_CACHE_KEY,
        VISIBLE_CACHE_TTL_SECONDS,
        fresh,
      );
    } catch (error) {
      this.logger.warn(
        `Redis setex failed for ${VISIBLE_CACHE_KEY}`,
        error instanceof Error ? error.message : String(error),
      );
    }

    return fresh;
  }

  /** 어드민 큐레이션 변경 시 캐시 무효화 (curate 내부에서 호출). */
  private async invalidateVisibleCache(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(VISIBLE_CACHE_KEY);
    } catch (error) {
      this.logger.warn(
        `Redis del failed for ${VISIBLE_CACHE_KEY}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 어드민 — 큐레이션 정보 UPSERT.
   * smartcon_goods에 해당 goods_id가 존재하지 않거나 비활성이면 거부.
   */
  async curate(input: {
    goods_id: string;
    point_price: number;
    is_visible: boolean;
    display_name?: string | null;
  }): Promise<GifticonProductRow> {
    const goods = await this.smartconGoodsRepository.findById(input.goods_id);
    if (!goods) {
      throw new NotFoundException(
        `smartcon_goods not found: ${input.goods_id}`,
      );
    }
    if (!goods.is_active) {
      throw new NotFoundException(
        `smartcon_goods is inactive: ${input.goods_id}`,
      );
    }
    // 빈 문자열은 NULL로 정규화 (어드민이 명시적으로 비우면 원본 fallback)
    const displayName = input.display_name?.trim()
      ? input.display_name.trim()
      : null;
    const row = await this.productRepository.upsertCuration({
      smartcon_goods_id: input.goods_id,
      point_price: input.point_price,
      is_visible: input.is_visible,
      display_name: displayName,
    });
    // 큐레이션 변경 시 사용자 노출 캐시 무효화
    await this.invalidateVisibleCache();
    return row;
  }

  /**
   * 어드민 — 브랜드 단위 노출 순서 재배열.
   * - brand에 속한 활성 상품을 scope로 잡고, scope 내 display_order만 NULL → 보낸 순서대로 1, 2, 3.
   * - 다른 브랜드 상품은 영향 없음.
   * - goodsIds 안에 다른 브랜드 상품이 섞여 있으면 400.
   */
  async reorder(brand: string, goodsIds: string[]): Promise<void> {
    const scope =
      await this.smartconGoodsRepository.findGoodsIdsByBrand(brand);
    if (scope.length === 0) {
      throw new NotFoundException(`brand not found: ${brand}`);
    }
    const scopeSet = new Set(scope);
    const invalid = goodsIds.filter((id) => !scopeSet.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `goodsIds not in brand "${brand}": ${invalid.join(', ')}`,
      );
    }
    await this.productRepository.reorder(scope, goodsIds);
    await this.invalidateVisibleCache();
  }
}
