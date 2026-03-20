export interface DeviceEventParticipation {
  id: string;
  createdAt: string;
}

export interface IOnboardingRepository {
  findOnboardingEventParticipation(
    userId: string,
  ): Promise<DeviceEventParticipation | null>;
}

export const ONBOARDING_REPOSITORY = Symbol('ONBOARDING_REPOSITORY');
