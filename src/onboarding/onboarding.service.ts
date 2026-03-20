import { Inject, Injectable } from '@nestjs/common';
import type { IOnboardingRepository } from './interfaces/onboarding-repository.interface';
import { ONBOARDING_REPOSITORY } from './interfaces/onboarding-repository.interface';

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(ONBOARDING_REPOSITORY)
    private onboardingRepository: IOnboardingRepository,
  ) {}

  async getEventStatus(userId: string): Promise<boolean> {
    const participation =
      await this.onboardingRepository.findOnboardingEventParticipation(userId);

    if (!participation) {
      return false;
    }

    const createdAt = new Date(participation.createdAt);
    const now = new Date();

    const kstOffset = 9 * 60 * 60 * 1000;

    const createdAtKST = new Date(createdAt.getTime() + kstOffset);
    const nowKST = new Date(now.getTime() + kstOffset);

    return (
      createdAtKST.getUTCFullYear() === nowKST.getUTCFullYear() &&
      createdAtKST.getUTCMonth() === nowKST.getUTCMonth() &&
      createdAtKST.getUTCDate() === nowKST.getUTCDate()
    );
  }
}
