import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IPartnerProgramRepository,
  PartnerProgram,
} from '../interfaces/partner-program-repository.interface';

@Injectable()
export class SupabasePartnerProgramRepository
  implements IPartnerProgramRepository
{
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
}
