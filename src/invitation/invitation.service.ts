import { Inject, Injectable } from '@nestjs/common';
import {
  INVITATION_REPOSITORY,
  type IInvitationRepository,
  type Invitation,
} from './interfaces/invitation-repository.interface';

@Injectable()
export class InvitationService {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private invitationRepository: IInvitationRepository,
  ) {}

  async getOrCreateInvitation(userId: string): Promise<Invitation> {
    return this.invitationRepository.createOrGetInvitation(userId, 'normal');
  }
}
