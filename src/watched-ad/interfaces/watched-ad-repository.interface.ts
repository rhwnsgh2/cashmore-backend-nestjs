// Repository 인터페이스
export interface IWatchedAdRepository {
  getWatchedAdStatus(userId: string): Promise<boolean>;
  setWatchedAdStatus(userId: string): Promise<void>;
}

// DI 토큰
export const WATCHED_AD_REPOSITORY = Symbol('WATCHED_AD_REPOSITORY');
