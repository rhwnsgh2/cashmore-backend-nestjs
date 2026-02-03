export interface IInviteCodeRepository {
  findDeviceIdByUserId(userId: string): Promise<string | null>;
  hasDeviceEventParticipation(deviceId: string): Promise<boolean>;
  hasAlreadyBeenInvited(userId: string): Promise<boolean>;
  findUserCreatedAt(userId: string): Promise<string | null>;
}

export const INVITE_CODE_REPOSITORY = Symbol('INVITE_CODE_REPOSITORY');
