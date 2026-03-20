import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  CreateUserData,
  DeviceEvent,
  IUserRepository,
  User,
  UserProvider,
} from '../interfaces/user-repository.interface';
import type { Json } from '../../supabase/database.types';

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
      .update({ nickname })
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

  async findByAuthId(authId: string): Promise<User | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user')
      .select(
        'id, email, auth_id, created_at, marketing_info, is_banned, nickname, provider',
      )
      .eq('auth_id', authId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as User;
  }

  async create(userData: CreateUserData): Promise<{ id: string }> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user')
      .insert({
        auth_id: userData.authId,
        email: userData.email,
        nickname: userData.nickname,
        fcm_token: userData.fcmToken || '',
        marketing_info: userData.marketingAgreement,
        device_id: userData.deviceId || null,
        provider: userData.provider,
      })
      .select('id')
      .single<{ id: string }>();

    if (error) {
      throw error;
    }

    return { id: data.id };
  }

  async getAuthProvider(authId: string): Promise<UserProvider> {
    const { data, error } = await this.supabaseService
      .getClient()
      .auth.admin.getUserById(authId);

    if (error || !data?.user) {
      return 'other';
    }

    const provider = data.user.app_metadata?.provider as string;
    if (provider === 'apple' || provider === 'kakao') {
      return provider;
    }
    return 'other';
  }

  async findDeviceEventsByDeviceId(deviceId: string): Promise<DeviceEvent[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('device_event_participation')
      .select('device_id, event_name')
      .eq('device_id', deviceId);

    if (error) {
      return [];
    }

    return (data as DeviceEvent[]) ?? [];
  }

  async createDeviceEvent(
    deviceId: string,
    eventName: string,
    userId: string,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('device_event_participation')
      .insert({
        device_id: deviceId,
        event_name: eventName,
        user_id: userId,
      });

    if (error) {
      throw error;
    }
  }

  async createPointAction(
    userId: string,
    type: string,
    pointAmount: number,
    additionalData: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .insert({
        user_id: userId,
        type,
        point_amount: pointAmount,
        additional_data: additionalData as Json,
      });

    if (error) {
      throw error;
    }
  }

  async findDeviceId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('device_event_participation')
      .select('device_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return (data as { device_id: string }).device_id;
  }

  async isInvitedUser(userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('invitation_user')
      .select('id')
      .eq('user_id', userId);

    if (error) {
      return false;
    }

    return (data?.length ?? 0) > 0;
  }
}
