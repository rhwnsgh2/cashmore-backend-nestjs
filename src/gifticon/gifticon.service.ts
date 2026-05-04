import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class GifticonService {
  constructor(
    @Inject(GIFTICON_PRODUCT_REPOSITORY)
    private productRepository: IGifticonProductRepository,
    @Inject(SMARTCON_GOODS_REPOSITORY)
    private smartconGoodsRepository: ISmartconGoodsRepository,
  ) {}

  /** 어드민 — 전체 카탈로그 (큐레이션 상태 포함). */
  async listCatalogForAdmin(
    eventId: string = SMARTCON_CONFIG.eventId,
  ): Promise<CatalogItem[]> {
    return this.productRepository.listCatalog(eventId);
  }

  /** 사용자 — 노출 ON 상품만. */
  async listVisible(
    eventId: string = SMARTCON_CONFIG.eventId,
  ): Promise<VisibleProduct[]> {
    return this.productRepository.listVisible(eventId);
  }

  /**
   * 어드민 — 큐레이션 정보 UPSERT.
   * smartcon_goods에 해당 goods_id가 존재하지 않거나 비활성이면 거부.
   */
  async curate(input: {
    goods_id: string;
    point_price: number;
    is_visible: boolean;
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
    return this.productRepository.upsertCuration({
      smartcon_goods_id: input.goods_id,
      point_price: input.point_price,
      is_visible: input.is_visible,
    });
  }
}
