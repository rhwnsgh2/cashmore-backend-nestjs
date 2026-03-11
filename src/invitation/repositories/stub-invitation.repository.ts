import type {
  IInvitationRepository,
  Invitation,
  StepRewardAction,
} from '../interfaces/invitation-repository.interface';
import { generateUniqueCode } from '../utils/generate-code';

export class StubInvitationRepository implements IInvitationRepository {
  private invitations: Map<string, Invitation> = new Map();
  private invitedUserCounts: Map<number, number> = new Map();
  private stepRewards: Map<string, StepRewardAction[]> = new Map();
  private nextId = 1;

  private makeKey(userId: string, type: string): string {
    return `${userId}:${type}`;
  }

  setInvitation(
    userId: string,
    invitation: Invitation,
    type: 'default' | 'normal' = 'normal',
  ): void {
    this.invitations.set(this.makeKey(userId, type), invitation);
  }

  setInvitedUserCount(invitationId: number, count: number): void {
    this.invitedUserCounts.set(invitationId, count);
  }

  setStepRewards(userId: string, rewards: StepRewardAction[]): void {
    this.stepRewards.set(userId, rewards);
  }

  clear(): void {
    this.invitations.clear();
    this.invitedUserCounts.clear();
    this.stepRewards.clear();
    this.nextId = 1;
  }

  createOrGetInvitation(
    userId: string,
    type: 'default' | 'normal' = 'normal',
  ): Promise<Invitation> {
    const key = this.makeKey(userId, type);
    const existing = this.invitations.get(key);
    if (existing) {
      return Promise.resolve(existing);
    }

    const invitation: Invitation = {
      id: this.nextId++,
      senderId: userId,
      createdAt: new Date().toISOString(),
      identifier: generateUniqueCode(),
      type,
      status: 'pending',
    };

    this.invitations.set(key, invitation);
    return Promise.resolve(invitation);
  }

  getInvitationByCode(code: string): Promise<Invitation | null> {
    for (const invitation of this.invitations.values()) {
      if (invitation.identifier === code) {
        return Promise.resolve(invitation);
      }
    }
    return Promise.resolve(null);
  }

  findInvitationIdByUserId(userId: string): Promise<number | null> {
    const key = this.makeKey(userId, 'normal');
    const invitation = this.invitations.get(key);
    return Promise.resolve(invitation?.id ?? null);
  }

  countInvitedUsersSince(
    invitationId: number,
    _since: string,
  ): Promise<number> {
    return Promise.resolve(this.invitedUserCounts.get(invitationId) ?? 0);
  }

  findStepRewards(userId: string): Promise<StepRewardAction[]> {
    return Promise.resolve(this.stepRewards.get(userId) ?? []);
  }
}
