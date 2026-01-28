import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  ICalendarRepository,
  DailyReceiptCount,
  DailyPointSum,
} from '../interfaces/calendar-repository.interface';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Seoul';

@Injectable()
export class SupabaseCalendarRepository implements ICalendarRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findDailyReceiptCounts(
    userId: string,
    yearMonth: string,
  ): Promise<DailyReceiptCount[]> {
    const startDate = `${yearMonth}-01`;
    const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');

    const { data, error } = await this.supabaseService
      .getClient()
      .from('every_receipt')
      .select('created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', `${startDate}T00:00:00+09:00`)
      .lte('created_at', `${endDate}T23:59:59+09:00`);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 날짜별로 그룹화
    const countMap = new Map<string, number>();
    for (const row of data as { created_at: string }[]) {
      const date = dayjs(row.created_at).tz(TIMEZONE).format('YYYY-MM-DD');
      countMap.set(date, (countMap.get(date) || 0) + 1);
    }

    return Array.from(countMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async findDailyPointSums(
    userId: string,
    yearMonth: string,
  ): Promise<DailyPointSum[]> {
    const startDate = `${yearMonth}-01`;
    const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');

    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('created_at, point_amount')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gt('point_amount', 0) // 획득 포인트만
      .gte('created_at', `${startDate}T00:00:00+09:00`)
      .lte('created_at', `${endDate}T23:59:59+09:00`);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 날짜별로 합산
    const sumMap = new Map<string, number>();
    for (const row of data as { created_at: string; point_amount: number }[]) {
      const date = dayjs(row.created_at).tz(TIMEZONE).format('YYYY-MM-DD');
      sumMap.set(date, (sumMap.get(date) || 0) + row.point_amount);
    }

    return Array.from(sumMap.entries())
      .map(([date, points]) => ({ date, points }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
