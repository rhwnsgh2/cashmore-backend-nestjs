export interface UserInfoRow {
  id: number;
  user_id: string;
  phone_number: string;
  name: string;
  created_at: string;
}

export interface IUserInfoRepository {
  /** 사용자별 phone_number 반환 (없으면 null). */
  findPhoneByUserId(userId: string): Promise<string | null>;

  /** phone_number UPSERT (user_id 기준). */
  upsertPhone(userId: string, phoneNumber: string): Promise<UserInfoRow>;
}

export const USER_INFO_REPOSITORY = Symbol('USER_INFO_REPOSITORY');
