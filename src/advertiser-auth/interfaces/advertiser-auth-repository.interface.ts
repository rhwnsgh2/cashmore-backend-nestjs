export interface Advertiser {
  id: number;
  login_id: string;
  password_hash: string;
  company_name: string;
}

export interface IAdvertiserAuthRepository {
  findByLoginId(loginId: string): Promise<Advertiser | null>;
  create(
    loginId: string,
    passwordHash: string,
    companyName: string,
  ): Promise<Advertiser>;
}

export const ADVERTISER_AUTH_REPOSITORY = Symbol('ADVERTISER_AUTH_REPOSITORY');
