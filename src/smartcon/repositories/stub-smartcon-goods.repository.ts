import { Injectable } from '@nestjs/common';
import type {
  ISmartconGoodsRepository,
  SmartconGoodsRow,
  SmartconGoodsUpsertInput,
  SyncByEventResult,
  UncachedGoods,
} from '../interfaces/smartcon-goods-repository.interface';

@Injectable()
export class StubSmartconGoodsRepository implements ISmartconGoodsRepository {
  private store = new Map<string, SmartconGoodsRow>();

  async syncByEvent({
    eventId,
    items,
  }: {
    eventId: string;
    items: SmartconGoodsUpsertInput[];
  }): Promise<SyncByEventResult> {
    const now = new Date().toISOString();
    let upserted = 0;
    for (const it of items) {
      const existing = this.store.get(it.goods_id);
      this.store.set(it.goods_id, {
        ...it,
        is_active: true,
        cached_img_url: existing?.cached_img_url ?? null,
        cached_img_at: existing?.cached_img_at ?? null,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      });
      upserted++;
    }

    const presentIds = new Set(items.map((it) => it.goods_id));
    let deactivated = 0;
    for (const row of this.store.values()) {
      if (
        row.event_id === eventId &&
        row.is_active &&
        !presentIds.has(row.goods_id)
      ) {
        row.is_active = false;
        row.updated_at = now;
        deactivated++;
      }
    }
    return { upserted, deactivated };
  }

  async findUncachedByEvent(eventId: string): Promise<UncachedGoods[]> {
    return [...this.store.values()]
      .filter(
        (r) =>
          r.event_id === eventId &&
          r.is_active &&
          r.cached_img_url === null &&
          r.img_url_https !== null,
      )
      .map((r) => ({
        goods_id: r.goods_id,
        img_url_https: r.img_url_https as string,
      }));
  }

  async updateCachedImage(
    goodsId: string,
    cachedImgUrl: string,
    cachedImgAt: string,
  ): Promise<void> {
    const row = this.store.get(goodsId);
    if (!row) return;
    row.cached_img_url = cachedImgUrl;
    row.cached_img_at = cachedImgAt;
    row.updated_at = cachedImgAt;
  }

  async findAllByEvent(eventId: string): Promise<SmartconGoodsRow[]> {
    return [...this.store.values()].filter((r) => r.event_id === eventId);
  }

  async findById(goodsId: string): Promise<SmartconGoodsRow | null> {
    return this.store.get(goodsId) ?? null;
  }

  // 테스트 헬퍼
  seed(rows: SmartconGoodsRow[]): void {
    for (const r of rows) this.store.set(r.goods_id, r);
  }

  clear(): void {
    this.store.clear();
  }
}
