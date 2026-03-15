export interface DeeplinkClickData {
  os: string;
  osVersion: string;
  screenWidth?: number;
  screenHeight?: number;
  model?: string;
  params: Record<string, string>;
  path: string;
  createdAt: string;
}

export interface IDeeplinkRepository {
  saveClick(ip: string, data: DeeplinkClickData): Promise<void>;
  findAndDeleteByIp(ip: string): Promise<DeeplinkClickData | null>;
  restoreClick(ip: string, data: DeeplinkClickData): Promise<void>;
}

export const DEEPLINK_REPOSITORY = Symbol('DEEPLINK_REPOSITORY');
