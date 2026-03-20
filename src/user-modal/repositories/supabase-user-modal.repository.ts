import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IUserModalRepository,
  UserModal,
  UserModalType,
  UserModalStatus,
} from '../interfaces/user-modal-repository.interface';
import type { Json } from '../../supabase/database.types';

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

  async hasModalByName(userId: string, name: UserModalType): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('modal_shown')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name)
      .limit(1);

    if (error) {
      throw error;
    }

    return (data?.length ?? 0) > 0;
  }

  async createModal(
    userId: string,
    name: UserModalType,
    additionalData?: Record<string, unknown>,
  ): Promise<void> {
    const insertData: {
      user_id: string;
      name: string;
      status: string;
      additional_data?: Json;
    } = {
      user_id: userId,
      name,
      status: 'pending',
    };

    if (additionalData) {
      insertData.additional_data = additionalData as Json;
    }

    const { error } = await this.supabase
      .getClient()
      .from('modal_shown')
      .insert(insertData);

    if (error) {
      throw error;
    }
  }
}
