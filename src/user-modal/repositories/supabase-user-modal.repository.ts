import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IUserModalRepository,
  UserModal,
  UserModalType,
  UserModalStatus,
} from '../interfaces/user-modal-repository.interface';

interface UserModalRow {
  id: number;
  name: string;
  status: string;
  additional_data: Record<string, unknown> | null;
}

@Injectable()
export class SupabaseUserModalRepository implements IUserModalRepository {
  constructor(private supabase: SupabaseService) {}

  async findPendingByUserId(userId: string): Promise<UserModal[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('modal_shown')
      .select('id, name, status, additional_data')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .returns<UserModalRow[]>();

    if (error) {
      throw error;
    }

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name as UserModalType,
      status: row.status as UserModalStatus,
      additionalData: row.additional_data,
    }));
  }
}
