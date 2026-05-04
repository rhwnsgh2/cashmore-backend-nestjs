export interface GifticonProductRow {
  id: number;
  smartcon_goods_id: string;
  point_price: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogItem {
  id: number | null; // 큐레이션 안 된 상품은 null
  goods_id: string;
  brand_name: string | null;
  goods_name: string | null;
  msg: string | null;
  smartcon_price: number | null;
  smartcon_disc_price: number | null;
  img_url: string | null; // cached_img_url 우선, 없으면 img_url_https
  point_price: number | null;
  is_visible: boolean;
  is_active: boolean; // smartcon_goods.is_active
}

export interface VisibleProduct {
  id: number;
  goods_id: string;
  brand_name: string | null;
  goods_name: string | null;
  msg: string | null;
  img_url: string | null;
  point_price: number;
}

export interface UpsertCurationInput {
  smartcon_goods_id: string;
  point_price: number;
  is_visible: boolean;
}

export interface IGifticonProductRepository {
  /**
   * 어드민용 — `smartcon_goods` 전체와 `gifticon_products` 큐레이션 정보를 결합하여 반환.
   * (단종된 상품 포함, 어드민이 인식할 수 있도록)
   */
  listCatalog(eventId: string): Promise<CatalogItem[]>;

  /**
   * 사용자용 — `is_active=true AND is_visible=true`인 상품만 반환.
   */
  listVisible(eventId: string): Promise<VisibleProduct[]>;

  /**
   * 큐레이션 입력값으로 UPSERT (smartcon_goods_id 기준).
   */
  upsertCuration(input: UpsertCurationInput): Promise<GifticonProductRow>;

  findByGoodsId(goodsId: string): Promise<GifticonProductRow | null>;
}

export const GIFTICON_PRODUCT_REPOSITORY = Symbol('GIFTICON_PRODUCT_REPOSITORY');
