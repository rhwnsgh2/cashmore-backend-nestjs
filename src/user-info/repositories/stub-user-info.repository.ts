import { Injectable } from '@nestjs/common';
import type {
  IUserInfoRepository,
  UserInfoRow,
} from '../interfaces/user-info-repository.interface';

@Injectable()
export class StubUserInfoRepository implements IUserInfoRepository {
  private store = new Map<string, UserInfoRow>();
  private nextId = 1;

  async findPhoneByUserId(userId: string): Promise<string | null> {
    return this.store.get(userId)?.phone_number ?? null;
  }

  async upsertPhone(
    userId: string,
    phoneNumber: string,
  ): Promise<UserInfoRow> {
    const existing = this.store.get(userId);
    const row: UserInfoRow = {
      id: existing?.id ?? this.nextId++,
      user_id: userId,
      phone_number: phoneNumber,
      name: existing?.name ?? '',
      created_at: existing?.created_at ?? new Date().toISOString(),
    };
    this.store.set(userId, row);
    return row;
  }

  clear(): void {
    this.store.clear();
  }
}
