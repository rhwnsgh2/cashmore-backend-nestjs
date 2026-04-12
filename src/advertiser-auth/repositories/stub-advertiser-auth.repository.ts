import type {
  Advertiser,
  IAdvertiserAuthRepository,
} from '../interfaces/advertiser-auth-repository.interface';

export class StubAdvertiserAuthRepository implements IAdvertiserAuthRepository {
  private advertisers: Advertiser[] = [];

  setAdvertisers(advertisers: Advertiser[]): void {
    this.advertisers = advertisers;
  }

  clear(): void {
    this.advertisers = [];
  }

  async findByLoginId(loginId: string): Promise<Advertiser | null> {
    return this.advertisers.find((a) => a.login_id === loginId) || null;
  }

  async findAll(): Promise<Advertiser[]> {
    return [...this.advertisers].sort((a, b) => a.id - b.id);
  }

  async create(
    loginId: string,
    passwordHash: string,
    companyName: string,
  ): Promise<Advertiser> {
    const advertiser: Advertiser = {
      id: this.advertisers.length + 1,
      login_id: loginId,
      password_hash: passwordHash,
      company_name: companyName,
    };
    this.advertisers.push(advertiser);
    return advertiser;
  }
}
