import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  CASHBACK_POINT_ACTION_TYPES,
  type ICashbackRepository,
  type RawEveryReceipt,
  type RawPointAction,
  type RawStepReward,
  type RawAffiliateData,
  type RawAttendance,
  type RawAttendancePointAction,
  type RawClaim,
  type RawNaverPayExchange,
  type RawCashExchange,
} from '../interfaces/cashback-repository.interface';

@Injectable()
export class SupabaseCashbackRepository implements ICashbackRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findEveryReceipts(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawEveryReceipt[]> {
    let query = this.supabaseService
      .getClient()
      .from('every_receipt')
      .select('id, created_at, point, status, image_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as unknown as RawEveryReceipt[];
  }

  async findPointActions(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawPointAction[]> {
    let query = this.supabaseService
      .getClient()
      .from('point_actions')
      .select('id, created_at, point_amount, type, status, additional_data')
      .eq('user_id', userId)
      .in('type', [...CASHBACK_POINT_ACTION_TYPES])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as unknown as RawPointAction[];
  }

  async findStepRewards(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawStepReward[]> {
    let query = this.supabaseService
      .getClient()
      .from('step_rewards')
      .select('id, created_at, point_amount, step_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as unknown as RawStepReward[];
  }

  async findAffiliateData(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawAffiliateData[]> {
    let query = this.supabaseService
      .getClient()
      .from('affiliate_callback_data')
      .select(
        'id, created_at, point_amount, status, approval_date, instant_amount, prepayment_metadata, data',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as unknown as RawAffiliateData[];
  }

  async findAttendances(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawAttendance[]> {
    let query = this.supabaseService
      .getClient()
      .from('attendance')
      .select('id, created_at, created_at_date')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as unknown as RawAttendance[];
  }

  async findAttendancePointActions(
    userId: string,
  ): Promise<RawAttendancePointAction[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('id, point_amount, additional_data, type')
      .eq('user_id', userId)
      .in('type', ['ATTENDANCE'])
      .eq('status', 'done');

    if (error || !data) return [];
    return data as unknown as RawAttendancePointAction[];
  }

  async findClaims(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawClaim[]> {
    let query = this.supabaseService
      .getClient()
      .from('claim')
      .select('id, created_at, cashback_amount, status, location_info(title)')
      .eq('user_id', userId)
      .not('location_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as unknown as RawClaim[];
  }

  async sumCompletedClaimCashback(userId: string): Promise<number> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('claim')
      .select('cashback_amount')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (error || !data) return 0;
    return data.reduce(
      (acc: number, row: { cashback_amount: number | null }) =>
        acc + (row.cashback_amount ?? 0),
      0,
    );
  }

  async sumExchangePointToCash(userId: string): Promise<number> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('point_amount')
      .eq('user_id', userId)
      .eq('type', 'EXCHANGE_POINT_TO_CASH')
      .eq('status', 'done');

    if (error || !data) return 0;
    return data.reduce(
      (acc: number, row: { point_amount: number | null }) =>
        acc + (row.point_amount ?? 0) * -1,
      0,
    );
  }

  async sumCashExchangeDone(userId: string): Promise<number> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('cash_exchanges')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'done');

    if (error || !data) return 0;
    return data.reduce(
      (acc: number, row: { amount: number | null }) => acc + (row.amount ?? 0),
      0,
    );
  }

  async findCashExchangesByPointActionIds(
    pointActionIds: number[],
  ): Promise<RawCashExchange[]> {
    if (pointActionIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('cash_exchanges')
      .select('id, point_action_id, created_at, amount, status')
      .in('point_action_id', pointActionIds);

    if (error || !data) return [];
    return data as unknown as RawCashExchange[];
  }

  async findCashExchangesPaged(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawCashExchange[]> {
    let query = this.supabaseService
      .getClient()
      .from('cash_exchanges')
      .select('id, point_action_id, created_at, amount, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as unknown as RawCashExchange[];
  }

  async findPointActionsByIds(ids: number[]): Promise<RawPointAction[]> {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('id, created_at, point_amount, type, status, additional_data')
      .in('id', ids);

    if (error || !data) return [];
    return data as unknown as RawPointAction[];
  }

  async findNaverPayExchanges(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawNaverPayExchange[]> {
    let query = this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .select('id, created_at, cashmore_point, naverpay_point, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as unknown as RawNaverPayExchange[];
  }
}
