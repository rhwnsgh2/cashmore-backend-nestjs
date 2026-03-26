import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IAttendanceRepository,
  AttendanceRecord,
  AttendancePointAction,
} from '../interfaces/attendance-repository.interface';

interface AttendanceRow {
  id: number;
  user_id: string;
  created_at_date: string;
  created_at: string;
}

interface PointActionRow {
  id: number;
  created_at: string;
  point_amount: number;
  additional_data: {
    attendance_id?: number;
  };
  type: string;
}

@Injectable()
export class SupabaseAttendanceRepository implements IAttendanceRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findByUserId(userId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('attendance')
      .select('id, user_id, created_at_date, created_at')
      .eq('user_id', userId)
      .returns<AttendanceRow[]>();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      createdAtDate: item.created_at_date,
      createdAt: item.created_at,
    }));
  }

  async findPointActionsByUserId(
    userId: string,
  ): Promise<AttendancePointAction[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('id, created_at, point_amount, additional_data, type')
      .eq('user_id', userId)
      .in('type', ['ATTENDANCE_AD', 'ATTENDANCE'])
      .eq('status', 'done')
      .returns<PointActionRow[]>();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      pointAmount: item.point_amount,
      additionalData: item.additional_data,
      type: item.type as 'ATTENDANCE' | 'ATTENDANCE_AD',
    }));
  }

  async findByUserIdAndDate(
    userId: string,
    date: string,
  ): Promise<AttendanceRecord | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('attendance')
      .select('id, user_id, created_at_date, created_at')
      .eq('user_id', userId)
      .eq('created_at_date', date)
      .maybeSingle<AttendanceRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      createdAtDate: data.created_at_date,
      createdAt: data.created_at,
    };
  }

  async insertAttendance(
    userId: string,
    date: string,
  ): Promise<AttendanceRecord> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('attendance')
      .insert({ user_id: userId, created_at_date: date })
      .select('id, user_id, created_at_date, created_at')
      .single<AttendanceRow>();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      createdAtDate: data.created_at_date,
      createdAt: data.created_at,
    };
  }

  async findAttendancesByUserIdInDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<AttendanceRecord[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('attendance')
      .select('id, user_id, created_at_date, created_at')
      .eq('user_id', userId)
      .gte('created_at_date', startDate)
      .lte('created_at_date', endDate)
      .returns<AttendanceRow[]>();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      createdAtDate: item.created_at_date,
      createdAt: item.created_at,
    }));
  }
}
