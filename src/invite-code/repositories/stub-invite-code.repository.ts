import type { IInviteCodeRepository } from '../interfaces/invite-code-repository.interface';

export class StubInviteCodeRepository implements IInviteCodeRepository {
  private deviceIds: Map<string, string> = new Map();
  private deviceEventParticipations: Set<string> = new Set();
  private invitedUsers: Set<string> = new Set();
  private userCreatedAts: Map<string, string> = new Map();

  setDeviceId(userId: string, deviceId: string): void {
    this.deviceIds.set(userId, deviceId);
  }

  setDeviceEventParticipation(deviceId: string): void {
    this.deviceEventParticipations.add(deviceId);
  }

  setAlreadyInvited(userId: string): void {
    this.invitedUsers.add(userId);
  }

  setUserCreatedAt(userId: string, createdAt: string): void {
    this.userCreatedAts.set(userId, createdAt);
  }

  clear(): void {
    this.deviceIds.clear();
    this.deviceEventParticipations.clear();
    this.invitedUsers.clear();
    this.userCreatedAts.clear();
  }

  findDeviceIdByUserId(userId: string): Promise<string | null> {
    return Promise.resolve(this.deviceIds.get(userId) ?? null);
  }

  hasDeviceEventParticipation(deviceId: string): Promise<boolean> {
    return Promise.resolve(this.deviceEventParticipations.has(deviceId));
  }

  hasAlreadyBeenInvited(userId: string): Promise<boolean> {
    return Promise.resolve(this.invitedUsers.has(userId));
  }

  findUserCreatedAt(userId: string): Promise<string | null> {
    return Promise.resolve(this.userCreatedAts.get(userId) ?? null);
  }
}
