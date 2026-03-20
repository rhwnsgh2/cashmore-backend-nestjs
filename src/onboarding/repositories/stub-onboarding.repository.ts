import type {
  IOnboardingRepository,
  DeviceEventParticipation,
} from '../interfaces/onboarding-repository.interface';

export class StubOnboardingRepository implements IOnboardingRepository {
  private participations = new Map<string, DeviceEventParticipation>();

  setParticipation(
    userId: string,
    participation: DeviceEventParticipation,
  ): void {
    this.participations.set(userId, participation);
  }

  clear(): void {
    this.participations.clear();
  }

  findOnboardingEventParticipation(
    userId: string,
  ): Promise<DeviceEventParticipation | null> {
    return Promise.resolve(this.participations.get(userId) || null);
  }
}
