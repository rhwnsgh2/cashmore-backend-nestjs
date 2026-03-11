import type {
  IInvitationRepository,
  Invitation,
} from '../interfaces/invitation-repository.interface';
import { generateUniqueCode } from '../utils/generate-code';

export class StubInvitationRepository implements IInvitationRepository {
  private invitations: Map<string, Invitation> = new Map();
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

  clear(): void {
    this.invitations.clear();
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
}
