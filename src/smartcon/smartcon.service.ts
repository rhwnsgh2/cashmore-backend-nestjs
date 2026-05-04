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
    price: item.PRICE ?? null,
    disc_price: item.DISC_PRICE ?? null,
    disc_rate: item.DISC_RATE ?? null,
    extra_charge: item.EXTRA_CHARGE ?? null,
    img_url: item.IMG_URL ?? null,
    img_url_https: item.IMG_URL_HTTPS ?? null,
    goods_sale_type: item.GOODS_SALE_TYPE ?? null,
    goods_use_type: item.GOODS_USE_TYPE ?? null,
    sc_limit_date: item.SC_LIMIT_DATE ?? null,
    b2c_item_no: item.B2C_ITEM_NO ?? null,
    raw_data: item,
    last_synced_at: new Date().toISOString(),
  };
}
