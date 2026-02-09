import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { IFcmRepository } from '../interfaces/fcm-repository.interface';

@Injectable()
export class SupabaseFcmRepository implements IFcmRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findFcmToken(userId: string): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user')
      .select('fcm_token')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[FCM] Failed to find FCM token:', error.message);
      return null;
    }

    return (data as { fcm_token: string }).fcm_token ?? null;
  }
}
