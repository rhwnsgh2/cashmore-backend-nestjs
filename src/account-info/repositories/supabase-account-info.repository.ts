import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IAccountInfoRepository,
  AccountInfo,
} from '../interfaces/account-info-repository.interface';

interface AccountInfoRow {
  id: number;
  user_id: string;
  account_bank: string;
  account_number: string;
  account_user_name: string;
  display_number: string;
  created_at: string;
}

@Injectable()
export class SupabaseAccountInfoRepository implements IAccountInfoRepository {
  constructor(private supabase: SupabaseService) {}

  async findLatestByUserId(userId: string): Promise<AccountInfo | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('account_info')
      .select(
        'id, user_id, account_bank, account_number, account_user_name, display_number, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .returns<AccountInfoRow[]>();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      id: row.id,
      userId: row.user_id,
      accountBank: row.account_bank,
      accountNumber: row.account_number,
      accountUserName: row.account_user_name,
      displayNumber: row.display_number,
      createdAt: row.created_at,
    };
  }

  async findLatestBulkByUserIds(userIds: string[]): Promise<AccountInfo[]> {
    if (userIds.length === 0) {
      return [];
    }

    const CHUNK_SIZE = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
      chunks.push(userIds.slice(i, i + CHUNK_SIZE));
    }

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const { data, error } = await this.supabase
          .getClient()
          .from('account_info')
          .select(
            'id, user_id, account_bank, account_number, account_user_name, display_number, created_at',
          )
          .in('user_id', chunk)
          .order('user_id', { ascending: true })
          .order('created_at', { ascending: false })
          .returns<AccountInfoRow[]>();

        if (error) {
          throw error;
        }

        return data || [];
      }),
    );

    const allRows = results.flat();
    if (allRows.length === 0) {
      return [];
    }

    // 유저별 최신 레코드 1건만
    const latestByUser = new Map<string, AccountInfoRow>();
    for (const row of allRows) {
      const existing = latestByUser.get(row.user_id);
      if (
        !existing ||
        new Date(row.created_at).getTime() >
          new Date(existing.created_at).getTime()
      ) {
        latestByUser.set(row.user_id, row);
      }
    }

    return Array.from(latestByUser.values()).map((row) => ({
      id: row.id,
      userId: row.user_id,
      accountBank: row.account_bank,
      accountNumber: row.account_number,
      accountUserName: row.account_user_name,
      displayNumber: row.display_number,
      createdAt: row.created_at,
    }));
  }

  async create(data: {
    userId: string;
    accountBank: string;
    accountNumber: string;
    accountUserName: string;
    displayNumber: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('account_info')
      .insert({
        user_id: data.userId,
        account_bank: data.accountBank,
        account_number: data.accountNumber,
        account_user_name: data.accountUserName,
        display_number: data.displayNumber,
      });

    if (error) {
      throw error;
    }
  }
}
