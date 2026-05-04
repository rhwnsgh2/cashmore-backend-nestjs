import { Injectable } from '@nestjs/common';
import type { IGifticonImageStorage } from './interfaces/gifticon-image-storage.interface';

/**
 * 단위 테스트용 in-memory stub.
 * 호출된 업로드 인자를 `uploads` 배열에 기록하고, 가짜 CDN URL을 반환한다.
 */
@Injectable()
export class StubGifticonImageStorage implements IGifticonImageStorage {
  uploads: { path: string; sourceUrl: string }[] = [];

  async uploadFromUrl(path: string, sourceUrl: string): Promise<string> {
    this.uploads.push({ path, sourceUrl });
    return `https://stub-cdn.example/${path}`;
  }

  clear(): void {
    this.uploads = [];
  }
}
