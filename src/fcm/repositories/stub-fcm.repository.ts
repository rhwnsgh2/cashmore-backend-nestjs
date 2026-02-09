import type { IFcmRepository } from '../interfaces/fcm-repository.interface';

export class StubFcmRepository implements IFcmRepository {
  private tokens: Map<string, string> = new Map();

  setFcmToken(userId: string, token: string): void {
    this.tokens.set(userId, token);
  }

  clear(): void {
    this.tokens.clear();
  }

  async findFcmToken(userId: string): Promise<string | null> {
    return Promise.resolve(this.tokens.get(userId) ?? null);
  }
}
