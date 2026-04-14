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

export interface CreateUserData {
  authId: string;
  email: string;
  nickname: string;
  fcmToken: string | null;
  marketingAgreement: boolean;
  deviceId: string | null;
  provider: UserProvider;
}

export interface DeviceEvent {
  device_id: string;
  event_name: string;
}

// Repository 인터페이스
export interface IUserRepository {
  /**
   * 사용자 ID로 사용자 정보 조회
   */
  findById(userId: string): Promise<User | null>;

  /**
   * 여러 사용자 ID로 사용자 정보 일괄 조회
   */
  findBulkByUserIds(userIds: string[]): Promise<User[]>;

  /**
   * 이메일 부분 일치로 사용자 검색 (어드민용, limit 지원)
   */
  searchByEmail(email: string, limit: number): Promise<User[]>;

  /**
   * auth_id로 사용자 조회
   */
  findByAuthId(authId: string): Promise<User | null>;

  /**
   * 사용자 생성
   */
  create(data: CreateUserData): Promise<{ id: string }>;

  /**
   * 사용자 닉네임 업데이트
   */
  updateNickname(userId: string, nickname: string): Promise<void>;

  /**
   * 닉네임으로 사용자 조회 (중복 체크용). excludeUserId가 주어지면 해당 사용자는 제외
   */
  findByNickname(
    nickname: string,
    excludeUserId?: string,
  ): Promise<{ id: string } | null>;

  /**
   * 닉네임 변경 이력 저장
   */
  insertNicknameHistory(
    userId: string,
    before: string,
    after: string,
  ): Promise<void>;

  /**
   * auth_id로 차단 사유 조회
   */
  findBanReason(authId: string): Promise<string | null>;

  /**
   * auth_id로 Supabase Auth에서 provider 조회
   */
  getAuthProvider(authId: string): Promise<UserProvider>;

  /**
   * 디바이스 이벤트 참여 목록 조회
   */
  findDeviceEventsByDeviceId(deviceId: string): Promise<DeviceEvent[]>;

  /**
   * 디바이스 이벤트 참여 기록 생성
   */
  createDeviceEvent(
    deviceId: string,
    eventName: string,
    userId: string,
  ): Promise<void>;

  /**
   * 초대받은 사용자인지 확인
   */
  findDeviceId(userId: string): Promise<string | null>;

  isInvitedUser(userId: string): Promise<boolean>;

  deleteUser(userId: string): Promise<void>;

  findUsersByDeviceId(
    deviceId: string,
  ): Promise<{ id: string; auth_id: string }[]>;

  getPointTotal(userId: string): Promise<number>;
}

// DI 토큰
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
