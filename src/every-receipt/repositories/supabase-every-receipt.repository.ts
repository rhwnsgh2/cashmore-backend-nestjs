import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  InsertEveryReceiptParams,
  InsertedEveryReceipt,
  PendingEveryReceipt,
  CreatedReReview,
  AdminEveryReceiptRow,
  AdminReReviewRow,
} from '../interfaces/every-receipt-repository.interface';
import {
  IEveryReceiptRepository,
  EveryReceipt,
  EveryReceiptDetail,
  EveryReceiptStatus,
  ReReviewStatus,
  ScoreData,
} from '../interfaces/every-receipt-repository.interface';
import type { Json } from '../../supabase/database.types';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Seoul';

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

const DEFAULT_LIMIT = 20;

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

  async countCompletedByUserId(userId: string): Promise<number> {
    const { count, error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  async countByUserIdAndMonth(
    userId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const startKst = dayjs.tz(
      `${year}-${String(month).padStart(2, '0')}-01`,
      TIMEZONE,
    );
    const endKst = startKst.add(1, 'month');

    const { count, error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', startKst.toISOString())
      .lt('created_at', endKst.toISOString());

    if (error) {
      throw error;
    }

    return count ?? 0;
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

  async insert(
    params: InsertEveryReceiptParams,
  ): Promise<InsertedEveryReceipt> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .insert({
        user_id: params.userId,
        image_url: params.imageUrl,
        status: 'pending',
        point: 0,
        position: params.position,
      })
      .select('id')
      .single<{ id: number }>();

    if (error || !data) {
      throw error ?? new Error('Failed to insert receipt');
    }

    return { id: data.id };
  }

  async findPendingWithScoreData(
    receiptId: number,
  ): Promise<PendingEveryReceipt | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .select('id, user_id, point, score_data')
      .eq('id', receiptId)
      .not('score_data', 'is', null)
      .not('status', 'eq', 'completed')
      .not('status', 'eq', 'rejected')
      .single<{
        id: number;
        user_id: string;
        point: number;
        score_data: ScoreData;
      }>();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      point: data.point,
      scoreData: data.score_data,
    };
  }

  async updateToCompleted(receiptId: number): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', receiptId);

    if (error) {
      throw error;
    }
  }

  async updateToRejected(receiptId: number, reason: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .update({
        status: 'rejected',
        rejected_reason: reason,
      })
      .eq('id', receiptId);

    if (error) {
      throw error;
    }
  }

  async updatePoint(receiptId: number, point: number): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .update({ point })
      .eq('id', receiptId);

    if (error) {
      throw error;
    }
  }

  async isFirstReceipt(userId: string, receiptId: number): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single<{ id: number }>();

    if (error || !data) {
      return false;
    }

    return data.id === receiptId;
  }

  async findEveryReceiptForReReview(
    receiptId: number,
    userId: string,
  ): Promise<{
    id: number;
    point: number;
    score_data: Record<string, unknown> | null;
  } | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .select('id, point, score_data')
      .eq('id', receiptId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return data as {
      id: number;
      point: number;
      score_data: Record<string, unknown> | null;
    };
  }

  async hasExistingReReview(receiptId: number): Promise<boolean> {
    const { data } = await this.supabaseService
      .getClient()
      .from('every_receipt_re_review')
      .select('id')
      .eq('every_receipt_id', receiptId)
      .single();

    return !!data;
  }

  async findReceiptForAdmin(
    receiptId: number,
  ): Promise<AdminEveryReceiptRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .select('id, user_id, status, point')
      .eq('id', receiptId)
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as AdminEveryReceiptRow;
  }

  async deleteReceipt(receiptId: number): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .delete()
      .eq('id', receiptId);

    if (error) throw error;
  }

  async updateReceiptPoint(receiptId: number, newPoint: number): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .update({
        point: newPoint,
        updated_at: new Date().toISOString(),
      })
      .eq('id', receiptId);

    if (error) throw error;
  }

  async findReReviewByReceiptId(
    everyReceiptId: number,
  ): Promise<AdminReReviewRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt_re_review')
      .select('id, every_receipt_id, status')
      .eq('every_receipt_id', everyReceiptId)
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as AdminReReviewRow;
  }

  async updateReReviewToRejected(reReviewId: number): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('every_receipt_re_review')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reReviewId);

    if (error) throw error;
  }

  async updateReReviewToCompleted(
    reReviewId: number,
    afterScoreData: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('every_receipt_re_review')
      .update({
        status: 'completed',
        after_score_data: afterScoreData as unknown as Json,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reReviewId);

    if (error) throw error;
  }

  async updateReceiptAfterReReview(
    receiptId: number,
    afterScoreData: Record<string, unknown>,
    afterPoint: number,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .update({
        score_data: afterScoreData as unknown as Json,
        point: afterPoint,
        status: 'completed',
      })
      .eq('id', receiptId);

    if (error) throw error;
  }

  async updateReceiptStatusToCompleted(receiptId: number): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', receiptId);

    if (error) throw error;
  }

  async createReReview(params: {
    everyReceiptId: number;
    requestedItems: string[];
    userNote: string;
    userId: string;
    beforeScoreData: Record<string, unknown> | null;
  }): Promise<CreatedReReview> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt_re_review')
      .insert({
        every_receipt_id: params.everyReceiptId,
        requested_items: params.requestedItems,
        user_note: params.userNote || '',
        status: 'pending',
        before_score_data:
          params.beforeScoreData as unknown as import('../../supabase/database.types').Json,
        user_id: params.userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data as CreatedReReview;
  }

  async updateStatusToReReview(receiptId: number): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .update({ status: 're-review' })
      .eq('id', receiptId);

    if (error) throw error;
  }

  async findReReviewsSince(
    userId: string,
    since: string,
  ): Promise<
    import('../interfaces/every-receipt-repository.interface').ReReviewRecord[]
  > {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt_re_review')
      .select('id, status, created_at')
      .eq('user_id', userId)
      .gte('created_at', since);

    if (error || !data) return [];
    return data as { id: number; status: string; created_at: string }[];
  }
}
