// 타입 정의
export type UserRole = 'admin' | 'dev' | 'user';
export type UserProvider = 'apple' | 'kakao' | 'other';

export interface User {
  id: string;
  email: string | null;
  auth_id: string;
  created_at: string;
  marketing_info: boolean;
  is_banned: boolean;
  nickname: string | null;
  provider: UserProvider;
}

export interface BannedUser {
  auth_id: string;
  reason: string;
}

// Repository 인터페이스
export interface IUserRepository {
  /**
   * 사용자 ID로 사용자 정보 조회
   */
  findById(userId: string): Promise<User | null>;

  /**
   * 사용자 닉네임 업데이트
   */
  updateNickname(userId: string, nickname: string): Promise<void>;

  /**
   * auth_id로 차단 사유 조회
   */
  findBanReason(authId: string): Promise<string | null>;
}

// DI 토큰
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
