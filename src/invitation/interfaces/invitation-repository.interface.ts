export interface Invitation {
  id: number;
  senderId: string;
  createdAt: string;
  identifier: string;
  type: 'default' | 'normal';
  status: 'pending' | 'used';
}

export interface IInvitationRepository {
  createOrGetInvitation(
    userId: string,
    type?: 'default' | 'normal',
  ): Promise<Invitation>;
}

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');
