import { Inject, Injectable } from '@nestjs/common';
import type { IInviteCodeRepository } from './interfaces/invite-code-repository.interface';
import { INVITE_CODE_REPOSITORY } from './interfaces/invite-code-repository.interface';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InviteCodeService {
  constructor(
    @Inject(INVITE_CODE_REPOSITORY)
    private inviteCodeRepository: IInviteCodeRepository,
  ) {}

  async canInputInviteCode(userId: string): Promise<boolean> {
    const deviceId =
      await this.inviteCodeRepository.findDeviceIdByUserId(userId);

    if (!deviceId) {
      return false;
    }

    const hasParticipation =
      await this.inviteCodeRepository.hasDeviceEventParticipation(deviceId);

    if (hasParticipation) {
      return false;
    }

    const alreadyInvited =
      await this.inviteCodeRepository.hasAlreadyBeenInvited(userId);

    if (alreadyInvited) {
      return false;
    }

    const createdAt = await this.inviteCodeRepository.findUserCreatedAt(userId);

    if (!createdAt) {
      return false;
    }

    const isUserCreatedWithin24Hours =
      new Date(createdAt).getTime() > Date.now() - TWENTY_FOUR_HOURS_MS;

    return isUserCreatedWithin24Hours;
  }
}
