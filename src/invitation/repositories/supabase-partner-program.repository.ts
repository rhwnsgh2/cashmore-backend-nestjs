import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IPartnerProgramRepository,
  PartnerProgram,
} from '../interfaces/partner-program-repository.interface';

@Injectable()
export class SupabasePartnerProgramRepository implements IPartnerProgramRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findActiveProgram(
    userId: string,
    now: Date,
  ): Promise<PartnerProgram | null> {
    const client = this.supabaseService.getClient();
    const nowIso = now.toISOString();

    const { data, error } = await client
      .from('invitation_partner_program')
      .select('id, user_id, starts_at, ends_at')
      .eq('user_id', userId)
      .lte('starts_at', nowIso)
      .gte('ends_at', nowIso)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
    };
  }

  async findOverlappingUserIds(
    userIds: string[],
    startsAt: string,
    endsAt: string,
  ): Promise<string[]> {
    if (userIds.length === 0) return [];

    const client = this.supabaseService.getClient();

    // 겹침: NOT (기존.ends_at < 신규.starts_at OR 기존.starts_at > 신규.ends_at)
    //     = 기존.ends_at >= 신규.starts_at AND 기존.starts_at <= 신규.ends_at
    const { data, error } = await client
      .from('invitation_partner_program')
      .select('user_id')
      .in('user_id', userIds)
      .gte('ends_at', startsAt)
      .lte('starts_at', endsAt)
      .returns<{ user_id: string }[]>();

    if (error || !data) {
      return [];
    }

    return Array.from(new Set(data.map((row) => row.user_id)));
  }

  async createMany(
    rows: { userId: string; startsAt: string; endsAt: string }[],
  ): Promise<number> {
    if (rows.length === 0) return 0;

    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('invitation_partner_program')
      .insert(
        rows.map((r) => ({
          user_id: r.userId,
          starts_at: r.startsAt,
          ends_at: r.endsAt,
        })),
      )
      .select('id');

    if (error || !data) {
      throw new Error(
        `failed to create partner programs: ${error?.message ?? 'unknown'}`,
      );
    }

    return data.length;
  }
}
