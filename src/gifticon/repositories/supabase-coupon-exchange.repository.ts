import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ICouponExchangeRepository,
  CouponExchangeRow,
  CouponExchangeInsertInput,
  CouponExchangeUpdateInput,
} from '../interfaces/coupon-exchange-repository.interface';

@Injectable()
export class SupabaseCouponExchangeRepository implements ICouponExchangeRepository {
  private readonly logger = new Logger(SupabaseCouponExchangeRepository.name);

  constructor(private supabaseService: SupabaseService) {}

  async insert(input: CouponExchangeInsertInput): Promise<CouponExchangeRow> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_exchanges')
      .insert({
        user_id: input.user_id,
        point_action_id: input.point_action_id,
        amount: input.amount,
        smartcon_goods_id: input.smartcon_goods_id,
        tr_id: input.tr_id,
        idempotency_key: input.idempotency_key ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as CouponExchangeRow;
  }

  async insertOrConflict(
    input: CouponExchangeInsertInput,
  ): Promise<CouponExchangeRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_exchanges')
      .insert({
        user_id: input.user_id,
        point_action_id: input.point_action_id,
        amount: input.amount,
        smartcon_goods_id: input.smartcon_goods_id,
        tr_id: input.tr_id,
        idempotency_key: input.idempotency_key ?? null,
      })
      .select()
      .single();
    if (error) {
      // PostgreSQL 23505 = unique_violation
      if ((error as { code?: string }).code === '23505') return null;
      throw error;
    }
    return data as unknown as CouponExchangeRow;
  }

  async findByIdempotencyKey(key: string): Promise<CouponExchangeRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_exchanges')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as CouponExchangeRow | null;
  }

  async updatePointActionId(
    id: number,
    pointActionId: number,
  ): Promise<CouponExchangeRow> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_exchanges')
      .update({ point_action_id: pointActionId, updated_at: now })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as CouponExchangeRow;
  }

  async updateSendResult(
    id: number,
    patch: CouponExchangeUpdateInput,
  ): Promise<CouponExchangeRow> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_exchanges')
      .update({
        send_status: patch.send_status,
        order_id: patch.order_id ?? null,
        barcode_num: patch.barcode_num ?? null,
        exp_date: patch.exp_date ?? null,
        result_code: patch.result_code ?? null,
        result_msg: patch.result_msg ?? null,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as CouponExchangeRow;
  }

  async findById(id: number): Promise<CouponExchangeRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_exchanges')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as CouponExchangeRow | null;
  }

  async findByUserId(userId: string, limit = 50): Promise<CouponExchangeRow[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_exchanges')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as CouponExchangeRow[];
  }

  async findByStatusPaged(
    status: CouponExchangeRow['send_status'],
    offset: number,
    limit: number,
  ): Promise<CouponExchangeRow[]> {
    const ascending = status === 'pending';
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_exchanges')
      .select('*')
      .eq('send_status', status)
      .order('created_at', { ascending })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return (data ?? []) as unknown as CouponExchangeRow[];
  }

  async countByStatus(
    status: CouponExchangeRow['send_status'],
  ): Promise<number> {
    const { count, error } = await this.supabaseService
      .getClient()
      .from('coupon_exchanges')
      .select('id', { count: 'exact', head: true })
      .eq('send_status', status);
    if (error) throw error;
    return count ?? 0;
  }

  async findSentByUpdatedAtRange(
    updatedAtFromIso: string,
    updatedAtToIso: string,
  ): Promise<Array<{ amount: number; updated_at: string }>> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_exchanges')
      .select('amount, updated_at')
      .eq('send_status', 'sent')
      .gte('updated_at', updatedAtFromIso)
      .lt('updated_at', updatedAtToIso);
    if (error) throw error;
    return (data ?? []) as Array<{ amount: number; updated_at: string }>;
  }
}
