import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IEveryReceiptRepository,
  EveryReceipt,
  EveryReceiptStatus,
} from '../interfaces/every-receipt-repository.interface';

interface EveryReceiptRow {
  id: string;
  created_at: string;
  point: number;
  status: string;
  image_url: string | null;
}

const DEFAULT_LIMIT = 120;

@Injectable()
export class SupabaseEveryReceiptRepository implements IEveryReceiptRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findByUserId(userId: string, limit?: number): Promise<EveryReceipt[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .select('id, created_at, point, status, image_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit ?? DEFAULT_LIMIT)
      .returns<EveryReceiptRow[]>();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      pointAmount: item.point,
      status: item.status as EveryReceiptStatus,
      imageUrl: item.image_url,
    }));
  }
}
