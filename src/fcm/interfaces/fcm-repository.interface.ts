export interface IFcmRepository {
  findFcmToken(userId: string): Promise<string | null>;
}

export const FCM_REPOSITORY = Symbol('FCM_REPOSITORY');
