import { Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  Advertiser,
  IAdvertiserAuthRepository,
} from '../interfaces/advertiser-auth-repository.interface';

@Injectable()
export class SupabaseAdvertiserAuthRepository
  implements IAdvertiserAuthRepository
{
  constructor(private supabaseService: SupabaseService) {}

  async findByLoginId(loginId: string): Promise<Advertiser | null> {
    const client = this.supabaseService.getClient() as unknown as SupabaseClient;

    const { data, error } = await client
      .from('advertisers')
      .select('id, login_id, password_hash, company_name')
      .eq('login_id', loginId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Advertiser;
  }

  async create(
    loginId: string,
    passwordHash: string,
    companyName: string,
  ): Promise<Advertiser> {
    const client =
      this.supabaseService.getClient() as unknown as SupabaseClient;

    const { data, error } = await client
      .from('advertisers')
      .insert({
        login_id: loginId,
        password_hash: passwordHash,
        company_name: companyName,
      })
      .select('id, login_id, password_hash, company_name')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to create advertiser');
    }

    return data as Advertiser;
  }
}
