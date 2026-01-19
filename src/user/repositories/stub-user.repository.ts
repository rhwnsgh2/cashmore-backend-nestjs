import type {
  IUserRepository,
  User,
} from '../interfaces/user-repository.interface';

/**
 * 테스트용 Stub Repository
 * 인메모리 데이터를 설정하고 테스트에서 사용
 */
export class StubUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private banReasons: Map<string, string> = new Map();

  // 데이터 설정 메서드
  setUser(user: User): void {
    this.users.set(user.id, user);
  }

  setBanReason(authId: string, reason: string): void {
    this.banReasons.set(authId, reason);
  }

  clear(): void {
    this.users.clear();
    this.banReasons.clear();
  }

  // IUserRepository 구현
  findById(userId: string): Promise<User | null> {
    return Promise.resolve(this.users.get(userId) || null);
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
}
