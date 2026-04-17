import type {
  CreateUserData,
  DeviceEvent,
  IUserRepository,
  User,
  UserProvider,
} from '../interfaces/user-repository.interface';

/**
 * 테스트용 Stub Repository
 * 인메모리 데이터를 설정하고 테스트에서 사용
 */
export class StubUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private banReasons: Map<string, string> = new Map();
  private deviceEvents: DeviceEvent[] = [];
  private invitedUsers: Set<string> = new Set();
  private authProviders: Map<string, UserProvider> = new Map();
  private deviceIdMap: Map<string, string> = new Map(); // userId → deviceId
  private pointTotals: Map<string, number> = new Map();
  private nicknameHistory: {
    userId: string;
    before: string;
    after: string;
  }[] = [];

  // 데이터 설정 메서드
  setUser(user: User): void {
    this.users.set(user.id, user);
  }

  setUserDeviceId(userId: string, deviceId: string): void {
    this.deviceIdMap.set(userId, deviceId);
  }

  setPointTotal(userId: string, total: number): void {
    this.pointTotals.set(userId, total);
  }

  setBanReason(authId: string, reason: string): void {
    this.banReasons.set(authId, reason);
  }

  setDeviceEvents(events: DeviceEvent[]): void {
    this.deviceEvents = events;
  }

  setInvitedUser(userId: string): void {
    this.invitedUsers.add(userId);
  }

  setAuthProvider(authId: string, provider: UserProvider): void {
    this.authProviders.set(authId, provider);
  }

  getDeviceEvents() {
    return this.deviceEvents;
  }

  clear(): void {
    this.users.clear();
    this.banReasons.clear();
    this.deviceEvents = [];
    this.invitedUsers.clear();
    this.authProviders.clear();
  }

  // IUserRepository 구현
  findById(userId: string): Promise<User | null> {
    return Promise.resolve(this.users.get(userId) || null);
  }

  findBulkByUserIds(userIds: string[]): Promise<User[]> {
    const result = userIds
      .map((id) => this.users.get(id))
      .filter((u): u is User => u !== undefined);
    return Promise.resolve(result);
  }

  searchByEmail(email: string, limit: number): Promise<User[]> {
    const lower = email.toLowerCase();
    const result = Array.from(this.users.values())
      .filter((u) => u.email !== null && u.email.toLowerCase().includes(lower))
      .slice(0, limit);
    return Promise.resolve(result);
  }

  findByAuthId(authId: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(
      (u) => u.auth_id === authId,
    );
    return Promise.resolve(user || null);
  }

  create(data: CreateUserData): Promise<{ id: string }> {
    const id = `user-${Date.now()}`;
    const user: User = {
      id,
      email: data.email,
      auth_id: data.authId,
      created_at: new Date().toISOString(),
      marketing_info: data.marketingAgreement,
      is_banned: false,
      nickname: data.nickname,
      provider: data.provider,
    };
    this.users.set(id, user);
    return Promise.resolve({ id });
  }

  updateNickname(userId: string, nickname: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.nickname = nickname;
      this.users.set(userId, user);
    }
    return Promise.resolve();
  }

  updateMarketingInfo(
    userId: string,
    marketingAgreement: boolean,
  ): Promise<{ marketing_info: boolean }> {
    const user = this.users.get(userId);
    if (!user) {
      return Promise.reject(new Error('마케팅 정보 업데이트 실패: not found'));
    }
    user.marketing_info = marketingAgreement;
    this.users.set(userId, user);
    return Promise.resolve({ marketing_info: marketingAgreement });
  }

  findByNickname(
    nickname: string,
    excludeUserId?: string,
  ): Promise<{ id: string } | null> {
    const found = Array.from(this.users.values()).find(
      (u) => u.nickname === nickname && u.id !== excludeUserId,
    );
    return Promise.resolve(found ? { id: found.id } : null);
  }

  insertNicknameHistory(
    userId: string,
    before: string,
    after: string,
  ): Promise<void> {
    this.nicknameHistory.push({ userId, before, after });
    return Promise.resolve();
  }

  getNicknameHistory() {
    return this.nicknameHistory;
  }

  findBanReason(authId: string): Promise<string | null> {
    return Promise.resolve(this.banReasons.get(authId) || null);
  }

  getAuthProvider(authId: string): Promise<UserProvider> {
    return Promise.resolve(this.authProviders.get(authId) || 'other');
  }

  findDeviceEventsByDeviceId(deviceId: string): Promise<DeviceEvent[]> {
    return Promise.resolve(
      this.deviceEvents.filter((e) => e.device_id === deviceId),
    );
  }

  createDeviceEvent(
    deviceId: string,
    eventName: string,
    _userId: string,
  ): Promise<void> {
    this.deviceEvents.push({ device_id: deviceId, event_name: eventName });
    return Promise.resolve();
  }

  findDeviceId(_userId: string): Promise<string | null> {
    const event = this.deviceEvents.find(() => true);
    return Promise.resolve(event ? event.device_id : null);
  }

  isInvitedUser(userId: string): Promise<boolean> {
    return Promise.resolve(this.invitedUsers.has(userId));
  }

  deleteUser(userId: string): Promise<void> {
    this.users.delete(userId);
    return Promise.resolve();
  }

  findUsersByDeviceId(
    deviceId: string,
  ): Promise<{ id: string; auth_id: string }[]> {
    const results: { id: string; auth_id: string }[] = [];
    for (const [userId, devId] of this.deviceIdMap.entries()) {
      if (devId === deviceId) {
        const user = this.users.get(userId);
        if (user) {
          results.push({ id: user.id, auth_id: user.auth_id });
        }
      }
    }
    return Promise.resolve(results);
  }

  getPointTotal(userId: string): Promise<number> {
    return Promise.resolve(this.pointTotals.get(userId) ?? 0);
  }
}
