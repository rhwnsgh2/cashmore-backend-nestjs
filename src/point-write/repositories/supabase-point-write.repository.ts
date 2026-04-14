import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { IPointWriteRepository } from '../point-write-repository.interface';
import type { Json } from '../../supabase/database.types';

@Injectable()
export class SupabasePointWriteRepository implements IPointWriteRepository {
  constructor(private supabaseService: SupabaseService) {}

  async insertPointAction(
    userId: string,
    amount: number,
    type: string,
    status: string,
    additionalData: Record<string, unknown>,
  ): Promise<{ id: number }> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .insert({
        user_id: userId,
        point_amount: amount,
        type,
        status,
        additional_data: additionalData as unknown as Json,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return { id: (data as { id: number }).id };
  }

  async upsertBalance(
    userId: string,
    delta: number,
    newPointActionId: number,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .rpc('upsert_user_point_balance', {
        p_user_id: userId,
        p_delta: delta,
        p_new_id: newPointActionId,
      });

    if (error) {
      throw error;
    }
  }
}
