import type {
  EveryReceipt,
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

  // processInvitationReward 관련 내부 저장소
  private userDeviceIds: Map<string, string> = new Map();
  private userCreatedAts: Map<string, string> = new Map();
  private deviceEvents: { device_id: string; event_name: string }[] = [];
  private invitationUsers: {
    invitationId: number;
    userId: string;
    type: 'normal' | 'receipt';
    sourceReceiptId?: number;
  }[] = [];
  private pointActions: {
    userId: string;
    type: string;
    pointAmount: number;
    additionalData: Record<string, unknown>;
  }[] = [];

  // every_receipt 관련 내부 저장소
  private everyReceipts: Map<number, EveryReceipt> = new Map();

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

  // 테스트 헬퍼 메서드
  setUserDeviceId(userId: string, deviceId: string): void {
    this.userDeviceIds.set(userId, deviceId);
  }

  setUserCreatedAt(userId: string, createdAt: string): void {
    this.userCreatedAts.set(userId, createdAt);
  }

  setDeviceEvents(events: { device_id: string; event_name: string }[]): void {
    this.deviceEvents = events;
  }

  getInvitationUsers(): { invitationId: number; userId: string }[] {
    return this.invitationUsers;
  }

  getPointActions(): {
    userId: string;
    type: string;
    pointAmount: number;
    additionalData: Record<string, unknown>;
  }[] {
    return this.pointActions;
  }

  getDeviceEvents(): { device_id: string; event_name: string }[] {
    return this.deviceEvents;
  }

  setEveryReceipt(receipt: EveryReceipt): void {
    this.everyReceipts.set(receipt.id, receipt);
  }

  getEveryReceipt(receiptId: number): EveryReceipt | undefined {
    return this.everyReceipts.get(receiptId);
  }

  clear(): void {
    this.invitations.clear();
    this.invitedUserCounts.clear();
    this.stepRewards.clear();
    this.userDeviceIds.clear();
    this.userCreatedAts.clear();
    this.deviceEvents = [];
    this.invitationUsers = [];
    this.pointActions = [];
    this.everyReceipts.clear();
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

  hasStepReward(userId: string, stepCount: number): Promise<boolean> {
    const rewards = this.stepRewards.get(userId) ?? [];
    return Promise.resolve(rewards.some((r) => r.stepCount === stepCount));
  }

  createStepReward(
    userId: string,
    _amount: number,
    stepCount: number,
    _stepName: string,
  ): Promise<void> {
    const rewards = this.stepRewards.get(userId) ?? [];
    rewards.push({ stepCount });
    this.stepRewards.set(userId, rewards);
    return Promise.resolve();
  }

  // processInvitationReward 관련 인터페이스 구현

  findUserDeviceId(userId: string): Promise<string | null> {
    return Promise.resolve(this.userDeviceIds.get(userId) ?? null);
  }

  findUserCreatedAt(userId: string): Promise<string | null> {
    return Promise.resolve(this.userCreatedAts.get(userId) ?? null);
  }

  hasDeviceEventParticipation(
    deviceId: string,
    eventName: string,
  ): Promise<boolean> {
    const found = this.deviceEvents.some(
      (e) => e.device_id === deviceId && e.event_name === eventName,
    );
    return Promise.resolve(found);
  }

  createDeviceEventParticipation(
    deviceId: string,
    eventName: string,
    _userId: string,
  ): Promise<void> {
    this.deviceEvents.push({ device_id: deviceId, event_name: eventName });
    return Promise.resolve();
  }

  hasInviteRewardForUser(
    senderId: string,
    invitedUserId: string,
  ): Promise<boolean> {
    const found = this.pointActions.some(
      (p) =>
        p.userId === senderId &&
        p.type === 'INVITE_REWARD' &&
        p.additionalData?.invited_user_id === invitedUserId,
    );
    return Promise.resolve(found);
  }

  private nextInvitationUserId = 1;

  createInvitationUser(
    invitationId: number,
    userId: string,
    type: 'normal' | 'receipt' = 'normal',
    sourceReceiptId?: number,
  ): Promise<number> {
    const id = this.nextInvitationUserId++;
    this.invitationUsers.push({ invitationId, userId, type, sourceReceiptId });
    return Promise.resolve(id);
  }

  createPointAction(
    userId: string,
    type: string,
    pointAmount: number,
    additionalData: Record<string, unknown>,
  ): Promise<void> {
    this.pointActions.push({ userId, type, pointAmount, additionalData });
    return Promise.resolve();
  }

  // 영수증 초대 통계

  countInvitedUsersByReceiptId(receiptId: number): Promise<number> {
    const count = this.invitationUsers.filter(
      (u) => u.sourceReceiptId === receiptId,
    ).length;
    return Promise.resolve(count);
  }

  // grantReceiptPoint 관련 인터페이스 구현

  findEveryReceiptById(receiptId: number): Promise<EveryReceipt | null> {
    return Promise.resolve(this.everyReceipts.get(receiptId) ?? null);
  }
}
