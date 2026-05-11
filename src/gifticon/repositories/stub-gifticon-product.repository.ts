import { Injectable } from '@nestjs/common';
import type {
  IGifticonProductRepository,
  CatalogItem,
  VisibleProduct,
  GifticonProductRow,
  UpsertCurationInput,
} from '../interfaces/gifticon-product-repository.interface';

interface StubGoods {
  goods_id: string;
  event_id: string;
  brand_name: string | null;
  goods_name: string | null;
  msg: string | null;
  price: number | null;
  disc_price: number | null;
  img_url_https: string | null;
  cached_img_url: string | null;
  is_active: boolean;
}

@Injectable()
export class StubGifticonProductRepository implements IGifticonProductRepository {
  private products = new Map<string, GifticonProductRow>();
  private goods: StubGoods[] = [];
  private nextId = 1;

  seedGoods(rows: StubGoods[]): void {
    this.goods = [...rows];
  }

  clear(): void {
    this.products.clear();
    this.goods = [];
    this.nextId = 1;
  }

  async listCatalog(eventId: string): Promise<CatalogItem[]> {
    return this.goods
      .filter((g) => g.event_id === eventId)
      .map((g) => {
        const p = this.products.get(g.goods_id) ?? null;
        return {
          id: p?.id ?? null,
          goods_id: g.goods_id,
          brand_name: g.brand_name,
          goods_name: g.goods_name,
          display_name: p?.display_name ?? null,
          display_order: p?.display_order ?? null,
          msg: g.msg,
          smartcon_price: g.price,
          smartcon_disc_price: g.disc_price,
          img_url: g.cached_img_url ?? g.img_url_https,
          point_price: p?.point_price ?? null,
          is_visible: p?.is_visible ?? false,
          is_active: g.is_active,
        };
      });
  }

  async listVisible(eventId: string): Promise<VisibleProduct[]> {
    const goodsByid = new Map(this.goods.map((g) => [g.goods_id, g]));
    const rows = [...this.products.values()]
      .filter((p) => p.is_visible)
      .map((p) => {
        const g = goodsByid.get(p.smartcon_goods_id);
        if (!g || !g.is_active || g.event_id !== eventId) return null;
        return {
          product: p,
          visible: {
            id: p.id,
            goods_id: g.goods_id,
            brand_name: g.brand_name,
            goods_name: p.display_name ?? g.goods_name, // override 우선
            msg: g.msg,
            img_url: g.cached_img_url ?? g.img_url_https,
            point_price: p.point_price,
            original_price: g.price,
          } as VisibleProduct,
        };
      })
      .filter(
        (r): r is { product: GifticonProductRow; visible: VisibleProduct } =>
          r !== null,
      );

    // display_order ASC NULLS LAST, id ASC
    rows.sort((a, b) => {
      const ao = a.product.display_order;
      const bo = b.product.display_order;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1; // a 우선 (NULL 뒤로)
      if (bo !== null) return 1;
      return a.visible.id - b.visible.id;
    });

    return rows.map((r) => r.visible);
  }

  async upsertCuration(
    input: UpsertCurationInput,
  ): Promise<GifticonProductRow> {
    const now = new Date().toISOString();
    const existing = this.products.get(input.smartcon_goods_id);
    const row: GifticonProductRow = {
      id: existing?.id ?? this.nextId++,
      smartcon_goods_id: input.smartcon_goods_id,
      point_price: input.point_price,
      is_visible: input.is_visible,
      display_name: input.display_name ?? null,
      display_order:
        input.display_order !== undefined
          ? input.display_order
          : (existing?.display_order ?? null),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    this.products.set(input.smartcon_goods_id, row);
    return row;
  }

  async reorder(
    scopeGoodsIds: string[],
    orderedGoodsIds: string[],
  ): Promise<void> {
    const now = new Date().toISOString();
    const scope = new Set(scopeGoodsIds);
    // 1. scope 안만 NULL 초기화
    for (const row of this.products.values()) {
      if (scope.has(row.smartcon_goods_id)) {
        row.display_order = null;
        row.updated_at = now;
      }
    }
    // 2. orderedGoodsIds 순서대로 1, 2, 3...
    orderedGoodsIds.forEach((goodsId, idx) => {
      const row = this.products.get(goodsId);
      if (row) {
        row.display_order = idx + 1;
        row.updated_at = now;
      }
    });
  }

  async findByGoodsId(goodsId: string): Promise<GifticonProductRow | null> {
    return this.products.get(goodsId) ?? null;
  }
}
