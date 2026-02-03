import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { IInviteCodeRepository } from '../interfaces/invite-code-repository.interface';

@Injectable()
export class SupabaseInviteCodeRepository implements IInviteCodeRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findDeviceIdByUserId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user')
      .select('device_id')
      .eq('id', userId)
      .single<{ device_id: string }>();

    if (error || !data) {
      return null;
    }

    return data.device_id;
  }

  async hasDeviceEventParticipation(deviceId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('device_event_participation')
      .select('id')
      .eq('event_name', 'invitation_reward')
      .eq('device_id', deviceId);

    if (error) {
      return true; // 에러 시 안전하게 false 반환 방지
    }

    return (data?.length ?? 0) > 0;
  }

  async hasAlreadyBeenInvited(userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('invitation_user')
      .select('id')
      .eq('user_id', userId);

    if (error) {
      return true;
    }

    return (data?.length ?? 0) > 0;
  }

  async findUserCreatedAt(userId: string): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user')
      .select('created_at')
      .eq('id', userId)
      .single<{ created_at: string }>();

    if (error || !data) {
      return null;
    }

    return data.created_at;
  }
}
