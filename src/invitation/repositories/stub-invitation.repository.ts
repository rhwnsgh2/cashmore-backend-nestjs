import type {
  EveryReceipt,
  IInvitationRepository,
  Invitation,
  StepRewardAction,
} from '../interfaces/invitation-repository.interface';
import { generateUniqueCode } from '../utils/generate-code';
import type { StubPointWriteRepository } from '../../point-write/repositories/stub-point-write.repository';

export class StubInvitationRepository implements IInvitationRepository {
  private invitations: Map<string, Invitation> = new Map();
  private invitedUserCounts: Map<number, number> = new Map();
  private invitedUserCountsInRange: Map<string, number> = new Map();
  private totalInvitedUserCounts: Map<number, number> = new Map();
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

  // every_receipt 관련 내부 저장소
  private everyReceipts: Map<number, EveryReceipt> = new Map();

  constructor(private pointWriteRepository: StubPointWriteRepository) {}

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

  setInvitedUserCountInRange(
    invitationId: number,
    startsAt: string,
    endsAt: string,
    count: number,
  ): void {
    this.invitedUserCountsInRange.set(
      `${invitationId}:${startsAt}:${endsAt}`,
      count,
    );
  }

  setTotalInvitedUserCount(invitationId: number, count: number): void {
    this.totalInvitedUserCounts.set(invitationId, count);
  }

  setStepRewards(userId: string, rewards: StepRewardAction[]): void {
    for (const reward of rewards) {
      void this.pointWriteRepository.insertPointAction(
        userId,
        0,
        'INVITE_STEP_REWARD',
        'done',
        { step_count: reward.stepCount },
      );
    }
  }

  setPartnerStepRewards(
    userId: string,
    programId: number,
    rewards: StepRewardAction[],
  ): void {
    for (const reward of rewards) {
      void this.pointWriteRepository.insertPointAction(
        userId,
        0,
        'INVITE_STEP_REWARD',
        'done',
        { step_count: reward.stepCount, partner_program_id: programId },
      );
    }
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
    this.invitedUserCountsInRange.clear();
    this.totalInvitedUserCounts.clear();
    this.userDeviceIds.clear();
    this.userCreatedAts.clear();
    this.deviceEvents = [];
    this.invitationUsers = [];
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

  countInvitedUsersBetween(
    invitationId: number,
    startsAt: string,
    endsAt: string,
  ): Promise<number> {
    const key = `${invitationId}:${startsAt}:${endsAt}`;
    return Promise.resolve(this.invitedUserCountsInRange.get(key) ?? 0);
  }

  countTotalInvitedUsers(invitationId: number): Promise<number> {
    return Promise.resolve(this.totalInvitedUserCounts.get(invitationId) ?? 0);
  }

  findStepRewards(userId: string): Promise<StepRewardAction[]> {
    const rewards = this.pointWriteRepository
      .getInsertedActions()
      .filter(
        (a) =>
          a.type === 'INVITE_STEP_REWARD' &&
          a.userId === userId &&
          a.additionalData.partner_program_id === undefined,
      )
      .map((a) => ({ stepCount: a.additionalData.step_count as number }))
      .filter((r) => typeof r.stepCount === 'number');
    return Promise.resolve(rewards);
  }

  hasStepReward(userId: string, stepCount: number): Promise<boolean> {
    const found = this.pointWriteRepository
      .getInsertedActions()
      .some(
        (a) =>
          a.type === 'INVITE_STEP_REWARD' &&
          a.userId === userId &&
          a.additionalData.step_count === stepCount &&
          a.additionalData.partner_program_id === undefined,
      );
    return Promise.resolve(found);
  }

  findStepRewardsByProgram(
    userId: string,
    programId: number,
  ): Promise<StepRewardAction[]> {
    const rewards = this.pointWriteRepository
      .getInsertedActions()
      .filter(
        (a) =>
          a.type === 'INVITE_STEP_REWARD' &&
          a.userId === userId &&
          a.additionalData.partner_program_id === programId,
      )
      .map((a) => ({ stepCount: a.additionalData.step_count as number }))
      .filter((r) => typeof r.stepCount === 'number');
    return Promise.resolve(rewards);
  }

  hasStepRewardByProgram(
    userId: string,
    stepCount: number,
    programId: number,
  ): Promise<boolean> {
    const found = this.pointWriteRepository
      .getInsertedActions()
      .some(
        (a) =>
          a.type === 'INVITE_STEP_REWARD' &&
          a.userId === userId &&
          a.additionalData.step_count === stepCount &&
          a.additionalData.partner_program_id === programId,
      );
    return Promise.resolve(found);
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
    const found = this.pointWriteRepository
      .getInsertedActions()
      .some(
        (a) =>
          a.userId === senderId &&
          a.type === 'INVITE_REWARD' &&
          a.additionalData.invited_user_id === invitedUserId,
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

  // 영수증 초대 통계

  sumInviteEarnedPoints(userId: string): Promise<number> {
    const sum = this.pointWriteRepository
      .getInsertedActions()
      .filter(
        (a) =>
          a.userId === userId &&
          (a.type === 'INVITE_REWARD' || a.type === 'INVITE_STEP_REWARD'),
      )
      .reduce((acc, a) => acc + a.amount, 0);
    return Promise.resolve(sum);
  }

  findTopInviters(
    _minInviteCount: number,
  ): Promise<{ userId: string; email: string | null; inviteCount: number }[]> {
    // 단위 테스트에서는 사용하지 않음 (E2E에서만 검증)
    return Promise.resolve([]);
  }

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
