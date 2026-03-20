import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IOnboardingRepository,
  DeviceEventParticipation,
} from '../interfaces/onboarding-repository.interface';

interface DeviceEventParticipationRow {
  id: string;
  created_at: string;
}

@Injectable()
export class SupabaseOnboardingRepository implements IOnboardingRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findOnboardingEventParticipation(
    userId: string,
  ): Promise<DeviceEventParticipation | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('device_event_participation')
      .select('id, created_at')
      .eq('event_name', 'onboarding_event')
      .eq('user_id', userId)
      .maybeSingle<DeviceEventParticipationRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      createdAt: data.created_at,
    };
  }
}
