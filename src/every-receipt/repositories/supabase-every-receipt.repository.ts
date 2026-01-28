import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IEveryReceiptRepository,
  EveryReceipt,
  EveryReceiptDetail,
  EveryReceiptStatus,
  ReReviewStatus,
  ScoreData,
} from '../interfaces/every-receipt-repository.interface';

interface EveryReceiptRow {
  id: string;
  created_at: string;
  point: number;
  status: string;
  image_url: string | null;
}

interface EveryReceiptDetailRow {
  id: number;
  created_at: string;
  point: number;
  status: string;
  image_url: string | null;
  score_data: ScoreData | null;
}

const DEFAULT_LIMIT = 10;

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

  async findById(
    receiptId: number,
    userId: string,
  ): Promise<EveryReceiptDetail | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .select('id, created_at, point, status, image_url, score_data')
      .eq('id', receiptId)
      .eq('user_id', userId)
      .single<EveryReceiptDetailRow>();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      createdAt: data.created_at,
      pointAmount: data.point,
      status: data.status as EveryReceiptStatus,
      imageUrl: data.image_url,
      scoreData: data.score_data,
    };
  }

  async findReReviewStatus(receiptId: number): Promise<ReReviewStatus | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt_re_review')
      .select('status')
      .eq('every_receipt_id', receiptId)
      .single<{ status: string }>();

    if (error || !data) {
      return null;
    }

    return data.status as ReReviewStatus;
  }
}
