import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IUserRepository,
  User,
} from '../interfaces/user-repository.interface';

@Injectable()
export class SupabaseUserRepository implements IUserRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findById(userId: string): Promise<User | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user')
      .select(
        'id, email, auth_id, created_at, marketing_info, is_banned, nickname, provider',
      )
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as User;
  }

  async updateNickname(userId: string, nickname: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('user')
      .update({ nickname } as never)
      .eq('id', userId);

    if (error) {
      throw error;
    }
  }

  async findBanReason(authId: string): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('banned_user')
      .select('reason')
      .eq('auth_id', authId)
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return (data as { reason: string }).reason;
  }
}
