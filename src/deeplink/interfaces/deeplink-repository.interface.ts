export interface DeeplinkClickData {
  params: Record<string, string>;
  path: string;
  createdAt: string;
}

export interface IDeeplinkRepository {
  saveClick(fingerprint: string, data: DeeplinkClickData): Promise<void>;
  findAndDeleteByFingerprint(
    fingerprint: string,
  ): Promise<DeeplinkClickData | null>;
}

export const DEEPLINK_REPOSITORY = Symbol('DEEPLINK_REPOSITORY');
