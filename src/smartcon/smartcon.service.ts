import { Inject, Injectable, Logger } from '@nestjs/common';
import { SmartconApiService } from './smartcon-api.service';
import { SMARTCON_CONFIG } from './smartcon.constants';
import {
  SMARTCON_GOODS_REPOSITORY,
  type ISmartconGoodsRepository,
  type SmartconGoodsUpsertInput,
} from './interfaces/smartcon-goods-repository.interface';
import {
  GIFTICON_IMAGE_STORAGE,
  type IGifticonImageStorage,
} from '../storage/interfaces/gifticon-image-storage.interface';
import type { SmartconGoodsResponseItem } from './dto/smartcon-goods.dto';

export interface SyncEventGoodsResult {
  fetched: number;
  upserted: number;
  deactivated: number;
  imagesCached: number;
  imagesFailed: number;
}

@Injectable()
export class SmartconService {
  private readonly logger = new Logger(SmartconService.name);

  constructor(
    private smartconApiService: SmartconApiService,
    @Inject(SMARTCON_GOODS_REPOSITORY)
    private smartconGoodsRepository: ISmartconGoodsRepository,
    @Inject(GIFTICON_IMAGE_STORAGE)
    private imageStorage: IGifticonImageStorage,
  ) {}

  /**
   * GetEventGoods.sc 호출 → smartcon_goods 테이블에 UPSERT.
   * 응답에서 빠진 상품은 is_active=false 처리.
   * 캐시 미수행 상품의 이미지를 S3에 업로드 (best-effort, 실패해도 sync 자체는 성공).
   */
  async syncEventGoods(
    eventId: string = SMARTCON_CONFIG.eventId,
  ): Promise<SyncEventGoodsResult> {
    const items = await this.smartconApiService.getEventGoods(eventId);
    const inputs = items.map((item) => toUpsertInput(eventId, item));
    const result = await this.smartconGoodsRepository.syncByEvent({
      eventId,
      items: inputs,
    });

    const { imagesCached, imagesFailed } =
      await this.cacheUncachedImages(eventId);

    this.logger.log(
      `syncEventGoods eventId=${eventId} fetched=${items.length} upserted=${result.upserted} deactivated=${result.deactivated} imagesCached=${imagesCached} imagesFailed=${imagesFailed}`,
    );
    return {
      fetched: items.length,
      upserted: result.upserted,
      deactivated: result.deactivated,
      imagesCached,
      imagesFailed,
    };
  }

  private async cacheUncachedImages(
    eventId: string,
  ): Promise<{ imagesCached: number; imagesFailed: number }> {
    const uncached =
      await this.smartconGoodsRepository.findUncachedByEvent(eventId);
    let imagesCached = 0;
    let imagesFailed = 0;
    for (const item of uncached) {
      try {
        const path = `gifticon/${item.goods_id}`;
        const cdnUrl = await this.imageStorage.uploadFromUrl(
          path,
          item.img_url_https,
        );
        await this.smartconGoodsRepository.updateCachedImage(
          item.goods_id,
          cdnUrl,
          new Date().toISOString(),
        );
        imagesCached++;
      } catch (error) {
        imagesFailed++;
        this.logger.error(
          `Failed to cache image for goods_id=${item.goods_id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return { imagesCached, imagesFailed };
  }
}

/**
 * 정수 컬럼에 NULL/소수 모두 안전하게 저장.
 * 스마트콘이 5% 할인 적용된 상품의 DISC_PRICE를 1187.5처럼 소수로 보낼 수 있어 반올림.
 * raw_data 컬럼에는 원본 그대로 박제되어 정보 손실 없음.
 */
function roundOrNull(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value);
}

function toUpsertInput(
  eventId: string,
  item: SmartconGoodsResponseItem,
): SmartconGoodsUpsertInput {
  return {
    goods_id: item.GOODS_ID,
    event_id: eventId,
    brand_name: item.BRAND_NAME ?? null,
    goods_name: item.GOODS_NAME ?? null,
    msg: item.MSG ?? null,
    price: roundOrNull(item.PRICE),
    disc_price: roundOrNull(item.DISC_PRICE),
    disc_rate: roundOrNull(item.DISC_RATE),
    extra_charge: roundOrNull(item.EXTRA_CHARGE),
    img_url: item.IMG_URL ?? null,
    img_url_https: item.IMG_URL_HTTPS ?? null,
    goods_sale_type: item.GOODS_SALE_TYPE ?? null,
    goods_use_type: item.GOODS_USE_TYPE ?? null,
    sc_limit_date: roundOrNull(item.SC_LIMIT_DATE),
    b2c_item_no: item.B2C_ITEM_NO ?? null,
    raw_data: item,
    last_synced_at: new Date().toISOString(),
  };
}
