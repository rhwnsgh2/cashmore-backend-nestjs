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
}
