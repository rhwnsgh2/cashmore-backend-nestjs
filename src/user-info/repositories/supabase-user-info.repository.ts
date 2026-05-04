import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IUserInfoRepository,
  UserInfoRow,
} from '../interfaces/user-info-repository.interface';

@Injectable()
export class SupabaseUserInfoRepository implements IUserInfoRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findPhoneByUserId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_info')
      .select('phone_number')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data?.phone_number ?? null;
  }

  async upsertPhone(
    userId: string,
    phoneNumber: string,
  ): Promise<UserInfoRow> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_info')
      .upsert(
        { user_id: userId, phone_number: phoneNumber },
        { onConflict: 'user_id' },
      )
      .select()
      .single();
    if (error) throw error;
    return data as unknown as UserInfoRow;
  }
}
