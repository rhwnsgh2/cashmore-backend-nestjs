import type {
  IDeeplinkRepository,
  DeeplinkClickData,
} from '../interfaces/deeplink-repository.interface';

export class StubDeeplinkRepository implements IDeeplinkRepository {
  private store = new Map<string, DeeplinkClickData>();

  saveClick(ip: string, data: DeeplinkClickData): Promise<void> {
    this.store.set(ip, data);
    return Promise.resolve();
  }

  findAndDeleteByIp(ip: string): Promise<DeeplinkClickData | null> {
    const data = this.store.get(ip) ?? null;
    if (data) {
      this.store.delete(ip);
    }
    return Promise.resolve(data);
  }

  restoreClick(ip: string, data: DeeplinkClickData): Promise<void> {
    this.store.set(ip, data);
    return Promise.resolve();
  }

  getAll(): Map<string, DeeplinkClickData> {
    return this.store;
  }

  clear(): void {
    this.store.clear();
  }
}
