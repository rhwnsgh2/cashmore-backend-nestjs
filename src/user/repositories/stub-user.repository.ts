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
  private pointActions: {
    userId: string;
    type: string;
    pointAmount: number;
  }[] = [];
  private invitedUsers: Set<string> = new Set();
  private authProviders: Map<string, UserProvider> = new Map();

  // 데이터 설정 메서드
  setUser(user: User): void {
    this.users.set(user.id, user);
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

  getPointActions() {
    return this.pointActions;
  }

  getDeviceEvents() {
    return this.deviceEvents;
  }

  clear(): void {
    this.users.clear();
    this.banReasons.clear();
    this.deviceEvents = [];
    this.pointActions = [];
    this.invitedUsers.clear();
    this.authProviders.clear();
  }

  // IUserRepository 구현
  findById(userId: string): Promise<User | null> {
    return Promise.resolve(this.users.get(userId) || null);
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

  createPointAction(
    userId: string,
    type: string,
    pointAmount: number,
    _additionalData: Record<string, unknown>,
  ): Promise<void> {
    this.pointActions.push({ userId, type, pointAmount });
    return Promise.resolve();
  }

  isInvitedUser(userId: string): Promise<boolean> {
    return Promise.resolve(this.invitedUsers.has(userId));
  }
}
