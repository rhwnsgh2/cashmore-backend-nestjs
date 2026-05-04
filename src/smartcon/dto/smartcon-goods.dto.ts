/**
 * 스마트콘 GetEventGoods.sc 응답 항목.
 * 2026-05-04 prd 환경 검증 결과 기반 (V1.9 문서와 일부 차이 있음).
 */
export interface SmartconGoodsResponseItem {
  GOODS_ID: string;
  BRAND_NAME: string | null;
  GOODS_NAME: string | null;
  MSG: string | null;
  PRICE: number | null;
  DISC_PRICE: number | null;
  DISC_RATE: number | null;
  EXTRA_CHARGE: number | null;
  IMG_URL: string | null;
  IMG_URL_HTTPS: string | null;
  GOODS_SALE_TYPE: string | null;
  GOODS_USE_TYPE: string | null;
  SC_LIMIT_DATE: number | null;
  B2C_ITEM_NO: string | null;
  [key: string]: unknown;
}

export type SmartconGetEventGoodsResponse = SmartconGoodsResponseItem[];
