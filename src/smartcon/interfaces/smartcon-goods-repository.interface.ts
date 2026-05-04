import type { SmartconGoodsResponseItem } from '../dto/smartcon-goods.dto';

export interface SmartconGoodsRow {
  goods_id: string;
  event_id: string;
  brand_name: string | null;
  goods_name: string | null;
  msg: string | null;
  price: number | null;
  disc_price: number | null;
  disc_rate: number | null;
  extra_charge: number | null;
  img_url: string | null;
  img_url_https: string | null;
  goods_sale_type: string | null;
  goods_use_type: string | null;
  sc_limit_date: number | null;
  b2c_item_no: string | null;
  raw_data: SmartconGoodsResponseItem;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmartconGoodsUpsertInput {
  goods_id: string;
  event_id: string;
  brand_name: string | null;
  goods_name: string | null;
  msg: string | null;
  price: number | null;
  disc_price: number | null;
  disc_rate: number | null;
  extra_charge: number | null;
  img_url: string | null;
  img_url_https: string | null;
  goods_sale_type: string | null;
  goods_use_type: string | null;
  sc_limit_date: number | null;
  b2c_item_no: string | null;
  raw_data: SmartconGoodsResponseItem;
  last_synced_at: string;
}

export interface SyncByEventResult {
  upserted: number;
  deactivated: number;
}

export interface ISmartconGoodsRepository {
  /**
   * 한 EVENT의 응답을 그대로 받아 UPSERT + 응답에서 빠진 상품 비활성화.
   */
  syncByEvent(input: {
    eventId: string;
    items: SmartconGoodsUpsertInput[];
  }): Promise<SyncByEventResult>;

  findAllByEvent(eventId: string): Promise<SmartconGoodsRow[]>;
  findById(goodsId: string): Promise<SmartconGoodsRow | null>;
}

export const SMARTCON_GOODS_REPOSITORY = Symbol('SMARTCON_GOODS_REPOSITORY');
