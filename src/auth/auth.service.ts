import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface UserIdResult {
  id: string;
}

@Injectable()
export class AuthService {
  constructor(private supabaseService: SupabaseService) {}

  async getUserIdByAuthId(authId: string): Promise<string | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user')
      .select('id')
      .eq('auth_id', authId)
      .single<UserIdResult>();

    if (error || !data) {
      return null;
    }

    return data.id;
  }
}
