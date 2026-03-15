import type {
  IDeeplinkRepository,
  DeeplinkClickData,
} from '../interfaces/deeplink-repository.interface';

export class StubDeeplinkRepository implements IDeeplinkRepository {
  private store = new Map<string, DeeplinkClickData>();

  saveClick(fingerprint: string, data: DeeplinkClickData): Promise<void> {
    this.store.set(fingerprint, data);
    return Promise.resolve();
  }

  findAndDeleteByFingerprint(
    fingerprint: string,
  ): Promise<DeeplinkClickData | null> {
    const data = this.store.get(fingerprint) ?? null;
    if (data) {
      this.store.delete(fingerprint);
    }
    return Promise.resolve(data);
  }

  getAll(): Map<string, DeeplinkClickData> {
    return this.store;
  }

  clear(): void {
    this.store.clear();
  }
}
